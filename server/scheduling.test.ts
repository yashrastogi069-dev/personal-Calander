import { describe, expect, it } from "vitest";
import { proposalExplanation, schedulingEligibility } from "../shared/schedulingPolicy";

describe("scheduling policy", () => {
  it("requires an explicit estimate and respects pinned task protection", () => {
    expect(schedulingEligibility({ state: "not_started", estimateMinutes: null, scheduleMode: "flexible", dueLocalDate: null }, false)).toMatch(/Focus time needed/);
    expect(schedulingEligibility({ state: "not_started", estimateMinutes: 30, scheduleMode: "pinned", dueLocalDate: null }, false)).toMatch(/pinned/);
  });

  it("labels a viable proposal as an approval-first suggestion rather than a silent move", () => {
    const copy = proposalExplanation({ state: "not_started", estimateMinutes: 30, scheduleMode: "flexible", dueLocalDate: "2026-08-29" }, "2026-08-27", "09:00", "09:30");
    expect(copy).toContain("proposal only");
    expect(copy).toContain("Deadline: 2026-08-29");
  });
});
