export type ReminderSchedule =
  | { kind: "daily"; timeLocal: string }
  | { kind: "weekly"; weekday: number; timeLocal: string };

export type ReminderClock = {
  localDate: string;
  weekday: number;
  hour: number;
  minute: number;
};

function assertTime(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("A reminder time must use 24-hour HH:MM format.");
  return value;
}

export function serializeReminderSchedule(schedule: ReminderSchedule) {
  return schedule.kind === "daily" ? `daily@${assertTime(schedule.timeLocal)}` : `weekly@${schedule.weekday}@${assertTime(schedule.timeLocal)}`;
}

export function parseReminderSchedule(value: string): ReminderSchedule {
  const daily = /^daily@((?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (daily) return { kind: "daily", timeLocal: daily[1] };
  const weekly = /^weekly@([0-6])@((?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (weekly) return { kind: "weekly", weekday: Number(weekly[1]), timeLocal: weekly[2] };
  throw new Error("The reminder schedule is invalid.");
}

export function localReminderClock(now: Date, timezone: string): ReminderClock {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  const weekday = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[value("weekday")];
  if (weekday === undefined || !value("year") || !value("month") || !value("day")) throw new Error("The reminder timezone could not be resolved.");
  return { localDate: `${value("year")}-${value("month")}-${value("day")}`, weekday, hour: Number(value("hour")), minute: Number(value("minute")) };
}

export function reminderDueAt(scheduleValue: string, timezone: string, now: Date) {
  const schedule = parseReminderSchedule(scheduleValue);
  const clock = localReminderClock(now, timezone);
  const [expectedHour, expectedMinute] = schedule.timeLocal.split(":").map(Number);
  const matchesTime = clock.hour === expectedHour && clock.minute === expectedMinute;
  const due = matchesTime && (schedule.kind === "daily" || clock.weekday === schedule.weekday);
  return { due, localDate: clock.localDate, localTime: `${String(clock.hour).padStart(2, "0")}:${String(clock.minute).padStart(2, "0")}` };
}
