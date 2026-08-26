import { describe, expect, it } from "vitest";
import { laneForTaskState, stateForTaskLane, taskBoardLanes } from "../shared/taskBoard";

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
});
