import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { focusSessionSegments, focusSessions, habits, taskDependencies, tasks, workspaces } from "../drizzle/schema";
import { getDb } from "./db";
import { assertNoOutstandingTaskCommitments, PlannerCapabilityError, PlannerConflictError, PlannerPolicyError, type PlannerScope } from "./planning";
import { incompleteHardPrerequisites } from "../shared/dependencyPolicy";
import { splitFocusInterval } from "./focusTime";

type FocusDatabase = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type FocusTransaction = Parameters<Parameters<FocusDatabase["transaction"]>[0]>[0];
type FocusSession = typeof focusSessions.$inferSelect;

function isActiveFocusTask(task: typeof tasks.$inferSelect | null | undefined): task is typeof tasks.$inferSelect {
  return Boolean(task && !task.archivedAt && task.state !== "completed" && task.state !== "archived" && task.outcome !== "wont_do");
}

/** Explicit established projections keep Focus usable before optional migration 0006. */
export function focusSessionColumns(available: boolean) {
  return {
    id: focusSessions.id, workspaceId: focusSessions.workspaceId, taskId: focusSessions.taskId,
    state: focusSessions.state, startedAt: focusSessions.startedAt, lastResumedAt: focusSessions.lastResumedAt,
    pausedAt: focusSessions.pausedAt, endedAt: focusSessions.endedAt, targetMinutes: focusSessions.targetMinutes,
    activeSeconds: focusSessions.activeSeconds, note: focusSessions.note, outcome: focusSessions.outcome,
    adjustedEstimateMinutes: focusSessions.adjustedEstimateMinutes, createdAt: focusSessions.createdAt,
    updatedAt: focusSessions.updatedAt, version: focusSessions.version,
    habitId: available ? focusSessions.habitId : sql<string | null>`NULL`,
    nextStepAction: available ? focusSessions.nextStepAction : sql<"task" | "plan" | "none" | null>`NULL`,
    nextStepTaskId: available ? focusSessions.nextStepTaskId : sql<string | null>`NULL`,
  };
}

export async function hasFocusFollowupColumns(db: Pick<FocusDatabase, "execute">) {
  try {
    await db.execute(sql`SELECT "habitId", "nextStepAction", "nextStepTaskId" FROM "focusSessions" LIMIT 0`);
    return true;
  } catch (error) {
    // Drizzle wraps PostgreSQL errors; no other column, permission, or connection failure is hidden.
    let cause: unknown = error;
    const seen = new Set<unknown>();
    while (cause && typeof cause === "object" && !seen.has(cause)) {
      seen.add(cause);
      const failure = cause as { code?: string; message?: string; cause?: unknown };
      if (failure.code === "42703" && /column "(?:habitId|nextStepAction|nextStepTaskId)" does not exist/.test(failure.message ?? "")) return false;
      cause = failure.cause;
    }
    throw error;
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Planning data is temporarily unavailable.");
  return db;
}

function secondsSince(value: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000));
}

async function findSession(db: FocusDatabase | FocusTransaction, scope: PlannerScope, id: string, available: boolean) {
  return (await db.select(focusSessionColumns(available)).from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, id))).limit(1))[0];
}

async function casSession(tx: FocusTransaction, scope: PlannerScope, existing: FocusSession, available: boolean, patch: Partial<FocusSession>) {
  const changed = await tx.update(focusSessions).set({ ...patch, updatedAt: new Date(), version: existing.version + 1 })
    .where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, existing.id), eq(focusSessions.version, existing.version)))
    .returning(focusSessionColumns(available));
  if (changed.length !== 1) throw new PlannerConflictError(await findSession(tx, scope, existing.id, available));
  return changed[0]!;
}

async function appendActiveSegments(tx: FocusTransaction, scope: PlannerScope, existing: FocusSession, now: Date) {
  if (!existing.habitId || existing.state !== "active") return;
  const workspace = (await tx.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1).for("share"))[0];
  if (!workspace) throw new Error("Workspace was not found.");
  const buckets = splitFocusInterval(new Date(existing.lastResumedAt), now, workspace.timezone);
  if (buckets.length) await tx.insert(focusSessionSegments).values(buckets.map(bucket => ({ ...bucket, id: nanoid(), workspaceId: scope.workspaceId, focusSessionId: existing.id })));
}

