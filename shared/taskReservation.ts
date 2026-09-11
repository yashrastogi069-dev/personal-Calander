export const taskReservationGridMinutes = 15;
export const defaultTaskReservationMinutes = 30;

export type ReservationInterval = {
  startsAt: Date | string;
  endsAt: Date | string;
};

type LocalParts = { localDate: string; minuteOfDay: number };

export function taskReservationLocalParts(value: Date, timezone: string): LocalParts {
  const rendered = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: string) => rendered.find(item => item.type === type)?.value ?? "00";
  return {
    localDate: `${part("year")}-${part("month")}-${part("day")}`,
    minuteOfDay: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

export function roundedTaskReservationMinutes(estimateMinutes: number | null | undefined) {
  const source = Number.isFinite(estimateMinutes) && (estimateMinutes ?? 0) > 0
    ? Math.floor(estimateMinutes!)
    : defaultTaskReservationMinutes;
  return Math.max(taskReservationGridMinutes, Math.ceil(source / taskReservationGridMinutes) * taskReservationGridMinutes);
}

export function isTaskCalendarProjection(task: { state: string; plannedStartAt: Date | string | null; plannedEndAt: Date | string | null }) {
  return task.state !== "completed" && task.state !== "archived" && Boolean(task.plannedStartAt && task.plannedEndAt);
}

export function validateTaskReservation(input: { localDate: string; timezone: string; plannedStartAt: Date; plannedEndAt: Date }) {
  const startTime = input.plannedStartAt.getTime();
  const endTime = input.plannedEndAt.getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return "Choose a valid calendar start and end time.";
  if (endTime <= startTime) return "Reserved time must end after it starts.";
  if (endTime - startTime > 24 * 60 * 60_000) return "Keep a reserved block within one day.";

  const start = taskReservationLocalParts(input.plannedStartAt, input.timezone);
  const end = taskReservationLocalParts(input.plannedEndAt, input.timezone);
  if (start.localDate !== input.localDate || end.localDate !== input.localDate) return "Keep the reserved block within the selected calendar day.";
  if (start.minuteOfDay % taskReservationGridMinutes !== 0 || end.minuteOfDay % taskReservationGridMinutes !== 0) return `Use ${taskReservationGridMinutes}-minute calendar increments.`;
  return null;
}

export function validateTaskReservationWindow(input: { timezone: string; plannedStartAt: Date; plannedEndAt: Date; workdayStartsAt: string; workdayEndsAt: string }) {
  const [startHours, startMinutes] = input.workdayStartsAt.split(":").map(Number);
  const [endHours, endMinutes] = input.workdayEndsAt.split(":").map(Number);
  const windowStart = startHours * 60 + startMinutes;
  const windowEnd = endHours * 60 + endMinutes;
  const start = taskReservationLocalParts(input.plannedStartAt, input.timezone).minuteOfDay;
  const end = taskReservationLocalParts(input.plannedEndAt, input.timezone).minuteOfDay;
  if (!Number.isFinite(windowStart) || !Number.isFinite(windowEnd) || windowEnd <= windowStart) return "This planning day is unavailable. Choose another day or update availability first.";
  if (start < windowStart || end > windowEnd) return `Keep this reservation inside the available work window (${input.workdayStartsAt}–${input.workdayEndsAt}).`;
  return null;
}

export function reservationConflictMessage(candidate: ReservationInterval, busyIntervals: ReservationInterval[]) {
  const start = new Date(candidate.startsAt).getTime();
  const end = new Date(candidate.endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "Choose a valid calendar start and end time.";
  const conflict = busyIntervals.some(interval => {
    const busyStart = new Date(interval.startsAt).getTime();
    const busyEnd = new Date(interval.endsAt).getTime();
    return Number.isFinite(busyStart) && Number.isFinite(busyEnd) && busyEnd > busyStart && start < busyEnd && end > busyStart;
  });
  return conflict ? "That time overlaps reserved or read-only busy calendar time. Choose another 15-minute slot." : null;
}
