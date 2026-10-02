import { confirmedActiveSeconds, formatElapsedDuration, formatFocusTargetGuidance } from "@shared/focusClock";
import { useEffect, useState } from "react";
import "./focus-watch.css";

export type FocusWatchSession = {
  id: string;
  state: "active" | "paused";
  activeSeconds: number;
  lastResumedAt: Date | string | null;
  targetMinutes: number;
  version: number;
  taskId?: string | null;
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

export function useFocusElapsedSeconds(session: FocusWatchSession) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (session.state !== "active") return;
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 1_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [session.id, session.state, session.version]);
  return confirmedActiveSeconds(session, now);
}

export function FocusTimeDial({
  session,
  title,
  presentation,
  size = "full",
  confirmedOnline,
}: {
  session: FocusWatchSession;
  title: string;
  presentation: FocusPresentation;
  size?: "compact" | "full" | "desk";
  confirmedOnline: boolean;
}) {
  const elapsedSeconds = useFocusElapsedSeconds(session);
  const targetSeconds = Math.max(0, session.targetMinutes) * 60;
  const progress = targetSeconds > 0 ? Math.min(1, elapsedSeconds / targetSeconds) : 0;
  const targetText = formatFocusTargetGuidance(elapsedSeconds, targetSeconds);
  const timeText = formatElapsedDuration(elapsedSeconds);
  const stateText = confirmedOnline
    ? session.state === "paused" ? "Paused" : "Recording focus"
    : session.state === "paused" ? "Last confirmed paused" : "Estimated active time";
  const summary = `${title}. ${stateText}. ${timeText} elapsed. ${targetText}`;
  const circumference = 2 * Math.PI * 46;

  return (
    <div className={`focus-time-dial is-${size} is-${presentation} ${timeText.length > 8 ? "is-long-duration" : ""} ${session.state === "paused" ? "is-paused" : "is-active"}`} role="group" aria-label={summary}>
      <div className="focus-time-dial-face" aria-hidden="true">
        <svg viewBox="0 0 120 120" focusable="false">
          <circle className="focus-time-dial-track" cx="60" cy="60" r="46" />
          <circle
            className="focus-time-dial-progress"
            cx="60" cy="60" r="46"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
          />
          <circle className="focus-time-dial-core" cx="60" cy="60" r="37" />
          {Array.from({ length: 12 }, (_, index) => (
            <path key={index} className="focus-time-dial-tick" d={index % 3 === 0 ? "M60 19v7" : "M60 21v4"} transform={`rotate(${index * 30} 60 60)`} />
          ))}
          <path className="focus-time-dial-marker" d="M60 7v7" />
        </svg>
        <span className="focus-time-dial-face-label">FOCUS</span>
        <span className="focus-time-dial-face-time">{timeText}</span>
      </div>
      <div className="focus-time-dial-readout">
        <span className="focus-time-dial-eyebrow"><span className="focus-time-dial-led" aria-hidden="true" />{stateText}</span>
        <span className="focus-time-dial-plan">{session.targetMinutes} min target</span>
        <strong className="focus-time-dial-time" aria-hidden="true">{timeText}</strong>
        <span className="focus-time-dial-target">{targetText}</span>
      </div>
    </div>
  );
}
