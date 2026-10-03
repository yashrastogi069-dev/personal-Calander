import { and, asc, desc, eq, gte, inArray, like, lte, ne, or, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import webpush from "web-push";
import {
  calendarFeeds,
  categories,
  carriedCommitments,
  commitmentResolutions,
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
  projectDependencies,
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
  taskReservationRollovers,
  tasks,
  planningTemplates,
  weeklyObjectives,
  workspaces,
} from "../drizzle/schema";
import { getDb } from "./db";
import { focusSessionColumns, hasFocusFollowupColumns, readFocusHabitAttribution } from "./focus";
import { establishedGoalColumns, establishedProjectColumns, establishedWorkspaceColumns } from "./phase4SchemaCompatibility";
import { dashboardSummary, recurringLocalDates, shiftLocalDate, type RecurrenceRule, wouldCreateDependencyCycle } from "./plannerRules";
import { incompleteHardPrerequisites } from "../shared/dependencyPolicy";
import { taskPatchForDailyPlanOutcome } from "../shared/dailyPlanResolution";
import { reorderCommittedDailyPlanItems } from "../shared/dailyPlanOrdering";
import { canPersistWeeklyReviewChecklist, normaliseWeeklyReviewChecklist } from "../shared/reviewChecklist";
import { reservationConflictMessage, validateTaskReservation, validateTaskReservationWindow } from "../shared/taskReservation";
import { secureIcsOverlayReadiness } from "../shared/icsOverlay";
import { morningRolloverPreview } from "../shared/morningRollover";
import { validateRecoveryDecision, type RecoveryDecision } from "../shared/recovery";
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

async function assertScopedRecordLinks(db: Awaited<ReturnType<typeof requireDb>>, scope: PlannerScope, input: { goalId?: string | null; projectId?: string | null; categoryId?: string | null; parentTaskId?: string | null; taskId?: string }) {
  const [goal, project, category, parentTask] = await Promise.all([
    input.goalId ? db.select(establishedGoalColumns).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.goalId))).limit(1) : Promise.resolve([]),
    input.projectId ? db.select(establishedProjectColumns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.projectId))).limit(1) : Promise.resolve([]),
    input.categoryId ? db.select().from(categories).where(and(eq(categories.workspaceId, scope.workspaceId), eq(categories.id, input.categoryId))).limit(1) : Promise.resolve([]),
    input.parentTaskId ? db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.parentTaskId))).limit(1) : Promise.resolve([]),
  ]);
  if (input.goalId && !goal[0]) throw new Error("Select a goal from this workspace or clear the goal link.");
  if (input.projectId && !project[0]) throw new Error("Select a project from this workspace or clear the project link.");
  if (input.categoryId && !category[0]) throw new Error("Select a category from this workspace or clear the category link.");
  if (input.parentTaskId && !parentTask[0]) throw new Error("Select a parent task from this workspace or clear the subtask link.");
  if (input.parentTaskId && input.taskId === input.parentTaskId) throw new Error("A task cannot be its own parent.");
  if (goal[0] && project[0]?.goalId && project[0].goalId !== goal[0].id) throw new Error("The selected project is linked to a different goal. Align the goal and project links before saving.");
}

export async function ensureWorkspace(scope: PlannerScope) {
  const db = await requireDb();
  const current = await db.select(establishedWorkspaceColumns).from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1);
  if (current[0]) return current[0];

  await db.insert(workspaces).values({
    id: scope.workspaceId,
    timezone: scope.timezone,
  });
  return (await db.select(establishedWorkspaceColumns).from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1))[0]!;
}

type AccountabilityLevel = "gentle" | "structured" | "strict";

async function hasAccountabilityColumn(db: Awaited<ReturnType<typeof requireDb>>) {
  const result = await db.execute(sql`SELECT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'accountabilityLevel') AS available`);
  return result.rows[0]?.available === true;
}

async function assertGoalParentIsAcyclic(db: Awaited<ReturnType<typeof requireDb>>, scope: PlannerScope, goalId: string, parentGoalId: string | null | undefined) {
  if (!parentGoalId) return;
  if (parentGoalId === goalId) throw new Error("A goal cannot be its own parent.");
  const visited = new Set<string>();
  let currentId: string | null = parentGoalId;
  while (currentId) {
    if (currentId === goalId) throw new Error("This parent would create a goal hierarchy cycle.");
    if (visited.has(currentId)) throw new Error("This goal hierarchy already contains a cycle; choose a different parent.");
    visited.add(currentId);
    if (visited.size > 256) throw new Error("This goal hierarchy is too deep to validate safely.");
    const parentRow: { parentGoalId: string | null } | undefined = (await db.select({ parentGoalId: goals.parentGoalId }).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, currentId))).limit(1))[0];
    if (!parentRow) throw new Error("Select a parent goal from this workspace or clear the parent link.");
    currentId = parentRow.parentGoalId;
  }
}

export class PlannerCapabilityError extends Error {
  constructor(message: string) { super(message); this.name = "PlannerCapabilityError"; }
}

export class PlannerValidationError extends Error {
  constructor(message: string) { super(message); this.name = "PlannerValidationError"; }
}

async function workspaceWithAccountability<T extends { id: string }>(db: Awaited<ReturnType<typeof requireDb>>, workspace: T): Promise<T & { accountabilityLevel: AccountabilityLevel; accountabilityAvailable: boolean }> {
  const accountabilityAvailable = await hasAccountabilityColumn(db);
  if (!accountabilityAvailable) return { ...workspace, accountabilityLevel: "structured" as AccountabilityLevel, accountabilityAvailable };
  const level = await db.select({ accountabilityLevel: workspaces.accountabilityLevel }).from(workspaces).where(eq(workspaces.id, String(workspace.id))).limit(1);
  return { ...workspace, accountabilityLevel: level[0]?.accountabilityLevel ?? "structured", accountabilityAvailable };
}

export async function updateWorkspace(scope: PlannerScope, input: { name?: string; timezone?: string; weekStartsOn?: number; dailyCapacityMinutes?: number; planningDayStartsAt?: string; workdayStartsAt?: string; workdayEndsAt?: string; defaultBreakMinutes?: number; preferredShutdownAt?: string; accountabilityLevel?: AccountabilityLevel; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select(establishedWorkspaceColumns).from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1))[0];
  if (!existing) throw new Error("Workspace was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (input.accountabilityLevel && !await hasAccountabilityColumn(db)) throw new Error("Accountability preferences are available after the Phase 4 workspace migration. No preference was changed.");
  const { expectedVersion, ...patch } = input;
  const changed = await db
    .update(workspaces)
    .set({ ...patch, version: expectedVersion + 1 })
    .where(and(eq(workspaces.id, scope.workspaceId), eq(workspaces.version, expectedVersion))).returning({ id: workspaces.id });
  if (!changed.length) throw new PlannerConflictError(existing);
  const updated = (await db.select(establishedWorkspaceColumns).from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1))[0]!;
  return workspaceWithAccountability(db, updated);
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

/** Only unresolved item owners outside the bounded date window need an additive plan read. */
export function missingCommittedPlanIds(loadedPlans: Array<{ id: string }>, items: Array<{ dailyPlanId: string; state: string }>) {
  const loadedIds = new Set(loadedPlans.map(plan => plan.id));
  return Array.from(new Set(items.filter(item => item.state === "committed" && !loadedIds.has(item.dailyPlanId)).map(item => item.dailyPlanId))).sort();
}

export class RecoveryOperationReuseError extends Error {
  constructor() {
    super("This operation ID was already used for a different Recovery decision.");
  }
}

/** The Phase 4 ledger is optional until its separately approved migration is applied. */
async function hasRecoveryLedger(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const result = await db.execute(sql`SELECT to_regclass('public."commitmentResolutions"') IS NOT NULL AS available`);
  return result.rows[0]?.available === true;
}

async function hasCarryLedger(db: Pick<PlanningDatabase, "execute">) {
  const result = await db.execute(sql`SELECT to_regclass('public."carriedCommitments"') IS NOT NULL AS available`);
  return result.rows[0]?.available === true;
}

const goalIntentionColumnNames = ["intentionKind", "successCriteria", "standards", "reviewCadence", "nextReviewLocalDate"] as const;

async function hasGoalIntentionColumns(db: Pick<PlanningDatabase, "execute">) {
  const result = await db.execute(sql`SELECT count(*) = 5 AS available FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'goals' AND column_name IN (${sql.join(goalIntentionColumnNames.map(name => sql`${name}`), sql`, `)})`);
  return result.rows[0]?.available === true;
}

async function hasProjectRiskColumns(db: Pick<PlanningDatabase, "execute">) {
  const result = await db.execute(sql`SELECT count(*) = 3 AS available FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name IN ('riskLevel', 'riskNote', 'nextReviewLocalDate')`);
  return result.rows[0]?.available === true;
}

async function hasProjectDependenciesTable(db: Pick<PlanningDatabase, "execute">) {
  const result = await db.execute(sql`SELECT to_regclass('public."projectDependencies"') IS NOT NULL AS available`);
  return result.rows[0]?.available === true;
}

const optionalProjectRiskColumns = { riskLevel: projects.riskLevel, riskNote: projects.riskNote, nextReviewLocalDate: projects.nextReviewLocalDate } as const;

const optionalGoalIntentionColumns = {
  intentionKind: goals.intentionKind,
  successCriteria: goals.successCriteria,
  standards: goals.standards,
  reviewCadence: goals.reviewCadence,
  nextReviewLocalDate: goals.nextReviewLocalDate,
} as const;

