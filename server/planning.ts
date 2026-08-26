import { and, asc, desc, eq, gte, inArray, lte, ne, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import webpush from "web-push";
import {
  calendarFeeds,
  categories,
  dailyCheckIns,
  externalEvents,
  goalMilestones,
  goals,
  habitCheckIns,
  habits,
  projects,
  pushDeliveries,
  pushSubscriptions,
  reminderRules,
  reminderSchedulers,
  reviewSessions,
  savedViews,
  taskDependencies,
  taskOccurrences,
  tasks,
  workspaces,
} from "../drizzle/schema";
import { getDb } from "./db";
import { dashboardSummary, recurringLocalDates, type RecurrenceRule, wouldCreateDependencyCycle } from "./plannerRules";
import { reminderDueAt, type ReminderSchedule } from "./reminderSchedule";
import { getVapidConfigurationFromEnvironment, validateVapidConfiguration } from "./vapidConfig";

export type PlannerScope = {
  workspaceId: string;
  timezone: string;
};

export class PlannerConflictError extends Error {
  constructor(public current: unknown) {
    super("This item changed elsewhere. Refresh before applying your edit.");
  }
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Planning data is temporarily unavailable.");
  return db;
}

export async function ensureWorkspace(scope: PlannerScope) {
  const db = await requireDb();
  const current = await db.select().from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1);
  if (current[0]) return current[0];

  await db.insert(workspaces).values({
    id: scope.workspaceId,
    timezone: scope.timezone,
  });
  return (await db.select().from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1))[0]!;
}

export async function updateWorkspace(scope: PlannerScope, input: { name?: string; timezone?: string; weekStartsOn?: number; dailyCapacityMinutes?: number; planningDayStartsAt?: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1))[0];
  if (!existing) throw new Error("Workspace was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db
    .update(workspaces)
    .set({ ...input, version: input.expectedVersion + 1 })
    .where(and(eq(workspaces.id, scope.workspaceId), eq(workspaces.version, input.expectedVersion)));
  return (await db.select().from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1))[0]!;
}

export async function getWorkspaceSnapshot(scope: PlannerScope, range: { start: string; end: string }) {
  const db = await requireDb();
  const workspace = await ensureWorkspace(scope);
  const [categoryRows, goalRows, milestoneRows, projectRows, taskRows, habitRows, checkInRows, savedViewRows, eventRows, dailyRows, occurrenceRows, reviewRows] = await Promise.all([
    db.select().from(categories).where(eq(categories.workspaceId, scope.workspaceId)).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select().from(goals).where(eq(goals.workspaceId, scope.workspaceId)).orderBy(desc(goals.updatedAt)),
    db.select().from(goalMilestones).where(eq(goalMilestones.workspaceId, scope.workspaceId)).orderBy(asc(goalMilestones.dueLocalDate), desc(goalMilestones.updatedAt)),
    db.select().from(projects).where(eq(projects.workspaceId, scope.workspaceId)).orderBy(desc(projects.updatedAt)),
    db.select().from(tasks).where(eq(tasks.workspaceId, scope.workspaceId)).orderBy(asc(tasks.sortOrder), desc(tasks.updatedAt)),
    db.select().from(habits).where(eq(habits.workspaceId, scope.workspaceId)).orderBy(desc(habits.updatedAt)),
    db.select().from(habitCheckIns).where(and(eq(habitCheckIns.workspaceId, scope.workspaceId), gte(habitCheckIns.localDate, range.start), lte(habitCheckIns.localDate, range.end))),
    db.select().from(savedViews).where(eq(savedViews.workspaceId, scope.workspaceId)).orderBy(desc(savedViews.isPinned), asc(savedViews.name)),
    db.select().from(externalEvents).where(and(eq(externalEvents.workspaceId, scope.workspaceId), gte(externalEvents.startsAt, new Date(`${range.start}T00:00:00.000Z`)), lte(externalEvents.startsAt, new Date(`${range.end}T23:59:59.999Z`)))).orderBy(asc(externalEvents.startsAt)),
    db.select().from(dailyCheckIns).where(and(eq(dailyCheckIns.workspaceId, scope.workspaceId), gte(dailyCheckIns.localDate, range.start), lte(dailyCheckIns.localDate, range.end))),
    db.select().from(taskOccurrences).where(and(eq(taskOccurrences.workspaceId, scope.workspaceId), gte(taskOccurrences.localDate, range.start), lte(taskOccurrences.localDate, range.end))).orderBy(asc(taskOccurrences.localDate)),
    db.select().from(reviewSessions).where(and(eq(reviewSessions.workspaceId, scope.workspaceId), gte(reviewSessions.periodEndLocalDate, range.start), lte(reviewSessions.periodStartLocalDate, range.end))).orderBy(desc(reviewSessions.createdAt)),
  ]);
  return { workspace, categories: categoryRows, goals: goalRows, milestones: milestoneRows, projects: projectRows, tasks: taskRows, habits: habitRows, habitCheckIns: checkInRows, savedViews: savedViewRows, externalEvents: eventRows, dailyCheckIns: dailyRows, taskOccurrences: occurrenceRows, reviewSessions: reviewRows };
}

