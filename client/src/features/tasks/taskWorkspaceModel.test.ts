import { describe, expect, it } from "vitest";
import {
  adaptSavedTaskView,
  clearedTaskFilters,
  emptyTaskFacets,
  findSavedTaskViewByName,
  hasActiveTaskFilters,
  inboxTasks,
  orderSavedTaskViews,
  quickFilterCounts,
  savedTaskViewConfiguration,
  savedTaskViewCount,
  savedTaskViewDiffers,
  savedTaskViewSummary,
  searchWithTaskBoardLensAndFacets,
  taskBoardLensAndFacetsFromSearch,
  taskHeaderSummary,
  taskHeaderSummaryText,
  taskListSections,
  taskRowsForWorkspace,
  type TaskWorkspaceFilterState,
  type WorkspaceTask,
} from "./taskWorkspaceModel";

// 2026-10-14 is a Wednesday; Auckland is UTC+13 in October.
const ctx = { today: "2026-10-14", timezone: "Pacific/Auckland" };

function task(overrides: Partial<WorkspaceTask> & { id: string }): WorkspaceTask {
  return { title: overrides.id, state: "not_started", priority: "medium", horizon: "weekly", sortOrder: 0, dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, ...overrides };
}

const tasks: WorkspaceTask[] = [
  task({ id: "overdue", title: "Update IRD tax code", dueLocalDate: "2026-10-13", categoryId: "personal", priority: "high", estimateMinutes: 20 }),
  task({ id: "slipped", title: "Submit expense claim", scheduledLocalDate: "2026-10-11", categoryId: "personal", estimateMinutes: 15 }),
  task({ id: "today", title: "Deep work: competitor analysis", description: "Fonterra brand portfolio", scheduledLocalDate: "2026-10-14", projectId: "p1", categoryId: "work", priority: "critical", estimateMinutes: 60 }),
  task({ id: "repeat", title: "LinkedIn engagement", recurrenceRule: { frequency: "daily" }, scheduledLocalDate: "2026-09-24", categoryId: "work", estimateMinutes: 15 }),
  task({ id: "soon", title: "Submit Fonterra application", dueLocalDate: "2026-10-15", scheduledLocalDate: "2026-10-15", projectId: "p1", priority: "critical", estimateMinutes: 45 }),
  task({ id: "later", title: "Plan the summer trip", scheduledLocalDate: "2026-11-20" }),
  task({ id: "inbox", title: "Ask Sam for a referral" }),
  task({ id: "someday", title: "Idea: short video series", horizon: "someday" }),
  task({ id: "done-today", title: "Book physio", state: "completed", scheduledLocalDate: "2026-10-14", completedAt: "2026-10-13T21:00:00.000Z", estimateMinutes: 10 }),
  task({ id: "done-old", title: "Old win", state: "completed", completedAt: "2026-10-01T21:00:00.000Z" }),
  task({ id: "archived", title: "Archived thing", state: "archived" }),
];

function state(overrides: Partial<TaskWorkspaceFilterState> = {}): TaskWorkspaceFilterState {
  return { view: "list", query: "", filter: "all", sort: "manual", ...emptyTaskFacets, ...overrides };
}

const ids = (rows: readonly { id: string }[]) => rows.map(row => row.id);

describe("Inbox v2", () => {
  it("holds undecided work only: any date (a deadline too), a project or Someday takes it out (Q1/Q2)", () => {
    expect(ids(inboxTasks(tasks))).toEqual(["inbox"]);
  });
});

