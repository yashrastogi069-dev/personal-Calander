import { describe, expect, it } from "vitest";
import { habitStreak as dashboardHabitStreak } from "@/features/dashboard/dashboardModel";
import { weekStartFor } from "@/features/planning/planBoard";
import { reservedLocalDate } from "@shared/taskBuckets";
import {
  WHY_EMPTY_MESSAGES,
  WHY_WINDOWS,
  mondayWeekStart,
  reasonsForSurface,
  topReason,
  whyDetailSection,
  whyItMatters,
  type WhyEntity,
  type WhyFacts,
  type WhyHabit,
  type WhyReason,
  type WhyReasonKind,
  type WhyTask,
} from "@shared/whyItMatters";

// Spec D4 §4.4. Fixed clock: Thu 15 Oct 2026, 09:00 NZDT (UTC+13).
const TZ = "Pacific/Auckland";
const NOW = new Date("2026-10-15T09:00:00+13:00");
const TODAY = "2026-10-15";

function task(overrides: Partial<WhyTask> = {}): WhyTask {
  return { id: "t1", title: "Tailor CV for the Fonterra role", state: "not_started", horizon: "weekly", outcome: "none", archivedAt: null, goalId: null, projectId: null, dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, recurrenceRule: null, rescheduleCount: 0, createdAt: "2026-09-01T00:00:00.000Z", ...overrides };
}

function facts(overrides: Partial<WhyFacts> = {}): WhyFacts {
  return { tasks: [], goals: [], milestones: [], projects: [], dependencies: [], occurrences: [], dailyPlans: [], dailyPlanItems: [], weeklyObjectives: [], habitCheckIns: [], snapshotAt: null, ...overrides };
}

function why(t: WhyTask, f: WhyFacts = facts(), now: Date = NOW, tz: string = TZ) {
  return whyItMatters({ kind: "task", task: t }, { ...f, tasks: f.tasks.length ? f.tasks : [t] }, now, tz);
}

function kinds(reasons: readonly WhyReason[]) {
  return reasons.map(item => item.kind);
}

function find(reasons: readonly WhyReason[], kind: WhyReasonKind) {
  return reasons.find(item => item.kind === kind);
}

const goal = { id: "g1", title: "Land a graduate role", state: "in_progress", intentionKind: "outcome", dueLocalDate: "2026-11-04", archivedAt: null };
const project = { id: "p1", title: "Job search sprint", state: "in_progress", goalId: null, dueLocalDate: null, riskLevel: "none", riskNote: null, archivedAt: null };

function habit(overrides: Partial<WhyHabit> = {}): WhyHabit {
  return { id: "h1", name: "Run", frequency: "daily", schedule: {}, goalId: null, archivedAt: null, createdAt: "2026-08-01T00:00:00.000Z", ...overrides };
}

function completedDays(habitId: string, from: string, count: number) {
  const start = new Date(`${from}T12:00:00.000Z`);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(day.getUTCDate() - index);
    return { habitId, localDate: day.toISOString().slice(0, 10), state: "completed" };
  });
}

function whyHabit(h: WhyHabit, f: WhyFacts, now: Date = NOW) {
  return whyItMatters({ kind: "habit", habit: h }, f, now, TZ);
}

describe("whyItMatters: deadlines", () => {
  it("1. missed deadline gives Overdue 3 days and names Mon 12 Oct", () => {
    const reasons = why(task({ dueLocalDate: "2026-10-12" }));
    const missed = find(reasons, "deadline_missed")!;
    expect(missed.short).toBe("Overdue 3 days");
    expect(missed.long).toBe("The deadline was Mon 12 Oct, 3 days ago.");
    expect(missed.tone).toBe("off");
    expect(missed.icon).toBe("CalendarX2");
  });

  it("2. deadline yesterday reads Overdue 1 day / The deadline was yesterday.", () => {
    const missed = find(why(task({ dueLocalDate: "2026-10-14" })), "deadline_missed")!;
    expect(missed.short).toBe("Overdue 1 day");
    expect(missed.long).toBe("The deadline was yesterday.");
  });

  it("3. deadline today with no plan: Due today, Not planned yet, risk", () => {
    const soon = find(why(task({ dueLocalDate: TODAY })), "deadline_soon")!;
    expect(soon.short).toBe("Due today");
    expect(soon.long.endsWith("Not planned yet.")).toBe(true);
    expect(soon.tone).toBe("risk");
  });

  it("4. deadline in 3 days with Plan for on the deadline: Due in 3 days, planned, neutral", () => {
    const soon = find(why(task({ dueLocalDate: "2026-10-18", scheduledLocalDate: "2026-10-18" })), "deadline_soon")!;
    expect(soon.short).toBe("Due in 3 days");
    expect(soon.long).toBe("Due Sun 18 Oct.");
    expect(soon.tone).toBe("neutral");
  });

  it("5. deadline in 4 days gives no deadline reason", () => {
    const reasons = why(task({ dueLocalDate: "2026-10-19" }));
    expect(kinds(reasons).filter(kind => kind.startsWith("deadline"))).toEqual([]);
  });

  it("deadline tomorrow is risk; in 2 days is neutral", () => {
    expect(find(why(task({ dueLocalDate: "2026-10-16" })), "deadline_soon")).toMatchObject({ short: "Due tomorrow", tone: "risk" });
    expect(find(why(task({ dueLocalDate: "2026-10-17" })), "deadline_soon")).toMatchObject({ short: "Due in 2 days", tone: "neutral" });
  });
});

