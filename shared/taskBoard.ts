export const taskBoardLanes = [
  { id: "todo", label: "To do", description: "Work that still needs a clear first move." },
  { id: "in_progress", label: "In progress", description: "Work you are actively carrying right now." },
  { id: "completed", label: "Completed", description: "Finished work, retained as visible evidence." },
] as const;

export type TaskBoardLaneId = (typeof taskBoardLanes)[number]["id"];

export function laneForTaskState(state: string): TaskBoardLaneId {
  if (state === "completed") return "completed";
  if (state === "in_progress") return "in_progress";
  return "todo";
}

export function stateForTaskLane(lane: TaskBoardLaneId) {
  if (lane === "completed") return "completed" as const;
  if (lane === "in_progress") return "in_progress" as const;
  return "not_started" as const;
}