function goalColumnsWithIntention(available: boolean): typeof establishedGoalColumns & Partial<typeof optionalGoalIntentionColumns> {
  return available ? { ...establishedGoalColumns, ...optionalGoalIntentionColumns } : establishedGoalColumns;
}

type ResolutionRow = typeof commitmentResolutions.$inferSelect;

/** The 0004 ledger predates sourceCarryId; read its established shape without requiring 0005. */
async function readResolutionRows(db: Pick<PlanningDatabase, "execute">, workspaceId: string, operationId?: string): Promise<ResolutionRow[]> {
  const filter = operationId ? sql`AND "operationId" = ${operationId}` : sql``;
  const carryAvailable = await hasCarryLedger(db);
  const carryColumn = carryAvailable ? sql`"sourceCarryId"` : sql`NULL::varchar(64)`;
  const fingerprintColumn = carryAvailable ? sql`"requestFingerprint"` : sql`NULL::varchar(64)`;
  const result = await db.execute(sql`SELECT id, "workspaceId", "operationId", "dailyPlanItemId", "taskId", "occurrenceId",
    ${carryColumn} AS "sourceCarryId", ${carryAvailable ? sql`"sourceCarryVersion"` : sql`NULL::integer`} AS "sourceCarryVersion",
    ${fingerprintColumn} AS "requestFingerprint", action, "originalScope", "revisedScope", "resolvedToLocalDate", "returnLocalDate",
    "decisionNote", timezone, "createdAt", "updatedAt", version FROM "commitmentResolutions"
    WHERE "workspaceId" = ${workspaceId} ${filter} ORDER BY "createdAt", id`);
  return result.rows.map(raw => {
    const row = raw as Record<string, unknown>;
    const timestamp = (value: unknown) => value instanceof Date ? value : new Date(`${String(value).replace(" ", "T")}Z`);
    return { ...row, createdAt: timestamp(row.createdAt), updatedAt: timestamp(row.updatedAt) } as ResolutionRow;
  });
}

export class PlannerPolicyError extends Error {
  constructor(public readonly policyCode: "unresolved_commitment" | "recurring_series", message: string) {
    super(message);
    this.name = "PlannerPolicyError";
  }
}

export async function getWorkspaceSnapshot(scope: PlannerScope, range: { start: string; end: string }) {
  const db = await requireDb();
  const workspace = await workspaceWithAccountability(db, await ensureWorkspace(scope));
  const focusHabitAttributionAvailable = await hasFocusFollowupColumns(db);
  const [goalIntentionAvailable, projectRiskAvailable, projectDependenciesAvailable] = await Promise.all([hasGoalIntentionColumns(db), hasProjectRiskColumns(db), hasProjectDependenciesTable(db)]);
  const [categoryRows, goalRows, milestoneRows, projectRows, taskRows, habitRows, checkInRows, savedViewRows, eventRows, dailyRows, occurrenceRows, reviewRows, planRows, planItemRows, objectiveRows, focusRows, templateRows, proposalRows, dependencyRows, integrationRows, availabilityExceptionRows, projectDependencyRows] = await Promise.all([
    db.select().from(categories).where(eq(categories.workspaceId, scope.workspaceId)).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select(goalColumnsWithIntention(goalIntentionAvailable)).from(goals).where(eq(goals.workspaceId, scope.workspaceId)).orderBy(desc(goals.updatedAt)),
    db.select().from(goalMilestones).where(eq(goalMilestones.workspaceId, scope.workspaceId)).orderBy(asc(goalMilestones.dueLocalDate), desc(goalMilestones.updatedAt)),
    db.select(projectRiskAvailable ? { ...establishedProjectColumns, ...optionalProjectRiskColumns } : establishedProjectColumns).from(projects).where(eq(projects.workspaceId, scope.workspaceId)).orderBy(desc(projects.updatedAt)),
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
    db.select(focusSessionColumns(focusHabitAttributionAvailable)).from(focusSessions).where(and(
      eq(focusSessions.workspaceId, scope.workspaceId),
      or(
        inArray(focusSessions.state, ["active", "paused"]),
        and(
          gte(focusSessions.startedAt, new Date(`${range.start}T00:00:00.000Z`)),
          lte(focusSessions.startedAt, new Date(`${range.end}T23:59:59.999Z`)),
        ),
      ),
    )).orderBy(desc(focusSessions.startedAt)),
    db.select().from(planningTemplates).where(eq(planningTemplates.workspaceId, scope.workspaceId)).orderBy(desc(planningTemplates.updatedAt)),
    db.select().from(scheduleProposals).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), gte(scheduleProposals.localDate, range.start), lte(scheduleProposals.localDate, range.end))).orderBy(desc(scheduleProposals.createdAt)),
    db.select().from(taskDependencies).where(eq(taskDependencies.workspaceId, scope.workspaceId)),
    db.select().from(integrationConnections).where(eq(integrationConnections.workspaceId, scope.workspaceId)).orderBy(desc(integrationConnections.updatedAt)),
    db.select().from(planningAvailabilityExceptions).where(and(eq(planningAvailabilityExceptions.workspaceId, scope.workspaceId), gte(planningAvailabilityExceptions.localDate, range.start), lte(planningAvailabilityExceptions.localDate, range.end))).orderBy(asc(planningAvailabilityExceptions.localDate)),
    projectDependenciesAvailable ? db.select().from(projectDependencies).where(eq(projectDependencies.workspaceId, scope.workspaceId)) : Promise.resolve([]),
  ]);
  const missingPlanIds = missingCommittedPlanIds(planRows, planItemRows);
  const earlierOpenPlans: typeof planRows = [];
  for (let offset = 0; offset < missingPlanIds.length; offset += 500) {
    earlierOpenPlans.push(...await db.select().from(dailyPlans).where(and(
      eq(dailyPlans.workspaceId, scope.workspaceId), inArray(dailyPlans.id, missingPlanIds.slice(offset, offset + 500)), ne(dailyPlans.state, "archived"),
    )));
  }
  const visiblePlans = [...planRows, ...earlierOpenPlans].sort((left, right) => right.localDate.localeCompare(left.localDate) || left.id.localeCompare(right.id));
  const resolutionRows = await hasRecoveryLedger(db) ? await readResolutionRows(db, scope.workspaceId) : [];
  const carryRows = await hasCarryLedger(db) ? await db.select().from(carriedCommitments).where(eq(carriedCommitments.workspaceId, scope.workspaceId)).orderBy(asc(carriedCommitments.targetLocalDate), asc(carriedCommitments.id)) : [];
  const focusHabitAttribution = focusHabitAttributionAvailable ? await readFocusHabitAttribution(db, scope, range) : [];
  return { workspace, focusHabitAttributionAvailable, focusHabitAttribution, goalIntentionAvailable, projectRiskAvailable, projectDependenciesAvailable, categories: categoryRows, goals: goalRows, milestones: milestoneRows, projects: projectRows, projectDependencies: projectDependencyRows, tasks: taskRows, habits: habitRows, habitCheckIns: checkInRows, savedViews: savedViewRows, externalEvents: eventRows, dailyCheckIns: dailyRows, taskOccurrences: occurrenceRows, reviewSessions: reviewRows, dailyPlans: visiblePlans, dailyPlanItems: planItemRows, commitmentResolutions: resolutionRows, carriedCommitments: carryRows, weeklyObjectives: objectiveRows, focusSessions: focusRows, planningTemplates: templateRows, scheduleProposals: proposalRows, taskDependencies: dependencyRows, integrationConnections: integrationRows, planningAvailabilityExceptions: availabilityExceptionRows, icsOverlay: secureIcsOverlayReadiness(process.env) };
}

export type WorkspaceSearchResult = { id: string; title: string; summary: string | null; state: string; updatedAt: Date; entity: SearchRecordEntity; intentionKind?: "outcome" | "direction" | null };

export async function searchWorkspace(scope: PlannerScope, input: { query: string; limit: number }): Promise<WorkspaceSearchResult[]> {
  const db = await requireDb();
  const phrase = input.query.trim().replace(/[\\%_]/g, "\\$&");
  const pattern = `%${phrase}%`;
  const intentionAvailable = await hasGoalIntentionColumns(db);
  const goalProjection: any = intentionAvailable
    ? { id: goals.id, title: goals.title, summary: goals.description, state: goals.state, intentionKind: goals.intentionKind, updatedAt: goals.updatedAt }
    : { id: goals.id, title: goals.title, summary: goals.description, state: goals.state, updatedAt: goals.updatedAt };
  const [taskRows, goalRows, projectRows, habitRows, reviewRows] = await Promise.all([
    db.select({ id: tasks.id, title: tasks.title, summary: tasks.description, state: tasks.state, updatedAt: tasks.updatedAt }).from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), or(like(tasks.title, pattern), like(tasks.description, pattern)))).orderBy(desc(tasks.updatedAt)).limit(input.limit),
    db.select(goalProjection).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), or(like(goals.title, pattern), like(goals.description, pattern)))).orderBy(desc(goals.updatedAt)).limit(input.limit) as Promise<any[]>,
    db.select({ id: projects.id, title: projects.title, summary: projects.description, state: projects.state, updatedAt: projects.updatedAt }).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), or(like(projects.title, pattern), like(projects.description, pattern)))).orderBy(desc(projects.updatedAt)).limit(input.limit),
    db.select({ id: habits.id, title: habits.name, summary: habits.description, state: habits.archivedAt, updatedAt: habits.updatedAt }).from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), or(like(habits.name, pattern), like(habits.description, pattern)))).orderBy(desc(habits.updatedAt)).limit(input.limit),
    db.select({ id: reviewSessions.id, kind: reviewSessions.kind, reflection: reviewSessions.reflection, state: reviewSessions.state, periodStartLocalDate: reviewSessions.periodStartLocalDate, periodEndLocalDate: reviewSessions.periodEndLocalDate, updatedAt: reviewSessions.updatedAt }).from(reviewSessions).where(and(eq(reviewSessions.workspaceId, scope.workspaceId), or(like(reviewSessions.reflection, pattern), like(reviewSessions.kind, pattern)))).orderBy(desc(reviewSessions.updatedAt)).limit(input.limit),
  ]);
  const results: WorkspaceSearchResult[] = [
    ...taskRows.map(row => ({ ...row, entity: "task" as const })),
    ...goalRows.map(row => ({ ...row, entity: "goal" as const })) as WorkspaceSearchResult[],
    ...projectRows.map(row => ({ ...row, entity: "project" as const })),
    ...habitRows.map(row => ({ id: row.id, title: row.title, summary: row.summary, state: row.state ? "archived" : "active", updatedAt: row.updatedAt, entity: "habit" as const })),
    ...reviewRows.map(row => ({ id: row.id, title: `${row.kind} review · ${row.periodStartLocalDate} to ${row.periodEndLocalDate}`, summary: row.reflection, state: row.state, updatedAt: row.updatedAt, entity: "review" as const })),
  ].sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()).slice(0, input.limit);
  return results;
}

