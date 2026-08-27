import { and, asc, desc, eq, gte, inArray, like, lte, ne, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import webpush from "web-push";
import {
  calendarFeeds,
  categories,
  dailyCheckIns,
  dailyPlanItems,
  dailyPlans,
  externalEvents,
  focusSessions,
  goalMilestones,
  goals,
  habitCheckIns,
  habits,
  integrationConnections,
  planningAvailabilityExceptions,
  projects,
  pushDeliveries,
  pushSubscriptions,
  reminderRules,
  reminderSchedulers,
  reviewSessions,
  scheduleProposals,
  savedViews,
  taskDependencies,
  taskOccurrences,
  tasks,
  planningTemplates,
  weeklyObjectives,
  workspaces,
} from "../drizzle/schema";
import { getDb } from "./db";
import { dashboardSummary, recurringLocalDates, shiftLocalDate, type RecurrenceRule, wouldCreateDependencyCycle } from "./plannerRules";
import { incompleteHardPrerequisites } from "../shared/dependencyPolicy";
import { taskPatchForDailyPlanOutcome } from "../shared/dailyPlanResolution";
import { reorderCommittedDailyPlanItems } from "../shared/dailyPlanOrdering";
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

export async function updateWorkspace(scope: PlannerScope, input: { name?: string; timezone?: string; weekStartsOn?: number; dailyCapacityMinutes?: number; planningDayStartsAt?: string; workdayStartsAt?: string; workdayEndsAt?: string; defaultBreakMinutes?: number; preferredShutdownAt?: string; expectedVersion: number }) {
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

export async function upsertPlanningAvailabilityException(scope: PlannerScope, input: { localDate: string; expectedVersion?: number; isUnavailable?: boolean; workdayStartsAt?: string | null; workdayEndsAt?: string | null; breakMinutes?: number | null; note?: string | null }) {
  const db = await requireDb();
  const existing = (await db.select().from(planningAvailabilityExceptions).where(and(eq(planningAvailabilityExceptions.workspaceId, scope.workspaceId), eq(planningAvailabilityExceptions.localDate, input.localDate))).limit(1))[0];
  const isUnavailable = input.isUnavailable ?? Boolean(existing?.isUnavailable);
  const startsAt = input.workdayStartsAt ?? existing?.workdayStartsAt ?? null;
  const endsAt = input.workdayEndsAt ?? existing?.workdayEndsAt ?? null;
  const breakMinutes = input.breakMinutes ?? existing?.breakMinutes ?? null;
  if (!isUnavailable && (!startsAt || !endsAt)) throw new Error("Choose both an available start and end time, or mark the day unavailable.");
  if (!isUnavailable && endsAt! <= startsAt!) throw new Error("Availability end must be after availability start.");
  if (breakMinutes !== null && (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 240)) throw new Error("Break allowance must be a whole number from 0 to 240 minutes.");
  if (!existing) {
    const id = nanoid();
    await db.insert(planningAvailabilityExceptions).values({ id, workspaceId: scope.workspaceId, localDate: input.localDate, isUnavailable: isUnavailable ? 1 : 0, workdayStartsAt: isUnavailable ? null : startsAt, workdayEndsAt: isUnavailable ? null : endsAt, breakMinutes, note: input.note ?? null });
    return (await db.select().from(planningAvailabilityExceptions).where(and(eq(planningAvailabilityExceptions.workspaceId, scope.workspaceId), eq(planningAvailabilityExceptions.id, id))).limit(1))[0]!;
  }
  if (input.expectedVersion !== undefined && existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(planningAvailabilityExceptions).set({ isUnavailable: isUnavailable ? 1 : 0, workdayStartsAt: isUnavailable ? null : startsAt, workdayEndsAt: isUnavailable ? null : endsAt, breakMinutes, note: input.note ?? null, version: existing.version + 1 }).where(and(eq(planningAvailabilityExceptions.workspaceId, scope.workspaceId), eq(planningAvailabilityExceptions.id, existing.id), eq(planningAvailabilityExceptions.version, existing.version)));
  const updated = (await db.select().from(planningAvailabilityExceptions).where(and(eq(planningAvailabilityExceptions.workspaceId, scope.workspaceId), eq(planningAvailabilityExceptions.id, existing.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function clearPlanningAvailabilityException(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(planningAvailabilityExceptions).where(and(eq(planningAvailabilityExceptions.workspaceId, scope.workspaceId), eq(planningAvailabilityExceptions.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Availability exception was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.delete(planningAvailabilityExceptions).where(and(eq(planningAvailabilityExceptions.workspaceId, scope.workspaceId), eq(planningAvailabilityExceptions.id, input.id), eq(planningAvailabilityExceptions.version, input.expectedVersion)));
  return { id: input.id, cleared: true } as const;
}

export async function getWorkspaceSnapshot(scope: PlannerScope, range: { start: string; end: string }) {
  const db = await requireDb();
  const workspace = await ensureWorkspace(scope);
  const [categoryRows, goalRows, milestoneRows, projectRows, taskRows, habitRows, checkInRows, savedViewRows, eventRows, dailyRows, occurrenceRows, reviewRows, planRows, planItemRows, objectiveRows, focusRows, templateRows, proposalRows, dependencyRows, integrationRows, availabilityExceptionRows] = await Promise.all([
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
    db.select().from(dailyPlans).where(and(eq(dailyPlans.workspaceId, scope.workspaceId), gte(dailyPlans.localDate, range.start), lte(dailyPlans.localDate, range.end))).orderBy(desc(dailyPlans.localDate)),
    db.select().from(dailyPlanItems).where(eq(dailyPlanItems.workspaceId, scope.workspaceId)).orderBy(asc(dailyPlanItems.position)),
    db.select().from(weeklyObjectives).where(and(eq(weeklyObjectives.workspaceId, scope.workspaceId), gte(weeklyObjectives.weekStartLocalDate, range.start), lte(weeklyObjectives.weekStartLocalDate, range.end))).orderBy(desc(weeklyObjectives.weekStartLocalDate), asc(weeklyObjectives.createdAt)),
    db.select().from(focusSessions).where(and(eq(focusSessions.workspaceId, scope.workspaceId), gte(focusSessions.startedAt, new Date(`${range.start}T00:00:00.000Z`)), lte(focusSessions.startedAt, new Date(`${range.end}T23:59:59.999Z`)))).orderBy(desc(focusSessions.startedAt)),
    db.select().from(planningTemplates).where(eq(planningTemplates.workspaceId, scope.workspaceId)).orderBy(desc(planningTemplates.updatedAt)),
    db.select().from(scheduleProposals).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), gte(scheduleProposals.localDate, range.start), lte(scheduleProposals.localDate, range.end))).orderBy(desc(scheduleProposals.createdAt)),
    db.select().from(taskDependencies).where(eq(taskDependencies.workspaceId, scope.workspaceId)),
    db.select().from(integrationConnections).where(eq(integrationConnections.workspaceId, scope.workspaceId)).orderBy(desc(integrationConnections.updatedAt)),
    db.select().from(planningAvailabilityExceptions).where(and(eq(planningAvailabilityExceptions.workspaceId, scope.workspaceId), gte(planningAvailabilityExceptions.localDate, range.start), lte(planningAvailabilityExceptions.localDate, range.end))).orderBy(asc(planningAvailabilityExceptions.localDate)),
  ]);
  return { workspace, categories: categoryRows, goals: goalRows, milestones: milestoneRows, projects: projectRows, tasks: taskRows, habits: habitRows, habitCheckIns: checkInRows, savedViews: savedViewRows, externalEvents: eventRows, dailyCheckIns: dailyRows, taskOccurrences: occurrenceRows, reviewSessions: reviewRows, dailyPlans: planRows, dailyPlanItems: planItemRows, weeklyObjectives: objectiveRows, focusSessions: focusRows, planningTemplates: templateRows, scheduleProposals: proposalRows, taskDependencies: dependencyRows, integrationConnections: integrationRows, planningAvailabilityExceptions: availabilityExceptionRows };
}

export async function searchWorkspace(scope: PlannerScope, input: { query: string; limit: number }) {
  const db = await requireDb();
  const phrase = input.query.trim().replace(/[\\%_]/g, "\\$&");
  const pattern = `%${phrase}%`;
  const [taskRows, goalRows, projectRows, habitRows, reviewRows] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title, summary: tasks.description, state: tasks.state, updatedAt: tasks.updatedAt }).from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), or(like(tasks.title, pattern), like(tasks.description, pattern)))).orderBy(desc(tasks.updatedAt)).limit(input.limit),
    db.select({ id: goals.id, title: goals.title, summary: goals.description, state: goals.state, updatedAt: goals.updatedAt }).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), or(like(goals.title, pattern), like(goals.description, pattern)))).orderBy(desc(goals.updatedAt)).limit(input.limit),
    db.select({ id: projects.id, title: projects.title, summary: projects.description, state: projects.state, updatedAt: projects.updatedAt }).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), or(like(projects.title, pattern), like(projects.description, pattern)))).orderBy(desc(projects.updatedAt)).limit(input.limit),
    db.select({ id: habits.id, title: habits.name, summary: habits.description, state: habits.archivedAt, updatedAt: habits.updatedAt }).from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), or(like(habits.name, pattern), like(habits.description, pattern)))).orderBy(desc(habits.updatedAt)).limit(input.limit),
    db.select({ id: reviewSessions.id, kind: reviewSessions.kind, reflection: reviewSessions.reflection, state: reviewSessions.state, periodStartLocalDate: reviewSessions.periodStartLocalDate, periodEndLocalDate: reviewSessions.periodEndLocalDate, updatedAt: reviewSessions.updatedAt }).from(reviewSessions).where(and(eq(reviewSessions.workspaceId, scope.workspaceId), or(like(reviewSessions.reflection, pattern), like(reviewSessions.kind, pattern)))).orderBy(desc(reviewSessions.updatedAt)).limit(input.limit),
  ]);
  return [
    ...taskRows.map(row => ({ ...row, entity: "task" as const })),
    ...goalRows.map(row => ({ ...row, entity: "goal" as const })),
    ...projectRows.map(row => ({ ...row, entity: "project" as const })),
    ...habitRows.map(row => ({ id: row.id, title: row.title, summary: row.summary, state: row.state ? "archived" : "active", updatedAt: row.updatedAt, entity: "habit" as const })),
    ...reviewRows.map(row => ({ id: row.id, title: `${row.kind} review · ${row.periodStartLocalDate} to ${row.periodEndLocalDate}`, summary: row.reflection, state: row.state, updatedAt: row.updatedAt, entity: "review" as const })),
  ].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()).slice(0, input.limit);
}

