export type PlannerShortcutContext = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  targetIsEditable?: boolean;
  dialogOpen?: boolean;
};

export function plannerShortcutCommand(context: PlannerShortcutContext): "new-task" | "today" | null {
  if (context.ctrlKey || context.metaKey || context.altKey || context.shiftKey || context.isComposing || context.targetIsEditable || context.dialogOpen) return null;
  if (context.key.toLowerCase() === "n") return "new-task";
  if (context.key.toLowerCase() === "t") return "today";
  return null;
}

export function nextFreeReservationMinute(input: { slotMinutes: number[]; selectedMinute: number; durationMinutes: number; workEnd: number; busy: Array<{ startMinute: number; endMinute: number }> }) {
  return input.slotMinutes.find(minute => minute >= input.selectedMinute && minute + input.durationMinutes <= input.workEnd && !input.busy.some(interval => minute < interval.endMinute && minute + input.durationMinutes > interval.startMinute)) ?? null;
}
