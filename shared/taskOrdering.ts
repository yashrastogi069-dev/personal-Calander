export type SortableTask = { id: string; sortOrder: number };

/** Gap left between renumbered tasks, and above/below the ends of a lane. */
export const SORT_ORDER_STEP = 1024;
/** Largest lane renumbered with sequential writes (the active-lane preview limit). */
export const MAX_REBALANCE_TASKS = 24;
export const LONG_LANE_REORDER_REASON = "Use Move up and down for long lanes.";

function orderValue(task: SortableTask | null | undefined) {
  if (!task) return null;
  return Number(task.sortOrder) || 0;
}

/**
 * The integer sort key for a slot between two neighbours (null = lane edge), or null when the neighbours
 * leave no integer gap and the lane must be renumbered.
 */
export function sortOrderBetween(prev: number | null, next: number | null): number | null {
  if (prev === null && next === null) return 0;
  if (prev === null) return next! - SORT_ORDER_STEP;
  if (next === null) return prev + SORT_ORDER_STEP;
  if (next - prev < 2) return null;
  return Math.floor((prev + next) / 2);
}

export type SortOrderMovePlan =
  | { kind: "unchanged" }
  /** One write: the moved task's new key. */
  | { kind: "single"; sortOrder: number }
  /** Sequential writes in order; the moved task is always last so an interrupted run never strands it. */
  | { kind: "rebalance"; writes: Array<{ id: string; sortOrder: number }>; sortOrder: number }
  | { kind: "refused"; reason: string };

/**
 * Plans a drop at `targetIndex` in a lane shown in Manual order. `laneTasks` is the full target lane in its
 * current order and may include the moved task (same-lane move); `targetIndex` counts positions in the lane
 * with the moved task taken out. Uses the integer midpoint when there is room, otherwise renumbers the lane
 * with a 1024 step, refusing lanes over 24 tasks (no bulk reorder mutation exists).
 */
export function planSortOrderMove(laneTasks: readonly SortableTask[], movedId: string, targetIndex: number): SortOrderMovePlan {
  const currentIndex = laneTasks.findIndex(task => task.id === movedId);
  const others = laneTasks.filter(task => task.id !== movedId);
  const index = Math.max(0, Math.min(others.length, Math.floor(targetIndex)));
  if (currentIndex >= 0 && currentIndex === index) return { kind: "unchanged" };

  const between = sortOrderBetween(orderValue(others[index - 1]), orderValue(others[index]));
  if (between !== null) return { kind: "single", sortOrder: between };

  const ordered = [...others.slice(0, index), { id: movedId, sortOrder: 0 }, ...others.slice(index)];
  if (ordered.length > MAX_REBALANCE_TASKS) return { kind: "refused", reason: LONG_LANE_REORDER_REASON };
  const renumbered = ordered.map((task, position) => ({ id: task.id, sortOrder: (position + 1) * SORT_ORDER_STEP }));
  const currentById = new Map(laneTasks.map(task => [task.id, orderValue(task)]));
  const moved = renumbered.find(task => task.id === movedId)!;
  const writes = renumbered.filter(task => task.id !== movedId && currentById.get(task.id) !== task.sortOrder);
  return { kind: "rebalance", writes: [...writes, moved], sortOrder: moved.sortOrder };
}

/** Returns a single-record integer sort key that moves a task one visible step without rewriting its siblings. */
export function nextTaskSortOrder(tasks: SortableTask[], taskId: string, direction: -1 | 1) {
  const index = tasks.findIndex(task => task.id === taskId);
  const neighborIndex = index + direction;
  if (index < 0 || neighborIndex < 0 || neighborIndex >= tasks.length) return null;
  const neighborOrder = Number(tasks[neighborIndex].sortOrder) || 0;
  const outer = tasks[neighborIndex + direction];
  const outerOrder = outer ? Number(outer.sortOrder) || 0 : null;
  if (direction < 0) {
    return outerOrder !== null && outerOrder < neighborOrder - 1
      ? Math.floor((outerOrder + neighborOrder) / 2)
      : neighborOrder - 1;
  }
  return outerOrder !== null && outerOrder > neighborOrder + 1
    ? Math.ceil((outerOrder + neighborOrder) / 2)
    : neighborOrder + 1;
}
