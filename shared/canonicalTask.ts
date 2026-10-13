import { weekdayDayMonthLabel, dayMonthLabel } from "./taskDateLabels";
import { recurrenceCadenceLabel, recurringTaskStatus, type RecurringTaskStatus, type TaskOccurrenceLike } from "./taskRecurrence";

export type TaskDateValue = Date | string;

export type CanonicalTask = {
  id: string;
  workspaceId: string;
  parentTaskId?: string | null;
  goalId?: string | null;
  projectId?: string | null;
  categoryId?: string | null;
  title: string;
  description?: string | null;
  state: string;
  priority?: string | null;
  horizon?: string | null;
  dueLocalDate?: string | null;
  scheduledLocalDate?: string | null;
  plannedStartAt?: TaskDateValue | null;
  plannedEndAt?: TaskDateValue | null;
  estimateMinutes?: number | null;
  sortOrder?: number;
  scheduleMode?: string | null;
  outcome?: string | null;
  outcomeAt?: TaskDateValue | null;
  recurrenceRule?: unknown;
  recurrenceAnchor?: string | null;
  recurrenceUntilLocalDate?: string | null;
  rescheduleCount?: number;
  clientRequestId?: string | null;
  completedAt?: TaskDateValue | null;
  archivedAt?: TaskDateValue | null;
  createdAt?: TaskDateValue;
  updatedAt?: TaskDateValue;
  version: number;
  [field: string]: unknown;
};

export type CanonicalTaskSurface = "today" | "tasks" | "calendar" | "search" | "recovery";

export type CanonicalTaskContext = {
  surface: CanonicalTaskSurface;
  localDate: string;
  timezone: string;
  categoryName?: string | null;
  projectTitle?: string | null;
  goalTitle?: string | null;
  /** `snapshot.taskOccurrences`. Without it a recurring task still shows its computed next date. */
  occurrences?: readonly TaskOccurrenceLike[];
};

export type CanonicalTaskKeyTime =
  | { kind: "reserved_time"; label: string; startsAt: TaskDateValue; endsAt: TaskDateValue }
  | { kind: "plan_for" | "due_by"; label: string; localDate: string }
  /** A recurring series: the occurrence, never the series anchor (D3 §7). */
  | { kind: "occurrence"; label: string; accessibleLabel: string; localDate: string | null; status: RecurringTaskStatus["kind"]; cadence: string };

export type CanonicalTaskMetadata =
  | { kind: "project" | "goal" | "category"; label: string; recordId: string }
  | { kind: "priority"; label: string };

export type CanonicalTaskPrimaryAction = {
  id: "complete" | "edit_reservation" | "open_task" | "resolve_commitment";
  label: string;
};

export type CanonicalTaskPresentation<TTask extends CanonicalTask = CanonicalTask> = {
  identity: { kind: "task"; recordId: string; workspaceId: string; version: number };
  title: string;
  completion: { isComplete: boolean; state: string; completedAt: TaskDateValue | null };
  keyTime: CanonicalTaskKeyTime | null;
  metadata: CanonicalTaskMetadata[];
  primaryAction: CanonicalTaskPrimaryAction;
  /** The original object is retained so detail surfaces never fork task identity or lose secondary fields. */
  secondaryFields: TTask;
};

