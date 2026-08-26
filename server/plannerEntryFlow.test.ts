import { describe, expect, it } from "vitest";
import { plannerEntrySteps, todayEntryStage } from "../shared/plannerEntryFlow";

describe("planner entry flow", () => {
  it("keeps an empty plan on the capture stage and advances only after open work exists", () => {
    expect(todayEntryStage(0)).toBe("capture");
    expect(todayEntryStage(1)).toBe("plan");
  });

  it("keeps the task, project, and habit boundaries explicit in the first-run journey", () => {
    expect(plannerEntrySteps.map(step => step.id)).toEqual(["task", "project", "habit"]);
    expect(plannerEntrySteps[2].detail).toContain("never take time-block slots");
  });
});
