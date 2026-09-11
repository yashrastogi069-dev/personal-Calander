export type FocusMetricSession = { taskId: string | null; activeSeconds: number; state: string };
export type FocusMetricTask = { id: string; estimateMinutes: number | null };

export function focusMinutes(sessions: FocusMetricSession[]) {
  return Math.round(sessions.reduce((total, session) => total + Math.max(0, session.activeSeconds), 0) / 60);
}

export function focusEstimateAccuracy(sessions: FocusMetricSession[], tasks: FocusMetricTask[]) {
  const estimateByTask = new Map(tasks.filter(task => task.estimateMinutes && task.estimateMinutes > 0).map(task => [task.id, task.estimateMinutes!]));
  const actualByTask = new Map<string, number>();
  for (const session of sessions) {
    if (!session.taskId || !estimateByTask.has(session.taskId) || session.state === "active" || session.state === "paused") continue;
    actualByTask.set(session.taskId, (actualByTask.get(session.taskId) ?? 0) + Math.max(0, session.activeSeconds));
  }
  const comparisons = Array.from(actualByTask.entries()).map(([taskId, seconds]) => ({ estimateMinutes: estimateByTask.get(taskId)!, actualMinutes: Math.round(seconds / 60) }));
  if (!comparisons.length) return { measuredTasks: 0, averageVarianceMinutes: null, direction: "not_enough_data" as const };
  const averageVarianceMinutes = Math.round(comparisons.reduce((total, item) => total + (item.actualMinutes - item.estimateMinutes), 0) / comparisons.length);
  return { measuredTasks: comparisons.length, averageVarianceMinutes, direction: averageVarianceMinutes === 0 ? "on_target" as const : averageVarianceMinutes > 0 ? "underestimated" as const : "overestimated" as const };
}
