import { useEffect, useId, useReducer, useState } from "react";
import { CalendarClock, CheckCircle2, History, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildFocusSessionTrail, buildHabitCompanion, buildMeetingHorizon, buildRoutineConductor, type FocusFollowUpSession } from "@shared/focusFollowUp";

type NextStepAction = "task" | "plan" | "none";
type DurableFollowUpSession = FocusFollowUpSession & { habitId?: string | null; nextStepAction?: NextStepAction | null; nextStepTaskId?: string | null };
type Handoff = {
  id?: string;
  version?: number;
  taskId?: string | null;
  taskTitle: string;
  outcome: string | null;
  note: string | null;
  nextStepAction?: NextStepAction | null;
  nextStepTaskId?: string | null;
};
type FollowUpDraft = { sessionId: string | null; baseVersion: number | null; action: NextStepAction; taskId: string; edited: boolean };

export function focusFollowUpDraft(handoff?: Handoff | null): FollowUpDraft {
  return { sessionId: handoff?.id ?? null, baseVersion: handoff?.version ?? null, action: handoff?.nextStepAction ?? "none", taskId: handoff?.nextStepTaskId ?? "", edited: false };
}

export function focusFollowUpDraftReducer(
  draft: FollowUpDraft,
  update: { type: "session"; handoff?: Handoff | null } | { type: "adopt"; handoff?: Handoff | null } | { type: "action"; action: NextStepAction } | { type: "task"; taskId: string },
): FollowUpDraft {
  if (update.type === "session" || update.type === "adopt") {
    if (update.type === "adopt" || draft.sessionId !== (update.handoff?.id ?? null) || !draft.edited) return focusFollowUpDraft(update.handoff);
    const saved = focusFollowUpDraft(update.handoff);
    return draft.action === saved.action && draft.taskId === saved.taskId ? saved : draft;
  }
  if (update.type === "action") return { ...draft, action: update.action, edited: true };
  return { ...draft, taskId: update.taskId, edited: true };
}

export function savedHabitFocusForDate(
  rows: Array<{ habitId: string; localDate: string; timezone: string; activeSeconds: number }>,
  localDate: string,
) {
  const groups = new Map<string, { habitId: string; activeSeconds: number; timezones: string[] }>();
  for (const row of rows) {
    if (row.localDate !== localDate || !Number.isFinite(row.activeSeconds) || row.activeSeconds <= 0) continue;
    const group = groups.get(row.habitId) ?? { habitId: row.habitId, activeSeconds: 0, timezones: [] };
    group.activeSeconds += Math.floor(row.activeSeconds);
    if (!group.timezones.includes(row.timezone)) group.timezones.push(row.timezone);
    groups.set(row.habitId, group);
  }
  return Array.from(groups.values());
}

function savedDuration(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}h ` : ""}${minutes % 60}m ${wholeSeconds % 60}s`;
}

