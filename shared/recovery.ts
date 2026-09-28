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
  itemExpectedVersion: z.number().int().positive(),
  taskExpectedVersion: z.number().int().positive(),
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
});

export type RecoveryDecision = z.infer<typeof recoveryDecisionSchema>;

export function validateRecoveryDecision(input: unknown): RecoveryDecision {
  return recoveryDecisionSchema.parse(input);
}

type RecoveryProjectionInput = {
  todayLocalDate: string;
  plans: Array<{ id: string; localDate: string; state: string }>;
  items: Array<{ id: string; dailyPlanId: string; taskId: string; state: string; version: number }>;
  resolutions?: Array<{ id: string; dailyPlanItemId: string; taskId: string; action: string; returnLocalDate: string | null }>;
  tasks?: Array<{ id: string; state: string; outcome?: string }>;
};

/** A reference remains a separate commitment even when another reference targets the same task. */
export function recoveryProjection(input: RecoveryProjectionInput) {
  const eligiblePlans = new Map(input.plans.filter(plan => plan.state !== "archived" && plan.localDate < input.todayLocalDate).map(plan => [plan.id, plan]));
  const groups = new Map<string, { taskId: string; commitments: Array<{ itemId: string; planLocalDate: string; itemVersion: number }> }>();
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
  const itemsById = new Map(input.items.map(item => [item.id, item]));
  const tasksById = input.tasks ? new Map(input.tasks.map(task => [task.id, task])) : null;
  const returning = (input.resolutions ?? []).flatMap(resolution => {
    const item = itemsById.get(resolution.dailyPlanItemId);
    const task = tasksById?.get(resolution.taskId);
    if (resolution.action !== "pause" || !resolution.returnLocalDate || resolution.returnLocalDate > input.todayLocalDate || item?.state !== "deferred" || item.taskId !== resolution.taskId) return [];
    if (tasksById && (!task || task.state === "completed" || task.state === "archived" || task.outcome === "wont_do")) return [];
    return [{ resolutionId: resolution.id, itemId: item.id, taskId: item.taskId, returnLocalDate: resolution.returnLocalDate }];
  });
  return { count: Array.from(groups.values()).reduce((count, group) => count + group.commitments.length, 0), groups: Array.from(groups.values()), returning };
}