export async function readFocusHabitAttribution(db: FocusDatabase, scope: PlannerScope, range: { start: string; end: string }) {
  return db.select({ habitId: sql<string>`${focusSessions.habitId}`, localDate: focusSessionSegments.localDate,
    timezone: focusSessionSegments.timezone, activeSeconds: sql<number>`sum(${focusSessionSegments.activeSeconds})::integer`.mapWith(Number) })
    .from(focusSessionSegments).innerJoin(focusSessions, and(eq(focusSessions.id, focusSessionSegments.focusSessionId), eq(focusSessions.workspaceId, focusSessionSegments.workspaceId)))
    .where(and(eq(focusSessionSegments.workspaceId, scope.workspaceId), eq(focusSessions.workspaceId, scope.workspaceId), isNotNull(focusSessions.habitId),
      sql`${focusSessionSegments.localDate} >= ${range.start}`, sql`${focusSessionSegments.localDate} <= ${range.end}`))
    .groupBy(focusSessions.habitId, focusSessionSegments.localDate, focusSessionSegments.timezone)
    .orderBy(focusSessionSegments.localDate, focusSessions.habitId, focusSessionSegments.timezone);
}

export async function startFocusSession(scope: PlannerScope, input: { taskId?: string | null; habitId?: string | null; targetMinutes: number }) {
  const db = await requireDb();
  const available = await hasFocusFollowupColumns(db);
  if (input.habitId && !available) throw new PlannerCapabilityError("Habit Focus attribution is available after the Focus follow-up migration. No session was created.");
  return db.transaction(async tx => {
    // Serialize starts for this workspace, then recheck under the lock; no unique-index migration is needed.
    const workspace = (await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1).for("update"))[0];
    if (!workspace) throw new Error("Workspace was not found.");
    const open = (await tx.select(focusSessionColumns(available)).from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), inArray(focusSessions.state, ["active", "paused"]))).orderBy(desc(focusSessions.startedAt)).limit(1))[0];
    if (open) throw new Error("A focus session is already open. Resume, finish, or stop it before starting another.");
    if (input.taskId) {
      const task = (await tx.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.taskId))).limit(1).for("share"))[0];
      if (!isActiveFocusTask(task)) throw new Error("Choose an unfinished task from this workspace for a focus session.");
    }
    if (input.habitId) {
      const habit = (await tx.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.habitId))).limit(1).for("share"))[0];
      if (!habit || habit.archivedAt) throw new Error("Choose an active habit from this workspace for a focus session.");
    }
    const now = new Date();
    const id = nanoid();
    // Drizzle INSERT emits even omitted schema columns as defaults; legacy inserts name only supported columns.
    const habitColumn = available ? sql`, "habitId"` : sql``;
    const habitValue = available ? sql`, ${input.habitId ?? null}` : sql``;
    await tx.execute(sql`INSERT INTO "focusSessions" (id, "workspaceId", "taskId", "targetMinutes", state, "startedAt", "lastResumedAt", "activeSeconds" ${habitColumn})
      VALUES (${id}, ${scope.workspaceId}, ${input.taskId ?? null}, ${input.targetMinutes}, 'active', ${now.toISOString()}, ${now.toISOString()}, 0 ${habitValue})`);
    return (await findSession(tx, scope, id, available))!;
  });
}

