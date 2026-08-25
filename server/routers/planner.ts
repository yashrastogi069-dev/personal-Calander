import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  archiveGoal,
  archiveGoalMilestone,
  archiveHabit,
  archiveProject,
  bulkSetTaskState,
  clearHabitCheckIn,
  completeReviewSession,
  createCategory,
  createGoal,
  createGoalMilestone,
  createHabit,
  createProject,
  createSavedView,
  createTask,
  createTaskDependency,
  ensureCalendarFeed,
  ensureWorkspace,
  deleteSavedView,
  deleteCategory,
  disablePushSubscription,
  getDashboard,
  getPushDeviceForEndpoint,
  getPushDevices,
  getWorkspaceSnapshot,
  materializeTaskOccurrences,
  PlannerConflictError,
  prepareReminderRule,
  getReminderRules,
  resolveTaskOccurrence,
  revokeCalendarFeed,
  sendTestPush,
  startReviewSession,
  setReminderRuleActivation,
  updateTask,
  updateGoalMilestone,
  updateCategory,
  updateSavedView,
  updateWorkspace,
  upsertDailyCheckIn,
  upsertHabitCheckIn,
  upsertPushSubscription,
} from "../planning";
import { invokeLLM } from "../_core/llm";
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

function plannerError(error: unknown): never {
  if (error instanceof PlannerConflictError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message, cause: error.current });
  }
  throw error;
}