/** Rejects terminal parent-task outcomes while a saved, non-archived plan still owns an open commitment. */
export async function assertNoOutstandingTaskCommitments(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, scope: PlannerScope, taskIds: string[]) {
  if (!taskIds.length) return;
  const items = await db.select({ dailyPlanId: dailyPlanItems.dailyPlanId }).from(dailyPlanItems).where(and(
    eq(dailyPlanItems.workspaceId, scope.workspaceId), inArray(dailyPlanItems.taskId, taskIds), eq(dailyPlanItems.state, "committed"),
  ));
  const planIds = Array.from(new Set(items.map(item => item.dailyPlanId).filter((id): id is string => typeof id === "string")));
  if (!planIds.length) return;
  const openPlans = await db.select({ id: dailyPlans.id }).from(dailyPlans).where(and(
    eq(dailyPlans.workspaceId, scope.workspaceId), inArray(dailyPlans.id, planIds), ne(dailyPlans.state, "archived"),
  ));
  if (openPlans.length) throw new PlannerPolicyError("unresolved_commitment", "This task has an unresolved daily commitment. Reconcile its saved plan history before completing or archiving the parent task; nothing was changed.");
}

export type SearchRecordEntity = "task" | "goal" | "project" | "habit" | "review";

/** Reads one canonical Search result inside the authenticated workspace scope. */
export async function getSearchRecord(scope: PlannerScope, input: { entity: SearchRecordEntity; id: string }) {
  const db = await requireDb();
  if (input.entity === "task") {
    return (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.id))).limit(1))[0] ?? null;
  }
  if (input.entity === "goal") {
    const intentionAvailable = await hasGoalIntentionColumns(db);
    return (await db.select(goalColumnsWithIntention(intentionAvailable)).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0] ?? null;
  }
  if (input.entity === "project") {
    return (await db.select(establishedProjectColumns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0] ?? null;
  }
  if (input.entity === "habit") {
    return (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.id))).limit(1))[0] ?? null;
  }
  return (await db.select().from(reviewSessions).where(and(eq(reviewSessions.workspaceId, scope.workspaceId), eq(reviewSessions.id, input.id))).limit(1))[0] ?? null;
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
  const hasIntentionInput = goalIntentionColumnNames.some(key => input[key] !== undefined && input[key] !== null);
  const intentionAvailable = hasIntentionInput ? await hasGoalIntentionColumns(db) : false;
  if (hasIntentionInput && !intentionAvailable) throw new PlannerCapabilityError("Outcome and Direction details are unavailable until the approved Phase 4 schema migration is applied. No goal was created.");
  await assertScopedRecordLinks(db, scope, { categoryId: input.categoryId, goalId: input.parentGoalId });
  const id = nanoid();
  await assertGoalParentIsAcyclic(db, scope, id, input.parentGoalId);
  if (!intentionAvailable) {
    // Drizzle's insert serializer includes newly declared optional fields as
    // DEFAULT columns. Use the established pre-0004 column set explicitly.
    await db.execute(sql`INSERT INTO "goals" ("id", "workspaceId", "categoryId", "parentGoalId", "title", "description", "state", "priority", "horizon", "color", "progressMode", "progressValue", "targetValue", "startLocalDate", "dueLocalDate")
      VALUES (${id}, ${scope.workspaceId}, ${input.categoryId ?? null}, ${input.parentGoalId ?? null}, ${input.title}, ${input.description ?? null}, ${input.state ?? "not_started"}, ${input.priority ?? "medium"}, ${input.horizon ?? "yearly"}, ${input.color ?? null}, ${input.progressMode ?? "task"}, ${input.progressValue ?? 0}, ${input.targetValue ?? 100}, ${input.startLocalDate ?? null}, ${input.dueLocalDate ?? null})`);
  } else {
    await db.insert(goals).values({ id, workspaceId: scope.workspaceId, ...input });
  }
  return (await db.select(goalColumnsWithIntention(intentionAvailable)).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, id))).limit(1))[0]!;
}

export async function archiveGoal(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select(establishedGoalColumns).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Goal was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(goals).set({ state: "archived", archivedAt: new Date(), version: input.expectedVersion + 1 }).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id), eq(goals.version, input.expectedVersion)));
  const updated = (await db.select(establishedGoalColumns).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

/** Restores an archived goal as unfinished work while preserving every linked history record. */
export async function restoreGoal(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select(establishedGoalColumns).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Goal was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(goals).set({ state: "not_started", completedAt: null, archivedAt: null, version: input.expectedVersion + 1 }).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id), eq(goals.version, input.expectedVersion)));
  const updated = (await db.select(establishedGoalColumns).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0]!;
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
  await assertScopedRecordLinks(db, scope, { goalId: input.goalId, categoryId: input.categoryId });
  const id = nanoid();
  await db.insert(projects).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select(establishedProjectColumns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, id))).limit(1))[0]!;
}

export async function archiveProject(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select(establishedProjectColumns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Project was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(projects).set({ state: "archived", archivedAt: new Date(), version: input.expectedVersion + 1 }).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id), eq(projects.version, input.expectedVersion)));
  const updated = (await db.select(establishedProjectColumns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

/** Restores an archived project as unfinished work while retaining linked task history. */
export async function restoreProject(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const existing = (await db.select(establishedProjectColumns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Project was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await db.update(projects).set({ state: "not_started", completedAt: null, archivedAt: null, version: input.expectedVersion + 1 }).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id), eq(projects.version, input.expectedVersion)));
  const updated = (await db.select(establishedProjectColumns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function createTask(scope: PlannerScope, input: Omit<typeof tasks.$inferInsert, "id" | "workspaceId" | "createdAt" | "updatedAt" | "version" | "completedAt" | "archivedAt">) {
  const db = await requireDb();
  if (input.clientRequestId) {
    const existing = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.clientRequestId, input.clientRequestId))).limit(1))[0];
    if (existing) return existing;
  }
  await assertScopedRecordLinks(db, scope, { goalId: input.goalId, projectId: input.projectId, categoryId: input.categoryId, parentTaskId: input.parentTaskId });
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
  await assertScopedRecordLinks(db, scope, {
    goalId: input.patch.goalId === undefined ? existing.goalId : input.patch.goalId,
    projectId: input.patch.projectId === undefined ? existing.projectId : input.patch.projectId,
    categoryId: input.patch.categoryId === undefined ? existing.categoryId : input.patch.categoryId,
    parentTaskId: input.patch.parentTaskId === undefined ? existing.parentTaskId : input.patch.parentTaskId,
    taskId: existing.id,
  });
  if (input.patch.state === "completed" || input.patch.state === "archived" || input.patch.outcome === "wont_do") {
    if (existing.recurrenceRule) throw new PlannerPolicyError("recurring_series", "A recurring series needs dated occurrence resolution before its parent task can receive a terminal outcome.");
    await assertNoOutstandingTaskCommitments(db, scope, [existing.id]);
  }
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

/**
 * Creates, moves, or resizes the one calendar projection owned by a task.
 * The task reservation is intentionally separate from approval-first flexible proposals.
 */
export async function reserveTask(scope: PlannerScope, input: { id: string; expectedVersion: number; localDate: string; plannedStartAt: Date; plannedEndAt: Date }) {
  const db = await requireDb();
  const [task, otherTasks, events, workspaceRows, exceptionRows] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.id))).limit(1),
    db.select().from(tasks).where(eq(tasks.workspaceId, scope.workspaceId)),
    db.select().from(externalEvents).where(and(eq(externalEvents.workspaceId, scope.workspaceId), eq(externalEvents.status, "active"))),
    db.select(establishedWorkspaceColumns).from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1),
    db.select().from(planningAvailabilityExceptions).where(and(eq(planningAvailabilityExceptions.workspaceId, scope.workspaceId), eq(planningAvailabilityExceptions.localDate, input.localDate))).limit(1),
  ]);
  const existing = task[0];
  if (!existing) throw new Error("Task was not found.");
  const workspace = workspaceRows[0];
  if (!workspace) throw new Error("Planning workspace was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.state === "completed" || existing.state === "archived") throw new Error("Completed or archived tasks cannot reserve calendar time. Restore the task before planning it.");

  const validation = validateTaskReservation({ localDate: input.localDate, timezone: scope.timezone, plannedStartAt: input.plannedStartAt, plannedEndAt: input.plannedEndAt });
  if (validation) throw new Error(validation);
  const exception = exceptionRows[0];
  const workWindowValidation = validateTaskReservationWindow({ timezone: scope.timezone, plannedStartAt: input.plannedStartAt, plannedEndAt: input.plannedEndAt, workdayStartsAt: exception?.isUnavailable ? "00:00" : (exception?.workdayStartsAt ?? workspace.workdayStartsAt), workdayEndsAt: exception?.isUnavailable ? "00:00" : (exception?.workdayEndsAt ?? workspace.workdayEndsAt) });
  if (workWindowValidation) throw new Error(workWindowValidation);
  const busyIntervals = [
    ...otherTasks.filter(item => item.id !== existing.id && item.state !== "completed" && item.state !== "archived" && item.plannedStartAt && item.plannedEndAt).map(item => ({ startsAt: item.plannedStartAt!, endsAt: item.plannedEndAt! })),
    ...events.map(event => ({ startsAt: event.startsAt, endsAt: event.endsAt })),
  ];
  const conflict = reservationConflictMessage({ startsAt: input.plannedStartAt, endsAt: input.plannedEndAt }, busyIntervals);
  if (conflict) throw new Error(conflict);

  await db.update(tasks).set({ scheduledLocalDate: input.localDate, plannedStartAt: input.plannedStartAt, plannedEndAt: input.plannedEndAt, scheduleMode: existing.scheduleMode === "pinned" ? "pinned" : "manual", version: input.expectedVersion + 1 }).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.id), eq(tasks.version, input.expectedVersion)));
  const updated = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.id))).limit(1))[0]!;
  if (updated.version === existing.version) throw new PlannerConflictError(updated);
  return updated;
}

