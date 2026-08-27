import { describe, expect, it } from "vitest";
import { morningRolloverPreview } from "../shared/morningRollover";

const reserved = { id: "task-a", state: "in_progress", scheduledLocalDate: "2026-08-26", plannedStartAt: new Date("2026-08-26T09:00:00.000Z"), plannedEndAt: new Date("2026-08-26T09:30:00.000Z"), version: 4, rescheduleCount: 2 };

describe("manual morning rollover contract", () => {
  it("includes only unfinished task reservations for the reviewed completed day", () => {
    expect(morningRolloverPreview([reserved, { ...reserved, id: "completed", state: "completed" }, { ...reserved, id: "archived", state: "archived" }, { ...reserved, id: "other-day", scheduledLocalDate: "2026-08-25" }, { ...reserved, id: "no-end", plannedEndAt: null }], "2026-08-26", [])).toEqual([{ id: "task-a", expectedVersion: 4, rescheduleCount: 2, plannedStartAt: reserved.plannedStartAt, plannedEndAt: reserved.plannedEndAt }]);
  });

  it("excludes an audited task so preview and apply are idempotent by task and source day", () => {
    expect(morningRolloverPreview([reserved], "2026-08-26", ["task-a"])).toEqual([]);
  });
});