export async function createCategory(scope: PlannerScope, input: { name: string; color: string; sortOrder?: number }) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(categories).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(categories).where(and(eq(categories.workspaceId, scope.workspaceId), eq(categories.id, id))).limit(1))[0]!;
}

export async function updateCategory(scope: PlannerScope, input: { id: string; expectedVersion: number; patch: { name?: string; color?: string; sortOrder?: number } }) {
  const db = await requireDb();
  const existing = (await db.select().from(categories).where(and(eq(categories.workspaceId, scope.workspaceId), eq(categories.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Category was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(categories).set({ ...input.patch, version: input.expectedVersion + 1 }).where(and(eq(categories.workspaceId, scope.workspaceId), eq(categories.id, input.id), eq(categories.version, input.expectedVersion)));
  const updated = (await db.select().from(categories).where(and(eq(categories.workspaceId, scope.workspaceId), eq(categories.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

/** Deletes only the category label and detaches it from planner records in this workspace. */
export async function deleteCategory(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(categories).where(and(eq(categories.workspaceId, scope.workspaceId), eq(categories.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Category was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.transaction(async tx => {
    await Promise.all([
      tx.update(tasks).set({ categoryId: null }).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.categoryId, input.id))),
      tx.update(goals).set({ categoryId: null }).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.categoryId, input.id))),
      tx.update(projects).set({ categoryId: null }).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.categoryId, input.id))),
      tx.update(habits).set({ categoryId: null }).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.categoryId, input.id))),
    ]);
    await tx.delete(categories).where(and(eq(categories.workspaceId, scope.workspaceId), eq(categories.id, input.id), eq(categories.version, input.expectedVersion)));
  });
  return { id: input.id, detachedRecords: true, deleted: true } as const;
}

export async function createGoal(scope: PlannerScope, input: Omit<typeof goals.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt" | "version" | "completedAt" | "archivedAt">) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(goals).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, id))).limit(1))[0]!;
}

export async function archiveGoal(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Goal was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(goals).set({ state: "archived", archivedAt: new Date(), version: input.expectedVersion + 1 }).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id), eq(goals.version, input.expectedVersion)));
  const updated = (await db.select().from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

/** Restores an archived goal as unfinished work while preserving every linked history record. */
export async function restoreGoal(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Goal was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(goals).set({ state: "not_started", completedAt: null, archivedAt: null, version: input.expectedVersion + 1 }).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id), eq(goals.version, input.expectedVersion)));
  const updated = (await db.select().from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function createGoalMilestone(scope: PlannerScope, input: Omit<typeof goalMilestones.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt" | "version" | "completedAt" | "archivedAt">) {
  const db = await requireDb();
  const goal = (await db.select({ id: goals.id }).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.goalId))).limit(1))[0];
  if (!goal) throw new Error("A milestone must belong to a goal in this workspace.");
  const id = nanoid();
  await db.insert(goalMilestones).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(goalMilestones).where(and(eq(goalMilestones.workspaceId, scope.workspaceId), eq(goalMilestones.id, id))).limit(1))[0]!;
}