function currentLocalDate(timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(value => value.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function assertCompletedRolloverDay(scope: PlannerScope, fromLocalDate: string) {
  if (fromLocalDate >= currentLocalDate(scope.timezone)) throw new Error("Choose a completed local planning day before applying morning rollover. Today and future reservations stay unchanged.");
}

/** Returns only tasks that could be manually returned to unreserved work; it makes no change. */
export async function getMorningRolloverPreview(scope: PlannerScope, input: { fromLocalDate: string }) {
  assertCompletedRolloverDay(scope, input.fromLocalDate);
  const db = await requireDb();
  const [workspaceTasks, previous] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.scheduledLocalDate, input.fromLocalDate))),
    db.select({ taskId: taskReservationRollovers.taskId }).from(taskReservationRollovers).where(and(eq(taskReservationRollovers.workspaceId, scope.workspaceId), eq(taskReservationRollovers.fromLocalDate, input.fromLocalDate))),
  ]);
  return { fromLocalDate: input.fromLocalDate, candidates: morningRolloverPreview(workspaceTasks, input.fromLocalDate, previous.map(item => item.taskId)) };
}

/** Idempotently clears only reservation fields after a user reviews the prior-day candidate list. */
export async function applyMorningRollover(scope: PlannerScope, input: { fromLocalDate: string; tasks: Array<{ id: string; expectedVersion: number }> }) {
  assertCompletedRolloverDay(scope, input.fromLocalDate);
  if (input.tasks.length > 100) throw new Error("Review at most 100 rollover items at a time.");
  const db = await requireDb();
  let applied = 0;
  let alreadyApplied = 0;
  await db.transaction(async tx => {
    for (const requested of input.tasks) {
      const [task, existingAudit] = await Promise.all([
        tx.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, requested.id))).limit(1),
        tx.select().from(taskReservationRollovers).where(and(eq(taskReservationRollovers.workspaceId, scope.workspaceId), eq(taskReservationRollovers.taskId, requested.id), eq(taskReservationRollovers.fromLocalDate, input.fromLocalDate))).limit(1),
      ]);
      if (existingAudit[0]) { alreadyApplied += 1; continue; }
      const current = task[0];
      if (!current) throw new Error("A rollover task was not found in this workspace.");
      if (current.version !== requested.expectedVersion) throw new PlannerConflictError(current);
      if (!morningRolloverPreview([current], input.fromLocalDate, []).length) throw new Error("This task no longer has an unfinished reservation for the selected completed day. Refresh the review before applying it.");
      await tx.insert(taskReservationRollovers).values({ id: nanoid(), workspaceId: scope.workspaceId, taskId: current.id, fromLocalDate: input.fromLocalDate, priorPlannedStartAt: current.plannedStartAt!, priorPlannedEndAt: current.plannedEndAt! });
      await tx.update(tasks).set({ plannedStartAt: null, plannedEndAt: null, rescheduleCount: sql`${tasks.rescheduleCount} + 1`, version: current.version + 1 }).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, current.id), eq(tasks.version, current.version)));
      const updated = (await tx.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, current.id))).limit(1))[0];
      if (!updated || updated.version !== current.version + 1 || updated.plannedStartAt || updated.plannedEndAt) throw new PlannerConflictError(updated ?? current);
      applied += 1;
    }
  });
  return { fromLocalDate: input.fromLocalDate, applied, alreadyApplied };
}

export async function bulkSetTaskState(scope: PlannerScope, input: { ids: string[]; state: "not_started" | "in_progress" | "blocked" | "completed" | "archived" }) {
  if (!input.ids.length) return [];
  const db = await requireDb();
  if (input.state === "completed" || input.state === "archived") {
    const selectedTasks = await db.select({ id: tasks.id, recurrenceRule: tasks.recurrenceRule }).from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), inArray(tasks.id, input.ids)));
    if (selectedTasks.some(task => task.recurrenceRule)) throw new PlannerPolicyError("recurring_series", "A recurring series needs dated occurrence resolution before its parent task can receive a terminal outcome.");
    await assertNoOutstandingTaskCommitments(db, scope, input.ids);
  }
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
  if (existing.state === "closed" && nextState !== "closed" && !(input.state === "active" && input.expectedVersion !== undefined)) {
    throw new Error("Reopen a closed daily plan explicitly with its current version.");
  }
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
  if ((input.state && input.state !== "committed") || input.resolvedToLocalDate !== undefined || (existing.state !== "committed" && (input.state !== undefined || input.note !== undefined))) {
    if (await hasRecoveryLedger(db)) throw new Error("Use Recovery to record or revise a daily outcome with its history.");
  }
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
  if (await hasRecoveryLedger(db)) {
    if (input.state === "deferred" || input.state === "archived") throw new Error("Use Recovery to choose Reduce, Pause with a return date, or Abandon. This legacy outcome cannot preserve the required decision history.");
    const action = input.state === "rescheduled" ? "reschedule" : input.state === "wont_do" ? "abandon" : "done";
    await resolveCommitment(scope, validateRecoveryDecision({
      operationId: nanoid(), dailyPlanItemId: item.id, taskId: item.taskId,
      itemExpectedVersion: input.expectedVersion, taskExpectedVersion: input.taskExpectedVersion,
      action,
      ...(action === "reschedule" ? { resolvedToLocalDate: input.resolvedToLocalDate } : {}),
      ...(input.note ? { decisionNote: input.note } : {}),
    }));
    return (await db.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, item.id))).limit(1))[0]!;
  }
  const linkedTask = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, item.taskId))).limit(1))[0];
  if (!linkedTask) throw new Error("The task linked to this commitment no longer exists.");
  if (linkedTask.version !== input.taskExpectedVersion) throw new PlannerConflictError(linkedTask);
  if (item.state !== "committed") throw new Error("This daily commitment already has an outcome. Refresh before changing it.");
  if (linkedTask.state === "completed" || linkedTask.state === "archived" || linkedTask.outcome === "wont_do") {
    throw new Error("Needs reconciliation in Recovery: this commitment is still open, but its linked task already has a final outcome. No history was changed.");
  }
  const occurrenceHistory = linkedTask.recurrenceRule
    ? []
    : await db.select({ id: taskOccurrences.id }).from(taskOccurrences).where(and(eq(taskOccurrences.workspaceId, scope.workspaceId), eq(taskOccurrences.taskId, linkedTask.id))).limit(1);
  if (linkedTask.recurrenceRule || occurrenceHistory.length) {
    throw new Error("Recurring commitments need the recovery flow after migration. No task or dated history was changed.");
  }
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
  await assertScopedRecordLinks(db, scope, { goalId: input.goalId, projectId: input.projectId });
  const id = nanoid();
  await db.insert(weeklyObjectives).values({ id, workspaceId: scope.workspaceId, ...input, state: "active" });
  return (await db.select().from(weeklyObjectives).where(and(eq(weeklyObjectives.workspaceId, scope.workspaceId), eq(weeklyObjectives.id, id))).limit(1))[0]!;
}

