import { dailyCapacityForecast } from "@shared/planningForecast";

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
  parentGoalId?: string | null;
  horizon?: string;
  state: "not_started" | "in_progress" | "blocked" | "completed" | "archived";
  progressMode: "manual" | "task" | "measure" | "habit";
  progressValue: number;
  targetValue: number;
  startLocalDate?: string | null;
  dueLocalDate: string | null;
};

export type CompactProject = {
  id: string;
  goalId: string | null;
  state: "not_started" | "in_progress" | "blocked" | "completed" | "archived";
};

export type CompactHabit = {
  id: string;
  goalId: string | null;
  archivedAt: Date | null;
};

export type CompactMilestone = {
  id: string;
  goalId: string;
  state: "not_started" | "in_progress" | "blocked" | "completed" | "archived";
  horizon: "monthly" | "quarterly";
  progressValue: number;
  targetValue: number;
  startLocalDate?: string | null;
  dueLocalDate: string | null;
};

export type CompactReviewSession = {
  kind: "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
  state: "not_started" | "in_progress" | "completed" | "archived";
  periodEndLocalDate: string;
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

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T12:00:00.000Z`).getTime() - new Date(`${from}T12:00:00.000Z`).getTime()) / 86_400_000);
}

function normalizedProgress(value: number, target: number) {
  return Math.max(0, Math.min(100, Math.round((value / Math.max(1, target)) * 100)));
}

function hierarchyGoalIds(rootGoalId: string, goals: CompactGoal[]) {
  const childrenByParent = new Map<string, string[]>();
  for (const goal of goals) {
    if (!goal.parentGoalId || goal.state === "archived") continue;
    childrenByParent.set(goal.parentGoalId, [...(childrenByParent.get(goal.parentGoalId) ?? []), goal.id]);
  }
  const result = new Set<string>();
  const pending = [rootGoalId];
  while (pending.length) {
    const goalId = pending.pop()!;
    if (result.has(goalId)) continue;
    result.add(goalId);
    pending.push(...(childrenByParent.get(goalId) ?? []));
  }
  return result;
}

function calculatedGoalProgress(
  goal: CompactGoal,
  allGoals: CompactGoal[],
  milestones: CompactMilestone[],
  tasks: CompactTask[],
  projectGoalById: Map<string, string | null>,
  visited = new Set<string>()
): { progress: number; source: "manual" | "child_goals" | "milestones" | "execution" } {
  if (goal.progressMode === "manual" || goal.progressMode === "measure") return { progress: normalizedProgress(goal.progressValue, goal.targetValue), source: "manual" };
  if (visited.has(goal.id)) return { progress: goalProgress(goal, tasks, projectGoalById), source: "execution" };
  const nextVisited = new Set(visited).add(goal.id);
  const children = allGoals.filter(candidate => candidate.parentGoalId === goal.id && candidate.state !== "archived");
  if (children.length) {
    return { progress: Math.round(children.reduce((total, child) => total + calculatedGoalProgress(child, allGoals, milestones, tasks, projectGoalById, nextVisited).progress, 0) / children.length), source: "child_goals" };
  }
  const activeMilestones = milestones.filter(milestone => milestone.goalId === goal.id && milestone.state !== "archived");
  if (activeMilestones.length) {
    return { progress: Math.round(activeMilestones.reduce((total, milestone) => total + (milestone.state === "completed" ? 100 : normalizedProgress(milestone.progressValue, milestone.targetValue)), 0) / activeMilestones.length), source: "milestones" };
  }
  return { progress: goalProgress(goal, tasks, projectGoalById), source: "execution" };
}

function reviewFreshness(goal: CompactGoal, reviews: CompactReviewSession[], todayLocalDate: string) {
  const horizon = goal.horizon === "monthly" || goal.horizon === "quarterly" || goal.horizon === "yearly" ? goal.horizon : null;
  if (!horizon) return { reviewStatus: "unavailable" as const, lastReviewLocalDate: null, reviewDue: false };
  const requirement = {
    monthly: { kinds: ["weekly", "monthly"], cadenceDays: 35 },
    quarterly: { kinds: ["monthly", "quarterly"], cadenceDays: 100 },
    yearly: { kinds: ["quarterly", "yearly"], cadenceDays: 190 },
  }[horizon];
  const eligible = reviews.filter(review => review.state === "completed" && requirement.kinds.includes(review.kind) && review.periodEndLocalDate <= todayLocalDate).sort((left, right) => right.periodEndLocalDate.localeCompare(left.periodEndLocalDate));
  const lastReviewLocalDate = eligible[0]?.periodEndLocalDate ?? null;
  const reviewDue = !lastReviewLocalDate || daysBetween(lastReviewLocalDate, todayLocalDate) > requirement.cadenceDays;
  return { reviewStatus: reviewDue ? "due" as const : "fresh" as const, lastReviewLocalDate, reviewDue };
}

export function longHorizonGoalHealth(input: {
  goals: CompactGoal[];
  projects: CompactProject[];
  tasks: CompactTask[];
  habits: CompactHabit[];
  milestones: CompactMilestone[];
  reviewSessions?: CompactReviewSession[];
  projectGoalById: Map<string, string | null>;
  todayLocalDate: string;
}) {
  const activeGoals = input.goals.filter(goal => goal.state !== "archived");
  return activeGoals.map(goal => {
    const hierarchyIds = hierarchyGoalIds(goal.id, activeGoals);
    const childGoalCount = hierarchyIds.size - 1;
    const calculated = calculatedGoalProgress(goal, activeGoals, input.milestones, input.tasks, input.projectGoalById);
    const activeProjects = input.projects.filter(project => project.goalId !== null && hierarchyIds.has(project.goalId) && project.state !== "archived");
    const activeTasks = input.tasks.filter(task => (task.goalId !== null && hierarchyIds.has(task.goalId)) || (task.projectId ? hierarchyIds.has(input.projectGoalById.get(task.projectId) ?? "") : false)).filter(task => task.state !== "archived");
    const activeHabits = input.habits.filter(habit => habit.goalId !== null && hierarchyIds.has(habit.goalId) && !habit.archivedAt);
    const activeMilestones = input.milestones.filter(milestone => hierarchyIds.has(milestone.goalId) && milestone.state !== "archived");
    const futureMilestones = activeMilestones.filter(milestone => !milestone.dueLocalDate || milestone.dueLocalDate >= input.todayLocalDate);
    const hasExecutionCoverage = activeProjects.length + activeTasks.length + activeHabits.length > 0;
    const hasPlanEvidence = hasExecutionCoverage || activeMilestones.length > 0;
    const hasMilestoneCoverage = activeMilestones.length > 0 || childGoalCount > 0;
    const review = reviewFreshness(goal, input.reviewSessions ?? [], input.todayLocalDate);
    const daysUntilDue = goal.dueLocalDate ? daysBetween(input.todayLocalDate, goal.dueLocalDate) : null;
    const hasPaceBasis = Boolean(goal.startLocalDate && goal.dueLocalDate && daysBetween(goal.startLocalDate!, goal.dueLocalDate!) > 0);
    const expectedProgress = hasPaceBasis
      ? Math.max(0, Math.min(100, Math.round((daysBetween(goal.startLocalDate!, input.todayLocalDate) / daysBetween(goal.startLocalDate!, goal.dueLocalDate!)) * 100)))
      : null;
    const paceDelta = expectedProgress === null ? null : calculated.progress - expectedProgress;
    const isCompleted = goal.state === "completed";
    const isOverdue = Boolean(goal.dueLocalDate && goal.dueLocalDate < input.todayLocalDate && !isCompleted);
    const paceStatus = paceDelta === null || isCompleted ? "unavailable" : paceDelta < -10 ? "behind" : paceDelta > 10 ? "ahead" : "on_pace";
    const nextAction = isCompleted
      ? "none"
      : !hasPlanEvidence
        ? "add_execution"
        : isOverdue || paceStatus === "behind"
          ? "review_plan"
          : review.reviewDue
            ? "review_plan"
            : goal.dueLocalDate && !hasMilestoneCoverage
              ? "add_milestone"
              : "none";

    return {
      goalId: goal.id,
      progress: calculated.progress,
      progressSource: calculated.source,
      expectedProgress,
      paceDelta,
      paceStatus,
      daysUntilDue,
      isOverdue,
      hasExecutionCoverage,
      hasMilestoneCoverage,
      childGoalCount,
      ...review,
      activeProjectCount: activeProjects.length,
      activeTaskCount: activeTasks.length,
      activeHabitCount: activeHabits.length,
      activeMilestoneCount: activeMilestones.length,
      futureMilestoneCount: futureMilestones.length,
      nextAction,
    } as const;
  });
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
  projects?: CompactProject[];
  habits?: CompactHabit[];
  milestones?: CompactMilestone[];
  reviewSessions?: CompactReviewSession[];
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
  const capacityForecast = dailyCapacityForecast(input.tasks, input.todayLocalDate, input.capacityMinutes);
  const plannedMinutes = capacityForecast.plannedMinutes;
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

  const longHorizon = longHorizonGoalHealth({
    goals: input.goals,
    projects: input.projects ?? [],
    tasks: input.tasks,
    habits: input.habits ?? [],
    milestones: input.milestones ?? [],
    reviewSessions: input.reviewSessions ?? [],
    projectGoalById: input.projectGoalById,
    todayLocalDate: input.todayLocalDate,
  });

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
      goalsBehindPace: longHorizon.filter(item => item.paceStatus === "behind").length,
      goalsWithoutExecution: longHorizon.filter(item => item.nextAction === "add_execution").length,
      overdueLongHorizonGoals: longHorizon.filter(item => item.isOverdue).length,
      goalsNeedingReview: longHorizon.filter(item => item.reviewDue).length,
    },
    workload: {
      ...capacityForecast,
      ratio: input.capacityMinutes ? plannedMinutes / input.capacityMinutes : 0,
    },
    goalProgress: goalProgressItems,
    longHorizon,
    completionTrend,
    categoryDistribution,
    streaks,
  };
}
