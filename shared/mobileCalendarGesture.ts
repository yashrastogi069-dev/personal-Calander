export type MobileCalendarGesture = -1 | 1 | null;

export function resolveMobileCalendarGesture(input: {
  pointerType: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  threshold?: number;
}): MobileCalendarGesture {
  if (input.pointerType !== "touch") return null;
  const horizontal = input.endX - input.startX;
  const vertical = input.endY - input.startY;
  const threshold = input.threshold ?? 72;
  if (Math.abs(horizontal) < threshold || Math.abs(horizontal) < Math.abs(vertical) * 1.35) return null;
  return horizontal < 0 ? 1 : -1;
}
