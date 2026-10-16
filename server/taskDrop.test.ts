import { describe, expect, it } from "vitest";
import {
  committedTaskPlans,
  planBulkStateChange,
  planTaskDrop,
  sortOrderNotice,
  taskArchiveCheck,
  taskCompletionCheck,
  lateDropConfirm,
  taskDropDateChoice,
  taskLateDropChoice,
  type DropTask,
  type TaskDropContext,
} from "@shared/taskDrop";

// 2026-10-14 is a Wednesday; Auckland is UTC+13 in October.
const today = "2026-10-14";

function task(overrides: Partial<DropTask> = {}): DropTask {
  return { id: "t1", title: "Tailor CV", state: "not_started", horizon: "weekly", dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, recurrenceRule: null, sortOrder: 0, ...overrides };
}

function ctx(overrides: Partial<TaskDropContext> = {}): TaskDropContext {
  return { today, timezone: "Pacific/Auckland", sort: "manual", occurrences: [], dependencies: [], tasks: [], committedTasks: new Map(), ...overrides };
}

const weekly = { frequency: "weekly", weekdays: [5] }; // Fridays; next is Fri 16 Oct
const daily = { frequency: "daily" };
const reservedFriday = { plannedStartAt: "2026-10-15T20:15:00.000Z", plannedEndAt: "2026-10-15T21:30:00.000Z" }; // Fri 16 Oct 09:15 NZDT
const reservedToday = { plannedStartAt: "2026-10-13T20:15:00.000Z", plannedEndAt: "2026-10-13T21:30:00.000Z" }; // Wed 14 Oct 09:15 NZDT