export async function updateWeeklyObjective(scope: PlannerScope, input: { id: string; expectedVersion: number; patch: { title?: string; description?: string | null; goalId?: string | null; projectId?: string | null; state?: "active" | "completed" | "continued" | "adjusted" | "archived"; evidence?: string | null } }) {
  const db = await requireDb();
  const existing = (await db.select().from(weeklyObjectives).where(and(eq(weeklyObjectives.workspaceId, scope.workspaceId), eq(weeklyObjectives.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Weekly objective was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  const evidence = input.patch.evidence === undefined ? existing.evidence : input.patch.evidence;
  const remainsCompleted = (input.patch.state ?? existing.state) === "completed";
  if (remainsCompleted && (input.patch.state === "completed" || input.patch.evidence !== undefined) && !evidence?.trim()) {
    throw new Error("Record what happened before completing this weekly objective. Completion needs real evidence.");
  }
  await assertScopedRecordLinks(db, scope, {
    goalId: input.patch.goalId === undefined ? existing.goalId : input.patch.goalId,
    projectId: input.patch.projectId === undefined ? existing.projectId : input.patch.projectId,
  });
  const patch: Record<string, unknown> = { ...input.patch, version: input.expectedVersion + 1 };
  if (typeof input.patch.evidence === "string") patch.evidence = input.patch.evidence.trim();
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
  await assertScopedRecordLinks(db, scope, { goalId: input.goalId, categoryId: input.categoryId });
  const id = nanoid();
  await db.insert(habits).values({ id, workspaceId: scope.workspaceId, ...input });
  return (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, id))).limit(1))[0]!;
}

type HabitPatch = Partial<Pick<typeof habits.$inferInsert,
  "name" | "description" | "goalId" | "categoryId" | "color" | "frequency" | "schedule" | "reminderTime">>;

function validatedHabitSchedule(frequency: typeof habits.$inferSelect.frequency, existing: unknown, incoming: unknown): Record<string, unknown> {
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) throw new PlannerValidationError("Choose a valid habit schedule.");
  const previous = existing && typeof existing === "object" && !Array.isArray(existing) ? existing as Record<string, unknown> : {};
  const schedule = { ...previous, ...incoming as Record<string, unknown> };
  for (const key of ["pauseUntilLocalDate", "pauseStartedLocalDate", "returnAcknowledgedAtLocalDate"] as const) {
    if (schedule[key] === null) delete schedule[key];
    else if (schedule[key] !== undefined && (typeof schedule[key] !== "string" || !validProjectLocalDate(schedule[key]))) {
      throw new PlannerValidationError("Habit return dates must be real calendar dates in YYYY-MM-DD format.");
    }
  }
  if (schedule.startLocalDate !== undefined && (typeof schedule.startLocalDate !== "string" || !validProjectLocalDate(schedule.startLocalDate))) {
    throw new PlannerValidationError("Habit start date must be a real calendar date in YYYY-MM-DD format.");
  }
  if (schedule.pauseUntilLocalDate && schedule.pauseStartedLocalDate && schedule.pauseUntilLocalDate <= schedule.pauseStartedLocalDate) {
    throw new PlannerValidationError("Habit review date must be after the pause start date.");
  }
  if (frequency === "days_of_week") {
    const weekdays = schedule.weekdays;
    if (!Array.isArray(weekdays) || !weekdays.length || weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(weekdays).size !== weekdays.length) {
      throw new PlannerValidationError("Choose distinct scheduled weekdays from Sunday (0) through Saturday (6).");
    }
  } else if (frequency === "times_per_week") {
    const quota = schedule.timesPerWeek ?? schedule.targetPerWeek ?? schedule.count;
    if (!Number.isInteger(quota) || (quota as number) < 1 || (quota as number) > 7) {
      throw new PlannerValidationError("Choose a habit target of one to seven times per week.");
    }
  } else if (frequency === "interval") {
    if (!Number.isSafeInteger(schedule.intervalDays) || (schedule.intervalDays as number) < 1 || !schedule.startLocalDate) {
      throw new PlannerValidationError("Choose a positive interval and a real start date.");
    }
  } else if (frequency !== "daily") {
    throw new PlannerValidationError("Choose a supported habit frequency.");
  }
  return schedule;
}

/** Edits established habit columns only; schedule metadata stays inside the existing JSON column. */
export async function updateHabit(scope: PlannerScope, input: { id: string; expectedVersion: number; patch: HabitPatch }) {
  const db = await requireDb();
  const existing = (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Habit was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  if (existing.archivedAt) throw new PlannerValidationError("Restore this archived habit before editing it.");
  if (!Object.keys(input.patch).length) throw new PlannerValidationError("Choose at least one habit field to change.");
  if (input.patch.name !== undefined && (!input.patch.name.trim() || input.patch.name.length > 160)) throw new PlannerValidationError("Name the habit in 160 characters or fewer.");
  if (input.patch.description != null && input.patch.description.length > 10000) throw new PlannerValidationError("Habit description is too long.");
  if (input.patch.color !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(input.patch.color)) throw new PlannerValidationError("Choose a six-digit habit color.");
  if (input.patch.reminderTime != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.patch.reminderTime)) throw new PlannerValidationError("Habit reminder time must be a valid local time.");
  await assertScopedRecordLinks(db, scope, { goalId: input.patch.goalId, categoryId: input.patch.categoryId });
  const patch = { ...input.patch, updatedAt: new Date(), version: input.expectedVersion + 1 };
  if (input.patch.name !== undefined) patch.name = input.patch.name.trim();
  if (input.patch.schedule !== undefined || input.patch.frequency !== undefined) {
    patch.schedule = validatedHabitSchedule(input.patch.frequency ?? existing.frequency, existing.schedule, input.patch.schedule ?? existing.schedule);
  }
  const changed = await db.update(habits).set(patch).where(and(
    eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.id), eq(habits.version, input.expectedVersion), sql`${habits.archivedAt} IS NULL`
  )).returning({ id: habits.id });
  if (!changed.length) throw new PlannerConflictError(existing);
  return (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.id))).limit(1))[0]!;
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

type ExpectedHabitCheckIn = { id: string; version: number };

export async function upsertHabitCheckIn(scope: PlannerScope, input: { habitId: string; localDate: string; state: "completed" | "skipped" | "missed"; note?: string | null; expectedCheckIn?: ExpectedHabitCheckIn | null }) {
  const db = await requireDb();
  const habit = (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.habitId))).limit(1))[0];
  if (!habit) throw new Error("Habit was not found.");
  if (habit.archivedAt) throw new PlannerValidationError("Restore this archived habit before recording it.");
  if (!validProjectLocalDate(input.localDate) || input.localDate > currentLocalDate(scope.timezone)) {
    throw new PlannerValidationError("Record a real local date no later than today.");
  }
  const completedAt = input.state === "completed" ? new Date() : null;
  const scopedDate = and(eq(habitCheckIns.workspaceId, scope.workspaceId), eq(habitCheckIns.habitId, input.habitId), eq(habitCheckIns.localDate, input.localDate));
  if (input.expectedCheckIn) {
    const changed = await db.update(habitCheckIns).set({
      state: input.state,
      ...(input.note !== undefined ? { note: input.note } : {}),
      completedAt,
      timezoneAtCheckIn: scope.timezone,
      updatedAt: new Date(),
      version: input.expectedCheckIn.version + 1,
    }).where(and(scopedDate, eq(habitCheckIns.id, input.expectedCheckIn.id), eq(habitCheckIns.version, input.expectedCheckIn.version))).returning();
    if (changed[0]) return changed[0];
  } else {
    // Both explicit null and older callers may create an empty date, but neither may replace its record.
    const created = await db.insert(habitCheckIns).values({
      id: nanoid(), workspaceId: scope.workspaceId, habitId: input.habitId, localDate: input.localDate,
      timezoneAtCheckIn: scope.timezone, state: input.state, note: input.note ?? null, completedAt,
    }).onConflictDoNothing({ target: [habitCheckIns.habitId, habitCheckIns.localDate] }).returning();
    if (created[0]) return created[0];
  }
  const current = (await db.select().from(habitCheckIns).where(scopedDate).limit(1))[0] ?? null;
  throw new PlannerConflictError(current);
}

/** Clears only the exact version the caller saw; a retry is harmless until a new row appears. */
export async function clearHabitCheckIn(scope: PlannerScope, input: { habitId: string; localDate: string; expectedCheckIn?: ExpectedHabitCheckIn }) {
  const db = await requireDb();
  const habit = (await db.select().from(habits).where(and(eq(habits.workspaceId, scope.workspaceId), eq(habits.id, input.habitId))).limit(1))[0];
  if (!habit) throw new Error("Habit was not found.");
  if (habit.archivedAt) throw new PlannerValidationError("Restore this archived habit before changing its history.");
  if (!validProjectLocalDate(input.localDate) || input.localDate > currentLocalDate(scope.timezone)) {
    throw new PlannerValidationError("Change a real local date no later than today.");
  }
  const scopedDate = and(eq(habitCheckIns.workspaceId, scope.workspaceId), eq(habitCheckIns.habitId, input.habitId), eq(habitCheckIns.localDate, input.localDate));
  if (input.expectedCheckIn) {
    const removed = await db.delete(habitCheckIns).where(and(scopedDate,
      eq(habitCheckIns.id, input.expectedCheckIn.id), eq(habitCheckIns.version, input.expectedCheckIn.version)
    )).returning({ id: habitCheckIns.id });
    if (removed.length) return { habitId: input.habitId, localDate: input.localDate, cleared: true } as const;
  }
  const current = (await db.select().from(habitCheckIns).where(scopedDate).limit(1))[0] ?? null;
  if (current) throw new PlannerConflictError(current);
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
  const dailyInsert = db.insert(dailyCheckIns).values({ id, workspaceId: scope.workspaceId, ...input });
  if (typeof (dailyInsert as any).onConflictDoUpdate === "function") {
    await (dailyInsert as any).onConflictDoUpdate({ target: [dailyCheckIns.workspaceId, dailyCheckIns.localDate], set: input });
  } else {
    await (dailyInsert as any).onDuplicateKeyUpdate({ set: input });
  }
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
  const pushValues = {
    id,
    workspaceId: scope.workspaceId,
    endpoint: input.endpoint,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    deviceLabel: input.deviceLabel?.trim().slice(0, 120) || null,
    userAgent: input.userAgent?.slice(0, 512) || null,
    status: "active" as const,
    failureReason: null,
    lastSeenAt: now,
  };
  const pushInsert = db.insert(pushSubscriptions).values(pushValues);
  const pushUpdate = {
    workspaceId: scope.workspaceId,
    p256dh: input.keys.p256dh,
    auth: input.keys.auth,
    deviceLabel: input.deviceLabel?.trim().slice(0, 120) || null,
    userAgent: input.userAgent?.slice(0, 512) || null,
    status: "active" as const,
    failureReason: null,
    lastSeenAt: now,
  };
  if (typeof (pushInsert as any).onConflictDoUpdate === "function") {
    await (pushInsert as any).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: pushUpdate });
  } else {
    await (pushInsert as any).onDuplicateKeyUpdate({ set: pushUpdate });
  }
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
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
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

