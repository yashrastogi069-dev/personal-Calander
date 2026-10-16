// Tasks T2b-2 bulk select (owner decision Q10, prototype "Bulk select"): the selection model and the batch
// writes behind the floating bar. Pure functions only, so the rules are unit-tested in node.
//
// Selection: a hover select box (or long-press on phone) toggles one task, Shift-click selects the range from
// the last toggled task (the anchor) in display order, `X` toggles the focused row, Esc clears.
// Batches: every action is a sequence of `planner.task.update` patches built here. Each batch keeps the
// inverse patch per task, so the bar offers ONE Undo for the whole batch. Refused tasks write nothing and are
// named in the summary (the same rules as the board's drop engine).
import type { CanonicalTask } from "@shared/canonicalTask";
import { planBulkStateChange, planTaskDrop, type TaskDropContext } from "@shared/taskDrop";
import { shiftLocalDate } from "@shared/taskRecurrence";

export type BulkSelection = {
  ids: ReadonlySet<string>;
  /** Last task toggled on, the start of a Shift-click range. */
  anchor: string | null;
};

export const emptyBulkSelection: BulkSelection = { ids: new Set(), anchor: null };

/** Toggles one id. Shift with an anchor selects the inclusive range in `order` (display order). */
export function toggleBulkSelection(selection: BulkSelection, id: string, order: readonly string[], options: { range?: boolean } = {}): BulkSelection {
  if (options.range && selection.anchor && selection.anchor !== id) {
    const from = order.indexOf(selection.anchor);
    const to = order.indexOf(id);
    if (from >= 0 && to >= 0) {
      const [start, end] = from < to ? [from, to] : [to, from];
      const ids = new Set(selection.ids);
      for (const item of order.slice(start, end + 1)) ids.add(item);
      return { ids, anchor: id };
    }
  }
  const ids = new Set(selection.ids);
  if (ids.has(id)) {
    ids.delete(id);
    return { ids, anchor: ids.size ? selection.anchor === id ? null : selection.anchor : null };
  }
  ids.add(id);
  return { ids, anchor: id };
}

/** Drops ids that are no longer on screen (filtered out, archived, decided). */
export function pruneBulkSelection(selection: BulkSelection, visible: ReadonlySet<string>): BulkSelection {
  let changed = false;
  const ids = new Set<string>();
  selection.ids.forEach(id => {
    if (visible.has(id)) ids.add(id);
    else changed = true;
  });
  if (!changed) return selection;
  return { ids, anchor: selection.anchor && ids.has(selection.anchor) ? selection.anchor : null };
}

export function clearBulkSelection(): BulkSelection {
  return emptyBulkSelection;
}

type KeyLike = { key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean };

function isTextField(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element || typeof element.tagName !== "string") return false;
  const tag = element.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(element.isContentEditable);
}

/** What a key press does to the selection: `X` on a focused task toggles it, Esc clears a live selection. */
export function bulkSelectionKey(event: KeyLike, target: EventTarget | null, focusedTaskId: string | null, selectionSize: number): "toggle" | "clear" | null {
  if (event.ctrlKey || event.metaKey || event.altKey || isTextField(target)) return null;
  if ((event.key === "x" || event.key === "X") && focusedTaskId) return "toggle";
  if (event.key === "Escape" && selectionSize > 0) return "clear";
  return null;
}

// ---------- batch writes ----------

export type BulkAction =
  | { kind: "plan"; localDate: string | null; label: string }
  | { kind: "project"; projectId: string | null; label: string }
  | { kind: "priority"; priority: "critical" | "high" | "medium" | "low" | "none"; label: string }
  | { kind: "archive" };

export type BulkWrite = { task: CanonicalTask; patch: Record<string, unknown>; undo: Record<string, unknown> };

export type BulkPlan = {
  writes: BulkWrite[];
  /** Tasks that would not change (already there). */
  unchanged: CanonicalTask[];
  excluded: Array<{ task: CanonicalTask; reason: string }>;
  /** "Planned 2 for tomorrow", "Moved 3 to Portfolio", "Archived 2". */
  message: string;
  /** "1 skipped: Repeats daily" or null. */
  skipped: string | null;
};

