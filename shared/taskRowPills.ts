// Tasks redesign T1: calm rows (owner decision Q6). A row is the title, at most 2 smart pills chosen by
// importance, then the estimate. Priority:
//   1. the urgency state (Overdue Nd / Due Sat · not planned / Plan Thu)
//   2. the project, or the category dot when there is no project
//   3. a Waiting chip when blocked; it replaces pill 2 when present (as in the approved prototype)
// Board cards hide facts the column already gives (Fable Q5): no "Plan Fri" on the Week board, and
// "Due Sat · not planned" shortens to "Due Sat".

import { incompleteHardPrerequisites, type DependencyEdge } from "./dependencyPolicy";
import { taskWhenPlacement, type BucketTask } from "./taskBuckets";
import { dayMonthLabel, localDaysBetween, weekdayLabel } from "./taskDateLabels";
import type { TaskOccurrenceLike } from "./taskRecurrence";
import { localWeekStart, type WeekStartsOn } from "./taskWeekBoard";

export type RowPillTask = BucketTask & {
  title?: string | null;
  projectId?: string | null;
  categoryId?: string | null;
};

export type RowPillTone = "overdue" | "risk" | "plan" | "today" | "week";

export type RowPill =
  | { kind: "urgency"; tone: RowPillTone; icon: "alarm-clock" | "flag" | "calendar" | "sun" | "calendar-range"; label: string }
  | { kind: "project"; recordId: string; label: string; color: string | null }
  | { kind: "category"; recordId: string; label: string; color: string | null }
  | { kind: "waiting"; label: string; waitingOn: string | null };

export type RowPillRecord = { id: string; name: string; color?: string | null; categoryId?: string | null };

export type RowPillContext = {
  timezone: string;
  /** "list" rows (default) or "board" cards (Fable Q5). */
  variant?: "list" | "board";
  /** Board lens: the Week board's day columns already say the plan day. Default "week". */
  boardLens?: "week" | "status";
  /** The List "Group by": the group header already names the project or category, so the pill is dropped. */
  groupBy?: "when" | "project" | "category";
  projects?: ReadonlyMap<string, RowPillRecord>;
  categories?: ReadonlyMap<string, RowPillRecord>;
  occurrences?: readonly TaskOccurrenceLike[];
  weekStartsOn?: WeekStartsOn;
  /** For the Waiting chip: hard prerequisites (`snapshot.taskDependencies`) and every task record. */
  dependencies?: readonly DependencyEdge[];
  tasks?: readonly { id: string; state: string; title?: string | null }[];
  /** A caller-resolved "waiting on" label (overrides the prerequisite lookup). */
  waitingOn?: string | null;
};

/** "today", "Sat" within a week, else "16 Oct". */
function pillDay(localDate: string, today: string) {
  if (localDate === today) return "today";
  return Math.abs(localDaysBetween(today, localDate)) < 7 ? weekdayLabel(localDate) : dayMonthLabel(localDate);
}

