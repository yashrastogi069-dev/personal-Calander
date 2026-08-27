export type DailyPlanOutcome = "done" | "rescheduled" | "deferred" | "wont_do" | "archived";

export function taskPatchForDailyPlanOutcome(outcome: DailyPlanOutcome, now: Date, resolvedToLocalDate?: string | null) {
  if (outcome === "done") return { state: "completed" as const, completedAt: now };
  if (outcome === "rescheduled") {
    if (!resolvedToLocalDate) throw new Error("Choose the new Plan for date before rescheduling this task.");
    return { scheduledLocalDate: resolvedToLocalDate, plannedStartAt: null, plannedEndAt: null };
  }
  if (outcome === "deferred") return { scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null };
  if (outcome === "wont_do") return { state: "archived" as const, archivedAt: now, outcome: "wont_do" as const, outcomeAt: now };
  return { state: "archived" as const, archivedAt: now };
}
