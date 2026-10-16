// Tasks T2b-2 gesture rules (spec 2026-10-14 G1-G3) as pure functions, so the outcomes are unit-tested in node.
// The container wires them into TaskSwipeFrame; no rule lives in the component.
import type { CanonicalTask } from "@shared/canonicalTask";
import { planTaskDrop, type TaskDropContext } from "@shared/taskDrop";
import { shiftLocalDate } from "@shared/taskRecurrence";

/** The check dispatch kinds (TaskWorkspace.taskCheckDispatch). */
export type SwipeCheckKind = "complete" | "reopen" | "resolve_occurrence" | "refuse" | "none";

/** G1: why a swipe right cannot complete this row, or null. Recurring rows may (they resolve the occurrence). */
export function swipeCompleteRefusal(input: { pending: boolean; state: string; dispatch: SwipeCheckKind; refuseReason?: string | null }): string | null {
  if (input.pending) return "The last change is still saving.";
  if (input.state === "archived") return "Archived. Restore it first.";
  if (input.dispatch === "complete" || input.dispatch === "resolve_occurrence") return null;
  if (input.dispatch === "refuse") return input.refuseReason || "This task can't be completed here.";
  if (input.dispatch === "reopen") return "Already done. Tap the check to reopen it.";
  return "Nothing to complete here.";
}

export type SwipeReschedule =
  | { ok: true; patch: Record<string, unknown>; undo: Record<string, unknown>; late: boolean; message: string }
  | { ok: false; reason: string; action?: "open_plan" | "open_detail" | "open_calendar" };

/**
 * G3 (and the revealed Tomorrow button): plan for tomorrow with the board's day-drop rules. Recurring rows,
 * reservations and pending writes refuse with the board's own reason; a day after the deadline plans anyway
 * and says so (the swipe has no room for the board's ask-once prompt).
 */
export function swipeReschedule(task: CanonicalTask, ctx: TaskDropContext): SwipeReschedule {
  const tomorrow = shiftLocalDate(ctx.today, 1);
  const plan = planTaskDrop(task, { kind: "day", date: tomorrow }, ctx);
  if (!plan.ok) return { ok: false, reason: plan.reason, ...(plan.action ? { action: plan.action } : {}) };
  const write = plan.write;
  if (write.kind === "none") return { ok: false, reason: "Already planned for tomorrow." };
  if (write.kind === "confirmLate") {
    return { ok: true, patch: { ...write.planAnyway }, undo: { scheduledLocalDate: task.scheduledLocalDate ?? null }, late: true, message: `Planned for tomorrow, after its deadline.` };
  }
  if (write.kind !== "update") return { ok: false, reason: "Open the task to plan it." };
  return { ok: true, patch: { ...write.patch }, undo: { scheduledLocalDate: task.scheduledLocalDate ?? null }, late: false, message: "Planned for tomorrow." };
}
