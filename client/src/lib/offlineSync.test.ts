import { describe, expect, it } from "vitest";
import {
  MemoryPlannerSyncStore,
  classifyFieldMerge,
  createPlannerOperation,
  plannerScopeKey,
  type PlannerSyncScope,
} from "./offlineSync";

const accountA: PlannerSyncScope = { accountId: "account-a", workspaceId: "workspace-1" };
const accountB: PlannerSyncScope = { accountId: "account-b", workspaceId: "workspace-1" };

describe("offline planner synchronization", () => {
  it("makes account and workspace identity part of every durable key", () => {
    expect(plannerScopeKey(accountA)).toBe("account-a::workspace-1");
    expect(plannerScopeKey(accountB)).not.toBe(plannerScopeKey(accountA));
  });

  it("never exposes one account's snapshot to another account", async () => {
    const store = new MemoryPlannerSyncStore();
    await store.putSnapshot(accountA, "2026-09-01", "2026-09-30", { tasks: [{ id: "private-a" }] });

    await expect(store.getSnapshot(accountA, "2026-09-01", "2026-09-30")).resolves.toMatchObject({
      scopeKey: "account-a::workspace-1",
      snapshot: { tasks: [{ id: "private-a" }] },
    });
    await expect(store.getSnapshot(accountB, "2026-09-01", "2026-09-30")).resolves.toBeNull();
  });

  it("keeps operations immutable and enqueue idempotent", async () => {
    const store = new MemoryPlannerSyncStore();
    const operation = createPlannerOperation(accountA, {
      operationId: "operation-1",
      entity: "task",
      entityId: "task-1",
      kind: "update",
      baseVersion: 3,
      baseValues: { title: "Original" },
      patch: { title: "Device edit" },
      createdAt: "2026-09-12T10:00:00.000Z",
    });

    await store.enqueue(operation);
    await store.enqueue(operation);
    operation.patch.title = "mutated outside";

    await expect(store.listOperations(accountA)).resolves.toEqual([
      expect.objectContaining({ operationId: "operation-1", patch: { title: "Device edit" }, state: "pending" }),
    ]);
  });

  it("acknowledges only an operation in the active account scope", async () => {
    const store = new MemoryPlannerSyncStore();
    await store.enqueue(createPlannerOperation(accountA, {
      operationId: "shared-id", entity: "task", entityId: "task-a", kind: "update",
      baseVersion: 1, baseValues: { title: "A" }, patch: { title: "A2" }, createdAt: "2026-09-12T10:00:00.000Z",
    }));
    await store.enqueue(createPlannerOperation(accountB, {
      operationId: "shared-id", entity: "task", entityId: "task-b", kind: "update",
      baseVersion: 1, baseValues: { title: "B" }, patch: { title: "B2" }, createdAt: "2026-09-12T10:01:00.000Z",
    }));

    await store.acknowledge(accountA, "shared-id");
    await expect(store.listOperations(accountA)).resolves.toEqual([]);
    await expect(store.listOperations(accountB)).resolves.toHaveLength(1);
  });

  it("marks retry and review state without mutating another account's operation", async () => {
    const store = new MemoryPlannerSyncStore();
    const item = createPlannerOperation(accountA, {
      operationId: "operation-state", entity: "task", entityId: "task-a", kind: "update",
      baseVersion: 1, baseValues: { title: "A" }, patch: { title: "A2" }, createdAt: "2026-09-12T10:00:00.000Z",
    });
    await store.enqueue(item);
    await store.markOperation(accountB, item.operationId, "retry", "network");
    await store.markOperation(accountA, item.operationId, "needs_review", "not_found");
    await expect(store.listOperations(accountA)).resolves.toEqual([
      expect.objectContaining({ state: "needs_review", attempts: 1, lastErrorCode: "not_found" }),
    ]);
  });

  it("classifies safe, already-applied, and overlapping field edits without dropping values", () => {
    expect(classifyFieldMerge({ base: "Old", local: "Local", server: "Old" })).toEqual({ kind: "apply_local", value: "Local" });
    expect(classifyFieldMerge({ base: "Old", local: "Local", server: "Local" })).toEqual({ kind: "already_applied", value: "Local" });
    expect(classifyFieldMerge({ base: "Old", local: "Local", server: "Server" })).toEqual({
      kind: "conflict", base: "Old", local: "Local", server: "Server",
    });
    expect(classifyFieldMerge({ base: null, local: null, server: null })).toEqual({ kind: "already_applied", value: null });
  });

  it("retains complete conflict values until explicit resolution", async () => {
    const store = new MemoryPlannerSyncStore();
    await store.putConflict({
      conflictId: "conflict-1",
      operationId: "operation-1",
      ...accountA,
      entity: "task",
      entityId: "task-1",
      field: "title",
      baseValue: "Original",
      localValue: "Device title",
      serverValue: "Phone title",
      serverVersion: 4,
      createdAt: "2026-09-12T10:02:00.000Z",
      state: "needs_review",
    });

    const conflicts = await store.listConflicts(accountA);
    expect(conflicts).toEqual([expect.objectContaining({
      baseValue: "Original", localValue: "Device title", serverValue: "Phone title", state: "needs_review",
    })]);
    await expect(store.listConflicts(accountB)).resolves.toEqual([]);
  });
});
