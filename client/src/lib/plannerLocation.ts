import {
  actionForPlannerTarget,
  isGlobalPlannerAction,
  isPlannerLocationTarget,
  resolveLegacyPlannerAlias,
  type GlobalPlannerAction,
  type PlannerDestinationId,
  type PlannerLocationTarget,
  type PlannerViewId,
} from "@shared/phase4Navigation";

export type PlannerLocation = PlannerLocationTarget & {
  query: string;
  taskQuery: string;
  taskFilter: string;
  selectedRecord: string | null;
};

export type PlannerLocationUpdate = PlannerLocationTarget & {
  query?: string | null;
  taskQuery?: string | null;
  taskFilter?: string | null;
  selectedRecord?: string | null;
};

export type PlannerHistory = Pick<History, "pushState" | "replaceState">;

export type PlannerPopStateTarget = Pick<
  Window,
  "addEventListener" | "removeEventListener"
> & {
  location: Pick<Location, "href">;
};

const defaultLocationTarget: PlannerLocationTarget = {
  destination: "home",
  view: "today",
};

function canonicalTargetFrom(url: URL): PlannerLocationTarget | null {
  const destination = url.searchParams.get("destination");
  const view = url.searchParams.get("view");
  const actionValue = url.searchParams.get("action");
  if (!destination || !view) return null;
  const action = isGlobalPlannerAction(actionValue) ? actionValue : undefined;
  const candidate = {
    destination,
    view,
    ...(action ? { action } : {}),
  };
  if (!isPlannerLocationTarget(candidate)) return null;
  const inferredAction = actionForPlannerTarget(candidate);
  return {
    destination: candidate.destination as PlannerDestinationId,
    view: candidate.view as PlannerViewId,
    ...((action ?? inferredAction) ? { action: action ?? inferredAction } : {}),
  };
}

function locationTargetFrom(url: URL): PlannerLocationTarget {
  const canonical = canonicalTargetFrom(url);
  if (canonical) return canonical;
  if (url.pathname === "/calendar" || url.pathname.startsWith("/calendar/")) {
    return { destination: "plan", view: "calendar" };
  }
  return (
    resolveLegacyPlannerAlias(url.searchParams.get("surface")) ??
    defaultLocationTarget
  );
}

export function parsePlannerLocation(url: URL): PlannerLocation {
  return {
    ...locationTargetFrom(url),
    query: url.searchParams.get("q") ?? "",
    taskQuery: url.searchParams.get("taskQ") ?? "",
    taskFilter: url.searchParams.get("taskFilter") ?? "all",
    selectedRecord: url.searchParams.get("record"),
  };
}

function setOptionalParameter(
  parameters: URLSearchParams,
  key: string,
  value: string | null | undefined
) {
  if (value === undefined) return;
  if (value === null || value === "") parameters.delete(key);
  else parameters.set(key, value);
}

/**
 * Creates a new canonical URL. When a History port is supplied, this is a
 * user-navigation write and therefore creates a Back/Forward entry.
 */
export function writePlannerLocation(
  currentUrl: URL,
  next: PlannerLocationUpdate,
  history?: Pick<PlannerHistory, "pushState">
): URL {
  const url = new URL(currentUrl.href);
  if (url.pathname === "/calendar" || url.pathname.startsWith("/calendar/")) {
    url.pathname = "/";
  }
  url.searchParams.delete("surface");
  url.searchParams.set("destination", next.destination);
  url.searchParams.set("view", next.view);
  const action = next.action ?? actionForPlannerTarget(next);
  if (action) url.searchParams.set("action", action);
  else url.searchParams.delete("action");
  setOptionalParameter(url.searchParams, "q", next.query);
  setOptionalParameter(url.searchParams, "taskQ", next.taskQuery);
  setOptionalParameter(url.searchParams, "taskFilter", next.taskFilter);
  setOptionalParameter(url.searchParams, "record", next.selectedRecord);
  history?.pushState(null, "", url.href);
  return url;
}

export type OwnedOneShotPlannerParameter = "create" | "compose" | "source";

/** Removes only app-owned, one-shot intent and replaces the current entry. */
export function consumeOwnedPlannerLocationParameters(
  currentUrl: URL,
  ownedParameters: readonly OwnedOneShotPlannerParameter[],
  history?: Pick<PlannerHistory, "replaceState">
): URL {
  const url = new URL(currentUrl.href);
  for (const parameter of ownedParameters) url.searchParams.delete(parameter);
  history?.replaceState(null, "", url.href);
  return url;
}

export function subscribeToPlannerLocation(
  target: PlannerPopStateTarget,
  listener: (location: PlannerLocation) => void
) {
  const onPopState = () => {
    listener(parsePlannerLocation(new URL(target.location.href)));
  };
  target.addEventListener("popstate", onPopState);
  return () => target.removeEventListener("popstate", onPopState);
}

export function plannerLocationWithAction(
  location: PlannerLocation,
  action: GlobalPlannerAction | undefined
): PlannerLocation {
  return { ...location, ...(action ? { action } : { action: undefined }) };
}
