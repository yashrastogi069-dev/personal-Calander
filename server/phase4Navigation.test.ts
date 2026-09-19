import { describe, expect, it } from "vitest";
import {
  legacyPlannerAliases,
  phase4Destinations,
  resolveLegacyPlannerAlias,
} from "@shared/phase4Navigation";
import {
  migratePhase4Preferences,
  phase4DefaultPreferences,
} from "@shared/phase4Preferences";
import {
  consumeOwnedPlannerLocationParameters,
  parsePlannerLocation,
  subscribeToPlannerLocation,
  writePlannerLocation,
} from "@/lib/plannerLocation";
import {
  migrateStoredPlannerPreferences,
  plannerPreferencesBackupKey,
  plannerPreferencesStorageKey,
} from "@/features/shell/usePlannerPreferences";
import { mobilePlannerDestinations } from "@shared/mobileNavigation";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

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
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("Phase 4 planner navigation", () => {
  it("exposes the six primary groups without promoting settings to a seventh destination", () => {
    expect(phase4Destinations).toEqual([
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
    ]);
  });

  it("keeps every old mobile destination id as a resolvable shortcut alias", () => {
    expect(legacyPlannerAliases.map(alias => alias.id)).toEqual(
      mobilePlannerDestinations.map(destination => destination.id)
    );
    expect(resolveLegacyPlannerAlias("calendar")).toMatchObject({
      destination: "plan",
      view: "calendar",
    });
    expect(resolveLegacyPlannerAlias("focus")).toMatchObject({
      destination: "home",
      view: "focus",
      action: "focus",
    });
    expect(resolveLegacyPlannerAlias("unknown")).toBeNull();
  });

  it("parses legacy surfaces, the calendar path, search state, and capture intent", () => {
    expect(
      parsePlannerLocation(new URL("https://app.test/?surface=today&x=1"))
    ).toMatchObject({ destination: "home", view: "today" });
    expect(
      parsePlannerLocation(new URL("https://app.test/calendar?q=rent"))
    ).toMatchObject({
      destination: "plan",
      view: "calendar",
      query: "rent",
    });
    expect(
      parsePlannerLocation(
        new URL(
          "https://app.test/?surface=tasks&taskQ=release&taskFilter=deadline_risk&record=task-7"
        )
      )
    ).toMatchObject({
      destination: "tasks",
      view: "list",
      taskQuery: "release",
      taskFilter: "deadline_risk",
      selectedRecord: "task-7",
    });
    expect(
      parsePlannerLocation(new URL("https://app.test/?surface=capture"))
    ).toMatchObject({
      destination: "tasks",
      view: "inbox",
      action: "capture",
    });
  });

  it("writes canonical locations without dropping unknown or retained context parameters", () => {
    const current = new URL(
      "https://app.test/?unknown=keep&q=rent&taskFilter=today#task-7"
    );
    const written = writePlannerLocation(current, {
      destination: "review",
      view: "insights",
    });

    expect(written.href).toBe(
      "https://app.test/?unknown=keep&q=rent&taskFilter=today&destination=review&view=insights#task-7"
    );
    expect(current.href).toBe(
      "https://app.test/?unknown=keep&q=rent&taskFilter=today#task-7"
    );
  });

  it("uses pushState for user navigation and replaceState only for owned one-shot consumption", () => {
    const calls: Array<{ method: string; url: string }> = [];
    const history = {
      pushState: (_data: unknown, _unused: string, url?: string | URL | null) =>
        calls.push({ method: "push", url: String(url) }),
      replaceState: (
        _data: unknown,
        _unused: string,
        url?: string | URL | null
      ) => calls.push({ method: "replace", url: String(url) }),
    };

    writePlannerLocation(
      new URL("https://app.test/?unknown=keep"),
      { destination: "tasks", view: "board" },
      history
    );
    consumeOwnedPlannerLocationParameters(
      new URL("https://app.test/?create=task&source=pwa-shortcut&unknown=keep"),
      ["create", "source"],
      history
    );

    expect(calls).toEqual([
      {
        method: "push",
        url: "https://app.test/?unknown=keep&destination=tasks&view=board",
      },
      { method: "replace", url: "https://app.test/?unknown=keep" },
    ]);
  });

  it("re-parses browser Back and Forward popstate events", () => {
    const target = new EventTarget() as EventTarget & {
      location: { href: string };
    };
    target.location = { href: "https://app.test/?surface=today" };
    const seen: Array<{ destination: string; view: string }> = [];
    const unsubscribe = subscribeToPlannerLocation(target, location => {
      seen.push({
        destination: location.destination,
        view: location.view,
      });
    });

    target.location.href = "https://app.test/calendar?q=rent";
    target.dispatchEvent(new Event("popstate"));
    target.location.href = "https://app.test/?surface=habits";
    target.dispatchEvent(new Event("popstate"));
    unsubscribe();
    target.location.href = "https://app.test/?surface=review";
    target.dispatchEvent(new Event("popstate"));

    expect(seen).toEqual([
      { destination: "plan", view: "calendar" },
      { destination: "habits", view: "due" },
    ]);
  });
});

