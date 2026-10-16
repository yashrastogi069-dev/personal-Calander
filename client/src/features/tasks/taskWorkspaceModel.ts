// Pure workspace model for the D3 Tasks page (spec §3, §10): view rows, quick-filter and facet filters with
// live counts, sort, header summary, When-grouped List sections and saved view configuration v2.
// TaskWorkspace.tsx still carries the v1 copies of inboxTasks/taskRowsForWorkspace/adaptSavedTaskView until
// the D3 container wiring switches to this module. Tasks T2a adds the calm List groups (Q7) and the per-device
// Group by memory at the end of this file.

import type { CanonicalTask } from "@shared/canonicalTask";
import { dailyCapacityForecast, deadlineRiskForTask } from "@shared/planningForecast";
import {
  completedOnLocalDay,
  isInboxTask,
  taskListSection,
  taskWhenBucketCounts,
  taskWhenBuckets,
  taskWhenPlacement,
  type TaskBucketContext,
  type TaskListSectionId,
  type TaskWhenBucket,
} from "@shared/taskBuckets";
import type { TaskBoardFilter } from "@shared/taskBoardUrl";
import { groupTasksByCategory, groupTasksByProject, groupTasksByWhen, type GroupableTask, type TaskGroup } from "@shared/taskListGroups";
import type { TaskOccurrenceLike } from "@shared/taskRecurrence";
import type { WeekStartsOn } from "@shared/taskWeekBoard";

/** Tabs Inbox · List · Board, then the quiet Archive (Q8 removed the Views tab, Q9 the separate archive page). */
export type TaskWorkspaceView = "inbox" | "list" | "board" | "archive";
export type TaskWorkspaceSort = "manual" | "priority" | "due" | "scheduled" | "created";
/** "week" is the T1 Week board (Unscheduled · Mon…Sun, Q3); "when" is the legacy bucket lens. */
export type TaskBoardLens = "status" | "when" | "week";
/** List "Group by" switch (Q7). */
export type TaskListGroupBy = "when" | "project" | "category";
export type TaskPriority = "none" | "low" | "medium" | "high" | "critical";

export const taskPriorities: readonly TaskPriority[] = ["critical", "high", "medium", "low", "none"];
export const taskQuickFilters: ReadonlyArray<{ id: TaskBoardFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "today", label: "Today" },
  { id: "deadline_risk", label: "At risk" },
];
export const taskSortOptions: ReadonlyArray<{ id: TaskWorkspaceSort; label: string }> = [
  { id: "manual", label: "Manual" },
  { id: "priority", label: "Priority" },
  { id: "due", label: "Deadline" },
  { id: "scheduled", label: "Plan for" },
  { id: "created", label: "Newest" },
];

export type WorkspaceTask = Pick<CanonicalTask, "id" | "state" | "title"> & Partial<Pick<CanonicalTask,
  | "description" | "priority" | "horizon" | "sortOrder" | "dueLocalDate" | "scheduledLocalDate" | "plannedStartAt" | "plannedEndAt"
  | "createdAt" | "completedAt" | "categoryId" | "projectId" | "estimateMinutes" | "recurrenceRule" | "recurrenceAnchor" | "recurrenceUntilLocalDate"
>>;

/** Filter popover facets. Empty arrays mean "any". */
export type TaskFacetFilters = {
  categoryIds: string[];
  projectIds: string[];
  priorities: TaskPriority[];
};

export type TaskWorkspaceFilterState = TaskFacetFilters & {
  view: TaskWorkspaceView;
  query: string;
  filter: TaskBoardFilter;
  sort: TaskWorkspaceSort;
};

export const emptyTaskFacets: TaskFacetFilters = { categoryIds: [], projectIds: [], priorities: [] };

function isOpen(task: { state: string }) {
  return task.state !== "completed" && task.state !== "archived";
}

/**
 * Inbox = undecided work: open, with no date of any kind (Plan for, reserved time, deadline), no project and
 * not Someday (owner decisions Q1/Q2, 2026-10-15). Same shared rule as the rail badge.
 */
