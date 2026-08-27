import { defaultTaskReservationMinutes, isTaskCalendarProjection, reservationConflictMessage, roundedTaskReservationMinutes, taskReservationGridMinutes, validateTaskReservation, validateTaskReservationWindow } from "./taskReservation";

describe("task-owned calendar reservations", () => {
  it("uses a visible 30-minute default without silently inventing an effort estimate", () => {
    expect(defaultTaskReservationMinutes).toBe(30);
    expect(roundedTaskReservationMinutes(null)).toBe(30);
    expect(roundedTaskReservationMinutes(20)).toBe(30);
    expect(roundedTaskReservationMinutes(46)).toBe(60);
  });

  it("requires a positive, same-day reservation on the 15-minute grid", () => {
    const valid = { localDate: "2026-08-28", timezone: "UTC", plannedStartAt: new Date("2026-08-28T09:00:00.000Z"), plannedEndAt: new Date("2026-08-28T09:30:00.000Z") };
    expect(validateTaskReservation(valid)).toBeNull();
    expect(validateTaskReservation({ ...valid, plannedEndAt: new Date("2026-08-28T09:20:00.000Z") })).toBe(`Use ${taskReservationGridMinutes}-minute calendar increments.`);
    expect(validateTaskReservation({ ...valid, plannedEndAt: new Date("2026-08-29T09:30:00.000Z") })).toMatch(/selected calendar day/);
    expect(validateTaskReservation({ ...valid, plannedEndAt: new Date("2026-08-28T08:45:00.000Z") })).toMatch(/end after/);
  });

  it("detects external or other-task busy overlap but permits adjacent slots", () => {
    const busy = [{ startsAt: new Date("2026-08-28T09:00:00.000Z"), endsAt: new Date("2026-08-28T09:30:00.000Z") }];
    expect(reservationConflictMessage({ startsAt: new Date("2026-08-28T09:15:00.000Z"), endsAt: new Date("2026-08-28T09:45:00.000Z") }, busy)).toMatch(/overlaps/);
    expect(reservationConflictMessage({ startsAt: new Date("2026-08-28T09:30:00.000Z"), endsAt: new Date("2026-08-28T10:00:00.000Z") }, busy)).toBeNull();
  });

  it("rejects a timebox that cannot fit the declared available work window", () => {
    expect(validateTaskReservationWindow({ timezone: "UTC", plannedStartAt: new Date("2026-08-28T16:45:00.000Z"), plannedEndAt: new Date("2026-08-28T17:30:00.000Z"), workdayStartsAt: "09:00", workdayEndsAt: "17:00" })).toMatch(/available work window/);
    expect(validateTaskReservationWindow({ timezone: "UTC", plannedStartAt: new Date("2026-08-28T09:00:00.000Z"), plannedEndAt: new Date("2026-08-28T09:30:00.000Z"), workdayStartsAt: "09:00", workdayEndsAt: "17:00" })).toBeNull();
  });

  it("projects only unfinished task-owned blocks, so completing or archiving the task removes the calendar block", () => {
    const reserved = { plannedStartAt: new Date("2026-08-28T09:00:00.000Z"), plannedEndAt: new Date("2026-08-28T09:30:00.000Z") };
    expect(isTaskCalendarProjection({ ...reserved, state: "not_started" })).toBe(true);
    expect(isTaskCalendarProjection({ ...reserved, state: "completed" })).toBe(false);
    expect(isTaskCalendarProjection({ ...reserved, state: "archived" })).toBe(false);
  });
});
