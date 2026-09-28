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
    ] }], returning: [] });
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
    ] });
  });
});