export async function getReviewHistory(scope: PlannerScope, input: { limit: number }) {
  const db = await requireDb();
  return db.select().from(reviewSessions).where(eq(reviewSessions.workspaceId, scope.workspaceId)).orderBy(desc(reviewSessions.periodEndLocalDate), desc(reviewSessions.updatedAt)).limit(input.limit);
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
  if (input.patch.state === "completed" && existing.state !== "completed") {
    const edges = await db.select().from(taskDependencies).where(and(eq(taskDependencies.workspaceId, scope.workspaceId), eq(taskDependencies.taskId, input.id)));
    const prerequisites = edges.length ? await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), inArray(tasks.id, edges.map(edge => edge.dependsOnTaskId)))) : [];
    const incomplete = incompleteHardPrerequisites(input.id, edges, prerequisites);
    if (incomplete.length) throw new Error("Complete every hard prerequisite before finishing this task.");
  }
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
  if (input.state === "completed") {
    const edges = await db.select().from(taskDependencies).where(and(eq(taskDependencies.workspaceId, scope.workspaceId), inArray(taskDependencies.taskId, input.ids)));
    const prerequisiteIds = Array.from(new Set(edges.map(edge => edge.dependsOnTaskId)));
    const prerequisites = prerequisiteIds.length ? await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), inArray(tasks.id, prerequisiteIds))) : [];
    const candidateStates = prerequisites.map(task => ({ ...task, state: input.ids.includes(task.id) ? "completed" : task.state }));
    const blocked = input.ids.flatMap(id => incompleteHardPrerequisites(id, edges, candidateStates));
    if (blocked.length) throw new Error("The selected tasks include work with unfinished hard prerequisites.");
  }
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

