import { isHabitScheduledOnLocalDate } from "./habitSchedule";

export type FocusFollowUpSession = {
  id: string;
  taskId?: string | null;
  state?: string | null;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  activeSeconds?: number | null;
  targetMinutes?: number | null;
  note?: string | null;
  outcome?: string | null;
};

export type FocusFollowUpMeeting = {
  id: string;
  title: string;
  startsAt: Date | string;
  endsAt: Date | string;
  status?: string | null;
};

function millis(value: Date | string | number) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatFocusTrailDuration(seconds: number | null | undefined) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${remainder}m`;
}

export function buildFocusSessionTrail<T extends FocusFollowUpSession>(
  sessions: T[],
  tasks: Array<{ id: string; title: string }>,
  limit = 8,
) {
  const taskTitles = new Map(tasks.map(task => [task.id, task.title]));
  return [...sessions]
    .filter(session => session.state === "completed" || session.state === "abandoned")
    .sort((left, right) => millis(right.endedAt ?? right.startedAt ?? 0) - millis(left.endedAt ?? left.startedAt ?? 0))
    .slice(0, Math.max(0, limit))
    .map(session => ({
      ...session,
      taskTitle: session.taskId ? taskTitles.get(session.taskId) ?? "Task unavailable" : "Unlinked focus",
      durationLabel: formatFocusTrailDuration(session.activeSeconds),
    }));
}

export function buildMeetingHorizon(
  events: FocusFollowUpMeeting[],
  now = new Date(),
  horizonMinutes = 180,
) {
  const start = now.getTime();
  const horizon = start + Math.max(1, horizonMinutes) * 60_000;
  return [...events]
    .filter(event => event.status !== "cancelled")
    .map(event => ({ ...event, startMs: millis(event.startsAt), endMs: millis(event.endsAt) }))
    .filter(event => event.endMs > start && event.startMs < horizon)
    .sort((left, right) => left.startMs - right.startMs)
    .slice(0, 4)
    .map(event => ({
      ...event,
      phase: event.startMs <= start ? "in_progress" as const : "upcoming" as const,
    }));
}

export function buildHabitCompanion(
  habits: Array<{ id: string; name: string; archivedAt?: Date | string | null; frequency: "daily" | "days_of_week" | "times_per_week" | "interval"; schedule: unknown; createdAt?: Date | string | null }>,
  checkIns: Array<{ habitId: string; localDate: string; state: string }>,
  today: string,
) {
  const active = habits.filter(habit => !habit.archivedAt && isHabitScheduledOnLocalDate(habit, today));
  const byHabit = new Map(checkIns.filter(checkIn => checkIn.localDate === today).map(checkIn => [checkIn.habitId, checkIn.state]));
  return {
    due: active.length,
    completed: active.filter(habit => byHabit.get(habit.id) === "completed").length,
    skipped: active.filter(habit => byHabit.get(habit.id) === "skipped").length,
    items: active.slice(0, 4).map(habit => ({
      id: habit.id,
      name: habit.name,
      state: byHabit.get(habit.id) ?? "unrecorded",
    })),
    durationTracked: false,
  };
}

export function buildRoutineConductor(input: {
  activeSession?: { taskId?: string | null; state?: string | null } | null;
  tasks: Array<{ id: string; title: string; state?: string; outcome?: string | null }>;
  meetings: ReturnType<typeof buildMeetingHorizon>;
  habits: ReturnType<typeof buildHabitCompanion>;
}) {
  if (input.activeSession?.state === "active" || input.activeSession?.state === "paused") {
    const task = input.tasks.find(candidate => candidate.id === input.activeSession?.taskId);
    const paused = input.activeSession.state === "paused";
    return { key: "focus", targetId: task?.id ?? null, title: task ? `${paused ? "Resume" : "Stay with"} ${task.title}` : `${paused ? "Resume" : "Stay with"} this focus block`, detail: paused ? "Your paused session is ready when you are." : "Your current session is the next deliberate action." };
  }
  if (input.meetings[0]) {
    const meeting = input.meetings[0];
    return { key: "meeting", targetId: meeting.id, title: meeting.phase === "in_progress" ? `You are in ${meeting.title}` : `Prepare for ${meeting.title}`, detail: "The next calendar commitment is the next horizon." };
  }
  if (input.habits.due > input.habits.completed + input.habits.skipped) {
    const nextHabit = input.habits.items.find(item => item.state === "unrecorded" || item.state === "missed");
    return { key: "habit", targetId: nextHabit?.id ?? null, title: "Keep today’s rhythm", detail: `${input.habits.due - input.habits.completed - input.habits.skipped} habit${input.habits.due - input.habits.completed - input.habits.skipped === 1 ? "" : "s"} still needs a deliberate check-in.` };
  }
  const nextTask = input.tasks.find(task => task.state !== "completed" && task.state !== "archived" && task.outcome !== "wont_do");
  return nextTask
    ? { key: "task", targetId: nextTask.id, title: `Next: ${nextTask.title}`, detail: "Choose one clear piece of work before opening more commitments." }
    : { key: "clear", targetId: null, title: "Your runway is clear", detail: "Review the day or choose a longer-horizon next step." };
}
