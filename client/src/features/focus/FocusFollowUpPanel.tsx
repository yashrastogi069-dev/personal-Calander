import { CalendarClock, CheckCircle2, History, ListChecks, Sparkles } from "lucide-react";
import { buildFocusSessionTrail, buildHabitCompanion, buildMeetingHorizon, buildRoutineConductor, type FocusFollowUpSession } from "@shared/focusFollowUp";

export function FocusFollowUpPanel({ snapshot, today, activeSession, handoff }: { snapshot: any; today: string; activeSession?: FocusFollowUpSession | null; handoff?: { taskTitle: string; outcome: string; note: string } | null }) {
  const meetings = buildMeetingHorizon(snapshot.externalEvents ?? []);
  const habits = buildHabitCompanion(snapshot.habits ?? [], snapshot.habitCheckIns ?? [], today);
  const trail = buildFocusSessionTrail(snapshot.focusSessions ?? [], snapshot.tasks ?? []);
  const conductor = buildRoutineConductor({ activeSession, tasks: snapshot.tasks ?? [], meetings, habits });

  return (
    <section className="focus-follow-up" aria-label="Focus follow-up">
      <div className="focus-follow-up-header">
        <div><span className="focus-follow-up-eyebrow"><Sparkles size={14} /> Routine conductor</span><h3>{conductor.title}</h3><p>{conductor.detail}</p></div>
      </div>
      {handoff ? <article className="focus-follow-up-card is-next-step" aria-label="Next step after Focus"><ListChecks size={18} /><div><strong>Finish → Next step</strong><p>{handoff.outcome === "done" ? `Good stop on ${handoff.taskTitle}. Choose the next commitment when you are ready.` : `Return to ${handoff.taskTitle} with one clear next move.`}</p>{handoff.note ? <small>Note retained: {handoff.note}</small> : null}</div></article> : null}
      <div className="focus-follow-up-grid">
        <article className="focus-follow-up-card" aria-label="Meeting horizon"><CalendarClock size={18} /><div><strong>Meeting horizon</strong>{meetings.length ? meetings.map(meeting => <p key={meeting.id}><b>{meeting.phase === "in_progress" ? "Now" : "Next"}</b> {meeting.title}</p>) : <p>No meetings in the next three hours. Your runway is open.</p>}<small>Source: saved calendar events. Incoming Apple Calendar is not assumed.</small></div></article>
        <article className="focus-follow-up-card" aria-label="Habit duration companion"><CheckCircle2 size={18} /><div><strong>Habit companion</strong><p>{habits.due ? `${habits.completed}/${habits.due} due habits recorded today.` : "No scheduled habits need attention today."}</p>{habits.durationTracked ? <small>Duration is attributed to a linked habit.</small> : <small>Check-ins are tracked; time is not attributed to habits yet.</small>}</div></article>
        <article className="focus-follow-up-card" aria-label="Session trail"><History size={18} /><div><strong>Session trail</strong>{trail.length ? trail.slice(0, 3).map(session => <p key={session.id}>{session.taskTitle} · {session.durationLabel}</p>) : <p>Your completed sessions will appear here.</p>}<small>{trail.length ? "Recent recorded Focus sessions" : "No completed session history in the current window."}</small></div></article>
      </div>
    </section>
  );
}