export async function removeTaskDependency(scope: PlannerScope, input: { id: string }) {
  const db = await requireDb();
  const existing = (await db.select().from(taskDependencies).where(and(eq(taskDependencies.workspaceId, scope.workspaceId), eq(taskDependencies.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Dependency link was not found.");
  await db.delete(taskDependencies).where(and(eq(taskDependencies.workspaceId, scope.workspaceId), eq(taskDependencies.id, input.id)));
  return { id: input.id, removed: true } as const;
}

export async function upsertDailyPlan(scope: PlannerScope, input: { localDate: string; expectedVersion?: number; intention?: string | null; reflection?: string | null; state?: "draft" | "active" | "closed" | "archived" }) {
  const db = await requireDb();
  const existing = (await db.select().from(dailyPlans).where(and(eq(dailyPlans.workspaceId, scope.workspaceId), eq(dailyPlans.localDate, input.localDate))).limit(1))[0];
  const nextState = input.state ?? existing?.state ?? "draft";
  const now = new Date();
  if (!existing) {
    const id = nanoid();
    await db.insert(dailyPlans).values({ id, workspaceId: scope.workspaceId, localDate: input.localDate, state: nextState, intention: input.intention ?? null, reflection: input.reflection ?? null, startedAt: nextState === "active" ? now : null, closedAt: nextState === "closed" ? now : null });
    return (await db.select().from(dailyPlans).where(and(eq(dailyPlans.workspaceId, scope.workspaceId), eq(dailyPlans.id, id))).limit(1))[0]!;
  }
  if (input.expectedVersion !== undefined && existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state === "closed" && nextState !== "closed") throw new Error("A closed daily plan cannot be reopened. Start a new plan for the next day instead.");
  const patch: Record<string, unknown> = { state: nextState, version: existing.version + 1 };
  if (input.intention !== undefined) patch.intention = input.intention;
  if (input.reflection !== undefined) patch.reflection = input.reflection;
  if (nextState === "active" && !existing.startedAt) patch.startedAt = now;
  if (nextState === "closed" && !existing.closedAt) patch.closedAt = now;
  await db.update(dailyPlans).set(patch).where(and(eq(dailyPlans.workspaceId, scope.workspaceId), eq(dailyPlans.id, existing.id), eq(dailyPlans.version, existing.version)));
  const updated = (await db.select().from(dailyPlans).where(and(eq(dailyPlans.workspaceId, scope.workspaceId), eq(dailyPlans.id, existing.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function addDailyPlanItem(scope: PlannerScope, input: { dailyPlanId: string; taskId: string }) {
  const db = await requireDb();
  const [plan, task, existingItems] = await Promise.all([
    db.select().from(dailyPlans).where(and(eq(dailyPlans.workspaceId, scope.workspaceId), eq(dailyPlans.id, input.dailyPlanId))).limit(1),
    db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.taskId))).limit(1),
    db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.dailyPlanId, input.dailyPlanId))),
  ]);
  if (!plan[0]) throw new Error("Daily plan was not found.");
  if (plan[0].state === "closed" || plan[0].state === "archived") throw new Error("This daily plan is closed and cannot accept more commitments.");
  if (!task[0] || task[0].state === "completed" || task[0].state === "archived") throw new Error("Only unfinished active tasks can be added to a daily plan.");
  const duplicate = existingItems.find(item => item.taskId === input.taskId);
  if (duplicate) return duplicate;
  const id = nanoid();
  const position = existingItems.length ? Math.max(...existingItems.map(item => item.position)) + 1 : 0;
  await db.insert(dailyPlanItems).values({ id, workspaceId: scope.workspaceId, dailyPlanId: input.dailyPlanId, taskId: input.taskId, position, state: "committed" });
  return (await db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, id))).limit(1))[0]!;
}

