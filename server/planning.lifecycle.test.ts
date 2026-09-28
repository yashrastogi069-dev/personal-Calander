import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { bulkSetTaskState, missingCommittedPlanIds, reserveTask, resolveDailyPlanItem, updateTask } from "./planning";

const mockedGetDb = vi.mocked(getDb);
const scope = { workspaceId: "lifecycle-service-test", timezone: "UTC" };

function selection(row: unknown) {
  return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([row]) })) })) };
}

function collection(rows: unknown[]) {
  return { from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(rows) })) };
}

function bulkDatabase(rows: unknown[]) {
  const whereUpdate = vi.fn().mockResolvedValue({ rowsAffected: rows.length });
  const set = vi.fn(() => ({ where: whereUpdate }));
  const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(rows) })) }));
  return { db: { update: vi.fn(() => ({ set })), select }, set, whereUpdate };
}

describe("planner task lifecycle persistence", () => {
  beforeEach(() => vi.resetAllMocks());

  it("identifies only out-of-window plans owning still-committed items", () => {
    expect(missingCommittedPlanIds(
      [{ id: "visible" }],
      [
        { dailyPlanId: "visible", state: "committed" },
        { dailyPlanId: "older", state: "committed" },
        { dailyPlanId: "older", state: "committed" },
        { dailyPlanId: "settled", state: "done" },
      ],
    )).toEqual(["older"]);
  });

  it("restores an archived task as unfinished work, clears lifecycle timestamps, and increments its version", async () => {
    const existing = { id: "task-restore-1", workspaceId: scope.workspaceId, state: "archived", completedAt: new Date("2026-08-20T10:00:00.000Z"), archivedAt: new Date("2026-08-21T10:00:00.000Z"), version: 7 };
    const restored = { ...existing, state: "not_started", completedAt: null, archivedAt: null, version: 8 };
    const whereUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const set = vi.fn(() => ({ where: whereUpdate }));
    const select = vi.fn().mockReturnValueOnce(selection(existing)).mockReturnValueOnce(selection(restored));
    mockedGetDb.mockResolvedValue({ select, update: vi.fn(() => ({ set })) } as never);

    await expect(updateTask(scope, { id: existing.id, expectedVersion: existing.version, patch: { state: "not_started" } })).resolves.toEqual(restored);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ state: "not_started", completedAt: null, archivedAt: null, version: 8 }));
    expect(whereUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects a recurring-series daily commitment before any transaction mutates its task or item", async () => {
    const item = { id: "item-recurring", workspaceId: scope.workspaceId, taskId: "task-recurring", state: "committed", version: 1 };
    const series = { id: "task-recurring", workspaceId: scope.workspaceId, state: "not_started", version: 4, recurrenceRule: { frequency: "daily" } };
    const transaction = vi.fn();
    const update = vi.fn();
    const select = vi.fn().mockReturnValueOnce(selection(item)).mockReturnValueOnce(selection(series));
    mockedGetDb.mockResolvedValue({ select, update, transaction } as never);

    await expect(resolveDailyPlanItem(scope, { id: item.id, expectedVersion: 1, taskExpectedVersion: 4, state: "deferred" })).rejects.toThrow("Recurring commitments need the recovery flow after migration");
    expect(transaction).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects daily-plan outcomes when an older occurrence exists even if the recurrence rule was cleared", async () => {
    const item = { id: "item-history", workspaceId: scope.workspaceId, taskId: "task-history", state: "committed", version: 1 };
    const task = { id: "task-history", workspaceId: scope.workspaceId, state: "not_started", version: 2, recurrenceRule: null };
    const transaction = vi.fn();
    const select = vi.fn().mockReturnValueOnce(selection(item)).mockReturnValueOnce(selection(task)).mockReturnValueOnce(selection({ id: "occ-old" }));
    mockedGetDb.mockResolvedValue({ select, transaction } as never);

    await expect(resolveDailyPlanItem(scope, { id: item.id, expectedVersion: 1, taskExpectedVersion: 2, state: "done" })).rejects.toThrow("Recurring commitments need the recovery flow after migration");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a stale unresolved item whose linked task was already completed elsewhere", async () => {
    const item = { id: "item-stale", workspaceId: scope.workspaceId, taskId: "task-complete", state: "committed", version: 1 };
    const completed = { id: "task-complete", workspaceId: scope.workspaceId, state: "completed", version: 3, recurrenceRule: null };
    const transaction = vi.fn();
    const select = vi.fn().mockReturnValueOnce(selection(item)).mockReturnValueOnce(selection(completed));
    mockedGetDb.mockResolvedValue({ select, transaction } as never);

    await expect(resolveDailyPlanItem(scope, { id: item.id, expectedVersion: 1, taskExpectedVersion: 3, state: "done" })).rejects.toThrow("Needs reconciliation in Recovery");
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects generic completion when a committed item belongs to a non-archived older plan", async () => {
    const existing = { id: "task-prior-commitment", workspaceId: scope.workspaceId, state: "not_started", version: 2, recurrenceRule: null };
    const select = vi.fn().mockReturnValueOnce(selection(existing))
      .mockReturnValueOnce(collection([{ dailyPlanId: "plan-outside-snapshot" }]))
      .mockReturnValueOnce(collection([{ id: "plan-outside-snapshot" }]));
    const update = vi.fn();
    mockedGetDb.mockResolvedValue({ select, update } as never);
    await expect(updateTask(scope, { id: existing.id, expectedVersion: 2, patch: { state: "completed" } })).rejects.toThrow("unresolved daily commitment");
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects generic archive of a recurring parent even when no occurrence was loaded", async () => {
    const existing = { id: "task-series", workspaceId: scope.workspaceId, state: "not_started", version: 3, recurrenceRule: { frequency: "daily" } };
    const select = vi.fn().mockReturnValueOnce(selection(existing));
    const update = vi.fn();
    mockedGetDb.mockResolvedValue({ select, update } as never);
    await expect(updateTask(scope, { id: existing.id, expectedVersion: 3, patch: { state: "archived" } })).rejects.toThrow("recurring series needs dated occurrence resolution");
    expect(update).not.toHaveBeenCalled();
  });

  it("allows a terminal task outcome when its only commitment belongs to an archived plan", async () => {
    const existing = { id: "task-archived-plan", workspaceId: scope.workspaceId, state: "not_started", version: 1, recurrenceRule: null };
    const updated = { ...existing, state: "archived", version: 2 };
    const set = vi.fn(() => ({ where: vi.fn().mockResolvedValue({ rowsAffected: 1 }) }));
    const select = vi.fn().mockReturnValueOnce(selection(existing))
      .mockReturnValueOnce(collection([{ dailyPlanId: "archived-plan" }]))
      .mockReturnValueOnce(collection([]))
      .mockReturnValueOnce(selection(updated));
    mockedGetDb.mockResolvedValue({ select, update: vi.fn(() => ({ set })) } as never);
    await expect(updateTask(scope, { id: existing.id, expectedVersion: 1, patch: { state: "archived" } })).resolves.toMatchObject({ id: existing.id, state: "archived", version: 2 });
    expect(set).toHaveBeenCalledOnce();
  });

  it("rejects bulk archive before any task write when one task has an unresolved commitment", async () => {
    const select = vi.fn().mockReturnValueOnce(collection([{ id: "task-prior-commitment", recurrenceRule: null }, { id: "task-plain", recurrenceRule: null }]))
      .mockReturnValueOnce(collection([{ dailyPlanId: "old-plan" }]))
      .mockReturnValueOnce(collection([{ id: "old-plan" }]));
    const update = vi.fn();
    mockedGetDb.mockResolvedValue({ select, update } as never);
    await expect(bulkSetTaskState(scope, { ids: ["task-prior-commitment", "task-plain"], state: "archived" })).rejects.toThrow("unresolved daily commitment");
    expect(update).not.toHaveBeenCalled();
  });

  it("clears only task-owned reservation timestamps when a calendar block is removed", async () => {
    const existing = { id: "task-unreserve-1", workspaceId: scope.workspaceId, state: "in_progress", version: 6, goalId: null, projectId: null, categoryId: null, parentTaskId: null, scheduledLocalDate: "2026-08-28", plannedStartAt: new Date("2026-08-28T09:00:00.000Z"), plannedEndAt: new Date("2026-08-28T09:30:00.000Z"), estimateMinutes: 30, scheduleMode: "manual" };
    const updated = { ...existing, plannedStartAt: null, plannedEndAt: null, version: 7 };
    const whereUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const set = vi.fn(() => ({ where: whereUpdate }));
    const select = vi.fn().mockReturnValueOnce(selection(existing)).mockReturnValueOnce(selection(updated));
    mockedGetDb.mockResolvedValue({ select, update: vi.fn(() => ({ set })) } as never);

    await expect(updateTask(scope, { id: existing.id, expectedVersion: existing.version, patch: { plannedStartAt: null, plannedEndAt: null } })).resolves.toEqual(updated);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ plannedStartAt: null, plannedEndAt: null, version: 7 }));
    expect(set).not.toHaveBeenCalledWith(expect.objectContaining({ scheduledLocalDate: null, state: "archived" }));
    expect(whereUpdate).toHaveBeenCalledTimes(1);
  });

  it("writes consistent timestamps and a database-side version increment for bulk completion and archive", async () => {
    const completed = bulkDatabase([{ id: "task-complete-1", state: "completed", version: 4 }]);
    mockedGetDb.mockResolvedValue(completed.db as never);
    await expect(bulkSetTaskState(scope, { ids: ["task-complete-1"], state: "completed" })).resolves.toHaveLength(1);
    expect(completed.set).toHaveBeenCalledWith(expect.objectContaining({ state: "completed", completedAt: expect.any(Date), archivedAt: null, version: expect.anything() }));

    const archived = bulkDatabase([{ id: "task-archive-1", state: "archived", version: 5 }]);
    mockedGetDb.mockResolvedValue(archived.db as never);
    await expect(bulkSetTaskState(scope, { ids: ["task-archive-1"], state: "archived" })).resolves.toHaveLength(1);
    expect(archived.set).toHaveBeenCalledWith(expect.objectContaining({ state: "archived", completedAt: null, archivedAt: expect.any(Date), version: expect.anything() }));
  });

  it("rejects a task that tries to become its own parent before issuing an update", async () => {
    const existing = { id: "task-self-parent", workspaceId: scope.workspaceId, state: "not_started", version: 2, goalId: null, projectId: null, categoryId: null, parentTaskId: null };
    const update = vi.fn();
    const select = vi.fn().mockReturnValueOnce(selection(existing)).mockReturnValueOnce(selection(existing));
    mockedGetDb.mockResolvedValue({ select, update } as never);

    await expect(updateTask(scope, { id: existing.id, expectedVersion: existing.version, patch: { parentTaskId: existing.id } })).rejects.toThrow("cannot be its own parent");
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a task goal link that contradicts its selected project goal before issuing an update", async () => {
    const existing = { id: "task-link-mismatch", workspaceId: scope.workspaceId, state: "not_started", version: 2, goalId: "goal-1", projectId: "project-1", categoryId: null, parentTaskId: null };
    const update = vi.fn();
    const select = vi.fn().mockReturnValueOnce(selection(existing)).mockReturnValueOnce(selection({ id: "goal-1" })).mockReturnValueOnce(selection({ id: "project-1", goalId: "goal-2" }));
    mockedGetDb.mockResolvedValue({ select, update } as never);

    await expect(updateTask(scope, { id: existing.id, expectedVersion: existing.version, patch: { title: "Keep links coherent" } })).rejects.toThrow("linked to a different goal");
    expect(update).not.toHaveBeenCalled();
  });

  it("keeps a stale or completed task unchanged before issuing a manual reservation update", async () => {
    const stale = { id: "task-stale-reservation", workspaceId: scope.workspaceId, state: "not_started", version: 3 };
    const staleSelect = vi.fn().mockReturnValueOnce(selection(stale)).mockReturnValueOnce(collection([])).mockReturnValueOnce(collection([])).mockReturnValueOnce(selection({ workdayStartsAt: "09:00", workdayEndsAt: "17:00" })).mockReturnValueOnce(selection(null));
    const staleUpdate = vi.fn();
    mockedGetDb.mockResolvedValue({ select: staleSelect, update: staleUpdate } as never);
    await expect(reserveTask(scope, { id: stale.id, expectedVersion: 2, localDate: "2026-08-28", plannedStartAt: new Date("2026-08-28T09:00:00.000Z"), plannedEndAt: new Date("2026-08-28T09:30:00.000Z") })).rejects.toThrow("changed elsewhere");
    expect(staleUpdate).not.toHaveBeenCalled();

    const completed = { ...stale, id: "task-completed-reservation", state: "completed", version: 4 };
    const completedSelect = vi.fn().mockReturnValueOnce(selection(completed)).mockReturnValueOnce(collection([])).mockReturnValueOnce(collection([])).mockReturnValueOnce(selection({ workdayStartsAt: "09:00", workdayEndsAt: "17:00" })).mockReturnValueOnce(selection(null));
    const completedUpdate = vi.fn();
    mockedGetDb.mockResolvedValue({ select: completedSelect, update: completedUpdate } as never);
    await expect(reserveTask(scope, { id: completed.id, expectedVersion: completed.version, localDate: "2026-08-28", plannedStartAt: new Date("2026-08-28T09:00:00.000Z"), plannedEndAt: new Date("2026-08-28T09:30:00.000Z") })).rejects.toThrow("Completed or archived");
    expect(completedUpdate).not.toHaveBeenCalled();
  });

  it("rejects an external busy overlap and persists an eligible manual reservation with its version check", async () => {
    const task = { id: "task-manual-reservation", workspaceId: scope.workspaceId, state: "not_started", version: 4, scheduleMode: "flexible" };
    const busySelect = vi.fn().mockReturnValueOnce(selection(task)).mockReturnValueOnce(collection([])).mockReturnValueOnce(collection([{ startsAt: new Date("2026-08-28T09:00:00.000Z"), endsAt: new Date("2026-08-28T10:00:00.000Z") }])).mockReturnValueOnce(selection({ workdayStartsAt: "09:00", workdayEndsAt: "17:00" })).mockReturnValueOnce(selection(null));
    const busyUpdate = vi.fn();
    mockedGetDb.mockResolvedValue({ select: busySelect, update: busyUpdate } as never);
    await expect(reserveTask(scope, { id: task.id, expectedVersion: task.version, localDate: "2026-08-28", plannedStartAt: new Date("2026-08-28T09:15:00.000Z"), plannedEndAt: new Date("2026-08-28T09:45:00.000Z") })).rejects.toThrow("overlaps reserved or read-only busy");
    expect(busyUpdate).not.toHaveBeenCalled();

    const updated = { ...task, version: 5, scheduledLocalDate: "2026-08-28", plannedStartAt: new Date("2026-08-28T10:00:00.000Z"), plannedEndAt: new Date("2026-08-28T10:30:00.000Z"), scheduleMode: "manual" };
    const whereUpdate = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const set = vi.fn(() => ({ where: whereUpdate }));
    const validSelect = vi.fn().mockReturnValueOnce(selection(task)).mockReturnValueOnce(collection([])).mockReturnValueOnce(collection([])).mockReturnValueOnce(selection({ workdayStartsAt: "09:00", workdayEndsAt: "17:00" })).mockReturnValueOnce(selection(null)).mockReturnValueOnce(selection(updated));
    mockedGetDb.mockResolvedValue({ select: validSelect, update: vi.fn(() => ({ set })) } as never);
    await expect(reserveTask(scope, { id: task.id, expectedVersion: task.version, localDate: "2026-08-28", plannedStartAt: updated.plannedStartAt, plannedEndAt: updated.plannedEndAt })).resolves.toEqual(updated);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ scheduledLocalDate: "2026-08-28", plannedStartAt: updated.plannedStartAt, plannedEndAt: updated.plannedEndAt, scheduleMode: "manual", version: 5 }));
    expect(whereUpdate).toHaveBeenCalledTimes(1);
  });
});
