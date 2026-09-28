import { describe, expect, it } from "vitest";
import { recoveryProjection, validateRecoveryDecision } from "../shared/recovery";

const base = {
  operationId: "decision-1",
  dailyPlanItemId: "item-1",
  taskId: "task-1",
  itemExpectedVersion: 2,
  taskExpectedVersion: 4,
};

describe("Strict recovery decision contract", () => {
  it("accepts done without a date or note", () => {
    expect(validateRecoveryDecision({ ...base, action: "done" })).toEqual({ ...base, action: "done" });
  });

  it.each([
    [{ ...base, action: "reschedule" }, "resolvedToLocalDate"],
    [{ ...base, action: "reduce", revisedScope: "One page" }, "resolvedToLocalDate"],
    [{ ...base, action: "reduce", resolvedToLocalDate: "2026-09-29", revisedScope: "  " }, "revisedScope"],
    [{ ...base, action: "pause" }, "returnLocalDate"],
    [{ ...base, action: "done", operationId: "" }, "operationId"],
    [{ ...base, action: "done", itemExpectedVersion: 0 }, "itemExpectedVersion"],
    [{ ...base, action: "done", taskExpectedVersion: 0 }, "taskExpectedVersion"],
    [{ ...base, action: "done", occurrenceId: "occ-1" }, "occurrenceExpectedVersion"],
    [{ ...base, action: "reschedule", resolvedToLocalDate: "2026-02-30" }, "resolvedToLocalDate"],
  ] as const)("rejects incomplete or invalid %j", (input, field) => {
    expect(() => validateRecoveryDecision(input)).toThrow(field);
  });

  it("accepts all five decisions with the required values and an occurrence version", () => {
    const cases = [
      { action: "done" },
      { action: "reschedule", resolvedToLocalDate: "2026-09-29" },
      { action: "reduce", revisedScope: "One page", resolvedToLocalDate: "2026-09-29" },
      { action: "pause", returnLocalDate: "2026-10-01" },
      { action: "abandon", decisionNote: "No longer relevant" },
    ] as const;
    for (const decision of cases) {
      expect(validateRecoveryDecision({ ...base, occurrenceId: "occ-1", occurrenceExpectedVersion: 3, ...decision })).toMatchObject(decision);
    }
  });

  it("requires a carry identity and version without pretending its root item is unresolved", () => {
    const carried = { operationId: "decision-2", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: "carry-1", carryExpectedVersion: 2, taskExpectedVersion: 4, action: "done" };
    expect(validateRecoveryDecision(carried)).toEqual(carried);
    expect(() => validateRecoveryDecision({ ...carried, itemExpectedVersion: 3 })).toThrow("sourceCarryId");
    expect(() => validateRecoveryDecision({ ...carried, carryExpectedVersion: undefined })).toThrow("sourceCarryId");
  });

  it("groups earlier unresolved references by task without collapsing distinct commitments", () => {
    const projection = recoveryProjection({
      todayLocalDate: "2026-09-28",
      plans: [
        { id: "day-1", localDate: "2026-09-20", state: "closed" },
        { id: "day-2", localDate: "2026-09-21", state: "active" },
        { id: "today", localDate: "2026-09-28", state: "active" },
      ],
      items: [
        { id: "item-1", dailyPlanId: "day-1", taskId: "task-1", state: "committed", version: 2 },
        { id: "item-2", dailyPlanId: "day-2", taskId: "task-1", state: "committed", version: 1 },
        { id: "item-3", dailyPlanId: "today", taskId: "task-1", state: "committed", version: 1 },
        { id: "item-4", dailyPlanId: "day-1", taskId: "task-2", state: "done", version: 2 },
      ],
    });
    expect(projection).toEqual({ count: 2, groups: [{ taskId: "task-1", commitments: [
      { itemId: "item-1", planLocalDate: "2026-09-20", itemVersion: 2 },
      { itemId: "item-2", planLocalDate: "2026-09-21", itemVersion: 1 },
    ] }], returning: [], nextCommitments: [] });
  });

  it("resurfaces a paused decision on its return day without reopening the old commitment", () => {
    const projection = recoveryProjection({
      todayLocalDate: "2026-10-01",
      plans: [{ id: "day-1", localDate: "2026-09-27", state: "active" }],
      items: [{ id: "item-1", dailyPlanId: "day-1", taskId: "task-1", state: "deferred", version: 3 }],
      resolutions: [{ id: "resolution-1", dailyPlanItemId: "item-1", taskId: "task-1", action: "pause", returnLocalDate: "2026-10-01" }],
    });
    expect(projection).toEqual({ count: 0, groups: [], returning: [
      { resolutionId: "resolution-1", itemId: "item-1", taskId: "task-1", returnLocalDate: "2026-10-01" },
    ], nextCommitments: [] });
  });

  it("gives the consumer a distinct reduced scope for a pending carried commitment", () => {
    const projection = recoveryProjection({
      todayLocalDate: "2026-09-30",
      plans: [],
      items: [{ id: "item-1", dailyPlanId: "day-1", taskId: "task-1", state: "deferred", version: 3 }],
      carries: [{ id: "carry-1", taskId: "task-1", rootDailyPlanItemId: "item-1", createdByResolutionId: "resolution-1", targetLocalDate: "2026-09-30", scope: "Write outline", state: "pending", version: 1 }],
      resolutions: [{ id: "resolution-1", dailyPlanItemId: "item-1", taskId: "task-1", action: "reduce", originalScope: "Write proposal", revisedScope: "Write outline", resolvedToLocalDate: "2026-09-30", returnLocalDate: null }],
    });
    expect(projection.nextCommitments).toEqual([{ carryId: "carry-1", carryVersion: 1, resolutionId: "resolution-1", sourceItemId: "item-1", taskId: "task-1", localDate: "2026-09-30", scope: "Write outline" }]);
  });

  it("returns a paused carried commitment by its own identity", () => {
    const projection = recoveryProjection({ todayLocalDate: "2026-10-01", plans: [], items: [{ id: "item-1", dailyPlanId: "old", taskId: "task-1", state: "rescheduled", version: 3 }],
      carries: [{ id: "carry-1", taskId: "task-1", rootDailyPlanItemId: "item-1", createdByResolutionId: "resolution-1", targetLocalDate: "2026-09-30", scope: "Draft", state: "paused", version: 2 }],
      resolutions: [{ id: "resolution-2", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: "carry-1", action: "pause", returnLocalDate: "2026-10-01" }] });
    expect(projection.returning).toEqual([{ resolutionId: "resolution-2", carryId: "carry-1", itemId: "item-1", taskId: "task-1", returnLocalDate: "2026-10-01" }]);
  });

  it("uses source-carry version, not row order or timestamps, for the current Pause return", () => {
    const projection = recoveryProjection({ todayLocalDate: "2026-10-02", plans: [],
      items: [{ id: "item-1", dailyPlanId: "old", taskId: "task-1", state: "rescheduled", version: 3 }],
      carries: [{ id: "carry-1", taskId: "task-1", rootDailyPlanItemId: "item-1", createdByResolutionId: "source", targetLocalDate: "2026-09-30", scope: "Draft", state: "paused", version: 3 }],
      resolutions: [
        { id: "latest", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: "carry-1", sourceCarryVersion: 2, action: "pause", returnLocalDate: "2026-11-01" },
        { id: "earlier", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: "carry-1", sourceCarryVersion: 1, action: "pause", returnLocalDate: "2026-10-01" },
      ] });
    expect(projection.returning).toEqual([]);
  });

  it("counts overdue pending carries independently of their resolved root items", () => {
    const projection = recoveryProjection({ todayLocalDate: "2026-10-01", plans: [],
      items: [{ id: "item-1", dailyPlanId: "old", taskId: "task-1", state: "rescheduled", version: 3 }],
      carries: [
        { id: "carry-1", taskId: "task-1", rootDailyPlanItemId: "item-1", createdByResolutionId: "resolution-1", targetLocalDate: "2026-09-30", scope: "Outline", state: "pending", version: 1 },
        { id: "carry-2", taskId: "task-1", rootDailyPlanItemId: "item-1", createdByResolutionId: "resolution-2", targetLocalDate: "2026-09-30", scope: "Summary", state: "pending", version: 1 },
      ] });
    expect(projection.count).toBe(2);
    expect(projection.groups[0].commitments).toMatchObject([{ carryId: "carry-1", scope: "Outline" }, { carryId: "carry-2", scope: "Summary" }]);
  });
});
