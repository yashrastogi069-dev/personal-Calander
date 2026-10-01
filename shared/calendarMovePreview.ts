import type { PlanningWindow } from "./planningAvailability";
import { validateTaskReservation, validateTaskReservationWindow } from "./taskReservation";

export type CalendarPreviewTask = {
  id: string;
  title: string;
  version: number;
  scheduledLocalDate: string | null;
  dueLocalDate: string | null;
  plannedStartAt: Date | string | null;
  plannedEndAt: Date | string | null;
  estimateMinutes: number | null;
};

export type CalendarMutation =
  | { kind: "planned_day"; localDate: string | null }
  | { kind: "reservation"; localDate: string; startsAt: Date | string; endsAt: Date | string }
  | { kind: "deadline"; localDate: string | null };

export type CalendarBusyItem = {
  id: string;
  title: string;
  startsAt: Date | string;
  endsAt: Date | string;
};

export type CalendarPreviewContext = {
  timezone: string;
  window: PlanningWindow;
  isUnavailable?: boolean;
  reservations?: CalendarBusyItem[];
  externalBusy?: CalendarBusyItem[];
};

type CalendarPatch = Partial<Pick<CalendarPreviewTask, "scheduledLocalDate" | "dueLocalDate">> & {
  plannedStartAt?: Date | null;
  plannedEndAt?: Date | null;
};

export type CalendarPreviewAction = { id: string; expectedVersion: number; patch: CalendarPatch };
export type CalendarPreviewChange = { field: keyof CalendarPatch; label: string; before: string | null; after: string | null };
export type CalendarPreviewCollision = { id: string; title: string; kind: "reservation" | "external" };
export type CalendarMutationPreview = {
  kind: CalendarMutation["kind"];
  reservation: { localDate: string; plannedStartAt: Date; plannedEndAt: Date } | null;
  changes: CalendarPreviewChange[];
  collisions: CalendarPreviewCollision[];
  warnings: string[];
  apply: CalendarPreviewAction | null;
  undo: CalendarPreviewAction | null;
};

const labels = {
  scheduledLocalDate: "Planned day",
  dueLocalDate: "Deadline",
  plannedStartAt: "Reservation start",
  plannedEndAt: "Reservation end",
};

function dateString(value: Date | string | null) {
  if (value === null) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : String(value);
}

function validLocalDate(value: string | null) {
  if (value === null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function overlaps(start: number, end: number, item: CalendarBusyItem) {
  const otherStart = new Date(item.startsAt).getTime();
  const otherEnd = new Date(item.endsAt).getTime();
  return Number.isFinite(otherStart) && Number.isFinite(otherEnd) && start < otherEnd && end > otherStart;
}

/** Describes a proposed task edit; no record or input object is changed here. */
export function previewCalendarMutation(input: { task: CalendarPreviewTask; mutation: CalendarMutation; context: CalendarPreviewContext }): CalendarMutationPreview {
  const { task, mutation, context } = input;
  const changes: CalendarPreviewChange[] = [];
  const warnings: string[] = [];
  const collisions: CalendarPreviewCollision[] = [];
  const seenCollisions = new Set<string>();
  const patch: CalendarPatch = {};
  const undoPatch: CalendarPatch = {};

  const change = <K extends keyof CalendarPatch>(field: K, before: string | null, after: string | null, value: CalendarPatch[K], undoValue: CalendarPatch[K]) => {
    if (before === after) return;
    changes.push({ field, label: labels[field], before, after });
    Object.assign(patch, { [field]: value });
    Object.assign(undoPatch, { [field]: undoValue });
  };

  if (!validLocalDate(mutation.localDate)) warnings.push("Choose a valid calendar date.");
  if (mutation.kind === "planned_day") {
    change("scheduledLocalDate", task.scheduledLocalDate, mutation.localDate, mutation.localDate, task.scheduledLocalDate);
    if (task.plannedStartAt && task.plannedEndAt && changes.length) warnings.push("The existing timed reservation stays at its original time; review it separately.");
  } else if (mutation.kind === "deadline") {
    change("dueLocalDate", task.dueLocalDate, mutation.localDate, mutation.localDate, task.dueLocalDate);
  } else {
    const start = new Date(mutation.startsAt);
    const end = new Date(mutation.endsAt);
    const validation = validateTaskReservation({ localDate: mutation.localDate, timezone: context.timezone, plannedStartAt: start, plannedEndAt: end });
    if (validation) warnings.push(validation);
    else {
      const windowValidation = validateTaskReservationWindow({ timezone: context.timezone, plannedStartAt: start, plannedEndAt: end, workdayStartsAt: context.window.workdayStartsAt, workdayEndsAt: context.window.workdayEndsAt });
      if (windowValidation) warnings.push(windowValidation);
    }
    if (context.isUnavailable) warnings.push("This planning day is unavailable. Choose another day or update availability first.");
    if (!task.estimateMinutes || task.estimateMinutes <= 0) warnings.push("Focus-time estimate is unknown; the reserved duration does not change it.");
    if (Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start) {
      for (const item of context.reservations ?? []) {
        if (item.id !== task.id && overlaps(start.getTime(), end.getTime(), item) && !seenCollisions.has(`reservation:${item.id}`)) {
          collisions.push({ id: item.id, title: item.title, kind: "reservation" });
          seenCollisions.add(`reservation:${item.id}`);
        }
      }
      for (const item of context.externalBusy ?? []) {
        if (overlaps(start.getTime(), end.getTime(), item) && !seenCollisions.has(`external:${item.id}`)) {
          collisions.push({ id: item.id, title: item.title, kind: "external" });
          seenCollisions.add(`external:${item.id}`);
        }
      }
    }
    change("scheduledLocalDate", task.scheduledLocalDate, mutation.localDate, mutation.localDate, task.scheduledLocalDate);
    change("plannedStartAt", dateString(task.plannedStartAt), dateString(start), start, task.plannedStartAt === null ? null : new Date(task.plannedStartAt));
    change("plannedEndAt", dateString(task.plannedEndAt), dateString(end), end, task.plannedEndAt === null ? null : new Date(task.plannedEndAt));
  }

  const blockingWarnings = warnings.filter(warning => !warning.startsWith("Focus-time estimate") && !warning.startsWith("The existing timed reservation"));
  const ready = changes.length > 0 && blockingWarnings.length === 0 && collisions.length === 0;
  return {
    kind: mutation.kind,
    reservation: mutation.kind === "reservation" ? { localDate: mutation.localDate, plannedStartAt: new Date(mutation.startsAt), plannedEndAt: new Date(mutation.endsAt) } : null,
    changes, collisions, warnings,
    apply: ready ? { id: task.id, expectedVersion: task.version, patch } : null,
    undo: ready ? { id: task.id, expectedVersion: task.version + 1, patch: undoPatch } : null,
  };
}

/** Checks the exact version captured by the reviewed preview before writing. */
export function assertCalendarPreviewFresh(preview: CalendarMutationPreview, current: { id: string; version: number }, action: "apply" | "undo") {
  const reviewed = preview[action];
  if (!reviewed) throw new Error("This calendar change cannot be applied. Review a new preview.");
  if (current.id !== reviewed.id || current.version !== reviewed.expectedVersion) throw new Error("The task changed since this calendar preview. Review it again.");
  return reviewed;
}
