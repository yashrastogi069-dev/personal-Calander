export type SortableTask = { id: string; sortOrder: number };

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
