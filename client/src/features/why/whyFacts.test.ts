import { describe, expect, it } from "vitest";
import { whyItMatters, topReason } from "@shared/whyItMatters";
import { whyFactsFromSnapshot, whyHabitFromSnapshot } from "./whyFacts";

// A demo-shaped planner snapshot (the fields `server/planning.ts` returns), with DB-style extras the adapter ignores.
const NOW = new Date("2026-10-15T09:00:00+13:00");
const TZ = "Pacific/Auckland";

function demoSnapshot() {
  return {
    workspace: { id: "ws1", timezone: "Pacific/Auckland" },
    tasks: [
      { id: "t1", workspaceId: "ws1", title: "Tailor CV", state: "in_progress", horizon: "weekly", outcome: "none", goalId: null, projectId: "p1", dueLocalDate: "2026-10-16", scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, recurrenceRule: null, recurrenceAnchor: null, rescheduleCount: 0, archivedAt: null, createdAt: new Date("2026-09-01T00:00:00Z") },
      { id: "t2", workspaceId: "ws1", title: "Send Fonterra application", state: "not_started", horizon: "weekly", outcome: "none", dueLocalDate: "2026-10-20", rescheduleCount: 2, archivedAt: null },
      { id: null, title: "broken row" },
      "junk",
    ],
    goals: [{ id: "g1", title: "Land a graduate role", state: "in_progress", intentionKind: "outcome", dueLocalDate: "2026-11-04", archivedAt: null }],
    milestones: [{ id: "m1", goalId: "g1", title: "10 applications sent", state: "not_started", dueLocalDate: "2026-10-24", archivedAt: null }],
    projects: [{ id: "p1", title: "Job search sprint", state: "in_progress", goalId: "g1", dueLocalDate: null, riskLevel: "none", riskNote: null, archivedAt: null }],
    taskDependencies: [{ id: "e1", taskId: "t2", dependsOnTaskId: "t1", dependencyType: "hard" }],
    taskOccurrences: [],
    dailyPlans: [{ id: "dp1", localDate: "2026-10-15", state: "active" }],
    dailyPlanItems: [{ id: "i1", dailyPlanId: "dp1", taskId: "t1", state: "committed" }],
    weeklyObjectives: [],
    habits: [{ id: "h1", name: "Run", frequency: "daily", schedule: {}, goalId: null, archivedAt: null, createdAt: "2026-08-01T00:00:00.000Z" }],
    habitCheckIns: [
      { id: "c1", habitId: "h1", localDate: "2026-10-14", state: "completed" },
      { id: "c2", habitId: "h1", localDate: "2026-10-13", state: "completed" },
      { id: "c3", habitId: "h1", localDate: "2026-10-12", state: "completed" },
    ],
  };
}

describe("whyFactsFromSnapshot", () => {
  it("maps a demo snapshot into WhyFacts and drops unusable rows", () => {
    const facts = whyFactsFromSnapshot(demoSnapshot(), { rangeStart: "2026-08-01" });
    expect(facts.tasks.map(task => task.id)).toEqual(["t1", "t2"]);
    expect(facts.dependencies).toEqual([{ taskId: "t2", dependsOnTaskId: "t1", dependencyType: "hard" }]);
    expect(facts.dailyPlanItems).toEqual([{ dailyPlanId: "dp1", taskId: "t1", state: "committed" }]);
    expect(facts.milestones[0]).toMatchObject({ id: "m1", goalId: "g1" });
    expect(facts.habitCheckInsFrom).toBe("2026-08-01");
    expect(facts.snapshotAt).toBeNull();
  });

  it("feeds the engine end to end", () => {
    const snapshot = demoSnapshot();
    const facts = whyFactsFromSnapshot(snapshot);
    const t1 = facts.tasks.find(task => task.id === "t1")!;
    expect(whyItMatters({ kind: "task", task: t1 }, facts, NOW, TZ).map(reason => reason.kind)).toEqual(["deadline_soon", "unblocks", "in_today_plan", "milestone_soon"]);
    expect(topReason({ kind: "task", task: t1 }, facts, NOW, TZ, "task_row")?.short).toBe("Unblocks 1 task");
    const habit = whyHabitFromSnapshot(snapshot, "h1")!;
    expect(topReason({ kind: "habit", habit }, facts, NOW, TZ, "habit_row")?.short).toBe("3 day streak");
  });

  it("memoises per snapshot object and options", () => {
    const snapshot = demoSnapshot();
    const first = whyFactsFromSnapshot(snapshot, { snapshotAt: 1_760_000_000_000 });
    expect(whyFactsFromSnapshot(snapshot, { snapshotAt: 1_760_000_000_000 })).toBe(first);
    expect(whyFactsFromSnapshot(snapshot, { snapshotAt: 1_760_000_100_000 })).not.toBe(first);
    expect(whyFactsFromSnapshot(demoSnapshot(), { snapshotAt: 1_760_000_000_000 })).not.toBe(first);
  });

  it("a numeric snapshotAt (react-query dataUpdatedAt) becomes a Date; a missing snapshot gives empty facts", () => {
    const facts = whyFactsFromSnapshot(demoSnapshot(), { snapshotAt: Date.parse("2026-10-14T20:00:00+13:00") });
    expect(facts.snapshotAt).toBeInstanceOf(Date);
    const t1 = facts.tasks.find(task => task.id === "t1")!;
    // Stale: today's plan drops, the deadline stays.
    expect(whyItMatters({ kind: "task", task: t1 }, facts, NOW, TZ).map(reason => reason.kind)).not.toContain("in_today_plan");
    const empty = whyFactsFromSnapshot(undefined);
    expect(empty.tasks).toEqual([]);
    expect(whyHabitFromSnapshot(undefined, "h1")).toBeNull();
  });
});
