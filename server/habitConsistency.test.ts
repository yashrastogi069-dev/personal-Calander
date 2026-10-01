import { describe, expect, it } from "vitest";
import { habitPeriodConsistency, longTermHabitEvidence } from "../shared/habitConsistency";

const habit = { id: "habit-1", name: "Read", frequency: "daily", schedule: {}, createdAt: new Date("2026-08-01T08:00:00.000Z"), archivedAt: null } as any;

describe("habit consistency evidence", () => {
  it("separates completion, intentional skip, recorded miss, and an unrecorded elapsed day", () => {
    expect(habitPeriodConsistency(habit, [{ habitId: "habit-1", localDate: "2026-08-01", state: "completed" }, { habitId: "habit-1", localDate: "2026-08-02", state: "skipped" }, { habitId: "habit-1", localDate: "2026-08-03", state: "missed" }], "2026-08-01", "2026-08-04")).toEqual({ scheduled: 4, completed: 1, skipped: 1, missed: 1, unrecorded: 1, pending: 0, consistencyPercent: 25 });
  });

  it("returns real period evidence rather than inferring an unsupported long-term score", () => {
    const evidence = longTermHabitEvidence(habit, [{ habitId: "habit-1", localDate: "2026-08-01", state: "completed" }], ["2026-08-01", "2026-09-01"]);
    expect(evidence[0].completed).toBe(1);
    expect(evidence[1].completed).toBe(0);
    expect(evidence[1].scheduled).toBeGreaterThan(0);
  });

  it("excludes future, pre-start, and off-cadence history from denominators without deleting recorded corrections", () => {
    const weekdayHabit = { ...habit, frequency: "days_of_week", schedule: { weekdays: [1, 3] } };
    expect(habitPeriodConsistency(weekdayHabit, [
      { habitId: "habit-1", localDate: "2026-07-31", state: "completed" },
      { habitId: "habit-1", localDate: "2026-08-02", state: "completed" },
      { habitId: "habit-1", localDate: "2026-08-03", state: "completed" },
    ], "2026-07-31", "2026-08-03")).toEqual({ scheduled: 1, completed: 1, skipped: 0, missed: 0, unrecorded: 0, pending: 0, consistencyPercent: 100 });
  });

  it("does not infer missed dates from an open week, today, future days, or a flexible weekly quota", () => {
    const empty = habitPeriodConsistency(habit, [], "2026-10-01", "2026-10-31", "2026-10-03");
    expect(empty).toEqual({ scheduled: 2, completed: 0, skipped: 0, missed: 0, unrecorded: 2, pending: 1, consistencyPercent: 0 });
    const weekly = { ...habit, frequency: "times_per_week", schedule: { timesPerWeek: 3 } };
    expect(habitPeriodConsistency(weekly, [{ habitId: habit.id, localDate: "2026-10-02", state: "completed" }], "2026-10-01", "2026-10-31", "2026-10-03")).toEqual({ scheduled: 0, completed: 1, skipped: 0, missed: 0, unrecorded: 0, pending: 0, consistencyPercent: null });
  });
});