type ProjectPatch = Partial<Pick<typeof projects.$inferInsert,
  "title" | "description" | "goalId" | "categoryId" | "state" | "priority" | "horizon" | "startLocalDate" | "dueLocalDate" |
  "riskLevel" | "riskNote" | "nextReviewLocalDate">>;

function validProjectLocalDate(value: string | null | undefined) {
  if (value == null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Established project fields work before 0004; risk/review writes require its columns. */
export async function updateProject(scope: PlannerScope, input: { id: string; expectedVersion: number; patch: ProjectPatch }) {
  const db = await requireDb();
  const riskKeys = ["riskLevel", "riskNote", "nextReviewLocalDate"] as const;
  const hasRiskPatch = riskKeys.some(key => input.patch[key] !== undefined);
  const riskAvailable = hasRiskPatch ? await hasProjectRiskColumns(db) : false;
  if (hasRiskPatch && !riskAvailable) throw new PlannerCapabilityError("Project risk and review details are unavailable until the approved Phase 4 schema migration is applied. No project was changed.");
  if (!Object.keys(input.patch).length) throw new PlannerValidationError("Choose at least one project field to change.");
  const columns = riskAvailable ? { ...establishedProjectColumns, ...optionalProjectRiskColumns } : establishedProjectColumns;
  await assertScopedRecordLinks(db, scope, { goalId: input.patch.goalId, categoryId: input.patch.categoryId });
  return db.transaction(async tx => {
    const hasDatePatch = input.patch.startLocalDate !== undefined || input.patch.dueLocalDate !== undefined;
    // Edge edits use this same workspace lock, so a date check cannot race an edge change.
    if (hasDatePatch) {
      const locked = await tx.execute(sql`SELECT id FROM workspaces WHERE id = ${scope.workspaceId} FOR UPDATE`);
      if (!locked.rows.length) throw new Error("Workspace was not found.");
    }
    const existing = (await tx.select(columns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0];
    if (!existing) throw new Error("Project was not found.");
    if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
    const start = input.patch.startLocalDate === undefined ? existing.startLocalDate : input.patch.startLocalDate;
    const due = input.patch.dueLocalDate === undefined ? existing.dueLocalDate : input.patch.dueLocalDate;
    if (!validProjectLocalDate(start) || !validProjectLocalDate(due) || !validProjectLocalDate(input.patch.nextReviewLocalDate)) {
      throw new PlannerValidationError("Project dates must be real calendar dates in YYYY-MM-DD format.");
    }
    if (start && due && start > due) throw new PlannerValidationError("Project start date must be on or before its due date.");
    if (hasDatePatch && (start !== existing.startLocalDate || due !== existing.dueLocalDate) && await hasProjectDependenciesTable(tx)) {
      const edges = await tx.select({ projectId: projectDependencies.projectId, dependsOnProjectId: projectDependencies.dependsOnProjectId })
        .from(projectDependencies).where(and(eq(projectDependencies.workspaceId, scope.workspaceId), eq(projectDependencies.dependencyType, "hard"),
          or(eq(projectDependencies.projectId, input.id), eq(projectDependencies.dependsOnProjectId, input.id))));
      const otherIds = Array.from(new Set(edges.map(edge => edge.projectId === input.id ? edge.dependsOnProjectId : edge.projectId)));
      if (otherIds.length) {
        const others = await tx.select({ id: projects.id, startLocalDate: projects.startLocalDate, dueLocalDate: projects.dueLocalDate })
          .from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), inArray(projects.id, otherIds)));
        const byId = new Map(others.map(project => [project.id, project]));
        for (const edge of edges) {
          const other = byId.get(edge.projectId === input.id ? edge.dependsOnProjectId : edge.projectId);
          if (!other) continue;
          const previousStart = edge.projectId === input.id ? existing.startLocalDate : other.startLocalDate;
          const previousDue = edge.dependsOnProjectId === input.id ? existing.dueLocalDate : other.dueLocalDate;
          const nextStart = edge.projectId === input.id ? start : other.startLocalDate;
          const nextDue = edge.dependsOnProjectId === input.id ? due : other.dueLocalDate;
          if (nextStart && nextDue && nextDue > nextStart && !(previousStart && previousDue && previousDue > previousStart)) {
            throw new PlannerValidationError("Project dates conflict with a hard dependency: the prerequisite is due after the dependent project starts.");
          }
        }
      }
    }
    const patch: Record<string, unknown> = { ...input.patch, updatedAt: new Date(), version: input.expectedVersion + 1 };
    if (patch.state === "completed" && !existing.completedAt) patch.completedAt = new Date();
    if (patch.state && patch.state !== "completed") patch.completedAt = null;
    if (patch.state === "archived") patch.archivedAt = new Date();
    const changed = await tx.update(projects).set(patch).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id), eq(projects.version, input.expectedVersion))).returning({ id: projects.id });
    if (!changed.length) throw new PlannerConflictError(existing);
    return (await tx.select(columns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.id))).limit(1))[0]!;
  });
}

async function requireProjectDependencies(db: Awaited<ReturnType<typeof requireDb>>) {
  if (!await hasProjectDependenciesTable(db)) throw new PlannerCapabilityError("Project dependencies are unavailable until the approved Phase 4 schema migration is applied. No dependency was changed.");
}

/** Serialize edge edits in a workspace so concurrent additions cannot form a cycle. */
export async function addProjectDependency(scope: PlannerScope, input: { projectId: string; dependsOnProjectId: string; dependencyType: "hard" | "soft"; expectedVersion: number }) {
  const db = await requireDb();
  await requireProjectDependencies(db);
  return db.transaction(async tx => {
    const locked = await tx.execute(sql`SELECT id FROM workspaces WHERE id = ${scope.workspaceId} FOR UPDATE`);
    if (!locked.rows.length) throw new Error("Workspace was not found.");
    const [source, prerequisite] = await Promise.all([
      tx.select(establishedProjectColumns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.projectId))).limit(1),
      tx.select({ id: projects.id, dueLocalDate: projects.dueLocalDate }).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.dependsOnProjectId))).limit(1),
    ]);
    if (!source[0] || !prerequisite[0]) throw new Error("Both projects must exist in this workspace before linking a dependency.");
    if (source[0].version !== input.expectedVersion) throw new PlannerConflictError(source[0]);
    const edges = await tx.select({ projectId: projectDependencies.projectId, dependsOnProjectId: projectDependencies.dependsOnProjectId })
      .from(projectDependencies).where(eq(projectDependencies.workspaceId, scope.workspaceId));
    if (edges.some(edge => edge.projectId === input.projectId && edge.dependsOnProjectId === input.dependsOnProjectId)) throw new PlannerValidationError("This project dependency already exists.");
    if (wouldCreateDependencyCycle(edges.map(edge => ({ taskId: edge.projectId, dependsOnTaskId: edge.dependsOnProjectId })), input.projectId, input.dependsOnProjectId)) {
      throw new PlannerValidationError("That project dependency would create a cycle.");
    }
    if (input.dependencyType === "hard" && source[0].startLocalDate && prerequisite[0].dueLocalDate
      && prerequisite[0].dueLocalDate > source[0].startLocalDate) {
      throw new PlannerValidationError("This hard dependency conflicts with project dates: the prerequisite is due after the dependent project starts.");
    }
    const id = nanoid();
    await tx.insert(projectDependencies).values({ id, workspaceId: scope.workspaceId, projectId: input.projectId, dependsOnProjectId: input.dependsOnProjectId, dependencyType: input.dependencyType });
    const changed = await tx.update(projects).set({ version: input.expectedVersion + 1, updatedAt: new Date() })
      .where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, input.projectId), eq(projects.version, input.expectedVersion))).returning({ id: projects.id });
    if (!changed.length) throw new PlannerConflictError(source[0]);
    return (await tx.select().from(projectDependencies).where(and(eq(projectDependencies.workspaceId, scope.workspaceId), eq(projectDependencies.id, id))).limit(1))[0]!;
  });
}

export async function removeProjectDependency(scope: PlannerScope, input: { id: string; expectedVersion: number; projectExpectedVersion: number }) {
  const db = await requireDb();
  await requireProjectDependencies(db);
  return db.transaction(async tx => {
    const locked = await tx.execute(sql`SELECT id FROM workspaces WHERE id = ${scope.workspaceId} FOR UPDATE`);
    if (!locked.rows.length) throw new Error("Workspace was not found.");
    const edge = (await tx.select().from(projectDependencies).where(and(eq(projectDependencies.workspaceId, scope.workspaceId), eq(projectDependencies.id, input.id))).limit(1))[0];
    if (!edge) throw new Error("Project dependency was not found.");
    if (edge.version !== input.expectedVersion) throw new PlannerConflictError(edge);
    const source = (await tx.select(establishedProjectColumns).from(projects).where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, edge.projectId))).limit(1))[0];
    if (!source) throw new Error("Project was not found.");
    if (source.version !== input.projectExpectedVersion) throw new PlannerConflictError(source);
    const removed = await tx.delete(projectDependencies).where(and(eq(projectDependencies.workspaceId, scope.workspaceId), eq(projectDependencies.id, input.id), eq(projectDependencies.version, input.expectedVersion))).returning({ id: projectDependencies.id });
    if (!removed.length) throw new PlannerConflictError(edge);
    const changed = await tx.update(projects).set({ version: input.projectExpectedVersion + 1, updatedAt: new Date() })
      .where(and(eq(projects.workspaceId, scope.workspaceId), eq(projects.id, edge.projectId), eq(projects.version, input.projectExpectedVersion))).returning({ id: projects.id });
    if (!changed.length) throw new PlannerConflictError(source);
    return { id: input.id, removed: true, projectVersion: input.projectExpectedVersion + 1 } as const;
  });
}

