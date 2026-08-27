export const mobilePlannerDestinations = [
  { id: "today", label: "Today" },
  { id: "plan", label: "Plan" },
  { id: "tasks", label: "Tasks" },
  { id: "calendar", label: "Calendar" },
  { id: "goals", label: "Goals" },
  { id: "habits", label: "Habits" },
  { id: "review", label: "Review" },
] as const;

export type MobilePlannerDestination = (typeof mobilePlannerDestinations)[number]["id"];

export const mobilePrimaryPlannerDestinations = mobilePlannerDestinations.slice(0, 4);
export const mobileMorePlannerDestinations = mobilePlannerDestinations.slice(4);

export function mobilePlannerNavLabel(label: string) {
  return `Open ${label}`;
}

export function hasCompleteMobilePlannerNavigation(destinations: readonly { id: string; label: string }[]) {
  const ids = destinations.map(destination => destination.id);
  return ids.length === mobilePlannerDestinations.length
    && new Set(ids).size === mobilePlannerDestinations.length
    && mobilePlannerDestinations.every(destination => ids.includes(destination.id));
}

export function hasCompletePhoneNavigationPattern(
  primary: readonly { id: string; label: string }[],
  more: readonly { id: string; label: string }[],
) {
  return hasCompleteMobilePlannerNavigation([...primary, ...more])
    && primary.length <= 4
    && more.length >= 1;
}