export async function updateGoalMilestone(scope: PlannerScope, input: { id: string; expectedVersion: number; patch: Partial<typeof goalMilestones.$inferInsert> }) {
  const db = await requireDb();
  const existing = (await db.select().from(goalMilestones).where(and(eq(goalMilestones.workspaceId, scope.workspaceId), eq(goalMilestones.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Milestone was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  const patch = { ...input.patch, version: input.expectedVersion + 1 } as Record<string, unknown>;
  if (patch.state === "completed" && !existing.completedAt) patch.completedAt = new Date();
  if (patch.state && patch.state !== "completed") patch.completedAt = null;
  if (patch.state === "archived") patch.archivedAt = new Date();
  await db.update(goalMilestones).set(patch).where(and(eq(goalMilestones.workspaceId, scope.workspaceId), eq(goalMilestones.id, input.id), eq(goalMilestones.version, input.expectedVersion)));
  const updated = (await db.select().from(goalMilestones).where(and(eq(goalMilestones.workspaceId, scope.workspaceId), eq(goalMilestones.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function archiveGoalMilestone(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  return updateGoalMilestone(scope, { id: input.id, expectedVersion: input.expectedVersion, patch: { state: "archived" } });
}

export async function createProject(scope: PlannerScope, input: Omit<typeof projects.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt" | "version" | "completedAt" | "archivedAt">) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(projects).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, id))).limit(1))[0]!;
}

export async function archiveProject(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Project was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(projects).set({ state: "archived", archivedAt: new Date(), version: input.expectedVersion + 1 }).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id), eq(projects.version, input.expectedVersion)));
  const updated = (await db.select().from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

/** Restores an archived project as unfinished work while retaining linked task history. */
export async function restoreProject(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Project was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(projects).set({ state: "not_started", completedAt: null, archivedAt: null, version: input.expectedVersion + 1 }).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id), eq(projects.version, input.expectedVersion)));
  const updated = (await db.select().from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function createTask(scope: PlannerScope, input: Omit<typeof tasks.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt" | "version" | "completedAt" | "archivedAt">) {
  const db = await requireDb();
  if (input.clientRequestId) {
    const existing = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.clientRequestId, input.clientRequestId))).limit(1))[0];
    if (existing) return existing;
  }
  const id = nanoid();
  try {
    await db.insert(tasks).values({ id, workspaceId: scope.workspaceId, ...input });
  } catch (error) {
    if (input.clientRequestId) {
      const existing = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.clientRequestId, input.clientRequestId))).limit(1))[0];
      if (existing) return existing;
    }
    throw error;
  }
  return (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, id))).limit(1))[0]!;
}

function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Record<string, unknown>;
  return rule.frequency === "daily" || rule.frequency === "weekly" || rule.frequency === "monthly";
}

export async function materializeTaskOccurrences(scope: PlannerScope, input: { start: string; end: string }) {
  const db = await requireDb();
  const [workspaceTasks, existing] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.workspaceId, scope.workspaceId)),
    db.select().from(taskOccurrences).where(and(eq(taskOccurrences.workspaceId, scope.workspaceId), gte(taskOccurrences.localDate, input.start), lte(taskOccurrences.localDate, input.end))),
  ]);
  const existingKeys = new Set(existing.map(item => `${item.taskId}:${item.localDate}`));
  const inserts: Array<typeof taskOccurrences.$inferInsert> = [];
  for (const task of workspaceTasks) {
    if (!isRecurrenceRule(task.recurrenceRule) || task.state === "archived") continue;
    const seriesStart = task.scheduledLocalDate ?? task.dueLocalDate ?? task.createdAt.toISOString().slice(0, 10);
    for (const localDate of recurringLocalDates(task.recurrenceRule, seriesStart, input.end, task.recurrenceUntilLocalDate)) {
      if (localDate < input.start || existingKeys.has(`${task.id}:${localDate}`)) continue;
      inserts.push({ id: nanoid(), workspaceId: scope.workspaceId, taskId: task.id, localDate, state: "pending" });
    }
  }
  if (inserts.length) await db.insert(taskOccurrences).values(inserts);
  return db.select().from(taskOccurrences).where(and(eq(taskOccurrences.workspaceId, scope.workspaceId), gte(taskOccurrences.localDate, input.start), lte(taskOccurrences.localDate, input.end))).orderBy(asc(taskOccurrences.localDate));
}

