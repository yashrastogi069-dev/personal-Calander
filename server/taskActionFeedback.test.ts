import { describe, expect, it } from "vitest";
import { taskActionRecoveryMessage } from "../shared/taskActionFeedback";

describe("task action recovery feedback", () => {
  it("preserves an actionable planner error for the persistent board recovery surface", () => {
    expect(taskActionRecoveryMessage(new Error("Complete every hard prerequisite before finishing this task."))).toBe("Complete every hard prerequisite before finishing this task.");
  });

  it("uses a clear recovery fallback when a mutation does not provide an error message", () => {
    expect(taskActionRecoveryMessage(null)).toBe("This task could not be moved. The board was restored; try again.");
  });
});
