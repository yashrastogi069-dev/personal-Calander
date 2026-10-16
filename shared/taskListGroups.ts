// Tasks redesign T1: List grouping (owner decision Q7), the "Done today" display rule (Fable Q2) and the one
// Archive with Completed | Archived (Q9). Pure selectors; every date is a workspace-local day.
//
// Not to be confused with `groupTasksByWhen` in taskBuckets.ts, which orders the legacy Status-lens To do lane.

import { completedOnLocalDay, taskWhenPlacement, type BucketTask, type TaskBucketContext } from "./taskBuckets";
import { dayMonthLabel, localDateForInstant } from "./taskDateLabels";
import { shiftLocalDate, type TaskOccurrenceLike } from "./taskRecurrence";
import { localWeekStart, type WeekStartsOn } from "./taskWeekBoard";

export type GroupableTask = BucketTask & {
  title?: string | null;
  description?: string | null;
  projectId?: string | null;
  categoryId?: string | null;
  estimateMinutes?: number | null;
  archivedAt?: Date | string | null;
  updatedAt?: Date | string | null;
};

export const taskWhenGroups = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "this_week", label: "This week" },
  { id: "later", label: "Later" },
  { id: "someday", label: "Someday" },
  { id: "no_date", label: "No date" },
  { id: "done_today", label: "Done today" },
] as const;

export type TaskWhenGroupId = (typeof taskWhenGroups)[number]["id"];

export type TaskGroup<TTask> = {
  id: string;
  label: string;
  tasks: TTask[];
  /** Open tasks (for "Done today": the finished tasks). */
  count: number;
  /** Total estimate of the counted tasks, in minutes. */
  estimateMinutes: number;
  /** "Done today" sits collapsed at the bottom (Q7). */
  collapsedByDefault: boolean;
};

export type TaskGroupOptions = {
  occurrences?: readonly TaskOccurrenceLike[];
  /** `workspaces.weekStartsOn` (0 = Sunday); default Monday. "This week" ends on the week's last day. */
  weekStartsOn?: WeekStartsOn;
  /**
   * Tasks ticked during this session (Fable Q2): they stay dimmed in their group until the next page load
   * or local midnight, so a mis-tick is easy to spot. Every other task completed today sits in Done today.
   */
  keepInPlaceIds?: ReadonlySet<string>;
};

function isOpen(task: { state: string }) {
  return task.state !== "completed" && task.state !== "archived";
}

function minutes(tasks: readonly GroupableTask[]) {
  return tasks.reduce((sum, task) => sum + (Number(task.estimateMinutes) || 0), 0);
}

/**
 * Where a finished task shows today. Display rule only (Q9, Fable Q2): nothing is moved or deleted.
 * - "in_place": ticked this session, so it stays dimmed in its group until reload or local midnight.
 * - "done_today": completed earlier today; sits in the collapsed Done today group.
 * - "archive": completed before today; it lives in Archive › Completed.
 * - null: not completed.
 */
export function completedTaskPlacement(task: GroupableTask, ctx: Pick<TaskBucketContext, "today" | "timezone">, keepInPlaceIds?: ReadonlySet<string>) {
  if (task.state !== "completed") return null;
  if (!completedOnLocalDay(task, ctx)) return "archive" as const;
  return keepInPlaceIds?.has(task.id) ? "in_place" as const : "done_today" as const;
}

