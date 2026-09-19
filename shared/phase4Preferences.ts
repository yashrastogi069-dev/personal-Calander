import {
  isLegacyPlannerAliasId,
  isPlannerLocationTarget,
  legacyPlannerAliases,
  resolveLegacyPlannerAlias,
  type GlobalPlannerAction,
  type LegacyPlannerAliasId,
  type PlannerDestinationId,
  type PlannerLocationTarget,
  type PlannerViewId,
} from "./phase4Navigation";

export type PlannerPreferenceShortcut = PlannerLocationTarget & {
  legacyId?: LegacyPlannerAliasId;
};

export type Phase4OverviewPreferences = {
  order: string[];
  hidden: string[];
};

export type Phase4Preferences = {
  version: 1;
  order: PlannerPreferenceShortcut[];
  primary: PlannerPreferenceShortcut[];
  density: "comfortable" | "compact";
  railCollapsed: boolean;
  overview: Phase4OverviewPreferences;
};

export type Phase4PreferenceMigration = {
  status: "default" | "current" | "migrated" | "malformed";
  preferences: Phase4Preferences;
};

export type Phase4PreferenceMigrationOptions = {
  railCollapsedRaw?: string | null;
};

export const phase4SecondaryShortcutTargets = [
  { destination: "plan", view: "calendar" },
  { destination: "intentions", view: "outcomes" },
  { destination: "settings", view: "connections" },
  { destination: "review", view: "insights" },
  { destination: "settings", view: "categories" },
] as const satisfies readonly PlannerPreferenceShortcut[];

const defaultShortcutTargets: PlannerPreferenceShortcut[] = [
  { destination: "home", view: "today" },
  { destination: "tasks", view: "list" },
  { destination: "plan", view: "daily" },
  { destination: "intentions", view: "projects" },
  { destination: "habits", view: "due" },
  { destination: "review", view: "rituals" },
  { destination: "home", view: "focus", action: "focus", legacyId: "focus" },
  { destination: "settings", view: "account", legacyId: "settings" },
  ...phase4SecondaryShortcutTargets,
];

export const phase4DefaultPreferences: Phase4Preferences = {
  version: 1,
  order: defaultShortcutTargets,
  primary: defaultShortcutTargets.slice(0, 4),
  density: "comfortable",
  railCollapsed: false,
  overview: { order: [], hidden: [] },
};

function cloneShortcut(
  shortcut: PlannerPreferenceShortcut
): PlannerPreferenceShortcut {
  return { ...shortcut };
}

function cloneDefaults(): Phase4Preferences {
  return {
    ...phase4DefaultPreferences,
    order: phase4DefaultPreferences.order.map(cloneShortcut),
    primary: phase4DefaultPreferences.primary.map(cloneShortcut),
    overview: {
      order: [...phase4DefaultPreferences.overview.order],
      hidden: [...phase4DefaultPreferences.overview.hidden],
    },
  };
}

function targetKey(
  target: Pick<PlannerPreferenceShortcut, "destination" | "view">
) {
  return `${target.destination}/${target.view}`;
}

function uniqueTargets(
  targets: readonly PlannerPreferenceShortcut[]
): PlannerPreferenceShortcut[] {
  const seen = new Set<string>();
  return targets.filter(target => {
    const key = targetKey(target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function shortcutFromLegacyId(
  value: unknown
): PlannerPreferenceShortcut | null {
  if (!isLegacyPlannerAliasId(value)) return null;
  const target = resolveLegacyPlannerAlias(value);
  return target ? { ...target, legacyId: value } : null;
}

function shortcutFromUnknown(value: unknown): PlannerPreferenceShortcut | null {
  if (typeof value === "string") return shortcutFromLegacyId(value);
  if (!isPlannerLocationTarget(value)) return null;
  const candidate = value as PlannerLocationTarget & { legacyId?: unknown };
  const legacyId = isLegacyPlannerAliasId(candidate.legacyId)
    ? candidate.legacyId
    : undefined;
  return {
    destination: candidate.destination as PlannerDestinationId,
    view: candidate.view as PlannerViewId,
    ...(candidate.action
      ? { action: candidate.action as GlobalPlannerAction }
      : {}),
    ...(legacyId ? { legacyId } : {}),
  };
}

function shortcutArray(value: unknown): PlannerPreferenceShortcut[] {
  if (!Array.isArray(value)) return [];
  return uniqueTargets(
    value
      .map(shortcutFromUnknown)
      .filter((item): item is PlannerPreferenceShortcut => item !== null)
  );
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => typeof item === "string"))
  );
}

function railCollapsedFrom(
  value: unknown,
  railCollapsedRaw: string | null | undefined
) {
  if (typeof value === "boolean") return value;
  return railCollapsedRaw === "true";
}

function migrateCurrent(
  value: Record<string, unknown>,
  options: Phase4PreferenceMigrationOptions
): Phase4Preferences {
  const defaults = cloneDefaults();
  const storedOrder = shortcutArray(value.order);
  const order = uniqueTargets([
    ...(storedOrder.length ? storedOrder : defaults.order),
    ...phase4SecondaryShortcutTargets,
  ]);
  const primary = shortcutArray(value.primary);
  const overviewValue =
    value.overview && typeof value.overview === "object"
      ? (value.overview as Record<string, unknown>)
      : null;
  return {
    version: 1,
    order,
    primary: primary.length ? primary : defaults.primary,
    density: value.density === "compact" ? "compact" : "comfortable",
    railCollapsed: railCollapsedFrom(
      value.railCollapsed,
      options.railCollapsedRaw
    ),
    overview: overviewValue
      ? {
          order: stringArray(overviewValue.order),
          hidden: stringArray(overviewValue.hidden),
        }
      : defaults.overview,
  };
}

function migrateLegacy(
  value: Record<string, unknown>,
  options: Phase4PreferenceMigrationOptions
): Phase4Preferences {
  const defaults = cloneDefaults();
  const legacyOrder = shortcutArray(value.order);
  const order = uniqueTargets([...legacyOrder, ...defaults.order]);
  const primary = shortcutArray(value.primary);
  return {
    version: 1,
    order,
    primary: primary.length ? primary : defaults.primary,
    density: value.density === "compact" ? "compact" : "comfortable",
    railCollapsed: railCollapsedFrom(undefined, options.railCollapsedRaw),
    overview: defaults.overview,
  };
}

export function migratePhase4Preferences(
  raw: string | null | undefined,
  options: Phase4PreferenceMigrationOptions = {}
): Phase4PreferenceMigration {
  if (raw === null || raw === undefined || raw === "") {
    const preferences = cloneDefaults();
    preferences.railCollapsed = options.railCollapsedRaw === "true";
    return { status: "default", preferences };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    const preferences = cloneDefaults();
    preferences.railCollapsed = options.railCollapsedRaw === "true";
    return { status: "malformed", preferences };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    const preferences = cloneDefaults();
    preferences.railCollapsed = options.railCollapsedRaw === "true";
    return { status: "malformed", preferences };
  }

  const record = value as Record<string, unknown>;
  if (record.version === 1) {
    return {
      status: "current",
      preferences: migrateCurrent(record, options),
    };
  }

  return {
    status: "migrated",
    preferences: migrateLegacy(record, options),
  };
}

export const phase4LegacyPreferenceIds = legacyPlannerAliases.map(
  alias => alias.id
);
