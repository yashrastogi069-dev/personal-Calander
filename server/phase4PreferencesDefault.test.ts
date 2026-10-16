// D3.5 2.1 and owner question 3: the new phone bar default (Home / Today / + / Calendar / More) and the
// one-time move away from the old code default. A working assumption the owner may revise; the rule lives
// in `migratePreviousDefaultPrimary` only.
import { describe, expect, it } from "vitest";
import {
  plannerPreferencesBackupKey,
  plannerPreferencesStorageKey,
  migrateStoredPlannerPreferences,
} from "../client/src/features/shell/usePlannerPreferences";
import {
  migratePhase4Preferences,
  migratePreviousDefaultPrimary,
  phase4DefaultPreferences,
  phase4PrimaryDefaultRevision,
  type PlannerPreferenceShortcut,
} from "../shared/phase4Preferences";

const keys = (targets: readonly PlannerPreferenceShortcut[]) => targets.map(target => `${target.destination}/${target.view}`);

const oldDefault: PlannerPreferenceShortcut[] = [
  { destination: "home", view: "today" },
  { destination: "tasks", view: "list" },
  { destination: "plan", view: "daily" },
  { destination: "intentions", view: "projects" },
];

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function storedV1(primary: PlannerPreferenceShortcut[], extra: Record<string, unknown> = {}) {
  return JSON.stringify({
    version: 1,
    order: oldDefault,
    primary,
    density: "compact",
    railCollapsed: false,
    overview: { order: [], hidden: [] },
    ...extra,
  });
}

describe("phone bar default (D3.5 2.1)", () => {
  it("pins exactly Home (Dashboard), Today and Calendar", () => {
    expect(keys(phase4DefaultPreferences.primary)).toEqual(["home/overview", "home/today", "plan/calendar"]);
    expect(phase4DefaultPreferences.primaryRevision).toBe(phase4PrimaryDefaultRevision);
  });
  it("orders the same three first, then Tasks, Daily plan, Projects, Habits, Review, Focus, Settings, with no duplicates", () => {
    const order = keys(phase4DefaultPreferences.order);
    expect(order.slice(0, 10)).toEqual([
      "home/overview",
      "home/today",
      "plan/calendar",
      "tasks/list",
      "plan/daily",
      "intentions/projects",
      "habits/due",
      "review/rituals",
      "home/focus",
      "settings/account",
    ]);
    expect(new Set(order).size).toBe(order.length);
    expect(order).toEqual(expect.arrayContaining(["plan/roadmap", "settings/device", "review/insights"]));
  });
  it("falls back to the new default for missing and malformed storage", () => {
    expect(keys(migratePhase4Preferences(null).preferences.primary)).toEqual(["home/overview", "home/today", "plan/calendar"]);
    expect(keys(migratePhase4Preferences("{oops").preferences.primary)).toEqual(["home/overview", "home/today", "plan/calendar"]);
    expect(keys(migratePhase4Preferences(storedV1([])).preferences.primary)).toEqual(["home/overview", "home/today", "plan/calendar"]);
  });
});

describe("migratePreviousDefaultPrimary", () => {
  it("replaces a list that is exactly the old default", () => {
    const result = migratePreviousDefaultPrimary(oldDefault, undefined);
    expect(result.replaced).toBe(true);
    expect(keys(result.primary)).toEqual(["home/overview", "home/today", "plan/calendar"]);
  });
  it("leaves every other list alone: reordered, shorter, longer, different, or carrying an action", () => {
    const variants: PlannerPreferenceShortcut[][] = [
      [oldDefault[1], oldDefault[0], oldDefault[2], oldDefault[3]],
      oldDefault.slice(0, 3),
      [...oldDefault, { destination: "habits", view: "due" }],
      [oldDefault[0], oldDefault[1], oldDefault[2], { destination: "habits", view: "due" }],
      [{ ...oldDefault[0], action: "focus" }, oldDefault[1], oldDefault[2], oldDefault[3]],
    ];
    for (const primary of variants) {
      const result = migratePreviousDefaultPrimary(primary, undefined);
      expect(result.replaced).toBe(false);
      expect(result.primary).toEqual(primary);
    }
  });
  it("runs once: a list stamped with the current revision is never replaced, even if it equals the old default", () => {
    const result = migratePreviousDefaultPrimary(oldDefault, phase4PrimaryDefaultRevision);
    expect(result.replaced).toBe(false);
    expect(keys(result.primary)).toEqual(keys(oldDefault));
  });
  it("does not mutate its input", () => {
    const input = oldDefault.map(target => ({ ...target }));
    migratePreviousDefaultPrimary(input, undefined).primary[0].view = "changed" as never;
    expect(input).toEqual(oldDefault);
  });
});