export async function resolveTaskOccurrence(scope: PlannerScope, input: { id: string; expectedVersion: number; state: "completed" | "skipped" | "missed" | "rescheduled"; rescheduledToLocalDate?: string | null; note?: string | null }) {
  const db = await requireDb();
  const existing = (await db.select().from(taskOccurrences).where(and(eq(taskOccurrences.workspaceId, scope.workspaceId), eq(taskOccurrences.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Occurrence was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  const now = new Date();
  await db.update(taskOccurrences).set({ state: input.state, rescheduledToLocalDate: input.rescheduledToLocalDate ?? null, note: input.note ?? null, completedAt: input.state === "completed" ? now : null, resolvedAt: now, version: input.expectedVersion + 1 }).where(and(eq(taskOccurrences.workspaceId, scope.workspaceId), eq(taskOccurrences.id, input.id), eq(taskOccurrences.version, input.expectedVersion)));
  const updated = (await db.select().from(taskOccurrences).where(and(eq(taskOccurrences.workspaceId, scope.workspaceId), eq(taskOccurrences.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function updateTask(scope: PlannerScope, input: { id: string; expectedVersion: number; patch: Partial<typeof tasks.$inferInsert> }) {
  const db = await requireDb();
  const existing = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Task was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  const patch = { ...input.patch, version: input.expectedVersion + 1 } as Record<string, unknown>;
  if (patch.state === "completed" && !existing.completedAt) patch.completedAt = new Date();
  if (patch.state && patch.state !== "completed") patch.completedAt = null;
  if (patch.state === "archived") patch.archivedAt = new Date();
  if (patch.state && patch.state !== "archived") patch.archivedAt = null;
  await db.update(tasks).set(patch).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.id), eq(tasks.version, input.expectedVersion)));
  const updated = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function bulkSetTaskState(scope: PlannerScope, input: { ids: string[]; state: "not_started" | "in_progress" | "blocked" | "completed" | "archived" }) {
  if (!input.ids.length) return [];
  const db = await requireDb();
  const now = new Date();
  const patch: Record<string, unknown> = {
    state: input.state,
    completedAt: input.state === "completed" ? now : null,
    archivedAt: input.state === "archived" ? now : null,
    version: sql`${tasks.version} + 1`,
  };
  await db.update(tasks).set(patch).where(and(eq(tasks.workspaceId, scope.workspaceId), inArray(tasks.id, input.ids)));
  return db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), inArray(tasks.id, input.ids)));
}

export async function createTaskDependency(scope: PlannerScope, input: { taskId: string; dependsOnTaskId: string; dependencyType: "hard" | "soft" }) {
  const db = await requireDb();
  const [task, prerequisite, edges] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.taskId))).limit(1),
    db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.dependsOnTaskId))).limit(1),
    db.select().from(taskDependencies).where(eq(taskDependencies.workspaceId, scope.workspaceId)),
  ]);
  if (!task[0] || !prerequisite[0]) throw new Error("Both tasks must exist in this workspace before linking a dependency.");
  if (wouldCreateDependencyCycle(edges, input.taskId, input.dependsOnTaskId)) throw new Error("That dependency would create a cycle.");
  const id = nanoid();
  await db.insert(taskDependencies).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(taskDependencies).where(eq(taskDependencies.id, id)).limit(1))[0]!;
}

export async function createHabit(scope: PlannerScope, input: Omit<typeof habits.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt" | "version" | "archivedAt">) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(habits).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, id))).limit(1))[0]!;
}

export async function archiveHabit(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Habit was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(habits).set({ archivedAt: new Date(), version: input.expectedVersion + 1 }).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.id), eq(habits.version, input.expectedVersion)));
  const updated = (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

/** Restores an archived habit without deleting its historical check-ins. */
export async function restoreHabit(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Habit was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(habits).set({ archivedAt: null, version: input.expectedVersion + 1 }).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.id), eq(habits.version, input.expectedVersion)));
  const updated = (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function upsertHabitCheckIn(scope: PlannerScope, input: { habitId: string; localDate: string; state: "completed" | "skipped" | "missed"; note?: string | null }) {
  const db = await requireDb();
  const habit = (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.habitId))).limit(1))[0];
  if (!habit) throw new Error("Habit was not found.");
  const id = nanoid();
  const completedAt = input.state === "completed" ? new Date() : null;
  await db.insert(habitCheckIns).values({ id, workspaceId: scope.workspaceId, habitId: input.habitId, localDate: input.localDate, timezoneAtCheckIn: scope.timezone, state: input.state, note: input.note ?? null, completedAt }).onDuplicateKeyUpdate({ set: { state: input.state, note: input.note ?? null, completedAt, timezoneAtCheckIn: scope.timezone } });
  return (await db.select().from(habitCheckIns).where(and(eq(habitCheckIns.habitId, input.habitId), eq(habitCheckIns.localDate, input.localDate))).limit(1))[0]!;
}

/** Removes a recorded check-in so the date becomes genuinely unrecorded again. This is safe to retry. */
export async function clearHabitCheckIn(scope: PlannerScope, input: { habitId: string; localDate: string }) {
  const db = await requireDb();
  await db.delete(habitCheckIns).where(and(
    eq(habitCheckIns.workspaceId, scope.workspaceId),
    eq(habitCheckIns.habitId, input.habitId),
    eq(habitCheckIns.localDate, input.localDate)
  ));
  return { habitId: input.habitId, localDate: input.localDate, cleared: true } as const;
}

export async function upsertDailyCheckIn(scope: PlannerScope, input: { localDate: string; intention?: string | null; reflection?: string | null; energy?: number | null; mood?: number | null }) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(dailyCheckIns).values({ id, workspaceId: scope.workspaceId, ...input }).onDuplicateKeyUpdate({ set: input });
  return (await db.select().from(dailyCheckIns).where(and(eq(dailyCheckIns.workspaceId, scope.workspaceId), eq(dailyCheckIns.localDate, input.localDate))).limit(1))[0]!;
}