export function inboxTasks<TTask extends WorkspaceTask>(tasks: readonly TTask[]): TTask[] {
  return tasks.filter(isInboxTask);
}

export function tasksForWorkspaceView<TTask extends WorkspaceTask>(tasks: readonly TTask[], view: TaskWorkspaceView): TTask[] {
  if (view === "inbox") return inboxTasks(tasks);
  if (view === "archive") return tasks.filter(task => task.state === "archived");
  return tasks.filter(task => task.state !== "archived");
}

/** Case-insensitive match on title and description. */
export function matchesTaskQuery(task: WorkspaceTask, query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return true;
  return String(task.title ?? "").toLocaleLowerCase().includes(normalized)
    || String(task.description ?? "").toLocaleLowerCase().includes(normalized);
}

/** Today = planned or due today, reserved today, or a recurring occurrence today (When bucket Today). */
export function isTaskForToday(task: WorkspaceTask, ctx: TaskBucketContext) {
  if (task.scheduledLocalDate === ctx.today || task.dueLocalDate === ctx.today) return true;
  return taskWhenPlacement(task, ctx).bucket === "today";
}

export function matchesQuickFilter(task: WorkspaceTask, filter: TaskBoardFilter, ctx: TaskBucketContext) {
  if (filter === "open") return isOpen(task);
  if (filter === "today") return isTaskForToday(task, ctx);
  if (filter === "deadline_risk") return deadlineRiskForTask(task, ctx.today) !== null;
  return true;
}

export function matchesTaskFacets(task: WorkspaceTask, facets: TaskFacetFilters) {
  if (facets.categoryIds.length && !(task.categoryId && facets.categoryIds.includes(task.categoryId))) return false;
  if (facets.projectIds.length && !(task.projectId && facets.projectIds.includes(task.projectId))) return false;
  if (facets.priorities.length && !facets.priorities.includes(((task.priority ?? "none") as TaskPriority))) return false;
  return true;
}

const priorityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };

