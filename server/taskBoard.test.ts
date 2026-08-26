import { describe, expect, it } from "vitest";
import { activeLanePreviewLimit, completedLanePreviewLimit, laneForTaskState, stateForTaskLane, taskBoardLanes, visibleTasksForLane } from "../shared/taskBoard";

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
