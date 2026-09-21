import { describe, expect, it } from "vitest";
import {
  adaptSavedTaskView,
  inboxTasks,
  resetTaskWorkspaceState,
  runTaskReorder,
  TASK_REORDER_GUIDANCE,
  taskRowsForWorkspace,
  taskUndoPatch,
  tasksForWorkspaceView,
} from "../client/src/features/tasks/TaskWorkspace";
import {
  captureInterpretationHandoff,
  capturePersistenceMessage,
  captureTaskPatch,
  interpretationChips,
  nextCaptureKindForKey,
} from "../client/src/features/tasks/CaptureSheet";
import {
  searchEntityForLocation,
  searchOpenLocation,
  searchRecordDetailState,
} from "../client/src/features/search/WorkspaceSearchWorkspace";
import { parsePlannerLocation, writePlannerLocation } from "../client/src/lib/plannerLocation";
import { captureDraftAfterThoughtChange } from "../client/src/features/capture/NaturalLanguageCaptureWorkspace";
import {
  recurrenceRuleFromDraft,
  runDependencyAction,
} from "../client/src/features/tasks/TaskDetailSheet";
import { fallbackTaskPrimaryAction } from "../client/src/features/tasks/CanonicalTaskRow";
import { INBOX_TRIAGE_GUIDANCE } from "../client/src/features/tasks/InboxTriage";

const tasks = [
  { id: "inbox", title: "Clarify this", state: "not_started", scheduledLocalDate: null, dueLocalDate: null, plannedStartAt: null, plannedEndAt: null },
  { id: "planned", title: "Already planned", state: "not_started", scheduledLocalDate: "2026-09-21", dueLocalDate: null, plannedStartAt: null, plannedEndAt: null },
  { id: "reserved", title: "Reserved", state: "in_progress", scheduledLocalDate: null, dueLocalDate: null, plannedStartAt: "2026-09-21T09:00:00.000Z", plannedEndAt: "2026-09-21T10:00:00.000Z" },
  { id: "archived", title: "Archived", state: "archived", scheduledLocalDate: null, dueLocalDate: null, plannedStartAt: null, plannedEndAt: null },
];

