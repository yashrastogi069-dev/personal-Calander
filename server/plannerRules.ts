export type CompactTask = {
  id: string;
  goalId: string | null;
  projectId: string | null;
  categoryId: string | null;
  state: "not_started" | "in_progress" | "blocked" | "completed" | "archived";
  dueLocalDate: string | null;
  scheduledLocalDate: string | null;
  estimateMinutes: number | null;
  completedAt: Date | null;
  createdAt?: Date;
};

export type CompactGoal = {
  id: string;
  state: "not_started" | "in_progress" | "blocked" | "completed" | "archived";
  progressMode: "manual" | "task" | "measure" | "habit";
  progressValue: number;
  targetValue: number;
  dueLocalDate: string | null;
};

export type CompactHabitCheckIn = {
  habitId: string;
  localDate: string;
  state: "completed" | "skipped" | "missed";
};

export function shiftLocalDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function localDateSequence(start: string, end: string) {
  const dates: string[] = [];
  let current = start;
  while (current <= end) {
    dates.push(current);
    current = shiftLocalDate(current, 1);
  }
  return dates;
}

export type RecurrenceRule = {
  frequency: "daily" | "weekly" | "monthly";
  interval?: number;
  weekdays?: number[];
};

export function recurringLocalDates(rule: RecurrenceRule, start: string, end: string, until?: string | null) {
  const cappedEnd = until && until < end ? until : end;
  const interval = Math.max(1, Math.floor(rule.interval ?? 1));
  const results: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= cappedEnd && guard < 5000) {
    const date = new Date(`${cursor}T12:00:00.000Z`);
    const daysFromStart = Math.floor((date.getTime() - new Date(`${start}T12:00:00.000Z`).getTime()) / 86_400_000);
    const weekOffset = Math.floor(daysFromStart / 7);
    const monthOffset = (date.getUTCFullYear() - new Date(`${start}T12:00:00.000Z`).getUTCFullYear()) * 12 + date.getUTCMonth() - new Date(`${start}T12:00:00.000Z`).getUTCMonth();
    const matches = rule.frequency === "daily"
      ? daysFromStart % interval === 0
      : rule.frequency === "weekly"
        ? weekOffset % interval === 0 && (rule.weekdays?.includes(date.getUTCDay()) ?? date.getUTCDay() === new Date(`${start}T12:00:00.000Z`).getUTCDay())
        : monthOffset % interval === 0 && date.getUTCDate() === new Date(`${start}T12:00:00.000Z`).getUTCDate();
    if (matches) results.push(cursor);
    cursor = shiftLocalDate(cursor, 1);
    guard += 1;
  }
  return results;
}

export function wouldCreateDependencyCycle(edges: Array<{ taskId: string; dependsOnTaskId: string }>, taskId: string, dependsOnTaskId: string) {
  if (taskId === dependsOnTaskId) return true;
  const dependenciesByTask = new Map<string, string[]>();
  for (const edge of edges) {
    dependenciesByTask.set(edge.taskId, [...(dependenciesByTask.get(edge.taskId) ?? []), edge.dependsOnTaskId]);
  }
  const pending = [dependsOnTaskId];
  const visited = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    pending.push(...(dependenciesByTask.get(current) ?? []));
  }
  return false;
}

export function goalProgress(
  goal: CompactGoal,
  tasks: CompactTask[],
  projectGoalById: Map<string, string | null>
) {
  if (goal.progressMode === "manual" || goal.progressMode === "measure") {
    return Math.max(0, Math.min(100, Math.round((goal.progressValue / Math.max(1, goal.targetValue)) * 100)));
  }

  const supporting = tasks.filter(task => task.goalId === goal.id || (task.projectId ? projectGoalById.get(task.projectId) === goal.id : false));
  if (!supporting.length) return goal.state === "completed" ? 100 : 0;
  const complete = supporting.filter(task => task.state === "completed").length;
  return Math.round((complete / supporting.length) * 100);
}

export function currentHabitStreak(checkIns: CompactHabitCheckIn[], habitId: string, todayLocalDate: string) {
  const stateByDate = new Map(checkIns.filter(item => item.habitId === habitId).map(item => [item.localDate, item.state]));
  let cursor = todayLocalDate;
  let streak = 0;

  if (stateByDate.get(cursor) !== "completed") {
    cursor = shiftLocalDate(cursor, -1);
  }

  for (let guard = 0; guard < 3650; guard += 1) {
    const state = stateByDate.get(cursor);
    if (state === "completed") {
      streak += 1;
      cursor = shiftLocalDate(cursor, -1);
      continue;
    }
    if (state === "skipped") {
      cursor = shiftLocalDate(cursor, -1);
      continue;
    }
    break;
  }

  return streak;
}

