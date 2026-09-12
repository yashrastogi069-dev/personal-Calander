import {
  createPlannerOperation,
  type PlannerConflict,
  type PlannerOperation,
  type PlannerSyncScope,
  type PlannerSyncStore,
} from "./offlineSync";

type VersionedTask = Record<string, unknown> & { id: string; version: number };
type TaskPatch = Record<string, unknown>;

type TaskSnapshot = { tasks: Array<Record<string, unknown> & { id: string }> };

export function overlayPendingTaskOperations<T extends TaskSnapshot>(snapshot: T, operations: PlannerOperation[]): T {
  const tasks = snapshot.tasks.map(task => ({ ...task }));
  for (const operation of operations) {
    if (operation.entity !== "task" || operation.state === "needs_review") continue;
    if (operation.kind === "update") {
      const index = tasks.findIndex(task => task.id === operation.entityId);
      if (index >= 0) tasks[index] = { ...tasks[index], ...operation.patch };
      continue;
    }
    if (operation.kind !== "create") continue;
    const requestId = operation.operationId;
    const alreadyPresent = tasks.some(task =>
      task.id === operation.entityId || task.clientRequestId === requestId
    );
    if (alreadyPresent) continue;
    const createdAt = new Date(operation.createdAt);
    tasks.push({
      id: operation.entityId,
      workspaceId: operation.workspaceId,
      clientRequestId: requestId,
      description: null,
      categoryId: null,
      goalId: null,
      projectId: null,
      parentTaskId: null,
      dueLocalDate: null,
      scheduledLocalDate: null,
      plannedStartAt: null,
      plannedEndAt: null,
      estimateMinutes: null,
      recurrenceRule: null,
      recurrenceAnchor: null,
      recurrenceUntilLocalDate: null,
      completedAt: null,
      archivedAt: null,
      outcome: "none",
      outcomeAt: null,
      rescheduleCount: 0,
      createdAt,
      updatedAt: createdAt,
      version: 1,
      ...operation.patch,
    });
  }
  return { ...snapshot, tasks };
}

type ReplayCompleted = {
  operationId: string;
  status: "completed";
  outcome: "applied" | "already_applied" | "needs_review";
  appliedFields: string[];
  alreadyAppliedFields: string[];
  conflicts: Array<{ field: string; baseValue: unknown; localValue: unknown; serverValue: unknown }>;
  record: Record<string, unknown> & { version: number };
};
type ReplayRetry = { operationId: string; status: "retry"; code: string };
type ReplayRejected = { operationId: string; status: "rejected"; code: string };
export type TaskReplayResult = ReplayCompleted | ReplayRetry | ReplayRejected;
export type TaskReplayOperation = {
  operationId: string;
  entity: "task";
  entityId: string;
  kind: "update" | "create";
  baseVersion: number | null;
  baseValues: Record<string, unknown>;
  patch: Record<string, unknown>;
  createdAt: string;
};
export type TaskReplay = (operations: TaskReplayOperation[]) => Promise<TaskReplayResult[]>;

function operationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `operation-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function queueTaskUpdate(
  store: PlannerSyncStore,
  scope: PlannerSyncScope,
  task: VersionedTask,
  patch: TaskPatch,
  id = operationId(),
  createdAt = new Date().toISOString(),
) {
  const baseValues = Object.fromEntries(Object.keys(patch).map(field => [field, task[field]]));
  const operation = createPlannerOperation(scope, {
    operationId: id,
    entity: "task",
    entityId: task.id,
    kind: "update",
    baseVersion: task.version,
    baseValues,
    patch,
    createdAt,
  });
  await store.enqueue(operation);
  return operation;
}

export async function queueTaskCreate(
  store: PlannerSyncStore,
  scope: PlannerSyncScope,
  patch: TaskPatch,
  id = operationId(),
  createdAt = new Date().toISOString(),
) {
  const operation = createPlannerOperation(scope, {
    operationId: id,
    entity: "task",
    entityId: `offline:${id}`,
    kind: "create",
    baseVersion: null,
    baseValues: {},
    patch,
    createdAt,
  });
  await store.enqueue(operation);
  return operation;
}

function replayInput(operation: PlannerOperation & { entity: "task"; kind: "update" | "create" }): TaskReplayOperation {
  const { accountId: _accountId, workspaceId: _workspaceId, state: _state, attempts: _attempts, lastErrorCode: _lastErrorCode, ...input } = operation;
  return input;
}

export async function replayQueuedTaskUpdates(store: PlannerSyncStore, scope: PlannerSyncScope, replay: TaskReplay) {
  const operations = (await store.listOperations(scope)).filter((operation): operation is PlannerOperation & { entity: "task"; kind: "update" | "create" } => operation.entity === "task" && (operation.kind === "update" ? operation.baseVersion !== null : operation.kind === "create" && operation.baseVersion === null) && operation.state !== "needs_review").slice(0, 25);
  if (!operations.length) return { completed: 0, needsReview: 0, retry: 0, records: [] as Record<string, unknown>[] };

  let results: TaskReplayResult[];
  try {
    results = await replay(operations.map(replayInput));
    if (!Array.isArray(results)) throw new Error("Synchronization returned an invalid response.");
  } catch {
    await Promise.all(operations.map(operation => store.markOperation(scope, operation.operationId, "retry", "network")));
    return { completed: 0, needsReview: 0, retry: operations.length, records: [] as Record<string, unknown>[] };
  }

  const operationById = new Map(operations.map(operation => [operation.operationId, operation]));
  const records: Record<string, unknown>[] = [];
  let completed = 0;
  let needsReview = 0;
  let retry = 0;

  for (const result of results) {
    const operation = operationById.get(result.operationId);
    if (!operation) continue;
    if (result.status === "retry") {
      await store.markOperation(scope, result.operationId, "retry", result.code);
      retry += 1;
      continue;
    }
    if (result.status === "rejected") {
      await store.markOperation(scope, result.operationId, "needs_review", result.code);
      needsReview += 1;
      continue;
    }
    const serverVersion = result.record.version;
    for (const conflict of result.conflicts) {
      const retained: PlannerConflict = {
        ...scope,
        conflictId: `${result.operationId}:${conflict.field}`,
        operationId: result.operationId,
        entity: "task",
        entityId: operation.entityId,
        field: conflict.field,
        baseValue: conflict.baseValue,
        localValue: conflict.localValue,
        serverValue: conflict.serverValue,
        serverVersion,
        createdAt: new Date().toISOString(),
        state: "needs_review",
      };
      await store.putConflict(retained);
    }
    await store.acknowledge(scope, result.operationId);
    records.push(result.record);
    completed += 1;
    if (result.outcome === "needs_review") needsReview += 1;
  }
  return { completed, needsReview, retry, records };
}