export async function pauseFocusSession(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const available = await hasFocusFollowupColumns(db);
  const existing = await findSession(db, scope, input.id, available);
  if (!existing) throw new Error("Focus session was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state !== "active") throw new Error("Only a running focus session can be paused.");
  const now = new Date();
  return db.transaction(async tx => {
    const updated = await casSession(tx, scope, existing, available, { state: "paused", pausedAt: now, activeSeconds: existing.activeSeconds + secondsSince(existing.lastResumedAt, now) });
    await appendActiveSegments(tx, scope, existing, now);
    return updated;
  });
}

export async function resumeFocusSession(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const available = await hasFocusFollowupColumns(db);
  const existing = await findSession(db, scope, input.id, available);
  if (!existing) throw new Error("Focus session was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state !== "paused") throw new Error("Only a paused focus session can be resumed.");
  const now = new Date();
  return db.transaction(tx => casSession(tx, scope, existing, available, { state: "active", pausedAt: null, lastResumedAt: now }));
}

export async function finishFocusSession(scope: PlannerScope, input: { id: string; expectedVersion: number; outcome: "done" | "continue" | "adjust_estimate" | "stopped"; note?: string | null; adjustedEstimateMinutes?: number | null; taskExpectedVersion?: number }) {
  const db = await requireDb();
  const available = await hasFocusFollowupColumns(db);
  const existing = await findSession(db, scope, input.id, available);
  if (!existing) throw new Error("Focus session was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state !== "active" && existing.state !== "paused") throw new Error("This focus session was already finished. Refresh before recording another outcome.");
  if (input.outcome === "adjust_estimate" && (!input.adjustedEstimateMinutes || input.adjustedEstimateMinutes < 5)) throw new Error("Provide a revised Focus time needed of at least 5 minutes.");
  const linkedTask = existing.taskId ? (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, existing.taskId))).limit(1))[0] : null;
  if ((input.outcome === "done" || input.outcome === "adjust_estimate") && !isActiveFocusTask(linkedTask)) throw new Error("This outcome needs a linked active task.");
  if ((input.outcome === "done" || input.outcome === "adjust_estimate") && linkedTask?.version !== input.taskExpectedVersion) throw new PlannerConflictError(linkedTask);
  if (input.outcome === "done" && linkedTask) {
    if (linkedTask.recurrenceRule) throw new PlannerPolicyError("recurring_series", "A recurring series needs dated occurrence resolution before its parent task can be completed in Focus.");
    await assertNoOutstandingTaskCommitments(db, scope, [linkedTask.id]);
    const edges = await db.select().from(taskDependencies).where(and(eq(taskDependencies.workspaceId, scope.workspaceId), eq(taskDependencies.taskId, linkedTask.id)));
    const prerequisiteIds = Array.from(new Set(edges.map(edge => edge.dependsOnTaskId)));
    const prerequisites = prerequisiteIds.length ? await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), inArray(tasks.id, prerequisiteIds))) : [];
    if (incompleteHardPrerequisites(linkedTask.id, edges, prerequisites).length) throw new Error("Complete every hard prerequisite before finishing this task.");
  }
  const now = new Date();
  const activeSeconds = existing.activeSeconds + (existing.state === "active" ? secondsSince(existing.lastResumedAt, now) : 0);
  return db.transaction(async tx => {
    const updated = await casSession(tx, scope, existing, available, { state: input.outcome === "stopped" ? "abandoned" : "completed", endedAt: now, activeSeconds, note: input.note ?? null, outcome: input.outcome, adjustedEstimateMinutes: input.adjustedEstimateMinutes ?? null });
    if (linkedTask && (input.outcome === "done" || input.outcome === "adjust_estimate")) {
      const patch = input.outcome === "done" ? { state: "completed" as const, completedAt: now } : { estimateMinutes: input.adjustedEstimateMinutes! };
      const changed = await tx.update(tasks).set({ ...patch, updatedAt: now, version: linkedTask.version + 1 })
        .where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, linkedTask.id), eq(tasks.version, linkedTask.version))).returning({ id: tasks.id });
      if (changed.length !== 1) throw new PlannerConflictError((await tx.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, linkedTask.id))).limit(1))[0]);
    }
    await appendActiveSegments(tx, scope, existing, now);
    return updated;
  });
}

export async function setFocusFollowUp(scope: PlannerScope, input: { id: string; expectedVersion: number; nextStepAction: "task" | "plan" | "none"; nextStepTaskId?: string | null }) {
  const db = await requireDb();
  const available = await hasFocusFollowupColumns(db);
  if (!available) throw new PlannerCapabilityError("Saved Focus handoffs are available after the Focus follow-up migration. No handoff was changed.");
  const existing = await findSession(db, scope, input.id, available);
  if (!existing) throw new Error("Focus session was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state !== "completed" && existing.state !== "abandoned") throw new Error("A Focus session must be finished before saving its handoff.");
  if (input.nextStepAction === "task" ? !input.nextStepTaskId : input.nextStepTaskId != null) throw new Error("Task handoffs require a task; plan and none handoffs must have no task ID.");
  return db.transaction(async tx => {
    if (input.nextStepAction === "task") {
      // Keep the selected target active until the handoff transaction commits.
      const task = (await tx.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.nextStepTaskId!))).limit(1).for("share"))[0];
      if (!isActiveFocusTask(task)) throw new Error("Choose an active task from this workspace for the handoff.");
    }
    return casSession(tx, scope, existing, available, { nextStepAction: input.nextStepAction, nextStepTaskId: input.nextStepAction === "task" ? input.nextStepTaskId! : null });
  });
}
