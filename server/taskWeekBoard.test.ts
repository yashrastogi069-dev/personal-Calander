import { describe, expect, it } from "vitest";
import type { BucketTask } from "@shared/taskBuckets";
import { inStatusWeekScope, localWeekDays, localWeekStart, pagedWeekStart, weekBoardColumns, type WeekBoardTask } from "@shared/taskWeekBoard";

// 2026-10-15 is a Thursday (the prototype's fixed today). Auckland is UTC+13 in October.
const today = "2026-10-15";
const timezone = "Pacific/Auckland";

function task(id: string, overrides: Partial<WeekBoardTask> = {}): WeekBoardTask {
  return { id, state: "not_started", horizon: "weekly", dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, recurrenceRule: null, projectId: "p1", estimateMinutes: 30, ...overrides };
}

describe("week maths", () => {
  it("finds the week start for Monday and Sunday weeks", () => {
    expect(localWeekStart(today)).toBe("2026-10-12");
    expect(localWeekStart("2026-10-18")).toBe("2026-10-12");
    expect(localWeekStart("2026-10-12")).toBe("2026-10-12");
    expect(localWeekStart(today, 0)).toBe("2026-10-11");
    expect(localWeekDays("2026-10-12")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(pagedWeekStart(today, 1)).toBe("2026-10-19");
    expect(pagedWeekStart(today, -1)).toBe("2026-10-05");
  });
});

describe("weekBoardColumns", () => {
  const ctx = { today, timezone, weekStart: "2026-10-12" };

  it("returns Unscheduled then Mon…Sun with labels, today and past flags", () => {
    const columns = weekBoardColumns([], ctx);
    expect(columns.map(column => column.label)).toEqual(["Unscheduled", "Mon 12", "Tue 13", "Wed 14", "Thu 15", "Fri 16", "Sat 17", "Sun 18"]);
    expect(columns.map(column => column.id)[0]).toBe("none");
    expect(columns.find(column => column.isToday)?.date).toBe(today);
    expect(columns.filter(column => column.isPast).map(column => column.date)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
  });

  it("places cards by Plan for with counts and estimates; Unscheduled holds decided work with no day", () => {
    const tasks = [
      task("fri", { scheduledLocalDate: "2026-10-16", estimateMinutes: 45 }),
      task("fri2", { scheduledLocalDate: "2026-10-16", estimateMinutes: 15 }),
      task("dueOnly", { projectId: null, dueLocalDate: "2026-10-17", estimateMinutes: 20 }),
      task("projectOnly", { estimateMinutes: 10 }),
      task("inbox", { projectId: null }),
      task("someday", { horizon: "someday" }),
      task("archived", { state: "archived", scheduledLocalDate: "2026-10-16" }),
      task("nextWeek", { scheduledLocalDate: "2026-10-20" }),
      task("doneToday", { state: "completed", scheduledLocalDate: "2026-10-16", completedAt: "2026-10-14T20:00:00.000Z" }),
      task("doneOld", { state: "completed", scheduledLocalDate: "2026-10-16", completedAt: "2026-10-10T20:00:00.000Z" }),
      task("reserved", { plannedStartAt: "2026-10-15T20:15:00.000Z", plannedEndAt: "2026-10-15T21:00:00.000Z" }), // Fri 16 09:15 NZDT
      task("slipped", { scheduledLocalDate: "2026-10-01" }),
    ];
    const columns = weekBoardColumns(tasks, ctx);
    const col = (id: string) => columns.find(column => column.id === id)!;
    expect(col("2026-10-16").tasks.map(item => item.id)).toEqual(["fri", "fri2", "reserved", "doneToday"]);
    expect(col("2026-10-16").count).toBe(3);
    expect(col("2026-10-16").estimateMinutes).toBe(90);
    expect(col("none").tasks.map(item => item.id)).toEqual(["dueOnly", "projectOnly", "slipped"]);
    expect(col("none").estimateMinutes).toBe(60);
  });

  it("does not pull slipped work into a week that does not hold today", () => {
    const columns = weekBoardColumns([task("slipped", { scheduledLocalDate: "2026-10-01" })], { ...ctx, weekStart: "2026-10-19" });
    expect(columns[0].tasks).toEqual([]);
  });

  it("puts a recurring series on its next occurrence in the week, never in Unscheduled", () => {
    const series = task("series", { recurrenceRule: { frequency: "weekly", weekdays: [5] }, scheduledLocalDate: "2026-09-25" });
    const columns = weekBoardColumns([series], ctx);
    expect(columns.find(column => column.id === "2026-10-16")!.tasks.map(item => item.id)).toEqual(["series"]);
    expect(weekBoardColumns([series], { ...ctx, weekStart: "2026-11-30", today: "2026-12-05" })[0].tasks).toEqual([]);
  });
});

describe("inStatusWeekScope (Fable Q4: this week only)", () => {
  const ctx = { today, timezone };
  const t = (overrides: Partial<BucketTask>) => ({ id: "x", state: "not_started", ...overrides });
  it("keeps overdue, this week's dated work, Doing and today's Done; leaves later and undated work out", () => {
    expect(inStatusWeekScope(t({ dueLocalDate: "2026-10-10" }), ctx)).toBe(true);
    expect(inStatusWeekScope(t({ scheduledLocalDate: "2026-10-18" }), ctx)).toBe(true);
    expect(inStatusWeekScope(t({ dueLocalDate: "2026-10-18" }), ctx)).toBe(true);
    expect(inStatusWeekScope(t({ scheduledLocalDate: "2026-10-19" }), ctx)).toBe(false);
    expect(inStatusWeekScope(t({}), ctx)).toBe(false);
    expect(inStatusWeekScope(t({ state: "in_progress", scheduledLocalDate: "2026-12-01" }), ctx)).toBe(true);
    expect(inStatusWeekScope(t({ state: "completed", completedAt: "2026-10-14T20:00:00.000Z" }), ctx)).toBe(true);
    expect(inStatusWeekScope(t({ state: "completed", completedAt: "2026-10-12T20:00:00.000Z" }), ctx)).toBe(false);
    expect(inStatusWeekScope(t({ plannedWeekStartLocalDate: "2026-10-12" }), ctx)).toBe(true);
    expect(inStatusWeekScope(t({ horizon: "someday", dueLocalDate: "2026-10-16" }), ctx)).toBe(false);
  });
});