export async function updateDailyPlanItem(scope: PlannerScope, input: { id: string; expectedVersion: number; state?: "committed" | "done" | "rescheduled" | "deferred" | "wont_do" | "archived"; resolvedToLocalDate?: string | null; note?: string | null; position?: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Daily commitment was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  const isResolved = input.state && input.state !== "committed";
  const patch: Record<string, unknown> = { version: input.expectedVersion + 1 };
  if (input.state !== undefined) patch.state = input.state;
  if (input.resolvedToLocalDate !== undefined) patch.resolvedToLocalDate = input.resolvedToLocalDate;
  if (input.note !== undefined) patch.note = input.note;
  if (input.position !== undefined) patch.position = input.position;
  if (isResolved) patch.resolvedAt = new Date();
  await db.update(dailyPlanItems).set(patch).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, input.id), eq(dailyPlanItems.version, input.expectedVersion)));
  const updated = (await db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function moveDailyPlanItem(scope: PlannerScope, input: { id: string; expectedVersion: number; direction: -1 | 1 }) {
  const db = await requireDb();
  const existing = (await db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Daily commitment was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state !== "committed") throw new Error("Only unresolved commitments can be reordered.");
  const items = await db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.dailyPlanId, existing.dailyPlanId)));
  const positions = reorderCommittedDailyPlanItems(items, existing.id, input.direction);
  if (!positions) return existing;
  await db.transaction(async tx => {
    for (const position of positions) {
      const current = items.find(item => item.id === position.id);
      if (!current || current.position === position.position) continue;
      await tx.update(dailyPlanItems).set({ position: position.position, version: current.version + 1 }).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, current.id), eq(dailyPlanItems.version, current.version)));
    }
  });
  const updated = (await db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, existing.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function resolveDailyPlanItem(scope: PlannerScope, input: { id: string; expectedVersion: number; taskExpectedVersion: number; state: "done" | "rescheduled" | "deferred" | "wont_do" | "archived"; resolvedToLocalDate?: string | null; note?: string | null }) {
  const db = await requireDb();
  const existing = await db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, input.id))).limit(1);
  const item = existing[0];
  if (!item) throw new Error("Daily commitment was not found.");
  if (item.version !== input.expectedVersion) throw new PlannerConflictError(item);
  const linkedTask = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, item.taskId))).limit(1))[0];
  if (!linkedTask) throw new Error("The task linked to this commitment no longer exists.");
  if (linkedTask.version !== input.taskExpectedVersion) throw new PlannerConflictError(linkedTask);
  if (item.state !== "committed") throw new Error("This daily commitment already has an outcome. Refresh before changing it.");
  if (input.state === "done") {
    const edges = await db.select().from(taskDependencies).where(and(eq(taskDependencies.workspaceId, scope.workspaceId), eq(taskDependencies.taskId, linkedTask.id)));
    const prerequisiteIds = Array.from(new Set(edges.map(edge => edge.dependsOnTaskId)));
    const prerequisites = prerequisiteIds.length ? await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), inArray(tasks.id, prerequisiteIds))) : [];
    if (incompleteHardPrerequisites(linkedTask.id, edges, prerequisites).length) throw new Error("Complete every hard prerequisite before finishing this task.");
  }
  const now = new Date();
  const taskPatch: Record<string, unknown> = { ...taskPatchForDailyPlanOutcome(input.state, now, input.resolvedToLocalDate), version: linkedTask.version + 1 };
  await db.transaction(async tx => {
    await tx.update(tasks).set(taskPatch).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, linkedTask.id), eq(tasks.version, linkedTask.version)));
    await tx.update(dailyPlanItems).set({ state: input.state, resolvedToLocalDate: input.resolvedToLocalDate ?? null, note: input.note ?? null, resolvedAt: now, version: item.version + 1 }).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, item.id), eq(dailyPlanItems.version, item.version)));
  });
  const updated = (await db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, item.id))).limit(1))[0]!;
  if (updated.version === item.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function closeDailyPlan(scope: PlannerScope, input: { id: string; expectedVersion: number; reflection?: string | null }) {
  const db = await requireDb();
  const [plan, unresolved] = await Promise.all([
    db.select().from(dailyPlans).where(and(eq(dailyPlans.workspaceId, scope.workspaceId), eq(dailyPlans.id, input.id))).limit(1),
    db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.dailyPlanId, input.id), eq(dailyPlanItems.state, "committed"))),
  ]);
  const existing = plan[0];
  if (!existing) throw new Error("Daily plan was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (unresolved.length) throw new Error("Resolve every committed task before closing the day. Choose done, reschedule, defer, won’t do, or archive.");
  await db.update(dailyPlans).set({ state: "closed", reflection: input.reflection ?? existing.reflection, closedAt: new Date(), version: input.expectedVersion + 1 }).where(and(eq(dailyPlans.workspaceId, scope.workspaceId), eq(dailyPlans.id, input.id), eq(dailyPlans.version, input.expectedVersion)));
  const updated = (await db.select().from(dailyPlans).where(and(eq(dailyPlans.workspaceId, scope.workspaceId), eq(dailyPlans.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function createWeeklyObjective(scope: PlannerScope, input: { weekStartLocalDate: string; title: string; description?: string | null; goalId?: string | null; projectId?: string | null }) {
  const db = await requireDb();
  if (input.goalId) {
    const goal = (await db.select({ id: goals.id }).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.goalId))).limit(1))[0];
    if (!goal) throw new Error("Select a goal from this workspace or leave the goal link empty.");
  }
  if (input.projectId) {
    const project = (await db.select({ id: projects.id }).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.projectId))).limit(1))[0];
    if (!project) throw new Error("Select a project from this workspace or leave the project link empty.");
  }
  const id = nanoid();
  await db.insert(weeklyObjectives).values({ id, workspaceId: scope.workspaceId, ...input, state: "active" });
  return (await db.select().from(weeklyObjectives).where(and(eq(weeklyObjectives.workspaceId, scope.workspaceId), eq(weeklyObjectives.id, id))).limit(1))[0]!;
}

