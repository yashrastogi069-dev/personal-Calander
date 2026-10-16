// When buckets for the Tasks List and the Board's When lens (spec D3 §3.2).
// Every date here is a workspace-local calendar day: reservations are converted from their instant in the
// workspace timezone, never by slicing a UTC ISO string (that is a day early or late east/west of UTC).

import { localDateForInstant, localDaysBetween } from "./taskDateLabels";
import { isRecurrenceRule, recurringTaskKeyDate, recurringTaskStatus, shiftLocalDate, type RecurringTaskStatus, type TaskOccurrenceLike } from "./taskRecurrence";

export const taskWhenBuckets = [
  { id: "past_due", label: "Past due" },
  { id: "today", label: "Today" },
  { id: "next_7_days", label: "Next 7 days" },
  { id: "later", label: "Later" },
  { id: "no_date", label: "No date" },
] as const;

export type TaskWhenBucket = (typeof taskWhenBuckets)[number]["id"];

/** List sections are the When buckets plus a collapsed Done section at the end. */
export type TaskListSectionId = TaskWhenBucket | "done";

export type BucketTask = {
  id: string;
  state: string;
  horizon?: string | null;
  projectId?: string | null;
  plannedWeekStartLocalDate?: string | null;
  dueLocalDate?: string | null;
  scheduledLocalDate?: string | null;
  plannedStartAt?: Date | string | null;
  plannedEndAt?: Date | string | null;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
  recurrenceRule?: unknown;
  recurrenceAnchor?: string | null;
  recurrenceUntilLocalDate?: string | null;
};

export type TaskBucketContext = {
  /** Workspace-local today, from `localDateInTimezone(workspace.timezone)`. */
  today: string;
  timezone: string;
  occurrences?: readonly TaskOccurrenceLike[];
};

export type TaskWhenPlacement = {
  bucket: TaskWhenBucket;
  /** The date that decided the bucket: the earliest future-or-today date, or the past date that made it Past due. */
  keyDate: string | null;
  /** Why a task is Past due: a missed deadline ("Overdue 2d") or a plan or reservation that slipped ("Planned 12 Oct"). */
  pastDue: "deadline" | "slipped" | null;
  /** Present for recurring series; the occurrence decides the bucket, never the anchor date. */
  recurring: RecurringTaskStatus | null;
};

const NEXT_DAYS = 7;

type DeadlineTask = { dueLocalDate?: string | null; scheduledLocalDate?: string | null; recurrenceRule?: unknown };

/**
 * True for a recurring series with no Plan for date: its deadline is the series start (see
 * `recurrenceSeriesStart`), not a deadline the work can miss, so the series is placed by its next occurrence.
 */
export function deadlineIsSeriesAnchor(task: DeadlineTask) {
  return isRecurrenceRule(task.recurrenceRule) && !task.scheduledLocalDate;
}

/** A deadline before today that the work can still miss (never a recurring series' anchor date). */
export function hasMissedDeadline(task: DeadlineTask, today: string) {
  return Boolean(task.dueLocalDate && task.dueLocalDate < today) && !deadlineIsSeriesAnchor(task);
}

/**
 * Open work with a missed deadline. The one rule behind the D1 rail "N overdue" badge, the Tasks header and
 * the Past due "N overdue" sub-count, so the three numbers always agree.
 */
export function isOverdueTask(task: DeadlineTask & { state: string }, today: string) {
  return task.state !== "completed" && task.state !== "archived" && hasMissedDeadline(task, today);
}

type InboxCandidate = {
  state: string;
  horizon?: string | null;
  dueLocalDate?: string | null;
  scheduledLocalDate?: string | null;
  plannedStartAt?: unknown;
  plannedEndAt?: unknown;
  projectId?: string | null;
  /**
   * Inbox triage "This week" (Fable Q1): the week's first local day, with no plan day. No column holds this
   * yet (adding one is a gated schema migration), so it is optional and absent on every record today.
   */
  plannedWeekStartLocalDate?: string | null;
};

/**
 * Inbox = undecided work (owner decisions Q1/Q2, 2026-10-15). A task waits in the Inbox only until ONE
 * decision is made: any date (Plan for, reserved time or a deadline), a project, Someday, or (once the field
 * exists) a "this week" flag. Same rule for the rail badge, the Tasks header and the Inbox tab.
 */
export function isInboxTask(task: InboxCandidate) {
  return task.state !== "completed" && task.state !== "archived"
    && !task.scheduledLocalDate && !task.plannedStartAt && !task.plannedEndAt
    && !task.dueLocalDate
    && !task.projectId
    && task.horizon !== "someday"
    && !task.plannedWeekStartLocalDate;
}

/** The workspace-local day of a task's reservation, or null when it has no complete reservation. */
export function reservedLocalDate(task: Pick<BucketTask, "plannedStartAt" | "plannedEndAt">, timezone: string) {
  if (!task.plannedStartAt || !task.plannedEndAt) return null;
  return localDateForInstant(task.plannedStartAt, timezone);
}

function bucketForFutureDate(keyDate: string, today: string): TaskWhenBucket {
  if (keyDate === today) return "today";
  return keyDate <= shiftLocalDate(today, NEXT_DAYS) ? "next_7_days" : "later";
}

/**
 * Places a task by date, ignoring its lifecycle state. Rules, first match wins:
 * 1. Past due: a deadline before today, or a plan/reservation before today with no reservation today or later
 *    and no open occurrence today. A recurring series never slips on its anchor date, whether that anchor
 *    is its Plan for date or (with no Plan for) its deadline.
 * 2. Today / Next 7 days / Later: by the earliest of reservation, plan and deadline on or after today; for a
 *    recurring series, by its next occurrence (a pending materialized occurrence first, else the computed
 *    cadence day). Today's occurrence already resolved keeps the series in Today until tomorrow.
 * 3. No date: nothing dated (Inbox and Someday tasks live here), a series that ended, and a
 *    completion-anchored series with no materialized next occurrence.
 */
