import { describe, expect, it } from "vitest";
import { habitWeeklyTarget, isHabitScheduledOnLocalDate } from "@shared/habitSchedule";

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

  it("treats a times-per-week quota as flexible weekly work, not seven daily due dates", () => {
    const habit = { frequency: "times_per_week" as const, schedule: { timesPerWeek: 3 } };
    expect(habitWeeklyTarget(habit)).toBe(3);
    expect(isHabitScheduledOnLocalDate(habit, "2026-10-01")).toBe(false);
    expect(isHabitScheduledOnLocalDate({ ...habit, schedule: { weekdays: [1, 3, 5] } }, "2026-10-05")).toBe(false);
    expect(habitWeeklyTarget({ ...habit, schedule: { weekdays: [1, 3, 5] } })).toBe(3);
    expect(habitWeeklyTarget({ ...habit, schedule: { count: 4 } })).toBe(4);
    expect(habitWeeklyTarget({ ...habit, schedule: { weekdays: [1, 3, 5, 5] } })).toBe(3);
  });

  it("suppresses only the explicit pause window and resumes on its review date", () => {
    const habit = { frequency: "daily" as const, schedule: { pauseStartedLocalDate: "2026-10-01", pauseUntilLocalDate: "2026-10-06" } };
    expect(isHabitScheduledOnLocalDate(habit, "2026-09-30")).toBe(true);
    expect(isHabitScheduledOnLocalDate(habit, "2026-10-01")).toBe(false);
    expect(isHabitScheduledOnLocalDate(habit, "2026-10-05")).toBe(false);
    expect(isHabitScheduledOnLocalDate(habit, "2026-10-06")).toBe(true);
  });
});
