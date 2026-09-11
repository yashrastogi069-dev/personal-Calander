import { describe, expect, it } from "vitest";
import { defaultTaskReservationMinutes, isTaskCalendarProjection, reservationConflictMessage, roundedTaskReservationMinutes, taskReservationGridMinutes, validateTaskReservation, validateTaskReservationWindow } from "../shared/taskReservation";

describe("task-owned reservation contracts", () => {
  it("uses a disclosed 30-minute fallback and rounds explicit effort to the 15-minute grid", () => {
    expect(defaultTaskReservationMinutes).toBe(30);
    expect(taskReservationGridMinutes).toBe(15);
    expect(roundedTaskReservationMinutes(null)).toBe(30);
    expect(roundedTaskReservationMinutes(31)).toBe(45);
  });

  it("rejects invalid dates, off-grid slots, cross-day reservations, and overlapping busy intervals", () => {
    expect(validateTaskReservation({ timezone: "UTC", localDate: "2026-08-28", plannedStartAt: new Date("2026-08-28T09:01:00.000Z"), plannedEndAt: new Date("2026-08-28T09:31:00.000Z") })).toContain("15-minute");
    expect(validateTaskReservation({ timezone: "UTC", localDate: "2026-08-28", plannedStartAt: new Date("2026-08-28T23:45:00.000Z"), plannedEndAt: new Date("2026-08-29T00:15:00.000Z") })).toContain("selected calendar day");
    expect(reservationConflictMessage({ startsAt: new Date("2026-08-28T09:15:00.000Z"), endsAt: new Date("2026-08-28T09:45:00.000Z") }, [{ startsAt: new Date("2026-08-28T09:00:00.000Z"), endsAt: new Date("2026-08-28T10:00:00.000Z") }])).toContain("overlaps");
  });

  it("rejects a timebox outside work hours and projects only unfinished task-owned blocks", () => {
    expect(validateTaskReservationWindow({ timezone: "UTC", plannedStartAt: new Date("2026-08-28T08:45:00.000Z"), plannedEndAt: new Date("2026-08-28T09:15:00.000Z"), workdayStartsAt: "09:00", workdayEndsAt: "17:00" })).toContain("available work window");
    const reservation = { plannedStartAt: new Date("2026-08-28T09:00:00.000Z"), plannedEndAt: new Date("2026-08-28T09:30:00.000Z") };
    expect(isTaskCalendarProjection({ ...reservation, state: "not_started" })).toBe(true);
    expect(isTaskCalendarProjection({ ...reservation, state: "completed" })).toBe(false);
    expect(isTaskCalendarProjection({ ...reservation, state: "archived" })).toBe(false);
  });
});
