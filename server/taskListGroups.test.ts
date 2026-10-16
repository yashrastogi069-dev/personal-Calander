import { describe, expect, it } from "vitest";
import {
  archivedList,
  completedArchive,
  completedTaskPlacement,
  groupTasksByCategory,
  groupTasksByProject,
  groupTasksByWhen,
  type GroupableTask,
} from "@shared/taskListGroups";

// 2026-10-15 is a Thursday; the week is Mon 12 – Sun 18. Auckland is UTC+13 in October.
const today = "2026-10-15";
const timezone = "Pacific/Auckland";

function task(id: string, overrides: Partial<GroupableTask> = {}): GroupableTask {
  return { id, title: id, state: "not_started", horizon: "weekly", dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, recurrenceRule: null, estimateMinutes: 30, ...overrides };
}

const ids = (rows: readonly { id: string }[]) => rows.map(row => row.id);

describe("groupTasksByWhen (Q7)", () => {
  const tasks = [
    task("overdue", { dueLocalDate: "2026-10-13", estimateMinutes: 20 }),
    task("slipped", { scheduledLocalDate: "2026-10-11", estimateMinutes: 15 }),
    task("today", { scheduledLocalDate: today, estimateMinutes: 60 }),
    task("dueSat", { dueLocalDate: "2026-10-17", projectId: "p1" }),
    task("planSun", { scheduledLocalDate: "2026-10-18" }),
    task("nextMon", { scheduledLocalDate: "2026-10-19" }),
    task("someday", { horizon: "someday", dueLocalDate: "2026-10-01" }),
    task("nodate", { projectId: "p1", estimateMinutes: null }),
    task("archived", { state: "archived" }),
    task("doneToday", { state: "completed", scheduledLocalDate: today, completedAt: "2026-10-14T21:00:00.000Z", estimateMinutes: 10 }),
    task("justTicked", { state: "completed", scheduledLocalDate: today, completedAt: "2026-10-14T23:00:00.000Z", estimateMinutes: 5 }),
    task("doneOld", { state: "completed", completedAt: "2026-10-01T21:00:00.000Z" }),
  ];

  it("returns all seven groups in order with rows, open counts and total time", () => {
    const groups = groupTasksByWhen(tasks, today, timezone, { keepInPlaceIds: new Set(["justTicked"]) });
    expect(groups.map(group => group.label)).toEqual(["Overdue", "Today", "This week", "Later", "Someday", "No date", "Done today"]);
    const get = (id: string) => groups.find(group => group.id === id)!;
    expect(ids(get("overdue").tasks)).toEqual(["overdue", "slipped"]);
    expect(get("overdue")).toMatchObject({ count: 2, estimateMinutes: 35 });
    // Ticked this session: stays dimmed in Today, not counted (Fable Q2).
    expect(ids(get("today").tasks)).toEqual(["today", "justTicked"]);
    expect(get("today")).toMatchObject({ count: 1, estimateMinutes: 60 });
    expect(ids(get("this_week").tasks)).toEqual(["dueSat", "planSun"]);
    expect(ids(get("later").tasks)).toEqual(["nextMon"]);
    expect(ids(get("someday").tasks)).toEqual(["someday"]);
    expect(get("no_date")).toMatchObject({ count: 1, estimateMinutes: 0 });
    expect(get("done_today")).toMatchObject({ count: 1, estimateMinutes: 10, collapsedByDefault: true });
    expect(ids(get("done_today").tasks)).toEqual(["doneToday"]);
    expect(groups.flatMap(group => ids(group.tasks))).not.toContain("archived");
    expect(groups.flatMap(group => ids(group.tasks))).not.toContain("doneOld");
  });

  it("sends a just-ticked task to Done today after reload (no keep-in-place set)", () => {
    const groups = groupTasksByWhen(tasks, today, timezone);
    expect(ids(groups.find(group => group.id === "done_today")!.tasks)).toEqual(["doneToday", "justTicked"]);
  });

  it("ends This week on the workspace's last week day", () => {
    const sundayWeek = groupTasksByWhen([task("sun", { scheduledLocalDate: "2026-10-18" })], today, timezone, { weekStartsOn: 0 });
    expect(ids(sundayWeek.find(group => group.id === "later")!.tasks)).toEqual(["sun"]);
  });

  it("places a week-flagged task with no day in This week (Fable Q1, once the field exists)", () => {
    const groups = groupTasksByWhen([task("week", { plannedWeekStartLocalDate: "2026-10-12" }), task("nextWeek", { plannedWeekStartLocalDate: "2026-10-19" })], today, timezone);
    expect(ids(groups.find(group => group.id === "this_week")!.tasks)).toEqual(["week"]);
    expect(ids(groups.find(group => group.id === "later")!.tasks)).toEqual(["nextWeek"]);
  });

  it("uses the next occurrence for a recurring series, never its anchor", () => {
    const series = task("series", { recurrenceRule: { frequency: "weekly", weekdays: [5] }, scheduledLocalDate: "2026-09-25" });
    expect(ids(groupTasksByWhen([series], today, timezone).find(group => group.id === "this_week")!.tasks)).toEqual(["series"]);
  });
});

