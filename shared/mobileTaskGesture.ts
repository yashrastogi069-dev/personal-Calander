export type MobileTaskGesture = "complete" | "reveal_archive" | null;

export function resolveMobileTaskGesture(input: {
  pointerType: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  completed: boolean;
  threshold?: number;
}): MobileTaskGesture {
  if (input.pointerType !== "touch") return null;
  const horizontal = input.endX - input.startX;
  const vertical = input.endY - input.startY;
  const threshold = input.threshold ?? 72;
  if (Math.abs(horizontal) < threshold || Math.abs(horizontal) < Math.abs(vertical) * 1.35) return null;
  if (horizontal < 0 && !input.completed) return "complete";
  if (horizontal > 0) return "reveal_archive";
  return null;
}
