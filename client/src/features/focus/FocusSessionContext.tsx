// One owner for the open Focus session (D2.5). The Dashboard card, the persistent pill and the Focus
// screen read the same state and call the same existing mutations (pause, resume, finish,
// setFollowUp), so a session behaves identically wherever it is controlled. The provider also mounts
// the single polite live region (events only, never seconds) and the shared Finish sheet.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import type { WorkspaceScope } from "@/lib/workspace";
import { resolveCategoryTones, toneClassName, type ToneOrNeutral } from "@/design/categoryTone";
import { buildMeetingHorizon } from "@shared/focusFollowUp";
import { useFocusElapsedSeconds, type FocusWatchSession } from "./FocusTimeDial";
import {
  FOCUS_OFFLINE_GUIDANCE,
  focusAnnouncement,
  newestFinishedSession,
  recentFocusHandoff,
  runFocusMutation,
  type FocusAnnouncerState,
} from "./focusDisplay";
import { FocusFinishFlow } from "./FocusFinishFlow";
import { Sheet } from "@/components/premium/Sheet";

export type FocusOutcome = "done" | "continue" | "adjust_estimate" | "stopped";
export type NextStepAction = "task" | "plan" | "none";

export type FocusTaskInfo = {
  id: string;
  title: string;
  estimateMinutes: number | null;
  version: number | undefined;
  categoryName: string | null;
  projectTitle: string | null;
  tone: ToneOrNeutral;
  available: boolean;
};

export type FocusHandoff = {
  id: string;
  version: number;
  taskId: string | null;
  taskTitle: string;
  outcome: string | null;
  note: string;
  nextStepAction: NextStepAction | null;
  nextStepTaskId: string | null;
  activeSeconds: number;
  targetMinutes: number | null;
  endedAt: string | null;
  state: string;
};

export type FocusFinishInput = { outcome: FocusOutcome; note: string; adjustedEstimateMinutes: number | null };

export type FocusSessionValue = {
  scope: WorkspaceScope;
  today: string;
  snapshot: any;
  online: boolean;
  session: FocusWatchSession | null;
  task: FocusTaskInfo | null;
  title: string;
  toneClass: string;
  nextMeeting: { startsAt: number; title: string } | null;
  pending: boolean;
  error: string | null;
  clearError: () => void;
  pause: () => void;
  resume: () => void;
  finish: (input: FocusFinishInput) => void;
  finishing: boolean;
  finishError: string | null;
  clearFinishError: () => void;
  /** Response of the newest finish on this device, merged with the snapshot (authoritative). */
  lastSaved: FocusHandoff | null;
  /** Newest finished session overall (mutation response or snapshot). */
  handoff: FocusHandoff | null;
  /** A just-finished session still waiting for a next step (10 minutes, not dismissed). */
  recentHandoff: FocusHandoff | null;
  dismissHandoff: (id: string) => void;
  /** Sessions with the mutation responses merged in, for the trail and evidence. */
  sessions: any[];
  durableFollowUp: boolean;
  saveFollowUp: (sessionId: string, expectedVersion: number, action: NextStepAction, taskId: string | null, onSaved?: () => void) => void;
  followUpPending: boolean;
  followUpError: string | null;
  clearFollowUpError: () => void;
  /** True for 1.2s after a save on this device: the pill's "Saved" moment. */
  savedFlash: boolean;
  /** Outcome of the newest save on this device while its celebration may still play. */
  celebrateId: string | null;
  finishSheetOpen: boolean;
  openFinish: () => void;
  closeFinish: () => void;
  onOpenFocus: () => void;
  onOpenTask: (id: string) => void;
  onOpenPlan: () => void;
  onStartAnother: () => void;
};

export const FocusSessionContext = createContext<FocusSessionValue | null>(null);

export function useFocusSession(): FocusSessionValue | null {
  return useContext(FocusSessionContext);
}

