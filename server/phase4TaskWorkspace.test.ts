import { describe, expect, it } from "vitest";
import {
  adaptSavedTaskView,
  inboxTasks,
  resetTaskWorkspaceState,
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
  searchRecordFromSnapshot,
} from "../client/src/features/search/WorkspaceSearchWorkspace";
import { writePlannerLocation } from "../client/src/lib/plannerLocation";
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
      { query: "lease", taskQuery: "urgent", taskFilter: "deadline_risk" },
    )).toEqual({
      destination: "tasks",
      view: "list",
      selectedRecord: "task-42",
      query: "lease",
      taskQuery: "urgent",
      taskFilter: "deadline_risk",
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
      { query: "lease", taskQuery: "urgent", taskFilter: "open" },
    );

    expect(location).toMatchObject({ destination, view, selectedRecord: `${entity}-42`, query: "lease" });
    expect(searchEntityForLocation(location)).toBe(entity);
  });

  it("resolves the exact non-task Search record from the canonical snapshot", () => {
    const snapshot = {
      tasks: [],
      goals: [{ id: "goal-1", title: "Goal" }],
      projects: [{ id: "project-1", title: "Project" }],
      habits: [{ id: "habit-1", name: "Habit" }],
      reviewSessions: [{ id: "review-1", kind: "weekly", periodStartLocalDate: "2026-09-14", periodEndLocalDate: "2026-09-20" }],
    };

    expect(searchRecordFromSnapshot(snapshot, { entity: "goal", id: "goal-1" })).toMatchObject({ id: "goal-1", title: "Goal" });
    expect(searchRecordFromSnapshot(snapshot, { entity: "project", id: "project-1" })).toMatchObject({ id: "project-1", title: "Project" });
    expect(searchRecordFromSnapshot(snapshot, { entity: "habit", id: "habit-1" })).toMatchObject({ id: "habit-1", title: "Habit" });
    expect(searchRecordFromSnapshot(snapshot, { entity: "review", id: "review-1" })).toMatchObject({ id: "review-1", title: "Weekly review · 2026-09-14 to 2026-09-20" });
  });

  it("carries the current Capture thought into interpretation and reports queued persistence", () => {
    expect(captureInterpretationHandoff("  Pay the lease Friday  ")).toBe("  Pay the lease Friday  ");
    expect(capturePersistenceMessage({ queued: true })).toBe("Saved on this device · waiting to sync.");
    expect(capturePersistenceMessage({ queued: false })).toBe("Saved.");
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
