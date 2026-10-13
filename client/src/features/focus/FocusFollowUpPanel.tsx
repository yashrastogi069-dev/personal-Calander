// The Focus context rail (D2.5): Up next after this, Coming up, Today and Evidence. The next-step
// editor moved into Finish step 2 (FocusNextStep); the draft helpers are re-exported from there.
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { BarChart3, CalendarClock, Check, ChevronDown, History, RotateCcw, Sparkles, type LucideIcon } from "lucide-react";
import { buildFocusSessionTrail, buildHabitCompanion, buildMeetingHorizon, buildRoutineConductor, type FocusFollowUpSession } from "@shared/focusFollowUp";
import { focusEstimateAccuracy, focusMinutes } from "@shared/focusMetrics";
import { cn } from "@/lib/utils";
import { formatClockTime, formatFocusMinutes } from "./focusDisplay";

export { focusFollowUpDraft, focusFollowUpDraftReducer } from "./FocusNextStep";

type NextStepAction = "task" | "plan" | "none";
type DurableFollowUpSession = FocusFollowUpSession & { habitId?: string | null; nextStepAction?: NextStepAction | null; nextStepTaskId?: string | null };

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

export function focusEstimateSignalLabel(direction: ReturnType<typeof focusEstimateAccuracy>["direction"]) {
  switch (direction) {
    case "not_enough_data": return "Need data";
    case "on_target": return "On target";
    case "underestimated": return "Actual over estimate";
    case "overestimated": return "Actual under estimate";
  }
}

function savedDuration(seconds: number) {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}h ` : ""}${minutes % 60}m ${wholeSeconds % 60}s`;
}

function localDateOf(at: Date | string | null | undefined, timeZone?: string) {
  if (!at) return null;
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  } catch {
    return null;
  }
}