/** The When group of an open (or kept-in-place) task. */
export function taskWhenGroup(task: GroupableTask, ctx: TaskBucketContext & { weekStartsOn?: WeekStartsOn }): Exclude<TaskWhenGroupId, "done_today"> {
  if (task.horizon === "someday") return "someday";
  const placement = taskWhenPlacement(task, ctx);
  if (placement.bucket === "past_due") return "overdue";
  const weekStart = localWeekStart(ctx.today, ctx.weekStartsOn ?? 1);
  const weekEnd = shiftLocalDate(weekStart, 6);
  if (!placement.keyDate) {
    // Inbox triage "This week" (Fable Q1) once the week flag exists: this week, no plan day.
    if (task.plannedWeekStartLocalDate === weekStart) return "this_week";
    if (task.plannedWeekStartLocalDate && task.plannedWeekStartLocalDate > weekStart) return "later";
    if (task.plannedWeekStartLocalDate && task.plannedWeekStartLocalDate < weekStart) return "overdue";
    return "no_date";
  }
  if (placement.keyDate === ctx.today) return "today";
  return placement.keyDate <= weekEnd ? "this_week" : "later";
}

/**
 * List groups by When (Q7): Overdue · Today · This week · Later · Someday · No date, then the collapsed
 * "Done today". All seven groups are returned in that order (the UI hides empty ones). Archived work and
 * work completed before today are left out (they live in Archive). Rows keep the incoming order.
 */
export function groupTasksByWhen<TTask extends GroupableTask>(tasks: readonly TTask[], today: string, timezone: string, options: TaskGroupOptions = {}): TaskGroup<TTask>[] {
  const ctx = { today, timezone, occurrences: options.occurrences, weekStartsOn: options.weekStartsOn };
  const grouped = new Map<TaskWhenGroupId, TTask[]>(taskWhenGroups.map(group => [group.id, []]));
  for (const task of tasks) {
    if (task.state === "archived") continue;
    const done = completedTaskPlacement(task, ctx, options.keepInPlaceIds);
    if (done === "archive") continue;
    grouped.get(done === "done_today" ? "done_today" : taskWhenGroup(task, ctx))!.push(task);
  }
  return taskWhenGroups.map(group => {
    const rows = grouped.get(group.id)!;
    const counted = group.id === "done_today" ? rows : rows.filter(isOpen);
    return { id: group.id, label: group.label, tasks: rows, count: counted.length, estimateMinutes: minutes(counted), collapsedByDefault: group.id === "done_today" };
  });
}

export type GroupRecord = { id: string; name: string; categoryId?: string | null };

function groupByKey<TTask extends GroupableTask>(
  tasks: readonly TTask[],
  today: string,
  timezone: string,
  options: TaskGroupOptions,
  keyOf: (task: TTask) => string | null,
  records: readonly GroupRecord[],
  noneLabel: string,
): TaskGroup<TTask>[] {
  const ctx = { today, timezone };
  const keyed = new Map<string, TTask[]>();
  const doneToday: TTask[] = [];
  for (const task of tasks) {
    if (task.state === "archived") continue;
    const done = completedTaskPlacement(task, ctx, options.keepInPlaceIds);
    if (done === "archive") continue;
    if (done === "done_today") { doneToday.push(task); continue; }
    const key = keyOf(task) ?? "";
    keyed.set(key, [...(keyed.get(key) ?? []), task]);
  }
  const known = new Set(records.map(record => record.id));
  const ordered: Array<{ id: string; label: string }> = [
    ...records.map(record => ({ id: record.id, label: record.name })),
    // A task pointing at a record the caller did not pass (deleted, not loaded) still shows, under its id.
    ...Array.from(keyed.keys()).filter(key => key && !known.has(key)).map(key => ({ id: key, label: key })),
    { id: "", label: noneLabel },
  ];
  const groups = ordered.map(({ id, label }) => {
    const rows = keyed.get(id) ?? [];
    const open = rows.filter(isOpen);
    return { id: id || "none", label, tasks: rows, count: open.length, estimateMinutes: minutes(open), collapsedByDefault: false };
  });
  groups.push({ id: "done_today", label: "Done today", tasks: doneToday, count: doneToday.length, estimateMinutes: minutes(doneToday), collapsedByDefault: true });
  return groups;
}