describe("planTaskDrop: Status lens", () => {
  it.each([
    ["todo", "in_progress", "not_started"],
    ["in_progress", "not_started", "in_progress"],
    ["blocked", "not_started", "blocked"],
    ["todo", "completed", "not_started"],
  ] as const)("dropping on %s from %s writes state %s", (lane, from, state) => {
    expect(planTaskDrop(task({ state: from }), { kind: "status", lane }, ctx())).toEqual({ ok: true, write: { kind: "update", patch: { state } } });
  });

  it("allows In progress and Blocked on a recurring series (only terminal states are refused)", () => {
    expect(planTaskDrop(task({ recurrenceRule: weekly }), { kind: "status", lane: "in_progress" }, ctx())).toMatchObject({ ok: true, write: { patch: { state: "in_progress" } } });
    expect(planTaskDrop(task({ recurrenceRule: weekly }), { kind: "status", lane: "blocked" }, ctx())).toMatchObject({ ok: true });
  });

  it("completes a plain task on Done", () => {
    expect(planTaskDrop(task(), { kind: "status", lane: "done" }, ctx())).toEqual({ ok: true, write: { kind: "update", patch: { state: "completed" } } });
  });

  it("resolves today's pending occurrence for a recurring task dropped on Done (R1)", () => {
    const plan = planTaskDrop(
      task({ recurrenceRule: daily, scheduledLocalDate: "2026-09-24" }),
      { kind: "status", lane: "done" },
      ctx({ occurrences: [{ id: "occ-7", taskId: "t1", localDate: today, state: "pending", version: 3 }] }),
    );
    expect(plan).toEqual({
      ok: true,
      write: { kind: "resolveOccurrence", occurrenceId: "occ-7", expectedVersion: 3, state: "completed" },
      announcement: "Done today. It repeats, so it stays in To do.",
    });
  });

  it("refuses Done for a recurring task with no occurrence today, naming the next one (R1)", () => {
    expect(planTaskDrop(task({ recurrenceRule: weekly, scheduledLocalDate: "2026-09-25" }), { kind: "status", lane: "done" }, ctx()))
      .toEqual({ ok: false, rule: "R1", reason: "Repeats weekly. Next one is Fri 16 Oct.", action: "open_detail" });
  });

  it("refuses Done when today's occurrence is already done, or the series ended (R1)", () => {
    const done = ctx({ occurrences: [{ id: "o", taskId: "t1", localDate: today, state: "completed", version: 2 }] });
    expect(planTaskDrop(task({ recurrenceRule: daily, scheduledLocalDate: "2026-09-24" }), { kind: "status", lane: "done" }, done))
      .toMatchObject({ ok: false, rule: "R1", reason: "Repeats daily. Today's is already done. Next one is Thu 15 Oct." });
    expect(planTaskDrop(task({ recurrenceRule: daily, scheduledLocalDate: "2026-09-24", recurrenceUntilLocalDate: "2026-10-01" }), { kind: "status", lane: "done" }, ctx()))
      .toMatchObject({ ok: false, rule: "R1", reason: "Repeats daily. The series ended 1 Oct." });
  });

  it("refuses Done while today's occurrence is not materialized, instead of guessing an id", () => {
    expect(planTaskDrop(task({ recurrenceRule: daily, scheduledLocalDate: "2026-09-24" }), { kind: "status", lane: "done" }, ctx({ occurrences: [] })))
      .toMatchObject({ ok: false, rule: "occurrence_loading" });
  });

  it("refuses Done for a malformed but present recurrence rule, like the server's truthiness check", () => {
    expect(planTaskDrop(task({ recurrenceRule: { frequency: "yearly" } }), { kind: "status", lane: "done" }, ctx())).toMatchObject({ ok: false, rule: "R1" });
  });

  it("refuses Done while hard prerequisites are unfinished (R2), counting missing records as unfinished", () => {
    const dependencies = [
      { taskId: "t1", dependsOnTaskId: "p1", dependencyType: "hard" as const },
      { taskId: "t1", dependsOnTaskId: "p2", dependencyType: "hard" as const },
      { taskId: "t1", dependsOnTaskId: "p3", dependencyType: "soft" as const },
    ];
    expect(planTaskDrop(task(), { kind: "status", lane: "done" }, ctx({ dependencies, tasks: [{ id: "p1", state: "in_progress" }] })))
      .toEqual({ ok: false, rule: "R2", reason: "Waiting on 2 tasks: finish them first.", action: "open_detail" });
    expect(planTaskDrop(task(), { kind: "status", lane: "done" }, ctx({ dependencies, tasks: [{ id: "p1", state: "completed" }, { id: "p2", state: "blocked" }] })))
      .toMatchObject({ ok: false, reason: "Waiting on 1 task: finish it first." });
    expect(planTaskDrop(task(), { kind: "status", lane: "done" }, ctx({ dependencies, tasks: [{ id: "p1", state: "completed" }, { id: "p2", state: "completed" }] })))
      .toMatchObject({ ok: true });
  });

  it("refuses Done for a task committed in an open daily plan (R3), before R2 like the server", () => {
    const committed = ctx({
      committedTasks: new Map([["t1", today]]),
      dependencies: [{ taskId: "t1", dependsOnTaskId: "p1", dependencyType: "hard" }],
    });
    expect(planTaskDrop(task(), { kind: "status", lane: "done" }, committed))
      .toEqual({ ok: false, rule: "R3", reason: "Committed in today's plan. Resolve it in Plan.", action: "open_plan" });
    expect(planTaskDrop(task(), { kind: "status", lane: "done" }, ctx({ committedTasks: new Map([["t1", "2026-10-12"]]) })))
      .toMatchObject({ reason: "Committed in the plan for Mon 12 Oct. Resolve it in Plan." });
  });

  it("checks R1 before R3 for recurring tasks, as the server does", () => {
    expect(planTaskDrop(task({ recurrenceRule: weekly, scheduledLocalDate: "2026-09-25" }), { kind: "status", lane: "done" }, ctx({ committedTasks: new Map([["t1", today]]) })))
      .toMatchObject({ rule: "R1" });
  });

  describe("positions", () => {
    const laneTasks = [{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 1024 }];

    it("writes state and sortOrder in ONE update for a cross-lane drop at a position", () => {
      expect(planTaskDrop(task(), { kind: "status", lane: "in_progress", placement: { laneTasks, index: 1 } }, ctx()))
        .toEqual({ ok: true, write: { kind: "update", patch: { state: "in_progress", sortOrder: 512 } } });
    });

    it("writes only sortOrder for a same-lane reorder in Manual", () => {
      const own = [{ id: "t1", sortOrder: 0 }, ...laneTasks.map(item => ({ ...item, sortOrder: item.sortOrder + 10 }))];
      expect(planTaskDrop(task(), { kind: "status", lane: "todo", placement: { laneTasks: own, index: 2 } }, ctx()))
        .toEqual({ ok: true, write: { kind: "update", patch: { sortOrder: 1034 + 1024 } } });
      expect(planTaskDrop(task(), { kind: "status", lane: "todo", placement: { laneTasks: own, index: 0 } }, ctx()))
        .toEqual({ ok: true, write: { kind: "none" } });
    });

    it("writes no sortOrder for a same-lane drop under a non-Manual sort, and explains why", () => {
      expect(planTaskDrop(task(), { kind: "status", lane: "todo", placement: { laneTasks, index: 0 } }, ctx({ sort: "due" })))
        .toEqual({ ok: true, write: { kind: "none" }, announcement: "Sorted by due date, so the order follows the sort." });
    });

    it("changes only the lane for a cross-lane drop under a non-Manual sort", () => {
      expect(planTaskDrop(task(), { kind: "status", lane: "blocked", placement: { laneTasks, index: 0 } }, ctx({ sort: "priority" })))
        .toEqual({ ok: true, write: { kind: "update", patch: { state: "blocked" } }, announcement: "Sorted by priority, so the order follows the sort." });
    });

    it("plans a rebalance with the moved card written last, carrying its new state", () => {
      const tight = [{ id: "a", sortOrder: 5 }, { id: "b", sortOrder: 5 }];
      expect(planTaskDrop(task(), { kind: "status", lane: "in_progress", placement: { laneTasks: tight, index: 1 } }, ctx()))
        .toEqual({ ok: true, write: { kind: "rebalance", writes: [{ id: "a", sortOrder: 1024 }, { id: "b", sortOrder: 3072 }], patch: { state: "in_progress", sortOrder: 2048 } } });
    });

    it("refuses a same-lane reorder that would renumber a lane over 24 tasks, but still allows a lane change", () => {
      const long = Array.from({ length: 24 }, (_, index) => ({ id: `x${index}`, sortOrder: 0 }));
      expect(planTaskDrop(task(), { kind: "status", lane: "todo", placement: { laneTasks: [...long, { id: "t1", sortOrder: 0 }], index: 3 } }, ctx()))
        .toEqual({ ok: false, rule: "long_lane", reason: "Use Move up and down for long lanes." });
      expect(planTaskDrop(task(), { kind: "status", lane: "in_progress", placement: { laneTasks: long, index: 3 } }, ctx()))
        .toEqual({ ok: true, write: { kind: "update", patch: { state: "in_progress" } }, announcement: "Use Move up and down for long lanes." });
    });

    it("completes at a position in Done with one write", () => {
      expect(planTaskDrop(task(), { kind: "status", lane: "done", placement: { laneTasks, index: 0 } }, ctx()))
        .toEqual({ ok: true, write: { kind: "update", patch: { state: "completed", sortOrder: -1024 } } });
    });
  });
});

