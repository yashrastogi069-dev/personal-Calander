import { describe, expect, it } from "vitest";
import { currentHabitStreak, dashboardSummary, goalProgress, localDateSequence, recurringLocalDates, wouldCreateDependencyCycle } from "./plannerRules";

describe("planning rules", () => {
  it("calculates task-backed goal progress across direct and project-linked work", () => {
    const progress = goalProgress(
      { id: "goal-1", state: "in_progress", progressMode: "task", progressValue: 0, targetValue: 100, dueLocalDate: null },
      [
        { id: "a", goalId: "goal-1", projectId: null, categoryId: null, state: "completed", dueLocalDate: null, scheduledLocalDate: null, estimateMinutes: null, completedAt: new Date() },
        { id: "b", goalId: null, projectId: "project-1", categoryId: null, state: "in_progress", dueLocalDate: null, scheduledLocalDate: null, estimateMinutes: null, completedAt: null },
      ],
      new Map([["project-1", "goal-1"]])
    );
    expect(progress).toBe(50);
  });

  it("keeps a skipped habit day out of the streak denominator", () => {
    const streak = currentHabitStreak(
      [
        { habitId: "habit-1", localDate: "2026-08-22", state: "completed" },
        { habitId: "habit-1", localDate: "2026-08-23", state: "skipped" },
        { habitId: "habit-1", localDate: "2026-08-24", state: "completed" },
      ],
      "habit-1",
      "2026-08-24"
    );
    expect(streak).toBe(2);
  });

  it("generates an inclusive local-date range", () => {
    expect(localDateSequence("2026-08-22", "2026-08-24")).toEqual(["2026-08-22", "2026-08-23", "2026-08-24"]);
  });

  it("carries a local date safely across a month boundary", () => {
    expect(localDateSequence("2026-01-30", "2026-02-02")).toEqual(["2026-01-30", "2026-01-31", "2026-02-01", "2026-02-02"]);
  });

  it("generates weekly occurrences on selected weekdays without crossing the series end", () => {
    expect(recurringLocalDates({ frequency: "weekly", weekdays: [1, 3, 5] }, "2026-08-24", "2026-09-06", "2026-09-02")).toEqual([
      "2026-08-24", "2026-08-26", "2026-08-28", "2026-08-31", "2026-09-02",
    ]);
  });

  it("breaks a habit streak on a missed eligible day", () => {
    const streak = currentHabitStreak(
      [
        { habitId: "habit-1", localDate: "2026-08-22", state: "completed" },
        { habitId: "habit-1", localDate: "2026-08-23", state: "missed" },
        { habitId: "habit-1", localDate: "2026-08-24", state: "completed" },
      ],
      "habit-1",
      "2026-08-24"
    );
    expect(streak).toBe(1);
  });

  it("clamps measured goal progress to a readable percentage", () => {
    const progress = goalProgress(
      { id: "goal-1", state: "in_progress", progressMode: "measure", progressValue: 180, targetValue: 100, dueLocalDate: null },
      [],
      new Map()
    );
    expect(progress).toBe(100);
  });

  it("rejects a dependency that would create a task cycle", () => {
    expect(wouldCreateDependencyCycle([{ taskId: "task-b", dependsOnTaskId: "task-a" }], "task-a", "task-b")).toBe(true);
    expect(wouldCreateDependencyCycle([{ taskId: "task-b", dependsOnTaskId: "task-a" }], "task-c", "task-b")).toBe(false);
  });

  it("flags an over-capacity day without excluding its scheduled tasks", () => {
    const summary = dashboardSummary({
      tasks: [{ id: "task-1", goalId: null, projectId: null, categoryId: null, state: "in_progress", dueLocalDate: null, scheduledLocalDate: "2026-08-24", estimateMinutes: 480, completedAt: null }],
      goals: [],
      projectGoalById: new Map(),
      categoryNames: new Map(),
      habitCheckIns: [],
      habitIds: [],
      todayLocalDate: "2026-08-24",
      rangeStart: "2026-08-18",
      rangeEnd: "2026-08-24",
      capacityMinutes: 360,
    });
    expect(summary.counts.today).toBe(1);
    expect(summary.workload.isOverCapacity).toBe(true);
  });

  it("exposes a per-habit streak value in the dashboard summary", () => {
    const summary = dashboardSummary({
      tasks: [],
      goals: [],
      projectGoalById: new Map(),
      categoryNames: new Map(),
      habitCheckIns: [
        { habitId: "habit-1", localDate: "2026-08-23", state: "completed" },
        { habitId: "habit-1", localDate: "2026-08-24", state: "completed" },
      ],
      habitIds: ["habit-1"],
      todayLocalDate: "2026-08-24",
      rangeStart: "2026-08-18",
      rangeEnd: "2026-08-24",
      capacityMinutes: 360,
    });
    expect(summary.streaks).toEqual([{ habitId: "habit-1", streak: 2 }]);
  });
});