describe("Phase 4 device preference migration", () => {
  it("preserves every legacy order and pin through deterministic canonical targets", () => {
    const allLegacyIds = mobilePlannerDestinations.map(item => item.id);
    const migrated = migratePhase4Preferences(
      JSON.stringify({
        order: allLegacyIds,
        primary: ["calendar", "habits", "focus", "connections"],
        density: "compact",
      }),
      { railCollapsedRaw: "true" }
    );

    expect(migrated.status).toBe("migrated");
    expect(migrated.preferences.order.map(item => item.legacyId)).toEqual(
      allLegacyIds
    );
    expect(migrated.preferences.primary.map(item => item.legacyId)).toEqual([
      "calendar",
      "habits",
      "focus",
      "connections",
    ]);
    expect(migrated.preferences.density).toBe("compact");
    expect(migrated.preferences.railCollapsed).toBe(true);
  });

  it("collapses only exact destination/view duplicates and retains distinct views", () => {
    const migrated = migratePhase4Preferences(
      JSON.stringify({
        version: 1,
        order: [
          { destination: "plan", view: "calendar" },
          { destination: "plan", view: "calendar" },
          { destination: "plan", view: "daily" },
          { destination: "review", view: "history" },
        ],
        primary: [
          { destination: "plan", view: "calendar" },
          { destination: "plan", view: "daily" },
        ],
        density: "comfortable",
        railCollapsed: false,
        overview: { order: ["attention", "schedule"], hidden: ["schedule"] },
      })
    );

    expect(
      migrated.preferences.order.map(item => `${item.destination}/${item.view}`)
    ).toEqual(["plan/calendar", "plan/daily", "review/history"]);
    expect(migrated.preferences.overview).toEqual({
      order: ["attention", "schedule"],
      hidden: ["schedule"],
    });
  });

  it("falls back safely for malformed JSON without claiming it can be migrated", () => {
    const migrated = migratePhase4Preferences("{not-json", {
      railCollapsedRaw: "true",
    });

    expect(migrated.status).toBe("malformed");
    expect(migrated.preferences).toEqual({
      ...phase4DefaultPreferences,
      railCollapsed: true,
    });
  });

  it("backs up raw v0 JSON before writing v1 and never overwrites the rollback copy", () => {
    const storage = new MemoryStorage();
    const workspaceId = "workspace-7";
    const key = plannerPreferencesStorageKey(workspaceId);
    const backupKey = plannerPreferencesBackupKey(workspaceId);
    const raw = JSON.stringify({
      order: ["today", "tasks", "calendar", "habits", "focus"],
      primary: ["today", "calendar", "habits", "focus"],
      density: "compact",
    });
    storage.setItem(key, raw);

    const preferences = migrateStoredPlannerPreferences(storage, workspaceId);

    expect(storage.getItem(backupKey)).toBe(raw);
    expect(JSON.parse(storage.getItem(key) ?? "null")).toMatchObject({
      version: 1,
      density: "compact",
    });
    expect(preferences.primary.map(item => item.legacyId)).toEqual([
      "today",
      "calendar",
      "habits",
      "focus",
    ]);

    storage.setItem(key, JSON.stringify({ order: ["review"] }));
    migrateStoredPlannerPreferences(storage, workspaceId);
    expect(storage.getItem(backupKey)).toBe(raw);
  });

  it("leaves malformed stored values untouched and still reads the legacy rail key", () => {
    const storage = new MemoryStorage();
    const workspaceId = "workspace-malformed";
    const key = plannerPreferencesStorageKey(workspaceId);
    storage.setItem(key, "{not-json");
    storage.setItem("personal-calander:rail-collapsed", "true");

    const preferences = migrateStoredPlannerPreferences(storage, workspaceId);

    expect(storage.getItem(key)).toBe("{not-json");
    expect(
      storage.getItem(plannerPreferencesBackupKey(workspaceId))
    ).toBeNull();
    expect(preferences.railCollapsed).toBe(true);
  });
});
