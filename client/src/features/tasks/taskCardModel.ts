// Pure view model for the Tasks card (Board) and row (List): spec D3 §5.1. The UI components take only
// this model plus callbacks, never raw snapshot data, so both builders share one source of dates and rules.

import { resolveCategoryTones, type ToneOrNeutral } from "@/design/categoryTone";
import { canonicalTaskPresentation, recurringOccurrenceLabel, type CanonicalTask } from "@shared/canonicalTask";
import { dependencyExecutionState, type DependencyEdge } from "@shared/dependencyPolicy";
import { deadlineRiskForTask } from "@shared/planningForecast";
import { overdueDays, reservedLocalDate } from "@shared/taskBuckets";
import { dayMonthLabel, localDateForInstant, localTimeLabel, weekdayDayLabel, weekdayDayMonthLabel, weekdayLabel } from "@shared/taskDateLabels";
import { taskCompletionCheck, type TaskDropContext, type TaskDropSort } from "@shared/taskDrop";
import { recurrenceCadenceLabel, recurringTaskStatus, shiftLocalDate, type TaskOccurrenceLike } from "@shared/taskRecurrence";

type PillExtras = { accessibleLabel?: string };

export type TaskDatePill =
  | ({ kind: "overdue"; label: string; tone: "off" } & PillExtras) // "Overdue 2d"
  | ({ kind: "slipped"; label: string; tone: "risk" } & PillExtras) // "Planned 12 Oct"
  | ({ kind: "reserved"; label: string; tone: "accent" } & PillExtras) // "Today 09:15-10:30" | "Fri 16 · 09:15"
  | ({ kind: "occurrence"; label: string; tone: "accent" | "neutral" } & PillExtras) // "Today" | "Next Fri 16 Oct" | "Done today"
  | ({ kind: "plan"; label: string; tone: "accent" | "neutral" } & PillExtras) // "Today" | "Tomorrow" | "Fri 16 Oct"
  | ({ kind: "due"; label: string; tone: "risk" | "neutral" } & PillExtras); // "Due today" | "Due Fri, not planned" | "Due 20 Oct"

/** What the check button does. Recurring series resolve today's occurrence instead of completing the series. */
export type TaskCheckAction =
  | { kind: "complete" }
  | { kind: "resolve_occurrence"; occurrenceId: string; expectedVersion: number }
  | { kind: "reopen" }
  | { kind: "none" };

export type TaskCardModel = {
  id: string;
  version: number;
  title: string;
  state: string;
  isComplete: boolean;
  tone: ToneOrNeutral;
  categoryName: string | null;
  context: { kind: "project" | "goal"; title: string } | null;
  /** low/medium/none render nothing. */
  priority: "high" | "critical" | null;
  /** Max 2: plan-or-reserved-or-occurrence, then deadline. */
  dates: TaskDatePill[];
  estimateMinutes: number | null;
  subtasks: { done: number; total: number } | null;
  /** Hard dependencies only. */
  waitingOn: number;
  blocks: number;
  /** "Daily" | "Weekly" | "Every 2 weeks" | "Monthly". */
  recurring: { cadence: string } | null;
  someday: boolean;
  pending: boolean;
  conflictCount: number;
  /** R1-R3 pre-check for the check button and the Done lane. Null when the task can be completed. */
  completionBlock: { reason: string; action?: "open_plan" | "open_detail" } | null;
  /** D4 fills this; D3 renders nothing. */
  why: null;
  // Additive to the §5.1 contract:
  /** "Done today" | "Done 14 Oct" for finished work (the Done lane footer). */
  completedLabel: string | null;
  /** Checked state and the write the check performs. */
  check: { checked: boolean; action: TaskCheckAction };
};

type CategoryRecord = { id: string; name: string; color?: string | null; sortOrder?: number | null };

export type TaskCardSources = {
  /** Workspace-local today. */
  today: string;
  timezone: string;
  tasks: readonly CanonicalTask[];
  categories: readonly CategoryRecord[];
  projects: readonly { id: string; title: string }[];
  goals: readonly { id: string; title: string }[];
  dependencies?: readonly DependencyEdge[];
  occurrences?: readonly TaskOccurrenceLike[];
  /** Task id → open plan local date (`committedTaskPlans` in @shared/taskDrop). */
  committedTasks?: ReadonlyMap<string, string>;
  pendingTaskIds?: ReadonlySet<string>;
  conflictCountByTask?: ReadonlyMap<string, number>;
  sort?: TaskDropSort;
};

export type TaskCardContext = TaskDropContext & {
  categoryTones: ReadonlyMap<string, ToneOrNeutral>;
  categoryNames: ReadonlyMap<string, string>;
  projectTitles: ReadonlyMap<string, string>;
  goalTitles: ReadonlyMap<string, string>;
  subtaskCounts: ReadonlyMap<string, { done: number; total: number }>;
  pendingTaskIds: ReadonlySet<string>;
  conflictCountByTask: ReadonlyMap<string, number>;
  dependencyEdges: DependencyEdge[];
};

