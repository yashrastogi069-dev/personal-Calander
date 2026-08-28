import { describe, expect, it } from "vitest";
import { goalHealthNeedsAttention, goalHealthTriageCount, matchesGoalHealthTriage } from "@shared/goalHealthTriage";

describe("goal health triage", () => {
  const items = [
    { goalId: "behind", paceStatus: "behind" as const, isOverdue: false, reviewDue: false, hasExecutionCoverage: true, hasMilestoneCoverage: true, daysUntilDue: 18 },
    { goalId: "unlinked", paceStatus: "on_pace" as const, isOverdue: false, reviewDue: false, hasExecutionCoverage: false, hasMilestoneCoverage: false, daysUntilDue: 48 },
    { goalId: "fresh", paceStatus: "on_pace" as const, isOverdue: false, reviewDue: false, hasExecutionCoverage: true, hasMilestoneCoverage: true, daysUntilDue: null },
    { goalId: "review", paceStatus: "unavailable" as const, isOverdue: false, reviewDue: true, hasExecutionCoverage: true, hasMilestoneCoverage: false, daysUntilDue: 8 },
  ];

  it("keeps the attention view factual and limited to overdue, behind, or review-due signals", () => {
    expect(goalHealthNeedsAttention(items[0])).toBe(true);
    expect(goalHealthNeedsAttention(items[1])).toBe(false);
    expect(goalHealthTriageCount(items, "attention")).toBe(2);
  });

  it("separates missing execution evidence from missing dated milestone coverage", () => {
    expect(items.filter(item => matchesGoalHealthTriage(item, "execution")).map(item => item.goalId)).toEqual(["unlinked"]);
    expect(items.filter(item => matchesGoalHealthTriage(item, "milestones")).map(item => item.goalId)).toEqual(["unlinked", "review"]);
  });

  it("does not classify an unknown health record as actionable or hide it from all goals", () => {
    expect(matchesGoalHealthTriage(undefined, "all")).toBe(true);
    expect(matchesGoalHealthTriage(undefined, "attention")).toBe(false);
    expect(matchesGoalHealthTriage(undefined, "execution")).toBe(false);
  });
});
