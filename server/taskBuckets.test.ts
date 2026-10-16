import { describe, expect, it } from "vitest";
import { navBadgeCounts } from "../client/src/features/shell/premiumNavigation";
import { inboxTasks, taskHeaderSummary } from "../client/src/features/tasks/taskWorkspaceModel";
import {
  completedOnLocalDay,
  deadlineIsSeriesAnchor,
  groupTasksByWhen,
  isInboxTask,
  isOverdueTask,
  overdueDays,
  reservedLocalDate,
  taskListSection,
  taskWhenBucket,
  taskWhenBucketCounts,
  taskWhenPlacement,
  type BucketTask,
} from "@shared/taskBuckets";

// 2026-10-14 is a Wednesday. Auckland is UTC+13 in October (daylight time).
const ctx = { today: "2026-10-14", timezone: "Pacific/Auckland" };

function task(overrides: Partial<BucketTask> = {}): BucketTask {
  return { id: "t1", state: "not_started", horizon: "weekly", dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, recurrenceRule: null, ...overrides };
}

describe("taskWhenBucket", () => {
  it("puts a missed deadline in Past due as overdue", () => {
    expect(taskWhenPlacement(task({ dueLocalDate: "2026-10-12" }), ctx)).toMatchObject({ bucket: "past_due", pastDue: "deadline", keyDate: "2026-10-12" });
  });

  it("puts a slipped plan in Past due as slipped, unless a reservation today or later rescues it", () => {
    expect(taskWhenPlacement(task({ scheduledLocalDate: "2026-10-12" }), ctx)).toMatchObject({ bucket: "past_due", pastDue: "slipped", keyDate: "2026-10-12" });
    expect(taskWhenPlacement(task({ scheduledLocalDate: "2026-10-12", plannedStartAt: "2026-10-15T20:00:00.000Z", plannedEndAt: "2026-10-15T21:00:00.000Z" }), ctx))
      .toMatchObject({ bucket: "next_7_days", pastDue: null, keyDate: "2026-10-16" });
  });

  it("lets the deadline win over a slipped plan in Past due", () => {
    expect(taskWhenPlacement(task({ scheduledLocalDate: "2026-10-10", dueLocalDate: "2026-10-12" }), ctx).pastDue).toBe("deadline");
  });

  it("treats a stale reservation with no Plan for date as slipped work", () => {
    expect(taskWhenPlacement(task({ plannedStartAt: "2026-10-10T20:00:00.000Z", plannedEndAt: "2026-10-10T21:00:00.000Z" }), ctx)).toMatchObject({ bucket: "past_due", pastDue: "slipped" });
  });

  it("places by the earliest date on or after today", () => {
    expect(taskWhenBucket(task({ scheduledLocalDate: "2026-10-14" }), ctx)).toBe("today");
    expect(taskWhenBucket(task({ dueLocalDate: "2026-10-14" }), ctx)).toBe("today");
    expect(taskWhenBucket(task({ scheduledLocalDate: "2026-10-15" }), ctx)).toBe("next_7_days");
    expect(taskWhenBucket(task({ scheduledLocalDate: "2026-10-21" }), ctx)).toBe("next_7_days");
    expect(taskWhenBucket(task({ scheduledLocalDate: "2026-10-22" }), ctx)).toBe("later");
    expect(taskWhenBucket(task({ scheduledLocalDate: "2026-11-30", dueLocalDate: "2026-10-16" }), ctx)).toBe("next_7_days");
  });

  it("lets a reservation today beat a later plan date", () => {
    // 2026-10-13T20:15Z is 09:15 on 14 Oct in Auckland.
    const reserved = task({ scheduledLocalDate: "2026-10-20", plannedStartAt: "2026-10-13T20:15:00.000Z", plannedEndAt: "2026-10-13T21:30:00.000Z" });
    expect(taskWhenPlacement(reserved, ctx)).toMatchObject({ bucket: "today", keyDate: "2026-10-14" });
  });

  it("reads the reservation day in the workspace timezone, never from the UTC date", () => {
    const reserved = task({ plannedStartAt: "2026-10-13T20:15:00.000Z", plannedEndAt: "2026-10-13T21:30:00.000Z" });
    expect(reservedLocalDate(reserved, "Pacific/Auckland")).toBe("2026-10-14");
    expect(reservedLocalDate(reserved, "UTC")).toBe("2026-10-13");
    expect(taskWhenBucket(reserved, ctx)).toBe("today");
    expect(taskWhenBucket(reserved, { today: "2026-10-14", timezone: "UTC" })).toBe("past_due");
    expect(reservedLocalDate(task({ plannedStartAt: "2026-10-13T20:15:00.000Z", plannedEndAt: null }), "UTC")).toBeNull();
  });

  it("puts Inbox and Someday work in No date", () => {
    expect(taskWhenBucket(task(), ctx)).toBe("no_date");
    expect(taskWhenBucket(task({ horizon: "someday" }), ctx)).toBe("no_date");
  });

  describe("recurring series", () => {
    const daily = task({ recurrenceRule: { frequency: "daily" }, scheduledLocalDate: "2026-09-24" });

    it("never slips on its anchor date", () => {
      expect(taskWhenPlacement(daily, ctx)).toMatchObject({ bucket: "today", pastDue: null });
    });

    it("uses a pending occurrence today, and stays in Today once today's is done", () => {
      expect(taskWhenBucket(daily, { ...ctx, occurrences: [{ id: "o", taskId: "t1", localDate: "2026-10-14", state: "pending" }] })).toBe("today");
      expect(taskWhenBucket(daily, { ...ctx, occurrences: [{ id: "o", taskId: "t1", localDate: "2026-10-14", state: "completed" }] })).toBe("today");
    });

    it("uses the next occurrence for later series", () => {
      expect(taskWhenBucket(task({ recurrenceRule: { frequency: "weekly", weekdays: [4] }, scheduledLocalDate: "2026-09-24" }), ctx)).toBe("next_7_days");
      expect(taskWhenBucket(task({ recurrenceRule: { frequency: "monthly" }, scheduledLocalDate: "2026-09-30" }), ctx)).toBe("later");
    });

    it("has no date once the series ended", () => {
      expect(taskWhenBucket({ ...daily, recurrenceUntilLocalDate: "2026-10-01" }, ctx)).toBe("no_date");
    });

    describe("anchored on a deadline only (no Plan for date)", () => {
      // The deadline is the series start (`recurrenceSeriesStart`), so it is never a missed deadline.
      it("places a past anchor by the next occurrence, never in Past due", () => {
        expect(taskWhenPlacement(task({ recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-09-20" }), ctx))
          .toMatchObject({ bucket: "today", keyDate: "2026-10-14", pastDue: null });
        // 24 Sep 2026 is a Thursday, so the next one is Thu 15 Oct.
        expect(taskWhenPlacement(task({ recurrenceRule: { frequency: "weekly" }, dueLocalDate: "2026-09-24" }), ctx))
          .toMatchObject({ bucket: "next_7_days", keyDate: "2026-10-15", pastDue: null });
        expect(taskWhenPlacement(task({ recurrenceRule: { frequency: "monthly" }, dueLocalDate: "2026-09-30" }), ctx))
          .toMatchObject({ bucket: "later", keyDate: "2026-10-30", pastDue: null });
      });

      it("uses a pending materialized occurrence before the computed date", () => {
        const monthly = task({ recurrenceRule: { frequency: "monthly" }, dueLocalDate: "2026-09-30" });
        const occurrences = [{ id: "o", taskId: "t1", localDate: "2026-10-20", state: "pending" }];
        expect(taskWhenPlacement(monthly, { ...ctx, occurrences })).toMatchObject({ bucket: "next_7_days", keyDate: "2026-10-20", pastDue: null });
      });

      it("stays in Today once today's occurrence is resolved", () => {
        const daily = task({ recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-09-20" });
        expect(taskWhenBucket(daily, { ...ctx, occurrences: [{ id: "o", taskId: "t1", localDate: "2026-10-14", state: "skipped" }] })).toBe("today");
      });

      it("has no date once the series ended, or when it repeats after completion with nothing materialized", () => {
        expect(taskWhenPlacement(task({ recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-09-20", recurrenceUntilLocalDate: "2026-10-01" }), ctx))
          .toMatchObject({ bucket: "no_date", pastDue: null, recurring: { kind: "ended" } });
        const afterCompletion = task({ recurrenceRule: { frequency: "weekly" }, recurrenceAnchor: "completion", dueLocalDate: "2026-09-20" });
        expect(taskWhenPlacement(afterCompletion, ctx)).toMatchObject({ bucket: "no_date", pastDue: null, recurring: { kind: "after_completion" } });
        expect(taskWhenBucket(afterCompletion, { ...ctx, occurrences: [{ id: "o", taskId: "t1", localDate: "2026-10-18", state: "pending" }] })).toBe("next_7_days");
      });

      it("places a future anchor on its first occurrence", () => {
        expect(taskWhenPlacement(task({ recurrenceRule: { frequency: "weekly" }, dueLocalDate: "2026-11-05" }), ctx)).toMatchObject({ bucket: "later", keyDate: "2026-11-05" });
      });
    });

    it("still treats a past deadline as overdue when a Plan for date anchors the series", () => {
      expect(taskWhenPlacement(task({ recurrenceRule: { frequency: "daily" }, scheduledLocalDate: "2026-09-24", dueLocalDate: "2026-10-01" }), ctx))
        .toMatchObject({ bucket: "past_due", pastDue: "deadline", keyDate: "2026-10-01" });
    });
  });
});

describe("shared overdue and Inbox rules", () => {
  it("never calls a recurring series' anchor deadline missed", () => {
    expect(deadlineIsSeriesAnchor(task({ recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-09-20" }))).toBe(true);
    expect(deadlineIsSeriesAnchor(task({ recurrenceRule: { frequency: "daily" }, scheduledLocalDate: "2026-09-20", dueLocalDate: "2026-09-20" }))).toBe(false);
    expect(deadlineIsSeriesAnchor(task({ dueLocalDate: "2026-09-20" }))).toBe(false);
    expect(isOverdueTask(task({ dueLocalDate: "2026-10-13" }), ctx.today)).toBe(true);
    expect(isOverdueTask(task({ dueLocalDate: "2026-10-14" }), ctx.today)).toBe(false);
    expect(isOverdueTask(task({ state: "completed", dueLocalDate: "2026-10-01" }), ctx.today)).toBe(false);
    expect(isOverdueTask(task({ recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-09-20" }), ctx.today)).toBe(false);
  });

  it("keeps only undecided work in the Inbox (Q1/Q2: any date, a project or Someday takes it out)", () => {
    expect(isInboxTask(task())).toBe(true);
    expect(isInboxTask(task({ dueLocalDate: "2026-10-20" }))).toBe(false);
    expect(isInboxTask(task({ dueLocalDate: "2026-10-01" }))).toBe(false);
    expect(isInboxTask(task({ projectId: "p1" }))).toBe(false);
    expect(isInboxTask(task({ plannedWeekStartLocalDate: "2026-10-12" }))).toBe(false);
    expect(isInboxTask(task({ state: "completed" }))).toBe(false);
    expect(isInboxTask(task({ state: "blocked" }))).toBe(true);
    expect(isInboxTask(task({ horizon: "someday" }))).toBe(false);
    expect(isInboxTask(task({ scheduledLocalDate: "2026-10-20" }))).toBe(false);
    expect(isInboxTask(task({ plannedStartAt: "2026-10-15T20:00:00.000Z", plannedEndAt: "2026-10-15T21:00:00.000Z" }))).toBe(false);
    expect(isInboxTask(task({ state: "archived" }))).toBe(false);
  });
});

describe("taskWhenBucketCounts", () => {
  const tasks = [
    task({ id: "a", dueLocalDate: "2026-10-10" }),
    task({ id: "b", scheduledLocalDate: "2026-10-12" }),
    task({ id: "c", dueLocalDate: "2026-10-13", scheduledLocalDate: "2026-10-14" }),
    task({ id: "d", scheduledLocalDate: "2026-10-14" }),
    task({ id: "e", horizon: "someday" }),
    task({ id: "f" }),
    task({ id: "g", state: "completed", dueLocalDate: "2026-10-01" }),
    task({ id: "h", state: "archived", dueLocalDate: "2026-10-01" }),
    // A daily series anchored on a past deadline: placed by today's occurrence, not Past due (owner 2026-10-14).
    task({ id: "i", recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-09-20" }),
    // A series anchored on its Plan for date keeps a real deadline, which it has missed.
    task({ id: "j", recurrenceRule: { frequency: "daily" }, scheduledLocalDate: "2026-09-24", dueLocalDate: "2026-10-01" }),
    task({ id: "k", recurrenceRule: { frequency: "weekly" }, dueLocalDate: "2026-09-20", recurrenceUntilLocalDate: "2026-10-01" }),
  ];

  it("counts open tasks per bucket with overdue and someday sub-counts", () => {
    expect(taskWhenBucketCounts(tasks, ctx)).toEqual({ past_due: 4, today: 2, next_7_days: 0, later: 0, no_date: 3, overdue: 3, someday: 1 });
  });

  it("matches the D1 rail overdue badge exactly", () => {
    const badges = navBadgeCounts({ today: ctx.today, tasks, todayTaskCount: null, dueHabitCount: null });
    expect(badges.overdue).toBe(3);
    expect(taskWhenBucketCounts(tasks, ctx).overdue).toBe(badges.overdue);
  });

  it("keeps the badge, the Past due overdue sub-count and the Tasks header in parity on any mix", () => {
    const occurrences = [
      { id: "o1", taskId: "i", localDate: "2026-10-14", state: "completed" },
      { id: "o2", taskId: "m", localDate: "2026-10-16", state: "pending" },
    ];
    const mixed = [
      ...tasks,
      task({ id: "m", recurrenceRule: { frequency: "weekly" }, recurrenceAnchor: "completion", dueLocalDate: "2026-08-01" }),
      task({ id: "n", recurrenceRule: { frequency: "monthly" }, dueLocalDate: "2026-11-02" }),
      task({ id: "o", state: "in_progress", dueLocalDate: "2026-10-13", plannedStartAt: "2026-10-15T20:00:00.000Z", plannedEndAt: "2026-10-15T21:00:00.000Z" }),
      task({ id: "p", state: "blocked", horizon: "someday", dueLocalDate: "2026-10-02" }),
    ];
    const withOccurrences = { ...ctx, occurrences };
    const badges = navBadgeCounts({ today: ctx.today, tasks: mixed, todayTaskCount: null, dueHabitCount: null });
    const counts = taskWhenBucketCounts(mixed, withOccurrences);
    const pastDueDeadline = mixed.filter(item => item.state !== "completed" && item.state !== "archived"
      && taskWhenPlacement(item, withOccurrences).pastDue === "deadline");
    expect(badges.overdue).toBe(5);
    expect(counts.overdue).toBe(badges.overdue);
    expect(pastDueDeadline).toHaveLength(badges.overdue!);
    const rows = mixed.map(item => ({ ...item, title: item.id, createdAt: undefined }));
    expect(taskHeaderSummary(rows, withOccurrences).overdue).toBe(badges.overdue);
    // Inbox badge equals the Inbox tab and the header: Someday ("e", "p") and any dated work (deadlines too,
    // owner decision Q2) leave it; only the undecided "f" stays.
    expect(inboxTasks(rows).map(item => item.id)).toEqual(["f"]);
    expect(badges.inbox).toBe(inboxTasks(rows).length);
    expect(taskHeaderSummary(rows, withOccurrences).inbox).toBe(badges.inbox);
  });
});

describe("List sections", () => {
  it("keeps a task completed today in its When section and sends older completions to Done", () => {
    const doneToday = task({ state: "completed", scheduledLocalDate: "2026-10-14", completedAt: "2026-10-13T22:00:00.000Z" });
    const doneEarlier = task({ state: "completed", scheduledLocalDate: "2026-10-14", completedAt: "2026-10-12T22:00:00.000Z" });
    expect(completedOnLocalDay(doneToday, ctx)).toBe(true);
    expect(taskListSection(doneToday, ctx)).toBe("today");
    expect(taskListSection(doneEarlier, ctx)).toBe("done");
    expect(taskListSection(task({ state: "archived" }), ctx)).toBeNull();
  });

  it("orders To do cards by When while keeping the caller's order inside each group", () => {
    const groups = groupTasksByWhen([
      task({ id: "later", scheduledLocalDate: "2026-12-01" }),
      task({ id: "today-1", scheduledLocalDate: "2026-10-14" }),
      task({ id: "none" }),
      task({ id: "today-2", dueLocalDate: "2026-10-14" }),
      task({ id: "past", dueLocalDate: "2026-10-01" }),
    ], ctx);
    expect(groups.map(group => [group.label, group.tasks.map(item => item.id)])).toEqual([
      ["Past due", ["past"]],
      ["Today", ["today-1", "today-2"]],
      ["Later", ["later"]],
      ["No date", ["none"]],
    ]);
  });

  it("counts overdue days in calendar days", () => {
    expect(overdueDays("2026-10-12", "2026-10-14")).toBe(2);
    expect(overdueDays("2026-10-14", "2026-10-14")).toBe(0);
  });
});
