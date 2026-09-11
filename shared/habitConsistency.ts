import { isHabitScheduledOnLocalDate } from "./habitSchedule";

export type ConsistencyHabit = Parameters<typeof isHabitScheduledOnLocalDate>[0] & { id: string };
export type ConsistencyCheckIn = { habitId: string; localDate: string; state: "completed" | "skipped" };

function shiftDate(localDate: string, amount: number) {
  const value = new Date(`${localDate}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function habitPeriodConsistency(habit: ConsistencyHabit, checkIns: ConsistencyCheckIn[], periodStart: string, periodEnd: string) {
  const byDate = new Map(checkIns.filter(checkIn => checkIn.habitId === habit.id).map(checkIn => [checkIn.localDate, checkIn.state]));
  let scheduled = 0;
  let completed = 0;
  let skipped = 0;
  let missed = 0;
  for (let day = periodStart; day <= periodEnd; day = shiftDate(day, 1)) {
    if (!isHabitScheduledOnLocalDate(habit, day)) continue;
    scheduled += 1;
    const state = byDate.get(day);
    if (state === "completed") completed += 1;
    else if (state === "skipped") skipped += 1;
    else missed += 1;
  }
  return { scheduled, completed, skipped, missed, consistencyPercent: scheduled ? Math.round((completed / scheduled) * 100) : null };
}

export function longTermHabitEvidence(habit: ConsistencyHabit, checkIns: ConsistencyCheckIn[], monthStarts: string[]) {
  return monthStarts.map(monthStart => {
    const end = new Date(`${monthStart}T00:00:00.000Z`);
    end.setUTCMonth(end.getUTCMonth() + 1, 0);
    return { monthStart, ...habitPeriodConsistency(habit, checkIns, monthStart, end.toISOString().slice(0, 10)) };
  });
}
