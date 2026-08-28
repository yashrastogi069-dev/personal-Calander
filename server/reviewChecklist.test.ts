import { describe, expect, it } from "vitest";
import { canPersistWeeklyReviewChecklist, emptyWeeklyReviewChecklist, normaliseWeeklyReviewChecklist, reviewChecklistFromSnapshot, weeklyReviewChecklistProgress } from "../shared/reviewChecklist";

describe("weekly review checklist contract", () => {
  it("normalises unknown or incomplete persisted snapshot values to a safe complete checklist", () => {
    expect(normaliseWeeklyReviewChecklist({ "clear-captures": true, "creative-next": "yes", extra: true })).toEqual({
      "clear-captures": true,
      "clear-waiting": false,
      "current-work": false,
      "current-horizons": false,
      "creative-next": false,
    });
    expect(reviewChecklistFromSnapshot({ weeklyChecklist: { "current-work": true } })["current-work"]).toBe(true);
  });

  it("keeps the checklist bounded and exposes factual progress", () => {
    const checklist = emptyWeeklyReviewChecklist();
    checklist["creative-next"] = true;
    expect(canPersistWeeklyReviewChecklist(checklist)).toBe(true);
    expect(canPersistWeeklyReviewChecklist({ "creative-next": true, invented: false })).toBe(false);
    expect(weeklyReviewChecklistProgress(checklist)).toEqual({ completed: 1, total: 5, percentage: 20 });
  });
});
