import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TodayProjection } from "@shared/todayProjection";
import { TodayHabits } from "./TodayHabits";
import { todayHabitActivity, todayHabitTrace } from "./todayContext";

const date = "2026-10-04";
const facts = [
  { habitId: "h1", localDate: "2026-09-07", state: "completed" },
  { habitId: "h1", localDate: "2026-10-03", state: "completed" },
  { habitId: "h2", localDate: "2026-10-03", state: "missed" },
  { habitId: "h3", localDate: "2026-10-03", state: "skipped" },
  { habitId: "h1", localDate: "2026-10-04", state: "skipped" },
  { habitId: "h1", localDate: "2026-09-06", state: "completed" },
  { habitId: "h1", localDate: "2026-10-05", state: "completed" },
  { habitId: "another-workspace-habit", localDate: "2026-10-03", state: "completed" },
];

describe("recorded habit activity", () => {
  it("counts only known habit records inside the 28 local dates ending today", () => {
    const days = todayHabitActivity(date, ["h1", "h2", "h3"], facts);
    expect(days).toHaveLength(28);
    expect(days[0]).toEqual({ localDate: "2026-09-07", completed: 1, missed: 0, skipped: 0 });
    expect(days[26]).toEqual({ localDate: "2026-10-03", completed: 1, missed: 1, skipped: 1 });
    expect(days[27]).toEqual({ localDate: "2026-10-04", completed: 0, missed: 0, skipped: 1 });
    expect(days[1]).toEqual({ localDate: "2026-09-08", completed: 0, missed: 0, skipped: 0 });
    expect(days.reduce((sum, day) => sum + day.completed + day.missed + day.skipped, 0)).toBe(5);
  });

  it("renders bounded labels and retains the individual seven-day trace", () => {
    const rows = [{ recordId: "h1", title: "Read", state: "due", cadence: "daily" }] as TodayProjection["habits"];
    const html = renderToStaticMarkup(createElement(TodayHabits, {
      rows, habits: [{ id: "h1", name: "Read" }, { id: "h2", name: "Walk" }, { id: "h3", name: "Rest" }],
      checkIns: facts, localDate: date, timezone: "Asia/Kolkata", isOnline: true, pending: false, error: null,
      onCheckIn: () => undefined, onClearCheckIn: () => undefined, onRetry: () => undefined,
      onOpenHabits: () => undefined, onUnsupportedOffline: () => undefined,
    }));
    expect((html.match(/class="today-habit-activity-day/g) ?? [])).toHaveLength(28);
    expect(html).toContain("2026-10-03: 1 completed, 1 missed, 1 skipped");
    expect(html).toContain("2026-09-08: 0 completed, 0 missed, 0 skipped; no record in loaded snapshot");
    expect(html).toContain("today-habit-activity-day is-mixed");
    expect(html).toContain("last seven days");
    expect(html).toContain("Asia/Kolkata workspace dates");
    expect(html).toContain("2 completed · 1 missed · 2 skipped");
    expect(todayHabitTrace("h1", date, facts)).toHaveLength(7);
  });

  it("keeps desktop work and habits adjacent and phone work first", () => {
    const css = readFileSync(new URL("./today-workspace.css", import.meta.url), "utf8");
    expect(css).toMatch(/@media \(min-width: 1100px\)[\s\S]*?\.today-habit-column \{ grid-column: 2; grid-row: 1; \}/);
    expect(css).toMatch(/\.today-work-column \{ grid-column: 1; grid-row: 1; \}/);
    expect(css).toMatch(/\.today-habit-column \{ grid-column: 1; grid-row: 2; \}/);
  });
});