describe("whyItMatters: dependencies", () => {
  const blocker = task({ id: "t1", title: "Tailor CV" });
  const depA = task({ id: "d1", title: "Send Fonterra application", dueLocalDate: "2026-10-20" });
  const depB = task({ id: "d2", title: "Book interview prep", dueLocalDate: "2026-10-18" });
  const depDone = task({ id: "d3", title: "Old dependent", state: "completed", dueLocalDate: "2026-10-16" });
  const hard = (taskId: string) => ({ taskId, dependsOnTaskId: "t1", dependencyType: "hard" as const });

  it("6. blocks 2 open tasks and 1 completed: Unblocks 2 tasks, names the earliest deadline", () => {
    const f = facts({ tasks: [blocker, depA, depB, depDone], dependencies: [hard("d1"), hard("d2"), hard("d3")] });
    const unblocks = find(why(blocker, f), "unblocks")!;
    expect(unblocks.short).toBe("Unblocks 2 tasks");
    expect(unblocks.long).toBe("2 tasks are waiting on this, including “Book interview prep”.");
    expect(unblocks.ref).toEqual({ kind: "task", id: "d2" });
    expect(unblocks.basis.count).toBe(2);
  });

  it("one dependent reads “X” is waiting on this.", () => {
    const f = facts({ tasks: [blocker, depA], dependencies: [hard("d1")] });
    expect(find(why(blocker, f), "unblocks")).toMatchObject({ short: "Unblocks 1 task", long: "“Send Fonterra application” is waiting on this." });
  });

  it("won't-do and archived dependents do not count", () => {
    const wont = task({ id: "d4", title: "Dropped", outcome: "wont_do" });
    const archived = task({ id: "d5", title: "Shelved", archivedAt: "2026-10-01T00:00:00.000Z" });
    const f = facts({ tasks: [blocker, wont, archived], dependencies: [hard("d4"), hard("d5")] });
    expect(find(why(blocker, f), "unblocks")).toBeUndefined();
  });

  it("7. a dependent missing from facts.tasks is ignored", () => {
    const f = facts({ tasks: [blocker], dependencies: [hard("ghost")] });
    expect(find(why(blocker, f), "unblocks")).toBeUndefined();
  });

  it("8. soft dependency only gives no unblocks", () => {
    const f = facts({ tasks: [blocker, depA], dependencies: [{ taskId: "d1", dependsOnTaskId: "t1", dependencyType: "soft" }] });
    expect(find(why(blocker, f), "unblocks")).toBeUndefined();
  });
});

describe("whyItMatters: today's plan", () => {
  it("9. committed in today's active plan fires; yesterday's plan does not", () => {
    const t = task();
    const today = facts({ dailyPlans: [{ id: "dp1", localDate: TODAY, state: "active" }], dailyPlanItems: [{ dailyPlanId: "dp1", taskId: "t1", state: "committed" }] });
    expect(find(why(t, today), "in_today_plan")).toMatchObject({ short: "On today's plan", long: "You committed to this in today's plan.", ref: { kind: "daily_plan", id: "dp1" } });
    const yesterday = facts({ dailyPlans: [{ id: "dp0", localDate: "2026-10-14", state: "active" }], dailyPlanItems: [{ dailyPlanId: "dp0", taskId: "t1", state: "committed" }] });
    expect(why(t, yesterday)).toEqual([]);
  });

  it("10. committed in today's archived plan gives nothing", () => {
    const f = facts({ dailyPlans: [{ id: "dp1", localDate: TODAY, state: "archived" }], dailyPlanItems: [{ dailyPlanId: "dp1", taskId: "t1", state: "committed" }] });
    expect(why(task(), f)).toEqual([]);
  });

  it("a draft plan counts; a done item does not", () => {
    const draft = facts({ dailyPlans: [{ id: "dp1", localDate: TODAY, state: "draft" }], dailyPlanItems: [{ dailyPlanId: "dp1", taskId: "t1", state: "committed" }] });
    expect(kinds(why(task(), draft))).toEqual(["in_today_plan"]);
    const done = facts({ dailyPlans: [{ id: "dp1", localDate: TODAY, state: "active" }], dailyPlanItems: [{ dailyPlanId: "dp1", taskId: "t1", state: "done" }] });
    expect(why(task(), done)).toEqual([]);
  });
});