describe("taskRowsForWorkspace", () => {
  it("searches title and description, case-insensitively", () => {
    expect(ids(taskRowsForWorkspace(tasks, state({ query: "FONTERRA" }), ctx))).toEqual(["today", "soon"]);
  });

  it("applies quick filters, including a recurring occurrence today in Today", () => {
    expect(ids(taskRowsForWorkspace(tasks, state({ filter: "today" }), ctx))).toEqual(["done-today", "today", "repeat"]);
    expect(taskRowsForWorkspace(tasks, state({ filter: "open" }), ctx)).toHaveLength(8);
    expect(ids(taskRowsForWorkspace(tasks, state({ filter: "deadline_risk" }), ctx))).toEqual(["overdue"]);
  });

  it("applies category, project and priority facets together", () => {
    expect(ids(taskRowsForWorkspace(tasks, state({ categoryIds: ["work"] }), ctx))).toEqual(["today", "repeat"]);
    expect(ids(taskRowsForWorkspace(tasks, state({ projectIds: ["p1"], priorities: ["critical"] }), ctx))).toEqual(["today", "soon"]);
    expect(ids(taskRowsForWorkspace(tasks, state({ priorities: ["medium"], categoryIds: ["personal"] }), ctx))).toEqual(["slipped"]);
  });

  it("does not apply quick filters or facets to Inbox and Archive", () => {
    expect(ids(taskRowsForWorkspace(tasks, state({ view: "inbox", filter: "today", categoryIds: ["work"] }), ctx))).toEqual(["inbox"]);
    expect(ids(taskRowsForWorkspace(tasks, state({ view: "archive", filter: "open" }), ctx))).toEqual(["archived"]);
  });

  it("sorts by priority, deadline, plan date and newest", () => {
    expect(ids(taskRowsForWorkspace(tasks, state({ sort: "priority", filter: "open" }), ctx)).slice(0, 3)).toEqual(["today", "soon", "overdue"]);
    expect(ids(taskRowsForWorkspace(tasks, state({ sort: "due", filter: "open" }), ctx)).slice(0, 2)).toEqual(["overdue", "soon"]);
    expect(ids(taskRowsForWorkspace(tasks, state({ sort: "scheduled", filter: "open" }), ctx)).slice(0, 2)).toEqual(["repeat", "slipped"]);
  });
});

describe("counts and summary", () => {
  it("counts each quick-filter chip with search and facets applied", () => {
    expect(quickFilterCounts(tasks, { query: "", ...emptyTaskFacets }, ctx)).toEqual({ all: 10, open: 8, today: 3, deadline_risk: 1 });
    expect(quickFilterCounts(tasks, { query: "", ...emptyTaskFacets, categoryIds: ["work"] }, ctx)).toEqual({ all: 2, open: 2, today: 2, deadline_risk: 0 });
  });

  it("summarises the header from real data", () => {
    const summary = taskHeaderSummary(tasks, ctx);
    expect(summary).toEqual({ open: 8, overdue: 1, forToday: 2, inbox: 1 });
    expect(taskHeaderSummaryText(summary)).toBe("8 open · 1 overdue · 2 for today");
    expect(taskHeaderSummaryText({ open: 3, overdue: 0, forToday: 0, inbox: 0 })).toBe("3 open");
  });

  it("knows when any filter is active and clears all but the sort", () => {
    expect(hasActiveTaskFilters(state())).toBe(false);
    expect(hasActiveTaskFilters(state({ priorities: ["high"] }))).toBe(true);
    expect(clearedTaskFilters()).toEqual({ query: "", filter: "all", categoryIds: [], projectIds: [], priorities: [] });
  });
});

describe("taskListSections", () => {
  it("groups by When with Done last, keeping today's completions in Today", () => {
    const rows = taskRowsForWorkspace(tasks, state(), ctx);
    const sections = taskListSections(rows, tasks, ctx);
    expect(sections.map(section => [section.id, ids(section.tasks)])).toEqual([
      ["past_due", ["slipped", "overdue"]],
      ["today", ["done-today", "today", "repeat"]],
      ["next_7_days", ["soon"]],
      ["later", ["later"]],
      ["no_date", ["inbox", "someday"]],
      ["done", ["done-old"]],
    ]);
    const byId = Object.fromEntries(sections.map(section => [section.id, section]));
    expect(byId.past_due).toMatchObject({ label: "Past due", count: 2, overdueCount: 1 });
    // Planned minutes come from dailyCapacityForecast: open tasks planned or due today (60m).
    expect(byId.today).toMatchObject({ count: 2, plannedMinutes: 60, doneTodayCount: 1 });
    expect(byId.no_date).toMatchObject({ count: 2, somedayCount: 1 });
    expect(byId.done).toMatchObject({ label: "Done", count: 1 });
  });

  it("omits empty sections", () => {
    expect(taskListSections([tasks[6]], tasks, ctx).map(section => section.id)).toEqual(["no_date"]);
  });
});

