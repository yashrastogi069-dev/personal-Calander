import { and, desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { focusSessions, taskDependencies, tasks } from "../drizzle/schema";
import { getDb } from "./db";
import { PlannerConflictError, type PlannerScope } from "./planning";
import { incompleteHardPrerequisites } from "../shared/dependencyPolicy";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Planning data is temporarily unavailable.");
  return db;
}

function secondsSince(value: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000));
}

export async function startFocusSession(scope: PlannerScope, input: { taskId?: string | null; targetMinutes: number }) {
  const db = await requireDb();
  const open = (await db.select().from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), inArray(focusSessions.state, ["active", "paused"]))).orderBy(desc(focusSessions.startedAt)).limit(1))[0];
  if (open) throw new Error("A focus session is already open. Resume, finish, or stop it before starting another.");
  if (input.taskId) {
    const task = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.taskId))).limit(1))[0];
    if (!task || task.state === "completed" || task.state === "archived") throw new Error("Choose an unfinished task from this workspace for a focus session.");
  }
  const now = new Date();
  const id = nanoid();
  await db.insert(focusSessions).values({ id, workspaceId: scope.workspaceId, taskId: input.taskId ?? null, targetMinutes: input.targetMinutes, state: "active", startedAt: now, lastResumedAt: now, activeSeconds: 0 });
  return (await db.select().from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, id))).limit(1))[0]!;
}

export async function pauseFocusSession(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Focus session was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state !== "active") throw new Error("Only a running focus session can be paused.");
  const now = new Date();
  await db.update(focusSessions).set({ state: "paused", pausedAt: now, activeSeconds: existing.activeSeconds + secondsSince(existing.lastResumedAt, now), version: existing.version + 1 }).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, existing.id), eq(focusSessions.version, existing.version)));
  return (await db.select().from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, existing.id))).limit(1))[0]!;
}

export async function resumeFocusSession(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Focus session was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state !== "paused") throw new Error("Only a paused focus session can be resumed.");
  const now = new Date();
  await db.update(focusSessions).set({ state: "active", pausedAt: null, lastResumedAt: now, version: existing.version + 1 }).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, existing.id), eq(focusSessions.version, existing.version)));
  return (await db.select().from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, existing.id))).limit(1))[0]!;
}

export async function finishFocusSession(scope: PlannerScope, input: { id: string; expectedVersion: number; outcome: "done" | "continue" | "adjust_estimate" | "stopped"; note?: string | null; adjustedEstimateMinutes?: number | null; taskExpectedVersion?: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Focus session was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state !== "active" && existing.state !== "paused") throw new Error("This focus session was already finished. Refresh before recording another outcome.");
  if (input.outcome === "adjust_estimate" && (!input.adjustedEstimateMinutes || input.adjustedEstimateMinutes < 5)) throw new Error("Provide a revised Focus time needed of at least 5 minutes.");
  const linkedTask = existing.taskId ? (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, existing.taskId))).limit(1))[0] : null;
  if ((input.outcome === "done" || input.outcome === "adjust_estimate") && !linkedTask) throw new Error("This outcome needs a linked active task.");
  if ((input.outcome === "done" || input.outcome === "adjust_estimate") && linkedTask?.version !== input.taskExpectedVersion) throw new PlannerConflictError(linkedTask);
  if (input.outcome === "done" && linkedTask) {
    const edges = await db.select().from(taskDependencies).where(and(eq(taskDependencies.workspaceId, scope.workspaceId), eq(taskDependencies.taskId, linkedTask.id)));
    const prerequisiteIds = Array.from(new Set(edges.map(edge => edge.dependsOnTaskId)));
    const prerequisites = prerequisiteIds.length ? await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), inArray(tasks.id, prerequisiteIds))) : [];
    if (incompleteHardPrerequisites(linkedTask.id, edges, prerequisites).length) throw new Error("Complete every hard prerequisite before finishing this task.");
  }
  const now = new Date();
  const activeSeconds = existing.activeSeconds + (existing.state === "active" ? secondsSince(existing.lastResumedAt, now) : 0);
  await db.transaction(async tx => {
    if (linkedTask && input.outcome === "done") await tx.update(tasks).set({ state: "completed", completedAt: now, version: linkedTask.version + 1 }).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, linkedTask.id), eq(tasks.version, linkedTask.version)));
    if (linkedTask && input.outcome === "adjust_estimate") await tx.update(tasks).set({ estimateMinutes: input.adjustedEstimateMinutes!, version: linkedTask.version + 1 }).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, linkedTask.id), eq(tasks.version, linkedTask.version)));
    await tx.update(focusSessions).set({ state: input.outcome === "stopped" ? "abandoned" : "completed", endedAt: now, activeSeconds, note: input.note ?? null, outcome: input.outcome, adjustedEstimateMinutes: input.adjustedEstimateMinutes ?? null, version: existing.version + 1 }).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, existing.id), eq(focusSessions.version, existing.version)));
  });
  const updated = (await db.select().from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), eq(focusSessions.id, existing.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}