describe("whyItMatters: goals, milestones, projects", () => {
  it("11. milestone in 9 days wins the goal family over a goal due in 20 days", () => {
    const g = { ...goal, dueLocalDate: "2026-11-04" };
    const f = facts({ goals: [g], milestones: [{ id: "m1", goalId: "g1", title: "10 applications sent", state: "not_started", dueLocalDate: "2026-10-24" }] });
    const reasons = why(task({ goalId: "g1" }), f);
    expect(kinds(reasons)).toEqual(["milestone_soon"]);
    expect(reasons[0].short).toBe("Milestone in 9 days");
    expect(reasons[0].long).toBe("Your goal “Land a graduate role” has a milestone, “10 applications sent”, due Sat 24 Oct.");
    expect(reasons[0].ref).toEqual({ kind: "milestone", id: "m1" });
  });

  it("milestone today and nearest milestone wins; completed milestones are skipped", () => {
    const f = facts({ goals: [goal], milestones: [
      { id: "m2", goalId: "g1", title: "Later", state: "not_started", dueLocalDate: "2026-10-20" },
      { id: "m1", goalId: "g1", title: "Now", state: "not_started", dueLocalDate: TODAY },
      { id: "m0", goalId: "g1", title: "Done", state: "completed", dueLocalDate: TODAY },
    ] });
    expect(find(why(task({ goalId: "g1" }), f), "milestone_soon")).toMatchObject({ short: "Milestone today", ref: { id: "m1" } });
  });

  it("12. goal resolves through the project when task.goalId is null", () => {
    const g = { ...goal, dueLocalDate: "2026-11-04" };
    const f = facts({ goals: [g], projects: [{ ...project, goalId: "g1" }] });
    const reasons = why(task({ projectId: "p1" }), f);
    expect(find(reasons, "goal_due_soon")).toMatchObject({ short: "Goal due in 20 days", long: "This supports “Land a graduate role”, due Wed 4 Nov.", ref: { kind: "goal", id: "g1" } });
  });

  it("13. task.goalId to a goal not in facts: no goal reason, no crash, no id in copy", () => {
    const reasons = why(task({ goalId: "goal-missing-123" }), facts());
    expect(reasons).toEqual([]);
    expect(JSON.stringify(reasons)).not.toContain("goal-missing-123");
  });

  it("14. completed goal gives no goal reason, including no goal_link", () => {
    const f = facts({ goals: [{ ...goal, state: "completed" }] });
    expect(why(task({ goalId: "g1" }), f)).toEqual([]);
    const archived = facts({ goals: [{ ...goal, archivedAt: "2026-10-01T00:00:00.000Z" }] });
    expect(why(task({ goalId: "g1" }), archived)).toEqual([]);
  });

  it("15. direction goal with a due date: no goal_due_soon, goal_link still fires", () => {
    const f = facts({ goals: [{ ...goal, intentionKind: "direction", dueLocalDate: "2026-10-25" }] });
    const reasons = why(task({ goalId: "g1" }), f);
    expect(kinds(reasons)).toEqual(["goal_link"]);
    expect(reasons[0]).toMatchObject({ short: "Supports a goal", long: "This supports “Land a graduate role”.", tone: "neutral", icon: "Target" });
  });

  it("goal due beyond 30 days falls back to goal_link", () => {
    const f = facts({ goals: [{ ...goal, dueLocalDate: "2026-11-20" }] });
    expect(kinds(why(task({ goalId: "g1" }), f))).toEqual(["goal_link"]);
  });

  it("16. project past its date is risk, and wins the project family over at_risk", () => {
    const f = facts({ projects: [{ ...project, dueLocalDate: "2026-10-10", riskLevel: "at_risk" }] });
    const reasons = why(task({ projectId: "p1" }), f);
    expect(kinds(reasons)).toEqual(["project_due"]);
    expect(reasons[0]).toMatchObject({ short: "Project past its date", tone: "risk", long: "Part of “Job search sprint”, which passed its date on 10 Oct." });
  });

  it("project due within 14 days is neutral with a date", () => {
    const f = facts({ projects: [{ ...project, dueLocalDate: "2026-10-20" }] });
    expect(find(why(task({ projectId: "p1" }), f), "project_due")).toMatchObject({ short: "Project due in 5 days", tone: "neutral", long: "Part of “Job search sprint”, due Tue 20 Oct." });
    const far = facts({ projects: [{ ...project, dueLocalDate: "2026-10-30" }] });
    expect(why(task({ projectId: "p1" }), far)).toEqual([]);
  });

  it("project at risk with a note; blocked state reads Project blocked", () => {
    const f = facts({ projects: [{ ...project, riskLevel: "at_risk", riskNote: "Waiting on referee replies" }] });
    expect(find(why(task({ projectId: "p1" }), f), "project_at_risk")).toMatchObject({ short: "Project at risk", tone: "risk", long: "“Job search sprint” is marked at risk: Waiting on referee replies." });
    const blocked = facts({ projects: [{ ...project, state: "blocked" }] });
    expect(find(why(task({ projectId: "p1" }), blocked), "project_at_risk")).toMatchObject({ short: "Project blocked", long: "“Job search sprint” is marked blocked." });
  });

  it("17. project riskLevel watch gives no project_at_risk", () => {
    const f = facts({ projects: [{ ...project, riskLevel: "watch" }] });
    expect(why(task({ projectId: "p1" }), f)).toEqual([]);
  });

  it("an archived project gives no project reason", () => {
    const f = facts({ projects: [{ ...project, state: "archived", dueLocalDate: "2026-10-10" }] });
    expect(why(task({ projectId: "p1" }), f)).toEqual([]);
  });
});

