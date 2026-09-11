export type RolloverTaskLike = { id: string; state: string; scheduledLocalDate: string | null; plannedStartAt: Date | null; plannedEndAt: Date | null; version: number; rescheduleCount: number };

/** A rollover only clears an unfinished task-owned time reservation from a completed local day. */
export function isEligibleMorningRollover(task: RolloverTaskLike, fromLocalDate: string, alreadyRolledOver: boolean) {
  return !alreadyRolledOver && task.state !== "completed" && task.state !== "archived" && task.scheduledLocalDate === fromLocalDate && Boolean(task.plannedStartAt && task.plannedEndAt);
}

export function morningRolloverPreview(tasks: RolloverTaskLike[], fromLocalDate: string, rolledOverTaskIds: Iterable<string>) {
  const rolledOver = new Set(rolledOverTaskIds);
  return tasks.filter(task => isEligibleMorningRollover(task, fromLocalDate, rolledOver.has(task.id))).map(task => ({ id: task.id, expectedVersion: task.version, rescheduleCount: task.rescheduleCount, plannedStartAt: task.plannedStartAt!, plannedEndAt: task.plannedEndAt! }));
}