describe("Phase 4 canonical task workspace", () => {
  it("treats Inbox as a filter over the original active task records", () => {
    const result = inboxTasks(tasks);

    expect(result).toEqual([tasks[0]]);
    expect(result[0]).toBe(tasks[0]);
    expect(tasksForWorkspaceView(tasks, "inbox")).toEqual([tasks[0]]);
    expect(tasksForWorkspaceView(tasks, "list")).toEqual(tasks.slice(0, 3));
    expect(tasksForWorkspaceView(tasks, "archive")).toEqual([tasks[3]]);
  });

  it("builds a title-only Inbox capture unless Plan for today is explicit", () => {
    expect(captureTaskPatch("  Buy oat milk  ", false, "2026-09-21")).toEqual({
      title: "Buy oat milk",
      scheduledLocalDate: null,
    });
    expect(captureTaskPatch("Buy oat milk", true, "2026-09-21")).toEqual({
      title: "Buy oat milk",
      scheduledLocalDate: "2026-09-21",
    });
  });

  it("labels interpreted date meanings separately before save", () => {
    expect(interpretationChips({
      dueLocalDate: "2026-09-25",
      scheduledLocalDate: "2026-09-23",
      reserveTime: "14:30",
      estimateMinutes: 45,
      recurrenceRule: { frequency: "weekly", interval: 1 },
      notes: ["Ambiguous weekday; review the selected date."],
    })).toEqual([
      { kind: "deadline", label: "Deadline", value: "2026-09-25" },
      { kind: "plan_for", label: "Plan for", value: "2026-09-23" },
      { kind: "reserved_time", label: "Reserved time", value: "14:30" },
      { kind: "estimate", label: "Estimate", value: "45 min" },
      { kind: "recurrence", label: "Recurrence", value: "Weekly" },
      { kind: "ambiguity", label: "Needs review", value: "Ambiguous weekday; review the selected date." },
    ]);
  });

  it("undoes completion and archive with supported inverse task patches", () => {
    expect(taskUndoPatch({ state: "not_started" }, "complete")).toEqual({ state: "not_started" });
    expect(taskUndoPatch({ state: "not_started" }, "archive")).toEqual({ state: "not_started" });
  });

  it("does not offer undo when reopening or archiving would require inventing completion evidence", () => {
    expect(taskUndoPatch({ state: "completed", completedAt: "2026-09-20T08:00:00.000Z" }, "reopen")).toBeNull();
    expect(taskUndoPatch({ state: "completed", completedAt: "2026-09-20T08:00:00.000Z" }, "archive")).toBeNull();
  });

  it("preserves a multi-weekday recurrence rule during an unrelated detail edit", () => {
    const original = { frequency: "weekly", interval: 2, weekdays: [1, 3, 5], weekStartsOn: 1 };

    expect(recurrenceRuleFromDraft(original, {
      recurrenceFrequency: "weekly",
      recurrenceInterval: "2",
      recurrenceWeekdays: [1, 3, 5],
    })).toEqual(original);
  });

  it("adapts established saved task filters and sorts deterministically", () => {
    expect(adaptSavedTaskView({ filter: "risk", sort: "due", query: "lease" })).toEqual({
      filter: "deadline_risk",
      sort: "due",
      query: "lease",
    });
    expect(adaptSavedTaskView({ filter: "open", sort: "priority" })).toEqual({
      filter: "open",
      sort: "priority",
      query: "",
    });

    const rows = taskRowsForWorkspace([
      { id: "later", title: "Later", state: "not_started", priority: "low", sortOrder: 20, dueLocalDate: "2026-10-02" },
      { id: "critical", title: "Critical", state: "not_started", priority: "critical", sortOrder: 30, dueLocalDate: null },
      { id: "first", title: "First", state: "not_started", priority: "medium", sortOrder: 10, dueLocalDate: "2026-09-28" },
      { id: "done", title: "Done", state: "completed", priority: "critical", sortOrder: 0, dueLocalDate: "2026-09-21" },
    ] as any, { view: "list", query: "", filter: "open", sort: "priority", today: "2026-09-21" });

    expect(rows.map(task => task.id)).toEqual(["critical", "first", "later"]);
  });

  it("keeps hidden filters from concealing Inbox and archive records and resets atomically", () => {
    const inbox = taskRowsForWorkspace(tasks as any, {
      view: "inbox",
      query: "",
      filter: "deadline_risk",
      sort: "manual",
      today: "2026-09-21",
    });
    const archive = taskRowsForWorkspace(tasks as any, {
      view: "archive",
      query: "",
      filter: "today",
      sort: "manual",
      today: "2026-09-21",
    });

    expect(inbox.map(task => task.id)).toEqual(["inbox"]);
    expect(archive.map(task => task.id)).toEqual(["archived"]);
    expect(resetTaskWorkspaceState()).toEqual({ query: "", filter: "all" });
  });

  it("opens the exact search record while retaining the query and filters", () => {
    expect(searchOpenLocation(
      { entity: "task", id: "task-42" },
      { query: "lease", taskQuery: "urgent", taskFilter: "deadline_risk", taskSort: "due" },
    )).toEqual({
      destination: "tasks",
      view: "list",
      selectedRecord: "task-42",
      query: "lease",
      taskQuery: "urgent",
      taskFilter: "deadline_risk",
      taskSort: "due",
    });
  });

  it.each([
    ["task", "tasks", "list"],
    ["goal", "intentions", "outcomes"],
    ["project", "intentions", "projects"],
    ["habit", "habits", "due"],
    ["review", "review", "rituals"],
  ] as const)("opens an exact %s record in its owning destination", (entity, destination, view) => {
    const location = searchOpenLocation(
      { entity, id: `${entity}-42` },
      { query: "lease", taskQuery: "urgent", taskFilter: "open", taskSort: "priority" },
    );

    expect(location).toMatchObject({ destination, view, selectedRecord: `${entity}-42`, query: "lease" });
    expect(searchEntityForLocation(location)).toBe(entity);
  });

  it("resolves archived projects and out-of-range reviews from the scoped Search record response", () => {
    expect(searchRecordDetailState(
      { entity: "project", id: "project-archived" },
      { data: { id: "project-archived", title: "Archived launch", state: "archived", version: 8 }, isLoading: false, error: null },
    )).toEqual({
      status: "ready",
      record: { id: "project-archived", title: "Archived launch", state: "archived", version: 8 },
    });
    expect(searchRecordDetailState(
      { entity: "review", id: "review-2024" },
      { data: { id: "review-2024", kind: "annual", state: "completed", periodStartLocalDate: "2024-01-01", periodEndLocalDate: "2024-12-31" }, isLoading: false, error: null },
    )).toEqual({
      status: "ready",
      record: expect.objectContaining({ id: "review-2024", title: "Annual review · 2024-01-01 to 2024-12-31" }),
    });
  });

  it("shows explicit loading, unavailable, and error states for exact Search records", () => {
    const target = { entity: "project", id: "missing-project" } as const;
    expect(searchRecordDetailState(target, { data: undefined, isLoading: true, error: null })).toEqual({ status: "loading" });
    expect(searchRecordDetailState(target, { data: null, isLoading: false, error: null })).toEqual({ status: "unavailable" });
    expect(searchRecordDetailState(target, { data: undefined, isLoading: false, error: new Error("Read failed") })).toEqual({ status: "error", message: "Read failed" });
  });

  it("carries the current Capture thought into interpretation and reports queued persistence", () => {
    expect(captureInterpretationHandoff("  Pay the lease Friday  ")).toBe("  Pay the lease Friday  ");
    expect(capturePersistenceMessage({ queued: true })).toBe("Saved on this device · waiting to sync.");
    expect(capturePersistenceMessage({ queued: false })).toBe("Saved.");
  });

  it("invalidates stale interpretation when a same-mounted Capture receives a new handoff", () => {
    const staleDraft = { title: "Old parsed title", notes: [] } as any;

    expect(captureDraftAfterThoughtChange("Old thought", "New thought", staleDraft)).toBeNull();
    expect(captureDraftAfterThoughtChange("New thought", "New thought", staleDraft)).toBe(staleDraft);
  });

  it("blocks the actual manual reorder action under derived sorting", async () => {
    let calls = 0;
    expect(await runTaskReorder("priority", async () => { calls += 1; })).toBe(false);
    expect(calls).toBe(0);
    expect(TASK_REORDER_GUIDANCE).toContain("Manual");

    expect(await runTaskReorder("manual", async () => { calls += 1; })).toBe(true);
    expect(calls).toBe(1);
  });

  it("persists task sort in planner navigation state without changing saved-view configuration", () => {
    const written = writePlannerLocation(new URL("https://app.test/?destination=tasks&view=board"), {
      destination: "tasks",
      view: "board",
      taskSort: "scheduled",
    });

    expect(written.searchParams.get("taskSort")).toBe("scheduled");
    expect(parsePlannerLocation(written).taskSort).toBe("scheduled");
    expect(adaptSavedTaskView({ filter: "open", sort: "created" })).toEqual({ filter: "open", sort: "created", query: "" });
  });

  it("provides keyboard movement for the Capture tabs", () => {
    expect(nextCaptureKindForKey("task", "ArrowRight")).toBe("project");
    expect(nextCaptureKindForKey("task", "ArrowLeft")).toBe("habit");
    expect(nextCaptureKindForKey("goal", "Home")).toBe("task");
    expect(nextCaptureKindForKey("project", "End")).toBe("habit");
  });

  it("retains dependency selection when the write rejects and returns a recoverable error", async () => {
    let cleared = false;
    const result = await runDependencyAction(
      () => Promise.reject(new Error("Dependency changed elsewhere.")),
      () => { cleared = true; },
    );

    expect(result).toEqual({ ok: false, error: "Dependency changed elsewhere." });
    expect(cleared).toBe(false);
  });

  it("routes a completed row primary action to canonical detail", () => {
    expect(fallbackTaskPrimaryAction("open_task")).toBe("detail");
    expect(fallbackTaskPrimaryAction("complete")).toBe("toggle");
  });

  it("states the truthful route for intentional noncompletion", () => {
    expect(INBOX_TRIAGE_GUIDANCE).toContain("Plan commitment");
    expect(INBOX_TRIAGE_GUIDANCE).not.toContain("mark intentional noncompletion");
  });

  it("keeps Inbox navigable without turning every Inbox URL into a Capture action", () => {
    const written = writePlannerLocation(new URL("https://app.test/"), {
      destination: "tasks",
      view: "inbox",
    });

    expect(written.searchParams.get("action")).toBeNull();
    expect(written.searchParams.get("destination")).toBe("tasks");
    expect(written.searchParams.get("view")).toBe("inbox");
  });
});
