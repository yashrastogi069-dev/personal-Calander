export type ProposalTask = {
  state: string;
  estimateMinutes: number | null;
  scheduleMode: "manual" | "flexible" | "pinned";
  dueLocalDate: string | null;
};

export function schedulingEligibility(task: ProposalTask, isUnavailable: boolean) {
  if (task.state === "completed" || task.state === "archived") return "Only active unfinished work can be scheduled.";
  if (task.scheduleMode === "pinned") return "This task is pinned. Change it to flexible before requesting a different reservation.";
  if (!task.estimateMinutes || task.estimateMinutes < 5) return "Add Focus time needed (at least 5 minutes) before requesting a time proposal.";
  if (isUnavailable) return "This date is marked unavailable. Restore availability or choose another day.";
  return null;
}

export function proposalExplanation(task: ProposalTask, localDate: string, startLabel: string, endLabel: string) {
  const deadline = task.dueLocalDate ? ` Deadline: ${task.dueLocalDate}.` : " No deadline is set.";
  return `First open ${task.estimateMinutes}-minute window on ${localDate}: ${startLabel}–${endLabel}.${deadline} This is a proposal only; approval reserves the time.`;
}
