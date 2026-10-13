// Focus session types and clock hooks. The visual instrument lives in FocusDial.tsx (D2.5); this
// module keeps the shared session shape, the display preference and the elapsed-time clock.
import { confirmedActiveSeconds } from "@shared/focusClock";
import { useEffect, useState } from "react";

export type FocusWatchSession = {
  id: string;
  state: "active" | "paused";
  activeSeconds: number;
  lastResumedAt: Date | string | null;
  targetMinutes: number;
  version: number;
  taskId?: string | null;
  pausedAt?: Date | string | null;
  startedAt?: Date | string | null;
};

export type FocusPresentation = "dial" | "digital";

const PRESENTATION_KEY = "personal-calendar-focus-presentation-v1";

function savedPresentation(): FocusPresentation {
  if (typeof window === "undefined") return "dial";
  try {
    return window.localStorage.getItem(PRESENTATION_KEY) === "digital" ? "digital" : "dial";
  } catch {
    return "dial";
  }
}

export function useFocusPresentation() {
  const [presentation, setPresentation] = useState<FocusPresentation>(savedPresentation);
  const choosePresentation = (next: FocusPresentation) => {
    setPresentation(next);
    try { window.localStorage.setItem(PRESENTATION_KEY, next); } catch { /* The control still works when storage is unavailable. */ }
  };
  useEffect(() => {
    const update = (event: StorageEvent) => {
      if (event.key === PRESENTATION_KEY) setPresentation(savedPresentation());
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  return { presentation, choosePresentation };
}

/** Confirmed elapsed seconds, refreshed every second while the session runs (0 without a session). */
export function useFocusElapsedSeconds(session: FocusWatchSession | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const running = session?.state === "active";
  useEffect(() => {
    setNow(Date.now());
    if (!running) return;
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 1_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [session?.id, running, session?.version]);
  return session ? confirmedActiveSeconds(session, now) : 0;
}

/** Wall clock for "ends ~12:11", refreshed with the session clock. */
export function useNow(intervalMs: number, enabled = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs, enabled]);
  return now;
}