export async function createSavedView(scope: PlannerScope, input: { name: string; viewType: "tasks" | "goals" | "projects" | "calendar" | "habits"; configuration: unknown; isPinned?: number }) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(savedViews).values({ id, workspaceId: scope.workspaceId, name: input.name, viewType: input.viewType, configuration: input.configuration, isPinned: input.isPinned ?? 0 });
  return (await db.select().from(savedViews).where(and(eq(savedViews.workspaceId, scope.workspaceId), eq(savedViews.id, id))).limit(1))[0]!;
}

export async function updateSavedView(scope: PlannerScope, input: { id: string; expectedVersion: number; name?: string; configuration?: unknown; isPinned?: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(savedViews).where(and(eq(savedViews.workspaceId, scope.workspaceId), eq(savedViews.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Saved view was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  const patch = { ...input, version: input.expectedVersion + 1 } as Record<string, unknown>;
  delete patch.id;
  delete patch.expectedVersion;
  await db.update(savedViews).set(patch).where(and(eq(savedViews.workspaceId, scope.workspaceId), eq(savedViews.id, input.id), eq(savedViews.version, input.expectedVersion)));
  const updated = (await db.select().from(savedViews).where(and(eq(savedViews.workspaceId, scope.workspaceId), eq(savedViews.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function deleteSavedView(scope: PlannerScope, input: { id: string }) {
  const db = await requireDb();
  await db.delete(savedViews).where(and(eq(savedViews.workspaceId, scope.workspaceId), eq(savedViews.id, input.id)));
  return { success: true } as const;
}

export async function ensureCalendarFeed(scope: PlannerScope) {
  const db = await requireDb();
  const existing = (await db.select().from(calendarFeeds).where(and(eq(calendarFeeds.workspaceId, scope.workspaceId), eq(calendarFeeds.isEnabled, 1))).limit(1))[0];
  if (existing) return existing;
  const id = nanoid();
  await db.insert(calendarFeeds).values({ id, workspaceId: scope.workspaceId, token: nanoid(48) });
  return (await db.select().from(calendarFeeds).where(eq(calendarFeeds.id, id)).limit(1))[0]!;
}

export async function revokeCalendarFeed(scope: PlannerScope, input: { id: string }) {
  const db = await requireDb();
  await db.update(calendarFeeds).set({ isEnabled: 0, revokedAt: new Date() }).where(and(eq(calendarFeeds.workspaceId, scope.workspaceId), eq(calendarFeeds.id, input.id)));
  return { success: true } as const;
}

type BrowserPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  deviceLabel?: string | null;
  userAgent?: string | null;
};

function safePushDevice(subscription: typeof pushSubscriptions.$inferSelect) {
  return {
    id: subscription.id,
    deviceLabel: subscription.deviceLabel,
    status: subscription.status,
    failureReason: subscription.failureReason,
    lastSeenAt: subscription.lastSeenAt,
    lastTestedAt: subscription.lastTestedAt,
    lastSentAt: subscription.lastSentAt,
    createdAt: subscription.createdAt,
  };
}

function requirePushConfiguration() {
  const configuration = getVapidConfigurationFromEnvironment();
  const validation = validateVapidConfiguration(configuration);
  if (!validation.valid) throw new Error(`Web Push is unavailable: ${validation.reason}`);
  webpush.setVapidDetails(configuration.subject, configuration.publicKey, configuration.privateKey);
  return configuration;
}

export async function upsertPushSubscription(scope: PlannerScope, input: BrowserPushSubscription) {
  if (!/^https:\/\//.test(input.endpoint) || !input.keys?.p256dh || !input.keys?.auth) throw new Error("The browser returned an invalid push subscription.");
  const db = await requireDb();
  const id = nanoid();
  const now = new Date();
  await db.insert(pushSubscriptions).values({
    id,
    workspaceId: scope.workspaceId,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    deviceLabel: input.deviceLabel?.trim().slice(0, 120) || null,
    userAgent: input.userAgent?.slice(0, 512) || null,
    status: "active",
    failureReason: null,
    lastSeenAt: now,
  }).onDuplicateKeyUpdate({ set: {
    workspaceId: scope.workspaceId,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    deviceLabel: input.deviceLabel?.trim().slice(0, 120) || null,
    userAgent: input.userAgent?.slice(0, 512) || null,
    status: "active",
    failureReason: null,
    lastSeenAt: now,
  } });
  const stored = (await db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.workspaceId, scope.workspaceId), eq(pushSubscriptions.endpoint, input.endpoint))).limit(1))[0]!;
  return safePushDevice(stored);
}

export async function getPushDevices(scope: PlannerScope) {
  const db = await requireDb();
  const devices = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.workspaceId, scope.workspaceId)).orderBy(desc(pushSubscriptions.updatedAt));
  return devices.map(safePushDevice);
}

export async function getPushDeviceForEndpoint(scope: PlannerScope, input: { endpoint: string }) {
  const db = await requireDb();
  const device = (await db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.workspaceId, scope.workspaceId), eq(pushSubscriptions.endpoint, input.endpoint))).limit(1))[0];
  return device ? safePushDevice(device) : null;
}

export async function disablePushSubscription(scope: PlannerScope, input: { id: string }) {
  const db = await requireDb();
  await db.update(pushSubscriptions).set({ status: "disabled", failureReason: null }).where(and(eq(pushSubscriptions.workspaceId, scope.workspaceId), eq(pushSubscriptions.id, input.id)));
  return { id: input.id, disabled: true } as const;
}

export async function sendTestPush(scope: PlannerScope, input: { subscriptionId: string; origin: string }) {
  const db = await requireDb();
  requirePushConfiguration();
  const subscription = (await db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.workspaceId, scope.workspaceId), eq(pushSubscriptions.id, input.subscriptionId), eq(pushSubscriptions.status, "active"))).limit(1))[0];
  if (!subscription) throw new Error("An active notification device was not found.");
  const deliveryId = nanoid();
  const title = "Personal Calendar is ready";
  await db.insert(pushDeliveries).values({ id: deliveryId, workspaceId: scope.workspaceId, subscriptionId: subscription.id, kind: "test", title, status: "queued" });
  const payload = JSON.stringify({ title, body: "This is your visible test notification. You can control reminders in Personal Calendar.", url: input.origin, tag: `personal-calander-test-${subscription.id}`, kind: "test" });
  try {
    const result = await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 300, urgency: "normal", topic: `pc-test-${subscription.id.slice(0, 16)}` });
    const now = new Date();
    await db.transaction(async tx => {
      await tx.update(pushDeliveries).set({ status: "sent", providerStatusCode: result.statusCode, sentAt: now }).where(eq(pushDeliveries.id, deliveryId));
      await tx.update(pushSubscriptions).set({ lastTestedAt: now, lastSentAt: now, lastSeenAt: now, failureReason: null }).where(eq(pushSubscriptions.id, subscription.id));
    });
    return { id: deliveryId, status: "sent" as const };
  } catch (error) {
    const failure = error as { statusCode?: number; body?: string; message?: string };
    const expired = failure.statusCode === 404 || failure.statusCode === 410;
    const reason = (failure.body || failure.message || "The push service rejected the test delivery.").slice(0, 1000);
    await db.transaction(async tx => {
      await tx.update(pushDeliveries).set({ status: expired ? "expired" : "failed", providerStatusCode: failure.statusCode ?? null, failureReason: reason }).where(eq(pushDeliveries.id, deliveryId));
      await tx.update(pushSubscriptions).set({ status: expired ? "expired" : "active", failureReason: reason }).where(eq(pushSubscriptions.id, subscription.id));
    });
    throw new Error(expired ? "This device subscription expired. Enable reminders again on this device." : "The test notification was not accepted. Check the device permission and try again.");
  }
}