describe("whyItMatters: week, history, repeats", () => {
  it("18. active objective this week on the task's project fires; last week's does not", () => {
    const thisWeek = facts({ projects: [project], weeklyObjectives: [{ id: "w1", title: "Send 5 applications", state: "active", weekStartLocalDate: "2026-10-12", projectId: "p1", goalId: null }] });
    expect(find(why(task({ projectId: "p1" }), thisWeek), "weekly_objective")).toMatchObject({ short: "This week's aim", long: "Part of this week's aim: “Send 5 applications”.", ref: { kind: "weekly_objective", id: "w1" } });
    const lastWeek = facts({ projects: [project], weeklyObjectives: [{ id: "w0", title: "Send 5 applications", state: "active", weekStartLocalDate: "2026-10-05", projectId: "p1", goalId: null }] });
    expect(find(why(task({ projectId: "p1" }), lastWeek), "weekly_objective")).toBeUndefined();
  });

  it("an objective on the resolved goal matches too", () => {
    const f = facts({ goals: [{ ...goal, dueLocalDate: null }], weeklyObjectives: [{ id: "w1", title: "Network", state: "active", weekStartLocalDate: "2026-10-12", goalId: "g1", projectId: null }] });
    expect(kinds(why(task({ goalId: "g1" }), f))).toEqual(["weekly_objective", "goal_link"]);
  });

  it("19. rescheduleCount 1 + one past deferred item = Pushed back 2 times; count 1 alone = nothing", () => {
    const f = facts({ dailyPlans: [{ id: "dp0", localDate: "2026-10-13", state: "closed" }], dailyPlanItems: [{ dailyPlanId: "dp0", taskId: "t1", state: "deferred" }] });
    const pushed = find(why(task({ rescheduleCount: 1 }), f), "carried_over")!;
    expect(pushed).toMatchObject({ short: "Pushed back 2 times", long: "This has moved to a later day 2 times.", tone: "risk", icon: "History" });
    expect(why(task({ rescheduleCount: 1 }))).toEqual([]);
  });

  it("a rescheduled item in today's plan does not count as pushed back", () => {
    const f = facts({ dailyPlans: [{ id: "dp1", localDate: TODAY, state: "active" }], dailyPlanItems: [{ dailyPlanId: "dp1", taskId: "t1", state: "rescheduled" }] });
    expect(why(task({ rescheduleCount: 1 }), f)).toEqual([]);
  });

  it("20. daily series with today pending: recurring_today; past anchor deadline is not overdue", () => {
    const t = task({ recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-10-01", scheduledLocalDate: null });
    const f = facts({ occurrences: [{ id: "o1", taskId: "t1", localDate: TODAY, state: "pending" }] });
    const reasons = why(t, f);
    expect(kinds(reasons)).toEqual(["recurring_today"]);
    expect(reasons[0]).toMatchObject({ short: "Today's repeat", long: "This repeats daily, and today's one is still open." });
  });

  it("21. recurring task with today's occurrence completed: no recurring_today", () => {
    const t = task({ recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-10-01" });
    const f = facts({ occurrences: [{ id: "o1", taskId: "t1", localDate: TODAY, state: "completed" }] });
    expect(find(why(t, f), "recurring_today")).toBeUndefined();
  });

  it("recurring series still counts carried_over", () => {
    const t = task({ recurrenceRule: { frequency: "weekly", weekdays: [1] }, dueLocalDate: "2026-10-05", rescheduleCount: 3 });
    expect(kinds(why(t))).toEqual(["carried_over"]);
  });
});

describe("whyItMatters: show nothing", () => {
  const everything = facts({
    goals: [goal],
    projects: [{ ...project, goalId: "g1", dueLocalDate: "2026-10-10", riskLevel: "blocked" }],
    dailyPlans: [{ id: "dp1", localDate: TODAY, state: "active" }],
    dailyPlanItems: [{ dailyPlanId: "dp1", taskId: "t1", state: "committed" }],
    dependencies: [{ taskId: "d1", dependsOnTaskId: "t1", dependencyType: "hard" }],
  });
  const dependent = task({ id: "d1", title: "Dependent" });

  it("22. completed task with every trigger set gives []", () => {
    const t = task({ state: "completed", dueLocalDate: "2026-10-12", goalId: "g1", projectId: "p1", rescheduleCount: 5 });
    expect(why(t, { ...everything, tasks: [t, dependent] })).toEqual([]);
  });

  it("23. archived task and won't-do task give []", () => {
    const archived = task({ state: "archived", dueLocalDate: TODAY, goalId: "g1" });
    const archivedAt = task({ archivedAt: "2026-10-14T00:00:00.000Z", dueLocalDate: TODAY, goalId: "g1" });
    const wont = task({ outcome: "wont_do", dueLocalDate: TODAY, goalId: "g1" });
    for (const t of [archived, archivedAt, wont]) expect(why(t, { ...everything, tasks: [t, dependent] })).toEqual([]);
  });

  it("24. Someday task that blocks one task and has a goal due in 10 days: only unblocks (Q46)", () => {
    const t = task({ horizon: "someday", goalId: "g1", dueLocalDate: TODAY, rescheduleCount: 4 });
    const f = facts({ tasks: [t, dependent], goals: [{ ...goal, dueLocalDate: "2026-10-25" }], dependencies: [{ taskId: "d1", dependsOnTaskId: "t1", dependencyType: "hard" }] });
    expect(kinds(why(t, f))).toEqual(["unblocks"]);
    const alone = task({ horizon: "someday", goalId: "g1" });
    expect(why(alone, facts({ goals: [goal] }))).toEqual([]);
  });

  it("25. stale facts drop in_today_plan but keep deadline_soon", () => {
    const t = task({ dueLocalDate: "2026-10-16" });
    const f = facts({ snapshotAt: "2026-10-14T20:00:00+13:00", dailyPlans: [{ id: "dp1", localDate: TODAY, state: "active" }], dailyPlanItems: [{ dailyPlanId: "dp1", taskId: "t1", state: "committed" }] });
    expect(kinds(why(t, f))).toEqual(["deadline_soon"]);
    expect(kinds(why(t, { ...f, snapshotAt: "2026-10-15T08:00:00+13:00" }))).toEqual(["deadline_soon", "in_today_plan"]);
  });

  it("26. invalid timezone gives []", () => {
    expect(why(task({ dueLocalDate: "2026-10-12" }), facts(), NOW, "Mars/Base")).toEqual([]);
    expect(why(task({ dueLocalDate: "2026-10-12" }), facts(), new Date("nope"), TZ)).toEqual([]);
  });

  it("no rule fires gives [] (no filler)", () => {
    expect(why(task())).toEqual([]);
  });
});

describe("whyItMatters: timezone edges", () => {
  it("27. NZ midnight: 23:30 gives Due tomorrow, 00:30 gives Due today (both on 15 Oct in UTC)", () => {
    const t = task({ dueLocalDate: "2026-10-16" });
    const before = new Date("2026-10-15T23:30:00+13:00");
    const after = new Date("2026-10-16T00:30:00+13:00");
    expect(before.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(after.toISOString().slice(0, 10)).toBe("2026-10-15");
    expect(find(why(t, facts(), before), "deadline_soon")!.short).toBe("Due tomorrow");
    expect(find(why(t, facts(), after), "deadline_soon")!.short).toBe("Due today");
  });

  it("28. a reservation at 00:30 NZ on 16 Oct counts as a plan on 16 Oct", () => {
    const t = task({ dueLocalDate: "2026-10-16", plannedStartAt: "2026-10-15T11:30:00Z", plannedEndAt: "2026-10-15T12:30:00Z" });
    expect(find(why(t), "deadline_soon")!.long).toBe("Due Fri 16 Oct.");
    // A reservation after the deadline does not count.
    const late = task({ dueLocalDate: "2026-10-16", plannedStartAt: "2026-10-16T11:30:00Z", plannedEndAt: "2026-10-16T12:30:00Z" });
    expect(find(why(late), "deadline_soon")!.long).toBe("Due Fri 16 Oct. Not planned yet.");
  });

  it("31a. DST: a reservation at 2026-09-26T14:01Z falls on local day 2026-09-27", () => {
    expect(reservedLocalDate({ plannedStartAt: "2026-09-26T14:01:00Z", plannedEndAt: "2026-09-26T15:00:00Z" }, TZ)).toBe("2026-09-27");
    const now = new Date("2026-09-26T13:00:00Z"); // 01:00 NZST on 27 Sep, before the change
    const t = task({ dueLocalDate: "2026-09-27", plannedStartAt: "2026-09-26T14:01:00Z", plannedEndAt: "2026-09-26T15:00:00Z" });
    expect(find(why(t, facts(), now), "deadline_soon")).toMatchObject({ short: "Due today", long: "Due Sun 27 Sep." });
  });

  it("April DST end: 5 Apr local days stay correct", () => {
    const now = new Date("2026-04-05T02:30:00+12:00"); // after clocks go back at 03:00 NZDT → 02:00 NZST
    expect(find(why(task({ dueLocalDate: "2026-04-06" }), facts(), now), "deadline_soon")!.short).toBe("Due tomorrow");
  });
});

describe("whyItMatters: habits", () => {
  it("29. 5-day streak, scheduled today, unrecorded: 5 day streak; today completed gives []", () => {
    const checkIns = completedDays("h1", "2026-10-14", 5);
    const reasons = whyHabit(habit(), facts({ habitCheckIns: checkIns }));
    expect(kinds(reasons)).toEqual(["streak_at_risk"]);
    expect(reasons[0]).toMatchObject({ short: "5 day streak", long: "Your streak is 5 days. Doing it today keeps it going.", tone: "accent", icon: "Flame" });
    expect(whyHabit(habit(), facts({ habitCheckIns: [...checkIns, { habitId: "h1", localDate: TODAY, state: "completed" }] }))).toEqual([]);
    expect(whyHabit(habit(), facts({ habitCheckIns: [...checkIns, { habitId: "h1", localDate: TODAY, state: "skipped" }] }))).toEqual([]);
  });

  it("streak under 3 gives no streak reason", () => {
    expect(whyHabit(habit(), facts({ habitCheckIns: completedDays("h1", "2026-10-14", 2) }))).toEqual([]);
  });

  it("30. streak filling the 28-day window shows N+ and equals dashboardModel", () => {
    const checkIns = completedDays("h1", "2026-10-14", 40);
    const reason = whyHabit(habit(), facts({ habitCheckIns: checkIns }))[0];
    const earliest = "2026-09-18"; // today − 27, the Dashboard window
    const dashboard = dashboardHabitStreak(habit(), checkIns, TODAY, earliest);
    expect(reason.basis.count).toBe(dashboard);
    expect(reason.short).toBe(`${dashboard}+ day streak`);
  });

  it("31. times_per_week target 3, 1 done: Sat 17 Oct fires (risk); Thu 15 Oct does not", () => {
    const h = habit({ frequency: "times_per_week", schedule: { timesPerWeek: 3 } });
    const f = facts({ habitCheckIns: [{ habitId: "h1", localDate: "2026-10-13", state: "completed" }] });
    const sat = whyHabit(h, f, new Date("2026-10-17T09:00:00+13:00"));
    expect(find(sat, "week_target")).toMatchObject({ short: "2 more, 2 days left", long: "Your target is 3 this week. 1 done, 2 days left.", tone: "risk" });
    expect(find(whyHabit(h, f), "week_target")).toBeUndefined();
    const fri = whyHabit(h, f, new Date("2026-10-16T09:00:00+13:00")); // 3 days left, 2 to go: still slack
    expect(find(fri, "week_target")).toBeUndefined();
  });

  it("week_target is neutral when remaining exceeds days left", () => {
    const h = habit({ frequency: "times_per_week", schedule: { timesPerWeek: 4 } });
    const sat = whyHabit(h, facts(), new Date("2026-10-17T09:00:00+13:00"));
    expect(find(sat, "week_target")).toMatchObject({ short: "4 more, 2 days left", tone: "neutral" });
  });

  it("32. last completed 9 days ago, scheduled today: Last done 9 days ago", () => {
    const f = facts({ habitCheckIns: [{ habitId: "h1", localDate: "2026-10-06", state: "completed" }] });
    const gap = find(whyHabit(habit(), f), "habit_gap")!;
    expect(gap).toMatchObject({ short: "Last done 9 days ago", long: "Last done Tue 6 Oct, 9 days ago.", icon: "Hourglass" });
  });

  it("no completion in the lookback speaks only when the check-in list covers it", () => {
    expect(find(whyHabit(habit(), facts()), "habit_gap")).toBeUndefined();
    const covered = whyHabit(habit(), facts({ habitCheckInsFrom: "2026-08-01" }));
    expect(find(covered, "habit_gap")).toMatchObject({ short: "Not done in 60+ days", long: "Not done in the last 60+ days." });
    const young = whyHabit(habit({ createdAt: "2026-10-01T00:00:00.000Z" }), facts({ habitCheckInsFrom: "2026-08-01" }));
    expect(find(young, "habit_gap")).toMatchObject({ short: "Not done in 14 days" });
    const tooYoung = whyHabit(habit({ createdAt: "2026-10-10T00:00:00.000Z" }), facts({ habitCheckInsFrom: "2026-08-01" }));
    expect(find(tooYoung, "habit_gap")).toBeUndefined();
  });

  it("33. archived habit gives []", () => {
    expect(whyHabit(habit({ archivedAt: "2026-10-01T00:00:00.000Z" }), facts({ habitCheckIns: completedDays("h1", "2026-10-14", 5) }))).toEqual([]);
  });

  it("habit_goal fires for an active goal only", () => {
    expect(kinds(whyHabit(habit({ goalId: "g1" }), facts({ goals: [goal] })))).toEqual(["habit_goal"]);
    expect(whyHabit(habit({ goalId: "g1" }), facts({ goals: [{ ...goal, state: "completed" }] }))).toEqual([]);
  });

  it("stale facts drop streak, target and gap but keep habit_goal", () => {
    const f = facts({ goals: [goal], habitCheckIns: completedDays("h1", "2026-10-14", 5), snapshotAt: "2026-10-14T21:00:00+13:00" });
    expect(kinds(whyHabit(habit({ goalId: "g1" }), f))).toEqual(["habit_goal"]);
  });
});

describe("reasonsForSurface", () => {
  const blocker = task({ dueLocalDate: "2026-10-12", goalId: "g1", rescheduleCount: 2, recurrenceRule: null });
  const f = facts({
    tasks: [blocker, task({ id: "d1", title: "Dependent" })],
    goals: [{ ...goal, dueLocalDate: null }],
    dependencies: [{ taskId: "d1", dependsOnTaskId: "t1", dependencyType: "hard" }],
    dailyPlans: [{ id: "dp1", localDate: TODAY, state: "active" }],
    dailyPlanItems: [{ dailyPlanId: "dp1", taskId: "t1", state: "committed" }],
  });
  const all = why(blocker, f);

  it("34. task_row drops deadline, repeat and goal-link and keeps 1; task_detail keeps 3 in rank order", () => {
    expect(kinds(all)).toEqual(["deadline_missed", "unblocks", "in_today_plan", "carried_over", "goal_link"]);
    expect(kinds(reasonsForSurface(all, "task_row"))).toEqual(["unblocks"]);
    expect(kinds(reasonsForSurface(all, "task_detail"))).toEqual(["deadline_missed", "unblocks", "in_today_plan"]);
  });

  it("Q42: goal_link never on task rows, Today rows or the Dashboard; shown on detail and inbox triage", () => {
    const linked = why(task({ goalId: "g1" }), facts({ goals: [{ ...goal, dueLocalDate: null }] }));
    expect(kinds(linked)).toEqual(["goal_link"]);
    expect(reasonsForSurface(linked, "task_row")).toEqual([]);
    expect(reasonsForSurface(linked, "today_row")).toEqual([]);
    expect(reasonsForSurface(linked, "dashboard_up_next")).toEqual([]);
    expect(kinds(reasonsForSurface(linked, "task_detail"))).toEqual(["goal_link"]);
    expect(kinds(reasonsForSurface(linked, "inbox_triage"))).toEqual(["goal_link"]);
  });

  it("Q44: Pushed back is the row chip when it is the strongest unsuppressed signal", () => {
    const t = task({ dueLocalDate: TODAY, rescheduleCount: 2 });
    const reason = topReason({ kind: "task", task: t }, facts({ tasks: [t] }), NOW, TZ, "task_row");
    expect(reason).toMatchObject({ kind: "carried_over", short: "Pushed back 2 times", tone: "risk" });
  });

  it("Q47: dashboard_up_next shows one reason and never in_today_plan", () => {
    expect(kinds(reasonsForSurface(all, "dashboard_up_next"))).toEqual(["deadline_missed"]);
    const planned = why(task(), facts({ dailyPlans: [{ id: "dp1", localDate: TODAY, state: "active" }], dailyPlanItems: [{ dailyPlanId: "dp1", taskId: "t1", state: "committed" }] }));
    expect(reasonsForSurface(planned, "dashboard_up_next")).toEqual([]);
  });

  it("today_row drops in_today_plan and recurring_today; inbox_triage and habit_row keep 1", () => {
    expect(kinds(reasonsForSurface(all, "today_row"))).toEqual(["deadline_missed"]);
    expect(reasonsForSurface(all, "inbox_triage")).toHaveLength(1);
    expect(reasonsForSurface(all, "habit_row")).toHaveLength(1);
  });

  it("Q49: no surface is named after a page the restructure removes", () => {
    const surfaces = ["task_row", "inbox_triage", "task_detail", "today_row", "dashboard_up_next", "habit_row"] as const;
    for (const surface of surfaces) {
      expect(surface).not.toMatch(/plan_daily|daily_plan|roadmap|review|analytics/);
      expect(Array.isArray(reasonsForSurface(all, surface))).toBe(true);
    }
  });

  it("topReason returns null when nothing fires", () => {
    expect(topReason({ kind: "task", task: task() }, facts(), NOW, TZ, "task_row")).toBeNull();
  });
});

describe("whyDetailSection (Q43 empty-state contract)", () => {
  const entity = (t: WhyTask): WhyEntity => ({ kind: "task", task: t });

  it("open non-Someday task with no reason: empty with the unlinked message and link_goal", () => {
    expect(whyDetailSection(entity(task()), facts({ tasks: [task()] }), NOW, TZ)).toEqual({ kind: "empty", message: WHY_EMPTY_MESSAGES.unlinked, action: "link_goal" });
    expect(WHY_EMPTY_MESSAGES.unlinked).toBe("Not linked to a goal or project yet.");
  });

  it("task in a project with no goal and no reason: empty, but the message does not claim no project", () => {
    const t = task({ projectId: "p1" });
    expect(whyDetailSection(entity(t), facts({ tasks: [t], projects: [project] }), NOW, TZ)).toEqual({ kind: "empty", message: "Not linked to a goal yet.", action: "link_goal" });
  });

  it("done, won't do and Someday tasks hide the section", () => {
    for (const t of [task({ state: "completed" }), task({ outcome: "wont_do" }), task({ horizon: "someday" })]) {
      expect(whyDetailSection(entity(t), facts({ tasks: [t] }), NOW, TZ)).toEqual({ kind: "hidden" });
    }
  });

  it("with reasons it returns up to 3 rows; a Someday blocker shows its unblocks row", () => {
    const t = task({ horizon: "someday" });
    const f = facts({ tasks: [t, task({ id: "d1", title: "Dependent" })], dependencies: [{ taskId: "d1", dependsOnTaskId: "t1", dependencyType: "hard" }] });
    const section = whyDetailSection(entity(t), f, NOW, TZ);
    expect(section.kind).toBe("reasons");
    if (section.kind === "reasons") expect(kinds(section.reasons)).toEqual(["unblocks"]);
  });

  it("invalid timezone hides the section", () => {
    expect(whyDetailSection(entity(task()), facts(), NOW, "Mars/Base")).toEqual({ kind: "hidden" });
  });
});

describe("copy rules, windows and determinism", () => {
  const longTitle = "Prepare the complete portfolio pack for the Fonterra graduate programme";
  const t = task({ id: "task-abc-123", projectId: "proj-xyz-789", goalId: "goal-qqq-456", dueLocalDate: "2026-10-12", rescheduleCount: 3, recurrenceRule: null });
  const f = facts({
    tasks: [t, task({ id: "dep-777", title: longTitle, dueLocalDate: "2026-10-20" }), task({ id: "dep-778", title: "Second", dueLocalDate: null })],
    goals: [{ id: "goal-qqq-456", title: longTitle, state: "in_progress", intentionKind: "outcome", dueLocalDate: "2026-11-01" }],
    milestones: [{ id: "ms-555", goalId: "goal-qqq-456", title: "Milestone one", state: "not_started", dueLocalDate: "2026-10-20" }],
    projects: [{ id: "proj-xyz-789", title: longTitle, state: "in_progress", goalId: null, dueLocalDate: "2026-10-10", riskLevel: "at_risk", riskNote: null }],
    dependencies: [{ taskId: "dep-777", dependsOnTaskId: "task-abc-123", dependencyType: "hard" }, { taskId: "dep-778", dependsOnTaskId: "task-abc-123", dependencyType: "hard" }],
    dailyPlans: [{ id: "plan-000", localDate: TODAY, state: "active" }],
    dailyPlanItems: [{ dailyPlanId: "plan-000", taskId: "task-abc-123", state: "committed" }],
    weeklyObjectives: [{ id: "wo-111", title: longTitle, state: "active", weekStartLocalDate: "2026-10-12", projectId: "proj-xyz-789", goalId: null }],
  });

  it("35. no ISO date, undefined, null, em dash or record id; long titles cut with … and whole in accessible", () => {
    const reasons = why(t, f);
    expect(reasons.length).toBeGreaterThanOrEqual(6);
    const ids = ["task-abc-123", "proj-xyz-789", "goal-qqq-456", "dep-777", "dep-778", "ms-555", "plan-000", "wo-111"];
    for (const item of reasons) {
      for (const text of [item.short, item.long, item.accessible]) {
        expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
        expect(text).not.toMatch(/undefined|null|NaN/);
        expect(text).not.toContain("—");
        expect(text).not.toMatch(/!|urgent|should/i);
        for (const id of ids) expect(text).not.toContain(id);
      }
      expect(item.short.length).toBeLessThanOrEqual(24);
    }
    const named = reasons.filter(item => item.long.includes("“"));
    expect(named.length).toBeGreaterThan(0);
    const cutOne = reasons.find(item => item.accessible.includes(longTitle))!;
    expect(cutOne.long).toContain("…”");
    expect(cutOne.long).not.toContain(longTitle);
    const quotedTitles = [...cutOne.long.matchAll(/“([^”]*)”/g)].map(match => match[1]);
    for (const title of quotedTitles) expect(title.length).toBeLessThanOrEqual(WHY_WINDOWS.titleMax);
  });

  it("36. deterministic: same inputs deep-equal; shuffled facts arrays give the same output", () => {
    const first = why(t, f);
    expect(why(t, f)).toEqual(first);
    const reversed: WhyFacts = {
      ...f,
      tasks: [...f.tasks].reverse(), goals: [...f.goals].reverse(), milestones: [...f.milestones].reverse(), projects: [...f.projects].reverse(),
      dependencies: [...f.dependencies].reverse(), dailyPlans: [...f.dailyPlans].reverse(), dailyPlanItems: [...f.dailyPlanItems].reverse(),
      weeklyObjectives: [...f.weeklyObjectives].reverse(),
    };
    expect(why(t, reversed)).toEqual(first);
  });

  it("Q45: WHY_WINDOWS holds the owner-approved windows", () => {
    expect(WHY_WINDOWS).toMatchObject({ deadlineSoonDays: 3, milestoneDays: 14, projectDays: 14, goalDays: 30, streakMin: 3, carriedOverMin: 2 });
  });

  it("one reason per family and ranks ascending", () => {
    const reasons = why(t, f);
    expect(new Set(reasons.map(item => item.family)).size).toBe(reasons.length);
    expect(reasons.map(item => item.rank)).toEqual([...reasons.map(item => item.rank)].sort((a, b) => a - b));
  });

  it("Monday week start matches planBoard.weekStartFor", () => {
    for (const day of ["2026-10-12", "2026-10-15", "2026-10-18", "2026-10-19", "2027-01-03"]) expect(mondayWeekStart(day)).toBe(weekStartFor(day));
  });

  it("performance: 500 tasks stay well under budget", () => {
    const tasks = Array.from({ length: 500 }, (_, index) => task({ id: `t${index}`, title: `Task ${index}`, dueLocalDate: index % 3 ? "2026-10-17" : null, projectId: index % 2 ? "p1" : null, goalId: index % 5 ? "g1" : null, rescheduleCount: index % 4 }));
    const big = facts({
      tasks, goals: [goal], projects: [{ ...project, dueLocalDate: "2026-10-20" }],
      dependencies: tasks.slice(1).map((item, index) => ({ taskId: item.id, dependsOnTaskId: `t${index}`, dependencyType: "hard" as const })),
    });
    whyItMatters({ kind: "task", task: tasks[0] }, big, NOW, TZ); // warm the index
    const start = performance.now();
    for (const item of tasks) whyItMatters({ kind: "task", task: item }, big, NOW, TZ);
    expect(performance.now() - start).toBeLessThan(250);
  });
});
