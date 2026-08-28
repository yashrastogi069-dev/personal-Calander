export const goalHealthTriageFilters = ["all", "attention", "execution", "milestones"] as const;

export type GoalHealthTriageFilter = (typeof goalHealthTriageFilters)[number];

export type GoalHealthTriageItem = {
  goalId: string;
  isOverdue?: boolean;
  paceStatus?: "behind" | "on_pace" | "ahead" | "unavailable";
  reviewDue?: boolean;
  hasExecutionCoverage?: boolean;
  hasMilestoneCoverage?: boolean;
  daysUntilDue?: number | null;
};

export function goalHealthNeedsAttention(item: GoalHealthTriageItem) {
  return Boolean(item.isOverdue || item.paceStatus === "behind" || item.reviewDue);
}

export function matchesGoalHealthTriage(item: GoalHealthTriageItem | undefined, filter: GoalHealthTriageFilter) {
  if (filter === "all") return true;
  if (!item) return false;
  if (filter === "attention") return goalHealthNeedsAttention(item);
  if (filter === "execution") return item.hasExecutionCoverage === false;
  return item.hasMilestoneCoverage === false && item.daysUntilDue !== null && item.daysUntilDue !== undefined;
}

export function goalHealthTriageCount(items: GoalHealthTriageItem[], filter: GoalHealthTriageFilter) {
  return items.filter(item => matchesGoalHealthTriage(item, filter)).length;
}
