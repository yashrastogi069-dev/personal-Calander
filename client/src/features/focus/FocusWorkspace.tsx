import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type { WorkspaceScope } from "@/lib/workspace";
import { focusEstimateAccuracy, focusMinutes } from "@shared/focusMetrics";
export {
  formatElapsedDuration,
  formatFocusTargetGuidance,
} from "@shared/focusClock";
import {
  FocusTimeDial,
  useFocusPresentation,
  type FocusWatchSession,
} from "./FocusTimeDial";
import { FocusFollowUpPanel } from "./FocusFollowUpPanel";
import {
  Check,
  CircleAlert,
  Coffee,
  Pause,
  Play,
  Square,
  TimerReset,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type FocusWorkspaceProps = {
  scope: WorkspaceScope;
  snapshot: any;
  today: string;
  initialTaskId?: string | null;
  isOnline?: boolean;
  onOpenTask: (id: string) => void;
  onOpenHabit: (id: string) => void;
  onOpenCalendar: () => void;
  onOpenPlan: () => void;
  onHabitCheckIn: (
    habitId: string,
    localDate: string,
    state: "completed" | "skipped"
  ) => void;
  onClearHabitCheckIn: (habitId: string, localDate: string) => void;
};

export const FOCUS_OFFLINE_GUIDANCE =
  "Focus sessions need a connection to save changes. Reconnect to start, pause, resume, or finish this session.";

export function runFocusMutation(
  isOnline: boolean,
  mutate: () => void,
  onBlocked?: () => void
) {
  if (!isOnline) {
    onBlocked?.();
    return false;
  }
  mutate();
  return true;
}

export function initialFocusTaskSelection(
  eligibleTasks: Array<{ id: string }>,
  initialTaskId?: string | null
) {
  if (initialTaskId)
    return eligibleTasks.some(task => task.id === initialTaskId)
      ? initialTaskId
      : "none";
  return eligibleTasks[0]?.id ?? "none";
}

type FinishedSession = { id: string; version: number; endedAt?: string | Date | null; startedAt?: string | Date | null };

export function newestFinishedSession<T extends FinishedSession>(current: T | null | undefined, incoming: T | null | undefined): T | null {
  if (!current) return incoming ?? null;
  if (!incoming) return current;
  if (current.id === incoming.id) return incoming.version >= current.version ? incoming : current;
  const currentEnd = new Date(current.endedAt ?? current.startedAt ?? 0).getTime();
  const incomingEnd = new Date(incoming.endedAt ?? incoming.startedAt ?? 0).getTime();
  return incomingEnd > currentEnd ? incoming : current;
}

function useBrowserOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine
  );
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    update();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return isOnline;
}

