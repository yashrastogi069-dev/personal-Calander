export type PlanningWindow = {
  workdayStartsAt: string;
  workdayEndsAt: string;
  defaultBreakMinutes: number;
};

export type BusyInterval = {
  startsAt: Date | string;
  endsAt: Date | string;
};

export type AvailabilitySummary = {
  scheduledMinutes: number;
  externalBusyMinutes: number;
  mergedBusyMinutes: number;
  breakMinutes: number;
  workdayMinutes: number;
  availableMinutes: number;
  freeMinutes: number;
  isOvercommitted: boolean;
};

type Interval = { start: number; end: number };

function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return 0;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return 0;
  return hours * 60 + minutes;
}

function localDateParts(value: Date, timezone: string) {
  const values = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const part = (type: string) => values.find(item => item.type === type)?.value ?? "00";
  return { year: part("year"), month: part("month"), day: part("day"), hour: Number(part("hour")), minute: Number(part("minute")) };
}

function localDateKey(value: Date, timezone: string) {
  const parts = localDateParts(value, timezone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Converts a wall-clock time in the requested IANA zone into UTC without adding a date-library dependency. */
export function zonedDateTimeToUtc(localDate: string, minutes: number, timezone: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const target = Date.UTC(year, month - 1, day, hours, minute);
  let instant = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = localDateParts(new Date(instant), timezone);
    const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), parts.hour, parts.minute);
    instant += target - rendered;
  }
  return new Date(instant);
}

function clippedIntervals(intervals: BusyInterval[], localDate: string, timezone: string, dayStart: Date, dayEnd: Date): Interval[] {
  return intervals.flatMap(interval => {
    const start = new Date(interval.startsAt).getTime();
    const end = new Date(interval.endsAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const clippedStart = Math.max(start, dayStart.getTime());
    const clippedEnd = Math.min(end, dayEnd.getTime());
    if (clippedEnd <= clippedStart) return [];
    const startParts = localDateParts(new Date(clippedStart), timezone);
    const endParts = localDateParts(new Date(clippedEnd), timezone);
    const startMinute = startParts.hour * 60 + startParts.minute;
    const endMinute = localDateKey(new Date(clippedEnd), timezone) === localDate ? endParts.hour * 60 + endParts.minute : timeToMinutes("24:00");
    return [{ start: Math.max(0, startMinute), end: Math.min(1440, endMinute || 1440) }];
  });
}

function mergeIntervals(intervals: Interval[]) {
  const ordered = intervals.filter(interval => interval.end > interval.start).sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: Interval[] = [];
  for (const interval of ordered) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

function minutesInIntervals(intervals: Interval[]) {
  return intervals.reduce((total, interval) => total + Math.max(0, interval.end - interval.start), 0);
}

export function planningAvailability(input: { localDate: string; timezone: string; window: PlanningWindow; reservedBlocks?: BusyInterval[]; externalBusy?: BusyInterval[] }): AvailabilitySummary {
  const workStart = timeToMinutes(input.window.workdayStartsAt);
  const workEnd = timeToMinutes(input.window.workdayEndsAt);
  const workdayMinutes = Math.max(0, workEnd - workStart);
  const dayStart = zonedDateTimeToUtc(input.localDate, workStart, input.timezone);
  const dayEnd = zonedDateTimeToUtc(input.localDate, workEnd, input.timezone);
  const workWindow: Interval = { start: workStart, end: workEnd };
  const reserved = clippedIntervals(input.reservedBlocks ?? [], input.localDate, input.timezone, dayStart, dayEnd);
  const external = clippedIntervals(input.externalBusy ?? [], input.localDate, input.timezone, dayStart, dayEnd);
  const inWorkWindow = (intervals: Interval[]) => intervals.map(interval => ({ start: Math.max(workWindow.start, interval.start), end: Math.min(workWindow.end, interval.end) })).filter(interval => interval.end > interval.start);
  const scheduledMinutes = minutesInIntervals(mergeIntervals(inWorkWindow(reserved)));
  const externalBusyMinutes = minutesInIntervals(mergeIntervals(inWorkWindow(external)));
  const mergedBusyMinutes = minutesInIntervals(mergeIntervals(inWorkWindow([...reserved, ...external])));
  const breakMinutes = Math.max(0, Math.min(workdayMinutes, Math.floor(input.window.defaultBreakMinutes || 0)));
  const availableMinutes = Math.max(0, workdayMinutes - breakMinutes - externalBusyMinutes);
  const freeMinutes = Math.max(0, workdayMinutes - breakMinutes - mergedBusyMinutes);
  return { scheduledMinutes, externalBusyMinutes, mergedBusyMinutes, breakMinutes, workdayMinutes, availableMinutes, freeMinutes, isOvercommitted: scheduledMinutes > availableMinutes };
}

export function firstFreeSlot(input: { localDate: string; timezone: string; window: PlanningWindow; durationMinutes: number; reservedBlocks?: BusyInterval[]; externalBusy?: BusyInterval[] }) {
  const duration = Math.max(1, Math.floor(input.durationMinutes));
  const start = timeToMinutes(input.window.workdayStartsAt);
  const end = timeToMinutes(input.window.workdayEndsAt);
  if (end <= start || duration > end - start) return null;
  const dayStart = zonedDateTimeToUtc(input.localDate, start, input.timezone);
  const dayEnd = zonedDateTimeToUtc(input.localDate, end, input.timezone);
  const occupied = mergeIntervals(clippedIntervals([...(input.reservedBlocks ?? []), ...(input.externalBusy ?? [])], input.localDate, input.timezone, dayStart, dayEnd).map(interval => ({ start: Math.max(start, interval.start), end: Math.min(end, interval.end) })).filter(interval => interval.end > interval.start));
  let cursor = start;
  for (const interval of occupied) {
    if (interval.start - cursor >= duration) return { startAt: zonedDateTimeToUtc(input.localDate, cursor, input.timezone), endAt: zonedDateTimeToUtc(input.localDate, cursor + duration, input.timezone) };
    cursor = Math.max(cursor, interval.end);
  }
  if (end - cursor >= duration) return { startAt: zonedDateTimeToUtc(input.localDate, cursor, input.timezone), endAt: zonedDateTimeToUtc(input.localDate, cursor + duration, input.timezone) };
  return null;
}
