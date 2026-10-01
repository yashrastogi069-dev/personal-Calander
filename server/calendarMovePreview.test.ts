import { describe, expect, it } from "vitest";
import { assertCalendarPreviewFresh, previewCalendarMutation } from "../shared/calendarMovePreview";

const task = {
  id: "task-1", title: "Write proposal", version: 4,
  scheduledLocalDate: "2026-08-27", dueLocalDate: "2026-08-31",
  plannedStartAt: "2026-08-27T09:00:00.000Z", plannedEndAt: "2026-08-27T10:00:00.000Z",
  estimateMinutes: null,
};
const context = {
  timezone: "UTC", window: { workdayStartsAt: "09:00", workdayEndsAt: "17:00", defaultBreakMinutes: 30 },
};

describe("calendar mutation preview", () => {
  it("moves a planned day without changing the deadline or owned reservation", () => {
    const before = structuredClone(task);
    const preview = previewCalendarMutation({ task, mutation: { kind: "planned_day", localDate: "2026-08-28" }, context });
    expect(preview.apply).toEqual({ id: "task-1", expectedVersion: 4, patch: { scheduledLocalDate: "2026-08-28" } });
    expect(preview.undo).toEqual({ id: "task-1", expectedVersion: 5, patch: { scheduledLocalDate: "2026-08-27" } });
    expect(task).toEqual(before);
  });

  it("moves a reservation without changing the deadline or estimate", () => {
    const preview = previewCalendarMutation({ task, mutation: { kind: "reservation", localDate: "2026-08-28", startsAt: "2026-08-28T11:00:00.000Z", endsAt: "2026-08-28T12:00:00.000Z" }, context });
    expect(preview.kind).toBe("reservation");
    expect(preview.reservation).toEqual({ localDate: "2026-08-28", plannedStartAt: new Date("2026-08-28T11:00:00.000Z"), plannedEndAt: new Date("2026-08-28T12:00:00.000Z") });
    expect(preview.apply?.patch).toEqual({ scheduledLocalDate: "2026-08-28", plannedStartAt: new Date("2026-08-28T11:00:00.000Z"), plannedEndAt: new Date("2026-08-28T12:00:00.000Z") });
    expect(preview.undo?.patch).toEqual({ scheduledLocalDate: "2026-08-27", plannedStartAt: new Date("2026-08-27T09:00:00.000Z"), plannedEndAt: new Date("2026-08-27T10:00:00.000Z") });
    expect(preview.warnings).toContain("Focus-time estimate is unknown; the reserved duration does not change it.");
  });

  it("resizes only the reservation end and leaves focus-time estimate alone", () => {
    const preview = previewCalendarMutation({ task, mutation: { kind: "reservation", localDate: "2026-08-27", startsAt: "2026-08-27T09:00:00.000Z", endsAt: "2026-08-27T10:30:00.000Z" }, context });
    expect(preview.apply?.patch).toEqual({ plannedEndAt: new Date("2026-08-27T10:30:00.000Z") });
    expect(preview.changes.map(change => change.field)).toEqual(["plannedEndAt"]);
  });

  it("changes a deadline only through a labelled deadline edit", () => {
    const preview = previewCalendarMutation({ task, mutation: { kind: "deadline", localDate: "2026-09-02" }, context });
    expect(preview.apply?.patch).toEqual({ dueLocalDate: "2026-09-02" });
    expect(preview.changes[0]?.label).toContain("Deadline");
  });

  it("names colliding task and external event and blocks Apply", () => {
    const preview = previewCalendarMutation({ task, mutation: { kind: "reservation", localDate: "2026-08-27", startsAt: "2026-08-27T11:00:00.000Z", endsAt: "2026-08-27T12:00:00.000Z" }, context: { ...context, reservations: [{ id: "task-2", title: "Budget review", startsAt: "2026-08-27T10:30:00.000Z", endsAt: "2026-08-27T11:30:00.000Z" }], externalBusy: [{ id: "event-1", title: "Team meeting", startsAt: "2026-08-27T11:30:00.000Z", endsAt: "2026-08-27T12:30:00.000Z" }] } });
    expect(preview.collisions.map(item => item.title)).toEqual(["Budget review", "Team meeting"]);
    expect(preview.apply).toBeNull();
  });

  it("names one collision when the same busy source has overlapping intervals", () => {
    const preview = previewCalendarMutation({ task, mutation: { kind: "reservation", localDate: "2026-08-27", startsAt: "2026-08-27T11:00:00.000Z", endsAt: "2026-08-27T12:00:00.000Z" }, context: { ...context, externalBusy: [
      { id: "event-1", title: "Team meeting", startsAt: "2026-08-27T10:30:00.000Z", endsAt: "2026-08-27T11:30:00.000Z" },
      { id: "event-1", title: "Team meeting", startsAt: "2026-08-27T11:15:00.000Z", endsAt: "2026-08-27T12:15:00.000Z" },
    ] } });
    expect(preview.collisions).toEqual([{ id: "event-1", title: "Team meeting", kind: "external" }]);
  });

  it("blocks reservation on an unavailable day", () => {
    const preview = previewCalendarMutation({ task, mutation: { kind: "reservation", localDate: "2026-08-28", startsAt: "2026-08-28T11:00:00.000Z", endsAt: "2026-08-28T12:00:00.000Z" }, context: { ...context, isUnavailable: true } });
    expect(preview.apply).toBeNull();
    expect(preview.warnings.join(" ")).toMatch(/unavailable/i);
  });

  it("rejects a stale source before Apply or undo", () => {
    const preview = previewCalendarMutation({ task, mutation: { kind: "deadline", localDate: "2026-09-02" }, context });
    expect(() => assertCalendarPreviewFresh(preview, { id: "task-1", version: 5 }, "apply")).toThrow(/changed/i);
    expect(() => assertCalendarPreviewFresh(preview, { id: "task-1", version: 6 }, "undo")).toThrow(/changed/i);
    expect(assertCalendarPreviewFresh(preview, { id: "task-1", version: 4 }, "apply")).toEqual(preview.apply);
    expect(assertCalendarPreviewFresh(preview, { id: "task-1", version: 5 }, "undo")).toEqual(preview.undo);
  });
});
