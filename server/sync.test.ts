import { describe, expect, it, vi } from "vitest";
import { processTaskUpdateOperation, type SyncTaskUpdateOperation } from "./sync";

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
