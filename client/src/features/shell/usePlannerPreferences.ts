import { useCallback, useEffect, useState } from "react";
import {
  migratePhase4Preferences,
  phase4DefaultPreferences,
  type Phase4Preferences,
} from "@shared/phase4Preferences";

const railCollapsedStorageKey = "personal-calander:rail-collapsed";

export function plannerPreferencesStorageKey(workspaceId: string) {
  return `personal-calander:mobile-preferences:${workspaceId}`;
}

export function plannerPreferencesBackupKey(workspaceId: string) {
  return `${plannerPreferencesStorageKey(workspaceId)}:phase4-backup`;
}

function safeGet(storage: Storage, key: string) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function readPlannerPreferences(
  storage: Storage | null,
  workspaceId: string
): Phase4Preferences {
  if (!storage) return structuredClone(phase4DefaultPreferences);
  return migratePhase4Preferences(
    safeGet(storage, plannerPreferencesStorageKey(workspaceId)),
    { railCollapsedRaw: safeGet(storage, railCollapsedStorageKey) }
  ).preferences;
}

/**
 * Performs the one-time v0 -> v1 write. The byte-for-byte legacy value is
 * saved first and never overwritten; malformed values are deliberately left
 * in place so a later repair can recover them.
 */
export function migrateStoredPlannerPreferences(
  storage: Storage,
  workspaceId: string
): Phase4Preferences {
  const key = plannerPreferencesStorageKey(workspaceId);
  const raw = safeGet(storage, key);
  const migration = migratePhase4Preferences(raw, {
    railCollapsedRaw: safeGet(storage, railCollapsedStorageKey),
  });
  if (migration.status !== "migrated" || raw === null) {
    return migration.preferences;
  }

  const backupKey = plannerPreferencesBackupKey(workspaceId);
  if (
    safeGet(storage, backupKey) === null &&
    !safeSet(storage, backupKey, raw)
  ) {
    return migration.preferences;
  }
  safeSet(storage, key, JSON.stringify(migration.preferences));
  return migration.preferences;
}

function browserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizePreferences(value: Phase4Preferences): Phase4Preferences {
  return migratePhase4Preferences(JSON.stringify(value)).preferences;
}

export function usePlannerPreferences(workspaceId: string) {
  const [preferences, setPreferencesState] = useState<Phase4Preferences>(() =>
    readPlannerPreferences(browserStorage(), workspaceId)
  );

  useEffect(() => {
    const storage = browserStorage();
    setPreferencesState(
      storage
        ? migrateStoredPlannerPreferences(storage, workspaceId)
        : structuredClone(phase4DefaultPreferences)
    );
  }, [workspaceId]);

  const setPreferences = useCallback(
    (
      update:
        | Phase4Preferences
        | ((current: Phase4Preferences) => Phase4Preferences)
    ) => {
      setPreferencesState(current => {
        const next = normalizePreferences(
          typeof update === "function" ? update(current) : update
        );
        const storage = browserStorage();
        if (storage) {
          safeSet(
            storage,
            plannerPreferencesStorageKey(workspaceId),
            JSON.stringify(next)
          );
          safeSet(storage, railCollapsedStorageKey, String(next.railCollapsed));
        }
        return next;
      });
    },
    [workspaceId]
  );

  return { preferences, setPreferences } as const;
}