describe("migratePhase4Preferences with the bar move", () => {
  it("moves a stored v1 old default once, keeps every other setting, and reports it as migrated", () => {
    const migration = migratePhase4Preferences(storedV1(oldDefault));
    expect(migration.status).toBe("migrated");
    expect(keys(migration.preferences.primary)).toEqual(["home/overview", "home/today", "plan/calendar"]);
    expect(migration.preferences.density).toBe("compact");
    expect(migration.preferences.primaryRevision).toBe(phase4PrimaryDefaultRevision);
    // Re-reading the written result is a no-op.
    const again = migratePhase4Preferences(JSON.stringify(migration.preferences));
    expect(again.status).toBe("current");
    expect(again.preferences).toEqual(migration.preferences);
  });
  it("keeps a customised v1 list and stamps the revision", () => {
    const custom = [{ destination: "plan", view: "weekly" }, { destination: "habits", view: "due" }] as PlannerPreferenceShortcut[];
    const migration = migratePhase4Preferences(storedV1(custom));
    expect(migration.status).toBe("current");
    expect(migration.preferences.primary).toEqual(custom);
    expect(migration.preferences.primaryRevision).toBe(phase4PrimaryDefaultRevision);
  });
  it("keeps the old four when the owner re-picked them after the move", () => {
    const migration = migratePhase4Preferences(storedV1(oldDefault, { primaryRevision: phase4PrimaryDefaultRevision }));
    expect(migration.status).toBe("current");
    expect(keys(migration.preferences.primary)).toEqual(keys(oldDefault));
  });
  it("leaves a saved order untouched (only the pins move)", () => {
    const migration = migratePhase4Preferences(storedV1(oldDefault));
    expect(keys(migration.preferences.order).slice(0, 4)).toEqual(keys(oldDefault));
  });
});

describe("stored preferences: one write with the existing backup key", () => {
  it("backs up the raw value, persists the move once, and keeps the backup on later reads", () => {
    const storage = new MemoryStorage();
    const workspaceId = "workspace-d35";
    const key = plannerPreferencesStorageKey(workspaceId);
    const backupKey = plannerPreferencesBackupKey(workspaceId);
    const raw = storedV1(oldDefault);
    storage.setItem(key, raw);

    const preferences = migrateStoredPlannerPreferences(storage, workspaceId);
    expect(keys(preferences.primary)).toEqual(["home/overview", "home/today", "plan/calendar"]);
    expect(storage.getItem(backupKey)).toBe(raw);
    const written = storage.getItem(key);
    expect(JSON.parse(written ?? "{}").primaryRevision).toBe(phase4PrimaryDefaultRevision);

    migrateStoredPlannerPreferences(storage, workspaceId);
    expect(storage.getItem(key)).toBe(written);
    expect(storage.getItem(backupKey)).toBe(raw);
  });
  it("never overwrites an existing v0 backup", () => {
    const storage = new MemoryStorage();
    const workspaceId = "workspace-v0";
    storage.setItem(plannerPreferencesBackupKey(workspaceId), "v0-original");
    storage.setItem(plannerPreferencesStorageKey(workspaceId), storedV1(oldDefault));
    migrateStoredPlannerPreferences(storage, workspaceId);
    expect(storage.getItem(plannerPreferencesBackupKey(workspaceId))).toBe("v0-original");
  });
});
