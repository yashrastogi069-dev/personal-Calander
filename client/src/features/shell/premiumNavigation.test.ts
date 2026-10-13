import { describe, expect, it } from "vitest";
import { matchPaletteTasks, paletteMode } from "./CommandPalette";
import { activeNavState, badgeText, homeTabForLocation, navBadgeCounts } from "./premiumNavigation";

describe("premium navigation model", () => {
  it("shows Home tabs on Dashboard, Today and Calendar only", () => {
    expect(homeTabForLocation({ destination: "home", view: "overview" })).toBe("dashboard");
    expect(homeTabForLocation({ destination: "home", view: "today" })).toBe("today");
    expect(homeTabForLocation({ destination: "plan", view: "calendar" })).toBe("calendar");
    expect(homeTabForLocation({ destination: "plan", view: "daily" })).toBeNull();
    expect(homeTabForLocation({ destination: "home", view: "search" })).toBeNull();
  });

  it("resolves exact and parent rail items", () => {
    expect(activeNavState({ destination: "review", view: "insights" })).toEqual({ exactId: "analytics", parentId: null });
    expect(activeNavState({ destination: "tasks", view: "board" })).toEqual({ exactId: null, parentId: "inbox" });
    expect(activeNavState({ destination: "settings", view: "connections" })).toEqual({ exactId: "connections", parentId: null });
    expect(activeNavState({ destination: "home", view: "search" })).toEqual({ exactId: null, parentId: "dashboard" });
  });

  it("counts inbox and overdue from open tasks only", () => {
    const counts = navBadgeCounts({
      today: "2026-10-13",
      tasks: [
        { state: "not_started" },
        { state: "in_progress", scheduledLocalDate: "2026-10-13", dueLocalDate: "2026-10-12" },
        { state: "completed", dueLocalDate: "2026-10-01" },
        { state: "archived" },
        { state: "not_started", plannedStartAt: "2026-10-14T09:00:00Z", dueLocalDate: "2026-10-13" },
      ],
      todayTaskCount: 3,
      dueHabitCount: null,
    });
    expect(counts).toEqual({ inbox: 1, overdue: 1, todayLeft: 3, habitsDue: undefined });
  });

  it("formats badges and hides zero counts", () => {
    expect(badgeText("todayLeft", 2)).toBe("2 left");
    expect(badgeText("overdue", 1)).toBe("1 overdue");
    expect(badgeText("habitsDue", 3)).toBe("3 due");
    expect(badgeText("inbox", 4)).toBe("4");
    expect(badgeText("inbox", 0)).toBeNull();
  });
});

describe("command palette helpers", () => {
  it("reads > and # prefixes", () => {
    expect(paletteMode("> focus")).toEqual({ mode: "actions", term: "focus" });
    expect(paletteMode("#report")).toEqual({ mode: "tasks", term: "report" });
    expect(paletteMode("  calendar ")).toEqual({ mode: "all", term: "calendar" });
  });

  it("matches open tasks by title", () => {
    const tasks = [
      { id: "1", title: "Write report", state: "not_started" },
      { id: "2", title: "Report draft", state: "completed" },
      { id: "3", title: "Gym", state: "in_progress" },
    ];
    expect(matchPaletteTasks(tasks, "report").map(task => task.id)).toEqual(["1"]);
    expect(matchPaletteTasks(tasks, "").map(task => task.id)).toEqual(["1", "3"]);
  });
});
