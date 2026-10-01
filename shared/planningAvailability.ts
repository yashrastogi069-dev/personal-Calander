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

/** All instants matching a local wall time. A repeated fall-back time has two matches. */
export function zonedDateTimeCandidates(localDate: string, minutes: number, timezone: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  const hours = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const target = Date.UTC(year, month - 1, day, hours, minute);
  const offsets = new Set<number>();
  for (const distance of [-36, -12, 0, 12, 36]) {
    const probe = target + distance * 60 * 60_000;
    const parts = localDateParts(new Date(probe), timezone);
    const rendered = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), parts.hour, parts.minute);
    offsets.add(rendered - probe);
  }
  return Array.from(offsets).map(offset => new Date(target - offset)).filter(candidate => {
    const parts = localDateParts(candidate, timezone);
    return Number(parts.year) === year && Number(parts.month) === month && Number(parts.day) === day && parts.hour === hours && parts.minute === minute;
  }).sort((left, right) => left.getTime() - right.getTime());
}

/** Converts a wall time to UTC; an ambiguous time picks its earlier occurrence by default. */
export function zonedDateTimeToUtc(localDate: string, minutes: number, timezone: string, disambiguation: "earlier" | "later" = "earlier") {
  const candidates = zonedDateTimeCandidates(localDate, minutes, timezone);
  if (!candidates.length) throw new Error(`Local time ${localDate} ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")} does not exist in ${timezone}.`);
  return disambiguation === "later" ? candidates[candidates.length - 1] : candidates[0];
}

function clippedIntervals(intervals: BusyInterval[], dayStart: Date, dayEnd: Date): Interval[] {
  return intervals.flatMap(interval => {
    const start = new Date(interval.startsAt).getTime();
    const end = new Date(interval.endsAt).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return [];
    const clippedStart = Math.max(start, dayStart.getTime());
    const clippedEnd = Math.min(end, dayEnd.getTime());
    if (clippedEnd <= clippedStart) return [];
    return [{ start: clippedStart, end: clippedEnd }];
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
  return intervals.reduce((total, interval) => total + Math.max(0, interval.end - interval.start), 0) / 60_000;
}

export function planningAvailability(input: { localDate: string; timezone: string; window: PlanningWindow; reservedBlocks?: BusyInterval[]; externalBusy?: BusyInterval[] }): AvailabilitySummary {
  const workStart = timeToMinutes(input.window.workdayStartsAt);
  const workEnd = timeToMinutes(input.window.workdayEndsAt);
  const dayStart = zonedDateTimeToUtc(input.localDate, workStart, input.timezone);
  const dayEnd = zonedDateTimeToUtc(input.localDate, workEnd, input.timezone, "later");
  const workdayMinutes = Math.max(0, (dayEnd.getTime() - dayStart.getTime()) / 60_000);
  const reserved = clippedIntervals(input.reservedBlocks ?? [], dayStart, dayEnd);
  const external = clippedIntervals(input.externalBusy ?? [], dayStart, dayEnd);
  const scheduledMinutes = minutesInIntervals(mergeIntervals(reserved));
  const externalBusyMinutes = minutesInIntervals(mergeIntervals(external));
  const mergedBusyMinutes = minutesInIntervals(mergeIntervals([...reserved, ...external]));
  const breakMinutes = Math.max(0, Math.min(workdayMinutes, Math.floor(input.window.defaultBreakMinutes || 0)));
  const availableMinutes = Math.max(0, workdayMinutes - breakMinutes - externalBusyMinutes);
  const freeMinutes = Math.max(0, workdayMinutes - breakMinutes - mergedBusyMinutes);
  return { scheduledMinutes, externalBusyMinutes, mergedBusyMinutes, breakMinutes, workdayMinutes, availableMinutes, freeMinutes, isOvercommitted: scheduledMinutes > availableMinutes };
}

export function firstFreeSlot(input: { localDate: string; timezone: string; window: PlanningWindow; durationMinutes: number; reservedBlocks?: BusyInterval[]; externalBusy?: BusyInterval[] }) {
  const duration = Math.max(1, Math.floor(input.durationMinutes));
  const start = timeToMinutes(input.window.workdayStartsAt);
  const end = timeToMinutes(input.window.workdayEndsAt);
  if (end <= start) return null;
  const dayStart = zonedDateTimeToUtc(input.localDate, start, input.timezone);
  const dayEnd = zonedDateTimeToUtc(input.localDate, end, input.timezone, "later");
  if (duration * 60_000 > dayEnd.getTime() - dayStart.getTime()) return null;
  const occupied = mergeIntervals(clippedIntervals([...(input.reservedBlocks ?? []), ...(input.externalBusy ?? [])], dayStart, dayEnd));
  let cursor = dayStart.getTime();
  for (const interval of occupied) {
    if (interval.start - cursor >= duration * 60_000) return { startAt: new Date(cursor), endAt: new Date(cursor + duration * 60_000) };
    cursor = Math.max(cursor, interval.end);
  }
  if (dayEnd.getTime() - cursor >= duration * 60_000) return { startAt: new Date(cursor), endAt: new Date(cursor + duration * 60_000) };
  return null;
}