export function FocusFollowUpPanel({
  snapshot,
  today,
  activeSession,
  handoff,
  isOnline,
  onOpenTask,
  onOpenHabit,
  onOpenCalendar,
  onOpenPlan,
  onResumeFocus,
  onCheckInHabit,
  onClearHabitCheckIn,
  onSaveFollowUp,
  isSavingFollowUp = false,
  followUpError = null,
  onClearFollowUpError,
}: {
  snapshot: any;
  today: string;
  activeSession?: FocusFollowUpSession | null;
  handoff?: Handoff | null;
  isOnline: boolean;
  onOpenTask: (id: string) => void;
  onOpenHabit: (id: string) => void;
  onOpenCalendar: () => void;
  onOpenPlan: () => void;
  onResumeFocus: () => void;
  onCheckInHabit: (habitId: string, localDate: string, state: "completed" | "skipped") => void;
  onClearHabitCheckIn: (habitId: string, localDate: string) => void;
  onSaveFollowUp?: (sessionId: string, expectedVersion: number, action: NextStepAction, taskId: string | null) => void;
  isSavingFollowUp?: boolean;
  followUpError?: string | null;
  onClearFollowUpError?: () => void;
}) {
  const [showTrail, setShowTrail] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const trailId = useId();
  const [draft, updateDraft] = useReducer(focusFollowUpDraftReducer, handoff, focusFollowUpDraft);
  useEffect(() => {
    updateDraft({ type: "session", handoff });
  }, [handoff?.id, handoff?.version, handoff?.nextStepAction, handoff?.nextStepTaskId]);
  const durableAvailable = snapshot.focusHabitAttributionAvailable === true;
  const actionableTasks = (snapshot.tasks ?? []).filter((task: any) => task.state !== "completed" && task.state !== "archived" && task.outcome !== "wont_do");
  const draftTaskAvailable = actionableTasks.some((task: any) => task.id === draft.taskId);
  const savedTask = (snapshot.tasks ?? []).find((task: any) => task.id === handoff?.nextStepTaskId);
  const draftMatchesSaved = handoff?.nextStepAction === draft.action && (draft.action !== "task" || handoff.nextStepTaskId === draft.taskId);
  const remoteChangedDuringEdit = draft.edited && handoff?.version !== draft.baseVersion && !draftMatchesSaved;
  const canSaveFollowUp = durableAvailable && isOnline && !isSavingFollowUp && !remoteChangedDuringEdit && !!onSaveFollowUp && !!handoff?.id && typeof handoff.version === "number" && draft.sessionId === handoff.id && (draft.action !== "task" || draftTaskAvailable);
  const attributedToday = durableAvailable ? savedHabitFocusForDate(snapshot.focusHabitAttribution ?? [], today) : [];
  const saveFollowUp = () => {
    if (!canSaveFollowUp || !handoff?.id || handoff.version === undefined) return;
    onSaveFollowUp?.(handoff.id, handoff.version, draft.action, draft.action === "task" ? draft.taskId : null);
  };
  const meetings = buildMeetingHorizon(snapshot.externalEvents ?? []);
  const habits = buildHabitCompanion(snapshot.habits ?? [], snapshot.habitCheckIns ?? [], today);
  const trail = buildFocusSessionTrail<DurableFollowUpSession>(snapshot.focusSessions ?? [], snapshot.tasks ?? []);
  const conductor = buildRoutineConductor({ activeSession, tasks: snapshot.tasks ?? [], meetings, habits });
  const checkInByHabit = new Map((snapshot.habitCheckIns ?? []).filter((item: any) => item.localDate === today).map((item: any) => [item.habitId, item]));
  const runConductorAction = () => {
    if (conductor.key === "focus") {
      if (activeSession?.state === "paused") {
        if (isOnline) onResumeFocus();
      } else {
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        document.querySelector(".focus-watch-stage")?.scrollIntoView({ behavior: reduceMotion ? "instant" : "smooth", block: "center" });
      }
    } else if (conductor.key === "meeting") {
      onOpenCalendar();
    } else if (conductor.key === "habit" && conductor.targetId) {
      onOpenHabit(conductor.targetId);
    } else if (conductor.key === "task" && conductor.targetId) {
      onOpenTask(conductor.targetId);
    } else {
      onOpenPlan();
    }
  };
  const conductorActionLabel = conductor.key === "focus" ? (activeSession?.state === "paused" ? "Resume focus" : "Return to timer") : conductor.key === "meeting" ? "Open calendar" : conductor.key === "habit" ? "Open next habit" : conductor.key === "task" ? "Open task" : "Open daily plan";

  return (
    <section className="focus-follow-up" aria-label="Focus follow-up">
      <div className="focus-follow-up-header">
        <div>
          <span className="focus-follow-up-eyebrow"><Sparkles size={14} /> Routine conductor</span>
          <h3>{conductor.title}</h3>
          <p>{conductor.detail}</p>
        </div>
        <Button type="button" disabled={conductor.key === "focus" && activeSession?.state === "paused" && !isOnline} onClick={runConductorAction}>
          {conductor.key === "focus" && activeSession?.state === "paused" && !isOnline ? "Reconnect to resume" : conductorActionLabel}
        </Button>
      </div>

      {handoff ? (
        <article className="focus-follow-up-card is-next-step" aria-label="Next step after Focus">
          <ListChecks size={18} />
          <div className="focus-follow-up-card-content">
            <strong>Finish → Next step</strong>
            <p>{handoff.outcome === "done" ? `You completed ${handoff.taskTitle}. Choose what to do next.` : `Continue with ${handoff.taskTitle} when you return.`}</p>
            {handoff.note ? <small>Your session note: {handoff.note}</small> : null}
            {durableAvailable ? (
              <div className="focus-follow-up-editor" aria-label="Save next action" aria-busy={isSavingFollowUp}>
                {remoteChangedDuringEdit ? <p role="alert">The saved next action changed elsewhere while you were editing. Your draft is retained. Review the latest saved action before changing it again.</p> : null}
                {remoteChangedDuringEdit ? <Button type="button" variant="outline" onClick={() => updateDraft({ type: "adopt", handoff })}>Use latest saved action</Button> : null}
                <p role="status" aria-live="polite">
                  {handoff.nextStepAction === null || handoff.nextStepAction === undefined
                    ? "Next action not saved."
                    : `Saved next action: ${handoff.nextStepAction === "task" ? savedTask?.title ?? "Task unavailable" : handoff.nextStepAction === "plan" ? "Daily plan" : "No next action"}.`}
                  {!draftMatchesSaved && handoff.nextStepAction ? " Your changes are not saved." : ""}
                </p>
                <label htmlFor={`${trailId}-next-action`}>Next action</label>
                <select id={`${trailId}-next-action`} value={draft.action} disabled={!isOnline || isSavingFollowUp} onChange={event => {
                  updateDraft({ type: "action", action: event.target.value as NextStepAction });
                  onClearFollowUpError?.();
                }}>
                  <option value="none">No next action</option>
                  <option value="task">Open a task</option>
                  <option value="plan">Open daily plan</option>
                </select>
                {draft.action === "task" ? (
                  <>
                    <label htmlFor={`${trailId}-next-task`}>Next task</label>
                    <select id={`${trailId}-next-task`} value={draft.taskId} disabled={!isOnline || isSavingFollowUp} onChange={event => {
                      updateDraft({ type: "task", taskId: event.target.value });
                      onClearFollowUpError?.();
                    }}>
                      <option value="">Choose a task</option>
                      {draft.taskId && !draftTaskAvailable ? <option value={draft.taskId}>Selected task unavailable</option> : null}
                      {actionableTasks.map((task: any) => <option key={task.id} value={task.id}>{task.title}</option>)}
                    </select>
                    {!draftTaskAvailable ? <p>Choose an available task before saving.</p> : null}
                  </>
                ) : null}
                {!isOnline ? <p role="status">Reconnect to save the next action. Your draft stays here.</p> : null}
                {followUpError ? <div className="focus-follow-up-error" role="alert"><p>{followUpError}</p><p>Your draft is retained. Review the saved action above before retrying.</p>{onClearFollowUpError ? <Button type="button" variant="ghost" onClick={onClearFollowUpError}>Dismiss message</Button> : null}</div> : null}
                <div className="focus-follow-up-actions">
                  <Button type="button" disabled={!canSaveFollowUp || draftMatchesSaved} onClick={saveFollowUp}>{isSavingFollowUp ? "Saving next action…" : followUpError ? "Retry save" : "Save next action"}</Button>
                  {handoff.nextStepAction === "task" && savedTask ? <Button type="button" variant="outline" onClick={() => onOpenTask(savedTask.id)}>Open saved task</Button> : null}
                  {handoff.nextStepAction === "task" && !savedTask ? <p>The saved task is unavailable; choose another next action.</p> : null}
                  {handoff.nextStepAction === "plan" ? <Button type="button" variant="outline" onClick={onOpenPlan}>Open saved plan</Button> : null}
                </div>
              </div>
            ) : (
              <>
                <small>Saved next actions are unavailable. You can still open your work.</small>
                <div className="focus-follow-up-actions">
                  {handoff.taskId && (snapshot.tasks ?? []).some((task: any) => task.id === handoff.taskId) ? <Button type="button" variant="outline" onClick={() => onOpenTask(handoff.taskId!)}>Open task</Button> : null}
                  <Button type="button" variant="ghost" onClick={onOpenPlan}>Plan next step</Button>
                </div>
              </>
            )}
          </div>
        </article>
      ) : null}

      <div className="focus-follow-up-grid">
        <article className="focus-follow-up-card" aria-label="Meeting horizon">
          <CalendarClock size={18} />
          <div className="focus-follow-up-card-content">
            <strong>Meeting horizon</strong>
            {meetings.length ? meetings.map(meeting => (
              <div className="focus-follow-up-item" key={meeting.id}>
                <p><b>{meeting.phase === "in_progress" ? "Now" : "Next"}</b> {meeting.title}</p>
                <Button type="button" variant="outline" onClick={onOpenCalendar}>Open calendar</Button>
              </div>
            )) : <p>No meetings in the next three hours.</p>}
            <small>From saved calendar events. Incoming Apple Calendar appointments are not connected.</small>
          </div>
        </article>

        <article className="focus-follow-up-card" aria-label="Habit duration companion">
          <CheckCircle2 size={18} />
          <div className="focus-follow-up-card-content">
            <strong>Habit companion</strong>
            <p>{habits.due ? `${habits.completed}/${habits.due} due habits recorded today.` : "No scheduled habits need attention today."}</p>
            {habits.items.map(habit => {
              const checkIn = checkInByHabit.get(habit.id) as { id: string; version: number; state: string } | undefined;
              return (
                <div className="focus-follow-up-item" key={habit.id}>
                  <p><b>{habit.name}</b> · {habit.state === "unrecorded" ? "Not checked in" : habit.state}</p>
                  <div className="focus-follow-up-actions">
                    {habit.state === "completed" || habit.state === "skipped" ? (
                      <Button type="button" variant="outline" disabled={!isOnline || !checkIn} onClick={() => onClearHabitCheckIn(habit.id, today)}>{isOnline ? "Undo" : "Reconnect to edit"}</Button>
                    ) : (
                      <>
                        <Button type="button" disabled={!isOnline} onClick={() => onCheckInHabit(habit.id, today, "completed")}>{isOnline ? "Complete" : "Reconnect to check in"}</Button>
                        <Button type="button" variant="outline" disabled={!isOnline} onClick={() => onCheckInHabit(habit.id, today, "skipped")}>Skip</Button>
                      </>
                    )}
                    <Button type="button" variant="ghost" onClick={() => onOpenHabit(habit.id)}>Details</Button>
                  </div>
                </div>
              );
            })}
            {durableAvailable ? (
              <div className="focus-habit-attribution" aria-label="Saved habit Focus time">
                <strong>Saved Focus time today</strong>
                {attributedToday.length ? attributedToday.map(row => {
                  const habit = (snapshot.habits ?? []).find((item: any) => item.id === row.habitId);
                  return <div className="focus-follow-up-item" key={row.habitId}><p><b>{habit?.name ?? "Habit unavailable"}</b> · {savedDuration(row.activeSeconds)}</p><small>Source: saved Focus session segments · {today} · {row.timezones.join(", ")}</small></div>;
                }) : <p>No saved habit-attributed Focus time today.</p>}
                <small>Only explicitly linked, saved session segments count. Running seconds are excluded. Focus time does not complete a habit check-in.</small>
              </div>
            ) : <small>Check-ins are recorded; time is not attributed to habits yet.</small>}
          </div>
        </article>

        <article className="focus-follow-up-card" aria-label="Session trail">
          <History size={18} />
          <div className="focus-follow-up-card-content">
            <strong>Session trail</strong>
            {trail.length ? (showTrail ? trail : trail.slice(0, 3)).map(session => {
              const expanded = expandedSessionId === session.id;
              const detailId = `${trailId}-session-${session.id}`;
              return (
                <div className="focus-follow-up-item" key={session.id}>
                  <Button type="button" variant="ghost" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedSessionId(expanded ? null : session.id)}>
                    {session.taskTitle} · {session.durationLabel} · {session.outcome ?? session.state}
                  </Button>
                    <div id={detailId} className="focus-follow-up-session-detail" hidden={!expanded}>
                      <p>{session.startedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.startedAt)) : "Time unavailable"}</p>
                      {session.note ? <p>{session.note}</p> : <p>No note was saved for this session.</p>}
                      {durableAvailable ? <>
                        <p>Saved next action: {session.nextStepAction === "task" ? (snapshot.tasks ?? []).find((task: any) => task.id === session.nextStepTaskId)?.title ?? "Task unavailable" : session.nextStepAction === "plan" ? "Daily plan" : session.nextStepAction === "none" ? "No next action" : "Not saved"}.</p>
                        <p>Habit attribution: {session.habitId ? (snapshot.habits ?? []).find((habit: any) => habit.id === session.habitId)?.name ?? "Habit unavailable" : "No habit linked"}.</p>
                        <small>Source: this saved Focus session. Today’s habit totals use saved segments and their workspace-local dates.</small>
                        {session.nextStepAction === "task" && session.nextStepTaskId && (snapshot.tasks ?? []).some((task: any) => task.id === session.nextStepTaskId) ? <Button type="button" variant="outline" onClick={() => onOpenTask(session.nextStepTaskId!)}>Open saved next task</Button> : null}
                        {session.nextStepAction === "plan" ? <Button type="button" variant="outline" onClick={onOpenPlan}>Open saved plan</Button> : null}
                      </> : null}
                      {session.taskId && snapshot.tasks?.some((task: any) => task.id === session.taskId) ? <Button type="button" variant="outline" onClick={() => onOpenTask(session.taskId!)}>Open task</Button> : null}
                    </div>
                </div>
              );
            }) : <p>Your completed sessions will appear here.</p>}
            {trail.length > 3 ? <Button type="button" variant="outline" onClick={() => setShowTrail(value => !value)}>{showTrail ? "Show fewer" : `Show ${trail.length - 3} more`}</Button> : null}
            <small>{trail.length ? "Recent sessions in the current history window." : "No completed sessions in the current history window."}</small>
          </div>
        </article>
      </div>
    </section>
  );
}
