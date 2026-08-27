import { describe, expect, it } from "vitest";
import { taskPatchForDailyPlanOutcome } from "@shared/dailyPlanResolution";

describe("daily shutdown resolution", () => {
  const now = new Date("2026-08-27T10:00:00.000Z");

  it("maps done to completed work without changing its planned date", () => {
    expect(taskPatchForDailyPlanOutcome("done", now)).toEqual({ state: "completed", completedAt: now });
  });

  it("requires an explicit next plan date before rescheduling and clears a prior time reservation", () => {
    expect(() => taskPatchForDailyPlanOutcome("rescheduled", now)).toThrow("Choose the new Plan for date");
    expect(taskPatchForDailyPlanOutcome("rescheduled", now, "2026-08-28")).toEqual({ scheduledLocalDate: "2026-08-28", plannedStartAt: null, plannedEndAt: null });
  });

  it("distinguishes deferral, an intentional won’t-do outcome, and archive semantics", () => {
    expect(taskPatchForDailyPlanOutcome("deferred", now)).toEqual({ scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null });
    expect(taskPatchForDailyPlanOutcome("wont_do", now)).toEqual({ state: "archived", archivedAt: now, outcome: "wont_do", outcomeAt: now });
    expect(taskPatchForDailyPlanOutcome("archived", now)).toEqual({ state: "archived", archivedAt: now });
  });
});
