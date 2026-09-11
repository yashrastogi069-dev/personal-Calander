export type DependencyEdge = { taskId: string; dependsOnTaskId: string; dependencyType: "hard" | "soft" };
export type DependencyTask = { id: string; state: string };

/** Returns incomplete hard prerequisites; missing prerequisite records remain blocking data-integrity failures. */
export function incompleteHardPrerequisites(taskId: string, edges: DependencyEdge[], tasks: DependencyTask[]) {
  const stateById = new Map(tasks.map(task => [task.id, task.state]));
  return edges
    .filter(edge => edge.taskId === taskId && edge.dependencyType === "hard")
    .map(edge => edge.dependsOnTaskId)
    .filter(id => stateById.get(id) !== "completed");
}

export function dependencyExecutionState(taskId: string, edges: DependencyEdge[], tasks: DependencyTask[]) {
  const blockedByIds = incompleteHardPrerequisites(taskId, edges, tasks);
  const blocksIds = edges.filter(edge => edge.dependsOnTaskId === taskId && edge.dependencyType === "hard").map(edge => edge.taskId);
  return { isBlocked: blockedByIds.length > 0, blockedByIds, blocksIds };
}
