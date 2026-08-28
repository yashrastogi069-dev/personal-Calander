export const weeklyReviewChecklistItems = [
  { id: "clear-captures", stage: "Get clear", label: "Process loose captures", detail: "Decide what belongs in the system before planning more work." },
  { id: "clear-waiting", stage: "Get clear", label: "Name unresolved or waiting work", detail: "Make blockers visible instead of carrying them silently." },
  { id: "current-work", stage: "Get current", label: "Review task lanes and deadlines", detail: "Confirm what moved, stalled, or now needs a different date." },
  { id: "current-horizons", stage: "Get current", label: "Review goals and projects", detail: "Check that the next actions still support the outcomes that matter." },
  { id: "creative-next", stage: "Set direction", label: "Choose one next-week move", detail: "Name one deliberate move before leaving the review." },
] as const;

export type WeeklyReviewChecklistItemId = (typeof weeklyReviewChecklistItems)[number]["id"];
export type WeeklyReviewChecklist = Record<WeeklyReviewChecklistItemId, boolean>;

const ids = new Set<WeeklyReviewChecklistItemId>(weeklyReviewChecklistItems.map(item => item.id));

export function emptyWeeklyReviewChecklist(): WeeklyReviewChecklist {
  return Object.fromEntries(weeklyReviewChecklistItems.map(item => [item.id, false])) as WeeklyReviewChecklist;
}

export function normaliseWeeklyReviewChecklist(input: unknown): WeeklyReviewChecklist {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  return Object.fromEntries(weeklyReviewChecklistItems.map(item => [item.id, source[item.id] === true])) as WeeklyReviewChecklist;
}

export function reviewChecklistFromSnapshot(snapshot: unknown): WeeklyReviewChecklist {
  const source = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot as Record<string, unknown> : {};
  return normaliseWeeklyReviewChecklist(source.weeklyChecklist);
}

export function canPersistWeeklyReviewChecklist(input: Record<string, unknown>) {
  return Object.keys(input).every(key => ids.has(key as WeeklyReviewChecklistItemId)) && Object.values(input).every(value => typeof value === "boolean");
}

export function weeklyReviewChecklistProgress(checklist: WeeklyReviewChecklist) {
  const completed = weeklyReviewChecklistItems.filter(item => checklist[item.id]).length;
  return { completed, total: weeklyReviewChecklistItems.length, percentage: Math.round((completed / weeklyReviewChecklistItems.length) * 100) };
}
