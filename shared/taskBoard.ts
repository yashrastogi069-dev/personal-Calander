export const taskBoardLanes = [
  { id: "todo", label: "To do", description: "Work that still needs a clear first move." },
  { id: "in_progress", label: "In progress", description: "Work you are actively carrying right now." },
  { id: "completed", label: "Completed", description: "Finished work, retained as visible evidence." },
] as const;

export type TaskBoardLaneId = (typeof taskBoardLanes)[number]["id"];

export const completedLanePreviewLimit = 12;
export const activeLanePreviewLimit = 24;

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

/** Keeps every lane scannable at scale while leaving explicit expansion and search fully recoverable. */
export function visibleTasksForLane<T>(items: T[], lane: TaskBoardLaneId, showAll: boolean) {
  if (showAll) return { items, hiddenCount: 0, previewLimit: lane === "completed" ? completedLanePreviewLimit : activeLanePreviewLimit } as const;
  const previewLimit = lane === "completed" ? completedLanePreviewLimit : activeLanePreviewLimit;
  const visibleItems = items.slice(0, previewLimit);
  return { items: visibleItems, hiddenCount: Math.max(0, items.length - visibleItems.length), previewLimit } as const;
}

// D3 Status lens: four lanes, so `blocked` has its own home instead of hiding in To do.
// The three-lane exports above stay until the legacy board in Home.tsx and TaskWorkspace.tsx is replaced.

export const taskStatusLanes = [
  { id: "todo", label: "To do", shortLabel: "To do", state: "not_started", emptyText: "Nothing waiting.", dropHint: "Drop to move to To do" },
  { id: "in_progress", label: "In progress", shortLabel: "Doing", state: "in_progress", emptyText: "Drag a task here when you start it.", dropHint: "Drop to mark in progress" },
  { id: "blocked", label: "Blocked", shortLabel: "Blocked", state: "blocked", emptyText: "Nothing is blocked.", dropHint: "Drop to mark blocked" },
  { id: "done", label: "Done", shortLabel: "Done", state: "completed", emptyText: "Finished work shows here.", dropHint: "Drop to mark done" },
] as const;

export type TaskStatusLaneId = (typeof taskStatusLanes)[number]["id"];
export type TaskStatusLaneState = (typeof taskStatusLanes)[number]["state"];

/** The Status lane of a lifecycle state; archived work is not on the board. */
export function statusLaneForTaskState(state: string): TaskStatusLaneId | null {
  if (state === "completed") return "done";
  if (state === "in_progress") return "in_progress";
  if (state === "blocked") return "blocked";
  if (state === "archived") return null;
  return "todo";
}

export function stateForStatusLane(lane: TaskStatusLaneId): TaskStatusLaneState {
  return taskStatusLanes.find(item => item.id === lane)!.state;
}

export function statusLaneLabel(lane: TaskStatusLaneId) {
  return taskStatusLanes.find(item => item.id === lane)!.label;
}

/** Splits tasks into the four Status lanes, keeping the caller's order inside each lane. */
export function tasksByStatusLane<T extends { state: string }>(tasks: readonly T[]) {
  const lanes: Record<TaskStatusLaneId, T[]> = { todo: [], in_progress: [], blocked: [], done: [] };
  for (const task of tasks) {
    const lane = statusLaneForTaskState(task.state);
    if (lane) lanes[lane].push(task);
  }
  return lanes;
}

/** Same preview limits as the legacy board: 24 active cards, 12 done, then "Show N more". */
export function visibleTasksForStatusLane<T>(items: readonly T[], lane: TaskStatusLaneId, showAll: boolean) {
  const previewLimit = lane === "done" ? completedLanePreviewLimit : activeLanePreviewLimit;
  if (showAll) return { items: [...items], hiddenCount: 0, previewLimit } as const;
  const visibleItems = items.slice(0, previewLimit);
  return { items: visibleItems, hiddenCount: Math.max(0, items.length - visibleItems.length), previewLimit } as const;
}
