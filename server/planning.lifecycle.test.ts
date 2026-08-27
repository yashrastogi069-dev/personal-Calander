import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { bulkSetTaskState, updateTask } from "./planning";

const mockedGetDb = vi.mocked(getDb);
const scope = { workspaceId: "lifecycle-service-test", timezone: "UTC" };

function selection(row: unknown) {
  return { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([row]) })) })) };
}

function bulkDatabase(rows: unknown[]) {
  const whereUpdate = vi.fn().mockResolvedValue({ rowsAffected: rows.length });
  const set = vi.fn(() => ({ where: whereUpdate }));
  const select = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(rows) })) }));
  return { db: { update: vi.fn(() => ({ set })), select }, set, whereUpdate };
}

describe("planner task lifecycle persistence", () => {
  beforeEach(() => vi.resetAllMocks());

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
});
