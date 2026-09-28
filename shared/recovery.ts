import { z } from "zod";

const localDate = z.string().refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Choose a valid local date.");

const common = {
  operationId: z.string().trim().min(1).max(128),
  dailyPlanItemId: z.string().min(1).max(64),
  taskId: z.string().min(1).max(64),
  itemExpectedVersion: z.number().int().positive().optional(),
  taskExpectedVersion: z.number().int().positive(),
  sourceCarryId: z.string().min(1).max(64).optional(),
  carryExpectedVersion: z.number().int().positive().optional(),
  occurrenceId: z.string().min(1).max(64).optional(),
  occurrenceExpectedVersion: z.number().int().positive().optional(),
  decisionNote: z.string().max(10000).optional(),
};

export const recoveryDecisionSchema = z.discriminatedUnion("action", [
  z.object({ ...common, action: z.literal("done") }).strict(),
  z.object({ ...common, action: z.literal("reschedule"), resolvedToLocalDate: localDate }).strict(),
  z.object({ ...common, action: z.literal("reduce"), revisedScope: z.string().trim().min(1).max(280), resolvedToLocalDate: localDate }).strict(),
  z.object({ ...common, action: z.literal("pause"), returnLocalDate: localDate }).strict(),
  z.object({ ...common, action: z.literal("abandon") }).strict(),
]).superRefine((input, context) => {
  if (Boolean(input.occurrenceId) !== Boolean(input.occurrenceExpectedVersion)) {
    context.addIssue({ code: "custom", path: ["occurrenceExpectedVersion"], message: "occurrenceId and occurrenceExpectedVersion are required together." });
  }
  if (input.sourceCarryId) {
    if (!input.carryExpectedVersion || input.itemExpectedVersion || input.occurrenceId) context.addIssue({ code: "custom", path: ["sourceCarryId"], message: "A carried decision needs its carry version, without item or occurrence versions." });
  } else if (!input.itemExpectedVersion || input.carryExpectedVersion) {
    context.addIssue({ code: "custom", path: ["itemExpectedVersion"], message: "A daily commitment needs its item version; carry versions belong only to carried decisions." });
  }
});

export type RecoveryDecision = z.infer<typeof recoveryDecisionSchema>;

export function validateRecoveryDecision(input: unknown): RecoveryDecision {
  return recoveryDecisionSchema.parse(input);
}

type RecoveryProjectionInput = {
  todayLocalDate: string;
  plans: Array<{ id: string; localDate: string; state: string }>;
  items: Array<{ id: string; dailyPlanId: string; taskId: string; state: string; version: number }>;
  resolutions?: Array<{ id: string; dailyPlanItemId: string; taskId: string; action: string; returnLocalDate: string | null; resolvedToLocalDate?: string | null; originalScope?: string; revisedScope?: string | null; sourceCarryId?: string | null }>;
  occurrences?: Array<{ id: string; taskId: string; localDate: string; state: string }>;
  carries?: Array<{ id: string; taskId: string; rootDailyPlanItemId: string; createdByResolutionId: string; targetLocalDate: string; scope: string; state: string; version: number }>;
  tasks?: Array<{ id: string; state: string; outcome?: string }>;
};

/** A reference remains a separate commitment even when another reference targets the same task. */
export function recoveryProjection(input: RecoveryProjectionInput) {
  const eligiblePlans = new Map(input.plans.filter(plan => plan.state !== "archived" && plan.localDate < input.todayLocalDate).map(plan => [plan.id, plan]));
  type RecoveryReference = { itemId: string; planLocalDate: string; itemVersion: number }
    | { carryId: string; rootDailyPlanItemId: string; targetLocalDate: string; carryVersion: number; scope: string };
  const groups = new Map<string, { taskId: string; commitments: RecoveryReference[] }>();
  for (const item of input.items) {
    const plan = eligiblePlans.get(item.dailyPlanId);
    if (!plan || item.state !== "committed") continue;
    let group = groups.get(item.taskId);
    if (!group) {
      group = { taskId: item.taskId, commitments: [] };
      groups.set(item.taskId, group);
    }
    group.commitments.push({ itemId: item.id, planLocalDate: plan.localDate, itemVersion: item.version });
  }
  for (const carry of input.carries ?? []) {
    if (carry.state !== "pending" || carry.targetLocalDate >= input.todayLocalDate) continue;
    let group = groups.get(carry.taskId);
    if (!group) {
      group = { taskId: carry.taskId, commitments: [] };
      groups.set(carry.taskId, group);
    }
    group.commitments.push({ carryId: carry.id, rootDailyPlanItemId: carry.rootDailyPlanItemId,
      targetLocalDate: carry.targetLocalDate, carryVersion: carry.version, scope: carry.scope });
  }
  const itemsById = new Map(input.items.map(item => [item.id, item]));
  const carriesById = new Map((input.carries ?? []).map(carry => [carry.id, carry]));
  const tasksById = input.tasks ? new Map(input.tasks.map(task => [task.id, task])) : null;
  const returning = (input.resolutions ?? []).flatMap(resolution => {
    const item = itemsById.get(resolution.dailyPlanItemId);
    const task = tasksById?.get(resolution.taskId);
    if (resolution.action !== "pause" || !resolution.returnLocalDate || resolution.returnLocalDate > input.todayLocalDate || !item || item.taskId !== resolution.taskId) return [];
    if (tasksById && (!task || task.state === "completed" || task.state === "archived" || task.outcome === "wont_do")) return [];
    if (resolution.sourceCarryId) {
      const carry = carriesById.get(resolution.sourceCarryId);
      return carry?.state === "paused" && carry.taskId === resolution.taskId && carry.rootDailyPlanItemId === item.id
        ? [{ resolutionId: resolution.id, carryId: carry.id, itemId: item.id, taskId: item.taskId, returnLocalDate: resolution.returnLocalDate }]
        : [];
    }
    if (item.state !== "deferred") return [];
    return [{ resolutionId: resolution.id, itemId: item.id, taskId: item.taskId, returnLocalDate: resolution.returnLocalDate }];
  });
  const nextCommitments = (input.carries ?? []).flatMap(carry => carry.state === "pending" && carry.targetLocalDate === input.todayLocalDate
    ? [{ carryId: carry.id, resolutionId: carry.createdByResolutionId, sourceItemId: carry.rootDailyPlanItemId, taskId: carry.taskId, localDate: carry.targetLocalDate, scope: carry.scope, carryVersion: carry.version }]
    : []);
  return { count: Array.from(groups.values()).reduce((count, group) => count + group.commitments.length, 0), groups: Array.from(groups.values()), returning, nextCommitments };
}