describe("planTaskDrop: When lens", () => {
  it("never accepts Past due as a target", () => {
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-20" }), { kind: "when", bucket: "past_due" }, ctx()))
      .toEqual({ ok: false, rule: "past", reason: "You can't plan into the past." });
  });

  it("does nothing when dropped back on its own bucket", () => {
    expect(planTaskDrop(task({ dueLocalDate: "2026-10-01" }), { kind: "when", bucket: "past_due" }, ctx())).toEqual({ ok: true, write: { kind: "none" } });
    expect(planTaskDrop(task({ scheduledLocalDate: today }), { kind: "when", bucket: "today" }, ctx())).toEqual({ ok: true, write: { kind: "none" } });
  });

  it("plans for today", () => {
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-20" }), { kind: "when", bucket: "today" }, ctx()))
      .toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: today } } });
  });

  it("explains that a passed deadline keeps a task in Past due after planning it today", () => {
    expect(planTaskDrop(task({ dueLocalDate: "2026-10-10" }), { kind: "when", bucket: "today" }, ctx()))
      .toMatchObject({ ok: true, announcement: "Planned for today. Its deadline has passed, so it stays in Past due." });
  });

  it("refuses Today for a task reserved on another day, in workspace time", () => {
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-16", ...reservedFriday }), { kind: "when", bucket: "today" }, ctx()))
      .toEqual({ ok: false, rule: "reserved", reason: "Reserved Fri 16 Oct 09:15. Move it in Calendar.", action: "open_calendar" });
  });

  it("refuses every other When target for a recurring series (its next Friday keeps it in Next 7 days)", () => {
    const series = task({ recurrenceRule: weekly, scheduledLocalDate: "2026-09-25" });
    for (const bucket of ["today", "later", "no_date"] as const) {
      expect(planTaskDrop(series, { kind: "when", bucket }, ctx()))
        .toEqual({ ok: false, rule: "recurring_schedule", reason: "Repeating tasks follow their schedule. Edit the repeat in details.", action: "open_detail" });
    }
    expect(planTaskDrop(series, { kind: "when", bucket: "next_7_days" }, ctx())).toEqual({ ok: true, write: { kind: "none" } });
  });

  it("asks for a date in the next seven days", () => {
    expect(planTaskDrop(task(), { kind: "when", bucket: "next_7_days" }, ctx()))
      .toEqual({ ok: true, write: { kind: "needsDate", min: "2026-10-15", max: "2026-10-21" } });
  });

  it("no longer refuses Next 7 days for a deadline today or past: the popover carries it to confirm (Q4)", () => {
    expect(planTaskDrop(task({ dueLocalDate: today }), { kind: "when", bucket: "next_7_days" }, ctx()))
      .toEqual({ ok: true, write: { kind: "needsDate", min: "2026-10-15", max: "2026-10-21", deadline: today } });
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-11-30", dueLocalDate: "2026-10-10" }), { kind: "when", bucket: "next_7_days" }, ctx()))
      .toEqual({ ok: true, write: { kind: "needsDate", min: "2026-10-15", max: "2026-10-21", deadline: "2026-10-10" } });
  });

  it("refuses Next 7 days, Later and No date for reserved work", () => {
    for (const bucket of ["next_7_days", "later", "no_date"] as const) {
      expect(planTaskDrop(task({ scheduledLocalDate: today, ...reservedToday }), { kind: "when", bucket }, ctx()))
        .toMatchObject({ ok: false, rule: "reserved", reason: "Reserved Wed 14 Oct 09:15. Move it in Calendar." });
    }
  });

  it("asks for a Later date and carries the deadline instead of capping the range (Q4)", () => {
    expect(planTaskDrop(task(), { kind: "when", bucket: "later" }, ctx())).toEqual({ ok: true, write: { kind: "needsDate", min: "2026-10-22", max: null } });
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-16", dueLocalDate: "2026-11-30" }), { kind: "when", bucket: "later" }, ctx()))
      .toEqual({ ok: true, write: { kind: "needsDate", min: "2026-10-22", max: null, deadline: "2026-11-30" } });
  });

  it("lets Later through when the deadline is sooner; the chosen day then asks once", () => {
    expect(planTaskDrop(task({ dueLocalDate: "2026-10-16" }), { kind: "when", bucket: "later" }, ctx()))
      .toEqual({ ok: true, write: { kind: "needsDate", min: "2026-10-22", max: null, deadline: "2026-10-16" } });
    expect(planTaskDrop(task({ dueLocalDate: "2026-10-01", scheduledLocalDate: "2026-12-01" }), { kind: "when", bucket: "later" }, ctx()))
      .toEqual({ ok: true, write: { kind: "needsDate", min: "2026-10-22", max: null, deadline: "2026-10-01" } });
    expect(planTaskDrop(task({ dueLocalDate: "2026-12-20" }), { kind: "when", bucket: "later" }, ctx())).toEqual({ ok: true, write: { kind: "none" } });
  });

  it("clears the plan date on No date and says when the task is back in Inbox", () => {
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-20" }), { kind: "when", bucket: "no_date" }, ctx()))
      .toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: null } }, announcement: "Moved to No date. It is back in Inbox." });
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-20", horizon: "someday" }), { kind: "when", bucket: "no_date" }, ctx()))
      .toMatchObject({ announcement: "Moved to No date." });
  });

  it("refuses No date for a task with a deadline", () => {
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-16", dueLocalDate: "2026-10-20" }), { kind: "when", bucket: "no_date" }, ctx()))
      .toEqual({ ok: false, rule: "deadline", reason: "Has a deadline (20 Oct). Clear it in details.", action: "open_detail" });
  });

  it("returns confirmLate for a popover day after the carried deadline", () => {
    const write = { kind: "needsDate" as const, min: "2026-10-15", max: "2026-10-21", deadline: "2026-10-17" };
    expect(taskDropDateChoice(write, "2026-10-17", today)).toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: "2026-10-17" } } });
    expect(taskDropDateChoice(write, "2026-10-19", today)).toEqual({
      ok: true,
      write: {
        kind: "confirmLate", day: "2026-10-19", deadline: "2026-10-17", prompt: "Mon is after the Sat deadline",
        planAnyway: { scheduledLocalDate: "2026-10-19" }, moveDeadline: { scheduledLocalDate: "2026-10-19", dueLocalDate: "2026-10-19" },
      },
    });
  });

  it("resolves a date popover choice inside its range only", () => {
    const write = { kind: "needsDate" as const, min: "2026-10-15", max: "2026-10-21" };
    expect(taskDropDateChoice(write, "2026-10-16")).toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: "2026-10-16" } } });
    expect(taskDropDateChoice(write, "2026-10-22")).toMatchObject({ ok: false, reason: "Choose a day from 15 Oct to 21 Oct." });
    expect(taskDropDateChoice({ kind: "needsDate", min: "2026-10-22", max: null }, "2027-01-01")).toMatchObject({ ok: true });
    expect(taskDropDateChoice({ kind: "needsDate", min: "2026-10-22", max: null }, "nonsense")).toMatchObject({ ok: false });
  });
});

