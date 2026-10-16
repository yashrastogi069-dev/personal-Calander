// Tasks T2a: Inbox triage decisions (owner decisions Q1/Q2). Each decision is one task patch that takes the
// task out of the Inbox (a day, a project or Someday), plus the patch that undoes it. Pure, so it is tested
// without a DOM.
//
// "This week" has no storage yet: the week flag (`tasks.plannedWeekStartLocalDate`) needs a gated migration
// (DECISIONS 2026-10-16). Until the owner approves it, This week opens a day picker limited to the current week.
// "Delete" archives: there is no task delete endpoint, and an archived task stays restorable in Archive.

import type { CanonicalTask } from "@shared/canonicalTask";
import { dayMonthLabel, localDateForInstant, weekdayLabel } from "@shared/taskDateLabels";
import { shiftLocalDate } from "@shared/taskRecurrence";
import { localWeekStart, type WeekStartsOn } from "@shared/taskWeekBoard";

export type InboxDecision =
  | { kind: "today" }
  | { kind: "date"; localDate: string }
  | { kind: "project"; projectId: string; label: string }
  | { kind: "someday" }
  | { kind: "delete" };

export type InboxPicker = "week" | "date" | "project";

/** The task patch for one decision. */
export function inboxDecisionPatch(decision: InboxDecision, today: string): Record<string, unknown> {
  if (decision.kind === "today") return { scheduledLocalDate: today };
  if (decision.kind === "date") return { scheduledLocalDate: decision.localDate };
  if (decision.kind === "project") return { projectId: decision.projectId };
  if (decision.kind === "someday") return { horizon: "someday" };
  return { state: "archived" };
}

/** The patch that puts the task back in the Inbox, from the task as it was before the decision. */
export function inboxDecisionUndoPatch(decision: InboxDecision, before: Pick<CanonicalTask, "state" | "horizon" | "scheduledLocalDate" | "projectId">): Record<string, unknown> {
  if (decision.kind === "today" || decision.kind === "date") return { scheduledLocalDate: before.scheduledLocalDate ?? null };
  if (decision.kind === "project") return { projectId: before.projectId ?? null };
  if (decision.kind === "someday") return { horizon: before.horizon && before.horizon !== "someday" ? before.horizon : "weekly" };
  return { state: before.state };
}

/** Toast copy for a saved decision ("Planned for Fri", "Moved to Portfolio push"). */
export function inboxDecisionMessage(decision: InboxDecision, today: string) {
  if (decision.kind === "today") return "Planned for today";
  if (decision.kind === "date") return decision.localDate === today ? "Planned for today" : `Planned for ${inboxDayLabel(decision.localDate, today)}`;
  if (decision.kind === "project") return `Moved to ${decision.label}`;
  if (decision.kind === "someday") return "Moved to Someday";
  return "Deleted. It stays restorable in Archive.";
}

/** "Today", "Tomorrow", "Fri" within a week, else "16 Oct". */
export function inboxDayLabel(localDate: string, today: string) {
  if (localDate === today) return "Today";
  if (localDate === shiftLocalDate(today, 1)) return "Tomorrow";
  return localDate > today && localDate <= shiftLocalDate(today, 6) ? weekdayLabel(localDate) : dayMonthLabel(localDate);
}

/** The "This week" picker: today through the last day of the current week. Past days are not offered. */
export function inboxWeekDays(today: string, weekStartsOn: WeekStartsOn = 1) {
  const weekEnd = shiftLocalDate(localWeekStart(today, weekStartsOn), 6);
  const days: string[] = [];
  for (let day = today; day <= weekEnd; day = shiftLocalDate(day, 1)) days.push(day);
  return days;
}

/** The "Pick date" quick chips: tomorrow, the next three days and a week out, as the prototype offers. */
export function inboxPickDays(today: string) {
  return [1, 2, 3, 4, 7].map(offset => shiftLocalDate(today, offset));
}

/** "Captured today", "Captured yesterday" or "Captured 12 Oct", from the record's createdAt. */
export function inboxCapturedLabel(createdAt: Date | string | null | undefined, today: string, timezone: string) {
  if (!createdAt) return null;
  const day = localDateForInstant(createdAt, timezone);
  if (!day) return null;
  if (day === today) return "Captured today";
  if (day === shiftLocalDate(today, -1)) return "Captured yesterday";
  return `Captured ${dayMonthLabel(day)}`;
}

/** Keyboard shortcuts on a focused triage card (prototype: T W D P S ⌫). */
export function inboxShortcut(key: string): { decision: "today" | "someday" | "delete" } | { picker: InboxPicker } | null {
  const lower = key.toLowerCase();
  if (lower === "t") return { decision: "today" };
  if (lower === "s") return { decision: "someday" };
  if (key === "Backspace" || key === "Delete") return { decision: "delete" };
  if (lower === "w") return { picker: "week" };
  if (lower === "d") return { picker: "date" };
  if (lower === "p") return { picker: "project" };
  return null;
}
