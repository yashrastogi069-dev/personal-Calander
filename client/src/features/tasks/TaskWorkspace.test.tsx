import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CanonicalTask } from "@shared/canonicalTask";
import { createTaskCardContext, taskCardModel } from "./taskCardModel";
import { inboxTasks, TaskWorkspace, TaskWorkspaceLoading, taskCheckDispatch, type TaskWorkspaceProps } from "./TaskWorkspace";

// 2026-10-14 is a Wednesday.
const today = "2026-10-14";
const timezone = "Pacific/Auckland";

function task(overrides: Partial<CanonicalTask>): CanonicalTask {
  return {
    id: "t1", workspaceId: "w1", title: "Task", state: "not_started", priority: "medium", horizon: "weekly",
    dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, estimateMinutes: null, sortOrder: 0,
    categoryId: null, projectId: null, goalId: null, parentTaskId: null, recurrenceRule: null, completedAt: null, version: 1,
    ...overrides,
  };
}

const normal = task({ id: "normal", title: "Pay rent", scheduledLocalDate: today });
const recurring = task({ id: "daily", title: "LinkedIn engagement", scheduledLocalDate: "2026-09-24", recurrenceRule: { frequency: "daily", interval: 1 }, recurrenceAnchor: "scheduled" });
const waiting = task({ id: "waiting", title: "Send the application", dueLocalDate: "2026-10-16" });
const prerequisite = task({ id: "prereq", title: "Write the cover letter" });
const someday = task({ id: "someday", title: "Look into certification", horizon: "someday" });
const occurrences = [{ id: "occ-today", taskId: "daily", localDate: today, state: "pending", version: 3 }];
const dependencies = [{ taskId: "waiting", dependsOnTaskId: "prereq", dependencyType: "hard" as const }];
const allTasks = [normal, recurring, waiting, prerequisite, someday];

function ctx() {
  return createTaskCardContext({ today, timezone, tasks: allTasks, categories: [], projects: [], goals: [], dependencies, occurrences });
}

function props(overrides: Partial<TaskWorkspaceProps> = {}): TaskWorkspaceProps {
  const noop = () => undefined;
  const write = async () => ({ record: {}, queued: false });
  return {
    view: "list", tasks: allTasks, categories: [], projects: [], goals: [], savedViews: [], dependencies, occurrences,
    today, timezone, query: "", filter: "all", sort: "manual",
    onViewChange: noop, onViewStateChange: noop, onSelectedRecordChange: noop, onCapture: noop,
    onUpdate: write, onCreateSubtask: write, onReorder: async () => null,
    ...overrides,
  } as TaskWorkspaceProps;
}

describe("TaskWorkspace check dispatch", () => {
  it("completes a normal task with a task update", () => {
    expect(taskCheckDispatch(taskCardModel(normal, ctx()))).toEqual({ kind: "complete" });
  });

  it("resolves today's occurrence for a recurring task instead of updating the series", () => {
    expect(taskCheckDispatch(taskCardModel(recurring, ctx()))).toEqual({ kind: "resolve_occurrence", occurrence: { id: "occ-today", expectedVersion: 3 } });
  });

  it("refuses a guarded check with its reason and no write", () => {
    const dispatch = taskCheckDispatch(taskCardModel(waiting, ctx()));
    expect(dispatch).toMatchObject({ kind: "refuse", action: "open_detail" });
    expect(dispatch.kind === "refuse" && dispatch.reason).toContain("Waiting on 1 task");
  });

  it("refuses a recurring task with no open occurrence today", () => {
    const withoutToday = createTaskCardContext({ today, timezone, tasks: allTasks, categories: [], projects: [], goals: [], occurrences: [] });
    expect(taskCheckDispatch(taskCardModel(recurring, withoutToday)).kind).toBe("refuse");
  });

  it("reopens completed work", () => {
    expect(taskCheckDispatch(taskCardModel(task({ id: "done", state: "completed", completedAt: "2026-10-13T02:00:00Z" }), ctx()))).toEqual({ kind: "reopen" });
  });

  it("refuses a task committed in an open plan (R3)", () => {
    const committed = createTaskCardContext({ today, timezone, tasks: allTasks, categories: [], projects: [], goals: [], committedTasks: new Map([["normal", today]]) });
    expect(taskCheckDispatch(taskCardModel(normal, committed))).toMatchObject({ kind: "refuse", action: "open_plan" });
  });
});

