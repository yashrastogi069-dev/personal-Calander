import { and, asc, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  categories,
  dailyCheckIns,
  externalEvents,
  goals,
  habitCheckIns,
  habits,
  projects,
  savedViews,
  taskDependencies,
  tasks,
  workspaces,
} from "../drizzle/schema";
import { getDb } from "./db";
import { dashboardSummary, wouldCreateDependencyCycle } from "./plannerRules";

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
  const [categoryRows, goalRows, projectRows, taskRows, habitRows, checkInRows, savedViewRows, eventRows, dailyRows] = await Promise.all([
    db.select().from(categories).where(eq(categories.workspaceId, scope.workspaceId)).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select().from(goals).where(eq(goals.workspaceId, scope.workspaceId)).orderBy(desc(goals.updatedAt)),
    db.select().from(projects).where(eq(projects.workspaceId, scope.workspaceId)).orderBy(desc(projects.updatedAt)),
    db.select().from(tasks).where(eq(tasks.workspaceId, scope.workspaceId)).orderBy(asc(tasks.sortOrder), desc(tasks.updatedAt)),
    db.select().from(habits).where(eq(habits.workspaceId, scope.workspaceId)).orderBy(desc(habits.updatedAt)),
    db.select().from(habitCheckIns).where(and(eq(habitCheckIns.workspaceId, scope.workspaceId), gte(habitCheckIns.localDate, range.start), lte(habitCheckIns.localDate, range.end))),
    db.select().from(savedViews).where(eq(savedViews.workspaceId, scope.workspaceId)).orderBy(desc(savedViews.isPinned), asc(savedViews.name)),
    db.select().from(externalEvents).where(and(eq(externalEvents.workspaceId, scope.workspaceId), gte(externalEvents.startsAt, new Date(`${range.start}T00:00:00.000Z`)), lte(externalEvents.startsAt, new Date(`${range.end}T23:59:59.999Z`)))).orderBy(asc(externalEvents.startsAt)),
    db.select().from(dailyCheckIns).where(and(eq(dailyCheckIns.workspaceId, scope.workspaceId), gte(dailyCheckIns.localDate, range.start), lte(dailyCheckIns.localDate, range.end))),
  ]);
  return { workspace, categories: categoryRows, goals: goalRows, projects: projectRows, tasks: taskRows, habits: habitRows, habitCheckIns: checkInRows, savedViews: savedViewRows, externalEvents: eventRows, dailyCheckIns: dailyRows };
}

export async function createCategory(scope: PlannerScope, input: { name: string; color: string; sortOrder?: number }) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(categories).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(categories).where(and(eq(categories.workspaceId, scope.workspaceId), eq(categories.id, id))).limit(1))[0]!;
}

export async function createGoal(scope: PlannerScope, input: Omit<typeof goals.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt" | "version" | "completedAt" | "archivedAt">) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(goals).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, id))).limit(1))[0]!;
}

export async function createProject(scope: PlannerScope, input: Omit<typeof projects.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt" | "version" | "completedAt" | "archivedAt">) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(projects).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, id))).limit(1))[0]!;
}

export async function createTask(scope: PlannerScope, input: Omit<typeof tasks.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt" | "version" | "completedAt" | "archivedAt">) {
  const db = await requireDb();
  const id = nanoid();
  await db.insert(tasks).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, id))).limit(1))[0]!;
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
  await db.update(tasks).set(patch).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.id), eq(tasks.version, input.expectedVersion)));
  const updated = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function bulkSetTaskState(scope: PlannerScope, input: { ids: string[]; state: "not_started" | "in_progress" | "blocked" | "completed" | "archived" }) {
  if (!input.ids.length) return [];
  const db = await requireDb();
  const patch: Record<string, unknown> = { state: input.state };
  if (input.state === "completed") patch.completedAt = new Date();
  if (input.state === "archived") patch.archivedAt = new Date();
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

export async function upsertHabitCheckIn(scope: PlannerScope, input: { habitId: string; localDate: string; state: "completed" | "skipped" | "missed"; note?: string | null }) {
  const db = await requireDb();
  const habit = (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.habitId))).limit(1))[0];
  if (!habit) throw new Error("Habit was not found.");
  const id = nanoid();
  const completedAt = input.state === "completed" ? new Date() : null;
  await db.insert(habitCheckIns).values({ id, workspaceId: scope.workspaceId, habitId: input.habitId, localDate: input.localDate, timezoneAtCheckIn: scope.timezone, state: input.state, note: input.note ?? null, completedAt }).onDuplicateKeyUpdate({ set: { state: input.state, note: input.note ?? null, completedAt, timezoneAtCheckIn: scope.timezone } });
  return (await db.select().from(habitCheckIns).where(and(eq(habitCheckIns.habitId, input.habitId), eq(habitCheckIns.localDate, input.localDate))).limit(1))[0]!;
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

export async function getDashboard(scope: PlannerScope, input: { todayLocalDate: string; rangeStart: string; rangeEnd: string }) {
  const snapshot = await getWorkspaceSnapshot(scope, { start: input.rangeStart, end: input.rangeEnd });
  const projectGoalById = new Map(snapshot.projects.map(project => [project.id, project.goalId]));
  const categoryNames = new Map(snapshot.categories.map(category => [category.id, category.name]));
  const summary = dashboardSummary({
    tasks: snapshot.tasks,
    goals: snapshot.goals,
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