/** The urgency pill (pill 1), or null when nothing is urgent or the board column already says it. */
export function urgencyPill(task: RowPillTask, today: string, ctx: RowPillContext): Extract<RowPill, { kind: "urgency" }> | null {
  if (task.state === "completed" || task.state === "archived" || task.horizon === "someday") return null;
  const board = ctx.variant === "board";
  const weekBoard = board && (ctx.boardLens ?? "week") === "week";
  const placement = taskWhenPlacement(task, { today, timezone: ctx.timezone, occurrences: ctx.occurrences });

  if (placement.bucket === "past_due") {
    // The larger lateness of a missed deadline and a slipped plan ("Overdue 3d"), as the prototype shows.
    const late = Math.max(
      placement.keyDate ? localDaysBetween(placement.keyDate, today) : 0,
      task.dueLocalDate && task.dueLocalDate < today && placement.pastDue === "deadline" ? localDaysBetween(task.dueLocalDate, today) : 0,
      task.scheduledLocalDate && task.scheduledLocalDate < today && !placement.recurring ? localDaysBetween(task.scheduledLocalDate, today) : 0,
    );
    return { kind: "urgency", tone: "overdue", icon: "alarm-clock", label: `Overdue ${Math.max(1, late)}d` };
  }
  const due = task.dueLocalDate && !placement.recurring ? task.dueLocalDate : null;
  if (due && !task.scheduledLocalDate) {
    const label = due === today ? "Due today" : `Due ${pillDay(due, today)}`;
    return { kind: "urgency", tone: "risk", icon: "flag", label: weekBoard ? label : `${label} · not planned` };
  }
  if (due && localDaysBetween(today, due) <= 3) {
    return { kind: "urgency", tone: "risk", icon: "flag", label: due === today ? "Due today" : `Due ${pillDay(due, today)}` };
  }
  const plan = task.scheduledLocalDate;
  if (plan && plan !== today) return weekBoard ? null : { kind: "urgency", tone: "plan", icon: "calendar", label: `Plan ${pillDay(plan, today)}` };
  // In the When grouping the Today header already says it; other groupings (and the Status board) need it.
  if (plan === today && !weekBoard && (board || (ctx.groupBy ?? "when") !== "when")) {
    return { kind: "urgency", tone: "today", icon: "sun", label: "Today" };
  }
  if (!plan && task.plannedWeekStartLocalDate && task.plannedWeekStartLocalDate === localWeekStart(today, ctx.weekStartsOn ?? 1)) {
    return { kind: "urgency", tone: "week", icon: "calendar-range", label: "This week" };
  }
  return null;
}

function waitingPill(task: RowPillTask, ctx: RowPillContext): Extract<RowPill, { kind: "waiting" }> | null {
  if (task.state === "completed" || task.state === "archived") return null;
  if (ctx.waitingOn) return { kind: "waiting", label: `Waiting · ${ctx.waitingOn}`, waitingOn: ctx.waitingOn };
  const blockers = ctx.dependencies && ctx.tasks ? incompleteHardPrerequisites(task.id, [...ctx.dependencies], [...ctx.tasks]) : [];
  if (blockers.length) {
    const first = ctx.tasks?.find(item => item.id === blockers[0])?.title ?? null;
    const on = first ? (blockers.length > 1 ? `${first} +${blockers.length - 1}` : first) : `${blockers.length} ${blockers.length === 1 ? "task" : "tasks"}`;
    return { kind: "waiting", label: `Waiting · ${on}`, waitingOn: on };
  }
  if (task.state === "blocked") return { kind: "waiting", label: "Waiting", waitingOn: null };
  return null;
}

/**
 * At most 2 pills by priority (Q6). `today` is the workspace-local day. The repeat icon and the estimate are
 * not pills; the UI draws them beside.
 */
export function rowPills(task: RowPillTask, today: string, ctx: RowPillContext): RowPill[] {
  const pills: RowPill[] = [];
  const urgency = urgencyPill(task, today, ctx);
  if (urgency) pills.push(urgency);

  const project = task.projectId ? ctx.projects?.get(task.projectId) ?? null : null;
  const categoryId = task.categoryId ?? project?.categoryId ?? null;
  const category = categoryId ? ctx.categories?.get(categoryId) ?? null : null;
  if (project && ctx.groupBy !== "project") {
    pills.push({ kind: "project", recordId: project.id, label: project.name, color: project.color ?? category?.color ?? null });
  } else if (!project && category && ctx.groupBy !== "category") {
    pills.push({ kind: "category", recordId: category.id, label: category.name, color: category.color ?? null });
  }

  const waiting = waitingPill(task, ctx);
  if (waiting) {
    // Waiting replaces the second pill when present.
    if (pills.length >= 2) pills.splice(1, 1);
    pills.push(waiting);
  }
  return pills.slice(0, 2);
}
