import { describe, expect, it } from "vitest";
import type { CanonicalTask } from "@shared/canonicalTask";
import { createTaskCardContext, taskCardModel, taskDatePills, type TaskCardSources } from "./taskCardModel";

// 2026-10-14 is a Wednesday; Auckland is UTC+13 in October.
const today = "2026-10-14";

function task(overrides: Partial<CanonicalTask> = {}): CanonicalTask {
  return {
    id: "t1", workspaceId: "w1", title: "Tailor CV for the Fonterra graduate role", state: "not_started", priority: "medium", horizon: "weekly",
    dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, estimateMinutes: 75, sortOrder: 0,
    categoryId: null, projectId: null, goalId: null, parentTaskId: null, recurrenceRule: null, completedAt: null, version: 4,
    ...overrides,
  };
}

function sources(overrides: Partial<TaskCardSources> = {}): TaskCardSources {
  return {
    today, timezone: "Pacific/Auckland", tasks: [], categories: [{ id: "c-work", name: "Work", color: null, sortOrder: 0 }],
    projects: [{ id: "p1", title: "Graduate job search sprint" }], goals: [{ id: "g1", title: "Land a graduate role" }],
    ...overrides,
  };
}

function model(item: CanonicalTask, extra: Partial<TaskCardSources> = {}) {
  return taskCardModel(item, createTaskCardContext(sources({ tasks: [item], ...extra })));
}

