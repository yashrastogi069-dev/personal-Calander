// Week board (Tasks redesign T1, owner decision Q3 2026-10-15): Unscheduled · Mon … Sun of the shown week.
// Dragging a card to a day sets its Plan for date (`planTaskDrop` day target); Unscheduled clears it. Each
// column carries a count and total estimate of its open cards. Pure: every date is a workspace-local day.

import { completedOnLocalDay, isInboxTask, reservedLocalDate, taskWhenPlacement, type BucketTask, type TaskBucketContext } from "./taskBuckets";
import { localDaysBetween, weekdayDayLabel } from "./taskDateLabels";
import { isRecurrenceRule, shiftLocalDate } from "./taskRecurrence";

export type WeekBoardTask = BucketTask & { estimateMinutes?: number | null };

/** 0 = Sunday … 6 = Saturday, as `workspaces.weekStartsOn` (default 1, Monday). */
export type WeekStartsOn = number;

function weekday(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

/** The first local day of the week holding `localDate`. */
export function localWeekStart(localDate: string, weekStartsOn: WeekStartsOn = 1) {
  const offset = (weekday(localDate) - (((weekStartsOn % 7) + 7) % 7) + 7) % 7;
  return shiftLocalDate(localDate, -offset);
}

/** The seven local days of the week starting `weekStart`. */
export function localWeekDays(weekStart: string) {
  return Array.from({ length: 7 }, (_, index) => shiftLocalDate(weekStart, index));
}

/** ← → paging: the week start `offset` weeks from the week holding `today`. */
export function pagedWeekStart(today: string, offset: number, weekStartsOn: WeekStartsOn = 1) {
  return shiftLocalDate(localWeekStart(today, weekStartsOn), offset * 7);
}

export type WeekBoardContext = TaskBucketContext & {
  /** First day of the shown week (`pagedWeekStart`). */
  weekStart: string;
};

export type WeekBoardColumn<TTask> = {
  /** `"none"` for Unscheduled, else the local day. Droppable id: `day:${id}`. */
  id: string;
  date: string | null;
  /** "Unscheduled" or "Fri 16". */
  label: string;
  isToday: boolean;
  /** A day before today (the UI shrinks it when empty; drops on it are refused). */
  isPast: boolean;
  /** Open cards first in the incoming order, then cards completed today (dimmed, not counted). */
  tasks: TTask[];
  /** Open cards only. */
  count: number;
  /** Total estimate of the open cards, in minutes. */
  estimateMinutes: number;
};

function isOpen(task: { state: string }) {
  return task.state !== "completed" && task.state !== "archived";
}

/** The day a card sits on: Plan for, else the reserved day; a recurring series sits on its next occurrence. */
export function weekBoardDay(task: BucketTask, ctx: TaskBucketContext) {
  if (isRecurrenceRule(task.recurrenceRule)) return taskWhenPlacement(task, ctx).keyDate;
  return task.scheduledLocalDate ?? reservedLocalDate(task, ctx.timezone);
}

/**
 * Builds the Week board columns. Rules:
 * - Archived, Someday and Inbox (undecided) work never shows; the Inbox is triaged first.
 * - A day column holds the cards planned for that day, plus cards completed today on it.
 * - Unscheduled holds open decided work with no plan day (deadline-only, project-only, week-flagged), and,
 *   while the shown week contains today, slipped work planned before the shown week (so it can be re-planned).
 * - A recurring series sits on its next occurrence when that falls in the week; otherwise it is left out
 *   (its schedule decides, and day drops refuse it).
 */
export function weekBoardColumns<TTask extends WeekBoardTask>(tasks: readonly TTask[], ctx: WeekBoardContext): WeekBoardColumn<TTask>[] {
  const days = localWeekDays(ctx.weekStart);
  const weekEnd = days[6];
  const showsToday = ctx.today >= ctx.weekStart && ctx.today <= weekEnd;
  const byColumn = new Map<string, TTask[]>([["none", []], ...days.map(day => [day, []] as [string, TTask[]])]);

  for (const task of tasks) {
    if (task.state === "archived" || task.horizon === "someday") continue;
    const open = isOpen(task);
    if (!open && !completedOnLocalDay(task, ctx)) continue;
    if (open && isInboxTask(task)) continue;
    const day = weekBoardDay(task, ctx);
    if (day && day >= ctx.weekStart && day <= weekEnd) {
      byColumn.get(day)!.push(task);
      continue;
    }
    if (!open || isRecurrenceRule(task.recurrenceRule)) continue;
    if (!day || (showsToday && day < ctx.weekStart)) byColumn.get("none")!.push(task);
  }

  const column = (id: string, date: string | null): WeekBoardColumn<TTask> => {
    const all = byColumn.get(id)!;
    const openTasks = all.filter(isOpen);
    return {
      id,
      date,
      label: date ? weekdayDayLabel(date) : "Unscheduled",
      isToday: date === ctx.today,
      isPast: date !== null && localDaysBetween(ctx.today, date) < 0,
      tasks: [...openTasks, ...all.filter(task => !isOpen(task))],
      count: openTasks.length,
      estimateMinutes: openTasks.reduce((sum, task) => sum + (Number(task.estimateMinutes) || 0), 0),
    };
  };
  return [column("none", null), ...days.map(day => column(day, day))];
}

/**
 * Status lens scope (Fable Q4: this week only, so To do stays short): open work that is overdue or slipped,
 * dated on or before the end of the week holding today (plan, deadline, reservation or next occurrence), or
 * already In progress / Blocked; plus work completed today. Later work belongs in the List.
 */
export function inStatusWeekScope(task: BucketTask, ctx: TaskBucketContext & { weekStartsOn?: WeekStartsOn }) {
  if (task.state === "archived") return false;
  if (task.state === "completed") return completedOnLocalDay(task, ctx);
  if (task.state === "in_progress" || task.state === "blocked") return true;
  if (task.horizon === "someday") return false;
  const weekStart = localWeekStart(ctx.today, ctx.weekStartsOn ?? 1);
  if (task.plannedWeekStartLocalDate && task.plannedWeekStartLocalDate <= weekStart) return true;
  const weekEnd = shiftLocalDate(weekStart, 6);
  const placement = taskWhenPlacement(task, ctx);
  if (placement.bucket === "past_due") return true;
  return Boolean(placement.keyDate && placement.keyDate <= weekEnd);
}