export function dashboardSummary(input: {
  tasks: CompactTask[];
  goals: CompactGoal[];
  projectGoalById: Map<string, string | null>;
  categoryNames: Map<string, string>;
  habitCheckIns: CompactHabitCheckIn[];
  habitIds: string[];
  todayLocalDate: string;
  rangeStart: string;
  rangeEnd: string;
  capacityMinutes: number;
}) {
  const activeTasks = input.tasks.filter(task => task.state !== "completed" && task.state !== "archived");
  const today = activeTasks.filter(task => task.scheduledLocalDate === input.todayLocalDate || task.dueLocalDate === input.todayLocalDate);
  const allTodayTasks = input.tasks.filter(task => task.scheduledLocalDate === input.todayLocalDate || task.dueLocalDate === input.todayLocalDate);
  const upcomingEnd = shiftLocalDate(input.todayLocalDate, 7);
  const upcoming = activeTasks.filter(task => task.dueLocalDate && task.dueLocalDate > input.todayLocalDate && task.dueLocalDate <= upcomingEnd);
  const plannedMinutes = today.reduce((total, task) => total + (task.estimateMinutes ?? 0), 0);
  const carryoverTasks = activeTasks.filter(task => task.scheduledLocalDate && task.scheduledLocalDate < input.todayLocalDate);
  const blockedTasks = activeTasks.filter(task => task.state === "blocked");
  const completedToday = input.tasks.filter(task => task.completedAt?.toISOString().slice(0, 10) === input.todayLocalDate).length;
  const scheduledThroughToday = input.tasks.filter(task => task.scheduledLocalDate && task.scheduledLocalDate <= input.todayLocalDate && task.state !== "archived");
  const finishedScheduledThroughToday = scheduledThroughToday.filter(task => task.state === "completed");
  const datedWorkThroughToday = input.tasks.filter(task => (task.scheduledLocalDate ?? task.dueLocalDate) && (task.scheduledLocalDate ?? task.dueLocalDate)! <= input.todayLocalDate && task.state !== "archived");
  const estimateCoverage = activeTasks.length ? Math.round((activeTasks.filter(task => task.estimateMinutes !== null).length / activeTasks.length) * 100) : 100;
  const averageBlockedAgeDays = blockedTasks.length ? Math.round(blockedTasks.reduce((total, task) => total + (task.createdAt ? Math.max(0, Math.floor((new Date(`${input.todayLocalDate}T12:00:00.000Z`).getTime() - task.createdAt.getTime()) / 86_400_000)) : 0), 0) / blockedTasks.length) : 0;
  const goalProgressItems = input.goals
    .filter(goal => goal.state !== "archived")
    .map(goal => ({
      id: goal.id,
      progress: goalProgress(goal, input.tasks, input.projectGoalById),
      atRisk: Boolean(goal.dueLocalDate && goal.dueLocalDate < input.todayLocalDate && goal.state !== "completed"),
    }));

  const completionTrend = localDateSequence(input.rangeStart, input.rangeEnd).map(localDate => ({
    localDate,
    completed: input.tasks.filter(task => task.completedAt?.toISOString().slice(0, 10) === localDate).length,
  }));

  const categoryDistribution = Array.from(input.categoryNames.entries()).map(([id, name]) => ({
    id,
    name,
    count: input.tasks.filter(task => task.categoryId === id && task.state !== "archived").length,
  }));

  const streaks = input.habitIds.map(habitId => ({ habitId, streak: currentHabitStreak(input.habitCheckIns, habitId, input.todayLocalDate) }));

  return {
    counts: {
      today: today.length,
      upcoming: upcoming.length,
      completedInRange: completionTrend.reduce((total, item) => total + item.completed, 0),
      activeGoals: goalProgressItems.length,
    },
    planningHealth: {
      carryoverCount: carryoverTasks.length,
      blockedCount: blockedTasks.length,
      completedToday,
      focusCompletionRate: allTodayTasks.length ? Math.round((allTodayTasks.filter(task => task.state === "completed").length / allTodayTasks.length) * 100) : 0,
      atRiskGoalCount: goalProgressItems.filter(item => item.atRisk).length,
    },
    decisionSignals: {
      scheduleReliability: scheduledThroughToday.length ? Math.round((finishedScheduledThroughToday.length / scheduledThroughToday.length) * 100) : null,
      carryoverRate: datedWorkThroughToday.length ? Math.round((carryoverTasks.length / datedWorkThroughToday.length) * 100) : 0,
      averageBlockedAgeDays,
      estimateCoverage,
      goalsWithVisibleProgress: goalProgressItems.filter(item => item.progress > 0 && item.progress < 100).length,
    },
    workload: {
      plannedMinutes,
      capacityMinutes: input.capacityMinutes,
      ratio: input.capacityMinutes ? plannedMinutes / input.capacityMinutes : 0,
      isOverCapacity: plannedMinutes > input.capacityMinutes,
    },
    goalProgress: goalProgressItems,
    completionTrend,
    categoryDistribution,
    streaks,
  };
}