export async function prepareReminderRule(scope: PlannerScope, input: { type: "daily_plan" | "weekly_review"; timezone: string; schedule: ReminderSchedule }) {
  const db = await requireDb();
  const cronExpression = input.schedule.kind === "daily" ? `daily@${input.schedule.timeLocal}` : `weekly@${input.schedule.weekday}@${input.schedule.timeLocal}`;
  const existing = (await db.select().from(reminderRules).where(and(eq(reminderRules.workspaceId, scope.workspaceId), eq(reminderRules.type, input.type))).limit(1))[0];
  if (existing) {
    await db.update(reminderRules).set({ timezone: input.timezone, cronExpression, isEnabled: 0, lastTriggeredAt: null, version: existing.version + 1 }).where(and(eq(reminderRules.id, existing.id), eq(reminderRules.version, existing.version)));
    return (await db.select().from(reminderRules).where(eq(reminderRules.id, existing.id)).limit(1))[0]!;
  }
  const id = nanoid();
  await db.insert(reminderRules).values({ id, workspaceId: scope.workspaceId, targetType: input.type === "daily_plan" ? "daily_plan" : "review", type: input.type, cronExpression, timezone: input.timezone, isEnabled: 0 });
  return (await db.select().from(reminderRules).where(eq(reminderRules.id, id)).limit(1))[0]!;
}