function timeLabel(value: TaskDateValue, timezone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function localDateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

/**
 * Occurrence copy for a recurring series (D3 §7): "Today", "Done today", "Next Fri 16 Oct",
 * "Series ended 30 Oct" or "Repeats after completion". The anchor date is never shown as a plan.
 */
export function recurringOccurrenceLabel(status: RecurringTaskStatus) {
  const cadence = recurrenceCadenceLabel(status.rule);
  if (status.kind === "pending_today") return { label: "Today", accessibleLabel: `${cadence}, due today`, localDate: status.localDate, tone: "accent" as const, cadence };
  if (status.kind === "resolved_today") {
    const label = status.state === "completed" ? "Done today" : status.state === "skipped" ? "Skipped today" : "Missed today";
    const next = status.next ? ` Next ${weekdayDayMonthLabel(status.next)}.` : "";
    return { label, accessibleLabel: `${cadence}. ${label}.${next}`, localDate: status.localDate, tone: "neutral" as const, cadence };
  }
  if (status.kind === "next") {
    const label = `Next ${weekdayDayMonthLabel(status.localDate)}`;
    return { label, accessibleLabel: `${cadence}. ${label}`, localDate: status.localDate, tone: "neutral" as const, cadence };
  }
  if (status.kind === "ended") {
    const label = `Series ended ${dayMonthLabel(status.until)}`;
    return { label, accessibleLabel: `${cadence}. ${label}`, localDate: null, tone: "neutral" as const, cadence };
  }
  if (status.kind === "after_completion") return { label: "Repeats after completion", accessibleLabel: `${cadence}. Repeats after completion`, localDate: null, tone: "neutral" as const, cadence };
  return { label: "No upcoming repeat", accessibleLabel: `${cadence}. No upcoming repeat`, localDate: null, tone: "neutral" as const, cadence };
}

function keyTimeForTask(task: CanonicalTask, context: CanonicalTaskContext): CanonicalTaskKeyTime | null {
  const recurring = recurringTaskStatus(task, context.localDate, context.occurrences);
  if (recurring) {
    const copy = recurringOccurrenceLabel(recurring);
    return { kind: "occurrence", label: copy.label, accessibleLabel: copy.accessibleLabel, localDate: copy.localDate, status: recurring.kind, cadence: copy.cadence };
  }
  if (task.plannedStartAt && task.plannedEndAt) {
    const start = timeLabel(task.plannedStartAt, context.timezone);
    const end = timeLabel(task.plannedEndAt, context.timezone);
    if (start && end) {
      return {
        kind: "reserved_time",
        label: `Reserved ${start}–${end}`,
        startsAt: task.plannedStartAt,
        endsAt: task.plannedEndAt,
      };
    }
  }
  if (task.scheduledLocalDate) {
    return { kind: "plan_for", label: `Plan for ${localDateLabel(task.scheduledLocalDate)}`, localDate: task.scheduledLocalDate };
  }
  if (task.dueLocalDate) {
    return { kind: "due_by", label: `Due by ${localDateLabel(task.dueLocalDate)}`, localDate: task.dueLocalDate };
  }
  return null;
}

function metadataForTask(task: CanonicalTask, context: CanonicalTaskContext): CanonicalTaskMetadata[] {
  const metadata: CanonicalTaskMetadata[] = [];
  if (task.projectId && context.projectTitle) metadata.push({ kind: "project", label: context.projectTitle, recordId: task.projectId });
  else if (task.goalId && context.goalTitle) metadata.push({ kind: "goal", label: context.goalTitle, recordId: task.goalId });
  else if (task.categoryId && context.categoryName) metadata.push({ kind: "category", label: context.categoryName, recordId: task.categoryId });

  if (task.priority && task.priority !== "medium") {
    metadata.push({ kind: "priority", label: `${task.priority.charAt(0).toUpperCase()}${task.priority.slice(1)} priority` });
  } else if (metadata.length < 2 && task.categoryId && context.categoryName && metadata[0]?.kind !== "category") {
    metadata.push({ kind: "category", label: context.categoryName, recordId: task.categoryId });
  }
  return metadata.slice(0, 2);
}

function primaryActionForTask(task: CanonicalTask, context: CanonicalTaskContext): CanonicalTaskPrimaryAction {
  if (task.state === "completed" || task.state === "archived") return { id: "open_task", label: "Open task" };
  if (context.surface === "recovery") return { id: "resolve_commitment", label: "Resolve commitment" };
  if (context.surface === "search") return { id: "open_task", label: "Open task" };
  if (context.surface === "calendar" && task.plannedStartAt && task.plannedEndAt) {
    return { id: "edit_reservation", label: "Edit reserved time" };
  }
  return { id: "complete", label: "Complete" };
}

/** A stable view over one task record. The source task is referenced, never rewritten or cloned as another entity. */
export function canonicalTaskPresentation<TTask extends CanonicalTask>(task: TTask, context: CanonicalTaskContext): CanonicalTaskPresentation<TTask> {
  return {
    identity: { kind: "task", recordId: task.id, workspaceId: task.workspaceId, version: task.version },
    title: task.title,
    completion: {
      isComplete: task.state === "completed",
      state: task.state,
      completedAt: task.completedAt ?? null,
    },
    keyTime: keyTimeForTask(task, context),
    metadata: metadataForTask(task, context),
    primaryAction: primaryActionForTask(task, context),
    secondaryFields: task,
  };
}
