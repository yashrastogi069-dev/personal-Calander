import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  archiveGoal,
  archiveGoalMilestone,
  archiveHabit,
  archivePlanningTemplate,
  archiveProject,
  addDailyPlanItem,
  bulkSetTaskState,
  carryForwardWeeklyObjective,
  clearPlanningAvailabilityException,
  clearHabitCheckIn,
  closeDailyPlan,
  completeReviewSession,
  createCategory,
  createGoal,
  createGoalMilestone,
  createHabit,
  createPlanningTemplate,
  createProject,
  createSavedView,
  createTask,
  createTaskDependency,
  createWeeklyObjective,
  ensureCalendarFeed,
  ensureWorkspace,
  deleteSavedView,
  deleteCategory,
  disablePushSubscription,
  getDashboard,
  getHabitPracticeEvidence,
  getReviewHistory,
  getPushDeviceForEndpoint,
  getPushDevices,
  getWorkspaceSnapshot,
  materializeTaskOccurrences,
  moveDailyPlanItem,
  PlannerConflictError,
  prepareReminderRule,
  getReminderRules,
  resolveTaskOccurrence,
  revokeCalendarFeed,
  restoreGoal,
  restoreHabit,
  restoreProject,
  resolveDailyPlanItem,
  removeTaskDependency,
  sendTestPush,
  searchWorkspace,
  startReviewSession,
  setReminderRuleActivation,
  updateTask,
  updateDailyPlanItem,
  updateGoalMilestone,
  updatePlanningTemplate,
  updateWeeklyObjective,
  updateCategory,
  updateSavedView,
  updateWorkspace,
  upsertDailyPlan,
  upsertPlanningAvailabilityException,
  upsertDailyCheckIn,
  upsertHabitCheckIn,
  upsertPushSubscription,
} from "../planning";
import { approveScheduleProposal, createScheduleProposal, dismissScheduleProposal, undoScheduleProposal } from "../scheduling";
import { invokeLLM } from "../_core/llm";
import { finishFocusSession, pauseFocusSession, resumeFocusSession, startFocusSession } from "../focus";
import { publicProcedure, router } from "../_core/trpc";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const approvedReminderSpecs = [
  { type: "daily_plan" as const, schedule: { kind: "daily" as const, timeLocal: "11:00" } },
  { type: "weekly_review" as const, schedule: { kind: "weekly" as const, weekday: 0, timeLocal: "17:00" } },
];
const scope = z.object({ workspaceId: z.string().min(12).max(64), timezone: z.string().min(1).max(64) });
const lifecycle = z.enum(["not_started", "in_progress", "blocked", "completed", "archived"]);
const priority = z.enum(["none", "low", "medium", "high", "critical"]);
const horizon = z.enum(["daily", "weekly", "monthly", "quarterly", "yearly", "someday"]);
const aiDraft = z.object({
  kind: z.enum(["task", "goal"]),
  title: z.string().trim().min(1).max(280),
  summary: z.string().trim().min(1).max(700),
  priority: priority,
  horizon: horizon,
  suggestedDueLocalDate: dateString.nullable(),
});

const fallbackAiDraft = (thought: string) => {
  const firstClause = thought
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");
  const title = firstClause.length <= 120
    ? firstClause
    : `${firstClause.slice(0, 117).trimEnd()}…`;
  return {
    kind: "task" as const,
    title,
    summary: "A safe starting draft based on your note. Review it before you add it to your plan.",
    priority: "medium" as const,
    horizon: "weekly" as const,
    suggestedDueLocalDate: null,
    source: "fallback" as const,
  };
};

function plannerError(error: unknown): never {
  if (error instanceof PlannerConflictError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message, cause: error.current });
  }
  throw error;
}