describe("saved views v2", () => {
  it("reads v1 configurations with defaults, including the legacy risk filter", () => {
    expect(adaptSavedTaskView({ filter: "risk", sort: "due", query: "lease" })).toEqual({
      version: 2, view: "list", lens: "status", group: "when", query: "lease", filter: "deadline_risk", sort: "due", categoryIds: [], projectIds: [], priorities: [],
    });
    expect(adaptSavedTaskView(null)).toMatchObject({ filter: "all", sort: "manual", view: "list", lens: "status" });
    expect(adaptSavedTaskView({ filter: "nonsense", sort: "random" })).toMatchObject({ filter: "all", sort: "manual" });
  });

  it("reads v2 configurations and drops invalid facet values", () => {
    expect(adaptSavedTaskView({ version: 2, view: "board", lens: "when", categoryIds: ["work", "work", 3], priorities: ["high", "urgent"] })).toMatchObject({
      view: "board", lens: "when", categoryIds: ["work"], priorities: ["high"],
    });
  });

  it("writes a trimmed v2 configuration", () => {
    expect(savedTaskViewConfiguration({ view: "board", lens: "when", query: "  cv ", filter: "open", sort: "priority", categoryIds: ["work"], projectIds: [], priorities: ["high"] }))
      .toEqual({ version: 2, view: "board", lens: "when", group: "when", query: "cv", filter: "open", sort: "priority", categoryIds: ["work"], projectIds: [], priorities: ["high"] });
  });

  it("offers Save view only when the state differs from the applied view", () => {
    const current = { view: "board" as const, lens: "when" as const, query: "", filter: "open" as const, sort: "manual" as const, categoryIds: ["a", "b"], projectIds: [], priorities: [] };
    expect(savedTaskViewDiffers(current, { version: 2, view: "board", lens: "when", filter: "open", categoryIds: ["b", "a"] })).toBe(false);
    expect(savedTaskViewDiffers(current, { version: 2, view: "board", lens: "status", filter: "open", categoryIds: ["a", "b"] })).toBe(true);
    expect(savedTaskViewDiffers({ ...current, view: "list", lens: "status", filter: "all", categoryIds: [] }, null)).toBe(false);
    expect(savedTaskViewDiffers(current, null)).toBe(true);
  });

  it("reuses a view by name and orders pinned views first", () => {
    const views = [
      { id: "1", name: "Work focus", viewType: "tasks", isPinned: 0 },
      { id: "2", name: "Admin", viewType: "tasks", isPinned: 1 },
      { id: "3", name: "Calendar thing", viewType: "calendar", isPinned: 1 },
    ];
    expect(findSavedTaskViewByName(views, "  work FOCUS ")?.id).toBe("1");
    expect(findSavedTaskViewByName(views, "Calendar thing")).toBeNull();
    expect(findSavedTaskViewByName(views, " ")).toBeNull();
    expect(orderSavedTaskViews(views).map(view => view.id)).toEqual(["2", "1"]);
  });

  it("summarises a tile and counts its live rows", () => {
    expect(savedTaskViewSummary(
      { view: "board", lens: "when", categoryIds: ["work", "deleted"], priorities: ["high"], sort: "due", filter: "deadline_risk" },
      { categories: new Map([["work", "Work"]]) },
    )).toEqual(["Board", "When", "At risk", "Work", "High", "By deadline"]);
    expect(savedTaskViewSummary({ filter: "open" })).toEqual(["List", "Open"]);
    expect(savedTaskViewCount(tasks, { categoryIds: ["work"] }, ctx)).toBe(2);
  });
});

describe("URL lens and facets", () => {
  it("round-trips the lens and facets and keeps other params", () => {
    const search = searchWithTaskBoardLensAndFacets("view=board&taskQ=cv", { lens: "when", categoryIds: ["work", "health"], projectIds: [], priorities: ["high"] });
    expect(search).toBe("view=board&taskQ=cv&taskLens=when&taskCat=work%2Chealth&taskPriority=high");
    expect(taskBoardLensAndFacetsFromSearch(search)).toEqual({ lens: "when", categoryIds: ["work", "health"], projectIds: [], priorities: ["high"] });
    expect(taskBoardLensAndFacetsFromSearch("taskPriority=urgent,low")).toEqual({ lens: "status", categoryIds: [], projectIds: [], priorities: ["low"] });
    expect(searchWithTaskBoardLensAndFacets(search, { lens: "status", ...emptyTaskFacets })).toBe("view=board&taskQ=cv");
  });
});
