import { describe, expect, it } from "vitest";
import {
  inboxTasks,
  taskUndoPatch,
  tasksForWorkspaceView,
} from "../client/src/features/tasks/TaskWorkspace";
import {
  captureTaskPatch,
  interpretationChips,
} from "../client/src/features/tasks/CaptureSheet";
import { searchOpenLocation } from "../client/src/features/search/WorkspaceSearchWorkspace";
import { writePlannerLocation } from "../client/src/lib/plannerLocation";

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
    expect(taskUndoPatch({ state: "completed" }, "archive")).toEqual({ state: "completed" });
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
