import { useState } from "react";
import { CalendarClock, CheckCircle2, History, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildFocusSessionTrail, buildHabitCompanion, buildMeetingHorizon, buildRoutineConductor, type FocusFollowUpSession } from "@shared/focusFollowUp";

type Handoff = { taskId?: string | null; taskTitle: string; outcome: string; note: string };

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
}) {
  const [showTrail, setShowTrail] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const meetings = buildMeetingHorizon(snapshot.externalEvents ?? []);
  const habits = buildHabitCompanion(snapshot.habits ?? [], snapshot.habitCheckIns ?? [], today);
  const trail = buildFocusSessionTrail(snapshot.focusSessions ?? [], snapshot.tasks ?? []);
  const conductor = buildRoutineConductor({ activeSession, tasks: snapshot.tasks ?? [], meetings, habits });
  const checkInByHabit = new Map((snapshot.habitCheckIns ?? []).filter((item: any) => item.localDate === today).map((item: any) => [item.habitId, item]));
  const runConductorAction = () => {
    if (conductor.key === "focus") {
      if (activeSession?.state === "paused") onResumeFocus();
      else document.querySelector(".focus-watch-stage")?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        <Button type="button" onClick={runConductorAction}>{conductorActionLabel}</Button>
      </div>

      {handoff ? (
        <article className="focus-follow-up-card is-next-step" aria-label="Next step after Focus">
          <ListChecks size={18} />
          <div className="focus-follow-up-card-content">
            <strong>Finish → Next step</strong>
            <p>{handoff.outcome === "done" ? `You completed ${handoff.taskTitle}. Choose what to do next.` : `Continue with ${handoff.taskTitle} when you return.`}</p>
            {handoff.note ? <small>Your session note: {handoff.note}</small> : null}
            <div className="focus-follow-up-actions">
              {handoff.taskId ? <Button type="button" variant="outline" onClick={() => onOpenTask(handoff.taskId!)}>Open task</Button> : null}
              <Button type="button" variant="ghost" onClick={onOpenPlan}>Plan next step</Button>
            </div>
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
            <small>Check-ins are recorded; time is not attributed to habits yet.</small>
          </div>
        </article>

        <article className="focus-follow-up-card" aria-label="Session trail">
          <History size={18} />
          <div className="focus-follow-up-card-content">
            <strong>Session trail</strong>
            {trail.length ? (showTrail ? trail : trail.slice(0, 3)).map(session => {
              const expanded = expandedSessionId === session.id;
              return (
                <div className="focus-follow-up-item" key={session.id}>
                  <Button type="button" variant="ghost" aria-expanded={expanded} onClick={() => setExpandedSessionId(expanded ? null : session.id)}>
                    {session.taskTitle} · {session.durationLabel} · {session.outcome ?? session.state}
                  </Button>
                  {expanded ? (
                    <div className="focus-follow-up-session-detail">
                      <p>{session.startedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(session.startedAt)) : "Time unavailable"}</p>
                      {session.note ? <p>{session.note}</p> : <p>No note was saved for this session.</p>}
                      {session.taskId && snapshot.tasks?.some((task: any) => task.id === session.taskId) ? <Button type="button" variant="outline" onClick={() => onOpenTask(session.taskId!)}>Open task</Button> : null}
                    </div>
                  ) : null}
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
