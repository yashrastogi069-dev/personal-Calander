import { describe, expect, it } from "vitest";
import { rowPills, urgencyPill, type RowPillContext, type RowPillTask } from "@shared/taskRowPills";

// 2026-10-15 is a Thursday (the prototype's fixed today). Auckland is UTC+13 in October.
const today = "2026-10-15";

function task(overrides: Partial<RowPillTask> = {}): RowPillTask {
  return { id: "t1", state: "not_started", horizon: "weekly", dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, recurrenceRule: null, ...overrides };
}

const projects = new Map([["p1", { id: "p1", name: "Launch portfolio", color: "#7c3aed", categoryId: "c1" }]]);
const categories = new Map([["c1", { id: "c1", name: "Personal", color: "#16a34a" }], ["c2", { id: "c2", name: "Health", color: null }]]);
const ctx = (overrides: Partial<RowPillContext> = {}): RowPillContext => ({ timezone: "Pacific/Auckland", projects, categories, ...overrides });
const labels = (pills: ReturnType<typeof rowPills>) => pills.map(pill => pill.label);

describe("urgency pill (Q6 pill 1)", () => {
  it("says Overdue Nd for a missed deadline or a slipped plan", () => {
    expect(urgencyPill(task({ dueLocalDate: "2026-10-13" }), today, ctx())?.label).toBe("Overdue 2d");
    expect(urgencyPill(task({ scheduledLocalDate: "2026-10-11" }), today, ctx())?.label).toBe("Overdue 4d");
    expect(urgencyPill(task({ dueLocalDate: "2026-10-14", scheduledLocalDate: "2026-10-10" }), today, ctx())?.label).toBe("Overdue 5d");
  });

  it("flags a deadline with no plan day, shortened on the Week board (Fable Q5)", () => {
    expect(urgencyPill(task({ dueLocalDate: "2026-10-17" }), today, ctx())).toEqual({ kind: "urgency", tone: "risk", icon: "flag", label: "Due Sat · not planned" });
    expect(urgencyPill(task({ dueLocalDate: "2026-10-17" }), today, ctx({ variant: "board" }))?.label).toBe("Due Sat");
    expect(urgencyPill(task({ dueLocalDate: today }), today, ctx())?.label).toBe("Due today · not planned");
    expect(urgencyPill(task({ dueLocalDate: "2026-11-02" }), today, ctx())?.label).toBe("Due 2 Nov · not planned");
  });

  it("flags a planned task due within 3 days", () => {
    expect(urgencyPill(task({ scheduledLocalDate: "2026-10-16", dueLocalDate: "2026-10-17" }), today, ctx())?.label).toBe("Due Sat");
    expect(urgencyPill(task({ scheduledLocalDate: today, dueLocalDate: today }), today, ctx())?.label).toBe("Due today");
  });

  it("shows Plan Thu on List rows but hides it on the Week board", () => {
    expect(urgencyPill(task({ scheduledLocalDate: "2026-10-16" }), today, ctx())).toEqual({ kind: "urgency", tone: "plan", icon: "calendar", label: "Plan Fri" });
    expect(urgencyPill(task({ scheduledLocalDate: "2026-10-16" }), today, ctx({ variant: "board" }))).toBeNull();
    expect(urgencyPill(task({ scheduledLocalDate: "2026-10-16" }), today, ctx({ variant: "board", boardLens: "status" }))?.label).toBe("Plan Fri");
  });

  it("says Today only where no header already does", () => {
    expect(urgencyPill(task({ scheduledLocalDate: today }), today, ctx())).toBeNull();
    expect(urgencyPill(task({ scheduledLocalDate: today }), today, ctx({ groupBy: "project" }))?.label).toBe("Today");
    expect(urgencyPill(task({ scheduledLocalDate: today }), today, ctx({ variant: "board", boardLens: "status" }))?.label).toBe("Today");
    expect(urgencyPill(task({ scheduledLocalDate: today }), today, ctx({ variant: "board" }))).toBeNull();
  });

  it("shows This week for a week-flagged task and nothing for done, someday or undated work", () => {
    expect(urgencyPill(task({ plannedWeekStartLocalDate: "2026-10-12" }), today, ctx())?.label).toBe("This week");
    expect(urgencyPill(task({ state: "completed", dueLocalDate: "2026-10-01" }), today, ctx())).toBeNull();
    expect(urgencyPill(task({ horizon: "someday", dueLocalDate: "2026-10-01" }), today, ctx())).toBeNull();
    expect(urgencyPill(task(), today, ctx())).toBeNull();
  });

  it("never treats a recurring series' anchor as overdue or as a deadline", () => {
    const series = task({ recurrenceRule: { frequency: "daily" }, dueLocalDate: "2026-09-20" });
    expect(urgencyPill(series, today, ctx())).toBeNull();
  });
});

describe("rowPills (Q6: at most 2, by priority)", () => {
  it("adds the project, else the category dot (a project's category colours it)", () => {
    expect(rowPills(task({ dueLocalDate: "2026-10-17", projectId: "p1" }), today, ctx())).toEqual([
      { kind: "urgency", tone: "risk", icon: "flag", label: "Due Sat · not planned" },
      { kind: "project", recordId: "p1", label: "Launch portfolio", color: "#7c3aed" },
    ]);
    expect(rowPills(task({ categoryId: "c2" }), today, ctx())).toEqual([{ kind: "category", recordId: "c2", label: "Health", color: null }]);
  });

  it("drops the project or category pill when the List is grouped by it", () => {
    expect(labels(rowPills(task({ projectId: "p1" }), today, ctx({ groupBy: "project" })))).toEqual([]);
    expect(labels(rowPills(task({ categoryId: "c2" }), today, ctx({ groupBy: "category" })))).toEqual([]);
  });

  it("lets the Waiting chip replace the second pill", () => {
    const tasks = [{ id: "t1", state: "not_started" }, { id: "pre", state: "not_started", title: "Sam's reference" }];
    const dependencies = [{ taskId: "t1", dependsOnTaskId: "pre", dependencyType: "hard" as const }];
    const pills = rowPills(task({ dueLocalDate: "2026-10-13", projectId: "p1" }), today, ctx({ dependencies, tasks }));
    expect(labels(pills)).toEqual(["Overdue 2d", "Waiting · Sam's reference"]);
    expect(labels(rowPills(task({ projectId: "p1", state: "blocked" }), today, ctx()))).toEqual(["Launch portfolio", "Waiting"]);
    expect(labels(rowPills(task({ projectId: "p1" }), today, ctx({ waitingOn: "Legal" })))).toEqual(["Launch portfolio", "Waiting · Legal"]);
    expect(rowPills(task({ dueLocalDate: "2026-10-13", projectId: "p1" }), today, ctx({ waitingOn: "Legal" }))).toHaveLength(2);
  });
});