/** Builds the lookup maps once per snapshot so each card is cheap to derive. */
export function createTaskCardContext(sources: TaskCardSources): TaskCardContext {
  const subtaskCounts = new Map<string, { done: number; total: number }>();
  for (const task of sources.tasks) {
    if (!task.parentTaskId || task.state === "archived") continue;
    const current = subtaskCounts.get(task.parentTaskId) ?? { done: 0, total: 0 };
    subtaskCounts.set(task.parentTaskId, { done: current.done + (task.state === "completed" ? 1 : 0), total: current.total + 1 });
  }
  const dependencyEdges = [...(sources.dependencies ?? [])];
  return {
    today: sources.today,
    timezone: sources.timezone,
    sort: sources.sort ?? "manual",
    occurrences: sources.occurrences,
    dependencies: dependencyEdges,
    tasks: sources.tasks.map(task => ({ id: task.id, state: task.state })),
    committedTasks: sources.committedTasks,
    categoryTones: resolveCategoryTones(sources.categories),
    categoryNames: new Map(sources.categories.map(category => [category.id, category.name])),
    projectTitles: new Map(sources.projects.map(project => [project.id, project.title])),
    goalTitles: new Map(sources.goals.map(goal => [goal.id, goal.title])),
    subtaskCounts,
    pendingTaskIds: sources.pendingTaskIds ?? new Set(),
    conflictCountByTask: sources.conflictCountByTask ?? new Map(),
    dependencyEdges,
  };
}

function reservedPill(task: CanonicalTask, reserved: string, timezone: string, today: string): TaskDatePill {
  const start = localTimeLabel(task.plannedStartAt!, timezone);
  const end = localTimeLabel(task.plannedEndAt!, timezone);
  if (reserved === today) {
    const label = start && end ? `Today ${start}-${end}` : "Today";
    return { kind: "reserved", label, tone: "accent", accessibleLabel: `Reserved today${start && end ? ` ${start} to ${end}` : ""}` };
  }
  const label = start ? `${weekdayDayLabel(reserved)} · ${start}` : weekdayDayLabel(reserved);
  return { kind: "reserved", label, tone: "accent", accessibleLabel: `Reserved ${weekdayDayMonthLabel(reserved)}${start ? ` at ${start}` : ""}` };
}

function planPill(scheduled: string, today: string): TaskDatePill {
  if (scheduled < today) return { kind: "slipped", label: `Planned ${dayMonthLabel(scheduled)}`, tone: "risk", accessibleLabel: `Planned for ${weekdayDayMonthLabel(scheduled)}, not done yet` };
  if (scheduled === today) return { kind: "plan", label: "Today", tone: "accent", accessibleLabel: "Plan for today" };
  if (scheduled === shiftLocalDate(today, 1)) return { kind: "plan", label: "Tomorrow", tone: "neutral", accessibleLabel: "Plan for tomorrow" };
  return { kind: "plan", label: weekdayDayMonthLabel(scheduled), tone: "neutral", accessibleLabel: `Plan for ${weekdayDayMonthLabel(scheduled)}` };
}

function duePill(task: CanonicalTask, today: string): TaskDatePill {
  const due = task.dueLocalDate!;
  if (due < today) {
    const days = overdueDays(due, today);
    return { kind: "overdue", label: `Overdue ${days}d`, tone: "off", accessibleLabel: `Deadline ${weekdayDayMonthLabel(due)}, overdue by ${days} ${days === 1 ? "day" : "days"}` };
  }
  if (due === today) return { kind: "due", label: "Due today", tone: "risk", accessibleLabel: "Deadline today" };
  if (deadlineRiskForTask(task, today) === "unplanned_soon") {
    return { kind: "due", label: `Due ${weekdayLabel(due)}, not planned`, tone: "risk", accessibleLabel: `Deadline ${weekdayDayMonthLabel(due)}, not planned yet` };
  }
  return { kind: "due", label: `Due ${dayMonthLabel(due)}`, tone: "neutral", accessibleLabel: `Deadline ${weekdayDayMonthLabel(due)}` };
}

/**
 * Up to two date pills: first the plan, reservation or (for recurring series) the occurrence; then the
 * deadline. A recurring series never shows its anchor date as a plan (D3 §7). Finished work shows none.
 */