describe("taskCardModel", () => {
  it("fills the §5.1 contract from real fields only", () => {
    const parent = task({ categoryId: "c-work", projectId: "p1", goalId: "g1", priority: "critical", scheduledLocalDate: today });
    const children = [
      task({ id: "s1", parentTaskId: "t1", state: "completed" }),
      task({ id: "s2", parentTaskId: "t1" }),
      task({ id: "s3", parentTaskId: "t1", state: "archived" }),
    ];
    const result = taskCardModel(parent, createTaskCardContext(sources({ tasks: [parent, ...children], pendingTaskIds: new Set(["t1"]), conflictCountByTask: new Map([["t1", 2]]) })));
    expect(result).toMatchObject({
      id: "t1", version: 4, title: "Tailor CV for the Fonterra graduate role", state: "not_started", isComplete: false,
      tone: "work", categoryName: "Work", context: { kind: "project", title: "Graduate job search sprint" }, priority: "critical",
      dates: [{ kind: "plan", label: "Today", tone: "accent" }], estimateMinutes: 75, subtasks: { done: 1, total: 2 },
      waitingOn: 0, blocks: 0, recurring: null, someday: false, pending: true, conflictCount: 2, completionBlock: null, why: null,
      completedLabel: null, check: { checked: false, action: { kind: "complete" } },
    });
  });

  it("renders priority only for high and critical, and falls back to the goal for context", () => {
    expect(model(task({ priority: "high" })).priority).toBe("high");
    expect(model(task({ priority: "low" })).priority).toBeNull();
    expect(model(task({ priority: "none" })).priority).toBeNull();
    expect(model(task({ goalId: "g1" })).context).toEqual({ kind: "goal", title: "Land a graduate role" });
    expect(model(task({ categoryId: "missing" })).tone).toBe("neutral");
  });

  it("counts hard dependencies only", () => {
    const deps = [
      { taskId: "t1", dependsOnTaskId: "a", dependencyType: "hard" as const },
      { taskId: "t1", dependsOnTaskId: "b", dependencyType: "soft" as const },
      { taskId: "c", dependsOnTaskId: "t1", dependencyType: "hard" as const },
    ];
    const result = taskCardModel(task(), createTaskCardContext(sources({ tasks: [task(), task({ id: "a" }), task({ id: "b" }), task({ id: "c" })], dependencies: deps })));
    expect(result).toMatchObject({ waitingOn: 1, blocks: 1, completionBlock: { reason: "Waiting on 1 task: finish it first.", action: "open_detail" }, check: { checked: false, action: { kind: "none" } } });
  });

  it("marks Someday, offline-created and done work", () => {
    expect(model(task({ horizon: "someday" })).someday).toBe(true);
    expect(model(task({ id: "offline:abc" })).pending).toBe(true);
    const done = model(task({ state: "completed", completedAt: "2026-10-13T22:00:00.000Z", scheduledLocalDate: today }));
    expect(done).toMatchObject({ isComplete: true, dates: [], completedLabel: "Done today", check: { checked: true, action: { kind: "reopen" } } });
    expect(model(task({ state: "completed", completedAt: "2026-10-12T22:00:00.000Z" })).completedLabel).toBe("Done 13 Oct");
  });

  it("blocks completion for a task committed in today's plan (R3)", () => {
    expect(model(task(), { committedTasks: new Map([["t1", today]]) }).completionBlock).toEqual({ reason: "Committed in today's plan. Resolve it in Plan.", action: "open_plan" });
  });

  describe("recurring series", () => {
    const series = task({ title: "LinkedIn engagement: 15 minutes", recurrenceRule: { frequency: "daily" }, scheduledLocalDate: "2026-09-24", estimateMinutes: 15 });

    it("checks off by resolving today's occurrence, and shows Today instead of the anchor", () => {
      const result = model(series, { occurrences: [{ id: "occ", taskId: "t1", localDate: today, state: "pending", version: 5 }] });
      expect(result.dates).toEqual([{ kind: "occurrence", label: "Today", tone: "accent", accessibleLabel: "Daily, due today" }]);
      expect(result.recurring).toEqual({ cadence: "Daily" });
      expect(result.check).toEqual({ checked: false, action: { kind: "resolve_occurrence", occurrenceId: "occ", expectedVersion: 5 } });
      expect(result.completionBlock).toBeNull();
    });

    it("reads Done today, checked and inert, once today's occurrence is complete", () => {
      const result = model(series, { occurrences: [{ id: "occ", taskId: "t1", localDate: today, state: "completed", version: 6 }] });
      expect(result.dates[0]).toMatchObject({ kind: "occurrence", label: "Done today", tone: "neutral", accessibleLabel: "Daily. Done today. Next Thu 15 Oct." });
      expect(result.check).toEqual({ checked: true, action: { kind: "none" } });
      expect(result.completionBlock?.reason).toBe("Repeats daily. Today's is already done. Next one is Thu 15 Oct.");
    });

    it("disables the check with the next date when no occurrence is due today", () => {
      const weekly = task({ recurrenceRule: { frequency: "weekly", weekdays: [5] }, scheduledLocalDate: "2026-09-25" });
      const result = model(weekly);
      expect(result.dates[0]).toMatchObject({ label: "Next Fri 16 Oct" });
      expect(result.completionBlock).toEqual({ reason: "Repeats weekly. Next one is Fri 16 Oct.", action: "open_detail" });
      expect(result.check.action).toEqual({ kind: "none" });
    });

    it("hides a deadline that is only the series anchor, but keeps a real one", () => {
      expect(taskDatePills(task({ recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-09-24" }), { today, timezone: "UTC" })).toHaveLength(1);
      expect(taskDatePills(task({ recurrenceRule: { frequency: "daily" }, scheduledLocalDate: "2026-09-24", dueLocalDate: "2026-10-20" }), { today, timezone: "UTC" }))
        .toEqual([expect.objectContaining({ kind: "occurrence" }), expect.objectContaining({ kind: "due", label: "Due 20 Oct" })]);
    });
  });
});

describe("taskDatePills", () => {
  const ctx = { today, timezone: "Pacific/Auckland" };

  it("shows reserved time in workspace time, today and on another day", () => {
    expect(taskDatePills(task({ scheduledLocalDate: today, plannedStartAt: "2026-10-13T20:15:00.000Z", plannedEndAt: "2026-10-13T21:30:00.000Z" }), ctx))
      .toEqual([{ kind: "reserved", label: "Today 09:15-10:30", tone: "accent", accessibleLabel: "Reserved today 09:15 to 10:30" }]);
    expect(taskDatePills(task({ scheduledLocalDate: "2026-10-16", plannedStartAt: "2026-10-15T20:15:00.000Z", plannedEndAt: "2026-10-15T21:30:00.000Z" }), ctx)[0])
      .toMatchObject({ kind: "reserved", label: "Fri 16 · 09:15" });
  });

  it("labels plan dates and slipped plans", () => {
    expect(taskDatePills(task({ scheduledLocalDate: today }), ctx)[0]).toMatchObject({ kind: "plan", label: "Today", tone: "accent" });
    expect(taskDatePills(task({ scheduledLocalDate: "2026-10-15" }), ctx)[0]).toMatchObject({ kind: "plan", label: "Tomorrow", tone: "neutral" });
    expect(taskDatePills(task({ scheduledLocalDate: "2026-10-16" }), ctx)[0]).toMatchObject({ kind: "plan", label: "Fri 16 Oct" });
    expect(taskDatePills(task({ scheduledLocalDate: "2026-10-12" }), ctx)[0]).toMatchObject({ kind: "slipped", label: "Planned 12 Oct", tone: "risk" });
  });

  it("labels deadlines: overdue, today, unplanned soon and later", () => {
    expect(taskDatePills(task({ dueLocalDate: "2026-10-12" }), ctx)).toEqual([expect.objectContaining({ kind: "overdue", label: "Overdue 2d", tone: "off" })]);
    expect(taskDatePills(task({ dueLocalDate: today }), ctx)[0]).toMatchObject({ kind: "due", label: "Due today", tone: "risk" });
    expect(taskDatePills(task({ dueLocalDate: "2026-10-16" }), ctx)[0]).toMatchObject({ kind: "due", label: "Due Fri, not planned", tone: "risk" });
    expect(taskDatePills(task({ dueLocalDate: "2026-10-20" }), ctx)[0]).toMatchObject({ kind: "due", label: "Due 20 Oct", tone: "neutral" });
  });

  it("shows at most two pills: plan first, then the deadline", () => {
    const pills = taskDatePills(task({ scheduledLocalDate: today, dueLocalDate: "2026-10-15" }), ctx);
    expect(pills.map(pill => pill.label)).toEqual(["Today", "Due 15 Oct"]);
    expect(taskDatePills(task(), ctx)).toEqual([]);
  });
});
