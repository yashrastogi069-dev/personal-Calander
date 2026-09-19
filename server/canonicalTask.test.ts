import { describe, expect, it } from "vitest";
import {
  canonicalTaskPresentation,
  type CanonicalTask,
  type CanonicalTaskContext,
} from "@shared/canonicalTask";

function task(overrides: Partial<CanonicalTask> = {}): CanonicalTask {
  return {
    id: "task-1",
    workspaceId: "workspace-1",
    parentTaskId: null,
    goalId: "goal-1",
    projectId: "project-1",
    categoryId: "category-1",
    title: "Prepare launch notes",
    description: "Summarize the decisions",
    state: "not_started",
    priority: "high",
    horizon: "weekly",
    dueLocalDate: "2026-09-22",
    scheduledLocalDate: "2026-09-20",
    plannedStartAt: null,
    plannedEndAt: null,
    estimateMinutes: 45,
    sortOrder: 2,
    scheduleMode: "flexible",
    outcome: "none",
    outcomeAt: null,
    recurrenceRule: null,
    recurrenceAnchor: null,
    recurrenceUntilLocalDate: null,
    rescheduleCount: 0,
    clientRequestId: null,
    completedAt: null,
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-19T00:00:00.000Z",
    version: 3,
    ...overrides,
  };
}

const context: CanonicalTaskContext = {
  surface: "today",
  localDate: "2026-09-20",
  timezone: "UTC",
  categoryName: "Work",
  projectTitle: "Product launch",
  goalTitle: "Ship version one",
};

describe("canonicalTaskPresentation", () => {
  it("preserves task identity and exposes the original task as secondary-field source", () => {
    const source = task();
    const result = canonicalTaskPresentation(source, context);

    expect(result.identity).toEqual({ kind: "task", recordId: "task-1", workspaceId: "workspace-1", version: 3 });
    expect(result.title).toBe("Prepare launch notes");
    expect(result.secondaryFields).toBe(source);
    expect(source.title).toBe("Prepare launch notes");
  });

  it("returns explicit completion state without inferring completion from dates", () => {
    expect(canonicalTaskPresentation(task(), context).completion).toEqual({ isComplete: false, state: "not_started", completedAt: null });
    expect(canonicalTaskPresentation(task({ state: "completed", completedAt: "2026-09-20T11:00:00.000Z" }), context).completion)
      .toEqual({ isComplete: true, state: "completed", completedAt: "2026-09-20T11:00:00.000Z" });
  });

  it("uses reserved time before Plan for and Due by as its single key label", () => {
    expect(canonicalTaskPresentation(task({
      plannedStartAt: "2026-09-20T09:00:00.000Z",
      plannedEndAt: "2026-09-20T10:00:00.000Z",
    }), context).keyTime).toEqual({
      kind: "reserved_time",
      label: "Reserved 09:00–10:00",
      startsAt: "2026-09-20T09:00:00.000Z",
      endsAt: "2026-09-20T10:00:00.000Z",
    });

    expect(canonicalTaskPresentation(task(), context).keyTime).toEqual({
      kind: "plan_for",
      label: "Plan for Sep 20",
      localDate: "2026-09-20",
    });

    expect(canonicalTaskPresentation(task({ scheduledLocalDate: null }), context).keyTime).toEqual({
      kind: "due_by",
      label: "Due by Sep 22",
      localDate: "2026-09-22",
    });
  });

  it("returns no more than two relevant metadata labels", () => {
    expect(canonicalTaskPresentation(task(), context).metadata).toEqual([
      { kind: "project", label: "Product launch", recordId: "project-1" },
      { kind: "priority", label: "High priority" },
    ]);
  });

  it.each([
    ["today", "complete", "Complete"],
    ["tasks", "complete", "Complete"],
    ["calendar", "edit_reservation", "Edit reserved time"],
    ["search", "open_task", "Open task"],
    ["recovery", "resolve_commitment", "Resolve commitment"],
  ] as const)("chooses the %s contextual primary action", (surface, id, label) => {
    const source = surface === "calendar"
      ? task({ plannedStartAt: "2026-09-20T09:00:00.000Z", plannedEndAt: "2026-09-20T10:00:00.000Z" })
      : task();

    expect(canonicalTaskPresentation(source, { ...context, surface }).primaryAction).toEqual({ id, label });
  });

  it("opens completed tasks instead of offering another completion", () => {
    expect(canonicalTaskPresentation(task({ state: "completed" }), context).primaryAction).toEqual({ id: "open_task", label: "Open task" });
  });

  it("formats reserved time in the supplied workspace timezone deterministically", () => {
    const result = canonicalTaskPresentation(task({
      plannedStartAt: "2026-09-20T08:30:00.000Z",
      plannedEndAt: "2026-09-20T09:15:00.000Z",
    }), { ...context, timezone: "Asia/Calcutta" });

    expect(result.keyTime?.label).toBe("Reserved 14:00–14:45");
  });
});
