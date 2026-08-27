export type CalendarHabit = {
  frequency: "daily" | "days_of_week" | "times_per_week" | "interval";
  schedule: unknown;
  createdAt?: Date | string | null;
};

function localWeekday(localDate: string) {
  return new Date(`${localDate}T12:00:00.000Z`).getUTCDay();
}

function localDaysBetween(start: string, end: string) {
  const startAt = new Date(`${start}T12:00:00.000Z`).getTime();
  const endAt = new Date(`${end}T12:00:00.000Z`).getTime();
  return Math.floor((endAt - startAt) / 86_400_000);
}

export function habitStartLocalDate(habit: CalendarHabit) {
  const schedule = habit.schedule && typeof habit.schedule === "object" ? habit.schedule as Record<string, unknown> : {};
  if (typeof schedule.startLocalDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(schedule.startLocalDate)) return schedule.startLocalDate;
  if (typeof habit.createdAt === "string") return habit.createdAt.slice(0, 10);
  if (habit.createdAt instanceof Date) return habit.createdAt.toISOString().slice(0, 10);
  return null;
}

/** Pure schedule projection used by calendar surfaces; it never creates a check-in. */
export function isHabitScheduledOnLocalDate(habit: CalendarHabit, localDate: string): boolean {
  const schedule = habit.schedule && typeof habit.schedule === "object" ? habit.schedule as Record<string, unknown> : {};
  const startsOn = habitStartLocalDate(habit);
  if (startsOn && localDate < startsOn) return false;
  if (habit.frequency === "daily") return true;

  const weekdays = Array.isArray(schedule.weekdays) ? schedule.weekdays.filter((value): value is number => typeof value === "number" && value >= 0 && value <= 6) : [];
  if (habit.frequency === "days_of_week" || habit.frequency === "times_per_week") return weekdays.includes(localWeekday(localDate));

  if (habit.frequency === "interval") {
    const every = typeof schedule.intervalDays === "number" && schedule.intervalDays > 0 ? Math.floor(schedule.intervalDays) : 1;
    const anchor = habitStartLocalDate(habit) ?? localDate;
    const elapsed = localDaysBetween(anchor, localDate);
    return elapsed >= 0 && elapsed % every === 0;
  }

  return false;
}