export function taskTieBreak(left: WorkspaceTask, right: WorkspaceTask) {
  return (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0)
    || String(left.title ?? "").localeCompare(String(right.title ?? ""))
    || String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

/** Same orderings as the v1 workspace; Manual is sortOrder then title then id. */
export function sortWorkspaceTasks<TTask extends WorkspaceTask>(tasks: readonly TTask[], sort: TaskWorkspaceSort): TTask[] {
  return [...tasks].sort((left, right) => {
    if (sort === "priority") return (priorityRank[left.priority ?? ""] ?? 5) - (priorityRank[right.priority ?? ""] ?? 5) || taskTieBreak(left, right);
    if (sort === "due") return (left.dueLocalDate ?? "9999-12-31").localeCompare(right.dueLocalDate ?? "9999-12-31") || taskTieBreak(left, right);
    if (sort === "scheduled") return (left.scheduledLocalDate ?? "9999-12-31").localeCompare(right.scheduledLocalDate ?? "9999-12-31") || taskTieBreak(left, right);
    if (sort === "created") return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime() || taskTieBreak(left, right);
    return taskTieBreak(left, right);
  });
}

function filtersApply(view: TaskWorkspaceView) {
  return view === "list" || view === "board";
}

/** The rows a view shows: view base → search → quick filter and facets (List/Board only) → sort. */
export function taskRowsForWorkspace<TTask extends WorkspaceTask>(tasks: readonly TTask[], state: TaskWorkspaceFilterState, ctx: TaskBucketContext): TTask[] {
  const applies = filtersApply(state.view);
  const rows = tasksForWorkspaceView(tasks, state.view).filter(task =>
    matchesTaskQuery(task, state.query)
    && (!applies || (matchesQuickFilter(task, state.filter, ctx) && matchesTaskFacets(task, state))),
  );
  return sortWorkspaceTasks(rows, state.sort);
}

/** Live count on each quick-filter chip, with the search and facets applied (the chip itself varies). */
export function quickFilterCounts(tasks: readonly WorkspaceTask[], state: Pick<TaskWorkspaceFilterState, "query"> & TaskFacetFilters, ctx: TaskBucketContext): Record<TaskBoardFilter, number> {
  const base = tasksForWorkspaceView(tasks, "list").filter(task => matchesTaskQuery(task, state.query) && matchesTaskFacets(task, state));
  return {
    all: base.length,
    open: base.filter(task => matchesQuickFilter(task, "open", ctx)).length,
    today: base.filter(task => matchesQuickFilter(task, "today", ctx)).length,
    deadline_risk: base.filter(task => matchesQuickFilter(task, "deadline_risk", ctx)).length,
  };
}

export function hasActiveTaskFilters(state: Pick<TaskWorkspaceFilterState, "query" | "filter"> & TaskFacetFilters) {
  return Boolean(state.query.trim()) || state.filter !== "all" || state.categoryIds.length > 0 || state.projectIds.length > 0 || state.priorities.length > 0;
}

/** Clears search, quick filter and facets; sort is kept ("Clear filters" keeps sort, §6). */
export function clearedTaskFilters(): Pick<TaskWorkspaceFilterState, "query" | "filter"> & TaskFacetFilters {
  return { query: "", filter: "all", categoryIds: [], projectIds: [], priorities: [] };
}

export type TaskHeaderSummary = {
  open: number;
  /** Equals the D1 rail badge: open tasks with a deadline before today. */
  overdue: number;
  forToday: number;
  inbox: number;
};

/** "36 open · 3 overdue · 13 for today", from real task data only. */
export function taskHeaderSummary(tasks: readonly WorkspaceTask[], ctx: TaskBucketContext): TaskHeaderSummary {
  const open = tasks.filter(isOpen);
  const counts = taskWhenBucketCounts(open, ctx);
  return { open: open.length, overdue: counts.overdue, forToday: counts.today, inbox: inboxTasks(tasks).length };
}

export function taskHeaderSummaryText(summary: TaskHeaderSummary) {
  const parts = [`${summary.open} open`];
  if (summary.overdue) parts.push(`${summary.overdue} overdue`);
  if (summary.forToday) parts.push(`${summary.forToday} for today`);
  return parts.join(" · ");
}

export type TaskListSection<TTask> = {
  id: TaskListSectionId;
  label: string;
  /** Rows in the incoming order (already sorted by the caller). */
  tasks: TTask[];
  /** Open tasks in the section (Done: completed tasks). */
  count: number;
  /** Past due only: how many of `count` have a missed deadline ("Past due 5 · 3 overdue"). */
  overdueCount: number;
  /** No date only: Someday tasks ("No date 8 · 2 someday"). */
  somedayCount: number;
  /** Today only: real planned minutes for today (`dailyCapacityForecast`), and tasks completed today. */
  plannedMinutes: number | null;
  doneTodayCount: number;
};

/**
 * Groups List rows by When, then a Done section last. Empty When sections are omitted; Done is included
 * whenever it has rows (the UI collapses it). Completed-today rows stay in their When section.
 */
export function taskListSections<TTask extends WorkspaceTask>(rows: readonly TTask[], allTasks: readonly WorkspaceTask[], ctx: TaskBucketContext): TaskListSection<TTask>[] {
  const order: TaskListSectionId[] = [...taskWhenBuckets.map(bucket => bucket.id), "done"];
  const grouped = new Map<TaskListSectionId, TTask[]>(order.map(id => [id, []]));
  for (const task of rows) {
    const section = taskListSection(task, ctx);
    if (section) grouped.get(section)!.push(task);
  }
  return order.flatMap(id => {
    const tasks = grouped.get(id)!;
    if (!tasks.length) return [];
    const open = tasks.filter(isOpen);
    const placements = id === "done" ? [] : open.map(task => ({ task, placement: taskWhenPlacement(task, ctx) }));
    return [{
      id,
      label: id === "done" ? "Done" : taskWhenBuckets.find(bucket => bucket.id === id)!.label,
      tasks,
      count: id === "done" ? tasks.length : open.length,
      overdueCount: id === "past_due" ? placements.filter(item => item.placement.pastDue === "deadline").length : 0,
      somedayCount: id === "no_date" ? open.filter(task => task.horizon === "someday").length : 0,
      plannedMinutes: id === "today" ? dailyCapacityForecast(allTasks.map(forecastTask), ctx.today, 0).plannedMinutes : null,
      doneTodayCount: id === "done" ? 0 : tasks.filter(task => completedOnLocalDay(task, ctx)).length,
    }];
  });
}

function forecastTask(task: WorkspaceTask) {
  return {
    state: task.state,
    dueLocalDate: task.dueLocalDate ?? null,
    scheduledLocalDate: task.scheduledLocalDate ?? null,
    plannedStartAt: (task.plannedStartAt ?? null) as Date | string | null,
    estimateMinutes: task.estimateMinutes ?? null,
  };
}

// Saved views (configuration v2, §10). `configuration` is jsonb (drizzle/schema.ts savedViews.configuration,
// validated as `z.record(z.string(), z.unknown())` by planner.savedView.create/update), so new keys such as
// `group` (Q8: filter + group + sort + layout) are not a schema change.

function parseLens(value: unknown): TaskBoardLens {
  return value === "when" || value === "week" ? value : "status";
}

function parseGroup(value: unknown): TaskListGroupBy {
  return value === "project" || value === "category" ? value : "when";
}

export type TaskSavedViewConfig = {
  version: 2;
  /** Layout: List or Board. */
  view: "list" | "board";
  lens: TaskBoardLens;
  /** List grouping (Q7/Q8). Absent in older configurations, read as "when". */
  group: TaskListGroupBy;
  query: string;
  filter: TaskBoardFilter;
  sort: TaskWorkspaceSort;
  categoryIds: string[];
  projectIds: string[];
  priorities: TaskPriority[];
};

/** `group` is optional so callers that predate the List group switch keep compiling (read as "when"). */
export type TaskSavedViewState = Omit<TaskSavedViewConfig, "version" | "group"> & { group?: TaskListGroupBy };

export const defaultTaskSavedView: TaskSavedViewConfig = {
  version: 2, view: "list", lens: "status", group: "when", query: "", filter: "all", sort: "manual", categoryIds: [], projectIds: [], priorities: [],
};

function stringList(value: unknown) {
  return Array.isArray(value) ? Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))) : [];
}