function undoFor(task: CanonicalTask, patch: Record<string, unknown>) {
  const undo: Record<string, unknown> = {};
  for (const key of Object.keys(patch)) undo[key] = (task as Record<string, unknown>)[key] ?? null;
  return undo;
}

function plural(count: number) {
  return count === 1 ? "1 task" : `${count} tasks`;
}

function summarise(excluded: BulkPlan["excluded"]) {
  if (!excluded.length) return null;
  const reasons = Array.from(new Set(excluded.map(item => item.reason)));
  return `${excluded.length} skipped: ${reasons.join("; ")}`;
}

/**
 * Builds a batch. Plan uses the board's day-drop rules (recurring, reserved and past days refuse; a day after
 * the deadline plans anyway and keeps the deadline). Archive uses `planBulkStateChange` (R1/R3 guards).
 */
export function planBulkAction(tasks: readonly CanonicalTask[], action: BulkAction, ctx: TaskDropContext): BulkPlan {
  const writes: BulkWrite[] = [];
  const unchanged: CanonicalTask[] = [];
  const excluded: BulkPlan["excluded"] = [];
  const add = (task: CanonicalTask, patch: Record<string, unknown>) => writes.push({ task, patch, undo: undoFor(task, patch) });

  if (action.kind === "archive") {
    const open = tasks.filter(task => task.state !== "archived");
    tasks.filter(task => task.state === "archived").forEach(task => unchanged.push(task));
    const plan = planBulkStateChange(open, "archived", ctx);
    plan.eligible.forEach(task => add(task, { state: "archived" }));
    plan.excluded.forEach(item => excluded.push({ task: item.task, reason: item.shortReason }));
  } else {
    for (const task of tasks) {
      if (task.state === "archived") {
        excluded.push({ task, reason: "Archived" });
        continue;
      }
      if (action.kind === "plan") {
        const drop = planTaskDrop(task, { kind: "day", date: action.localDate }, ctx);
        if (!drop.ok) {
          excluded.push({ task, reason: drop.reason });
          continue;
        }
        const write = drop.write;
        if (write.kind === "update") add(task, { ...write.patch });
        else if (write.kind === "confirmLate") add(task, { ...write.planAnyway });
        else unchanged.push(task);
        continue;
      }
      if (action.kind === "project") {
        if ((task.projectId ?? null) === action.projectId) unchanged.push(task);
        else add(task, { projectId: action.projectId });
        continue;
      }
      if ((task.priority ?? "medium") === action.priority) unchanged.push(task);
      else add(task, { priority: action.priority });
    }
  }

  const count = writes.length;
  const message = action.kind === "plan"
    ? action.localDate ? `Planned ${plural(count)} for ${action.label}` : `Cleared the plan day on ${plural(count)}`
    : action.kind === "project"
      ? action.projectId ? `Moved ${plural(count)} to ${action.label}` : `Removed ${plural(count)} from their project`
      : action.kind === "priority"
        ? `Set ${plural(count)} to ${action.label} priority`
        : `Archived ${plural(count)}`;
  return { writes, unchanged, excluded, message, skipped: summarise(excluded) };
}

/** Undo for one batch: one inverse patch per task that was written, applied to the fresh record. */
export function bulkUndoWrites(done: ReadonlyArray<{ write: BulkWrite; record: Record<string, unknown> | null | undefined }>) {
  return done.map(({ write, record }) => ({ task: (record ?? write.task) as CanonicalTask, patch: write.undo }));
}

/** The Plan for… choices: Today, Tomorrow, next week's first day, or a picked date. */
export function bulkPlanChoices(today: string, weekStartsOn = 1) {
  const day = new Date(`${today}T12:00:00Z`).getUTCDay();
  const untilNextWeek = ((weekStartsOn - day + 7) % 7) || 7;
  return [
    { id: "today", label: "today", title: "Today", localDate: today },
    { id: "tomorrow", label: "tomorrow", title: "Tomorrow", localDate: shiftLocalDate(today, 1) },
    { id: "next_week", label: "next week", title: "Next week", localDate: shiftLocalDate(today, untilNextWeek) },
  ];
}