function RailCard({ icon: Icon, title, tone = "pc-tone-accent", index, children, className, label }: { icon: LucideIcon; title: string; tone?: string; index: number; children: ReactNode; className?: string; label?: string }) {
  const headingId = useId();
  return (
    <section className={cn("pc-focus-rail-card pc-rise", className)} style={{ "--pc-i": index } as CSSProperties} aria-labelledby={headingId} aria-label={label}>
      <h3 id={headingId} className="pc-focus-rail-title">
        <span className={cn("pc-icon-tile", tone)} aria-hidden="true"><Icon size={16} /></span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export type LastSessionSummary = { id: string; taskTitle: string; activeSeconds: number; nextStepAction: NextStepAction | null };

export function FocusFollowUpPanel({
  snapshot,
  today,
  timeZone,
  activeSession,
  isOnline,
  lastSession,
  onChooseNextStep,
  onReturnToTimer,
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
  timeZone?: string;
  activeSession?: FocusFollowUpSession | null;
  isOnline: boolean;
  /** Idle only: the newest finished session, shown when no session is open. */
  lastSession?: LastSessionSummary | null;
  onChooseNextStep?: () => void;
  onReturnToTimer?: () => void;
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
  const trailId = useId();
  const durableAvailable = snapshot.focusHabitAttributionAvailable === true;
  const sessions: any[] = snapshot.focusSessions ?? [];
  const tasks: any[] = snapshot.tasks ?? [];
  const attributedToday = durableAvailable ? savedHabitFocusForDate(snapshot.focusHabitAttribution ?? [], today) : [];
  const meetings = buildMeetingHorizon(snapshot.externalEvents ?? []);
  const habits = buildHabitCompanion(snapshot.habits ?? [], snapshot.habitCheckIns ?? [], today);
  const trail = buildFocusSessionTrail<DurableFollowUpSession>(sessions, tasks);
  const conductor = buildRoutineConductor({ activeSession, tasks, meetings, habits });
  const checkInByHabit = new Map((snapshot.habitCheckIns ?? []).filter((item: any) => item.localDate === today).map((item: any) => [item.habitId, item]));
  const finished = sessions.filter(session => session.state === "completed" || session.state === "abandoned");
  const todaySessions = finished.filter(session => localDateOf(session.endedAt ?? session.startedAt, timeZone) === today);
  const todayMinutes = focusMinutes(todaySessions);
  const longest = Math.max(1, ...todaySessions.map(session => Number(session.activeSeconds) || 0));
  const accuracy = focusEstimateAccuracy(sessions, tasks);
  const recordedMinutes = focusMinutes(finished);
  const pausedOffline = conductor.key === "focus" && activeSession?.state === "paused" && !isOnline;

  const runConductorAction = () => {
    if (conductor.key === "focus") {
      if (activeSession?.state === "paused") {
        if (isOnline) onResumeFocus();
      } else onReturnToTimer?.();
    } else if (conductor.key === "meeting") onOpenCalendar();
    else if (conductor.key === "habit" && conductor.targetId) onOpenHabit(conductor.targetId);
    else if (conductor.key === "task" && conductor.targetId) onOpenTask(conductor.targetId);
    else onOpenPlan();
  };
  const conductorActionLabel = conductor.key === "focus" ? (activeSession?.state === "paused" ? "Resume focus" : "Return to timer") : conductor.key === "meeting" ? "Open calendar" : conductor.key === "habit" ? "Open next habit" : conductor.key === "task" ? "Open task" : "Open daily plan";
  const nowMs = Date.now();
  let index = 0;

  return (
    <div className="pc-focus-rail" role="complementary" aria-label="Focus context">
      {lastSession && !activeSession ? (
        <RailCard icon={History} title="Last session" index={index++} className="is-last">
          <p className="pc-focus-rail-lead">
            <b className="pc-num">{formatFocusMinutes(lastSession.activeSeconds / 60)}</b> on {lastSession.taskTitle}
          </p>
          <p className="pc-focus-hint">{lastSession.nextStepAction ? "Next step saved." : "Next step not chosen."}</p>
          {onChooseNextStep ? (
            <button type="button" className="pc-focus-btn is-ghost is-small pc-focusable" onClick={onChooseNextStep}>Choose next step</button>
          ) : null}
        </RailCard>
      ) : null}

      <RailCard icon={Sparkles} title="Up next after this" index={index++}>
        <p className="pc-focus-rail-lead">{conductor.title}</p>
        <p className="pc-focus-hint">{conductor.detail}</p>
        <button type="button" className="pc-focus-btn is-ghost is-small pc-focusable" disabled={pausedOffline} onClick={runConductorAction}>
          {pausedOffline ? "Reconnect to resume" : conductorActionLabel}
        </button>
      </RailCard>

      <RailCard icon={CalendarClock} title="Coming up" index={index++} tone="pc-tone-social">
        {meetings.length ? (
          <ul className="pc-focus-rail-list">
            {meetings.map(meeting => {
              const minutes = Math.round((meeting.startMs - nowMs) / 60_000);
              return (
                <li key={meeting.id} className="pc-focus-meeting">
                  <span className="pc-focus-meeting-time pc-num">{meeting.phase === "in_progress" ? "Now" : formatClockTime(meeting.startMs, timeZone)}</span>
                  <span className="pc-focus-meeting-title">{meeting.title}</span>
                  <span className="pc-focus-hint pc-num">{meeting.phase === "in_progress" ? "in progress" : `in ${formatFocusMinutes(Math.max(1, minutes))}`}</span>
                </li>
              );
            })}
          </ul>
        ) : <p className="pc-focus-hint">No meetings in the next three hours.</p>}
        <button type="button" className="pc-focus-btn is-ghost is-small pc-focusable" onClick={onOpenCalendar}>
          <CalendarClock size={15} aria-hidden="true" /> Open calendar
        </button>
        <p className="pc-focus-footnote">From saved calendar events. Incoming Apple Calendar appointments are not connected.</p>
      </RailCard>

      <RailCard icon={History} title="Today" index={index++} tone="pc-tone-learning">
        <p className="pc-focus-rail-lead pc-num">
          {todaySessions.length ? `${todaySessions.length} session${todaySessions.length === 1 ? "" : "s"} · ${formatFocusMinutes(todayMinutes)}` : "No saved sessions yet today"}
        </p>
        {todaySessions.length ? (
          <div className="pc-focus-strip" aria-hidden="true">
            {todaySessions.slice(-12).map(session => (
              <span key={session.id} className={cn("pc-focus-strip-bar", session.state === "abandoned" && "is-stopped")} style={{ "--h": Math.max(0.18, (Number(session.activeSeconds) || 0) / longest) } as CSSProperties} />
            ))}
          </div>
        ) : null}

        <div className="pc-focus-habits" aria-label="Habits due today" role="group">
          {habits.items.length ? habits.items.map(habit => {
            const checkIn = checkInByHabit.get(habit.id) as { id: string; version: number; state: string } | undefined;
            const done = habit.state === "completed" || habit.state === "skipped";
            return (
              <div className="pc-focus-habit" key={habit.id}>
                <button
                  type="button"
                  className={cn("pc-focus-habit-chip pc-focusable", habit.state === "completed" && "is-done", habit.state === "skipped" && "is-skipped")}
                  aria-pressed={habit.state === "completed"}
                  disabled={!isOnline || (done && !checkIn)}
                  onClick={() => (done ? onClearHabitCheckIn(habit.id, today) : onCheckInHabit(habit.id, today, "completed"))}
                  title={done ? `Undo ${habit.name}` : `Complete ${habit.name}`}
                >
                  <span className="pc-focus-habit-box" aria-hidden="true">{habit.state === "completed" ? <Check size={12} strokeWidth={3} /> : habit.state === "skipped" ? <RotateCcw size={11} /> : null}</span>
                  <span>{habit.name}</span>
                  <span className="pc-sr-only"> · {habit.state === "unrecorded" ? "Not checked in" : habit.state}</span>
                </button>
                {!done ? (
                  <button type="button" className="pc-focus-link pc-focusable" disabled={!isOnline} onClick={() => onCheckInHabit(habit.id, today, "skipped")}>Skip</button>
                ) : null}
                <button type="button" className="pc-focus-link pc-focusable" onClick={() => onOpenHabit(habit.id)}>Details</button>
              </div>
            );
          }) : <p className="pc-focus-hint">No scheduled habits need attention today.</p>}
          {!isOnline && habits.items.length ? <p className="pc-focus-hint">Reconnect to check in.</p> : null}
        </div>
        {durableAvailable ? (
          <div className="pc-focus-attribution" aria-label="Saved habit Focus time">
            <p className="pc-focus-rail-sub">Saved Focus time today</p>
            {attributedToday.length ? attributedToday.map(row => {
              const habit = (snapshot.habits ?? []).find((item: any) => item.id === row.habitId);
              return <p key={row.habitId} className="pc-focus-hint"><b>{habit?.name ?? "Habit unavailable"}</b> · {savedDuration(row.activeSeconds)} <span className="pc-focus-footnote">({today} · {row.timezones.join(", ")})</span></p>;
            }) : <p className="pc-focus-hint">No saved habit-attributed Focus time today.</p>}
            <p className="pc-focus-footnote">Only explicitly linked, saved session segments count. Running seconds are excluded. Focus time does not complete a habit check-in.</p>
          </div>
        ) : <p className="pc-focus-footnote">Check-ins are recorded; time is not attributed to habits yet.</p>}

        <div className="pc-focus-trail">
          <p className="pc-focus-rail-sub">Recent sessions</p>
          {trail.length ? (
            <ul className="pc-focus-rail-list">
              {(showTrail ? trail : trail.slice(0, 3)).map(session => {
                const expanded = expandedSessionId === session.id;
                const detailId = `${trailId}-session-${session.id}`;
                return (
                  <li key={session.id} className="pc-focus-trail-item">
                    <button type="button" className="pc-focus-trail-toggle pc-focusable" aria-expanded={expanded} aria-controls={detailId} onClick={() => setExpandedSessionId(expanded ? null : session.id)}>
                      <span className="pc-focus-trail-title">{session.taskTitle}</span>
                      <span className="pc-num">{session.durationLabel}</span>
                      <span className="pc-focus-hint">{session.outcome ?? session.state}</span>
                      <ChevronDown size={14} aria-hidden="true" className="pc-focus-trail-chevron" />
                    </button>
                    <div id={detailId} className="focus-follow-up-session-detail pc-focus-trail-detail" hidden={!expanded}>
                      <p>{session.startedAt ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(session.startedAt)) : "Time unavailable"}</p>
                      {session.note ? <p>{session.note}</p> : <p>No note was saved for this session.</p>}
                      {durableAvailable ? <>
                        <p>Saved next action: {session.nextStepAction === "task" ? tasks.find((task: any) => task.id === session.nextStepTaskId)?.title ?? "Task unavailable" : session.nextStepAction === "plan" ? "Daily plan" : session.nextStepAction === "none" ? "No next action" : "Not saved"}.</p>
                        <p>Habit attribution: {session.habitId ? (snapshot.habits ?? []).find((habit: any) => habit.id === session.habitId)?.name ?? "Habit unavailable" : "No habit linked"}.</p>
                        <p className="pc-focus-footnote">Source: this saved Focus session. Today’s habit totals use saved segments and their workspace-local dates.</p>
                        {session.nextStepAction === "task" && session.nextStepTaskId && tasks.some((task: any) => task.id === session.nextStepTaskId) ? <button type="button" className="pc-focus-link pc-focusable" onClick={() => onOpenTask(session.nextStepTaskId!)}>Open saved next task</button> : null}
                        {session.nextStepAction === "plan" ? <button type="button" className="pc-focus-link pc-focusable" onClick={onOpenPlan}>Open saved plan</button> : null}
                      </> : null}
                      {session.taskId && tasks.some((task: any) => task.id === session.taskId) ? <button type="button" className="pc-focus-link pc-focusable" onClick={() => onOpenTask(session.taskId!)}>Open task</button> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="pc-focus-hint">Your completed sessions will appear here.</p>}
          {trail.length > 3 ? <button type="button" className="pc-focus-link pc-focusable" onClick={() => setShowTrail(value => !value)}>{showTrail ? "Show fewer" : `Show ${trail.length - 3} more`}</button> : null}
        </div>
      </RailCard>

      <RailCard icon={BarChart3} title="Evidence" index={index++} tone="pc-tone-health">
        <dl className="pc-focus-evidence">
          <div><dt>Recorded</dt><dd className="pc-num">{formatFocusMinutes(recordedMinutes)}</dd></div>
          <div><dt>Measured tasks</dt><dd className="pc-num">{accuracy.measuredTasks}</dd></div>
          <div><dt>Estimate signal</dt><dd>{focusEstimateSignalLabel(accuracy.direction)}</dd></div>
        </dl>
        <p className="pc-focus-footnote">
          {accuracy.averageVarianceMinutes === null
            ? "Complete a task-linked session with an estimate to see an accuracy signal."
            : `Across ${accuracy.measuredTasks} measured task${accuracy.measuredTasks === 1 ? "" : "s"}, actual focus was ${Math.abs(accuracy.averageVarianceMinutes)} minutes ${accuracy.averageVarianceMinutes > 0 ? "over" : accuracy.averageVarianceMinutes < 0 ? "under" : "on"} the estimate on average.`}
        </p>
      </RailCard>
    </div>
  );
}
