import { describe, expect, it } from "vitest";
import {
  hasCompletePhoneNavigationPattern,
  hasCompleteMobilePlannerNavigation,
  mobileMorePlannerDestinations,
  mobilePrimaryPlannerDestinations,
  mobilePlannerDestinations,
  mobilePlannerNavLabel,
} from "@shared/mobileNavigation";

describe("mobile planner navigation contract", () => {
  it("keeps every core planner surface present exactly once and in a stable thumb-bar order", () => {
    expect(mobilePlannerDestinations.map(destination => destination.id)).toEqual([
      "today",
      "tasks",
      "calendar",
      "goals",
      "habits",
      "review",
    ]);
    expect(hasCompleteMobilePlannerNavigation(mobilePlannerDestinations)).toBe(true);
  });

  it("uses four direct destinations and preserves the remaining planning surfaces in More", () => {
    expect(mobilePrimaryPlannerDestinations.map(destination => destination.id)).toEqual([
      "today",
      "tasks",
      "calendar",
      "goals",
    ]);
    expect(mobileMorePlannerDestinations.map(destination => destination.id)).toEqual(["habits", "review"]);
    expect(hasCompletePhoneNavigationPattern(mobilePrimaryPlannerDestinations, mobileMorePlannerDestinations)).toBe(true);
  });

  it("creates concise action labels for visible planner destinations", () => {
    expect(mobilePlannerNavLabel("Calendar")).toBe("Open Calendar");
    expect(mobilePlannerNavLabel("Weekly review")).toBe("Open Weekly review");
  });
});