/** Reads v1 ({filter, sort, query}, including the legacy "risk") and v2 configurations; unknown values fall back. */
export function adaptSavedTaskView(configuration: unknown): TaskSavedViewConfig {
  const config = configuration && typeof configuration === "object" ? configuration as Record<string, unknown> : {};
  const requestedFilter = config.filter;
  const filter: TaskBoardFilter = requestedFilter === "risk"
    ? "deadline_risk"
    : requestedFilter === "open" || requestedFilter === "today" || requestedFilter === "deadline_risk" || requestedFilter === "all"
      ? requestedFilter
      : "all";
  const sort = taskSortOptions.some(option => option.id === config.sort) ? config.sort as TaskWorkspaceSort : "manual";
  return {
    version: 2,
    view: config.view === "board" ? "board" : "list",
    lens: parseLens(config.lens),
    group: parseGroup(config.group),
    query: typeof config.query === "string" ? config.query : "",
    filter,
    sort,
    categoryIds: stringList(config.categoryIds),
    projectIds: stringList(config.projectIds),
    priorities: stringList(config.priorities).filter((item): item is TaskPriority => (taskPriorities as readonly string[]).includes(item)),
  };
}

/** The configuration written by `planner.savedView.create/update` for the current state. */
export function savedTaskViewConfiguration(state: TaskSavedViewState): TaskSavedViewConfig {
  return adaptSavedTaskView({ ...state, query: state.query.trim() });
}

function sameSet(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every(item => right.includes(item));
}