describe("planTaskDrop: drop dock", () => {
  it("plans for today with the Today refusals", () => {
    expect(planTaskDrop(task(), { kind: "dock", action: "plan_today" }, ctx())).toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: today } } });
    expect(planTaskDrop(task({ recurrenceRule: daily }), { kind: "dock", action: "plan_today" }, ctx())).toMatchObject({ ok: false, rule: "recurring_schedule" });
  });

  it("archives, refusing recurring series (R1) and committed tasks (R3), but not unfinished prerequisites", () => {
    expect(planTaskDrop(task(), { kind: "dock", action: "archive" }, ctx())).toEqual({ ok: true, write: { kind: "update", patch: { state: "archived" } } });
    expect(planTaskDrop(task({ recurrenceRule: weekly }), { kind: "dock", action: "archive" }, ctx()))
      .toEqual({ ok: false, rule: "R1", reason: "Repeats weekly. Remove the repeat in details before archiving.", action: "open_detail" });
    expect(planTaskDrop(task(), { kind: "dock", action: "archive" }, ctx({ committedTasks: new Map([["t1", today]]) }))).toMatchObject({ ok: false, rule: "R3" });
    expect(planTaskDrop(task(), { kind: "dock", action: "archive" }, ctx({ dependencies: [{ taskId: "t1", dependsOnTaskId: "p", dependencyType: "hard" }] }))).toMatchObject({ ok: true });
    expect(planTaskDrop(task({ state: "archived" }), { kind: "dock", action: "archive" }, ctx())).toEqual({ ok: true, write: { kind: "none" } });
  });
});

