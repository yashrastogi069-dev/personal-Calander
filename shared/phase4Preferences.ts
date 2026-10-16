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
  /**
   * Which code default the phone bar pins were last checked against. Absent on lists saved
   * before D3.5; see migratePreviousDefaultPrimary.
   */
  primaryRevision?: typeof phase4PrimaryDefaultRevision;
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
  { destination: "plan", view: "roadmap" },
  { destination: "intentions", view: "outcomes" },
  { destination: "settings", view: "connections" },
  { destination: "review", view: "insights" },
  { destination: "settings", view: "categories" },
  { destination: "home", view: "overview" },
  { destination: "plan", view: "weekly" },
  { destination: "review", view: "history" },
  { destination: "settings", view: "appearance" },
  { destination: "settings", view: "planning" },
  { destination: "settings", view: "navigation" },
  { destination: "settings", view: "sync" },
  { destination: "settings", view: "device" },
] as const satisfies readonly PlannerPreferenceShortcut[];

/** Bar destinations (D3.5 2.1): Home (Dashboard), Today, Calendar; the centre `+` and More are fixed. */
const defaultPrimaryTargets: PlannerPreferenceShortcut[] = [
  { destination: "home", view: "overview" },
  { destination: "home", view: "today" },
  { destination: "plan", view: "calendar" },
];

const defaultShortcutTargets: PlannerPreferenceShortcut[] = uniqueTargets([
  ...defaultPrimaryTargets,
  { destination: "tasks", view: "list" },
  { destination: "plan", view: "daily" },
  { destination: "intentions", view: "projects" },
  { destination: "habits", view: "due" },
  { destination: "review", view: "rituals" },
  { destination: "home", view: "focus", action: "focus", legacyId: "focus" },
  { destination: "settings", view: "account", legacyId: "settings" },
  ...phase4SecondaryShortcutTargets,
]);

/** Bumped when the code default for `primary` changes in a way saved lists should follow once. */
export const phase4PrimaryDefaultRevision = 2 as const;

/** The pre-D3.5 code default for `primary` (Today, Tasks, Daily plan, Projects), as destination/view keys. */
export const phase4PreviousDefaultPrimaryKeys = [
  "home/today",
  "tasks/list",
  "plan/daily",
  "intentions/projects",
] as const;

export const phase4DefaultPreferences: Phase4Preferences = {
  version: 1,
  order: defaultShortcutTargets,
  primary: defaultPrimaryTargets,
  density: "comfortable",
  railCollapsed: false,
  overview: { order: [], hidden: [] },
  primaryRevision: phase4PrimaryDefaultRevision,
};

/**
 * One-time move from the old bar default to the new one (D3.5 owner question 3, a working
 * assumption the owner may revise). A saved list is replaced only when it is exactly the old
 * default in the same order and has never been checked at this revision; any other list, or a
 * list the owner re-picked after the move (revision already stamped), is returned unchanged.
 */
export function migratePreviousDefaultPrimary(
  primary: readonly PlannerPreferenceShortcut[],
  storedRevision: unknown
): { primary: PlannerPreferenceShortcut[]; replaced: boolean } {
  const copy = primary.map(target => ({ ...target }));
  if (storedRevision === phase4PrimaryDefaultRevision) {
    return { primary: copy, replaced: false };
  }
  const matchesOldDefault =
    primary.length === phase4PreviousDefaultPrimaryKeys.length &&
    primary.every(
      (target, index) =>
        targetKey(target) === phase4PreviousDefaultPrimaryKeys[index] &&
        !target.action
    );
  if (!matchesOldDefault) return { primary: copy, replaced: false };
  return {
    primary: defaultPrimaryTargets.map(target => ({ ...target })),
    replaced: true,
  };
}

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
): { preferences: Phase4Preferences; primaryReplaced: boolean } {
  const defaults = cloneDefaults();
  const storedOrder = shortcutArray(value.order);
  const order = uniqueTargets([
    ...(storedOrder.length ? storedOrder : defaults.order),
    ...phase4SecondaryShortcutTargets,
  ]);
  const stored = migratePreviousDefaultPrimary(
    shortcutArray(value.primary),
    value.primaryRevision
  );
  const primary = stored.primary;
  const overviewValue =
    value.overview && typeof value.overview === "object"
      ? (value.overview as Record<string, unknown>)
      : null;
  const preferences: Phase4Preferences = {
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
    primaryRevision: phase4PrimaryDefaultRevision,
  };
  return { preferences, primaryReplaced: stored.replaced };
}

function migrateLegacy(
  value: Record<string, unknown>,
  options: Phase4PreferenceMigrationOptions
): Phase4Preferences {
  const defaults = cloneDefaults();
  const legacyOrder = shortcutArray(value.order);
  const order = uniqueTargets([...legacyOrder, ...defaults.order]);
  const primary = migratePreviousDefaultPrimary(
    shortcutArray(value.primary),
    undefined
  ).primary;
  return {
    version: 1,
    order,
    primary: primary.length ? primary : defaults.primary,
    density: value.density === "compact" ? "compact" : "comfortable",
    railCollapsed: railCollapsedFrom(undefined, options.railCollapsedRaw),
    overview: defaults.overview,
    primaryRevision: phase4PrimaryDefaultRevision,
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
    const current = migrateCurrent(record, options);
    // "migrated" makes migrateStoredPlannerPreferences keep the raw value in the existing
    // backup key (if none exists yet) and persist the move once.
    return {
      status: current.primaryReplaced ? "migrated" : "current",
      preferences: current.preferences,
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
