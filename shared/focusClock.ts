export type ConfirmedFocusSession = {
  activeSeconds: number;
  state: string;
  lastResumedAt: Date | string | null;
};

/** Derive the displayed duration from confirmed session fields without mutating them. */
export function confirmedActiveSeconds(session: ConfirmedFocusSession, now: Date | number): number {
  const savedSeconds = Number.isFinite(session.activeSeconds)
    ? Math.max(0, Math.floor(session.activeSeconds))
    : 0;
  if (session.state !== "active" || session.lastResumedAt === null) return savedSeconds;

  const resumedAt = new Date(session.lastResumedAt).getTime();
  const currentTime = now instanceof Date ? now.getTime() : now;
  if (!Number.isFinite(resumedAt) || !Number.isFinite(currentTime)) return savedSeconds;

  return savedSeconds + Math.max(0, Math.floor((currentTime - resumedAt) / 1_000));
}

export function formatElapsedDuration(seconds: number): string {
  const elapsedSeconds = Math.max(0, Math.floor(seconds));
  if (elapsedSeconds < 60 * 60) {
    const minutes = Math.floor(elapsedSeconds / 60);
    const remaining = elapsedSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
  }

  const totalMinutes = Math.floor(elapsedSeconds / 60);
  const minutes = totalMinutes % 60;
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const days = Math.floor(totalHours / 24);
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${totalHours}h ${minutes}m`;
}

function formatOverrunDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.ceil(Math.max(0, seconds) / 60));
  if (totalMinutes < 60) return `${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return days > 0 ? `${days}d ${hours}h ${minutes}m` : `${totalHours}h ${minutes}m`;
}

export function formatFocusTargetGuidance(elapsedSeconds: number, targetSeconds: number): string {
  if (targetSeconds <= 0) return "";
  if (elapsedSeconds < targetSeconds) {
    const remainingMinutes = Math.ceil((targetSeconds - elapsedSeconds) / 60);
    return `${remainingMinutes} ${remainingMinutes === 1 ? "minute" : "minutes"} to target`;
  }
  if (elapsedSeconds === targetSeconds) return "Target reached";
  return `Target reached · ${formatOverrunDuration(elapsedSeconds - targetSeconds)} over`;
}
