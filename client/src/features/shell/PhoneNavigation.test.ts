import { describe, expect, it } from "vitest";
import type { PlannerLocationTarget } from "@shared/phase4Navigation";
import type { PlannerPreferenceShortcut } from "@shared/phase4Preferences";
import {
  activePhonePrimaryShortcutKey,
  groupPhoneMoreTargets,
  plannerShortcutKey,
} from "./PhoneNavigation";

describe("phone navigation", () => {
  it.each([
    [{ destination: "plan", view: "calendar" }, "plan/daily"],
    [{ destination: "intentions", view: "outcomes" }, "intentions/projects"],
    [{ destination: "review", view: "insights" }, "review/rituals"],
  ] as const)("selects the pinned parent for %o", (location, expected) => {
    const primary: PlannerPreferenceShortcut[] = [
      { destination: "plan", view: "daily" },
      { destination: "intentions", view: "projects" },
      { destination: "review", view: "rituals" },
    ];
    expect(activePhonePrimaryShortcutKey(location, primary)).toBe(expected);
  });

  it("gives an exact pinned child precedence and leaves unrelated routes in More", () => {
    const primary: PlannerPreferenceShortcut[] = [
      { destination: "plan", view: "daily" },
      { destination: "plan", view: "calendar" },
      { destination: "habits", view: "due" },
    ];
    expect(
      activePhonePrimaryShortcutKey(
        { destination: "plan", view: "calendar" },
        primary
      )
    ).toBe("plan/calendar");
    expect(
      activePhonePrimaryShortcutKey(
        { destination: "review", view: "insights" },
        primary
      )
    ).toBeNull();
  });

  it("keeps all More shortcuts once and preserves saved order inside each group", () => {
    const targets: PlannerLocationTarget[] = [
      { destination: "review", view: "rituals" },
      { destination: "settings", view: "connections" },
      { destination: "home", view: "focus" },
      { destination: "plan", view: "calendar" },
      { destination: "settings", view: "account" },
      { destination: "habits", view: "due" },
      { destination: "intentions", view: "outcomes" },
      { destination: "settings", view: "categories" },
      { destination: "review", view: "insights" },
    ];
    const grouped = groupPhoneMoreTargets(targets);

    expect(grouped.map(group => group.label)).toEqual([
      "Work",
      "Planning & review",
      "Account & settings",
    ]);
    expect(grouped.map(group => group.targets.map(plannerShortcutKey))).toEqual([
      ["home/focus", "habits/due"],
      [
        "review/rituals",
        "plan/calendar",
        "intentions/outcomes",
        "review/insights",
      ],
      ["settings/connections", "settings/account", "settings/categories"],
    ]);
    expect(grouped.flatMap(group => group.targets)).toHaveLength(targets.length);
  });
});
