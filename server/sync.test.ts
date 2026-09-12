import { describe, expect, it, vi } from "vitest";
import { processTaskUpdateOperation, resolveSyncConflict, type SyncTaskUpdateOperation } from "./sync";

const scope = { workspaceId: "workspace-sync-test", timezone: "UTC" };
const operation: SyncTaskUpdateOperation = {
  operationId: "operation-1",
  entity: "task",
  entityId: "task-1",
  kind: "update",
  baseVersion: 3,
  baseValues: { title: "Before", description: "Original note" },
  patch: { title: "Device title", description: "Device note" },
  createdAt: "2026-09-12T10:00:00.000Z",
};

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    findReceipt: vi.fn().mockResolvedValue(null),
    findTask: vi.fn().mockResolvedValue({ id: "task-1", workspaceId: scope.workspaceId, title: "Before", description: "Phone note", version: 4 }),
    updateTask: vi.fn().mockResolvedValue({ id: "task-1", workspaceId: scope.workspaceId, title: "Device title", description: "Phone note", version: 5 }),
    saveConflicts: vi.fn().mockResolvedValue(undefined),
    saveReceipt: vi.fn().mockImplementation(async (_scope, _operation, result) => result),
    ...overrides,
  } as any;
}

describe("idempotent task synchronization", () => {
  it("returns the prior receipt without applying a duplicate operation", async () => {
    const prior = { operationId: "operation-1", outcome: "applied", appliedFields: ["title"], alreadyAppliedFields: [], conflicts: [], record: { id: "task-1", version: 4 } } as const;
    const deps = dependencies({ findReceipt: vi.fn().mockResolvedValue(prior) });
    await expect(processTaskUpdateOperation(scope, operation, deps)).resolves.toEqual(prior);
    expect(deps.findTask).not.toHaveBeenCalled();
    expect(deps.updateTask).not.toHaveBeenCalled();
  });

  it("applies safe fields and durably retains overlapping fields", async () => {
    const deps = dependencies();
    const result = await processTaskUpdateOperation(scope, operation, deps);

    expect(deps.updateTask).toHaveBeenCalledWith(scope, { id: "task-1", expectedVersion: 4, patch: { title: "Device title" } });
    expect(deps.saveConflicts).toHaveBeenCalledWith(scope, operation, 5, [
      { field: "description", baseValue: "Original note", localValue: "Device note", serverValue: "Phone note" },
    ]);
    expect(result).toMatchObject({ outcome: "needs_review", appliedFields: ["title"], record: { version: 5 } });
  });

  it("records an already-applied retry without performing another update", async () => {
    const deps = dependencies({
      findTask: vi.fn().mockResolvedValue({ id: "task-1", workspaceId: scope.workspaceId, title: "Device title", description: "Device note", version: 5 }),
    });
    const result = await processTaskUpdateOperation(scope, operation, deps);
    expect(deps.updateTask).not.toHaveBeenCalled();
    expect(result).toMatchObject({ outcome: "already_applied", alreadyAppliedFields: ["title", "description"] });
  });

  it("rejects a task outside the authorized workspace", async () => {
    const deps = dependencies({ findTask: vi.fn().mockResolvedValue(null) });
    await expect(processTaskUpdateOperation(scope, operation, deps)).rejects.toThrow("Task was not found");
    expect(deps.saveReceipt).not.toHaveBeenCalled();
  });
});

describe("explicit conflict resolution", () => {
  const conflict = {
    id: "conflict-1", workspaceId: scope.workspaceId, operationId: "operation-1", entity: "task", entityId: "task-1",
    field: "title", baseValue: "Before", localValue: "Device", serverValue: "Phone", serverVersion: 5,
    state: "needs_review", resolvedValue: null, createdAt: new Date(), resolvedAt: null,
  };

  it("applies the retained device value only at the recorded server version", async () => {
    const deps = {
      findConflict: vi.fn().mockResolvedValue(conflict),
      findTask: vi.fn().mockResolvedValue({ id: "task-1", workspaceId: scope.workspaceId, title: "Phone", version: 5 }),
      updateTask: vi.fn().mockResolvedValue({ id: "task-1", workspaceId: scope.workspaceId, title: "Device", version: 6 }),
      markResolved: vi.fn().mockResolvedValue(undefined),
    } as any;
    await expect(resolveSyncConflict(scope, { conflictId: "conflict-1", choice: "local" }, deps)).resolves.toMatchObject({ state: "resolved_local", record: { title: "Device", version: 6 } });
    expect(deps.updateTask).toHaveBeenCalledWith(scope, { id: "task-1", expectedVersion: 5, patch: { title: "Device" } });
    expect(deps.markResolved).toHaveBeenCalledWith(scope, "conflict-1", "resolved_local", "Device");
  });

  it("keeps the server side without writing the task", async () => {
    const deps = {
      findConflict: vi.fn().mockResolvedValue(conflict),
      findTask: vi.fn(), updateTask: vi.fn(), markResolved: vi.fn().mockResolvedValue(undefined),
    } as any;
    await expect(resolveSyncConflict(scope, { conflictId: "conflict-1", choice: "server" }, deps)).resolves.toMatchObject({ state: "resolved_server", record: null });
    expect(deps.updateTask).not.toHaveBeenCalled();
    expect(deps.markResolved).toHaveBeenCalledWith(scope, "conflict-1", "resolved_server", "Phone");
  });

  it("does not overwrite a task that changed again after the conflict", async () => {
    const deps = {
      findConflict: vi.fn().mockResolvedValue(conflict),
      findTask: vi.fn().mockResolvedValue({ id: "task-1", workspaceId: scope.workspaceId, title: "Newer", version: 6 }),
      updateTask: vi.fn(), markResolved: vi.fn(),
    } as any;
    await expect(resolveSyncConflict(scope, { conflictId: "conflict-1", choice: "local" }, deps)).rejects.toMatchObject({ current: expect.objectContaining({ version: 6 }) });
    expect(deps.markResolved).not.toHaveBeenCalled();
  });
});