describe("TaskWorkspace container", () => {
  it("uses the shared Inbox rule, so Someday and deadline-only work leave the Inbox", () => {
    expect(inboxTasks(allTasks).map(item => item.id)).toEqual(["prereq"]);
  });

  it("renders the calm List: header, toolbar with Group by and When groups, never the anchor date on a recurring row", () => {
    const html = renderToStaticMarkup(<TaskWorkspace {...props()} />);
    expect(html).toContain("tk-header");
    expect(html).toContain("tk-toolbar");
    expect(html).toContain('aria-label="Group by"');
    expect(html).toContain('data-group-by="when"');
    expect(html).toContain('data-section="today"');
    expect(html).toContain('data-section="someday"');
    expect(html).toContain('data-task-record-id="daily"');
    expect(html).toContain("tk-row is-calm");
    expect(html).not.toContain("Plan for 24 Sep");
    expect(html).not.toContain("2026-09-24");
    expect(html).not.toContain("task-workspace-tabs");
  });

  it("leaves undecided Inbox work out of the List", () => {
    const html = renderToStaticMarkup(<TaskWorkspace {...props()} />);
    expect(html).not.toContain('data-task-record-id="prereq"');
  });

  it("draws at most the smart pills on a row: urgency first, then the Waiting chip", () => {
    const html = renderToStaticMarkup(<TaskWorkspace {...props()} />);
    const row = html.slice(html.indexOf('data-task-record-id="waiting"'));
    expect(row).toContain("Due Fri · not planned");
    expect(row).toContain("Waiting · Write the cover letter");
  });

  it("keeps work finished earlier today in a collapsed Done today group", () => {
    const doneToday = task({ id: "done-today", title: "Posted the parcel", state: "completed", completedAt: "2026-10-13T22:00:00.000Z", estimateMinutes: 20 });
    const html = renderToStaticMarkup(<TaskWorkspace {...props({ tasks: [...allTasks, doneToday] })} />);
    const group = html.slice(html.lastIndexOf("<section", html.indexOf('data-section="done_today"')));
    expect(group).toContain("Done today");
    expect(group).toContain('aria-expanded="false"');
    expect(group).toContain("20m done");
  });

  it("shows the first-run state when there are no tasks", () => {
    const html = renderToStaticMarkup(<TaskWorkspace {...props({ tasks: [] })} />);
    expect(html).toContain("Your tasks start with one captured thought");
  });

  it("shows the filtered-empty state with Clear filters when a search matches nothing", () => {
    const html = renderToStaticMarkup(<TaskWorkspace {...props({ query: "zzz", filter: "today" })} />);
    expect(html).toContain("No task matches");
    expect(html).toContain("in Today");
    expect(html).toContain("Clear filters");
  });

  it("keeps the status Board but swaps the Move to dropdown for a menu, with no Archive N completed button", () => {
    const board = renderToStaticMarkup(<TaskWorkspace {...props({ view: "board" })} />);
    expect(board).toContain("task-lane-grid");
    expect(board).not.toContain("<select");
    expect(board).not.toContain("task-archive-completed");
    expect(board).toContain('aria-label="Move Pay rent to another lane"');
  });

  it("shows only undecided work in the Inbox, as triage cards with every decision", () => {
    const inbox = renderToStaticMarkup(<TaskWorkspace {...props({ view: "inbox" })} />);
    expect(inbox).toContain("tk-inbox");
    expect(inbox).toContain("to sort");
    expect(inbox).toContain("Write the cover letter");
    expect(inbox).not.toContain("Look into certification");
    expect(inbox).not.toContain('data-task-record-id="waiting"');
    for (const action of ["Today", "This week", "Pick date", "Project", "Someday"]) expect(inbox).toContain(action);
    expect(inbox).toContain('aria-label="Delete Write the cover letter"');
  });

  it("puts the D4 reason on the triage card", () => {
    const inbox = renderToStaticMarkup(<TaskWorkspace {...props({ view: "inbox" })} />);
    expect(inbox).toContain('data-why="unblocks"');
    expect(inbox).toContain("Unblocks 1 task");
  });

  it("opens the Archive on Completed, with the Archived switch and a search", () => {
    const html = renderToStaticMarkup(<TaskWorkspace {...props({ view: "archive", tasks: [...allTasks, task({ id: "old", title: "Filed the tax return", state: "completed", completedAt: "2026-10-06T01:00:00.000Z", estimateMinutes: 45 })] })} />);
    expect(html).toContain("tk-arch");
    expect(html).toContain("Completed");
    expect(html).toContain("Archived");
    expect(html).toContain("Search the archive");
    expect(html).toContain("Filed the tax return");
    expect(html).toContain("Last week");
  });

  it("no longer renders the Views tab or the saved views panel", () => {
    const html = renderToStaticMarkup(<TaskWorkspace {...props()} />);
    expect(html).not.toContain("task-saved-views");
    expect(html).not.toContain(">Views<");
  });

  it("renders skeleton shapes while the snapshot loads", () => {
    const html = renderToStaticMarkup(<TaskWorkspaceLoading />);
    expect(html).toContain("tk-skeleton");
    expect(html).toContain("Loading tasks");
  });
});
