export type ForecastTask = {
  state: string;
  dueLocalDate?: string | null;
  scheduledLocalDate?: string | null;
  plannedStartAt?: Date | string | null;
  estimateMinutes?: number | null;
};

export type DeadlineRisk = "overdue" | "due_today" | "unplanned_soon";

function utcDayStamp(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysFromToday(localDate: string, todayLocalDate: string) {
  return Math.round((utcDayStamp(localDate) - utcDayStamp(todayLocalDate)) / 86_400_000);
}

export function deadlineRiskForTask(task: ForecastTask, todayLocalDate: string): DeadlineRisk | null {
  if (task.state === "completed" || task.state === "archived" || !task.dueLocalDate) return null;
  const daysUntilDeadline = daysFromToday(task.dueLocalDate, todayLocalDate);
  if (daysUntilDeadline < 0) return "overdue";
  if (daysUntilDeadline === 0) return "due_today";
  const hasPlanOnOrBeforeDeadline = Boolean(task.scheduledLocalDate && task.scheduledLocalDate <= task.dueLocalDate);
  return daysUntilDeadline <= 2 && !hasPlanOnOrBeforeDeadline ? "unplanned_soon" : null;
}

export function deadlineRiskLabel(risk: DeadlineRisk) {
  if (risk === "overdue") return "Overdue";
  if (risk === "due_today") return "Due today";
  return "Due soon · no plan";
}

export function dailyCapacityForecast(tasks: ForecastTask[], todayLocalDate: string, capacityMinutes: number) {
  const activeTasks = tasks.filter(task => task.state !== "completed" && task.state !== "archived");
  const todayTasks = activeTasks.filter(task => task.scheduledLocalDate === todayLocalDate || task.dueLocalDate === todayLocalDate);
  const plannedMinutes = todayTasks.reduce((sum, task) => sum + Math.max(0, task.estimateMinutes ?? 0), 0);
  const reservedMinutes = todayTasks.filter(task => Boolean(task.plannedStartAt)).reduce((sum, task) => sum + Math.max(0, task.estimateMinutes ?? 0), 0);
  const deadlineOnlyMinutes = todayTasks.filter(task => task.dueLocalDate === todayLocalDate && task.scheduledLocalDate !== todayLocalDate).reduce((sum, task) => sum + Math.max(0, task.estimateMinutes ?? 0), 0);
  const unestimatedCount = todayTasks.filter(task => task.estimateMinutes === null || task.estimateMinutes === undefined).length;
  const deadlineRiskCount = activeTasks.filter(task => deadlineRiskForTask(task, todayLocalDate) !== null).length;
  const remainingMinutes = capacityMinutes - plannedMinutes;

  return {
    todayTaskCount: todayTasks.length,
    plannedMinutes,
    capacityMinutes,
    remainingMinutes,
    isOverCapacity: remainingMinutes < 0,
    reservedMinutes,
    deadlineOnlyMinutes,
    unestimatedCount,
    deadlineRiskCount,
  } as const;
}
