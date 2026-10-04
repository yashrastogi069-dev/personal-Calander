import { shiftLocalDate } from "@/lib/workspace";
import type { CanonicalTask } from "@shared/canonicalTask";

export type TodayHabitCheckInFact = {
  habitId: string;
  localDate: string;
  state: string;
};

export type TodayMilestoneFact = {
  id: string;
  goalId?: string | null;
  title: string;
  dueLocalDate?: string | null;
  state?: string | null;
};

export type HabitTraceDay = {
  localDate: string;
  weekday: string;
  state: "completed" | "missed" | "skipped" | "unrecorded";
};

export type HabitActivityDay = {
  localDate: string;
  completed: number;
  missed: number;
  skipped: number;
};

/** Counts saved records in the supplied snapshot window; absence is unknown. */
export function todayHabitActivity(
  localDate: string,
  habitIds: readonly string[],
  checkIns: readonly TodayHabitCheckInFact[],
): HabitActivityDay[] {
  const visibleIds = new Set(habitIds);
  const days = Array.from({ length: 28 }, (_, index) => ({
    localDate: shiftLocalDate(localDate, index - 27),
    completed: 0,
    missed: 0,
    skipped: 0,
  }));
  const byDate = new Map(days.map(day => [day.localDate, day]));
  for (const item of checkIns) {
    if (!visibleIds.has(item.habitId)) continue;
    const day = byDate.get(item.localDate);
    if (!day) continue;
    if (item.state === "completed") day.completed++;
    else if (item.state === "missed") day.missed++;
    else if (item.state === "skipped") day.skipped++;
  }
  return days;
}

/** Only explicit saved check-ins can color a past day as complete or missed. */
export function todayHabitTrace(
  habitId: string,
  localDate: string,
  checkIns: readonly TodayHabitCheckInFact[],
  todayState?: string,
): HabitTraceDay[] {
  const facts = new Map(checkIns.filter(item => item.habitId === habitId).map(item => [item.localDate, item.state]));
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftLocalDate(localDate, index - 6);
    const fact = facts.get(date) ?? (date === localDate ? todayState : undefined);
    const state = fact === "completed" || fact === "missed" || fact === "skipped" ? fact : "unrecorded";
    return {
      localDate: date,
      weekday: new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)),
      state,
    };
  });
}

/** A milestone is relevant only through a task's explicit goal or its project's goal. */
export function nextTodayMilestone(input: {
  localDate: string;
  visibleTaskIds: readonly string[];
  tasks: readonly CanonicalTask[];
  projects: readonly { id: string; goalId?: string | null }[];
  milestones: readonly TodayMilestoneFact[];
}) {
  const visible = new Set(input.visibleTaskIds);
  const projectGoal = new Map(input.projects.map(project => [project.id, project.goalId]));
  const goalIds = new Set(input.tasks.filter(task => visible.has(task.id)).flatMap(task => [task.goalId, task.projectId ? projectGoal.get(task.projectId) : null]).filter((id): id is string => Boolean(id)));
  return input.milestones
    .filter(item => item.goalId && goalIds.has(item.goalId) && item.dueLocalDate && item.dueLocalDate >= input.localDate && item.state !== "completed" && item.state !== "archived")
    .sort((left, right) => left.dueLocalDate!.localeCompare(right.dueLocalDate!) || left.title.localeCompare(right.title))[0] ?? null;
}
