import { describe, expect, it } from "vitest";
import { isHabitScheduledOnLocalDate } from "@shared/habitSchedule";

describe("calendar habit schedule projection", () => {
  it("projects daily and selected-weekday habits onto the correct local calendar dates", () => {
    expect(isHabitScheduledOnLocalDate({ frequency: "daily", schedule: {} }, "2026-08-24")).toBe(true);
    expect(isHabitScheduledOnLocalDate({ frequency: "days_of_week", schedule: { weekdays: [1, 3, 5] } }, "2026-08-24")).toBe(true);
    expect(isHabitScheduledOnLocalDate({ frequency: "days_of_week", schedule: { weekdays: [1, 3, 5] } }, "2026-08-25")).toBe(false);
  });

  it("projects interval habits from their local anchor without showing dates before the series begins", () => {
    const habit = { frequency: "interval" as const, schedule: { startLocalDate: "2026-08-20", intervalDays: 3 } };
    expect(isHabitScheduledOnLocalDate(habit, "2026-08-20")).toBe(true);
    expect(isHabitScheduledOnLocalDate(habit, "2026-08-23")).toBe(true);
    expect(isHabitScheduledOnLocalDate(habit, "2026-08-22")).toBe(false);
    expect(isHabitScheduledOnLocalDate(habit, "2026-08-19")).toBe(false);
  });
});