export function taskDatePills(task: CanonicalTask, ctx: Pick<TaskCardContext, "today" | "timezone" | "occurrences">): TaskDatePill[] {
  if (task.state === "completed" || task.state === "archived") return [];
  const pills: TaskDatePill[] = [];
  const recurring = recurringTaskStatus(task, ctx.today, ctx.occurrences);
  if (recurring) {
    const copy = recurringOccurrenceLabel(recurring);
    pills.push({ kind: "occurrence", label: copy.label, tone: copy.tone, accessibleLabel: copy.accessibleLabel });
    // Without a Plan for date the deadline is the series anchor, so it is not shown as a deadline.
    if (task.dueLocalDate && task.scheduledLocalDate) pills.push(duePill(task, ctx.today));
    return pills;
  }
  const reserved = reservedLocalDate(task, ctx.timezone);
  // Same plan-date rule as taskWhenPlacement, so the pill and the section always agree.
  const planDate = task.scheduledLocalDate ?? reserved;
  if (reserved && reserved >= ctx.today) pills.push(reservedPill(task, reserved, ctx.timezone, ctx.today));
  else if (planDate) pills.push(planPill(planDate, ctx.today));
  if (task.dueLocalDate) pills.push(duePill(task, ctx.today));
  return pills.slice(0, 2);
}

function completedLabel(task: CanonicalTask, ctx: TaskCardContext) {
  if (task.state !== "completed") return null;
  const day = task.completedAt ? localDateForInstant(task.completedAt, ctx.timezone) : null;
  if (!day) return "Done";
  return day === ctx.today ? "Done today" : `Done ${dayMonthLabel(day)}`;
}

function checkFor(task: CanonicalTask, ctx: TaskCardContext): { check: TaskCardModel["check"]; completionBlock: TaskCardModel["completionBlock"] } {
  if (task.state === "completed") return { check: { checked: true, action: { kind: "reopen" } }, completionBlock: null };
  if (task.state === "archived") return { check: { checked: false, action: { kind: "none" } }, completionBlock: null };
  const recurring = recurringTaskStatus(task, ctx.today, ctx.occurrences);
  const completion = taskCompletionCheck(task, ctx);
  if (completion.ok && completion.via === "occurrence") {
    return { check: { checked: false, action: { kind: "resolve_occurrence", occurrenceId: completion.occurrence.id, expectedVersion: completion.occurrence.version } }, completionBlock: null };
  }
  if (completion.ok) return { check: { checked: false, action: { kind: "complete" } }, completionBlock: null };
  const action = completion.action === "open_plan" ? "open_plan" as const : completion.action ? "open_detail" as const : undefined;
  const completionBlock = { reason: completion.reason, ...(action ? { action } : {}) };
  // Today's occurrence is already done: the check reads as done, and there is nothing to toggle.
  const doneToday = recurring?.kind === "resolved_today" && recurring.state === "completed";
  return { check: { checked: doneToday, action: { kind: "none" } }, completionBlock };
}

export function taskCardModel(task: CanonicalTask, ctx: TaskCardContext): TaskCardModel {
  const presentation = canonicalTaskPresentation(task, { surface: "tasks", localDate: ctx.today, timezone: ctx.timezone, occurrences: ctx.occurrences });
  const projectTitle = task.projectId ? ctx.projectTitles.get(task.projectId) : undefined;
  const goalTitle = task.goalId ? ctx.goalTitles.get(task.goalId) : undefined;
  const dependency = dependencyExecutionState(task.id, ctx.dependencyEdges, [...(ctx.tasks ?? [])]);
  const rule = recurringTaskStatus(task, ctx.today, ctx.occurrences)?.rule ?? null;
  const { check, completionBlock } = checkFor(task, ctx);
  return {
    id: presentation.identity.recordId,
    version: presentation.identity.version,
    title: presentation.title,
    state: presentation.completion.state,
    isComplete: presentation.completion.isComplete,
    tone: task.categoryId ? ctx.categoryTones.get(task.categoryId) ?? "neutral" : "neutral",
    categoryName: task.categoryId ? ctx.categoryNames.get(task.categoryId) ?? null : null,
    context: projectTitle ? { kind: "project", title: projectTitle } : goalTitle ? { kind: "goal", title: goalTitle } : null,
    priority: task.priority === "high" || task.priority === "critical" ? task.priority : null,
    dates: taskDatePills(task, ctx),
    estimateMinutes: typeof task.estimateMinutes === "number" && task.estimateMinutes > 0 ? task.estimateMinutes : null,
    subtasks: ctx.subtaskCounts.get(task.id) ?? null,
    waitingOn: dependency.blockedByIds.length,
    blocks: dependency.blocksIds.length,
    recurring: rule ? { cadence: recurrenceCadenceLabel(rule) } : null,
    someday: task.horizon === "someday",
    pending: ctx.pendingTaskIds.has(task.id) || String(task.id).startsWith("offline:"),
    conflictCount: ctx.conflictCountByTask.get(task.id) ?? 0,
    completionBlock,
    why: null,
    completedLabel: completedLabel(task, ctx),
    check,
  };
}

export function taskCardModels(tasks: readonly CanonicalTask[], ctx: TaskCardContext) {
  return tasks.map(task => taskCardModel(task, ctx));
}