/** "Group by: Project" (Q7): one group per project in the given order, then No project, then Done today. */
export function groupTasksByProject<TTask extends GroupableTask>(tasks: readonly TTask[], projects: readonly GroupRecord[], today: string, timezone: string, options: TaskGroupOptions = {}) {
  return groupByKey(tasks, today, timezone, options, task => task.projectId ?? null, projects, "No project");
}

/**
 * "Group by: Category" (Q7): a task's own category, else its project's category (as the category dot does),
 * then No category, then Done today.
 */
export function groupTasksByCategory<TTask extends GroupableTask>(
  tasks: readonly TTask[],
  categories: readonly GroupRecord[],
  today: string,
  timezone: string,
  options: TaskGroupOptions & { projects?: readonly GroupRecord[] } = {},
) {
  const projectCategory = new Map((options.projects ?? []).map(project => [project.id, project.categoryId ?? null]));
  return groupByKey(tasks, today, timezone, options, task => task.categoryId ?? (task.projectId ? projectCategory.get(task.projectId) ?? null : null), categories, "No category");
}

// ---------- Archive (Q9): Completed | Archived ----------

function matchesQuery(task: GroupableTask, query: string | undefined) {
  const wanted = (query ?? "").trim().toLocaleLowerCase();
  if (!wanted) return true;
  return String(task.title ?? "").toLocaleLowerCase().includes(wanted) || String(task.description ?? "").toLocaleLowerCase().includes(wanted);
}

function instantMs(value: Date | string | null | undefined) {
  if (!value) return 0;
  const ms = (value instanceof Date ? value : new Date(value)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export type CompletedWeek<TTask> = {
  weekStart: string;
  weekEnd: string;
  /** "This week", "Last week" or "5 Oct – 11 Oct". */
  label: string;
  /** Newest completion first. */
  tasks: TTask[];
  count: number;
  estimateMinutes: number;
};

/**
 * Archive › Completed (Q9): work finished before today, grouped by the week it was finished in (newest week
 * first), with counts and total time, filtered by an optional search. Work finished today is not here yet:
 * it stays in the List until local midnight (display rule only).
 */
export function completedArchive<TTask extends GroupableTask>(
  tasks: readonly TTask[],
  today: string,
  options: { timezone: string; weekStartsOn?: WeekStartsOn; query?: string },
): CompletedWeek<TTask>[] {
  const thisWeek = localWeekStart(today, options.weekStartsOn ?? 1);
  const weeks = new Map<string, TTask[]>();
  for (const task of tasks) {
    if (task.state !== "completed" || !task.completedAt) continue;
    const day = localDateForInstant(task.completedAt, options.timezone);
    if (!day || day >= today || !matchesQuery(task, options.query)) continue;
    const week = localWeekStart(day, options.weekStartsOn ?? 1);
    weeks.set(week, [...(weeks.get(week) ?? []), task]);
  }
  return Array.from(weeks.keys()).sort().reverse().map(weekStart => {
    const rows = weeks.get(weekStart)!.slice().sort((left, right) => instantMs(right.completedAt) - instantMs(left.completedAt));
    const weekEnd = shiftLocalDate(weekStart, 6);
    const label = weekStart === thisWeek ? "This week" : weekStart === shiftLocalDate(thisWeek, -7) ? "Last week" : `${dayMonthLabel(weekStart)} – ${dayMonthLabel(weekEnd)}`;
    return { weekStart, weekEnd, label, tasks: rows, count: rows.length, estimateMinutes: minutes(rows) };
  });
}

/** Archive › Archived (Q9): put away without doing it, newest first (archivedAt, else updatedAt). */
export function archivedList<TTask extends GroupableTask>(tasks: readonly TTask[], query?: string): TTask[] {
  return tasks
    .filter(task => task.state === "archived" && matchesQuery(task, query))
    .sort((left, right) => instantMs(right.archivedAt ?? right.updatedAt) - instantMs(left.archivedAt ?? left.updatedAt));
}
