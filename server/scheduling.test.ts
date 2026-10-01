import { describe, expect, it } from "vitest";
import { proposalExplanation, schedulingEligibility } from "../shared/schedulingPolicy";
import { scheduleProposalSourceMatchesTask, scheduleProposalTargetMatchesTask } from "./scheduling";

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

describe("schedule proposal freshness", () => {
  const proposal = {
    previousScheduledLocalDate: "2026-08-27",
    previousStartAt: new Date("2026-08-27T09:00:00.000Z"),
    previousEndAt: new Date("2026-08-27T10:00:00.000Z"),
  };

  it("rejects a proposal after the source reservation changes", () => {
    expect(scheduleProposalSourceMatchesTask(proposal, {
      scheduledLocalDate: "2026-08-27", plannedStartAt: new Date("2026-08-27T11:00:00.000Z"), plannedEndAt: new Date("2026-08-27T12:00:00.000Z"),
    })).toBe(false);
  });

  it("accepts the exact reservation state the proposal reviewed", () => {
    expect(scheduleProposalSourceMatchesTask(proposal, {
      scheduledLocalDate: "2026-08-27", plannedStartAt: new Date("2026-08-27T09:00:00.000Z"), plannedEndAt: new Date("2026-08-27T10:00:00.000Z"),
    })).toBe(true);
  });

  it("rejects undo when the approved reservation was subsequently moved", () => {
    expect(scheduleProposalTargetMatchesTask({ localDate: "2026-08-28", proposedStartAt: new Date("2026-08-28T09:00:00.000Z"), proposedEndAt: new Date("2026-08-28T10:00:00.000Z") }, {
      scheduledLocalDate: "2026-08-28", plannedStartAt: new Date("2026-08-28T11:00:00.000Z"), plannedEndAt: new Date("2026-08-28T12:00:00.000Z"),
    })).toBe(false);
  });
});
