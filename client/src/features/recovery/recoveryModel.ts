import {
  recoveryProjection,
  validateRecoveryDecision,
  type RecoveryDecision,
} from "@shared/recovery";

export type RecoveryEntry = {
  key: string;
  dailyPlanItemId: string;
  taskId: string;
  taskVersion: number;
  sourceLocalDate: string;
  originalScope: string;
  scopeSource?: "current_title" | "recorded_history" | "carry";
  canResolve: boolean;
  reason?: "missing_task" | "final_task" | "missing_occurrence" | "returning_pause";
  returnLocalDate?: string;
  itemVersion?: number;
  occurrenceId?: string;
  occurrenceVersion?: number;
  sourceCarryId?: string;
  carryVersion?: number;
  deadline?: string | null;
};

type RecoverySource = {
  todayLocalDate: string;
  plans: Array<{ id: string; localDate: string; state: string }>;
  items: Array<{
    id: string;
    dailyPlanId: string;
    taskId: string;
    state: string;
    version: number;
    createdAt?: string | Date;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    version: number;
    state: string;
    outcome?: string | null;
    recurrenceRule?: unknown;
    dueLocalDate?: string | null;
  }>;
  occurrences?: Array<{
    id: string;
    taskId: string;
    localDate: string;
    state: string;
    version: number;
  }>;
  carries?: Array<{
    id: string;
    taskId: string;
    rootDailyPlanItemId: string;
    createdByResolutionId: string;
    targetLocalDate: string;
    scope: string;
    state: string;
    version: number;
  }>;
  resolutions?: Array<{
    id: string;
    dailyPlanItemId: string;
    taskId: string;
    action: string;
    originalScope: string;
    revisedScope?: string | null;
    returnLocalDate: string | null;
    sourceCarryId?: string | null;
    sourceCarryVersion?: number | null;
    createdAt?: string | Date;
  }>;
};

export function buildRecoveryEntries(source: RecoverySource): RecoveryEntry[] {
  const planById = new Map(
    source.plans
      .filter(
        plan =>
          plan.state !== "archived" && plan.localDate < source.todayLocalDate
      )
      .map(plan => [plan.id, plan])
  );
  const taskById = new Map(source.tasks.map(task => [task.id, task]));
  const recordedScopeByTask = new Map<string, string>();
  for (const resolution of [...(source.resolutions ?? [])].sort((left, right) => {
    const leftAt = left.createdAt ? new Date(left.createdAt).getTime() : Infinity;
    const rightAt = right.createdAt ? new Date(right.createdAt).getTime() : Infinity;
    return leftAt - rightAt || left.id.localeCompare(right.id);
  })) {
    if (!recordedScopeByTask.has(resolution.taskId) && resolution.originalScope.trim()) recordedScopeByTask.set(resolution.taskId, resolution.originalScope);
  }
  const occurrenceHistory = new Set(
    (source.occurrences ?? []).map(occurrence => occurrence.taskId)
  );
  const reasonFor = (
    task: RecoverySource["tasks"][number] | undefined,
    sourceDate: string,
    carried: boolean
  ) => {
    if (!task) return "missing_task" as const;
    if (
      task.state === "completed" ||
      task.state === "archived" ||
      task.outcome === "wont_do"
    )
      return "final_task" as const;
    if (
      !carried &&
      (task.recurrenceRule || occurrenceHistory.has(task.id)) &&
      !(source.occurrences ?? []).some(
        occurrence =>
          occurrence.taskId === task.id &&
          occurrence.localDate === sourceDate &&
          occurrence.state === "pending"
      )
    )
      return "missing_occurrence" as const;
    return undefined;
  };
  const original: RecoveryEntry[] = source.items.flatMap(item => {
    const plan = planById.get(item.dailyPlanId);
    if (!plan || item.state !== "committed") return [];
    const task = taskById.get(item.taskId);
    const occurrence = (source.occurrences ?? []).find(
      row =>
        row.taskId === item.taskId &&
        row.localDate === plan.localDate &&
        row.state === "pending"
    );
    const reason = reasonFor(task, plan.localDate, false);
    return [
      {
        key: `item:${item.id}`,
        dailyPlanItemId: item.id,
        taskId: item.taskId,
        taskVersion: task?.version ?? 0,
        sourceLocalDate: plan.localDate,
        originalScope: recordedScopeByTask.get(item.taskId) ?? task?.title ?? "Missing linked task",
        scopeSource: recordedScopeByTask.has(item.taskId) ? "recorded_history" : "current_title",
        canResolve: !reason,
        reason,
        itemVersion: item.version,
        occurrenceId: occurrence?.id,
        occurrenceVersion: occurrence?.version,
        deadline: task?.dueLocalDate ?? null,
      } satisfies RecoveryEntry,
    ];
  });
  const carried: RecoveryEntry[] = (source.carries ?? []).flatMap(carry => {
    if (
      carry.state !== "pending" ||
      carry.targetLocalDate >= source.todayLocalDate
    )
      return [];
    const task = taskById.get(carry.taskId);
    const reason = reasonFor(task, carry.targetLocalDate, true);
    return [
      {
        key: `carry:${carry.id}`,
        dailyPlanItemId: carry.rootDailyPlanItemId,
        taskId: carry.taskId,
        taskVersion: task?.version ?? 0,
        sourceLocalDate: carry.targetLocalDate,
        originalScope: carry.scope,
        scopeSource: "carry",
        canResolve: !reason,
        reason,
        sourceCarryId: carry.id,
        carryVersion: carry.version,
        deadline: task?.dueLocalDate ?? null,
      } satisfies RecoveryEntry,
    ];
  });
  const dueReturns: RecoveryEntry[] = recoveryProjection({ todayLocalDate: source.todayLocalDate,
    plans: source.plans, items: source.items, carries: source.carries, resolutions: source.resolutions,
    tasks: source.tasks.map(task => ({ id: task.id, state: task.state, outcome: task.outcome ?? undefined })) }).returning.flatMap(row => {
    const carryId = "carryId" in row ? row.carryId : undefined;
    const task = taskById.get(row.taskId);
    const resolution = (source.resolutions ?? []).find(candidate => candidate.id === row.resolutionId);
    const root = source.items.find(item => item.id === row.itemId);
    const plan = source.plans.find(candidate => candidate.id === root?.dailyPlanId);
    const carry = carryId ? (source.carries ?? []).find(candidate => candidate.id === carryId) : undefined;
    if (!task || !root || !resolution || !plan) return [];
    // A due pause is a reminder to re-engage, not an immutable open decision.
    // Only a newly recorded, dated plan item can acknowledge it; visiting Tasks
    // or changing a task title must never silently erase the reminder.
    const pausedAt = resolution.createdAt ? new Date(resolution.createdAt).getTime() : NaN;
    if (!carryId && Number.isFinite(pausedAt) && source.items.some(candidate => {
      if (candidate.id === root.id || candidate.taskId !== row.taskId || !candidate.createdAt) return false;
      const laterPlan = source.plans.find(record => record.id === candidate.dailyPlanId);
      return Boolean(laterPlan && (laterPlan.state === "active" || laterPlan.state === "closed") && laterPlan.localDate >= row.returnLocalDate &&
        new Date(candidate.createdAt).getTime() > pausedAt);
    })) return [];
    const reason = carryId ? reasonFor(task, carry?.targetLocalDate ?? plan.localDate, true) : "returning_pause" as const;
    return [{ key: carryId ? `return:carry:${carryId}` : `return:item:${row.itemId}`,
      dailyPlanItemId: row.itemId, taskId: row.taskId, taskVersion: task.version,
      sourceLocalDate: carry?.targetLocalDate ?? plan.localDate, returnLocalDate: row.returnLocalDate,
      originalScope: carry?.scope ?? resolution.originalScope,
      scopeSource: carry ? "carry" : "recorded_history", canResolve: !reason, reason,
      itemVersion: carry ? undefined : root.version,
      sourceCarryId: carry?.id, carryVersion: carry?.version, deadline: task.dueLocalDate ?? null } satisfies RecoveryEntry];
  });
  return [...original, ...carried, ...dueReturns].sort(
    (a, b) =>
      a.sourceLocalDate.localeCompare(b.sourceLocalDate) ||
      Number(Boolean(a.sourceCarryId)) - Number(Boolean(b.sourceCarryId)) ||
      a.key.localeCompare(b.key)
  );
}