export async function getReminderRules(scope: PlannerScope) {
  const db = await requireDb();
  return db.select().from(reminderRules).where(and(eq(reminderRules.workspaceId, scope.workspaceId), inArray(reminderRules.type, ["daily_plan", "weekly_review"]))).orderBy(asc(reminderRules.type));
}

export async function setReminderRuleActivation(scope: PlannerScope, input: { id: string; enabled: boolean; scheduleCronTaskUid?: string | null }) {
  const db = await requireDb();
  const rule = (await db.select().from(reminderRules).where(and(eq(reminderRules.workspaceId, scope.workspaceId), eq(reminderRules.id, input.id))).limit(1))[0];
  if (!rule) throw new Error("Reminder rule was not found.");
  await db.update(reminderRules).set({ isEnabled: input.enabled ? 1 : 0, scheduleCronTaskUid: input.scheduleCronTaskUid === undefined ? rule.scheduleCronTaskUid : input.scheduleCronTaskUid, version: rule.version + 1 }).where(and(eq(reminderRules.id, rule.id), eq(reminderRules.version, rule.version)));
  const updated = (await db.select().from(reminderRules).where(eq(reminderRules.id, rule.id)).limit(1))[0]!;
  if (updated.version === rule.version) throw new PlannerConflictError(rule);
  return updated;
}

function isDuplicateDelivery(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "ER_DUP_ENTRY";
}

function scheduledPayload(type: "daily_plan" | "weekly_review", origin: string, subscriptionId: string) {
  return type === "daily_plan"
    ? { title: "A calm planning moment", body: "Open Personal Calendar and choose one honest commitment for today.", url: origin, tag: `personal-calander-daily-${subscriptionId}`, kind: "daily_plan" }
    : { title: "Weekly review", body: "Open Personal Calendar to close the loop before next week begins.", url: origin, tag: `personal-calander-weekly-${subscriptionId}`, kind: "weekly_review" };
}

type PlanningDatabase = Awaited<ReturnType<typeof requireDb>>;
type ReminderRule = typeof reminderRules.$inferSelect;

async function dispatchReminderRule(db: PlanningDatabase, rule: ReminderRule, origin: string, now: Date) {
  if (rule.type !== "daily_plan" && rule.type !== "weekly_review") return { ok: true, skipped: "unsupported_rule" as const, sent: 0 };
  if (!rule.isEnabled || !rule.cronExpression || rule.snoozedUntil && rule.snoozedUntil > now) return { ok: true, skipped: "disabled_or_snoozed" as const, sent: 0 };
  const timing = reminderDueAt(rule.cronExpression, rule.timezone, now);
  if (!timing.due) return { ok: true, skipped: "not_due" as const, sent: 0 };
  const subscriptions = await db.select().from(pushSubscriptions).where(and(eq(pushSubscriptions.workspaceId, rule.workspaceId), eq(pushSubscriptions.status, "active")));
  if (!subscriptions.length) return { ok: true, skipped: "no_active_devices" as const, sent: 0 };
  requirePushConfiguration();
  let sent = 0;
  for (const subscription of subscriptions) {
    const idempotencyKey = `${rule.id}:${subscription.id}:${timing.localDate}:${timing.localTime}`;
    const deliveryId = nanoid();
    try {
      await db.insert(pushDeliveries).values({ id: deliveryId, workspaceId: rule.workspaceId, subscriptionId: subscription.id, reminderRuleId: rule.id, idempotencyKey, kind: rule.type, title: scheduledPayload(rule.type, origin, subscription.id).title, status: "queued" });
    } catch (error) {
      if (isDuplicateDelivery(error)) continue;
      throw error;
    }
    const payload = JSON.stringify(scheduledPayload(rule.type, origin, subscription.id));
    try {
      const result = await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, { TTL: 1_800, urgency: "normal", topic: `pc-${rule.type}-${subscription.id.slice(0, 16)}` });
      await db.transaction(async tx => {
        await tx.update(pushDeliveries).set({ status: "sent", providerStatusCode: result.statusCode, sentAt: now }).where(eq(pushDeliveries.id, deliveryId));
        await tx.update(pushSubscriptions).set({ lastSentAt: now, lastSeenAt: now, failureReason: null }).where(eq(pushSubscriptions.id, subscription.id));
      });
      sent += 1;
    } catch (error) {
      const failure = error as { statusCode?: number; body?: string; message?: string };
      const expired = failure.statusCode === 404 || failure.statusCode === 410;
      const reason = (failure.body || failure.message || "The push service rejected the scheduled delivery.").slice(0, 1000);
      await db.transaction(async tx => {
        await tx.update(pushDeliveries).set({ status: expired ? "expired" : "failed", providerStatusCode: failure.statusCode ?? null, failureReason: reason }).where(eq(pushDeliveries.id, deliveryId));
        await tx.update(pushSubscriptions).set({ status: expired ? "expired" : "active", failureReason: reason }).where(eq(pushSubscriptions.id, subscription.id));
      });
    }
  }
  await db.update(reminderRules).set({ lastTriggeredAt: now }).where(eq(reminderRules.id, rule.id));
  return { ok: true, sent, localDate: timing.localDate, localTime: timing.localTime };
}