function asHandoff(session: any, tasks: any[]): FocusHandoff {
  return {
    id: session.id,
    version: session.version,
    taskId: session.taskId ?? null,
    taskTitle: session.taskId ? tasks.find(task => task.id === session.taskId)?.title ?? "Task unavailable" : "Unlinked focus",
    outcome: session.outcome ?? (session.state === "abandoned" ? "stopped" : null),
    note: session.note ?? "",
    nextStepAction: session.nextStepAction ?? null,
    nextStepTaskId: session.nextStepTaskId ?? null,
    activeSeconds: Math.max(0, Number(session.activeSeconds) || 0),
    targetMinutes: session.targetMinutes ?? null,
    endedAt: session.endedAt ? new Date(session.endedAt).toISOString() : null,
    state: session.state,
  };
}

function finishErrorMessage(message: string | undefined) {
  return message || "Focus outcome could not be saved. Refresh and try again.";
}

export function FocusSessionProvider({
  scope,
  snapshot,
  today,
  online,
  onOpenFocus,
  onOpenTask,
  onOpenPlan,
  onStartAnother,
  children,
}: {
  scope: WorkspaceScope;
  snapshot: any;
  today: string;
  online: boolean;
  onOpenFocus: () => void;
  onOpenTask: (id: string) => void;
  onOpenPlan: () => void;
  /** Opens the Focus screen ready to start a new session. */
  onStartAnother: () => void;
  children: ReactNode;
}) {
  const utils = trpc.useUtils();
  const [error, setError] = useState<string | null>(null);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [lastSavedRaw, setLastSavedRaw] = useState<any | null>(null);
  const [finishedIds, setFinishedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  const [savedFlash, setSavedFlash] = useState(false);
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [finishSheetOpen, setFinishSheetOpen] = useState(false);
  const followUpSaved = useRef<(() => void) | null>(null);

  const refresh = useCallback(() => {
    void utils.planner.workspace.snapshot.invalidate();
    void utils.planner.dashboard.invalidate();
  }, [utils]);

  const tasks: any[] = snapshot?.tasks ?? [];
  const rawSessions: any[] = snapshot?.focusSessions ?? [];
  const session = (rawSessions.find(item => !finishedIds.has(item.id) && (item.state === "active" || item.state === "paused")) ?? null) as FocusWatchSession | null;

  const tones = useMemo(() => resolveCategoryTones(snapshot?.categories ?? []), [snapshot?.categories]);
  const taskRecord = session?.taskId ? tasks.find(task => task.id === session.taskId) : null;
  const task: FocusTaskInfo | null = session?.taskId
    ? {
        id: session.taskId,
        title: taskRecord?.title ?? "Linked task unavailable",
        estimateMinutes: taskRecord?.estimateMinutes ?? null,
        version: taskRecord?.version,
        categoryName: taskRecord?.categoryId ? (snapshot?.categories ?? []).find((category: any) => category.id === taskRecord.categoryId)?.name ?? null : null,
        projectTitle: taskRecord?.projectId ? (snapshot?.projects ?? []).find((project: any) => project.id === taskRecord.projectId)?.title ?? null : null,
        tone: taskRecord?.categoryId ? tones.get(taskRecord.categoryId) ?? "neutral" : "neutral",
        available: Boolean(taskRecord) && taskRecord.state !== "completed" && taskRecord.state !== "archived" && taskRecord.outcome !== "wont_do",
      }
    : null;
  const toneClass = task && taskRecord?.categoryId && tones.get(taskRecord.categoryId) ? toneClassName(task.tone) : "pc-tone-accent";
  const title = task?.title ?? "Unlinked focus";

  const nextMeeting = useMemo(() => {
    const meeting = buildMeetingHorizon(snapshot?.externalEvents ?? []).find(item => item.phase === "upcoming");
    return meeting ? { startsAt: meeting.startMs, title: meeting.title } : null;
  }, [snapshot?.externalEvents]);

  // Mutation responses are authoritative while the snapshot refetch is in flight.
  const sessions = useMemo(() => {
    if (!lastSavedRaw) return rawSessions;
    const refreshed = rawSessions.find(item => item.id === lastSavedRaw.id);
    const merged = refreshed && refreshed.version >= lastSavedRaw.version ? refreshed : lastSavedRaw;
    return [...rawSessions.filter(item => item.id !== lastSavedRaw.id), merged];
  }, [rawSessions, lastSavedRaw]);
  const lastSavedSession = lastSavedRaw ? sessions.find(item => item.id === lastSavedRaw.id) ?? lastSavedRaw : null;
  const latestSnapshotFinished = useMemo(
    () => [...sessions].filter(item => item.state === "completed" || item.state === "abandoned").sort((a, b) => new Date(b.endedAt ?? b.startedAt).getTime() - new Date(a.endedAt ?? a.startedAt).getTime())[0] ?? null,
    [sessions],
  );
  const handoffRaw = newestFinishedSession(lastSavedSession, latestSnapshotFinished);
  const handoff = handoffRaw ? asHandoff(handoffRaw, tasks) : null;
  const lastSaved = lastSavedSession ? asHandoff(lastSavedSession, tasks) : null;

  // The "recent" window expires on its own; tick slowly only while there is a candidate.
  const [now, setNow] = useState(() => Date.now());
  const candidate = handoff && !handoff.nextStepAction && !dismissed.has(handoff.id) ? handoff : null;
  useEffect(() => {
    if (!candidate) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [candidate?.id]);
  const recentRaw = candidate ? recentFocusHandoff(sessions, now) : null;
  const recentHandoff = recentRaw && !dismissed.has(recentRaw.id) && !session ? asHandoff(recentRaw, tasks) : null;

  useEffect(() => {
    if (!savedFlash) return;
    const timer = window.setTimeout(() => setSavedFlash(false), 1200);
    return () => window.clearTimeout(timer);
  }, [savedFlash]);
  useEffect(() => {
    if (!celebrateId) return;
    const timer = window.setTimeout(() => setCelebrateId(null), 1600);
    return () => window.clearTimeout(timer);
  }, [celebrateId]);

  const failed = (message: string) => {
    setError(message);
    refresh();
  };
  const pauseMutation = trpc.planner.focus.pause.useMutation({
    onSuccess: () => { setError(null); refresh(); },
    onError: mutationError => failed(mutationError.message || "Focus could not be paused. Refresh and try again."),
  });
  const resumeMutation = trpc.planner.focus.resume.useMutation({
    onSuccess: () => { setError(null); refresh(); },
    onError: mutationError => failed(mutationError.message || "Focus could not be resumed. Refresh and try again."),
  });
  const finishMutation = trpc.planner.focus.finish.useMutation({
    onSuccess: data => {
      setLastSavedRaw((current: any) => newestFinishedSession(current, data as any));
      setFinishedIds(current => new Set(current).add((data as any).id));
      setFinishError(null);
      setFollowUpError(null);
      setError(null);
      setSavedFlash(true);
      setCelebrateId((data as any).outcome === "done" ? (data as any).id : null);
      refresh();
      toast.success((data as any).outcome === "done" ? "Task completed and focus time recorded." : "Focus session recorded.");
    },
    onError: mutationError => {
      setFinishError(finishErrorMessage(mutationError.message));
      refresh();
    },
  });
  const followUpMutation = trpc.planner.focus.setFollowUp.useMutation({
    onSuccess: data => {
      setLastSavedRaw((current: any) => newestFinishedSession(current, data as any));
      setFollowUpError(null);
      refresh();
      toast.success("Next step saved.");
      const after = followUpSaved.current;
      followUpSaved.current = null;
      after?.();
    },
    onError: mutationError => {
      followUpSaved.current = null;
      setFollowUpError(mutationError.message || "Next step could not be saved. Refresh and retry.");
      refresh();
    },
  });

  const pending = pauseMutation.isPending || resumeMutation.isPending || finishMutation.isPending;
  const blocked = () => setError(FOCUS_OFFLINE_GUIDANCE);

  const value: FocusSessionValue = {
    scope,
    today,
    snapshot,
    online,
    session,
    task,
    title,
    toneClass,
    nextMeeting,
    pending,
    error,
    clearError: () => setError(null),
    pause: () => runFocusMutation(online, () => {
      if (!session || pending || session.state !== "active") return;
      setError(null);
      pauseMutation.mutate({ ...scope, id: session.id, expectedVersion: session.version });
    }, blocked),
    resume: () => runFocusMutation(online, () => {
      if (!session || pending || session.state !== "paused") return;
      setError(null);
      resumeMutation.mutate({ ...scope, id: session.id, expectedVersion: session.version });
    }, blocked),
    finish: input => runFocusMutation(online, () => {
      if (!session || pending) return;
      if (input.outcome === "adjust_estimate" && (!Number.isInteger(input.adjustedEstimateMinutes) || (input.adjustedEstimateMinutes ?? 0) < 5)) {
        setFinishError("Enter a revised focus estimate of at least 5 minutes.");
        return;
      }
      setFinishError(null);
      finishMutation.mutate({
        ...scope,
        id: session.id,
        expectedVersion: session.version,
        outcome: input.outcome,
        note: input.note.trim() || null,
        adjustedEstimateMinutes: input.outcome === "adjust_estimate" ? input.adjustedEstimateMinutes : null,
        taskExpectedVersion: input.outcome === "done" || input.outcome === "adjust_estimate" ? task?.version : undefined,
      });
    }, () => setFinishError("Reconnect to save. Your choice stays here.")),
    finishing: finishMutation.isPending,
    finishError,
    clearFinishError: () => setFinishError(null),
    lastSaved,
    handoff,
    recentHandoff,
    dismissHandoff: id => setDismissed(current => new Set(current).add(id)),
    sessions,
    durableFollowUp: snapshot?.focusHabitAttributionAvailable === true,
    saveFollowUp: (sessionId, expectedVersion, action, nextStepTaskId, onSaved) => runFocusMutation(online, () => {
      if (followUpMutation.isPending) return;
      setFollowUpError(null);
      followUpSaved.current = onSaved ?? null;
      followUpMutation.mutate({ ...scope, id: sessionId, expectedVersion, nextStepAction: action, nextStepTaskId });
    }, () => setFollowUpError("Reconnect to save. Your choice stays here.")),
    followUpPending: followUpMutation.isPending,
    followUpError,
    clearFollowUpError: () => setFollowUpError(null),
    savedFlash,
    celebrateId,
    finishSheetOpen,
    openFinish: () => { setFinishError(null); setFinishSheetOpen(true); },
    closeFinish: () => setFinishSheetOpen(false),
    onOpenFocus,
    onOpenTask,
    onOpenPlan,
    onStartAnother,
  };

  return (
    <FocusSessionContext.Provider value={value}>
      {children}
      <FocusAnnouncer session={session} />
      <Sheet
        open={finishSheetOpen && Boolean(session || lastSaved)}
        onOpenChange={open => { if (!open) setFinishSheetOpen(false); }}
        title={session ? "Finish focus" : "Saved. What next?"}
        hideTitle
        contentClassName={toneClass}
        className="pc-focus-finish-sheet"
        onOpenAutoFocus={event => {
          const heading = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>("[data-focus-finish-heading]");
          if (heading) { event.preventDefault(); heading.focus(); }
        }}
      >
        <FocusFinishFlow
          surface="sheet"
          onBack={() => setFinishSheetOpen(false)}
          onClose={() => setFinishSheetOpen(false)}
        />
      </Sheet>
    </FocusSessionContext.Provider>
  );
}

/**
 * The single polite live region for Focus. It speaks only on events (start, pause, resume, five
 * minutes left, target reached, saved) and never on first mount, so pages never double-announce.
 */
function FocusAnnouncer({ session }: { session: FocusWatchSession | null }) {
  const elapsed = useFocusElapsedSeconds(session);
  const current: FocusAnnouncerState = session ? { id: session.id, state: session.state, elapsedSeconds: elapsed, targetMinutes: session.targetMinutes } : null;
  const previous = useRef<FocusAnnouncerState | undefined>(undefined);
  const [message, setMessage] = useState("");
  const key = current ? `${current.id}|${current.state}|${current.elapsedSeconds}` : "none";
  useEffect(() => {
    if (previous.current === undefined) {
      previous.current = current;
      return;
    }
    const announcement = focusAnnouncement(previous.current, current);
    previous.current = current;
    if (announcement) setMessage(announcement);
  }, [key]);
  return (
    <div className="pc-sr-only" role="status" aria-live="polite" aria-atomic="true" data-focus-announcer="">
      {message}
    </div>
  );
}
