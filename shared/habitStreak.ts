// Habit streak maths shared by the Dashboard (`dashboardModel.ts` re-exports it) and the D4 "Why it matters"
// engine (spec D4 §4.1). Moved unchanged from client/src/features/dashboard/dashboardModel.ts so both read the
// same number: `shared/` cannot import `@/`.

import { isHabitScheduledOnLocalDate, type CalendarHabit } from "./habitSchedule";
import { shiftLocalDate } from "./taskRecurrence";

export type StreakHabit = CalendarHabit & { id: string };
export type StreakCheckIn = { habitId: string; localDate: string; state: string };

export type HabitStreakDetail = {
  streak: number;
  /** True when the walk reached `earliest` without a break: the real streak may be longer than the window. */
  capped: boolean;
};

/** `habitStreak` plus whether the window, not a missed day, ended the count. */
export function habitStreakDetail(habit: StreakHabit, checkIns: readonly StreakCheckIn[], localDate: string, earliest: string): HabitStreakDetail {
  const states = new Map(checkIns.filter(item => item.habitId === habit.id).map(item => [item.localDate, item.state]));
  let day = states.get(localDate) === "completed" ? localDate : shiftLocalDate(localDate, -1);
  let streak = 0;
  while (day >= earliest) {
    const state = states.get(day);
    if (state === "completed") streak += 1;
    else if (state === "skipped" || !isHabitScheduledOnLocalDate(habit, day)) {
      // Not a due day: carry on without counting.
    } else return { streak, capped: false };
    day = shiftLocalDate(day, -1);
  }
  return { streak, capped: streak > 0 };
}

/** Consecutive completed days ending today, or yesterday while today is still open. Skipped days neither break nor extend it. */
export function habitStreak(habit: StreakHabit, checkIns: readonly StreakCheckIn[], localDate: string, earliest: string): number {
  return habitStreakDetail(habit, checkIns, localDate, earliest).streak;
}