export function FocusWorkspace({
  scope,
  snapshot,
  today,
  initialTaskId,
  isOnline: isOnlineOverride,
  onOpenTask,
  onOpenHabit,
  onOpenCalendar,
  onOpenPlan,
  onHabitCheckIn,
  onClearHabitCheckIn,
}: FocusWorkspaceProps) {
  const browserOnline = useBrowserOnlineStatus();
  const isOnline = isOnlineOverride ?? browserOnline;
  const utils = trpc.useUtils();
  const [recentFinishedSession, setRecentFinishedSession] = useState<
    (FinishedSession & Record<string, any>) | null
  >(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const sessions = snapshot.focusSessions ?? [];
  const tasks = (snapshot.tasks ?? []).filter(
    (task: any) =>
      task.state !== "completed" &&
      task.state !== "archived" &&
      task.outcome !== "wont_do"
  );
  const focusHabitAttributionAvailable =
    snapshot.focusHabitAttributionAvailable === true;
  const habits = (snapshot.habits ?? []).filter(
    (habit: any) => !habit.archivedAt
  );
  const active = sessions.find(
    (session: any) =>
      session.id !== recentFinishedSession?.id &&
      (session.state === "active" || session.state === "paused")
  );
  const activeTask = active?.taskId
    ? (tasks.find((task: any) => task.id === active.taskId) ??
      (snapshot.tasks ?? []).find((task: any) => task.id === active.taskId))
    : null;
  const [taskId, setTaskId] = useState(() =>
    initialFocusTaskSelection(tasks, initialTaskId)
  );
  const [habitId, setHabitId] = useState("none");
  const [targetMinutes, setTargetMinutes] = useState("25");
  const [note, setNote] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
  const [deskView, setDeskView] = useState(false);
  const { presentation, choosePresentation } = useFocusPresentation();
  const [adjustment, setAdjustment] = useState(
    activeTask?.estimateMinutes ? String(activeTask.estimateMinutes) : "25"
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (taskId !== "none" && !tasks.some((task: any) => task.id === taskId))
      setTaskId("none");
  }, [tasks, taskId]);
  useEffect(() => {
    if (initialTaskId)
      setTaskId(initialFocusTaskSelection(tasks, initialTaskId));
  }, [initialTaskId]);
  useEffect(() => {
    if (
      habitId !== "none" &&
      !habits.some((habit: any) => habit.id === habitId)
    )
      setHabitId("none");
  }, [habits, habitId]);
  const refresh = () => {
    utils.planner.workspace.snapshot.invalidate();
    utils.planner.dashboard.invalidate();
  };
  const mutationFailed = (message: string) => {
    setError(message);
    refresh();
  };
  const start = trpc.planner.focus.start.useMutation({
    onSuccess: () => {
      setError(null);
      refresh();
      toast.success("Focus session started.");
    },
    onError: mutationError =>
      mutationFailed(mutationError.message || "Focus session could not start."),
  });
  const pause = trpc.planner.focus.pause.useMutation({
    onSuccess: refresh,
    onError: mutationError =>
      mutationFailed(mutationError.message || "Focus session could not pause."),
  });
  const resume = trpc.planner.focus.resume.useMutation({
    onSuccess: refresh,
    onError: mutationError =>
      mutationFailed(
        mutationError.message || "Focus session could not resume."
      ),
  });
  const finish = trpc.planner.focus.finish.useMutation({
    onSuccess: data => {
      setRecentFinishedSession(current => newestFinishedSession(current, data));
      setFollowUpError(null);
      setError(null);
      setNote("");
      setAdjustOpen(false);
      setStopConfirmOpen(false);
      refresh();
      toast.success(
        data.outcome === "done"
          ? "Task completed and focus time recorded."
          : "Focus session recorded."
      );
    },
    onError: mutationError =>
      mutationFailed(
        mutationError.message || "Focus outcome could not be saved."
      ),
  });
  const setFollowUp = trpc.planner.focus.setFollowUp.useMutation({
    onSuccess: data => {
      setRecentFinishedSession(current => newestFinishedSession(current, data));
      setFollowUpError(null);
      refresh();
      toast.success("Next step saved.");
    },
    onError: mutationError => {
      setFollowUpError(
        mutationError.message ||
          "Next step could not be saved. Refresh and retry."
      );
      refresh();
    },
  });
  const latestFinishedSession = sessions
    .filter(
      (session: any) =>
        session.state === "completed" || session.state === "abandoned"
    )
    .sort(
      (left: any, right: any) =>
        new Date(right.endedAt ?? right.startedAt).getTime() -
        new Date(left.endedAt ?? left.startedAt).getTime()
    )[0];
  const refreshedRecent = recentFinishedSession
    ? (sessions.find(
        (session: any) =>
          session.id === recentFinishedSession.id &&
          (session.state === "completed" || session.state === "abandoned") &&
          session.version >= recentFinishedSession.version
      ) ?? recentFinishedSession)
    : null;
  const handoffSession = newestFinishedSession(refreshedRecent, latestFinishedSession);
  const handoff = handoffSession
    ? {
        id: handoffSession.id,
        version: handoffSession.version,
        taskId: handoffSession.taskId ?? null,
        taskTitle:
          (snapshot.tasks ?? []).find(
            (task: any) => task.id === handoffSession.taskId
          )?.title ?? "this focus block",
        outcome: handoffSession.outcome ?? "stopped",
        note: handoffSession.note ?? "",
        nextStepAction: handoffSession.nextStepAction ?? null,
        nextStepTaskId: handoffSession.nextStepTaskId ?? null,
      }
    : null;
  // The mutation response is authoritative while snapshot invalidation is in flight.
  // Keep the handoff and Session Trail in agreement immediately after saving.
  const followUpSessions = recentFinishedSession
    ? [
        ...sessions.filter((session: any) => session.id !== recentFinishedSession.id),
        (() => {
          const refreshed = sessions.find(
            (session: any) => session.id === recentFinishedSession.id
          );
          return refreshed && refreshed.version >= recentFinishedSession.version
            ? refreshed
            : recentFinishedSession;
        })(),
      ]
    : sessions;
  const isMutating =
    start.isPending || pause.isPending || resume.isPending || finish.isPending;
  const activeSession = active as FocusWatchSession | undefined;
  const accuracy = useMemo(
    () => focusEstimateAccuracy(sessions, snapshot.tasks ?? []),
    [sessions, snapshot.tasks]
  );
  const recentMinutes = focusMinutes(
    sessions.filter(
      (session: any) =>
        session.state === "completed" || session.state === "abandoned"
    )
  );
  const blockOfflineAction = () => setError(FOCUS_OFFLINE_GUIDANCE);
  const saveFollowUp = (
    sessionId: string,
    expectedVersion: number,
    action: "task" | "plan" | "none",
    nextStepTaskId: string | null
  ) =>
    runFocusMutation(
      isOnline,
      () => {
        if (setFollowUp.isPending) return;
        setFollowUpError(null);
        setFollowUp.mutate({
          ...scope,
          id: sessionId,
          expectedVersion,
          nextStepAction: action,
          nextStepTaskId,
        });
      },
      () => setFollowUpError(FOCUS_OFFLINE_GUIDANCE)
    );
  const resumeSession = () =>
    runFocusMutation(
      isOnline,
      () => {
        if (!active || isMutating) return;
        resume.mutate({
          ...scope,
          id: active.id,
          expectedVersion: active.version,
        });
      },
      blockOfflineAction
    );
  const startSession = () =>
    runFocusMutation(
      isOnline,
      () => {
        if (isMutating) return;
        const target = Number(targetMinutes);
        if (!Number.isInteger(target) || target < 5 || target > 240) {
          setError("Choose a focus length from 5 to 240 minutes.");
          return;
        }
        setError(null);
        start.mutate({
          ...scope,
          taskId: taskId === "none" ? null : taskId,
          targetMinutes: target,
          ...(focusHabitAttributionAvailable
            ? { habitId: habitId === "none" ? null : habitId }
            : {}),
        });
      },
      blockOfflineAction
    );
  const finishSession = (
    outcome: "done" | "continue" | "adjust_estimate" | "stopped"
  ) =>
    runFocusMutation(
      isOnline,
      () => {
        if (!active || isMutating) return;
        if (
          outcome === "adjust_estimate" &&
          (!Number.isInteger(Number(adjustment)) || Number(adjustment) < 5)
        ) {
          setError("Enter a revised focus estimate of at least 5 minutes.");
          return;
        }
        setError(null);
        finish.mutate({
          ...scope,
          id: active.id,
          expectedVersion: active.version,
          outcome,
          note: note.trim() || null,
          adjustedEstimateMinutes:
            outcome === "adjust_estimate" ? Number(adjustment) : null,
          taskExpectedVersion:
            outcome === "done" || outcome === "adjust_estimate"
              ? activeTask?.version
              : undefined,
        });
      },
      blockOfflineAction
    );
  return (
    <section
      className="focus-workspace"
      aria-labelledby="focus-workspace-heading"
    >
      <header className="focus-workspace-header">
        <div>
          <h2 id="focus-workspace-heading">Protect one block of attention.</h2>
          <p>
            Focus time is factual: pausing stops the clock, and finishing asks
            what changed instead of guessing.
          </p>
        </div>
        <TimerReset size={30} aria-hidden="true" />
      </header>
      {!isOnline ? (
        <p className="focus-offline-guidance" role="status" aria-live="polite">
          {FOCUS_OFFLINE_GUIDANCE}
        </p>
      ) : null}
      {error ? (
        <div className="focus-inline-error" role="alert">
          <CircleAlert size={17} />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Dismiss focus message"
          >
            ×
          </button>
        </div>
      ) : null}
      <div className="focus-layout">
        {!active ? (
          <section className="focus-start-panel">
            <div className="focus-title-row">
              <div>
                <span>New session</span>
                <h3>Choose the work</h3>
              </div>
              <em>{recentMinutes}m recorded</em>
            </div>
            <div className="field">
              <Label htmlFor="focus-task">Task link</Label>
              <select
                id="focus-task"
                value={taskId}
                onChange={event => setTaskId(event.target.value)}
                disabled={isMutating}
              >
                <option value="none">Unlinked focus</option>
                {(initialTaskId &&
                tasks.find((task: any) => task.id === initialTaskId) &&
                !tasks
                  .slice(0, 50)
                  .some((task: any) => task.id === initialTaskId)
                  ? [
                      tasks.find((task: any) => task.id === initialTaskId),
                      ...tasks.slice(0, 49),
                    ]
                  : tasks.slice(0, 50)
                ).map((task: any) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                    {task.estimateMinutes
                      ? ` · ${task.estimateMinutes} min estimated`
                      : ""}
                  </option>
                ))}
              </select>
              <p className="field-guidance">
                {initialTaskId &&
                !tasks.some((task: any) => task.id === initialTaskId)
                  ? "That task is no longer available for Focus. Choose another task or start unlinked."
                  : "Task links make actual-versus-estimated focus visible later."}
              </p>
            </div>
            {focusHabitAttributionAvailable ? (
              <div className="field">
                <Label htmlFor="focus-habit">Habit time (optional)</Label>
                <select
                  id="focus-habit"
                  value={habitId}
                  onChange={event => setHabitId(event.target.value)}
                  disabled={isMutating}
                >
                  <option value="none">Do not attribute to a habit</option>
                  {habits.map((habit: any) => (
                    <option key={habit.id} value={habit.id}>
                      {habit.name}
                    </option>
                  ))}
                </select>
                <p className="field-guidance">
                  Only saved active time will count toward the selected habit.
                  Focus time does not check the habit in.
                </p>
              </div>
            ) : (
              <p className="field-guidance" role="status">
                Habit time linking is unavailable until the Focus storage update
                is installed. You can still start Focus normally.
              </p>
            )}
            <div
              className="focus-lengths"
              role="group"
              aria-label="Focus session duration"
            >
              {[25, 50, 90].map(minutes => (
                <button
                  type="button"
                  className={cn(
                    targetMinutes === String(minutes) && "is-selected"
                  )}
                  onClick={() => setTargetMinutes(String(minutes))}
                  disabled={isMutating}
                  key={minutes}
                >
                  {minutes} min
                </button>
              ))}
              <Input
                aria-label="Custom focus duration in minutes"
                value={targetMinutes}
                onChange={event => setTargetMinutes(event.target.value)}
                disabled={isMutating}
                type="number"
                min="5"
                max="240"
              />
            </div>
            <Button
              type="button"
              className="primary-action min-h-11"
              onClick={startSession}
              disabled={!isOnline || isMutating}
            >
              {start.isPending ? (
                "Starting…"
              ) : (
                <>
                  <Play size={16} fill="currentColor" /> Start focus
                </>
              )}
            </Button>
          </section>
        ) : (
          <section
            className={cn(
              "focus-active-panel",
              "focus-watch-panel",
              deskView && "is-desk"
            )}
          >
            <div className="focus-watch-stage">
              <div className="focus-watch-toolbar">
                <p>Focus stays with you as you move through the planner.</p>
                <div
                  className="focus-watch-view-options"
                  role="group"
                  aria-label="Focus watch display"
                >
                  <button
                    type="button"
                    aria-pressed={presentation === "dial"}
                    onClick={() => choosePresentation("dial")}
                  >
                    Dial
                  </button>
                  <button
                    type="button"
                    aria-pressed={presentation === "digital"}
                    onClick={() => choosePresentation("digital")}
                  >
                    Digital
                  </button>
                  <button
                    type="button"
                    aria-pressed={deskView}
                    onClick={() => setDeskView(value => !value)}
                  >
                    Desk View
                  </button>
                </div>
              </div>
              {activeSession ? (
                <FocusTimeDial
                  session={activeSession}
                  title={activeTask?.title ?? "Unlinked focus session"}
                  presentation={presentation}
                  size={deskView ? "desk" : "full"}
                  confirmedOnline={isOnline}
                />
              ) : null}
            </div>
            <div className="focus-active-task">
              {initialTaskId && active.taskId !== initialTaskId ? (
                <p className="focus-active-mismatch" role="status">
                  Another session is already open. Finish or stop it before
                  focusing on the selected task; nothing has been switched
                  automatically.
                </p>
              ) : null}
              <p>{activeTask ? "Working on" : "Unlinked session"}</p>
              <h3>
                {activeTask?.title ?? "A focused block without a task link"}
              </h3>
              <span>
                {activeTask?.estimateMinutes
                  ? `${activeTask.estimateMinutes} minute estimate`
                  : "Record the outcome before you leave the session."}
              </span>
            </div>
            <div className="focus-timer-actions">
              {active.state === "active" ? (
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={() =>
                    runFocusMutation(
                      isOnline,
                      () => {
                        if (isMutating) return;
                        pause.mutate({
                          ...scope,
                          id: active.id,
                          expectedVersion: active.version,
                        });
                      },
                      blockOfflineAction
                    )
                  }
                  disabled={!isOnline || isMutating}
                >
                  <Pause size={16} fill="currentColor" /> Pause
                </Button>
              ) : (
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={resumeSession}
                  disabled={!isOnline || isMutating}
                >
                  <Play size={16} fill="currentColor" /> Resume
                </Button>
              )}
              <Button
                type="button"
                className="min-h-11"
                variant="ghost"
                onClick={() => setStopConfirmOpen(true)}
                disabled={!isOnline || isMutating}
              >
                <Square size={15} fill="currentColor" /> Stop
              </Button>
            </div>
            {stopConfirmOpen ? (
              <div
                className="focus-stop-confirm"
                role="group"
                aria-label="Confirm stop focus"
              >
                <p>
                  Stop this session? The active time will be recorded, and a
                  linked task will stay open.
                </p>
                <Button
                  type="button"
                  className="min-h-11"
                  variant="destructive"
                  onClick={() => finishSession("stopped")}
                  disabled={!isOnline || isMutating}
                >
                  Stop and record
                </Button>
                <Button
                  type="button"
                  className="min-h-11"
                  variant="ghost"
                  onClick={() => setStopConfirmOpen(false)}
                  disabled={isMutating}
                >
                  Keep focusing
                </Button>
              </div>
            ) : null}
            <div className="focus-outcome-panel">
              <p className="field-guidance">
                Finish with the next step: choose what happened to the work,
                then leave a note if useful.
              </p>
              <Label htmlFor="focus-note">Outcome note (optional)</Label>
              <Input
                id="focus-note"
                value={note}
                onChange={event => setNote(event.target.value)}
                disabled={isMutating}
                maxLength={2000}
                placeholder="What changed, completed, or needs follow-up?"
              />
              <div className="focus-outcome-actions">
                <Button
                  type="button"
                  className="min-h-11"
                  onClick={() => finishSession("done")}
                  disabled={!isOnline || isMutating || !activeTask}
                >
                  <Check size={16} /> Mark task done
                </Button>
                <Button
                  type="button"
                  className="min-h-11"
                  variant="ghost"
                  onClick={() => finishSession("continue")}
                  disabled={!isOnline || isMutating}
                >
                  Keep task open
                </Button>
                <button
                  className="min-h-11 rounded-md px-3"
                  type="button"
                  onClick={() => setAdjustOpen(open => !open)}
                  disabled={!isOnline || isMutating || !activeTask}
                >
                  Adjust estimate
                </button>
              </div>
              {adjustOpen ? (
                <div className="focus-adjust">
                  <Label htmlFor="focus-adjust">New Focus time needed</Label>
                  <Input
                    id="focus-adjust"
                    value={adjustment}
                    onChange={event => setAdjustment(event.target.value)}
                    disabled={isMutating}
                    type="number"
                    min="5"
                    max="1440"
                  />
                  <Button
                    type="button"
                    className="min-h-11"
                    onClick={() => finishSession("adjust_estimate")}
                    disabled={!isOnline || isMutating}
                  >
                    Save revised estimate
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        )}
        <aside className="focus-evidence-panel">
          <div>
            <span>Focus evidence</span>
            <h3>Measured, not assumed</h3>
          </div>
          <dl>
            <div>
              <dt>Recorded</dt>
              <dd>{recentMinutes}m</dd>
            </div>
            <div>
              <dt>Measured tasks</dt>
              <dd>{accuracy.measuredTasks}</dd>
            </div>
            <div>
              <dt>Estimate signal</dt>
              <dd>
                {accuracy.direction === "not_enough_data"
                  ? "Need data"
                  : accuracy.direction === "on_target"
                    ? "On target"
                    : accuracy.direction === "underestimated"
                      ? "Under by avg."
                      : "Over by avg."}
              </dd>
            </div>
          </dl>
          <p>
            {accuracy.averageVarianceMinutes === null
              ? "Complete a task-linked focus session with an estimate to see an accuracy signal."
              : `Across ${accuracy.measuredTasks} measured task${accuracy.measuredTasks === 1 ? "" : "s"}, actual focus was ${Math.abs(accuracy.averageVarianceMinutes)} minutes ${accuracy.averageVarianceMinutes > 0 ? "over" : accuracy.averageVarianceMinutes < 0 ? "under" : "on"} the estimate on average.`}
          </p>
          <div className="focus-principle">
            <Coffee size={16} />
            <span>
              Pause when you step away. The timer records active work, not your
              time at the desk.
            </span>
          </div>
        </aside>
        <FocusFollowUpPanel
          snapshot={{ ...snapshot, focusSessions: followUpSessions }}
          today={today}
          activeSession={
            activeSession?.id === recentFinishedSession?.id
              ? undefined
              : activeSession
          }
          handoff={handoff}
          isOnline={isOnline}
          isSavingFollowUp={setFollowUp.isPending}
          followUpError={followUpError}
          onClearFollowUpError={() => setFollowUpError(null)}
          onSaveFollowUp={saveFollowUp}
          onOpenTask={onOpenTask}
          onOpenHabit={onOpenHabit}
          onOpenCalendar={onOpenCalendar}
          onOpenPlan={onOpenPlan}
          onResumeFocus={resumeSession}
          onCheckInHabit={onHabitCheckIn}
          onClearHabitCheckIn={onClearHabitCheckIn}
        />
      </div>
    </section>
  );
}
