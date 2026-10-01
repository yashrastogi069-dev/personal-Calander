export type IntentionKind = "outcome" | "direction";

export type GoalIntentionRecord = {
  id?: string;
  title: string;
  intentionKind?: IntentionKind | null;
  successCriteria?: string | null;
  standards?: string | null;
  progressMode?: "manual" | "task" | "measure" | "habit" | null;
  progressValue?: number | null;
  targetValue?: number | null;
  startLocalDate?: string | null;
  dueLocalDate?: string | null;
  reviewCadence?: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  nextReviewLocalDate?: string | null;
};

export type IntentionPresentation = {
  kind: IntentionKind | "legacy";
  label: "Outcome" | "Direction" | "Legacy goal";
  summary: string;
  showsProgress: boolean;
  showsDates: boolean;
  showsSuccessCriteria: boolean;
  details: Array<{ label: string; value: string }>;
};

export function intentionPresentation(goal: GoalIntentionRecord): IntentionPresentation {
  if (!goal.intentionKind) {
    return {
      kind: "legacy",
      label: "Legacy goal",
      summary: "Existing goal behavior is preserved.",
      showsProgress: true,
      showsDates: Boolean(goal.startLocalDate || goal.dueLocalDate),
      showsSuccessCriteria: false,
      details: [],
    };
  }
  const isOutcome = goal.intentionKind === "outcome";
  const details: Array<{ label: string; value: string }> = [];
  if (isOutcome && goal.successCriteria) details.push({ label: "Success criteria", value: goal.successCriteria });
  if (!isOutcome && goal.standards) details.push({ label: "Standards", value: goal.standards });
  if (goal.reviewCadence) details.push({ label: "Review", value: goal.nextReviewLocalDate ? `${goal.reviewCadence} · next ${goal.nextReviewLocalDate}` : goal.reviewCadence });
  return {
    kind: goal.intentionKind,
    label: isOutcome ? "Outcome" : "Direction",
    summary: isOutcome
      ? "A defined result with evidence and progress."
      : "A durable direction that guides choices without forcing a score.",
    showsProgress: isOutcome,
    showsDates: isOutcome ? Boolean(goal.startLocalDate || goal.dueLocalDate) : false,
    showsSuccessCriteria: isOutcome,
    details,
  };
}

export function previewIntentionKindChange(goal: GoalIntentionRecord, kind: IntentionKind): { from: IntentionKind | "legacy"; to: IntentionKind; consequences: string[] } {
  const from = goal.intentionKind ?? "legacy";
  if (from === kind) return { from, to: kind, consequences: ["No presentation change is needed."] };
  return {
    from,
    to: kind,
    consequences: kind === "outcome"
      ? ["Success criteria and factual progress become prominent.", "Existing dates, links, progress values, and history stay unchanged."]
      : ["Percentage and date pressure are de-emphasized.", "Existing dates, links, progress values, and history stay stored and available in details."],
  };
}