describe("completion and archive checks", () => {
  it("does not re-check prerequisites for a task that is already completed (server only checks a transition)", () => {
    expect(taskCompletionCheck(task({ state: "completed" }), ctx({ dependencies: [{ taskId: "t1", dependsOnTaskId: "p", dependencyType: "hard" }] }))).toEqual({ ok: true, via: "update" });
  });

  it("archive check ignores R2", () => {
    expect(taskArchiveCheck(task(), ctx())).toEqual({ ok: true });
  });
});

describe("committedTaskPlans", () => {
  it("mirrors assertNoOutstandingTaskCommitments: committed items in present, non-archived plans", () => {
    const plans = [
      { id: "p-today", localDate: today, state: "active" },
      { id: "p-old", localDate: "2026-10-10", state: "closed" },
      { id: "p-arch", localDate: "2026-10-09", state: "archived" },
    ];
    const items = [
      { dailyPlanId: "p-today", taskId: "a", state: "committed" },
      { dailyPlanId: "p-today", taskId: "b", state: "done" },
      { dailyPlanId: "p-old", taskId: "c", state: "committed" },
      { dailyPlanId: "p-arch", taskId: "d", state: "committed" },
      { dailyPlanId: "p-missing", taskId: "e", state: "committed" },
      { dailyPlanId: "p-old", taskId: "a", state: "committed" },
    ];
    expect(Object.fromEntries(committedTaskPlans(plans, items))).toEqual({ a: today, c: "2026-10-10" });
  });
});

