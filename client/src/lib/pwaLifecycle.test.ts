import { describe, expect, it } from "vitest";
import {
  PWA_ACTIVATE_MESSAGE,
  consumeControllerReload,
  detectDisplayMode,
  hasDurablePendingWork,
  installExperience,
  nextConnectivity,
  waitingUpdateState,
} from "./pwaLifecycle";

function memoryStorage(seed: Record<string, string> = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("PWA lifecycle policy", () => {
  it("detects standalone mode from either standard or iPhone signals", () => {
    expect(detectDisplayMode({ standaloneMedia: true, navigatorStandalone: false })).toBe("standalone");
    expect(detectDisplayMode({ standaloneMedia: false, navigatorStandalone: true })).toBe("standalone");
    expect(detectDisplayMode({ standaloneMedia: false, navigatorStandalone: false })).toBe("browser");
  });

  it("chooses one install experience without promoting inside the installed app", () => {
    expect(installExperience({ display: "standalone", isIos: true, hasNativePrompt: false, dismissed: false })).toBe("none");
    expect(installExperience({ display: "browser", isIos: true, hasNativePrompt: false, dismissed: false })).toBe("ios-guidance");
    expect(installExperience({ display: "browser", isIos: false, hasNativePrompt: true, dismissed: false })).toBe("native-prompt");
    expect(installExperience({ display: "browser", isIos: false, hasNativePrompt: true, dismissed: true })).toBe("none");
  });

  it("protects queued quick captures before activating an update", () => {
    const empty = memoryStorage({ "personal-calander:offline-task-captures:v1": "[]" });
    const pending = memoryStorage({
      "personal-calander:offline-task-captures:v1": JSON.stringify([{ id: "queued-1" }]),
    });
    expect(hasDurablePendingWork(empty)).toBe(false);
    expect(hasDurablePendingWork(pending)).toBe(true);
  });

  it("uses a single allowlisted activation message", () => {
    expect(PWA_ACTIVATE_MESSAGE).toEqual({ type: "personal-calendar:activate-update" });
    expect(waitingUpdateState({ waiting: {} })).toBe("ready");
    expect(waitingUpdateState({ waiting: null })).toBe("idle");
  });

  it("moves through checking before confirming a reconnection", () => {
    expect(nextConnectivity("offline", "browser-online")).toBe("checking");
    expect(nextConnectivity("checking", "health-success")).toBe("reconnected");
    expect(nextConnectivity("online", "health-success")).toBe("online");
    expect(nextConnectivity("checking", "health-failure")).toBe("offline");
    expect(nextConnectivity("reconnected", "settled")).toBe("online");
    expect(nextConnectivity("online", "browser-offline")).toBe("offline");
  });

  it("allows one controller-change reload and resets on the next page", () => {
    const storage = memoryStorage();
    expect(consumeControllerReload(storage)).toBe(true);
    expect(consumeControllerReload(storage)).toBe(false);
    storage.removeItem("personal-calander:pwa-reload:v1");
    expect(consumeControllerReload(storage)).toBe(true);
  });
});