export const plannerRouter = router({
  workspace: router({
    ensure: publicProcedure.input(scope).mutation(async ({ input }) => ensureWorkspace(input)),
    update: publicProcedure.input(scope.extend({ expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(120).optional(), timezone: z.string().min(1).max(64).optional(), weekStartsOn: z.number().int().min(0).max(6).optional(), dailyCapacityMinutes: z.number().int().min(30).max(1440).optional(), planningDayStartsAt: z.string().regex(/^\d{2}:\d{2}$/).optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...patch } = input;
      try { return await updateWorkspace({ workspaceId, timezone: timezone ?? "UTC" }, patch); } catch (error) { return plannerError(error); }
    }),
    snapshot: publicProcedure.input(scope.extend({ start: dateString, end: dateString })).query(async ({ input }) => getWorkspaceSnapshot(input, { start: input.start, end: input.end })),
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
  }),
  task: router({
    create: publicProcedure.input(scope.extend({ title: z.string().trim().min(1).max(280), description: z.string().max(10000).nullable().optional(), parentTaskId: z.string().nullable().optional(), goalId: z.string().nullable().optional(), projectId: z.string().nullable().optional(), categoryId: z.string().nullable().optional(), state: lifecycle.default("not_started"), priority: priority.default("medium"), horizon: horizon.default("weekly"), dueLocalDate: dateString.nullable().optional(), scheduledLocalDate: dateString.nullable().optional(), plannedStartAt: z.date().nullable().optional(), plannedEndAt: z.date().nullable().optional(), estimateMinutes: z.number().int().min(0).max(1440).nullable().optional(), sortOrder: z.number().int().default(0), recurrenceRule: z.record(z.string(), z.unknown()).nullable().optional(), recurrenceAnchor: z.enum(["scheduled", "completion"]).nullable().optional(), recurrenceUntilLocalDate: dateString.nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...task } = input;
      if (task.plannedStartAt && task.plannedEndAt && task.plannedEndAt <= task.plannedStartAt) throw new TRPCError({ code: "BAD_REQUEST", message: "A timeblock must end after it starts." });
      return createTask({ workspaceId, timezone }, task);
    }),
    update: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), patch: z.object({ title: z.string().trim().min(1).max(280).optional(), description: z.string().max(10000).nullable().optional(), state: lifecycle.optional(), priority: priority.optional(), horizon: horizon.optional(), dueLocalDate: dateString.nullable().optional(), scheduledLocalDate: dateString.nullable().optional(), plannedStartAt: z.date().nullable().optional(), plannedEndAt: z.date().nullable().optional(), estimateMinutes: z.number().int().min(0).max(1440).nullable().optional(), categoryId: z.string().nullable().optional(), goalId: z.string().nullable().optional(), projectId: z.string().nullable().optional(), parentTaskId: z.string().nullable().optional(), sortOrder: z.number().int().optional(), recurrenceRule: z.record(z.string(), z.unknown()).nullable().optional(), recurrenceAnchor: z.enum(["scheduled", "completion"]).nullable().optional(), recurrenceUntilLocalDate: dateString.nullable().optional() }).refine(value => !(value.plannedStartAt && value.plannedEndAt) || value.plannedEndAt > value.plannedStartAt, { message: "A timeblock must end after it starts." }) })).mutation(async ({ input }) => {
      const { workspaceId, timezone, id, expectedVersion, patch } = input;
      try { return await updateTask({ workspaceId, timezone }, { id, expectedVersion, patch }); } catch (error) { return plannerError(error); }
    }),
    bulkSetState: publicProcedure.input(scope.extend({ ids: z.array(z.string()).min(1).max(100), state: lifecycle })).mutation(async ({ input }) => bulkSetTaskState(input, { ids: input.ids, state: input.state })),
    addDependency: publicProcedure.input(scope.extend({ taskId: z.string(), dependsOnTaskId: z.string(), dependencyType: z.enum(["hard", "soft"]).default("hard") })).mutation(async ({ input }) => createTaskDependency(input, input)),
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
    checkIn: publicProcedure.input(scope.extend({ habitId: z.string(), localDate: dateString, state: z.enum(["completed", "skipped", "missed"]), note: z.string().max(1000).nullable().optional() })).mutation(async ({ input }) => upsertHabitCheckIn(input, input)),
    clearCheckIn: publicProcedure.input(scope.extend({ habitId: z.string(), localDate: dateString })).mutation(async ({ input }) => clearHabitCheckIn(input, input)),
  }),
  dailyCheckIn: router({
    upsert: publicProcedure.input(scope.extend({ localDate: dateString, intention: z.string().max(3000).nullable().optional(), reflection: z.string().max(5000).nullable().optional(), energy: z.number().int().min(1).max(5).nullable().optional(), mood: z.number().int().min(1).max(5).nullable().optional() })).mutation(async ({ input }) => upsertDailyCheckIn(input, input)),
  }),
  savedView: router({
    create: publicProcedure.input(scope.extend({ name: z.string().trim().min(1).max(120), viewType: z.enum(["tasks", "goals", "projects", "calendar", "habits"]), configuration: z.record(z.string(), z.unknown()), isPinned: z.number().int().min(0).max(1).optional() })).mutation(async ({ input }) => createSavedView(input, input)),
    update: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), name: z.string().trim().min(1).max(120).optional(), configuration: z.record(z.string(), z.unknown()).optional(), isPinned: z.number().int().min(0).max(1).optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...view } = input;
      try { return await updateSavedView({ workspaceId, timezone }, view); } catch (error) { return plannerError(error); }
    }),
    delete: publicProcedure.input(scope.extend({ id: z.string() })).mutation(async ({ input }) => deleteSavedView(input, input)),
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
    start: publicProcedure.input(scope.extend({ kind: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]), periodStartLocalDate: dateString, periodEndLocalDate: dateString, snapshot: z.record(z.string(), z.unknown()).optional() })).mutation(async ({ input }) => startReviewSession(input, input)),
    complete: publicProcedure.input(scope.extend({ id: z.string(), expectedVersion: z.number().int().positive(), reflection: z.string().max(5000).nullable().optional() })).mutation(async ({ input }) => {
      const { workspaceId, timezone, ...review } = input;
      try { return await completeReviewSession({ workspaceId, timezone }, review); } catch (error) { return plannerError(error); }
    }),
  }),
  ai: router({
    draft: publicProcedure.input(scope.extend({ thought: z.string().trim().min(3).max(4000), todayLocalDate: dateString })).mutation(async ({ input }) => {
      const result = await invokeLLM({
        model: "gpt-5-mini",
        maxTokens: 450,
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
      if (typeof content !== "string") throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The planning draft did not return readable content. Try again." });
      try { return aiDraft.parse(JSON.parse(content)); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The planning draft could not be validated. Try again." }); }
    }),
  }),
  dashboard: publicProcedure.input(scope.extend({ todayLocalDate: dateString, rangeStart: dateString, rangeEnd: dateString })).query(async ({ input }) => getDashboard(input, input)),
});
