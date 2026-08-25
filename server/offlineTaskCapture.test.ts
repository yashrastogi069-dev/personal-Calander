import { describe, expect, it } from "vitest";
import {
  capturesForWorkspace,
  createOfflineTaskCapture,
  isRetryableCaptureError,
  queueOfflineTaskCapture,
  readOfflineTaskCaptures,
  removeOfflineTaskCapture,
} from "@/lib/offlineTaskCapture";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

describe("offline task capture queue", () => {
  it("keeps one replayable capture per client id and scopes it to its workspace", () => {
    const storage = memoryStorage();
    const capture = createOfflineTaskCapture({ workspaceId: "workspace-a", timezone: "Pacific/Auckland", title: "Plan weekly review", scheduledLocalDate: "2026-08-25" }, "capture-000001", "2026-08-25T00:00:00.000Z");
    const second = createOfflineTaskCapture({ workspaceId: "workspace-b", timezone: "UTC", title: "Clear desk", scheduledLocalDate: "2026-08-25" }, "capture-000002", "2026-08-25T00:01:00.000Z");

    expect(queueOfflineTaskCapture(capture, storage)).toBe(true);
    expect(queueOfflineTaskCapture(capture, storage)).toBe(true);
    expect(queueOfflineTaskCapture(second, storage)).toBe(true);
    expect(capturesForWorkspace("workspace-a", storage)).toEqual([capture]);
    expect(readOfflineTaskCaptures(storage)).toHaveLength(2);
    removeOfflineTaskCapture(capture.id, storage);
    expect(readOfflineTaskCaptures(storage)).toEqual([second]);
  });

  it("fails closed for corrupt local data and retries only connection-like failures", () => {
    const storage = memoryStorage({ "personal-calander:offline-task-captures:v1": "not-json" });
    expect(readOfflineTaskCaptures(storage)).toEqual([]);
    expect(isRetryableCaptureError(new Error("Failed to fetch"))).toBe(true);
    expect(isRetryableCaptureError(new Error("A task title is required"))).toBe(false);
  });
});