describe("planBulkStateChange (Select mode)", () => {
  const tasks = [
    task({ id: "plain" }),
    task({ id: "repeat", recurrenceRule: daily }),
    task({ id: "committed" }),
    task({ id: "needs-prereq" }),
    task({ id: "needs-selected" }),
    task({ id: "chain" }),
  ];
  const context = ctx({
    committedTasks: new Map([["committed", today]]),
    dependencies: [
      { taskId: "needs-prereq", dependsOnTaskId: "outside", dependencyType: "hard" },
      { taskId: "needs-selected", dependsOnTaskId: "plain", dependencyType: "hard" },
      { taskId: "chain", dependsOnTaskId: "committed", dependencyType: "hard" },
    ],
    tasks: [...tasks.map(item => ({ id: item.id, state: item.state })), { id: "outside", state: "in_progress" }],
  });

  it("excludes R1-R3 for Done, treating selected prerequisites as completed, to a fixed point", () => {
    const plan = planBulkStateChange(tasks, "completed", context);
    expect(plan.eligible.map(item => item.id)).toEqual(["plain", "needs-selected"]);
    expect(plan.excluded.map(item => [item.task.id, item.rule])).toEqual([
      ["repeat", "R1"], ["committed", "R3"], ["needs-prereq", "R2"], ["chain", "R2"],
    ]);
    expect(plan.summary).toBe("4 can't be completed here: Repeats daily; Committed in today's plan; Waiting on 1 task");
    expect(plan.batches).toEqual([["plain", "needs-selected"]]);
  });

  it("excludes only R1 and R3 for Archive", () => {
    const plan = planBulkStateChange(tasks, "archived", context);
    expect(plan.eligible.map(item => item.id)).toEqual(["plain", "needs-prereq", "needs-selected", "chain"]);
    expect(plan.summary).toBe("2 can't be archived here: Repeats daily; Committed in today's plan");
  });

  it("lets every task start, and batches ids by 100", () => {
    const many = Array.from({ length: 205 }, (_, index) => task({ id: `t${index}` }));
    const plan = planBulkStateChange(many, "in_progress", ctx());
    expect(plan.excluded).toEqual([]);
    expect(plan.summary).toBeNull();
    expect(plan.batches.map(batch => batch.length)).toEqual([100, 100, 5]);
  });
});

it("phrases the sort notice for each sort", () => {
  expect(sortOrderNotice("manual")).toBeNull();
  expect(sortOrderNotice("scheduled")).toBe("Sorted by plan date, so the order follows the sort.");
  expect(sortOrderNotice("created")).toBe("Sorted by newest, so the order follows the sort.");
});

