export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type OfflineTaskCapture = {
  id: string;
  workspaceId: string;
  timezone: string;
  title: string;
  scheduledLocalDate: string;
  createdAt: string;
};

const storageKey = "personal-calander:offline-task-captures:v1";

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage; } catch { return null; }
}

function captureId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `capture-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createOfflineTaskCapture(input: Omit<OfflineTaskCapture, "id" | "createdAt">, id = captureId(), createdAt = new Date().toISOString()): OfflineTaskCapture {
  return { ...input, id, createdAt };
}

export function readOfflineTaskCaptures(storage: StorageLike | null = browserStorage()): OfflineTaskCapture[] {
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(storageKey) ?? "[]") as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is OfflineTaskCapture => Boolean(
      item && typeof item === "object" && typeof (item as OfflineTaskCapture).id === "string"
        && typeof (item as OfflineTaskCapture).workspaceId === "string"
        && typeof (item as OfflineTaskCapture).timezone === "string"
        && typeof (item as OfflineTaskCapture).title === "string"
        && typeof (item as OfflineTaskCapture).scheduledLocalDate === "string"
        && typeof (item as OfflineTaskCapture).createdAt === "string",
    ));
  } catch {
    return [];
  }
}

export function writeOfflineTaskCaptures(captures: OfflineTaskCapture[], storage: StorageLike | null = browserStorage()) {
  if (!storage) return false;
  try {
    storage.setItem(storageKey, JSON.stringify(captures.slice(-30)));
    return true;
  } catch {
    return false;
  }
}

export function queueOfflineTaskCapture(capture: OfflineTaskCapture, storage: StorageLike | null = browserStorage()) {
  const captures = readOfflineTaskCaptures(storage);
  const next = captures.some(item => item.id === capture.id) ? captures : [...captures, capture];
  return writeOfflineTaskCaptures(next, storage);
}

export function removeOfflineTaskCapture(id: string, storage: StorageLike | null = browserStorage()) {
  return writeOfflineTaskCaptures(readOfflineTaskCaptures(storage).filter(capture => capture.id !== id), storage);
}

export function capturesForWorkspace(workspaceId: string, storage: StorageLike | null = browserStorage()) {
  return readOfflineTaskCaptures(storage).filter(capture => capture.workspaceId === workspaceId);
}

export function isRetryableCaptureError(error: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /network|fetch|connection|offline|request aborted|failed to fetch/i.test(message);
}
