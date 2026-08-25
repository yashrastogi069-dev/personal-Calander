import { describe, expect, it } from "vitest";
import { currentHabitStreak, dashboardSummary, goalProgress, localDateSequence, longHorizonGoalHealth, recurringLocalDates, wouldCreateDependencyCycle } from "./plannerRules";

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

  it("returns to the prior streak when a same-day check-in is cleared", () => {
    const whileCompleted = currentHabitStreak(
      [
        { habitId: "habit-1", localDate: "2026-08-23", state: "completed" },
        { habitId: "habit-1", localDate: "2026-08-24", state: "completed" },
      ],
      "habit-1",
      "2026-08-24"
    );
    const afterUndo = currentHabitStreak(
      [{ habitId: "habit-1", localDate: "2026-08-23", state: "completed" }],
      "habit-1",
      "2026-08-24"
    );
    expect(whileCompleted).toBe(2);
    expect(afterUndo).toBe(1);
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

  it("surfaces carryover, blocked work, and focus completion as planning-health signals", () => {
    const summary = dashboardSummary({
      tasks: [
        { id: "carry", goalId: null, projectId: null, categoryId: null, state: "blocked", dueLocalDate: null, scheduledLocalDate: "2026-08-23", estimateMinutes: 20, completedAt: null },
        { id: "done", goalId: null, projectId: null, categoryId: null, state: "completed", dueLocalDate: null, scheduledLocalDate: "2026-08-24", estimateMinutes: 20, completedAt: new Date("2026-08-24T12:00:00.000Z") },
      ], goals: [], projectGoalById: new Map(), categoryNames: new Map(), habitCheckIns: [], habitIds: [], todayLocalDate: "2026-08-24", rangeStart: "2026-08-18", rangeEnd: "2026-08-24", capacityMinutes: 360,
    });
    expect(summary.planningHealth).toMatchObject({ carryoverCount: 1, blockedCount: 1, completedToday: 1, focusCompletionRate: 100, atRiskGoalCount: 0 });
    expect(summary.decisionSignals).toMatchObject({ scheduleReliability: 50, carryoverRate: 50, averageBlockedAgeDays: 0, estimateCoverage: 100, goalsWithVisibleProgress: 0 });
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

  it("rolls a yearly goal through nested monthly milestone evidence without double counting direct work", () => {
    const health = longHorizonGoalHealth({
      goals: [
        { id: "year", state: "in_progress", progressMode: "task", progressValue: 0, targetValue: 100, dueLocalDate: "2026-12-31" },
        { id: "quarter", parentGoalId: "year", state: "in_progress", progressMode: "task", progressValue: 0, targetValue: 100, dueLocalDate: "2026-09-30" },
      ],
      projects: [], tasks: [], habits: [], projectGoalById: new Map(), todayLocalDate: "2026-08-24",
      milestones: [
        { id: "m-1", goalId: "quarter", state: "completed", horizon: "monthly", progressValue: 0, targetValue: 10, dueLocalDate: "2026-08-31" },
        { id: "m-2", goalId: "quarter", state: "in_progress", horizon: "monthly", progressValue: 0, targetValue: 10, dueLocalDate: "2026-09-30" },
      ],
    });
    expect(health.find(item => item.goalId === "quarter")).toMatchObject({ progress: 50, progressSource: "milestones", hasMilestoneCoverage: true });
    expect(health.find(item => item.goalId === "year")).toMatchObject({ progress: 50, progressSource: "child_goals", childGoalCount: 1 });
  });

  it("uses dated pace only when it has a valid span and prioritizes an execution-backed goal that has fallen behind", () => {
    const health = longHorizonGoalHealth({
      goals: [{ id: "goal", state: "in_progress", progressMode: "measure", progressValue: 20, targetValue: 100, startLocalDate: "2026-08-01", dueLocalDate: "2026-08-31" }],
      projects: [], habits: [], milestones: [], projectGoalById: new Map(), todayLocalDate: "2026-08-21",
      tasks: [{ id: "task", goalId: "goal", projectId: null, categoryId: null, state: "in_progress", dueLocalDate: null, scheduledLocalDate: "2026-08-22", estimateMinutes: 30, completedAt: null }],
    });
    expect(health[0]).toMatchObject({ expectedProgress: 67, paceDelta: -47, paceStatus: "behind", nextAction: "review_plan", hasExecutionCoverage: true });
  });

  it("derives review freshness from completed persisted reviews and flags a missing review without inventing one", () => {
    const shared = {
      goals: [{ id: "goal", horizon: "monthly", state: "in_progress" as const, progressMode: "task" as const, progressValue: 0, targetValue: 100, dueLocalDate: null }],
      projects: [], habits: [], milestones: [], projectGoalById: new Map(), todayLocalDate: "2026-08-24",
      tasks: [{ id: "task", goalId: "goal", projectId: null, categoryId: null, state: "in_progress" as const, dueLocalDate: null, scheduledLocalDate: "2026-08-25", estimateMinutes: 30, completedAt: null }],
    };
    expect(longHorizonGoalHealth({ ...shared, reviewSessions: [] })[0]).toMatchObject({ reviewStatus: "due", reviewDue: true, lastReviewLocalDate: null, nextAction: "review_plan" });
    expect(longHorizonGoalHealth({ ...shared, reviewSessions: [{ kind: "weekly", state: "completed", periodEndLocalDate: "2026-08-17" }] })[0]).toMatchObject({ reviewStatus: "fresh", reviewDue: false, lastReviewLocalDate: "2026-08-17", nextAction: "none" });
  });

  it("keeps a corrupted circular goal hierarchy finite and reports an unavailable pace without dates", () => {
    const health = longHorizonGoalHealth({
      goals: [
        { id: "a", parentGoalId: "b", state: "in_progress", progressMode: "task", progressValue: 0, targetValue: 100, dueLocalDate: null },
        { id: "b", parentGoalId: "a", state: "in_progress", progressMode: "task", progressValue: 0, targetValue: 100, dueLocalDate: null },
      ], projects: [], habits: [], milestones: [], projectGoalById: new Map(), todayLocalDate: "2026-08-24", tasks: [],
    });
    expect(health).toHaveLength(2);
    expect(health.every(item => item.paceStatus === "unavailable" && item.nextAction === "add_execution")).toBe(true);
  });
});