describe("Project and Category grouping (Q7)", () => {
  const projects = [{ id: "p1", name: "Launch portfolio", categoryId: "c-personal" }, { id: "p2", name: "Home", categoryId: null }];
  const categories = [{ id: "c-work", name: "Work" }, { id: "c-personal", name: "Personal" }];
  const tasks = [
    task("a", { projectId: "p1", estimateMinutes: 45 }),
    task("b", { projectId: "p2" }),
    task("c", { categoryId: "c-work" }),
    task("d"),
    task("e", { projectId: "gone" }),
    task("done", { state: "completed", projectId: "p1", completedAt: "2026-10-14T21:00:00.000Z" }),
  ];

  it("groups by project in the given order, then No project, then Done today", () => {
    const groups = groupTasksByProject(tasks, projects, today, timezone);
    expect(groups.map(group => [group.label, ids(group.tasks)])).toEqual([
      ["Launch portfolio", ["a"]], ["Home", ["b"]], ["gone", ["e"]], ["No project", ["c", "d"]], ["Done today", ["done"]],
    ]);
    expect(groups[0]).toMatchObject({ id: "p1", count: 1, estimateMinutes: 45 });
    expect(groups[3].id).toBe("none");
  });

  it("groups by category, falling back to the project's category", () => {
    const groups = groupTasksByCategory(tasks, categories, today, timezone, { projects });
    expect(groups.map(group => [group.label, ids(group.tasks)])).toEqual([
      ["Work", ["c"]], ["Personal", ["a"]], ["No category", ["b", "d", "e"]], ["Done today", ["done"]],
    ]);
  });
});

describe("Archive (Q9)", () => {
  const tasks = [
    task("thisWeek", { state: "completed", completedAt: "2026-10-13T02:00:00.000Z", estimateMinutes: 20 }), // Tue 13
    task("thisWeek2", { state: "completed", completedAt: "2026-10-13T20:00:00.000Z", estimateMinutes: 25 }), // Wed 14 09:00 NZDT
    task("lastWeek", { state: "completed", completedAt: "2026-10-07T02:00:00.000Z", title: "Send invoice" }),
    task("older", { state: "completed", completedAt: "2026-09-29T02:00:00.000Z" }),
    task("today", { state: "completed", completedAt: "2026-10-14T21:00:00.000Z" }), // Thu 15 NZDT: still in the List
    task("open"),
    task("arch1", { state: "archived", archivedAt: "2026-10-01T00:00:00.000Z", title: "Pottery class" }),
    task("arch2", { state: "archived", archivedAt: "2026-10-10T00:00:00.000Z" }),
  ];

  it("groups completed work by week, newest first, with counts and time; today's stays out until midnight", () => {
    const weeks = completedArchive(tasks, today, { timezone });
    expect(weeks.map(week => [week.label, ids(week.tasks), week.count])).toEqual([
      ["This week", ["thisWeek2", "thisWeek"], 2],
      ["Last week", ["lastWeek"], 1],
      ["28 Sep – 4 Oct", ["older"], 1],
    ]);
    expect(weeks[0].estimateMinutes).toBe(45);
    expect(weeks[0]).toMatchObject({ weekStart: "2026-10-12", weekEnd: "2026-10-18" });
  });

  it("searches completed and archived work", () => {
    expect(completedArchive(tasks, today, { timezone, query: "invoice" }).map(week => ids(week.tasks))).toEqual([["lastWeek"]]);
    expect(ids(archivedList(tasks))).toEqual(["arch2", "arch1"]);
    expect(ids(archivedList(tasks, "pottery"))).toEqual(["arch1"]);
  });

  it("says where a finished task shows (display rule only)", () => {
    const ctx = { today, timezone };
    expect(completedTaskPlacement(tasks[4], ctx)).toBe("done_today");
    expect(completedTaskPlacement(tasks[4], ctx, new Set(["today"]))).toBe("in_place");
    expect(completedTaskPlacement(tasks[0], ctx)).toBe("archive");
    expect(completedTaskPlacement(tasks[5], ctx)).toBeNull();
  });
});
