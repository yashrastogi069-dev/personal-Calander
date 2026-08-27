import { describe, expect, it } from "vitest";
import { focusEstimateAccuracy, focusMinutes } from "../shared/focusMetrics";

describe("focus metrics", () => {
  it("reports actual recorded focus minutes without treating an active timer as completed evidence", () => {
    expect(focusMinutes([{ taskId: "a", activeSeconds: 1_500, state: "completed" }, { taskId: "a", activeSeconds: 300, state: "active" }])).toBe(30);
    expect(focusEstimateAccuracy([{ taskId: "a", activeSeconds: 1_500, state: "completed" }, { taskId: "a", activeSeconds: 300, state: "active" }], [{ id: "a", estimateMinutes: 20 }])).toEqual({ measuredTasks: 1, averageVarianceMinutes: 5, direction: "underestimated" });
  });

  it("does not manufacture estimate accuracy when no completed task has both measurements", () => {
    expect(focusEstimateAccuracy([{ taskId: null, activeSeconds: 1_500, state: "completed" }], [{ id: "a", estimateMinutes: 20 }])).toEqual({ measuredTasks: 0, averageVarianceMinutes: null, direction: "not_enough_data" });
  });
});
