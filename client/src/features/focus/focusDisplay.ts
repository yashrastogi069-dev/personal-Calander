// Pure display helpers for the D2.5 Focus instrument. Everything here is derived from saved
// session fields (activeSeconds, lastResumedAt, pausedAt, targetMinutes); nothing is invented.

export const FOCUS_OFFLINE_GUIDANCE =
  "Focus sessions need a connection to save changes. Reconnect to start, pause, resume, or finish this session.";

export function runFocusMutation(isOnline: boolean, mutate: () => void, onBlocked?: () => void) {
  if (!isOnline) {
    onBlocked?.();
    return false;
  }
  mutate();
  return true;
}

type FinishedSession = { id: string; version: number; endedAt?: string | Date | null; startedAt?: string | Date | null };

/** The newer of two finished sessions; a late save for an older session never replaces a newer finish. */
export function newestFinishedSession<T extends FinishedSession>(current: T | null | undefined, incoming: T | null | undefined): T | null {
  if (!current) return incoming ?? null;
  if (!incoming) return current;
  if (current.id === incoming.id) return incoming.version >= current.version ? incoming : current;
  const currentEnd = new Date(current.endedAt ?? current.startedAt ?? 0).getTime();
  const incomingEnd = new Date(incoming.endedAt ?? incoming.startedAt ?? 0).getTime();
  return incomingEnd > currentEnd ? incoming : current;
}

export const FOCUS_LENGTH_PRESETS = [25, 50, 90] as const;
export const FOCUS_MIN_TARGET = 5;
export const FOCUS_MAX_TARGET = 240;
/** The Dashboard card and Focus screen offer the next step for this long after a session ends. */
export const FOCUS_RECENT_WINDOW_MS = 10 * 60_000;

const pad = (value: number) => String(value).padStart(2, "0");

