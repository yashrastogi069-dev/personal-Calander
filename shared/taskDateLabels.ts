// Date copy for task pills and refusal reasons, in the en-NZ short forms the Dashboard uses ("16 Oct",
// "Fri 16 Oct"). Names are fixed arrays rather than Intl month names, because ICU spells September
// "Sept" in some en-NZ/en-GB builds. A local date is a calendar day and never passes through a timezone.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

function parts(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
  return { day, month: MONTHS[month - 1], weekday: WEEKDAYS[weekday] };
}

/** "16 Oct" */
export function dayMonthLabel(localDate: string) {
  const value = parts(localDate);
  return value ? `${value.day} ${value.month}` : localDate;
}

/** "Fri 16 Oct" */
export function weekdayDayMonthLabel(localDate: string) {
  const value = parts(localDate);
  return value ? `${value.weekday} ${value.day} ${value.month}` : localDate;
}

/** "Fri 16" */
export function weekdayDayLabel(localDate: string) {
  const value = parts(localDate);
  return value ? `${value.weekday} ${value.day}` : localDate;
}

/** "Fri" */
export function weekdayLabel(localDate: string) {
  return parts(localDate)?.weekday ?? localDate;
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function localDaysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T12:00:00.000Z`) - Date.parse(`${from}T12:00:00.000Z`)) / 86_400_000);
}

/** The workspace-local calendar day of an instant. Never slice a UTC ISO string for this. */
export function localDateForInstant(value: Date | string, timezone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => formatted.find(item => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** "09:15" in the workspace timezone. */
export function localTimeLabel(value: Date | string, timezone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}
