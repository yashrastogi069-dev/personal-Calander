import type { PlannerSyncScope } from "@/lib/offlineSync";

export type CaptureDraftSurface = "sheet" | "sheet-task" | "natural";

export function captureDraftStorageKey(scope: PlannerSyncScope, surface: CaptureDraftSurface) {
  return `personal-calander:capture-draft:v1:${encodeURIComponent(scope.accountId)}:${encodeURIComponent(scope.workspaceId)}:${surface}`;
}

export function readCaptureDraft<T>(scope: PlannerSyncScope | undefined, surface: CaptureDraftSurface): T | null {
  if (!scope || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(captureDraftStorageKey(scope, surface));
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

export function writeCaptureDraft(scope: PlannerSyncScope | undefined, surface: CaptureDraftSurface, value: unknown) {
  if (!scope || typeof window === "undefined") return;
  try { window.sessionStorage.setItem(captureDraftStorageKey(scope, surface), JSON.stringify(value)); } catch { /* Capture remains usable without device storage. */ }
}

export function clearCaptureDraft(scope: PlannerSyncScope | undefined, surface: CaptureDraftSurface) {
  if (!scope || typeof window === "undefined") return;
  try { window.sessionStorage.removeItem(captureDraftStorageKey(scope, surface)); } catch { /* Capture remains usable without device storage. */ }
}

export function clearCaptureDraftIfUnchanged(scope: PlannerSyncScope | undefined, surface: CaptureDraftSurface, submittedMarker: string, currentMarker: string) {
  if (submittedMarker !== currentMarker) return false;
  clearCaptureDraft(scope, surface);
  return true;
}

export function newCaptureRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `capture-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