export async function dispatchScheduledReminder(taskUid: string, origin: string, now = new Date()) {
  const db = await requireDb();
  const scheduler = (await db.select().from(reminderSchedulers).where(eq(reminderSchedulers.id, "project-reminder-sweep")).limit(1))[0];
  if (scheduler?.scheduleCronTaskUid === taskUid) return dispatchProjectReminderSweep(db, origin, now);

  // Legacy per-rule Heartbeat callbacks remain restricted to their own rule.
  // An unknown task UID is a harmless no-op rather than a cross-workspace sweep.
  const rule = (await db.select().from(reminderRules).where(eq(reminderRules.scheduleCronTaskUid, taskUid)).limit(1))[0];
  if (!rule) return { ok: true, skipped: "orphan" as const, sent: 0 };
  return dispatchReminderRule(db, rule, origin, now);
}

export async function dispatchProjectReminderSweep(db: PlanningDatabase, origin: string, now = new Date()) {
  const rules = await db.select().from(reminderRules).where(and(eq(reminderRules.isEnabled, 1), inArray(reminderRules.type, ["daily_plan", "weekly_review"])));
  const results = [];
  for (const rule of rules) results.push(await dispatchReminderRule(db, rule, origin, now));
  return {
    ok: true,
    scheduler: "project" as const,
    inspected: rules.length,
    sent: results.reduce((total, result) => total + result.sent, 0),
    results,
  };
}

export async function startReviewSession(scope: PlannerScope, input: { kind: "daily" | "weekly" | "monthly" | "quarterly" | "yearly"; periodStartLocalDate: string; periodEndLocalDate: string; snapshot?: unknown }) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(reviewSessions).values({ id, workspaceId: scope.workspaceId, ...input, state: "in_progress" });
  return (await db.select().from(reviewSessions).where(and(eq(reviewSessions.workspaceId, scope.workspaceId), eq(reviewSessions.id, id))).limit(1))[0]!;
}

export async function completeReviewSession(scope: PlannerScope, input: { id: string; expectedVersion: number; reflection?: string | null }) {
  const db = await requireDb();
  const existing = (await db.select().from(reviewSessions).where(and(eq(reviewSessions.workspaceId, scope.workspaceId), eq(reviewSessions.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Review session was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(reviewSessions).set({ state: "completed", reflection: input.reflection ?? null, completedAt: new Date(), version: input.expectedVersion + 1 }).where(and(eq(reviewSessions.workspaceId, scope.workspaceId), eq(reviewSessions.id, input.id), eq(reviewSessions.version, input.expectedVersion)));
  const updated = (await db.select().from(reviewSessions).where(and(eq(reviewSessions.workspaceId, scope.workspaceId), eq(reviewSessions.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function getDashboard(scope: PlannerScope, input: { todayLocalDate: string; rangeStart: string; rangeEnd: string }) {
  const snapshot = await getWorkspaceSnapshot(scope, { start: input.rangeStart, end: input.rangeEnd });
  const projectGoalById = new Map(snapshot.projects.map(project => [project.id, project.goalId]));
  const categoryNames = new Map(snapshot.categories.map(category => [category.id, category.name]));
  const summary = dashboardSummary({
    tasks: snapshot.tasks,
    goals: snapshot.goals,
    projects: snapshot.projects,
    habits: snapshot.habits,
    milestones: snapshot.milestones,
    reviewSessions: snapshot.reviewSessions,
    projectGoalById,
    categoryNames,
    habitCheckIns: snapshot.habitCheckIns,
    habitIds: snapshot.habits.filter(habit => !habit.archivedAt).map(habit => habit.id),
    todayLocalDate: input.todayLocalDate,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    capacityMinutes: snapshot.workspace.dailyCapacityMinutes,
  });
  return { ...summary, workspace: snapshot.workspace };
}
