import { describe, expect, it } from "vitest";
import { dependencyExecutionState, incompleteHardPrerequisites } from "@shared/dependencyPolicy";

describe("task dependency execution policy", () => {
  const edges = [
    { taskId: "ship", dependsOnTaskId: "review", dependencyType: "hard" as const },
    { taskId: "ship", dependsOnTaskId: "copy", dependencyType: "soft" as const },
    { taskId: "launch", dependsOnTaskId: "ship", dependencyType: "hard" as const },
  ];

  it("blocks completion only for unfinished hard prerequisites", () => {
    expect(incompleteHardPrerequisites("ship", edges, [{ id: "review", state: "in_progress" }, { id: "copy", state: "not_started" }])).toEqual(["review"]);
    expect(incompleteHardPrerequisites("ship", edges, [{ id: "review", state: "completed" }, { id: "copy", state: "not_started" }])).toEqual([]);
  });

  it("keeps missing hard prerequisites blocking rather than silently treating corrupted data as complete", () => {
    expect(incompleteHardPrerequisites("ship", edges, [{ id: "copy", state: "completed" }])).toEqual(["review"]);
  });

  it("provides both blocked-by and unblocks-when-complete context for the project execution surface", () => {
    expect(dependencyExecutionState("ship", edges, [{ id: "review", state: "in_progress" }, { id: "copy", state: "completed" }])).toEqual({ isBlocked: true, blockedByIds: ["review"], blocksIds: ["launch"] });
  });
});