/** Instrument digits: MM:SS under an hour, H:MM:SS from one hour (seconds are never dropped). */
export function formatFocusClock(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${pad(minutes)}:${pad(rest)}`;
}

/** Compact minutes for sub lines: "25m", "1h 30m". */
export function formatFocusMinutes(minutes: number): string {
  const whole = Math.max(0, Math.round(minutes));
  if (whole < 60) return `${whole}m`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export function clampFocusTarget(minutes: number): number {
  if (!Number.isFinite(minutes)) return 25;
  return Math.min(FOCUS_MAX_TARGET, Math.max(FOCUS_MIN_TARGET, Math.round(minutes)));
}

export function isValidFocusTarget(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= FOCUS_MIN_TARGET && minutes <= FOCUS_MAX_TARGET;
}

export type FocusDialGeometry = {
  /** Main arc, 0..1 of the target. */
  arc: number;
  /** Overtime lap, 0..1 of another target length; 0 before the target. */
  lap: number;
  /** True once elapsed reaches the target. */
  over: boolean;
  /** Lit ticks out of `ticks`. */
  lit: number;
};

export function focusDialGeometry(elapsedSeconds: number, targetMinutes: number, ticks = 60): FocusDialGeometry {
  const target = Math.max(0, targetMinutes) * 60;
  const elapsed = Math.max(0, elapsedSeconds);
  if (target <= 0) return { arc: 0, lap: 0, over: false, lit: 0 };
  const arc = Math.min(1, elapsed / target);
  const over = elapsed >= target;
  const lap = over ? Math.min(1, (elapsed - target) / target) : 0;
  return { arc, lap, over, lit: Math.min(ticks, Math.floor(arc * ticks + 1e-9)) };
}

/** "+6m" after the target; never shown as a warning colour. */
export function focusOvertimeLabel(elapsedSeconds: number, targetMinutes: number): string | null {
  const over = elapsedSeconds - Math.max(0, targetMinutes) * 60;
  if (targetMinutes <= 0 || over < 0) return null;
  return `+${formatFocusMinutes(Math.max(1, Math.ceil(over / 60)))}`;
}

const minutesWord = (count: number) => `${count} ${count === 1 ? "minute" : "minutes"}`;

/** Minute-level text for role="timer": "14 minutes of 25, Draft Q4 report". Changes once a minute. */
export function focusTimerSentence(elapsedSeconds: number, targetMinutes: number, title: string): string {
  const minutes = Math.floor(Math.max(0, elapsedSeconds) / 60);
  return `${minutesWord(minutes)} of ${targetMinutes}, ${title}`;
}

function timeFormatter(timeZone?: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  }
}

export function formatClockTime(at: Date | number | string, timeZone?: string): string {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) return "";
  return timeFormatter(timeZone).format(date);
}

/** "ends ~12:11": only while running and still before the target. */
export function focusEndsAround(nowMs: number, elapsedSeconds: number, targetMinutes: number, running: boolean, timeZone?: string): string | null {
  const remaining = targetMinutes * 60 - elapsedSeconds;
  if (!running || targetMinutes <= 0 || remaining <= 0) return null;
  return `ends ~${formatClockTime(nowMs + remaining * 1000, timeZone)}`;
}

export function focusPausedLabel(pausedAt: Date | string | null | undefined, timeZone?: string): string {
  const time = pausedAt ? formatClockTime(pausedAt, timeZone) : "";
  return time ? `Paused at ${time}` : "Paused";
}

/**
 * Where the next meeting starts on the face (0..1 of the target), only when it starts before the
 * target is reached and after the current position.
 */
export function focusMeetingNotch(meetingStartMs: number | null | undefined, nowMs: number, elapsedSeconds: number, targetMinutes: number): number | null {
  if (meetingStartMs == null || !Number.isFinite(meetingStartMs) || targetMinutes <= 0) return null;
  const startsIn = (meetingStartMs - nowMs) / 1000;
  if (startsIn <= 0) return null;
  const position = (elapsedSeconds + startsIn) / (targetMinutes * 60);
  return position > 0 && position < 1 ? position : null;
}

export type FocusAnnouncerState = { id: string; state: "active" | "paused"; elapsedSeconds: number; targetMinutes: number } | null;

/**
 * The one polite live region speaks only on these events (never seconds). `previous` is the
 * state at the last check; returns null when nothing worth announcing changed.
 */
export function focusAnnouncement(previous: FocusAnnouncerState, next: FocusAnnouncerState): string | null {
  if (!next) {
    if (!previous) return null;
    const minutes = Math.floor(previous.elapsedSeconds / 60);
    return `Session saved, ${minutesWord(minutes)}.`;
  }
  if (!previous || previous.id !== next.id) return `Focus started, ${next.targetMinutes} minute target.`;
  if (previous.state === "active" && next.state === "paused") return `Paused at ${minutesWord(Math.floor(next.elapsedSeconds / 60))}.`;
  if (previous.state === "paused" && next.state === "active") return "Resumed.";
  const target = next.targetMinutes * 60;
  if (target > 0 && previous.elapsedSeconds < target && next.elapsedSeconds >= target) return "Target reached.";
  const warning = target - 5 * 60;
  if (next.targetMinutes > 5 && previous.elapsedSeconds < warning && next.elapsedSeconds >= warning) return "5 minutes to target.";
  return null;
}

type MaybeTask = { id: string; scheduledLocalDate?: string | null; dueLocalDate?: string | null };

/** Today's commitments first in the task picker: planned or due today. */
export function isTodaysCommitment(task: MaybeTask, today: string): boolean {
  return task.scheduledLocalDate === today || task.dueLocalDate === today;
}

export function groupFocusTasks<T extends MaybeTask>(tasks: readonly T[], today: string): { today: T[]; other: T[] } {
  const todayTasks: T[] = [];
  const other: T[] = [];
  for (const task of tasks) (isTodaysCommitment(task, today) ? todayTasks : other).push(task);
  return { today: todayTasks, other };
}

type EndedSession = { id: string; state?: string | null; endedAt?: Date | string | null; nextStepAction?: string | null };

/** The just-finished session the Dashboard and Focus screen offer a next step for, if any. */
export function recentFocusHandoff<T extends EndedSession>(sessions: readonly T[], nowMs: number): T | null {
  let best: T | null = null;
  let bestEnd = -Infinity;
  for (const session of sessions) {
    if (session.state !== "completed" && session.state !== "abandoned") continue;
    const ended = new Date(session.endedAt ?? Number.NaN).getTime();
    if (Number.isFinite(ended) && ended > bestEnd) { best = session; bestEnd = ended; }
  }
  if (!best || best.nextStepAction) return null;
  return nowMs - bestEnd <= FOCUS_RECENT_WINDOW_MS && nowMs - bestEnd >= -60_000 ? best : null;
}
