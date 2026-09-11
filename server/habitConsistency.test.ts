import { describe, expect, it } from "vitest";
import { habitPeriodConsistency, longTermHabitEvidence } from "../shared/habitConsistency";

const habit = { id: "habit-1", name: "Read", frequency: "daily", schedule: {}, createdAt: new Date("2026-08-01T08:00:00.000Z"), archivedAt: null } as any;

describe("habit consistency evidence", () => {
  it("separates completed, intentionally skipped, and missed scheduled days", () => {
    expect(habitPeriodConsistency(habit, [{ habitId: "habit-1", localDate: "2026-08-01", state: "completed" }, { habitId: "habit-1", localDate: "2026-08-02", state: "skipped" }], "2026-08-01", "2026-08-03")).toEqual({ scheduled: 3, completed: 1, skipped: 1, missed: 1, consistencyPercent: 33 });
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
    ], "2026-07-31", "2026-08-03")).toEqual({ scheduled: 1, completed: 1, skipped: 0, missed: 0, consistencyPercent: 100 });
  });
});
