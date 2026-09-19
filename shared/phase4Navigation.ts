export const phase4Destinations = [
  { id: "home", label: "Home", views: ["today", "overview"] },
  {
    id: "tasks",
    label: "Tasks",
    views: ["inbox", "list", "board", "saved", "archive"],
  },
  {
    id: "plan",
    label: "Plan",
    views: ["daily", "weekly", "calendar", "roadmap"],
  },
  {
    id: "intentions",
    label: "Projects & Goals",
    views: ["projects", "outcomes", "directions"],
  },
  { id: "habits", label: "Habits", views: ["due", "history"] },
  {
    id: "review",
    label: "Review",
    views: ["rituals", "insights", "history"],
  },
] as const;

export const globalPlannerActions = ["capture", "search", "focus"] as const;

export type Phase4DestinationId = (typeof phase4Destinations)[number]["id"];
export type GlobalPlannerAction = (typeof globalPlannerActions)[number];
export type PlannerDestinationId = Phase4DestinationId | "settings";
export type Phase4PrimaryView =
  (typeof phase4Destinations)[number]["views"][number];
export type PlannerViewId =
  | Phase4PrimaryView
  | "focus"
  | "search"
  | "account"
  | "appearance"
  | "navigation"
  | "sync"
  | "connections"
  | "categories"
  | "device";

export type PlannerLocationTarget = {
  destination: PlannerDestinationId;
  view: PlannerViewId;
  action?: GlobalPlannerAction;
};

/**
 * Compatibility catalog for every destination shipped by the R20 mobile
 * planner. These ids remain valid shortcuts even when the production shell
 * renders the six Phase 4 groups instead.
 */
export const legacyPlannerAliases = [
  { id: "today", label: "Today", destination: "home", view: "today" },
  {
    id: "capture",
    label: "Capture",
    destination: "tasks",
    view: "inbox",
    action: "capture",
  },
  { id: "plan", label: "Plan", destination: "plan", view: "daily" },
  { id: "tasks", label: "Tasks", destination: "tasks", view: "list" },
  {
    id: "search",
    label: "Search",
    destination: "home",
    view: "search",
    action: "search",
  },
  {
    id: "calendar",
    label: "Calendar",
    destination: "plan",
    view: "calendar",
  },
  {
    id: "goals",
    label: "Goals",
    destination: "intentions",
    view: "outcomes",
  },
  {
    id: "projects",
    label: "Projects",
    destination: "intentions",
    view: "projects",
  },
  { id: "habits", label: "Habits", destination: "habits", view: "due" },
  {
    id: "focus",
    label: "Focus",
    destination: "home",
    view: "focus",
    action: "focus",
  },
  {
    id: "connections",
    label: "Connections",
    destination: "settings",
    view: "connections",
  },
  {
    id: "insights",
    label: "Insights",
    destination: "review",
    view: "insights",
  },
  {
    id: "review",
    label: "Review",
    destination: "review",
    view: "rituals",
  },
  {
    id: "settings",
    label: "Settings",
    destination: "settings",
    view: "account",
  },
] as const satisfies readonly ({
  id: string;
  label: string;
} & PlannerLocationTarget)[];

export type LegacyPlannerAliasId = (typeof legacyPlannerAliases)[number]["id"];

const phase4Views = new Map<string, ReadonlySet<string>>(
  phase4Destinations.map(destination => [
    destination.id,
    new Set<string>(destination.views),
  ])
);

const settingsViews = new Set<string>([
  "account",
  "appearance",
  "navigation",
  "sync",
  "connections",
  "categories",
  "device",
]);

const globalActionViews = new Map<string, GlobalPlannerAction>([
  ["tasks/inbox", "capture"],
  ["home/search", "search"],
  ["home/focus", "focus"],
]);

export function isPlannerDestinationId(
  value: unknown
): value is PlannerDestinationId {
  return (
    value === "settings" ||
    phase4Destinations.some(destination => destination.id === value)
  );
}

export function isGlobalPlannerAction(
  value: unknown
): value is GlobalPlannerAction {
  return globalPlannerActions.some(action => action === value);
}

export function isPlannerLocationTarget(
  value: unknown
): value is PlannerLocationTarget {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (
    !isPlannerDestinationId(candidate.destination) ||
    typeof candidate.view !== "string"
  )
    return false;

  const key = `${candidate.destination}/${candidate.view}`;
  const viewIsValid =
    (candidate.destination === "settings" &&
      settingsViews.has(candidate.view)) ||
    phase4Views.get(candidate.destination)?.has(candidate.view) === true ||
    globalActionViews.has(key);
  if (!viewIsValid) return false;

  if (candidate.action === undefined) return true;
  return (
    isGlobalPlannerAction(candidate.action) &&
    globalActionViews.get(key) === candidate.action
  );
}

export function actionForPlannerTarget(
  target: Pick<PlannerLocationTarget, "destination" | "view">
): GlobalPlannerAction | undefined {
  return globalActionViews.get(`${target.destination}/${target.view}`);
}

export function resolveLegacyPlannerAlias(
  value: string | null | undefined
): PlannerLocationTarget | null {
  const alias = legacyPlannerAliases.find(candidate => candidate.id === value);
  if (!alias) return null;
  return {
    destination: alias.destination,
    view: alias.view,
    ...("action" in alias ? { action: alias.action } : {}),
  };
}

export function isLegacyPlannerAliasId(
  value: unknown
): value is LegacyPlannerAliasId {
  return legacyPlannerAliases.some(alias => alias.id === value);
}
