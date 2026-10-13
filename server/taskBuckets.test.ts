import { describe, expect, it } from "vitest";
import { navBadgeCounts } from "../client/src/features/shell/premiumNavigation";
import {
  completedOnLocalDay,
  groupTasksByWhen,
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
    task({ id: "i", recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-09-20" }),
  ];

  it("counts open tasks per bucket with overdue and someday sub-counts", () => {
    expect(taskWhenBucketCounts(tasks, ctx)).toEqual({ past_due: 4, today: 1, next_7_days: 0, later: 0, no_date: 2, overdue: 3, someday: 1 });
  });

  it("matches the D1 rail overdue badge exactly", () => {
    expect(taskWhenBucketCounts(tasks, ctx).overdue).toBe(navBadgeCounts({ today: ctx.today, tasks, todayTaskCount: null, dueHabitCount: null }).overdue);
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