/** "Save view" appears only when the current state differs from the applied saved view (or none is applied). */
export function savedTaskViewDiffers(state: TaskSavedViewState, applied: unknown | null) {
  const current = savedTaskViewConfiguration(state);
  if (applied === null || applied === undefined) return hasActiveTaskFilters(current) || current.sort !== "manual" || current.view !== "list" || current.lens !== "status" || current.group !== "when";
  const saved = adaptSavedTaskView(applied);
  return current.view !== saved.view || current.lens !== saved.lens || current.group !== saved.group || current.query !== saved.query.trim() || current.filter !== saved.filter
    || current.sort !== saved.sort || !sameSet(current.categoryIds, saved.categoryIds) || !sameSet(current.projectIds, saved.projectIds)
    || !sameSet(current.priorities, saved.priorities);
}

/** Reusing a name (case-insensitive, trimmed) updates that view instead of creating a duplicate. */
export function findSavedTaskViewByName<TView extends { name: string; viewType?: string }>(views: readonly TView[], name: string) {
  const wanted = name.trim().toLocaleLowerCase();
  if (!wanted) return null;
  return views.find(view => (view.viewType ?? "tasks") === "tasks" && view.name.trim().toLocaleLowerCase() === wanted) ?? null;
}

/** Pinned first, then by name, matching the server's `ORDER BY isPinned DESC, name`. */
export function orderSavedTaskViews<TView extends { name: string; isPinned?: number | boolean | null; viewType?: string }>(views: readonly TView[]) {
  return views
    .filter(view => (view.viewType ?? "tasks") === "tasks")
    .slice()
    .sort((left, right) => Number(Boolean(right.isPinned)) - Number(Boolean(left.isPinned)) || left.name.localeCompare(right.name));
}

const priorityLabels: Record<TaskPriority, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", none: "No priority" };

/** Tile summary pills: "Board · When · Work · High". Unknown ids (deleted records) are skipped. */
export function savedTaskViewSummary(
  configuration: unknown,
  names: { categories?: ReadonlyMap<string, string>; projects?: ReadonlyMap<string, string> } = {},
) {
  const config = adaptSavedTaskView(configuration);
  const pills: string[] = [config.view === "board" ? "Board" : "List"];
  if (config.view === "board") pills.push(config.lens === "when" ? "When" : config.lens === "week" ? "Week" : "Status");
  if (config.view === "list" && config.group !== "when") pills.push(config.group === "project" ? "By project" : "By category");
  if (config.filter !== "all") pills.push(taskQuickFilters.find(item => item.id === config.filter)!.label);
  if (config.query.trim()) pills.push(`"${config.query.trim()}"`);
  for (const id of config.categoryIds) { const name = names.categories?.get(id); if (name) pills.push(name); }
  for (const id of config.projectIds) { const name = names.projects?.get(id); if (name) pills.push(name); }
  for (const priority of config.priorities) pills.push(priorityLabels[priority]);
  if (config.sort !== "manual") pills.push(`By ${taskSortOptions.find(item => item.id === config.sort)!.label.toLocaleLowerCase()}`);
  return pills;
}

/** Live row count for a saved view tile. */
export function savedTaskViewCount(tasks: readonly WorkspaceTask[], configuration: unknown, ctx: TaskBucketContext) {
  return taskRowsForWorkspace(tasks, adaptSavedTaskView(configuration), ctx).length;
}

// URL persistence for the lens and facets (the query/filter keep their v1 params in shared/taskBoardUrl.ts).

const LENS_PARAM = "taskLens";
const CATEGORY_PARAM = "taskCat";
const PROJECT_PARAM = "taskProject";
const PRIORITY_PARAM = "taskPriority";

function listParam(params: URLSearchParams, key: string) {
  return (params.get(key) ?? "").split(",").map(item => item.trim()).filter(Boolean);
}

