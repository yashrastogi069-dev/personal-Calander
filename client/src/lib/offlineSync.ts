export type PlannerSyncScope = {
  accountId: string;
  workspaceId: string;
};

export const plannerSyncEntities = [
  "workspace", "category", "goal", "milestone", "project", "task", "habit",
  "habit_check_in", "saved_view", "daily_check_in", "daily_plan", "daily_plan_item",
  "weekly_objective", "planning_template", "review", "dependency", "availability",
] as const;

export type PlannerSyncEntity = typeof plannerSyncEntities[number];
export type PlannerOperationKind = "create" | "update" | "archive" | "restore" | "tombstone" | "resolve_conflict";
export type PlannerOperationState = "pending" | "retry" | "needs_review";

export type PlannerOperation = PlannerSyncScope & {
  operationId: string;
  entity: PlannerSyncEntity;
  entityId: string;
  kind: PlannerOperationKind;
  baseVersion: number | null;
  baseValues: Record<string, unknown>;
  patch: Record<string, unknown>;
  createdAt: string;
  state: PlannerOperationState;
  attempts: number;
  lastErrorCode: string | null;
};

export type PlannerConflict = PlannerSyncScope & {
  conflictId: string;
  operationId: string;
  entity: PlannerSyncEntity;
  entityId: string;
  field: string;
  baseValue: unknown;
  localValue: unknown;
  serverValue: unknown;
  serverVersion: number;
  createdAt: string;
  state: "needs_review";
};

export type PlannerSnapshotRecord = PlannerSyncScope & {
  key: string;
  scopeKey: string;
  rangeStart: string;
  rangeEnd: string;
  schemaVersion: 1;
  fetchedAt: string;
  snapshot: unknown;
};

type NewPlannerOperation = Omit<PlannerOperation, keyof PlannerSyncScope | "state" | "attempts" | "lastErrorCode">;

