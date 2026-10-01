import { habitStartLocalDate, habitWeeklyTarget, isHabitScheduledOnLocalDate, type CalendarHabit } from "./habitSchedule";

export type RecoveryHabit = CalendarHabit & { id: string };
export type RecoveryCheckIn = {
  habitId: string;
  localDate: string;
  state: "completed" | "skipped" | "missed";
};
export type HabitDayState = "completed" | "skipped" | "missed" | "due" | "not_yet_due";

export type HabitReturnDecision = {
  todayState: HabitDayState;
  nextOpportunityLocalDate: string | null;
  nextOpportunityKind: "scheduled" | "flexible_week" | null;
  recentConsistency: {
    windowStartLocalDate: string;
    windowEndLocalDate: string;
    scheduled: number;
    completed: number;
    skipped: number;
    missed: number;
    unrecorded: number;
    consistencyPercent: number | null;
  };
  interrupted: boolean;
  returnChoices: readonly ["resume", "revise", "pause"];
};

const DAY_MS = 86_400_000;
const RETURN_CHOICES = ["resume", "revise", "pause"] as const;

function dayNumber(localDate: string) {
  return new Date(`${localDate}T00:00:00.000Z`).getTime() / DAY_MS;
}

function shiftLocalDate(localDate: string, days: number) {
  return new Date((dayNumber(localDate) + days) * DAY_MS).toISOString().slice(0, 10);
}

function mondayOf(localDate: string) {
  const weekday = new Date(dayNumber(localDate) * DAY_MS).getUTCDay();
  return shiftLocalDate(localDate, -((weekday + 6) % 7));
}

function scheduleOf(habit: RecoveryHabit): Record<string, unknown> {
  return habit.schedule && typeof habit.schedule === "object" && !Array.isArray(habit.schedule)
    ? habit.schedule as Record<string, unknown>
    : {};
}

