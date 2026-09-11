export type PwaDisplayMode = "browser" | "standalone";
export type PwaInstallExperience = "none" | "ios-guidance" | "native-prompt";
export type PwaUpdateState = "idle" | "checking" | "ready" | "activating" | "error";
export type PwaConnectivity = "online" | "checking" | "offline" | "reconnected";

export type PwaState = {
  support: "supported" | "unsupported";
  display: PwaDisplayMode;
  update: PwaUpdateState;
  connectivity: PwaConnectivity;
  install: "unavailable" | "available" | "dismissed";
  installExperience: PwaInstallExperience;
  message: string | null;
};

export type PwaActions = {
  install(): Promise<void>;
  dismissInstall(): void;
  retryConnection(): Promise<void>;
  activateUpdate(): Promise<void>;
};

export const PWA_ACTIVATE_MESSAGE = Object.freeze({
  type: "personal-calendar:activate-update",
});
export const PWA_INSTALL_DISMISSED_KEY = "personal-calander:pwa-install-dismissed:v1";
export const PWA_RELOAD_KEY = "personal-calander:pwa-reload:v1";
const OFFLINE_CAPTURE_KEY = "personal-calander:offline-task-captures:v1";

type ReadableStorage = Pick<Storage, "getItem">;
type ReloadStorage = Pick<Storage, "getItem" | "setItem">;

export function detectDisplayMode(input: {
  standaloneMedia: boolean;
  navigatorStandalone?: boolean;
}): PwaDisplayMode {
  return input.standaloneMedia || input.navigatorStandalone ? "standalone" : "browser";
}

export function installExperience(input: {
  display: PwaDisplayMode;
  isIos: boolean;
  hasNativePrompt: boolean;
  dismissed: boolean;
}): PwaInstallExperience {
  if (input.display === "standalone" || input.dismissed) return "none";
  if (input.hasNativePrompt) return "native-prompt";
  return input.isIos ? "ios-guidance" : "none";
}

export function hasDurablePendingWork(storage: ReadableStorage | null): boolean {
  if (!storage) return false;
  try {
    const captures = JSON.parse(storage.getItem(OFFLINE_CAPTURE_KEY) ?? "[]") as unknown;
    return Array.isArray(captures) && captures.length > 0;
  } catch {
    return false;
  }
}

export function waitingUpdateState(
  registration: Pick<ServiceWorkerRegistration, "waiting"> | null,
): "idle" | "ready" {
  return registration?.waiting ? "ready" : "idle";
}

export type ConnectivityEvent =
  | "browser-online"
  | "browser-offline"
  | "health-success"
  | "health-failure"
  | "settled";

export function nextConnectivity(
  current: PwaConnectivity,
  event: ConnectivityEvent,
): PwaConnectivity {
  if (event === "browser-offline" || event === "health-failure") return "offline";
  if (event === "browser-online") return "checking";
  if (event === "settled") return "online";
  if (event === "health-success") return current === "offline" || current === "checking" ? "reconnected" : "online";
  return current;
}

export function consumeControllerReload(storage: ReloadStorage | null): boolean {
  if (!storage) return true;
  if (storage.getItem(PWA_RELOAD_KEY) === "reloading") return false;
  storage.setItem(PWA_RELOAD_KEY, "reloading");
  return true;
}

export function isIosUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}
