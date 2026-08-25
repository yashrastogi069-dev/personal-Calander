import { describe, expect, it } from "vitest";
import {
  hasCompleteMobilePlannerNavigation,
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

  it("creates concise action labels for visible planner destinations", () => {
    expect(mobilePlannerNavLabel("Calendar")).toBe("Open Calendar");
    expect(mobilePlannerNavLabel("Weekly review")).toBe("Open Weekly review");
  });
});
