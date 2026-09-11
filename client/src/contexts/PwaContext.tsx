import {
  PWA_ACTIVATE_MESSAGE,
  PWA_INSTALL_DISMISSED_KEY,
  PWA_RELOAD_KEY,
  consumeControllerReload,
  detectDisplayMode,
  hasDurablePendingWork,
  installExperience,
  isIosUserAgent,
  type PwaActions,
  type PwaConnectivity,
  type PwaState,
} from "@/lib/pwaLifecycle";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type InstallPromptEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaContextValue = { state: PwaState; actions: PwaActions };

const PwaContext = createContext<PwaContextValue | null>(null);

function safeStorage(kind: "localStorage" | "sessionStorage") {
  try { return window[kind]; } catch { return null; }
}

function initialDisplay() {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return detectDisplayMode({
    standaloneMedia: window.matchMedia?.("(display-mode: standalone)").matches ?? false,
    navigatorStandalone: navigatorWithStandalone.standalone === true,
  });
}

export function PwaProvider({ children }: { children: ReactNode }) {
  const supported = "serviceWorker" in navigator;
  const display = initialDisplay();
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const installPromptRef = useRef<InstallPromptEvent | null>(null);
  const healthCheckRef = useRef<Promise<void> | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const initialConnectivity: PwaConnectivity = navigator.onLine === false ? "offline" : "checking";
  const connectivityRef = useRef<PwaConnectivity>(initialConnectivity);
  const [connectivity, setConnectivity] = useState<PwaConnectivity>(initialConnectivity);
  const [update, setUpdate] = useState<PwaState["update"]>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [hasNativePrompt, setHasNativePrompt] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(
    () => safeStorage("localStorage")?.getItem(PWA_INSTALL_DISMISSED_KEY) === "true",
  );

  const settleReconnected = useCallback(() => {
    if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = window.setTimeout(() => {
      if (connectivityRef.current !== "reconnected") return;
      connectivityRef.current = "online";
      setConnectivity("online");
    }, 2500);
  }, []);

  const retryConnection = useCallback(async () => {
    if (healthCheckRef.current) return healthCheckRef.current;
    const wasOffline = connectivityRef.current === "offline";
    connectivityRef.current = "checking";
    setConnectivity("checking");
    const check = (async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch("/api/health", {
          cache: "no-store",
          credentials: "include",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Health check returned ${response.status}`);
        connectivityRef.current = wasOffline ? "reconnected" : "online";
        setConnectivity(connectivityRef.current);
        setMessage(null);
        if (wasOffline) settleReconnected();
      } catch {
        connectivityRef.current = "offline";
        setConnectivity("offline");
        setMessage("The planner cannot reach its secure service yet.");
      } finally {
        window.clearTimeout(timer);
        healthCheckRef.current = null;
      }
    })();
    healthCheckRef.current = check;
    return check;
  }, [settleReconnected]);

  const install = useCallback(async () => {
    const prompt = installPromptRef.current;
    if (!prompt) return;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    installPromptRef.current = null;
    setHasNativePrompt(false);
    if (choice.outcome === "dismissed") {
      safeStorage("localStorage")?.setItem(PWA_INSTALL_DISMISSED_KEY, "true");
      setInstallDismissed(true);
    }
  }, []);

  const dismissInstall = useCallback(() => {
    safeStorage("localStorage")?.setItem(PWA_INSTALL_DISMISSED_KEY, "true");
    setInstallDismissed(true);
  }, []);

  const activateUpdate = useCallback(async () => {
    const waiting = registrationRef.current?.waiting;
    if (!waiting) return;
    const pendingWorkIsStored = hasDurablePendingWork(safeStorage("localStorage"));
    setUpdate("activating");
    setMessage(pendingWorkIsStored ? "Updating safely. Your queued captures will stay on this device." : "Updating Personal Calendar…");
    waiting.postMessage(PWA_ACTIVATE_MESSAGE);
  }, []);

  useEffect(() => {
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      installPromptRef.current = event as InstallPromptEvent;
      setHasNativePrompt(true);
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onInstallPrompt);
  }, []);

  useEffect(() => {
    const onOffline = () => {
      connectivityRef.current = "offline";
      setConnectivity("offline");
      setMessage("You’re offline. Quick captures can still wait safely on this device.");
    };
    const onOnline = () => { void retryConnection(); };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (navigator.onLine !== false) void retryConnection();
      void registrationRef.current?.update();
    };
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    if (navigator.onLine !== false) void retryConnection();
    return () => {
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current);
    };
  }, [retryConnection]);

  useEffect(() => {
    if (!supported) return;
    const trackRegistration = (registration: ServiceWorkerRegistration) => {
      registrationRef.current = registration;
      if (registration.waiting) setUpdate("ready");
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        setUpdate("checking");
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed" && navigator.serviceWorker.controller) setUpdate("ready");
          if (installing.state === "redundant") setUpdate("error");
        });
      });
    };
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then(registration => {
          trackRegistration(registration);
          return registration.update();
        })
        .catch(() => {
          setUpdate("error");
          setMessage("Offline installation is unavailable right now. The planner still works online.");
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    const onControllerChange = () => {
      const storage = safeStorage("sessionStorage");
      if (consumeControllerReload(storage)) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    const clearReloadGuard = window.setTimeout(() => safeStorage("sessionStorage")?.removeItem(PWA_RELOAD_KEY), 5000);
    return () => {
      window.removeEventListener("load", register);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      window.clearTimeout(clearReloadGuard);
    };
  }, [supported]);

  const experience = installExperience({
    display,
    isIos: isIosUserAgent(navigator.userAgent),
    hasNativePrompt,
    dismissed: installDismissed,
  });
  const state = useMemo<PwaState>(() => ({
    support: supported ? "supported" : "unsupported",
    display,
    update,
    connectivity,
    install: installDismissed ? "dismissed" : experience === "none" ? "unavailable" : "available",
    installExperience: experience,
    message,
  }), [connectivity, display, experience, installDismissed, message, supported, update]);
  const actions = useMemo<PwaActions>(() => ({ install, dismissInstall, retryConnection, activateUpdate }), [activateUpdate, dismissInstall, install, retryConnection]);

  return <PwaContext.Provider value={{ state, actions }}>{children}</PwaContext.Provider>;
}

export function usePwa() {
  const value = useContext(PwaContext);
  if (!value) throw new Error("usePwa must be used inside PwaProvider");
  return value;
}