/**
 * Updates an established goal with an optimistic version guard. Additive
 * intention metadata is intentionally gated until migration 0004 is approved;
 * this prevents a pre-migration workspace from failing on unknown columns.
 */
export async function updateGoal(scope: PlannerScope, input: {
  id: string;
  expectedVersion: number;
  patch: Partial<Pick<typeof goals.$inferInsert, "title" | "description" | "categoryId" | "parentGoalId" | "state" | "priority" | "horizon" | "color" | "progressMode" | "progressValue" | "targetValue" | "startLocalDate" | "dueLocalDate">> & {
    intentionKind?: "outcome" | "direction" | null;
    successCriteria?: string | null;
    standards?: string | null;
    reviewCadence?: "weekly" | "monthly" | "quarterly" | "yearly" | null;
    nextReviewLocalDate?: string | null;
  };
}) {
  const additiveKeys = ["intentionKind", "successCriteria", "standards", "reviewCadence", "nextReviewLocalDate"] as const;
  const db = await requireDb();
  const hasIntentionPatch = additiveKeys.some(key => input.patch[key] !== undefined);
  const intentionAvailable = hasIntentionPatch ? await hasGoalIntentionColumns(db) : false;
  if (hasIntentionPatch && !intentionAvailable) throw new PlannerCapabilityError("Outcome and Direction details are unavailable until the approved Phase 4 schema migration is applied. No goal was changed.");
  const columns = goalColumnsWithIntention(intentionAvailable);
  const existing = (await db.select(columns).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Goal was not found.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  await assertScopedRecordLinks(db, scope, { categoryId: input.patch.categoryId, goalId: input.patch.parentGoalId });
  if (input.patch.parentGoalId !== undefined) await assertGoalParentIsAcyclic(db, scope, input.id, input.patch.parentGoalId);
  const patch = { ...input.patch, version: input.expectedVersion + 1 } as Record<string, unknown>;
  if (patch.state === "completed" && !existing.completedAt) patch.completedAt = new Date();
  if (patch.state && patch.state !== "completed") patch.completedAt = null;
  if (patch.state === "archived") patch.archivedAt = new Date();
  const updatedRows = await db.update(goals).set(patch).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id), eq(goals.version, input.expectedVersion))).returning({ id: goals.id });
  if (!updatedRows.length) throw new PlannerConflictError(existing);
  return (await db.select(columns).from(goals).where(and(eq(goals.workspaceId, scope.workspaceId), eq(goals.id, input.id))).limit(1))[0]!;
}

function matchingRecoveryRetry(existing: ResolutionRow, input: RecoveryDecision) {
  if (existing.requestFingerprint && existing.requestFingerprint !== recoveryFingerprint(input)) throw new RecoveryOperationReuseError();
  const nextDate = input.action === "reschedule" || input.action === "reduce" ? input.resolvedToLocalDate : null;
  const returnDate = input.action === "pause" ? input.returnLocalDate : null;
  const revisedScope = input.action === "reduce" ? input.revisedScope : null;
  if (existing.dailyPlanItemId !== input.dailyPlanItemId || existing.taskId !== input.taskId || existing.occurrenceId !== (input.occurrenceId ?? null)
    || existing.sourceCarryId !== (input.sourceCarryId ?? null)
    || existing.sourceCarryVersion !== (input.carryExpectedVersion ?? null)
    || existing.action !== input.action || existing.resolvedToLocalDate !== nextDate || existing.returnLocalDate !== returnDate
    || existing.revisedScope !== revisedScope || existing.decisionNote !== (input.decisionNote ?? null)) throw new RecoveryOperationReuseError();
  return existing;
}

function recoveryFingerprint(input: RecoveryDecision) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