export function taskWhenPlacement(task: BucketTask, ctx: TaskBucketContext): TaskWhenPlacement {
  const { today } = ctx;
  const recurring = recurringTaskStatus(task, today, ctx.occurrences);
  const reserved = reservedLocalDate(task, ctx.timezone);

  if (hasMissedDeadline(task, today)) {
    // Same rule as the D1 rail badge "N overdue" (`isOverdueTask`), so the two numbers always agree.
    return { bucket: "past_due", keyDate: task.dueLocalDate!, pastDue: "deadline", recurring };
  }

  if (recurring) {
    const keyDate = recurringTaskKeyDate(recurring);
    if (keyDate) return { bucket: bucketForFutureDate(keyDate, today), keyDate, pastDue: null, recurring };
    if (recurring.kind === "resolved_today") return { bucket: "today", keyDate: today, pastDue: null, recurring };
    return { bucket: "no_date", keyDate: null, pastDue: null, recurring };
  }

  // The plan date is Plan for; a reservation stands in only when there is no Plan for (a stale reservation
  // alone still counts as slipped work). A reservation today or later always rescues a slipped plan.
  const planDate = task.scheduledLocalDate ?? reserved;
  const hasFutureReservation = Boolean(reserved && reserved >= today);
  if (planDate && planDate < today && !hasFutureReservation) return { bucket: "past_due", keyDate: planDate, pastDue: "slipped", recurring };

  const keyDate = [reserved, task.scheduledLocalDate, task.dueLocalDate]
    .filter((value): value is string => Boolean(value) && value! >= today)
    .sort()[0] ?? null;
  if (keyDate) return { bucket: bucketForFutureDate(keyDate, today), keyDate, pastDue: null, recurring };
  return { bucket: "no_date", keyDate: null, pastDue: null, recurring };
}

/** The When bucket of a task by date alone. Callers decide what to do with finished work. */
export function taskWhenBucket(task: BucketTask, ctx: TaskBucketContext): TaskWhenBucket {
  return taskWhenPlacement(task, ctx).bucket;
}

/** True when a completed task's completion falls on the workspace-local today. */
export function completedOnLocalDay(task: Pick<BucketTask, "state" | "completedAt">, ctx: Pick<TaskBucketContext, "today" | "timezone">) {
  if (task.state !== "completed" || !task.completedAt) return false;
  return localDateForInstant(task.completedAt, ctx.timezone) === ctx.today;
}

/**
 * The List section of a task, or null for archived work. A task completed today stays in its When section
 * (muted) until tomorrow so a check-off does not make the list jump; older completions go to Done.
 */
export function taskListSection(task: BucketTask, ctx: TaskBucketContext): TaskListSectionId | null {
  if (task.state === "archived") return null;
  if (task.state === "completed") return completedOnLocalDay(task, ctx) ? taskWhenBucket(task, ctx) : "done";
  return taskWhenBucket(task, ctx);
}

export type TaskWhenBucketCounts = Record<TaskWhenBucket, number> & {
  /** Open tasks with a missed deadline (`isOverdueTask`): equals the D1 rail "N overdue" badge. */
  overdue: number;
  /** Open Someday tasks; they sit in No date. */
  someday: number;
};

/** Counts open tasks per When bucket ("Past due 5 · 3 overdue", "No date 8 · 2 someday"). */
export function taskWhenBucketCounts(tasks: readonly BucketTask[], ctx: TaskBucketContext): TaskWhenBucketCounts {
  const counts: TaskWhenBucketCounts = { past_due: 0, today: 0, next_7_days: 0, later: 0, no_date: 0, overdue: 0, someday: 0 };
  for (const task of tasks) {
    if (task.state === "completed" || task.state === "archived") continue;
    const placement = taskWhenPlacement(task, ctx);
    counts[placement.bucket] += 1;
    if (placement.pastDue === "deadline") counts.overdue += 1;
    if (task.horizon === "someday") counts.someday += 1;
  }
  return counts;
}

/** Whole days a deadline is overdue (1 for yesterday), used for "Overdue 2d". */
export function overdueDays(dueLocalDate: string, today: string) {
  return Math.max(0, localDaysBetween(dueLocalDate, today));
}

const bucketRank: Record<TaskWhenBucket, number> = { past_due: 0, today: 1, next_7_days: 2, later: 3, no_date: 4 };

/**
 * Stable When order for the Status lens To do lane: bucket first, then the caller's existing order. Returns
 * the ordered tasks and the dividers ("Today", "Next 7 days", …) shown before each group.
 */
export function groupTasksByWhen<TTask extends BucketTask>(tasks: readonly TTask[], ctx: TaskBucketContext) {
  const placed = tasks.map((task, index) => ({ task, index, bucket: taskWhenBucket(task, ctx) }));
  placed.sort((left, right) => bucketRank[left.bucket] - bucketRank[right.bucket] || left.index - right.index);
  const groups: Array<{ bucket: TaskWhenBucket; label: string; tasks: TTask[] }> = [];
  for (const item of placed) {
    const current = groups[groups.length - 1];
    if (current?.bucket === item.bucket) current.tasks.push(item.task);
    else groups.push({ bucket: item.bucket, label: taskWhenBuckets.find(bucket => bucket.id === item.bucket)!.label, tasks: [item.task] });
  }
  return groups;
}