export async function updateWeeklyObjective(scope: PlannerScope, input: { id: string; expectedVersion: number; patch: { title?: string; description?: string | null; goalId?: string | null; projectId?: string | null; state?: "active" | "completed" | "continued" | "adjusted" | "archived"; evidence?: string | null } }) {
  const db = await requireDb();
  const existing = (await db.select().from(weeklyObjectives).where(and(eq(weeklyObjectives.workspaceId, scope.workspaceId), eq(weeklyObjectives.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Weekly objective was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  const patch: Record<string, unknown> = { ...input.patch, version: input.expectedVersion + 1 };
  if (input.patch.state === "completed" && !existing.completedAt) patch.completedAt = new Date();
  if (input.patch.state && input.patch.state !== "completed") patch.completedAt = null;
  if (input.patch.state === "archived") patch.archivedAt = new Date();
  if (input.patch.state && input.patch.state !== "archived") patch.archivedAt = null;
  await db.update(weeklyObjectives).set(patch).where(and(eq(weeklyObjectives.workspaceId, scope.workspaceId), eq(weeklyObjectives.id, input.id), eq(weeklyObjectives.version, input.expectedVersion)));
  const updated = (await db.select().from(weeklyObjectives).where(and(eq(weeklyObjectives.workspaceId, scope.workspaceId), eq(weeklyObjectives.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function carryForwardWeeklyObjective(scope: PlannerScope, input: { id: string; expectedVersion: number; nextWeekStartLocalDate: string }) {
  const db = await requireDb();
  const existing = (await db.select().from(weeklyObjectives).where(and(eq(weeklyObjectives.workspaceId, scope.workspaceId), eq(weeklyObjectives.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Weekly objective was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state === "completed" || existing.state === "archived") throw new Error("Only active or adjusted objectives can be carried forward.");
  const id = nanoid();
  await db.transaction(async tx => {
    await tx.update(weeklyObjectives).set({ state: "continued", version: input.expectedVersion + 1 }).where(and(eq(weeklyObjectives.workspaceId, scope.workspaceId), eq(weeklyObjectives.id, existing.id), eq(weeklyObjectives.version, input.expectedVersion)));
    await tx.insert(weeklyObjectives).values({ id, workspaceId: scope.workspaceId, weekStartLocalDate: input.nextWeekStartLocalDate, goalId: existing.goalId, projectId: existing.projectId, title: existing.title, description: existing.description, state: "active", carriedForwardFromId: existing.id });
  });
  return (await db.select().from(weeklyObjectives).where(and(eq(weeklyObjectives.workspaceId, scope.workspaceId), eq(weeklyObjectives.id, id))).limit(1))[0]!;
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

/** Bounded, habit-only history for the dedicated practice workspace; it avoids widening every planner snapshot. */
export async function getHabitPracticeEvidence(scope: PlannerScope, input: { endLocalDate: string }) {
  const db = await requireDb();
  const startLocalDate = shiftLocalDate(input.endLocalDate, -396);
  const [habitRows, checkInRows] = await Promise.all([
    db.select().from(habits).where(eq(habits.workspaceId, scope.workspaceId)),
    db.select().from(habitCheckIns).where(and(eq(habitCheckIns.workspaceId, scope.workspaceId), gte(habitCheckIns.localDate, startLocalDate), lte(habitCheckIns.localDate, input.endLocalDate))),
  ]);
  return { startLocalDate, endLocalDate: input.endLocalDate, habits: habitRows, checkIns: checkInRows };
}

export async function createPlanningTemplate(scope: PlannerScope, input: { kind: "task" | "project" | "daily_plan"; name: string; description?: string | null; payload: unknown }) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(planningTemplates).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(planningTemplates).where(and(eq(planningTemplates.workspaceId, scope.workspaceId), eq(planningTemplates.id, id))).limit(1))[0]!;
}

export async function updatePlanningTemplate(scope: PlannerScope, input: { id: string; expectedVersion: number; patch: { name?: string; description?: string | null; payload?: unknown } }) {
  const db = await requireDb();
  const existing = (await db.select().from(planningTemplates).where(and(eq(planningTemplates.workspaceId, scope.workspaceId), eq(planningTemplates.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Planning template was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(planningTemplates).set({ ...input.patch, version: existing.version + 1 }).where(and(eq(planningTemplates.workspaceId, scope.workspaceId), eq(planningTemplates.id, input.id), eq(planningTemplates.version, input.expectedVersion)));
  const updated = (await db.select().from(planningTemplates).where(and(eq(planningTemplates.workspaceId, scope.workspaceId), eq(planningTemplates.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

/** Template archive retains configuration history and never changes any task, project, or plan. */
export async function archivePlanningTemplate(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select().from(planningTemplates).where(and(eq(planningTemplates.workspaceId, scope.workspaceId), eq(planningTemplates.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Planning template was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(planningTemplates).set({ archivedAt: new Date(), version: existing.version + 1 }).where(and(eq(planningTemplates.workspaceId, scope.workspaceId), eq(planningTemplates.id, input.id), eq(planningTemplates.version, input.expectedVersion)));
  const updated = (await db.select().from(planningTemplates).where(and(eq(planningTemplates.workspaceId, scope.workspaceId), eq(planningTemplates.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
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
    focusSessions: snapshot.focusSessions,
    timezone: scope.timezone,
    todayLocalDate: input.todayLocalDate,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    capacityMinutes: snapshot.workspace.dailyCapacityMinutes,
  });
  return { ...summary, workspace: snapshot.workspace };
}
