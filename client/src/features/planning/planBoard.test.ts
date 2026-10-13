import { describe, expect, it } from "vitest";
import { projectPlanWeek, completePlanningWeek, restorePlanDate, weekStartFor } from "./planBoard";

const range = { start: "2026-10-01", end: "2026-10-31" };

describe("Plan week projection", () => {
  it("uses Monday identity and seven reachable dates", () => {
    expect(weekStartFor("2026-10-11")).toBe("2026-10-05");
    expect(projectPlanWeek({ weekStart: "2026-10-05", timezone: "UTC", range, snapshot: {} }).days.map(day => day.localDate)).toEqual([
      "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11",
    ]);
  });

  it("keeps a deadline-only task in unplanned work", () => {
    const board = projectPlanWeek({ weekStart: "2026-10-05", timezone: "UTC", range, snapshot: { tasks: [{ id: "due", title: "Pay bill", dueLocalDate: "2026-10-08", state: "todo" }] } });
    expect(board.days.flatMap(day => day.cards)).toHaveLength(0);
    expect(board.unplanned.map(task => task.id)).toEqual(["due"]);
  });

  it("collapses same-task/day facts while retaining distinct source identities", () => {
    const board = projectPlanWeek({ weekStart: "2026-10-05", timezone: "UTC", range, snapshot: {
      tasks: [{ id: "t", title: "Write", state: "todo", scheduledLocalDate: "2026-10-08", plannedStartAt: "2026-10-08T09:00:00Z", plannedEndAt: "2026-10-08T09:30:00Z" }],
      dailyPlans: [{ id: "p", localDate: "2026-10-08" }],
      dailyPlanItems: [{ id: "c", dailyPlanId: "p", taskId: "t", state: "committed" }],
      taskOccurrences: [{ id: "o", taskId: "t", localDate: "2026-10-08", state: "pending" }],
    } });
    const cards = board.days[3].cards;
    expect(cards).toHaveLength(1);
    expect(cards[0].taskId).toBe("t");
    expect(cards[0].sources).toEqual(expect.arrayContaining([
      { kind: "planned_day", id: "t" }, { kind: "reservation", id: "t" },
      { kind: "commitment", id: "c", state: "committed" }, { kind: "occurrence", id: "o", state: "pending" },
    ]));
    expect(cards[0].reservation).toEqual({ startsAt: "2026-10-08T09:00:00Z", endsAt: "2026-10-08T09:30:00Z" });
  });

  it("retains missing commitment links and occurrence identity", () => {
    const board = projectPlanWeek({ weekStart: "2026-10-05", timezone: "UTC", range, snapshot: {
      dailyPlans: [{ id: "p", localDate: "2026-10-09" }],
      dailyPlanItems: [{ id: "c", dailyPlanId: "p", taskId: "missing", state: "committed" }],
      taskOccurrences: [{ id: "o", taskId: "missing", localDate: "2026-10-09", state: "pending" }],
    } });
    expect(board.days[4].cards).toMatchObject([{ taskId: "missing", missingTask: true }]);
    expect(board.days[4].cards[0].sources.map(source => source.id)).toEqual(["c", "o"]);
  });

  it("restores a saved selected day only inside the loaded snapshot", () => {
    expect(restorePlanDate("2026-10-20", "2026-10-13", range)).toBe("2026-10-20");
    expect(restorePlanDate("2026-11-20", "2026-10-13", range)).toBe("2026-10-13");
    expect(restorePlanDate("not-a-date", "2026-10-13", range)).toBe("2026-10-13");
    expect(restorePlanDate(null, "2026-10-13", range)).toBe("2026-10-13");
  });

  it("marks partial weeks unavailable, including old selected anchors", () => {
    expect(completePlanningWeek("2026-09-28", range)).toBe(false);
    expect(completePlanningWeek("2026-10-05", range)).toBe(true);
    const board = projectPlanWeek({ weekStart: "2026-09-28", timezone: "UTC", range, snapshot: {} });
    expect(board.complete).toBe(false);
    expect(board.days[0].covered).toBe(false);
  });
});