export const plannerRouter = router({
  workspace: router({
    ensure: publicProcedure.input(scope).mutation(async ({ input }) => ensureWorkspace(input)),
    update: publicProcedure.input(scope.extend({ expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(120).optional(), timezone: z.string().min(1).max(64).optional(), weekStartsOn: z.number().int().min(0).max(6).optional(), dailyCapacityMinutes: z.number().int().min(30).max(1440).optional(), planningDayStartsAt: z.string().regex(/^\d{2}:\d{2}$/).optional(), workdayStartsAt: z.string().regex(/^\d{2}:\d{2}$/).optional(), workdayEndsAt: z.string().regex(/^\d{2}:\d{2}$/).optional(), defaultBreakMinutes: z.number().int().min(0).max(240).optional(), preferredShutdownAt: z.string().regex(/^\d{2}:\d{2}$/).optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...patch } = input;
      try { return await updateWorkspace({ workspaceId, timezone: timezone ?? "UTC" }, patch); } catch (error) { return plannerError(error); }
    }),
    snapshot: publicProcedure.input(scope.extend({ start: dateString, end: dateString })).query(async ({ input }) => getWorkspaceSnapshot(input, { start: input.start, end: input.end })),
  }),
  availability: router({
    upsert: publicProcedure.input(scope.extend({ localDate: dateString, expectedVersion: z.number().int().positive().optional(), isUnavailable: z.boolean().optional(), workdayStartsAt: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), workdayEndsAt: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(), breakMinutes: z.number().int().min(0).max(240).nullable().optional(), note: z.string().trim().max(500).nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...exception } = input;
      try { return await upsertPlanningAvailabilityException({ workspaceId, timezone }, exception); } catch (error) { return plannerError(error); }
    }),
    clear: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...exception } = input;
      try { return await clearPlanningAvailabilityException({ workspaceId, timezone }, exception); } catch (error) { return plannerError(error); }
    }),
  }),
  scheduleProposal: router({
    create: publicProcedure.input(scope.extend({ taskId: z.string(), localDate: dateString })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...proposal } = input;
      try { return await createScheduleProposal({ workspaceId, timezone }, proposal); } catch (error) { return plannerError(error); }
    }),
    approve: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), taskExpectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...proposal } = input;
      try { return await approveScheduleProposal({ workspaceId, timezone }, proposal); } catch (error) { return plannerError(error); }
    }),
    dismiss: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...proposal } = input;
      try { return await dismissScheduleProposal({ workspaceId, timezone }, proposal); } catch (error) { return plannerError(error); }
    }),
    undo: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), taskExpectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...proposal } = input;
      try { return await undoScheduleProposal({ workspaceId, timezone }, proposal); } catch (error) { return plannerError(error); }
    }),
  }),
  focus: router({
    start: publicProcedure.input(scope.extend({ taskId: z.string().nullable().optional(), targetMinutes: z.number().int().min(5).max(240) })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...session } = input;
      try { return await startFocusSession({ workspaceId, timezone }, session); } catch (error) { return plannerError(error); }
    }),
    pause: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...session } = input;
      try { return await pauseFocusSession({ workspaceId, timezone }, session); } catch (error) { return plannerError(error); }
    }),
    resume: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...session } = input;
      try { return await resumeFocusSession({ workspaceId, timezone }, session); } catch (error) { return plannerError(error); }
    }),
    finish: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), outcome: z.enum(["done", "continue", "adjust_estimate", "stopped"]), note: z.string().max(2000).nullable().optional(), adjustedEstimateMinutes: z.number().int().min(5).max(1440).nullable().optional(), taskExpectedVersion: z.number().int().positive().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...session } = input;
      try { return await finishFocusSession({ workspaceId, timezone }, session); } catch (error) { return plannerError(error); }
    }),
  }),
  category: router({
    create: publicProcedure.input(scope.extend({ name: z.string().trim().min(1).max(80), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), sortOrder: z.number().int().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...category } = input;
      return createCategory({ workspaceId, timezone }, category);
    }),
    update: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), patch: z.object({ name: z.string().trim().min(1).max(80).optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(), sortOrder: z.number().int().optional() }) })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion, patch } = input;
      try { return await updateCategory({ workspaceId, timezone }, { id, expectedVersion, patch }); } catch (error) { return plannerError(error); }
    }),
    delete: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion } = input;
      try { return await deleteCategory({ workspaceId, timezone }, { id, expectedVersion }); } catch (error) { return plannerError(error); }
    }),
  }),
  goal: router({
    create: publicProcedure.input(scope.extend({ title: z.string().trim().min(1).max(280), description: z.string().max(10000).nullable().optional(), categoryId: z.string().nullable().optional(), parentGoalId: z.string().nullable().optional(), state: lifecycle.default("not_started"), priority: priority.default("medium"), horizon: horizon.default("yearly"), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(), progressMode: z.enum(["manual", "task", "measure", "habit"]).default("task"), progressValue: z.number().int().min(0).default(0), targetValue: z.number().int().min(1).default(100), startLocalDate: dateString.nullable().optional(), dueLocalDate: dateString.nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...goal } = input;
      return createGoal({ workspaceId, timezone }, goal);
    }),
    archive: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion } = input;
      try { return await archiveGoal({ workspaceId, timezone }, { id, expectedVersion }); } catch (error) { return plannerError(error); }
    }),
    restore: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion } = input;
      try { return await restoreGoal({ workspaceId, timezone }, { id, expectedVersion }); } catch (error) { return plannerError(error); }
    }),
  }),
  milestone: router({
    create: publicProcedure.input(scope.extend({ goalId: z.string(), title: z.string().trim().min(1).max(280), description: z.string().max(10000).nullable().optional(), state: lifecycle.default("not_started"), horizon: z.enum(["monthly", "quarterly"]), progressValue: z.number().int().min(0).default(0), targetValue: z.number().int().min(1).default(100), startLocalDate: dateString.nullable().optional(), dueLocalDate: dateString.nullable().optional(), cue: z.string().trim().min(1).max(280).nullable().optional(), response: z.string().trim().min(1).max(500).nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...milestone } = input;
      return createGoalMilestone({ workspaceId, timezone }, milestone);
    }),
    update: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), patch: z.object({ title: z.string().trim().min(1).max(280).optional(), description: z.string().max(10000).nullable().optional(), state: lifecycle.optional(), horizon: z.enum(["monthly", "quarterly"]).optional(), progressValue: z.number().int().min(0).optional(), targetValue: z.number().int().min(1).optional(), startLocalDate: dateString.nullable().optional(), dueLocalDate: dateString.nullable().optional(), cue: z.string().trim().min(1).max(280).nullable().optional(), response: z.string().trim().min(1).max(500).nullable().optional() }) })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion, patch } = input;
      try { return await updateGoalMilestone({ workspaceId, timezone }, { id, expectedVersion, patch }); } catch (error) { return plannerError(error); }
    }),
    archive: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion } = input;
      try { return await archiveGoalMilestone({ workspaceId, timezone }, { id, expectedVersion }); } catch (error) { return plannerError(error); }
    }),
  }),
  project: router({
    create: publicProcedure.input(scope.extend({ title: z.string().trim().min(1).max(280), description: z.string().max(10000).nullable().optional(), goalId: z.string().nullable().optional(), categoryId: z.string().nullable().optional(), state: lifecycle.default("not_started"), priority: priority.default("medium"), horizon: horizon.default("quarterly"), startLocalDate: dateString.nullable().optional(), dueLocalDate: dateString.nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...project } = input;
      return createProject({ workspaceId, timezone }, project);
    }),
    archive: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion } = input;
      try { return await archiveProject({ workspaceId, timezone }, { id, expectedVersion }); } catch (error) { return plannerError(error); }
    }),
    restore: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion } = input;
      try { return await restoreProject({ workspaceId, timezone }, { id, expectedVersion }); } catch (error) { return plannerError(error); }
    }),
  }),
  task: router({
    create: publicProcedure.input(scope.extend({ title: z.string().trim().min(1).max(280), description: z.string().max(10000).nullable().optional(), parentTaskId: z.string().nullable().optional(), goalId: z.string().nullable().optional(), projectId: z.string().nullable().optional(), categoryId: z.string().nullable().optional(), state: lifecycle.default("not_started"), priority: priority.default("medium"), horizon: horizon.default("weekly"), dueLocalDate: dateString.nullable().optional(), scheduledLocalDate: dateString.nullable().optional(), plannedStartAt: z.date().nullable().optional(), plannedEndAt: z.date().nullable().optional(), estimateMinutes: z.number().int().min(0).max(1440).nullable().optional(), scheduleMode: z.enum(["manual", "flexible", "pinned"]).default("manual"), sortOrder: z.number().int().default(0), recurrenceRule: z.record(z.string(), z.unknown()).nullable().optional(), recurrenceAnchor: z.enum(["scheduled", "completion"]).nullable().optional(), recurrenceUntilLocalDate: dateString.nullable().optional(), clientRequestId: z.string().min(12).max(64).nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...task } = input;
      if (task.plannedStartAt && task.plannedEndAt && task.plannedEndAt <= task.plannedStartAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Reserved time must end after it starts." });
      return createTask({ workspaceId, timezone }, task);
    }),
    update: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), patch: z.object({ title: z.string().trim().min(1).max(280).optional(), description: z.string().max(10000).nullable().optional(), state: lifecycle.optional(), priority: priority.optional(), horizon: horizon.optional(), dueLocalDate: dateString.nullable().optional(), scheduledLocalDate: dateString.nullable().optional(), plannedStartAt: z.date().nullable().optional(), plannedEndAt: z.date().nullable().optional(), estimateMinutes: z.number().int().min(0).max(1440).nullable().optional(), scheduleMode: z.enum(["manual", "flexible", "pinned"]).optional(), categoryId: z.string().nullable().optional(), goalId: z.string().nullable().optional(), projectId: z.string().nullable().optional(), parentTaskId: z.string().nullable().optional(), sortOrder: z.number().int().optional(), recurrenceRule: z.record(z.string(), z.unknown()).nullable().optional(), recurrenceAnchor: z.enum(["scheduled", "completion"]).nullable().optional(), recurrenceUntilLocalDate: dateString.nullable().optional() }).refine(value => !(value.plannedStartAt && value.plannedEndAt) || value.plannedEndAt > value.plannedStartAt, { message: "Reserved time must end after it starts." }) })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion, patch } = input;
      try { return await updateTask({ workspaceId, timezone }, { id, expectedVersion, patch }); } catch (error) { return plannerError(error); }
    }),
    bulkSetState: publicProcedure.input(scope.extend({ ids: z.array(z.string()).min(1).max(100), state: lifecycle })).mutation(async ({ input }) => bulkSetTaskState(input, { ids: input.ids, state: input.state })),
    addDependency: publicProcedure.input(scope.extend({ taskId: z.string(), dependsOnTaskId: z.string(), dependencyType: z.enum(["hard", "soft"]).default("hard") })).mutation(async ({ input }) => createTaskDependency(input, input)),
    removeDependency: publicProcedure.input(scope.extend({ id: z.string() })).mutation(async ({ input }) => removeTaskDependency(input, input)),
  }),
  occurrence: router({
    materialize: publicProcedure.input(scope.extend({ start: dateString, end: dateString })).mutation(async ({ input }) => materializeTaskOccurrences(input, input)),
    resolve: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), state: z.enum(["completed", "skipped", "missed", "rescheduled"]), rescheduledToLocalDate: dateString.nullable().optional(), note: z.string().max(1000).nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...occurrence } = input;
      try { return await resolveTaskOccurrence({ workspaceId, timezone }, occurrence); } catch (error) { return plannerError(error); }
    }),
  }),
  habit: router({
    create: publicProcedure.input(scope.extend({ name: z.string().trim().min(1).max(160), description: z.string().max(10000).nullable().optional(), goalId: z.string().nullable().optional(), categoryId: z.string().nullable().optional(), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/), frequency: z.enum(["daily", "days_of_week", "times_per_week", "interval"]).default("daily"), schedule: z.record(z.string(), z.unknown()), reminderTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...habit } = input;
      return createHabit({ workspaceId, timezone }, habit);
    }),
    archive: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion } = input;
      try { return await archiveHabit({ workspaceId, timezone }, { id, expectedVersion }); } catch (error) { return plannerError(error); }
    }),
    restore: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion } = input;
      try { return await restoreHabit({ workspaceId, timezone }, { id, expectedVersion }); } catch (error) { return plannerError(error); }
    }),
    checkIn: publicProcedure.input(scope.extend({ habitId: z.string(), localDate: dateString, state: z.enum(["completed", "skipped", "missed"]), note: z.string().max(1000).nullable().optional() })).mutation(async ({ input }) => upsertHabitCheckIn(input, input)),
    clearCheckIn: publicProcedure.input(scope.extend({ habitId: z.string(), localDate: dateString })).mutation(async ({ input }) => clearHabitCheckIn(input, input)),
    practiceEvidence: publicProcedure.input(scope.extend({ endLocalDate: dateString })).query(async ({ input }) => getHabitPracticeEvidence(input, input)),
  }),
  dailyCheckIn: router({
    upsert: publicProcedure.input(scope.extend({ localDate: dateString, intention: z.string().max(3000).nullable().optional(), reflection: z.string().max(5000).nullable().optional(), energy: z.number().int().min(1).max(5).nullable().optional(), mood: z.number().int().min(1).max(5).nullable().optional() })).mutation(async ({ input }) => upsertDailyCheckIn(input, input)),
  }),
  dailyPlan: router({
    upsert: publicProcedure.input(scope.extend({ localDate: dateString, expectedVersion: z.number().int().positive().optional(), intention: z.string().max(3000).nullable().optional(), reflection: z.string().max(5000).nullable().optional(), state: z.enum(["draft", "active", "closed", "archived"]).optional() })).mutation(async ({ input }) => upsertDailyPlan(input, input)),
    addItem: publicProcedure.input(scope.extend({ dailyPlanId: z.string(), taskId: z.string() })).mutation(async ({ input }) => addDailyPlanItem(input, input)),
    updateItem: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), state: z.enum(["committed", "done", "rescheduled", "deferred", "wont_do", "archived"]).optional(), resolvedToLocalDate: dateString.nullable().optional(), note: z.string().max(1000).nullable().optional(), position: z.number().int().min(0).max(200).optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...item } = input;
      try { return await updateDailyPlanItem({ workspaceId, timezone }, item); } catch (error) { return plannerError(error); }
    }),
    moveItem: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), direction: z.union([z.literal(-1), z.literal(1)]) })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...item } = input;
      try { return await moveDailyPlanItem({ workspaceId, timezone }, item); } catch (error) { return plannerError(error); }
    }),
    resolveItem: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), taskExpectedVersion: z.number().int().positive(), state: z.enum(["done", "rescheduled", "deferred", "wont_do", "archived"]), resolvedToLocalDate: dateString.nullable().optional(), note: z.string().max(1000).nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...item } = input;
      try { return await resolveDailyPlanItem({ workspaceId, timezone }, item); } catch (error) { return plannerError(error); }
    }),
    close: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), reflection: z.string().max(5000).nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...plan } = input;
      try { return await closeDailyPlan({ workspaceId, timezone }, plan); } catch (error) { return plannerError(error); }
    }),
  }),
  weeklyObjective: router({
    create: publicProcedure.input(scope.extend({ weekStartLocalDate: dateString, title: z.string().trim().min(1).max(280), description: z.string().max(5000).nullable().optional(), goalId: z.string().nullable().optional(), projectId: z.string().nullable().optional() })).mutation(async ({ input }) => createWeeklyObjective(input, input)),
    update: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), patch: z.object({ title: z.string().trim().min(1).max(280).optional(), description: z.string().max(5000).nullable().optional(), goalId: z.string().nullable().optional(), projectId: z.string().nullable().optional(), state: z.enum(["active", "completed", "continued", "adjusted", "archived"]).optional(), evidence: z.string().max(5000).nullable().optional() }) })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...objective } = input;
      try { return await updateWeeklyObjective({ workspaceId, timezone }, objective); } catch (error) { return plannerError(error); }
    }),
    carryForward: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), nextWeekStartLocalDate: dateString })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...objective } = input;
      try { return await carryForwardWeeklyObjective({ workspaceId, timezone }, objective); } catch (error) { return plannerError(error); }
    }),
  }),
  planningTemplate: router({
    create: publicProcedure.input(scope.extend({ kind: z.enum(["task", "project", "daily_plan"]), name: z.string().trim().min(1).max(120), description: z.string().max(1000).nullable().optional(), payload: z.record(z.string(), z.unknown()) })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...template } = input;
      return createPlanningTemplate({ workspaceId, timezone }, template);
    }),
    update: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), patch: z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().max(1000).nullable().optional(), payload: z.record(z.string(), z.unknown()).optional() }) })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...template } = input;
      try { return await updatePlanningTemplate({ workspaceId, timezone }, template); } catch (error) { return plannerError(error); }
    }),
    archive: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...template } = input;
      try { return await archivePlanningTemplate({ workspaceId, timezone }, template); } catch (error) { return plannerError(error); }
    }),
  }),
  savedView: router({
    create: publicProcedure.input(scope.extend({ name: z.string().trim().min(1).max(120), viewType: z.enum(["tasks", "goals", "projects", "calendar", "habits"]), configuration: z.record(z.string(), z.unknown()), isPinned: z.number().int().min(0).max(1).optional() })).mutation(async ({ input }) => createSavedView(input, input)),
    update: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(120).optional(), configuration: z.record(z.string(), z.unknown()).optional(), isPinned: z.number().int().min(0).max(1).optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...view } = input;
      try { return await updateSavedView({ workspaceId, timezone }, view); } catch (error) { return plannerError(error); }
    }),
    delete: publicProcedure.input(scope.extend({ id: z.string() })).mutation(async ({ input }) => deleteSavedView(input, input)),
  }),
  search: router({
    workspace: publicProcedure.input(scope.extend({ query: z.string().trim().min(2).max(160), limit: z.number().int().min(1).max(40).default(20) })).query(async ({ input }) => {
      const { workspaceId, timezone, ...search } = input;
      return searchWorkspace({ workspaceId, timezone }, search);
    }),
  }),
  calendarFeed: router({
    ensure: publicProcedure.input(scope).mutation(async ({ input }) => ensureCalendarFeed(input)),
    revoke: publicProcedure.input(scope.extend({ id: z.string() })).mutation(async ({ input }) => revokeCalendarFeed(input, input)),
  }),
  notification: router({
    devices: publicProcedure.input(scope).query(async ({ input }) => getPushDevices(input)),
    currentDevice: publicProcedure.input(scope.extend({ endpoint: z.string().url().max(512) })).query(async ({ input }) => getPushDeviceForEndpoint(input, input)),
    enableDevice: publicProcedure.input(scope.extend({ subscription: z.object({ endpoint: z.string().url().max(512), keys: z.object({ p256dh: z.string().min(1).max(4096), auth: z.string().min(1).max(4096) }), deviceLabel: z.string().trim().max(120).nullable().optional(), userAgent: z.string().max(512).nullable().optional() }) })).mutation(async ({ input }) => upsertPushSubscription(input, input.subscription)),
    disableDevice: publicProcedure.input(scope.extend({ id: z.string() })).mutation(async ({ input }) => disablePushSubscription(input, input)),
    testDevice: publicProcedure.input(scope.extend({ subscriptionId: z.string(), origin: z.string().url().max(512).refine(value => value.startsWith("https://") || value.startsWith("http://localhost"), { message: "A secure application origin is required." }) })).mutation(async ({ input }) => sendTestPush(input, input)),
  }),
  reminder: router({
    rules: publicProcedure.input(scope).query(async ({ input }) => getReminderRules(input)),
    activateApproved: publicProcedure.input(scope).mutation(async ({ input }) => {
      const activated: string[] = [];
      try {
        for (const spec of approvedReminderSpecs) {
          const rule = await prepareReminderRule(input, { type: spec.type, timezone: "Pacific/Auckland", schedule: spec.schedule });
          await setReminderRuleActivation(input, { id: rule.id, enabled: true });
          activated.push(rule.id);
        }
      } catch (error) {
        await Promise.all(activated.map(id => setReminderRuleActivation(input, { id, enabled: false }).catch(() => undefined)));
        throw error;
      }
      return getReminderRules(input);
    }),
    pauseApproved: publicProcedure.input(scope).mutation(async ({ input }) => {
      const rules = await getReminderRules(input);
      await Promise.all(rules.map(async rule => {
        await setReminderRuleActivation(input, { id: rule.id, enabled: false });
      }));
      return getReminderRules(input);
    }),
  }),
  review: router({
    history: publicProcedure.input(scope.extend({ limit: z.number().int().min(1).max(24).default(12) })).query(async ({ input }) => {
      const { workspaceId, timezone, ...history } = input;
      return getReviewHistory({ workspaceId, timezone }, history);
    }),
    start: publicProcedure.input(scope.extend({ kind: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]), periodStartLocalDate: dateString, periodEndLocalDate: dateString, snapshot: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => startReviewSession(input, input)),
    complete: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), reflection: z.string().max(5000).nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...review } = input;
      try { return await completeReviewSession({ workspaceId, timezone }, review); } catch (error) { return plannerError(error); }
    }),
  }),
  ai: router({
    draft: publicProcedure.input(scope.extend({ thought: z.string().trim().min(3).max(4000), todayLocalDate: dateString })).mutation(async ({ input }) => {
      try {
        const result = await invokeLLM({
          model: "gpt-5-mini",
          maxCompletionTokens: 520,
          messages: [
            { role: "system", content: "You turn a personal planning thought into one cautious draft. Do not claim to know facts not supplied. Prefer a task unless the thought is clearly an outcome that spans multiple actions. Suggest a due date only when the thought gives a clear timeframe; otherwise return null. This is a draft for a person to confirm, never an action." },
            { role: "user", content: `Today is ${input.todayLocalDate}. Thought: ${input.thought}` },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "planning_draft",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  kind: { type: "string", enum: ["task", "goal"] },
                  title: { type: "string" },
                  summary: { type: "string" },
                  priority: { type: "string", enum: ["none", "low", "medium", "high", "critical"] },
                  horizon: { type: "string", enum: ["daily", "weekly", "monthly", "quarterly", "yearly", "someday"] },
                  suggestedDueLocalDate: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
                },
                required: ["kind", "title", "summary", "priority", "horizon", "suggestedDueLocalDate"],
              },
            },
          },
        });
        const content = result.choices[0]?.message.content;
        if (typeof content !== "string") throw new Error("model returned no text content");
        return { ...aiDraft.parse(JSON.parse(content)), source: "model" as const };
      } catch (error) {
        console.warn("[AI Companion] Model draft unavailable; returning a disclosed safe fallback.", error instanceof Error ? error.message : error);
        return fallbackAiDraft(input.thought);
      }
    }),
  }),
  dashboard: publicProcedure.input(scope.extend({ todayLocalDate: dateString, rangeStart: dateString, rangeEnd: dateString })).query(async ({ input }) => getDashboard(input, input)),
});
