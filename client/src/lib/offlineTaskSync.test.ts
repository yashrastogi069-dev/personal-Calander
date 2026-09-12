import { describe, expect, it, vi } from "vitest";
import { MemoryPlannerSyncStore } from "./offlineSync";
import { queueTaskCreate, queueTaskUpdate, replayQueuedTaskUpdates } from "./offlineTaskSync";

const scope = { accountId: "account-a", workspaceId: "workspace-a" };

describe("offline task replay", () => {
  it("queues an account-scoped idempotent task create", async () => {
    const store = new MemoryPlannerSyncStore();
    await queueTaskCreate(store, scope, { title: "Captured offline", scheduledLocalDate: "2026-09-12", state: "not_started", priority: "medium", horizon: "daily", sortOrder: 0 }, "capture-1", "2026-09-12T09:00:00.000Z");
    await expect(store.listOperations(scope)).resolves.toEqual([expect.objectContaining({
      operationId: "capture-1", entityId: "offline:capture-1", kind: "create", baseVersion: null,
      baseValues: {}, patch: expect.objectContaining({ title: "Captured offline", scheduledLocalDate: "2026-09-12" }),
    })]);
  });

  it("acknowledges a replayed create and returns the durable server record", async () => {
    const store = new MemoryPlannerSyncStore();
    await queueTaskCreate(store, scope, { title: "Captured offline", state: "not_started", priority: "medium", horizon: "daily", sortOrder: 0 }, "capture-1", "2026-09-12T09:00:00.000Z");
    const replay = vi.fn().mockResolvedValue([{ operationId: "capture-1", status: "completed", outcome: "applied", appliedFields: ["title"], alreadyAppliedFields: [], conflicts: [], record: { id: "server-task-1", clientRequestId: "capture-1", title: "Captured offline", version: 1 } }]);
    await expect(replayQueuedTaskUpdates(store, scope, replay)).resolves.toMatchObject({ completed: 1, records: [{ id: "server-task-1", clientRequestId: "capture-1" }] });
    await expect(store.listOperations(scope)).resolves.toEqual([]);
  });

  it("captures a base value for every patched field", async () => {
    const store = new MemoryPlannerSyncStore();
    await queueTaskUpdate(store, scope, { id: "task-1", version: 4, title: "Before", state: "not_started" }, { title: "After", state: "completed" }, "operation-1", "2026-09-12T10:00:00.000Z");
    await expect(store.listOperations(scope)).resolves.toEqual([expect.objectContaining({
      baseVersion: 4,
      baseValues: { title: "Before", state: "not_started" },
      patch: { title: "After", state: "completed" },
    })]);
  });

  it("acknowledges completed operations and retains returned conflicts", async () => {
    const store = new MemoryPlannerSyncStore();
    await queueTaskUpdate(store, scope, { id: "task-1", version: 4, title: "Before" }, { title: "Device" }, "operation-1", "2026-09-12T10:00:00.000Z");
    const replay = vi.fn().mockResolvedValue([{ operationId: "operation-1", status: "completed", outcome: "needs_review", appliedFields: [], alreadyAppliedFields: [], conflicts: [{ field: "title", baseValue: "Before", localValue: "Device", serverValue: "Phone" }], record: { id: "task-1", version: 5 } }]);

    await expect(replayQueuedTaskUpdates(store, scope, replay)).resolves.toMatchObject({ completed: 1, needsReview: 1, records: [{ id: "task-1", version: 5 }] });
    await expect(store.listOperations(scope)).resolves.toEqual([]);
    await expect(store.listConflicts(scope)).resolves.toEqual([expect.objectContaining({ localValue: "Device", serverValue: "Phone", state: "needs_review" })]);
  });

  it("keeps retryable and rejected work durable with distinct states", async () => {
    const store = new MemoryPlannerSyncStore();
    await queueTaskUpdate(store, scope, { id: "task-1", version: 1, title: "A" }, { title: "A2" }, "operation-1", "2026-09-12T10:00:00.000Z");
    await queueTaskUpdate(store, scope, { id: "task-2", version: 1, title: "B" }, { title: "B2" }, "operation-2", "2026-09-12T10:01:00.000Z");
    const replay = vi.fn().mockResolvedValue([
      { operationId: "operation-1", status: "retry", code: "concurrent_change" },
      { operationId: "operation-2", status: "rejected", code: "not_found" },
    ]);

    await replayQueuedTaskUpdates(store, scope, replay);
    await expect(store.listOperations(scope)).resolves.toEqual([
      expect.objectContaining({ operationId: "operation-1", state: "retry", attempts: 1 }),
      expect.objectContaining({ operationId: "operation-2", state: "needs_review", attempts: 1 }),
    ]);
  });

  it("keeps the batch retryable when a malformed response arrives", async () => {
    const store = new MemoryPlannerSyncStore();
    await queueTaskUpdate(store, scope, { id: "task-1", version: 1, title: "A" }, { title: "A2" }, "operation-1", "2026-09-12T10:00:00.000Z");
    await expect(replayQueuedTaskUpdates(store, scope, vi.fn().mockResolvedValue(null))).resolves.toMatchObject({ retry: 1 });
    await expect(store.listOperations(scope)).resolves.toEqual([expect.objectContaining({ state: "retry", lastErrorCode: "network" })]);
  });
});
