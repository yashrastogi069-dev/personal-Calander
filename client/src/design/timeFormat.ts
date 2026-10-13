// Duration labels shared by premium time chips.

export function formatMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}m`;
  if (rest === 0) return `${hours}h`;
  return `${hours}h ${rest}m`;
}

export type TimeChipState = "planned" | "tracked" | "on-estimate" | "over-estimate";

/** Over-estimate once actual exceeds planned by more than 20%. */
export function timeChipState(plannedMinutes: number | null | undefined, actualMinutes: number | null | undefined): TimeChipState | null {
  const planned = plannedMinutes != null && plannedMinutes > 0 ? plannedMinutes : null;
  const actual = actualMinutes != null && actualMinutes > 0 ? actualMinutes : null;
  if (planned == null && actual == null) return null;
  if (actual == null) return "planned";
  if (planned == null) return "tracked";
  return actual > planned * 1.2 ? "over-estimate" : "on-estimate";
}