export function taskBoardLensAndFacetsFromSearch(search: string): TaskFacetFilters & { lens: TaskBoardLens } {
  const params = new URLSearchParams(search);
  return {
    lens: parseLens(params.get(LENS_PARAM)),
    categoryIds: Array.from(new Set(listParam(params, CATEGORY_PARAM))),
    projectIds: Array.from(new Set(listParam(params, PROJECT_PARAM))),
    priorities: Array.from(new Set(listParam(params, PRIORITY_PARAM))).filter((item): item is TaskPriority => (taskPriorities as readonly string[]).includes(item)),
  };
}

export function searchWithTaskBoardLensAndFacets(search: string, value: TaskFacetFilters & { lens: TaskBoardLens }) {
  const params = new URLSearchParams(search);
  if (value.lens !== "status") params.set(LENS_PARAM, value.lens); else params.delete(LENS_PARAM);
  const write = (key: string, items: readonly string[]) => { if (items.length) params.set(key, items.join(",")); else params.delete(key); };
  write(CATEGORY_PARAM, value.categoryIds);
  write(PROJECT_PARAM, value.projectIds);
  write(PRIORITY_PARAM, value.priorities);
  return params.toString();
}

// ---------- Tasks T2a: calm List groups (Q7) ----------

export type TaskListGroupSources = {
  today: string;
  timezone: string;
  occurrences?: readonly TaskOccurrenceLike[];
  weekStartsOn?: WeekStartsOn;
  /** Ids ticked this session: they stay dimmed in their group until reload or midnight (Fable Q2). */
  keepInPlaceIds?: ReadonlySet<string>;
  projects?: readonly { id: string; title?: string | null; name?: string | null; categoryId?: string | null; state?: string | null }[];
  categories?: readonly { id: string; name: string }[];
};

/**
 * The List rows grouped by When, Project or Category, through the T1 selectors. Empty groups are dropped, so
 * the UI only draws what has rows. Undecided Inbox work is the caller's to leave out (the List shows decided
 * work only, as the approved prototype does).
 */
export function taskListGroups<TTask extends GroupableTask>(rows: readonly TTask[], groupBy: TaskListGroupBy, sources: TaskListGroupSources): TaskGroup<TTask>[] {
  const options = { occurrences: sources.occurrences, weekStartsOn: sources.weekStartsOn, keepInPlaceIds: sources.keepInPlaceIds };
  const projects = (sources.projects ?? [])
    .filter(project => project.state !== "archived")
    .map(project => ({ id: String(project.id), name: String(project.title ?? project.name ?? "Project"), categoryId: project.categoryId ?? null }));
  const categories = (sources.categories ?? []).map(category => ({ id: String(category.id), name: String(category.name) }));
  const groups = groupBy === "project"
    ? groupTasksByProject(rows, projects, sources.today, sources.timezone, options)
    : groupBy === "category"
      ? groupTasksByCategory(rows, categories, sources.today, sources.timezone, { ...options, projects })
      : groupTasksByWhen(rows, sources.today, sources.timezone, options);
  return groups.filter(group => group.tasks.length > 0);
}

/** Group by is remembered per device (Q7), stored with the same values as the saved-view `group` key (Q8). */
export const TASK_LIST_GROUP_STORAGE_KEY = "pc.tasks.listGroup";

type GroupStorage = Pick<Storage, "getItem" | "setItem">;

export function readStoredTaskListGroup(storage: Pick<GroupStorage, "getItem"> | null | undefined): TaskListGroupBy {
  try {
    return adaptSavedTaskView({ group: storage?.getItem(TASK_LIST_GROUP_STORAGE_KEY) }).group;
  } catch {
    return "when";
  }
}

export function storeTaskListGroup(storage: Pick<GroupStorage, "setItem"> | null | undefined, group: TaskListGroupBy) {
  try {
    storage?.setItem(TASK_LIST_GROUP_STORAGE_KEY, savedTaskViewConfiguration({ ...defaultTaskSavedView, group }).group);
  } catch {
    // Private windows can refuse storage; the choice still holds for this session.
  }
}

export type { TaskBoardFilter, TaskWhenBucket };
