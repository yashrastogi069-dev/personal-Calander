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
});
