import { isHabitScheduledOnLocalDate } from "./habitSchedule";

export type ConsistencyHabit = Parameters<typeof isHabitScheduledOnLocalDate>[0] & { id: string };
export type ConsistencyCheckIn = { habitId: string; localDate: string; state: "completed" | "skipped" | "missed" };

function shiftDate(localDate: string, amount: number) {
  const value = new Date(`${localDate}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

/**
 * Factual period evidence. `todayLocalDate` prevents blank future/today cells being called missed.
 * Omit it only for a known closed historical period.
 */
export function habitPeriodConsistency(habit: ConsistencyHabit, checkIns: ConsistencyCheckIn[], periodStart: string, periodEnd: string, todayLocalDate = shiftDate(periodEnd, 1)) {
  const byDate = new Map(checkIns.filter(checkIn => checkIn.habitId === habit.id).map(checkIn => [checkIn.localDate, checkIn.state]));
  let scheduled = 0;
  let completed = 0;
  let skipped = 0;
  let missed = 0;
  let unrecorded = 0;
  let pending = 0;
  if (habit.frequency === "times_per_week") {
    for (const checkIn of checkIns) {
      if (checkIn.habitId !== habit.id || checkIn.localDate < periodStart || checkIn.localDate > periodEnd || checkIn.localDate > todayLocalDate) continue;
      if (checkIn.state === "completed") completed += 1;
      else if (checkIn.state === "skipped") skipped += 1;
      else missed += 1;
    }
    return { scheduled, completed, skipped, missed, unrecorded, pending, consistencyPercent: null };
  }
  for (let day = periodStart; day <= periodEnd; day = shiftDate(day, 1)) {
    if (!isHabitScheduledOnLocalDate(habit, day)) continue;
    if (day > todayLocalDate) continue;
    const state = byDate.get(day);
    if (day === todayLocalDate && !state) { pending += 1; continue; }
    scheduled += 1;
    if (state === "completed") completed += 1;
    else if (state === "skipped") skipped += 1;
    else if (state === "missed") missed += 1;
    else unrecorded += 1;
  }
  return { scheduled, completed, skipped, missed, unrecorded, pending, consistencyPercent: scheduled ? Math.round((completed / scheduled) * 100) : null };
}

export function longTermHabitEvidence(habit: ConsistencyHabit, checkIns: ConsistencyCheckIn[], monthStarts: string[], todayLocalDate?: string) {
  return monthStarts.map(monthStart => {
    const end = new Date(`${monthStart}T00:00:00.000Z`);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    return { monthStart, ...habitPeriodConsistency(habit, checkIns, monthStart, end.toISOString().slice(0, 10), todayLocalDate) };
  });
}