function localDateValue(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function isPaused(schedule: Record<string, unknown>, localDate: string, today: string) {
  const until = localDateValue(schedule.pauseUntilLocalDate);
  if (!until || localDate >= until) return false;
  const from = localDateValue(schedule.pauseStartedLocalDate) ?? localDateValue(schedule.pausedFromLocalDate) ?? today;
  return localDate >= from;
}

function recordedByDate(habit: RecoveryHabit, checkIns: readonly RecoveryCheckIn[], today: string) {
  const result = new Map<string, RecoveryCheckIn["state"]>();
  for (const checkIn of checkIns) {
    if (checkIn.habitId === habit.id && checkIn.localDate <= today) result.set(checkIn.localDate, checkIn.state);
  }
  return result;
}

function fixedScheduleDecision(habit: RecoveryHabit, byDate: Map<string, RecoveryCheckIn["state"]>, today: string, schedule: Record<string, unknown>): HabitReturnDecision {
  const windowEndLocalDate = shiftLocalDate(today, -1);
  const windowStartLocalDate = shiftLocalDate(today, -14);
  const recent = { windowStartLocalDate, windowEndLocalDate, scheduled: 0, completed: 0, skipped: 0, missed: 0, unrecorded: 0, consistencyPercent: null as number | null };
  let consecutiveGaps = 0;
  let countingGap = true;
  const acknowledged = localDateValue(schedule.returnAcknowledgedAtLocalDate);
  for (let offset = 1; offset <= 14; offset += 1) {
    const date = shiftLocalDate(today, -offset);
    if (!isHabitScheduledOnLocalDate(habit, date) || isPaused(schedule, date, today)) continue;
    recent.scheduled += 1;
    const state = byDate.get(date);
    if (state === "completed") recent.completed += 1;
    else if (state === "skipped") recent.skipped += 1;
    else if (state === "missed") recent.missed += 1;
    else recent.unrecorded += 1;
    if (countingGap && (state === "missed" || state === undefined) && (!acknowledged || date > acknowledged)) consecutiveGaps += 1;
    else countingGap = false;
  }
  recent.consistencyPercent = recent.scheduled ? Math.round(recent.completed / recent.scheduled * 100) : null;

  const recordedToday = byDate.get(today);
  const scheduledToday = isHabitScheduledOnLocalDate(habit, today) && !isPaused(schedule, today, today);
  const todayState = recordedToday ?? (scheduledToday ? "due" : "not_yet_due");
  let nextOpportunityLocalDate: string | null = null;
  const firstOffset = scheduledToday && !recordedToday ? 0 : 1;
  for (let offset = firstOffset; offset <= 3660; offset += 1) {
    const date = shiftLocalDate(today, offset);
    if (isHabitScheduledOnLocalDate(habit, date) && !isPaused(schedule, date, today)) {
      nextOpportunityLocalDate = date;
      break;
    }
  }
  return {
    todayState,
    nextOpportunityLocalDate,
    nextOpportunityKind: nextOpportunityLocalDate ? "scheduled" : null,
    recentConsistency: recent,
    interrupted: recordedToday !== "completed" && consecutiveGaps >= 2,
    returnChoices: RETURN_CHOICES,
  };
}

function flexibleWeekDecision(habit: RecoveryHabit, byDate: Map<string, RecoveryCheckIn["state"]>, today: string, schedule: Record<string, unknown>): HabitReturnDecision {
  const weekStart = mondayOf(today);
  const windowStartLocalDate = shiftLocalDate(weekStart, -14);
  const windowEndLocalDate = shiftLocalDate(weekStart, -1);
  const recent = { windowStartLocalDate, windowEndLocalDate, scheduled: 0, completed: 0, skipped: 0, missed: 0, unrecorded: 0, consistencyPercent: null as number | null };
  const target = habitWeeklyTarget(habit);
  const startsOn = habitStartLocalDate(habit);
  const acknowledged = localDateValue(schedule.returnAcknowledgedAtLocalDate);
  const weekCounts = (start: string, end: string) => {
    let completed = 0;
    let skipped = 0;
    let missed = 0;
    for (let date = start; date <= end; date = shiftLocalDate(date, 1)) {
      const state = byDate.get(date);
      if (state === "completed") completed += 1;
      else if (state === "skipped") skipped += 1;
      else if (state === "missed") missed += 1;
    }
    return { completed, skipped, missed };
  };

  let consecutiveGapWeeks = 0;
  for (let index = 1; index <= 2; index += 1) {
    const start = shiftLocalDate(weekStart, -7 * index);
    const end = shiftLocalDate(start, 6);
    if (target === null) continue;
    let availableDays = 0;
    for (let date = start; date <= end; date = shiftLocalDate(date, 1)) {
      if ((!startsOn || date >= startsOn) && !isPaused(schedule, date, today)) availableDays += 1;
    }
    const availableTarget = Math.min(target, availableDays);
    if (availableTarget === 0) continue;
    const counts = weekCounts(start, end);
    recent.scheduled += availableTarget;
    recent.completed += Math.min(availableTarget, counts.completed);
    const remaining = Math.max(0, availableTarget - counts.completed);
    recent.skipped += Math.min(remaining, counts.skipped);
    recent.missed += Math.min(Math.max(0, remaining - counts.skipped), counts.missed);
    recent.unrecorded += Math.max(0, availableTarget - counts.completed - counts.skipped - counts.missed);
    const unacknowledged = !acknowledged || start > acknowledged;
    if (index === 1 && unacknowledged && counts.completed < availableTarget && counts.skipped < availableTarget) consecutiveGapWeeks = 1;
    if (index === 2 && unacknowledged && consecutiveGapWeeks && counts.completed < availableTarget && counts.skipped < availableTarget) consecutiveGapWeeks = 2;
  }
  recent.consistencyPercent = recent.scheduled ? Math.round(recent.completed / recent.scheduled * 100) : null;

  const recordedToday = byDate.get(today);
  const todayState = recordedToday ?? "not_yet_due";
  const thisWeek = weekCounts(weekStart, today);
  let nextOpportunityLocalDate: string | null = null;
  if (target !== null) {
    const canPracticeToday = (!startsOn || today >= startsOn) && !isPaused(schedule, today, today) && thisWeek.completed < target && !recordedToday;
    if (canPracticeToday) nextOpportunityLocalDate = today;
    else {
      for (let offset = 1; offset <= 14; offset += 1) {
        const date = shiftLocalDate(today, offset);
        if ((startsOn && date < startsOn) || isPaused(schedule, date, today)) continue;
        const week = mondayOf(date);
        const count = week === weekStart ? thisWeek.completed : 0;
        if (count < target) {
          nextOpportunityLocalDate = date;
          break;
        }
      }
    }
  }
  return {
    todayState,
    nextOpportunityLocalDate,
    nextOpportunityKind: nextOpportunityLocalDate ? "flexible_week" : null,
    recentConsistency: recent,
    interrupted: thisWeek.completed === 0 && consecutiveGapWeeks >= 2,
    returnChoices: RETURN_CHOICES,
  };
}

/** Factual, bounded return guidance. No historical check-in or schedule is changed. */
export function habitReturnDecision(habit: RecoveryHabit, checkIns: readonly RecoveryCheckIn[], today: string): HabitReturnDecision {
  const byDate = recordedByDate(habit, checkIns, today);
  const schedule = scheduleOf(habit);
  return habit.frequency === "times_per_week"
    ? flexibleWeekDecision(habit, byDate, today, schedule)
    : fixedScheduleDecision(habit, byDate, today, schedule);
}
