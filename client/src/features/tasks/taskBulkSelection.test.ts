import type { CanonicalTask } from "@shared/canonicalTask";
import type { TaskDropContext } from "@shared/taskDrop";
import { describe, expect, it } from "vitest";
import {
  bulkPlanChoices,
  bulkSelectionKey,
  bulkUndoWrites,
  emptyBulkSelection,
  planBulkAction,
  pruneBulkSelection,
  toggleBulkSelection,
} from "./taskBulkSelection";

// 2026-10-14 is a Wednesday.
const today = "2026-10-14";
const order = ["a", "b", "c", "d", "e"];

function task(overrides: Partial<CanonicalTask> & { id: string }): CanonicalTask {
  return { title: overrides.id, state: "not_started", horizon: "weekly", priority: "medium", dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, recurrenceRule: null, sortOrder: 0, projectId: null, ...overrides } as unknown as CanonicalTask;
}

function ctx(overrides: Partial<TaskDropContext> = {}): TaskDropContext {
  return { today, timezone: "Pacific/Auckland", sort: "manual", occurrences: [], dependencies: [], tasks: [], committedTasks: new Map(), ...overrides };
}

describe("bulk selection model", () => {
  it("toggles one id and moves the anchor", () => {
    const one = toggleBulkSelection(emptyBulkSelection, "b", order);
    expect([...one.ids]).toEqual(["b"]);
    expect(one.anchor).toBe("b");
    const off = toggleBulkSelection(one, "b", order);
    expect(off.ids.size).toBe(0);
    expect(off.anchor).toBeNull();
  });

  it("Shift selects the inclusive range from the anchor in display order, both directions", () => {
    const start = toggleBulkSelection(emptyBulkSelection, "b", order);
    const down = toggleBulkSelection(start, "d", order, { range: true });
    expect([...down.ids].sort()).toEqual(["b", "c", "d"]);
    expect(down.anchor).toBe("d");
    const up = toggleBulkSelection(toggleBulkSelection(emptyBulkSelection, "e", order), "c", order, { range: true });
    expect([...up.ids].sort()).toEqual(["c", "d", "e"]);
  });

  it("Shift without an anchor is a plain toggle", () => {
    expect([...toggleBulkSelection(emptyBulkSelection, "c", order, { range: true }).ids]).toEqual(["c"]);
  });

  it("prunes ids that left the screen and keeps the same object when nothing changed", () => {
    const sel = toggleBulkSelection(toggleBulkSelection(emptyBulkSelection, "a", order), "c", order);
    expect(pruneBulkSelection(sel, new Set(order))).toBe(sel);
    const pruned = pruneBulkSelection(sel, new Set(["a"]));
    expect([...pruned.ids]).toEqual(["a"]);
    expect(pruned.anchor).toBeNull();
  });

  it("X toggles the focused task, Esc clears only a live selection, text fields and modifiers are ignored", () => {
    const div = { tagName: "DIV" } as unknown as EventTarget;
    const input = { tagName: "INPUT" } as unknown as EventTarget;
    expect(bulkSelectionKey({ key: "x" }, div, "a", 0)).toBe("toggle");
    expect(bulkSelectionKey({ key: "X" }, div, "a", 2)).toBe("toggle");
    expect(bulkSelectionKey({ key: "x" }, div, null, 0)).toBeNull();
    expect(bulkSelectionKey({ key: "x" }, input, "a", 0)).toBeNull();
    expect(bulkSelectionKey({ key: "x", ctrlKey: true }, div, "a", 0)).toBeNull();
    expect(bulkSelectionKey({ key: "Escape" }, div, null, 3)).toBe("clear");
    expect(bulkSelectionKey({ key: "Escape" }, div, null, 0)).toBeNull();
  });
});

describe("bulk batches", () => {
  it("Plan for tomorrow writes one patch per task with the inverse kept for ONE Undo", () => {
    const tasks = [task({ id: "a" }), task({ id: "b", scheduledLocalDate: "2026-10-20" })];
    const plan = planBulkAction(tasks, { kind: "plan", localDate: "2026-10-15", label: "tomorrow" }, ctx());
    expect(plan.writes.map(write => [write.task.id, write.patch, write.undo])).toEqual([
      ["a", { scheduledLocalDate: "2026-10-15" }, { scheduledLocalDate: null }],
      ["b", { scheduledLocalDate: "2026-10-15" }, { scheduledLocalDate: "2026-10-20" }],
    ]);
    expect(plan.message).toBe("Planned 2 tasks for tomorrow");
    expect(plan.skipped).toBeNull();
    const undo = bulkUndoWrites(plan.writes.map(write => ({ write, record: { ...write.task, version: 2 } as Record<string, unknown> })));
    expect(undo).toHaveLength(2);
    expect(undo.map(item => [item.task.id, (item.task as unknown as { version: number }).version, item.patch])).toEqual([
      ["a", 2, { scheduledLocalDate: null }],
      ["b", 2, { scheduledLocalDate: "2026-10-20" }],
    ]);
  });

  it("refuses recurring series and archived tasks, writing nothing for them and saying why", () => {
    const tasks = [task({ id: "a" }), task({ id: "r", recurrenceRule: { frequency: "daily" } as never }), task({ id: "x", state: "archived" })];
    const plan = planBulkAction(tasks, { kind: "plan", localDate: "2026-10-15", label: "tomorrow" }, ctx());
    expect(plan.writes.map(write => write.task.id)).toEqual(["a"]);
    expect(plan.excluded.map(item => item.task.id)).toEqual(["r", "x"]);
    expect(plan.skipped).toMatch(/^2 skipped: /);
  });

  it("project and priority skip tasks that already match", () => {
    const tasks = [task({ id: "a", projectId: "p1" }), task({ id: "b" })];
    const moved = planBulkAction(tasks, { kind: "project", projectId: "p1", label: "Portfolio" }, ctx());
    expect(moved.writes.map(write => write.task.id)).toEqual(["b"]);
    expect(moved.unchanged.map(item => item.id)).toEqual(["a"]);
    expect(moved.message).toBe("Moved 1 task to Portfolio");
    const pri = planBulkAction(tasks, { kind: "priority", priority: "high", label: "high" }, ctx());
    expect(pri.writes.map(write => [write.patch, write.undo])).toEqual([[{ priority: "high" }, { priority: "medium" }], [{ priority: "high" }, { priority: "medium" }]]);
  });

  it("archive uses the shared state guards and restores the prior state on Undo", () => {
    const plan = planBulkAction([task({ id: "a", state: "in_progress" })], { kind: "archive" }, ctx());
    expect(plan.writes[0]).toMatchObject({ patch: { state: "archived" }, undo: { state: "in_progress" } });
    expect(plan.message).toBe("Archived 1 task");
  });

  it("offers Today, Tomorrow and the next week start for the workspace week start", () => {
    expect(bulkPlanChoices(today, 1).map(choice => choice.localDate)).toEqual(["2026-10-14", "2026-10-15", "2026-10-19"]);
    expect(bulkPlanChoices(today, 0).map(choice => choice.localDate)).toEqual(["2026-10-14", "2026-10-15", "2026-10-18"]);
  });
});
