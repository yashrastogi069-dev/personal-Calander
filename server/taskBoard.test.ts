import { describe, expect, it } from "vitest";
import {
  activeLanePreviewLimit,
  completedLanePreviewLimit,
  laneForTaskState,
  stateForStatusLane,
  stateForTaskLane,
  statusLaneForTaskState,
  statusLaneLabel,
  taskBoardLanes,
  tasksByStatusLane,
  taskStatusLanes,
  visibleTasksForLane,
  visibleTasksForStatusLane,
} from "../shared/taskBoard";

describe("task board lifecycle mapping", () => {
  it("keeps unfinished and blocked work in the To do lane without losing its blocked state", () => {
    expect(laneForTaskState("not_started")).toBe("todo");
    expect(laneForTaskState("blocked")).toBe("todo");
    expect(laneForTaskState("archived")).toBe("todo");
  });

  it("maps each visible destination to a persisted lifecycle state", () => {
    expect(stateForTaskLane("todo")).toBe("not_started");
    expect(stateForTaskLane("in_progress")).toBe("in_progress");
    expect(stateForTaskLane("completed")).toBe("completed");
  });

  it("defines exactly the three user-facing workflow lanes", () => {
    expect(taskBoardLanes.map(lane => lane.id)).toEqual(["todo", "in_progress", "completed"]);
  });

  it("keeps a 50-task completed history bounded until the user explicitly expands it", () => {
    const completed = Array.from({ length: 50 }, (_, index) => `done-${index}`);
    const preview = visibleTasksForLane(completed, "completed", false);
    expect(preview.items).toHaveLength(completedLanePreviewLimit);
    expect(preview.hiddenCount).toBe(50 - completedLanePreviewLimit);
    expect(visibleTasksForLane(completed, "completed", true)).toMatchObject({ items: completed, hiddenCount: 0 });
  });

  it("keeps 50 active tasks scannable and lets an explicit expansion or search reveal the complete result set", () => {
    const active = Array.from({ length: 50 }, (_, index) => `active-${index}`);
    const preview = visibleTasksForLane(active, "todo", false);
    expect(preview.items).toHaveLength(activeLanePreviewLimit);
    expect(preview.hiddenCount).toBe(50 - activeLanePreviewLimit);
    expect(visibleTasksForLane(active, "todo", true)).toMatchObject({ items: active, hiddenCount: 0 });
  });
});

describe("D3 Status lens lanes", () => {
  it("defines four lanes, giving blocked work its own lane", () => {
    expect(taskStatusLanes.map(lane => lane.id)).toEqual(["todo", "in_progress", "blocked", "done"]);
    expect(taskStatusLanes.map(lane => lane.label)).toEqual(["To do", "In progress", "Blocked", "Done"]);
    expect(taskStatusLanes.find(lane => lane.id === "in_progress")?.shortLabel).toBe("Doing");
  });

  it("maps lifecycle states to lanes and back", () => {
    expect(statusLaneForTaskState("not_started")).toBe("todo");
    expect(statusLaneForTaskState("in_progress")).toBe("in_progress");
    expect(statusLaneForTaskState("blocked")).toBe("blocked");
    expect(statusLaneForTaskState("completed")).toBe("done");
    expect(statusLaneForTaskState("archived")).toBeNull();
    expect(taskStatusLanes.map(lane => stateForStatusLane(lane.id))).toEqual(["not_started", "in_progress", "blocked", "completed"]);
    expect(statusLaneLabel("blocked")).toBe("Blocked");
  });

  it("splits tasks into lanes in their incoming order and leaves archived work off the board", () => {
    const lanes = tasksByStatusLane([
      { id: "a", state: "blocked" }, { id: "b", state: "not_started" }, { id: "c", state: "archived" },
      { id: "d", state: "blocked" }, { id: "e", state: "completed" }, { id: "f", state: "in_progress" },
    ]);
    expect(Object.fromEntries(Object.entries(lanes).map(([lane, items]) => [lane, items.map(item => item.id)]))).toEqual({
      todo: ["b"], in_progress: ["f"], blocked: ["a", "d"], done: ["e"],
    });
  });

  it("keeps the 24 active / 12 done preview limits", () => {
    const items = Array.from({ length: 30 }, (_, index) => index);
    expect(visibleTasksForStatusLane(items, "blocked", false)).toMatchObject({ hiddenCount: 6, previewLimit: activeLanePreviewLimit });
    expect(visibleTasksForStatusLane(items, "done", false)).toMatchObject({ hiddenCount: 18, previewLimit: completedLanePreviewLimit });
    expect(visibleTasksForStatusLane(items, "done", true).items).toHaveLength(30);
  });
});