export type RecoveryForm = {
  action: RecoveryDecision["action"];
  resolvedToLocalDate?: string;
  revisedScope?: string;
  returnLocalDate?: string;
  decisionNote?: string;
};

export function recoveryScopeLabel(entry: RecoveryEntry) {
  return entry.scopeSource === "carry" ? "Carried scope"
    : entry.scopeSource === "recorded_history" ? "Recorded scope" : "Current task title";
}

export function recoveryDecisionInput(
  entry: RecoveryEntry,
  form: RecoveryForm,
  operationId: string
): RecoveryDecision {
  if (!entry.canResolve)
    throw new Error(
      "This commitment needs reconciliation before a decision can be recorded."
    );
  const common = {
    operationId,
    dailyPlanItemId: entry.dailyPlanItemId,
    taskId: entry.taskId,
    taskExpectedVersion: entry.taskVersion,
    ...(entry.sourceCarryId
      ? {
          sourceCarryId: entry.sourceCarryId,
          carryExpectedVersion: entry.carryVersion,
        }
      : {
          itemExpectedVersion: entry.itemVersion,
          ...(entry.occurrenceId
            ? {
                occurrenceId: entry.occurrenceId,
                occurrenceExpectedVersion: entry.occurrenceVersion,
              }
            : {}),
        }),
    ...(form.decisionNote?.trim()
      ? { decisionNote: form.decisionNote.trim() }
      : {}),
  };
  const action = form.action;
  const decision =
    action === "reduce"
      ? {
          ...common,
          action,
          revisedScope: form.revisedScope,
          resolvedToLocalDate: form.resolvedToLocalDate,
        }
      : action === "reschedule"
        ? { ...common, action, resolvedToLocalDate: form.resolvedToLocalDate }
        : action === "pause"
          ? { ...common, action, returnLocalDate: form.returnLocalDate }
          : { ...common, action };
  return validateRecoveryDecision(decision);
}