describe("planTaskDrop: Week board day columns (Q3) and late drops (Q4)", () => {
  const day = (date: string | null) => ({ kind: "day" as const, date });

  it("sets Plan for to the column's day", () => {
    expect(planTaskDrop(task(), day("2026-10-16"), ctx())).toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: "2026-10-16" } } });
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-20" }), day(today), ctx())).toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: today } } });
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-16" }), day("2026-10-16"), ctx())).toEqual({ ok: true, write: { kind: "none" } });
  });

  it("asks once for a day after the deadline instead of refusing", () => {
    expect(planTaskDrop(task({ dueLocalDate: "2026-10-17" }), day("2026-10-19"), ctx())).toEqual({
      ok: true,
      write: {
        kind: "confirmLate", day: "2026-10-19", deadline: "2026-10-17", prompt: "Mon is after the Sat deadline",
        planAnyway: { scheduledLocalDate: "2026-10-19" }, moveDeadline: { scheduledLocalDate: "2026-10-19", dueLocalDate: "2026-10-19" },
      },
    });
    // Due today, dropped tomorrow.
    expect(planTaskDrop(task({ dueLocalDate: today }), day("2026-10-15"), ctx())).toMatchObject({ ok: true, write: { kind: "confirmLate", prompt: "Thu is after today's deadline" } });
    // Already overdue, dropped on today.
    expect(planTaskDrop(task({ dueLocalDate: "2026-10-10" }), day(today), ctx())).toMatchObject({ ok: true, write: { kind: "confirmLate", prompt: "Today is after the Sat deadline" } });
    // On the deadline itself: no prompt.
    expect(planTaskDrop(task({ dueLocalDate: "2026-10-17" }), day("2026-10-17"), ctx())).toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: "2026-10-17" } } });
  });

  it("resolves the late prompt into one update", () => {
    const plan = planTaskDrop(task({ dueLocalDate: "2026-10-17" }), day("2026-10-19"), ctx());
    if (!plan.ok || plan.write.kind !== "confirmLate") throw new Error("expected confirmLate");
    expect(taskLateDropChoice(plan.write, "plan_anyway")).toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: "2026-10-19" } }, announcement: "Planned for Mon 19 Oct, after the deadline." });
    expect(taskLateDropChoice(plan.write, "move_deadline")).toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: "2026-10-19", dueLocalDate: "2026-10-19" } }, announcement: "Planned and deadline moved to Mon 19 Oct." });
    expect(lateDropConfirm("2026-11-02", "2026-10-17", today).prompt).toBe("2 Nov is after the Sat deadline");
  });

  it("Unscheduled clears Plan for and says when the task is back in Inbox", () => {
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-16" }), day(null), ctx()))
      .toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: null } }, announcement: "Moved to Unscheduled. It is back in Inbox." });
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-16", dueLocalDate: "2026-10-20" }), day(null), ctx()))
      .toMatchObject({ ok: true, announcement: "Moved to Unscheduled." });
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-16", projectId: "p1" }), day(null), ctx()))
      .toMatchObject({ ok: true, announcement: "Moved to Unscheduled." });
    expect(planTaskDrop(task({ dueLocalDate: "2026-10-20" }), day(null), ctx())).toEqual({ ok: true, write: { kind: "none" } });
  });

  it("keeps hard refusals only for impossible moves", () => {
    expect(planTaskDrop(task({ state: "archived" }), day("2026-10-16"), ctx())).toMatchObject({ ok: false, rule: "archived" });
    expect(planTaskDrop(task({ recurrenceRule: weekly, scheduledLocalDate: "2026-09-25" }), day("2026-10-16"), ctx())).toMatchObject({ ok: false, rule: "recurring_schedule" });
    expect(planTaskDrop(task({ recurrenceRule: weekly, scheduledLocalDate: "2026-09-25" }), day(null), ctx())).toMatchObject({ ok: false, rule: "recurring_schedule" });
    expect(planTaskDrop(task(), day("2026-10-13"), ctx())).toEqual({ ok: false, rule: "past", reason: "You can't plan into the past." });
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-16", ...reservedFriday }), day("2026-10-17"), ctx())).toMatchObject({ ok: false, rule: "reserved" });
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-16", ...reservedFriday }), day(null), ctx())).toMatchObject({ ok: false, rule: "reserved" });
    expect(planTaskDrop(task({ scheduledLocalDate: "2026-10-15", ...reservedFriday }), day("2026-10-16"), ctx())).toEqual({ ok: true, write: { kind: "update", patch: { scheduledLocalDate: "2026-10-16" } } });
  });

  it("refuses any drop while the task's last write is still saving", () => {
    const pending = ctx({ pendingTaskIds: new Set(["t1"]) });
    expect(planTaskDrop(task(), day("2026-10-16"), pending)).toEqual({ ok: false, rule: "saving", reason: "The last move is still saving." });
    expect(planTaskDrop(task(), { kind: "status", lane: "in_progress" }, pending)).toMatchObject({ ok: false, rule: "saving" });
  });
});