function nonEmpty(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} is required.`);
  return value;
}

function cloneValue<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

export function plannerScopeKey(scope: PlannerSyncScope) {
  return `${nonEmpty(scope.accountId, "Account ID")}::${nonEmpty(scope.workspaceId, "Workspace ID")}`;
}

function snapshotKey(scope: PlannerSyncScope, rangeStart: string, rangeEnd: string) {
  return `${plannerScopeKey(scope)}::${nonEmpty(rangeStart, "Range start")}::${nonEmpty(rangeEnd, "Range end")}`;
}

function scopedItemKey(scope: PlannerSyncScope, id: string) {
  return `${plannerScopeKey(scope)}::${nonEmpty(id, "Item ID")}`;
}

export function createPlannerOperation(scope: PlannerSyncScope, input: NewPlannerOperation): PlannerOperation {
  if (!plannerSyncEntities.includes(input.entity)) throw new Error("Unsupported planner entity.");
  if (!Number.isInteger(input.baseVersion ?? 0) || (input.baseVersion ?? 0) < 0) throw new Error("Base version must be a positive integer or null.");
  if (!Object.keys(input.patch).length && input.kind !== "archive" && input.kind !== "restore" && input.kind !== "tombstone") {
    throw new Error("An operation patch cannot be empty.");
  }
  return cloneValue({
    ...scope,
    ...input,
    operationId: nonEmpty(input.operationId, "Operation ID"),
    entityId: nonEmpty(input.entityId, "Entity ID"),
    state: "pending" as const,
    attempts: 0,
    lastErrorCode: null,
  });
}

function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify({ $date: value.toISOString() });
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function valuesEqual(left: unknown, right: unknown) {
  return Object.is(left, right) || canonical(left) === canonical(right);
}

export function classifyFieldMerge(input: { base: unknown; local: unknown; server: unknown }):
  | { kind: "apply_local"; value: unknown }
  | { kind: "already_applied"; value: unknown }
  | { kind: "conflict"; base: unknown; local: unknown; server: unknown } {
  if (valuesEqual(input.local, input.server)) return { kind: "already_applied", value: cloneValue(input.server) };
  if (valuesEqual(input.base, input.server)) return { kind: "apply_local", value: cloneValue(input.local) };
  return { kind: "conflict", base: cloneValue(input.base), local: cloneValue(input.local), server: cloneValue(input.server) };
}

export interface PlannerSyncStore {
  putSnapshot(scope: PlannerSyncScope, rangeStart: string, rangeEnd: string, snapshot: unknown, fetchedAt?: string): Promise<void>;
  getSnapshot(scope: PlannerSyncScope, rangeStart: string, rangeEnd: string): Promise<PlannerSnapshotRecord | null>;
  enqueue(operation: PlannerOperation): Promise<void>;
  listOperations(scope: PlannerSyncScope): Promise<PlannerOperation[]>;
  acknowledge(scope: PlannerSyncScope, operationId: string): Promise<void>;
  putConflict(conflict: PlannerConflict): Promise<void>;
  listConflicts(scope: PlannerSyncScope): Promise<PlannerConflict[]>;
}

export class MemoryPlannerSyncStore implements PlannerSyncStore {
  private snapshots = new Map<string, PlannerSnapshotRecord>();
  private operations = new Map<string, PlannerOperation>();
  private conflicts = new Map<string, PlannerConflict>();

  async putSnapshot(scope: PlannerSyncScope, rangeStart: string, rangeEnd: string, snapshot: unknown, fetchedAt = new Date().toISOString()) {
    const key = snapshotKey(scope, rangeStart, rangeEnd);
    this.snapshots.set(key, cloneValue({ ...scope, key, scopeKey: plannerScopeKey(scope), rangeStart, rangeEnd, schemaVersion: 1 as const, fetchedAt, snapshot }));
  }

  async getSnapshot(scope: PlannerSyncScope, rangeStart: string, rangeEnd: string) {
    const value = this.snapshots.get(snapshotKey(scope, rangeStart, rangeEnd));
    return value ? cloneValue(value) : null;
  }

  async enqueue(operation: PlannerOperation) {
    const key = scopedItemKey(operation, operation.operationId);
    if (!this.operations.has(key)) this.operations.set(key, cloneValue(operation));
  }

  async listOperations(scope: PlannerSyncScope) {
    const scopeKey = plannerScopeKey(scope);
    return Array.from(this.operations.values())
      .filter(item => plannerScopeKey(item) === scopeKey)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(cloneValue);
  }

  async acknowledge(scope: PlannerSyncScope, operationId: string) {
    this.operations.delete(scopedItemKey(scope, operationId));
  }

  async putConflict(conflict: PlannerConflict) {
    this.conflicts.set(scopedItemKey(conflict, conflict.conflictId), cloneValue(conflict));
  }

  async listConflicts(scope: PlannerSyncScope) {
    const scopeKey = plannerScopeKey(scope);
    return Array.from(this.conflicts.values())
      .filter(item => plannerScopeKey(item) === scopeKey)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(cloneValue);
  }
}

type StoredOperation = PlannerOperation & { key: string; scopeKey: string };
type StoredConflict = PlannerConflict & { key: string; scopeKey: string };

export class IndexedDbPlannerSyncStore implements PlannerSyncStore {
  private database: Promise<IDBDatabase> | null = null;

  private open() {
    if (this.database) return this.database;
    this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open("personal-calander-planner-v1", 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("snapshots")) db.createObjectStore("snapshots", { keyPath: "key" }).createIndex("scopeKey", "scopeKey");
        if (!db.objectStoreNames.contains("operations")) db.createObjectStore("operations", { keyPath: "key" }).createIndex("scopeKey", "scopeKey");
        if (!db.objectStoreNames.contains("conflicts")) db.createObjectStore("conflicts", { keyPath: "key" }).createIndex("scopeKey", "scopeKey");
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Offline planner storage could not open."));
      request.onblocked = () => reject(new Error("Offline planner storage upgrade is blocked by another open tab."));
    });
    return this.database;
  }

  private async request<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Offline planner storage request failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Offline planner storage transaction was aborted."));
    });
  }

  async putSnapshot(scope: PlannerSyncScope, rangeStart: string, rangeEnd: string, snapshot: unknown, fetchedAt = new Date().toISOString()) {
    const key = snapshotKey(scope, rangeStart, rangeEnd);
    const record: PlannerSnapshotRecord = { ...scope, key, scopeKey: plannerScopeKey(scope), rangeStart, rangeEnd, schemaVersion: 1, fetchedAt, snapshot: cloneValue(snapshot) };
    await this.request("snapshots", "readwrite", store => store.put(record));
  }

  async getSnapshot(scope: PlannerSyncScope, rangeStart: string, rangeEnd: string) {
    const value = await this.request<PlannerSnapshotRecord | undefined>("snapshots", "readonly", store => store.get(snapshotKey(scope, rangeStart, rangeEnd)));
    return value ? cloneValue(value) : null;
  }

  async enqueue(operation: PlannerOperation) {
    const key = scopedItemKey(operation, operation.operationId);
    const existing = await this.request<StoredOperation | undefined>("operations", "readonly", store => store.get(key));
    if (existing) return;
    const record: StoredOperation = { ...cloneValue(operation), key, scopeKey: plannerScopeKey(operation) };
    await this.request("operations", "readwrite", store => store.add(record));
  }

  async listOperations(scope: PlannerSyncScope) {
    const records = await this.request<StoredOperation[]>("operations", "readonly", store => store.index("scopeKey").getAll(plannerScopeKey(scope)));
    return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map(({ key: _key, scopeKey: _scopeKey, ...item }) => cloneValue(item));
  }

  async acknowledge(scope: PlannerSyncScope, operationId: string) {
    await this.request("operations", "readwrite", store => store.delete(scopedItemKey(scope, operationId)));
  }

  async putConflict(conflict: PlannerConflict) {
    const record: StoredConflict = { ...cloneValue(conflict), key: scopedItemKey(conflict, conflict.conflictId), scopeKey: plannerScopeKey(conflict) };
    await this.request("conflicts", "readwrite", store => store.put(record));
  }

  async listConflicts(scope: PlannerSyncScope) {
    const records = await this.request<StoredConflict[]>("conflicts", "readonly", store => store.index("scopeKey").getAll(plannerScopeKey(scope)));
    return records.sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map(({ key: _key, scopeKey: _scopeKey, ...item }) => cloneValue(item));
  }
}

let browserStore: IndexedDbPlannerSyncStore | null = null;

export function getBrowserPlannerSyncStore(): PlannerSyncStore | null {
  if (typeof window === "undefined" || !("indexedDB" in window)) return null;
  browserStore ??= new IndexedDbPlannerSyncStore();
  return browserStore;
}
