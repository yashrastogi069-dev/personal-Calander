import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { syncConflicts, syncOperationReceipts, tasks } from "../drizzle/schema";
import { mergeOperationPatch } from "../shared/syncMerge";
import { getDb } from "./db";
import { updateTask, type PlannerScope } from "./planning";

export type SyncTaskUpdateOperation = {
  operationId: string;
  entity: "task";
  entityId: string;
  kind: "update";
  baseVersion: number;
  baseValues: Record<string, unknown>;
  patch: Record<string, unknown>;
  createdAt: string;
};

export type SyncConflictValue = {
  field: string;
  baseValue: unknown;
  localValue: unknown;
  serverValue: unknown;
};

export type SyncOperationResult = {
  operationId: string;
  outcome: "applied" | "already_applied" | "needs_review";
  appliedFields: string[];
  alreadyAppliedFields: string[];
  conflicts: SyncConflictValue[];
  record: Record<string, unknown> & { version: number };
};

type TaskRecord = Record<string, unknown> & { id: string; workspaceId: string; version: number };
type TaskUpdateInput = Parameters<typeof updateTask>[1];

export type SyncDependencies = {
  findReceipt(scope: PlannerScope, operationId: string): Promise<SyncOperationResult | null>;
  findTask(scope: PlannerScope, entityId: string): Promise<TaskRecord | null>;
  updateTask(scope: PlannerScope, input: TaskUpdateInput): Promise<TaskRecord>;
  saveConflicts(scope: PlannerScope, operation: SyncTaskUpdateOperation, serverVersion: number, conflicts: SyncConflictValue[]): Promise<void>;
  saveReceipt(scope: PlannerScope, operation: SyncTaskUpdateOperation, result: SyncOperationResult): Promise<SyncOperationResult>;
};

const taskPatchFields = new Set([
  "title", "description", "state", "priority", "horizon", "dueLocalDate", "scheduledLocalDate",
  "plannedStartAt", "plannedEndAt", "estimateMinutes", "scheduleMode", "categoryId", "goalId", "projectId",
  "parentTaskId", "sortOrder", "recurrenceRule", "recurrenceAnchor", "recurrenceUntilLocalDate",
]);

function assertTaskOperation(operation: SyncTaskUpdateOperation) {
  if (!operation.operationId || !operation.entityId) throw new Error("Operation and entity IDs are required.");
  if (!Number.isInteger(operation.baseVersion) || operation.baseVersion < 1) throw new Error("A positive base version is required.");
  const fields = Object.keys(operation.patch);
  if (!fields.length) throw new Error("The task patch cannot be empty.");
  for (const field of fields) {
    if (!taskPatchFields.has(field)) throw new Error(`Unsupported task field: ${field}`);
    if (!Object.prototype.hasOwnProperty.call(operation.baseValues, field)) throw new Error(`Base value is required for task field: ${field}`);
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Planning data is temporarily unavailable.");
  return db;
}

const databaseDependencies: SyncDependencies = {
  async findReceipt(scope, operationId) {
    const db = await requireDb();
    const row = (await db.select().from(syncOperationReceipts).where(and(eq(syncOperationReceipts.workspaceId, scope.workspaceId), eq(syncOperationReceipts.operationId, operationId))).limit(1))[0];
    return row ? row.result as SyncOperationResult : null;
  },
  async findTask(scope, entityId) {
    const db = await requireDb();
    return (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, entityId))).limit(1))[0] ?? null;
  },
  async updateTask(scope, input) {
    return updateTask(scope, input);
  },
  async saveConflicts(scope, operation, serverVersion, conflicts) {
    if (!conflicts.length) return;
    const db = await requireDb();
    await db.insert(syncConflicts).values(conflicts.map(conflict => ({
      id: nanoid(),
      workspaceId: scope.workspaceId,
      operationId: operation.operationId,
      entity: operation.entity,
      entityId: operation.entityId,
      field: conflict.field,
      baseValue: conflict.baseValue === undefined ? null : conflict.baseValue,
      localValue: conflict.localValue === undefined ? null : conflict.localValue,
      serverValue: conflict.serverValue === undefined ? null : conflict.serverValue,
      serverVersion,
    }))).onConflictDoNothing();
  },
  async saveReceipt(scope, operation, result) {
    const db = await requireDb();
    await db.insert(syncOperationReceipts).values({
      id: nanoid(),
      workspaceId: scope.workspaceId,
      operationId: operation.operationId,
      entity: operation.entity,
      entityId: operation.entityId,
      kind: operation.kind,
      outcome: result.outcome,
      result,
    }).onConflictDoNothing();
    const receipt = (await db.select().from(syncOperationReceipts).where(and(eq(syncOperationReceipts.workspaceId, scope.workspaceId), eq(syncOperationReceipts.operationId, operation.operationId))).limit(1))[0];
    if (!receipt) throw new Error("The synchronization receipt could not be stored.");
    return receipt.result as SyncOperationResult;
  },
};

export async function processTaskUpdateOperation(scope: PlannerScope, operation: SyncTaskUpdateOperation, dependencies: SyncDependencies = databaseDependencies) {
  assertTaskOperation(operation);
  const receipt = await dependencies.findReceipt(scope, operation.operationId);
  if (receipt) return receipt;

  const current = await dependencies.findTask(scope, operation.entityId);
  if (!current) throw new Error("Task was not found in this workspace.");
  const merge = mergeOperationPatch({ baseValues: operation.baseValues, patch: operation.patch, server: current });
  let record = current;

  if (Object.keys(merge.safePatch).length) {
    record = await dependencies.updateTask(scope, {
      id: operation.entityId,
      expectedVersion: current.version,
      patch: merge.safePatch as TaskUpdateInput["patch"],
    });
  }
  await dependencies.saveConflicts(scope, operation, record.version, merge.conflicts);

  const outcome = merge.conflicts.length
    ? "needs_review"
    : Object.keys(merge.safePatch).length
      ? "applied"
      : "already_applied";
  const result: SyncOperationResult = {
    operationId: operation.operationId,
    outcome,
    appliedFields: Object.keys(merge.safePatch),
    alreadyAppliedFields: merge.alreadyApplied,
    conflicts: merge.conflicts,
    record,
  };
  return dependencies.saveReceipt(scope, operation, result);
}
