import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type { WorkspaceScope } from "@/lib/workspace";
import { focusEstimateAccuracy, focusMinutes } from "@shared/focusMetrics";
import { Check, CircleAlert, Coffee, Pause, Play, RotateCcw, Square, TimerReset } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type FocusWorkspaceProps = { scope: WorkspaceScope; snapshot: any; today: string; initialTaskId?: string | null; isOnline?: boolean };

export const FOCUS_OFFLINE_GUIDANCE = "Focus sessions need a connection to save changes. Reconnect to start, pause, resume, or finish this session.";

export function runFocusMutation(isOnline: boolean, mutate: () => void, onBlocked?: () => void) {
  if (!isOnline) {
    onBlocked?.();
    return false;
  }
  mutate();
  return true;
}

function useBrowserOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
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

export function formatElapsedDuration(seconds: number) {
  const elapsedSeconds = Math.max(0, Math.floor(seconds));
  if (elapsedSeconds < 60 * 60) {
    const minutes = Math.floor(elapsedSeconds / 60);
    const remaining = elapsedSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  const totalMinutes = Math.floor(elapsedSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${totalHours}h ${minutes}m`;
}

function formatOverrunDuration(seconds: number) {
  const totalMinutes = Math.max(1, Math.ceil(Math.max(0, seconds) / 60));
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${totalHours}h ${minutes}m`;
}

export function formatFocusTargetGuidance(elapsedSeconds: number, targetSeconds: number) {
  if (targetSeconds <= 0) return "";
  if (elapsedSeconds < targetSeconds) {
    const remainingMinutes = Math.ceil((targetSeconds - elapsedSeconds) / 60);
    return `${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"} to target`;
  }
  if (elapsedSeconds === targetSeconds) return "Target reached";
  return `Target reached · ${formatOverrunDuration(elapsedSeconds - targetSeconds)} over`;
}

export function FocusWorkspace({ scope, snapshot, today, initialTaskId, isOnline: isOnlineOverride }: FocusWorkspaceProps) {
  const browserOnline = useBrowserOnlineStatus();
  const isOnline = isOnlineOverride ?? browserOnline;
  const utils = trpc.useUtils();
  const sessions = snapshot.focusSessions ?? [];
  const tasks = (snapshot.tasks ?? []).filter((task: any) => task.state !== "completed" && task.state !== "archived" && task.outcome !== "wont_do");
  const active = sessions.find((session: any) => session.state === "active" || session.state === "paused");
  const activeTask = active?.taskId ? tasks.find((task: any) => task.id === active.taskId) ?? (snapshot.tasks ?? []).find((task: any) => task.id === active.taskId) : null;
  const [taskId, setTaskId] = useState(initialTaskId && tasks.some((task: any) => task.id === initialTaskId) ? initialTaskId : tasks[0]?.id ?? "none");
  const [targetMinutes, setTargetMinutes] = useState("25");
  const [note, setNote] = useState("");
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustment, setAdjustment] = useState(activeTask?.estimateMinutes ? String(activeTask.estimateMinutes) : "25");
  const [error, setError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  useEffect(() => { if (active?.state !== "active") return; const id = window.setInterval(() => setTick(value => value + 1), 1_000); return () => window.clearInterval(id); }, [active?.id, active?.state]);
  useEffect(() => { if (!tasks.some((task: any) => task.id === taskId)) setTaskId(tasks[0]?.id ?? "none"); }, [tasks, taskId]);
  useEffect(() => { if (initialTaskId && tasks.some((task: any) => task.id === initialTaskId)) setTaskId(initialTaskId); }, [initialTaskId]);
  const refresh = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const start = trpc.planner.focus.start.useMutation({ onSuccess: () => { setError(null); refresh(); toast.success("Focus session started."); }, onError: mutationError => setError(mutationError.message || "Focus session could not start.") });
  const pause = trpc.planner.focus.pause.useMutation({ onSuccess: refresh, onError: mutationError => setError(mutationError.message || "Focus session could not pause.") });
  const resume = trpc.planner.focus.resume.useMutation({ onSuccess: refresh, onError: mutationError => setError(mutationError.message || "Focus session could not resume.") });
  const finish = trpc.planner.focus.finish.useMutation({ onSuccess: (_data, values) => { setError(null); setNote(""); setAdjustOpen(false); refresh(); toast.success(values.outcome === "done" ? "Task completed and focus time recorded." : "Focus session recorded."); }, onError: mutationError => setError(mutationError.message || "Focus outcome could not be saved.") });
  const elapsedSeconds = active ? active.activeSeconds + (active.state === "active" ? Math.max(0, Math.floor((Date.now() - new Date(active.lastResumedAt).getTime()) / 1000)) : 0) : 0;
  const targetSeconds = active ? active.targetMinutes * 60 : 0;
  const accuracy = useMemo(() => focusEstimateAccuracy(sessions, snapshot.tasks ?? []), [sessions, snapshot.tasks]);
  const recentMinutes = focusMinutes(sessions.filter((session: any) => session.state === "completed" || session.state === "abandoned"));
  const blockOfflineAction = () => setError(FOCUS_OFFLINE_GUIDANCE);
  const startSession = () => runFocusMutation(isOnline, () => { const target = Number(targetMinutes); if (!Number.isInteger(target) || target < 5 || target > 240) { setError("Choose a focus length from 5 to 240 minutes."); return; } setError(null); start.mutate({ ...scope, taskId: taskId === "none" ? null : taskId, targetMinutes: target }); }, blockOfflineAction);
  const finishSession = (outcome: "done" | "continue" | "adjust_estimate" | "stopped") => runFocusMutation(isOnline, () => { if (!active) return; if (outcome === "adjust_estimate" && (!Number.isInteger(Number(adjustment)) || Number(adjustment) < 5)) { setError("Enter a revised focus estimate of at least 5 minutes."); return; } setError(null); finish.mutate({ ...scope, id: active.id, expectedVersion: active.version, outcome, note: note.trim() || null, adjustedEstimateMinutes: outcome === "adjust_estimate" ? Number(adjustment) : null, taskExpectedVersion: outcome === "done" || outcome === "adjust_estimate" ? activeTask?.version : undefined }); }, blockOfflineAction);
  return <section className="focus-workspace" aria-labelledby="focus-workspace-heading"><header className="focus-workspace-header"><div><h2 id="focus-workspace-heading">Protect one block of attention.</h2><p>Focus time is factual: pausing stops the clock, and finishing asks what changed instead of guessing.</p></div><TimerReset size={30} aria-hidden="true" /></header>{!isOnline ? <p className="focus-offline-guidance" role="status" aria-live="polite">{FOCUS_OFFLINE_GUIDANCE}</p> : null}{error ? <div className="focus-inline-error" role="alert"><CircleAlert size={17} /><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss focus message">×</button></div> : null}<div className="focus-layout">{!active ? <section className="focus-start-panel"><div className="focus-title-row"><div><span>New session</span><h3>Choose the work</h3></div><em>{recentMinutes}m recorded</em></div><div className="field"><Label htmlFor="focus-task">Task link</Label><select id="focus-task" value={taskId} onChange={event => setTaskId(event.target.value)}><option value="none">Unlinked focus</option>{(initialTaskId && tasks.find((task: any) => task.id === initialTaskId) && !tasks.slice(0, 50).some((task: any) => task.id === initialTaskId) ? [tasks.find((task: any) => task.id === initialTaskId), ...tasks.slice(0, 49)] : tasks.slice(0, 50)).map((task: any) => <option key={task.id} value={task.id}>{task.title}{task.estimateMinutes ? ` · ${task.estimateMinutes} min estimated` : ""}</option>)}</select><p className="field-guidance">Task links make actual-versus-estimated focus visible later.</p></div><div className="focus-lengths" role="group" aria-label="Focus session duration">{[25, 50, 90].map(minutes => <button type="button" className={cn(targetMinutes === String(minutes) && "is-selected")} onClick={() => setTargetMinutes(String(minutes))} key={minutes}>{minutes} min</button>)}<Input aria-label="Custom focus duration in minutes" value={targetMinutes} onChange={event => setTargetMinutes(event.target.value)} type="number" min="5" max="240" /></div><Button type="button" className="primary-action min-h-11" onClick={startSession} disabled={!isOnline || start.isPending}>{start.isPending ? "Starting…" : <><Play size={16} fill="currentColor" /> Start focus</>}</Button></section> : <section className="focus-active-panel"><div className="focus-active-status"><span>{active.state === "paused" ? "Paused" : "In focus"}</span><strong>{formatElapsedDuration(elapsedSeconds)}</strong><small>{formatFocusTargetGuidance(elapsedSeconds, targetSeconds)}</small></div><div className="focus-active-task"><p>{activeTask ? "Working on" : "Unlinked session"}</p><h3>{activeTask?.title ?? "A focused block without a task link"}</h3><span>{activeTask?.estimateMinutes ? `${activeTask.estimateMinutes} minute estimate` : "Record the outcome before you leave the session."}</span></div><div className="focus-timer-actions">{active.state === "active" ? <Button type="button" className="min-h-11" onClick={() => runFocusMutation(isOnline, () => pause.mutate({ ...scope, id: active.id, expectedVersion: active.version }), blockOfflineAction)} disabled={!isOnline || pause.isPending}><Pause size={16} fill="currentColor" /> Pause</Button> : <Button type="button" className="min-h-11" onClick={() => runFocusMutation(isOnline, () => resume.mutate({ ...scope, id: active.id, expectedVersion: active.version }), blockOfflineAction)} disabled={!isOnline || resume.isPending}><Play size={16} fill="currentColor" /> Resume</Button>}<Button type="button" className="min-h-11" variant="ghost" onClick={() => finishSession("stopped")} disabled={!isOnline || finish.isPending}><Square size={15} fill="currentColor" /> Stop</Button></div><div className="focus-outcome-panel"><Label htmlFor="focus-note">Outcome note (optional)</Label><Input id="focus-note" value={note} onChange={event => setNote(event.target.value)} maxLength={2000} placeholder="What changed, completed, or needs follow-up?" /><div className="focus-outcome-actions"><Button type="button" className="min-h-11" onClick={() => finishSession("done")} disabled={!isOnline || finish.isPending || !activeTask}><Check size={16} /> Mark task done</Button><Button type="button" className="min-h-11" variant="ghost" onClick={() => finishSession("continue")} disabled={!isOnline || finish.isPending}>Keep task open</Button><button className="min-h-11 rounded-md px-3" type="button" onClick={() => setAdjustOpen(open => !open)} disabled={!isOnline || finish.isPending || !activeTask}>Adjust estimate</button></div>{adjustOpen ? <div className="focus-adjust"><Label htmlFor="focus-adjust">New Focus time needed</Label><Input id="focus-adjust" value={adjustment} onChange={event => setAdjustment(event.target.value)} type="number" min="5" max="1440" /><Button type="button" className="min-h-11" onClick={() => finishSession("adjust_estimate")} disabled={!isOnline || finish.isPending}>Save revised estimate</Button></div> : null}</div></section>}<aside className="focus-evidence-panel"><div><span>Focus evidence</span><h3>Measured, not assumed</h3></div><dl><div><dt>Recorded</dt><dd>{recentMinutes}m</dd></div><div><dt>Measured tasks</dt><dd>{accuracy.measuredTasks}</dd></div><div><dt>Estimate signal</dt><dd>{accuracy.direction === "not_enough_data" ? "Need data" : accuracy.direction === "on_target" ? "On target" : accuracy.direction === "underestimated" ? "Under by avg." : "Over by avg."}</dd></div></dl><p>{accuracy.averageVarianceMinutes === null ? "Complete a task-linked focus session with an estimate to see an accuracy signal." : `Across ${accuracy.measuredTasks} measured task${accuracy.measuredTasks === 1 ? "" : "s"}, actual focus was ${Math.abs(accuracy.averageVarianceMinutes)} minutes ${accuracy.averageVarianceMinutes > 0 ? "over" : accuracy.averageVarianceMinutes < 0 ? "under" : "on"} the estimate on average.`}</p><div className="focus-principle"><Coffee size={16} /><span>Pause when you step away. The timer records active work, not your time at the desk.</span></div></aside></div></section>;
}