/** Resolve exactly one daily commitment and retain its decision in the same transaction. */
export async function resolveCommitment(scope: PlannerScope, decision: RecoveryDecision) {
  const input = validateRecoveryDecision(decision);
  const db = await requireDb();
  const carryAvailable = await hasCarryLedger(db);
  return db.transaction(async tx => {
    const previous = (await readResolutionRows(tx, scope.workspaceId, input.operationId))[0];
    if (previous) return matchingRecoveryRetry(previous, input);

    if (input.sourceCarryId) {
      if (!carryAvailable) throw new Error("Carried commitments require the separate 0005 migration before they can be resolved.");
      const carry = (await tx.select().from(carriedCommitments).where(and(eq(carriedCommitments.workspaceId, scope.workspaceId), eq(carriedCommitments.id, input.sourceCarryId))).limit(1).for("update"))[0];
      if (!carry) throw new Error("Carried commitment was not found in this workspace.");
      const completedRetry = (await readResolutionRows(tx, scope.workspaceId, input.operationId))[0];
      if (completedRetry) return matchingRecoveryRetry(completedRetry, input);
      if (carry.taskId !== input.taskId || carry.rootDailyPlanItemId !== input.dailyPlanItemId) throw new Error("The carried commitment does not match this task and root daily item.");
      if (carry.version !== input.carryExpectedVersion) throw new PlannerConflictError(carry);
      if (carry.state !== "pending" && carry.state !== "paused") throw new Error("This carried commitment already has an outcome. Refresh before changing it.");
      const root = (await tx.select({ id: dailyPlanItems.id, taskId: dailyPlanItems.taskId }).from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, carry.rootDailyPlanItemId))).limit(1))[0];
      if (!root || root.taskId !== carry.taskId) throw new Error("The carried commitment root is unavailable in this workspace.");
      const task = (await tx.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, carry.taskId))).limit(1).for("update"))[0];
      if (!task) throw new Error("Task was not found in this workspace.");
      if (task.version !== input.taskExpectedVersion) throw new PlannerConflictError(task);
      if (task.state === "completed" || task.state === "archived" || task.outcome === "wont_do") {
        throw new Error("Needs reconciliation in Recovery: this task already has a final outcome. No history was changed.");
      }
      if (input.action === "done") {
        const edges = await tx.select().from(taskDependencies).where(and(eq(taskDependencies.workspaceId, scope.workspaceId), eq(taskDependencies.taskId, task.id)));
        const prerequisiteIds = Array.from(new Set(edges.map(edge => edge.dependsOnTaskId)));
        const prerequisites = prerequisiteIds.length ? await tx.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), inArray(tasks.id, prerequisiteIds))) : [];
        if (incompleteHardPrerequisites(task.id, edges, prerequisites).length) throw new Error("Complete every hard prerequisite before finishing this task.");
      }
      const workspace = (await tx.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1))[0];
      if (!workspace) throw new Error("Workspace was not found.");
      if ((input.action === "reschedule" || input.action === "reduce") && input.resolvedToLocalDate === carry.targetLocalDate) throw new Error("Choose a different Plan for date for this carried commitment.");
      const now = new Date();
      const state = { done: "done", reschedule: "rescheduled", reduce: "reduced", pause: "paused", abandon: "abandoned" }[input.action] as typeof carriedCommitments.$inferSelect["state"];
      const changed = await tx.update(carriedCommitments).set({ state, resolvedAt: now, version: carry.version + 1, updatedAt: now }).where(and(eq(carriedCommitments.workspaceId, scope.workspaceId), eq(carriedCommitments.id, carry.id), eq(carriedCommitments.version, carry.version))).returning({ id: carriedCommitments.id });
      if (!changed.length) throw new PlannerConflictError(carry);
      const [resolution] = await tx.insert(commitmentResolutions).values({ id: nanoid(), workspaceId: scope.workspaceId, operationId: input.operationId,
        dailyPlanItemId: carry.rootDailyPlanItemId, taskId: carry.taskId, occurrenceId: null, sourceCarryId: carry.id,
        sourceCarryVersion: carry.version, action: input.action,
        originalScope: carry.scope, requestFingerprint: recoveryFingerprint(input), revisedScope: input.action === "reduce" ? input.revisedScope : null,
        resolvedToLocalDate: input.action === "reschedule" || input.action === "reduce" ? input.resolvedToLocalDate : null,
        returnLocalDate: input.action === "pause" ? input.returnLocalDate : null, decisionNote: input.decisionNote ?? null, timezone: workspace.timezone }).returning();
      if (input.action === "reschedule" || input.action === "reduce") await tx.insert(carriedCommitments).values({ id: nanoid(), workspaceId: scope.workspaceId,
        taskId: carry.taskId, rootDailyPlanItemId: carry.rootDailyPlanItemId, createdByResolutionId: resolution.id,
        targetLocalDate: input.resolvedToLocalDate, scope: input.action === "reduce" ? input.revisedScope : carry.scope });
      return resolution;
    }

    const item = (await tx.select().from(dailyPlanItems).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, input.dailyPlanItemId))).limit(1).for("update"))[0];
    if (!item) throw new Error("Daily commitment was not found in this workspace.");
    // A concurrent retry may have waited for the first transaction's item lock.
    const completedRetry = (await readResolutionRows(tx, scope.workspaceId, input.operationId))[0];
    if (completedRetry) return matchingRecoveryRetry(completedRetry, input);
    if (item.taskId !== input.taskId) throw new Error("The task does not belong to this daily commitment.");
    if (item.version !== input.itemExpectedVersion) throw new PlannerConflictError(item);
    if (item.state !== "committed") throw new Error("This daily commitment already has an outcome. Refresh before changing it.");

    const plan = (await tx.select().from(dailyPlans).where(and(eq(dailyPlans.workspaceId, scope.workspaceId), eq(dailyPlans.id, item.dailyPlanId))).limit(1))[0];
    if (!plan || plan.state === "archived") throw new Error("The daily plan for this commitment is unavailable.");
    const workspace = (await tx.select({ timezone: workspaces.timezone }).from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1))[0];
    if (!workspace) throw new Error("Workspace was not found.");
    const task = (await tx.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.taskId))).limit(1).for("update"))[0];
    if (!task) throw new Error("Task was not found in this workspace.");
    if (task.version !== input.taskExpectedVersion) throw new PlannerConflictError(task);

    const hasOccurrenceHistory = task.recurrenceRule ? true : Boolean((await tx.select({ id: taskOccurrences.id }).from(taskOccurrences).where(and(eq(taskOccurrences.workspaceId, scope.workspaceId), eq(taskOccurrences.taskId, task.id))).limit(1))[0]);
    let occurrence: typeof taskOccurrences.$inferSelect | undefined;
    if (hasOccurrenceHistory) {
      if (!input.occurrenceId || !input.occurrenceExpectedVersion) throw new Error("Choose the dated occurrence for this recurring commitment.");
      occurrence = (await tx.select().from(taskOccurrences).where(and(eq(taskOccurrences.workspaceId, scope.workspaceId), eq(taskOccurrences.id, input.occurrenceId), eq(taskOccurrences.taskId, task.id))).limit(1).for("update"))[0];
      if (!occurrence || occurrence.localDate !== plan.localDate) throw new Error("The occurrence does not belong to this daily commitment.");
      if (occurrence.version !== input.occurrenceExpectedVersion) throw new PlannerConflictError(occurrence);
      if (occurrence.state !== "pending") throw new Error("This occurrence already has an outcome. Refresh before changing it.");
    } else if (input.occurrenceId) {
      throw new Error("This task has no dated occurrence to resolve.");
    }

    if (task.state === "completed" || task.state === "archived" || task.outcome === "wont_do") {
      throw new Error("Needs reconciliation in Recovery: this task already has a final outcome. No history was changed.");
    }
    if ((input.action === "reduce" || (occurrence && input.action === "reschedule")) && !carryAvailable) {
      throw new Error("Recovery Reduce and recurring Reschedule require the separate 0005 carried-commitment migration. No history was changed.");
    }
    if (input.action === "done") {
      const edges = await tx.select().from(taskDependencies).where(and(eq(taskDependencies.workspaceId, scope.workspaceId), eq(taskDependencies.taskId, task.id)));
      const prerequisiteIds = Array.from(new Set(edges.map(edge => edge.dependsOnTaskId)));
      const prerequisites = prerequisiteIds.length ? await tx.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), inArray(tasks.id, prerequisiteIds))) : [];
      if (incompleteHardPrerequisites(task.id, edges, prerequisites).length) throw new Error("Complete every hard prerequisite before finishing this task.");
    }

    const now = new Date();
    const resolvedToLocalDate = input.action === "reschedule" || input.action === "reduce" ? input.resolvedToLocalDate : null;
    const returnLocalDate = input.action === "pause" ? input.returnLocalDate : null;
    const revisedScope = input.action === "reduce" ? input.revisedScope : null;
    const itemState = { done: "done", reschedule: "rescheduled", reduce: "deferred", pause: "deferred", abandon: "wont_do" }[input.action] as "done" | "rescheduled" | "deferred" | "wont_do";

    if (occurrence) {
      const occurrenceState = input.action === "done" ? "completed" : input.action === "abandon" ? "skipped" : "rescheduled";
      const nextDate = input.action === "pause" ? input.returnLocalDate : resolvedToLocalDate;
      if (input.action === "reschedule" || input.action === "reduce") {
        if (input.resolvedToLocalDate === occurrence.localDate) throw new Error("Choose a different Plan for date for this occurrence.");
      }
      const changed = await tx.update(taskOccurrences).set({
        state: occurrenceState,
        rescheduledToLocalDate: nextDate,
        completedAt: input.action === "done" ? now : null,
        resolvedAt: now,
        note: input.decisionNote ?? null,
        version: occurrence.version + 1,
      }).where(and(eq(taskOccurrences.workspaceId, scope.workspaceId), eq(taskOccurrences.id, occurrence.id), eq(taskOccurrences.version, occurrence.version))).returning({ id: taskOccurrences.id });
      if (!changed.length) throw new PlannerConflictError(occurrence);
    } else {
      const patch = input.action === "done" ? taskPatchForDailyPlanOutcome("done", now)
        : input.action === "reschedule" ? taskPatchForDailyPlanOutcome("rescheduled", now, input.resolvedToLocalDate)
        : input.action === "reduce" ? taskPatchForDailyPlanOutcome("rescheduled", now, input.resolvedToLocalDate)
        : input.action === "pause" ? taskPatchForDailyPlanOutcome("deferred", now)
        : taskPatchForDailyPlanOutcome("wont_do", now);
      const changed = await tx.update(tasks).set({ ...patch, version: task.version + 1 }).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, task.id), eq(tasks.version, task.version))).returning({ id: tasks.id });
      if (!changed.length) throw new PlannerConflictError(task);
    }

    const changedItem = await tx.update(dailyPlanItems).set({
      state: itemState,
      resolvedToLocalDate,
      note: input.decisionNote ?? null,
      resolvedAt: now,
      version: item.version + 1,
    }).where(and(eq(dailyPlanItems.workspaceId, scope.workspaceId), eq(dailyPlanItems.id, item.id), eq(dailyPlanItems.version, item.version))).returning({ id: dailyPlanItems.id });
    if (!changedItem.length) throw new PlannerConflictError(item);

    const resolutionValues = {
      id: nanoid(),
      workspaceId: scope.workspaceId,
      operationId: input.operationId,
      dailyPlanItemId: item.id,
      taskId: task.id,
      occurrenceId: occurrence?.id ?? null,
      action: input.action,
      originalScope: task.title,
      revisedScope,
      resolvedToLocalDate,
      returnLocalDate,
      decisionNote: input.decisionNote ?? null,
      timezone: workspace.timezone,
      requestFingerprint: carryAvailable ? recoveryFingerprint(input) : null,
    };
    let resolution: ResolutionRow;
    if (carryAvailable) {
      [resolution] = await tx.insert(commitmentResolutions).values(resolutionValues).returning();
    } else {
      await tx.execute(sql`INSERT INTO "commitmentResolutions" (id, "workspaceId", "operationId", "dailyPlanItemId", "taskId", "occurrenceId",
        action, "originalScope", "revisedScope", "resolvedToLocalDate", "returnLocalDate", "decisionNote", timezone)
        VALUES (${resolutionValues.id}, ${resolutionValues.workspaceId}, ${resolutionValues.operationId}, ${resolutionValues.dailyPlanItemId},
        ${resolutionValues.taskId}, ${resolutionValues.occurrenceId}, ${resolutionValues.action}, ${resolutionValues.originalScope},
        ${resolutionValues.revisedScope}, ${resolutionValues.resolvedToLocalDate}, ${resolutionValues.returnLocalDate},
        ${resolutionValues.decisionNote}, ${resolutionValues.timezone})`);
      resolution = (await readResolutionRows(tx, scope.workspaceId, input.operationId))[0]!;
    }
    if (input.action === "reduce" || (occurrence && input.action === "reschedule")) await tx.insert(carriedCommitments).values({
      id: nanoid(), workspaceId: scope.workspaceId, taskId: task.id, rootDailyPlanItemId: item.id,
      createdByResolutionId: resolution.id, targetLocalDate: input.resolvedToLocalDate,
      scope: input.action === "reduce" ? input.revisedScope : task.title,
    });
    return resolution;
  });
}

export async function getActiveCalendarFeed(scope: PlannerScope) {
  const db = await requireDb();
  return (await db.select().from(calendarFeeds).where(and(
    eq(calendarFeeds.workspaceId, scope.workspaceId),
    eq(calendarFeeds.isEnabled, 1),
  )).limit(1))[0] ?? null;
}

export async function dispatchAllScheduledReminders(origin: string, now = new Date()) {
  return dispatchProjectReminderSweep(await requireDb(), origin, now);
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

export async function updateReviewChecklist(scope: PlannerScope, input: { id: string; expectedVersion: number; checklist: Record<string, unknown> }) {
  if (!canPersistWeeklyReviewChecklist(input.checklist)) throw new Error("The review checklist contained an unsupported item or value.");
  const db = await requireDb();
  const existing = (await db.select().from(reviewSessions).where(and(eq(reviewSessions.workspaceId, scope.workspaceId), eq(reviewSessions.id, input.id))).limit(1))[0];
  if (!existing) throw new Error("Review session was not found.");
  if (existing.state !== "in_progress") throw new Error("Only an open review checklist can be updated.");
  if (existing.version !== input.expectedVersion) throw new PlannerConflictError(existing);
  const existingSnapshot = existing.snapshot && typeof existing.snapshot === "object" && !Array.isArray(existing.snapshot) ? existing.snapshot as Record<string, unknown> : {};
  const snapshot = { ...existingSnapshot, weeklyChecklist: normaliseWeeklyReviewChecklist(input.checklist) };
  await db.update(reviewSessions).set({ snapshot, version: input.expectedVersion + 1 }).where(and(eq(reviewSessions.workspaceId, scope.workspaceId), eq(reviewSessions.id, input.id), eq(reviewSessions.version, input.expectedVersion)));
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
