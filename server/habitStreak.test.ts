import { describe, expect, it } from "vitest";
import { habitStreak as dashboardHabitStreak } from "@/features/dashboard/dashboardModel";
import { habitStreak, habitStreakDetail } from "@shared/habitStreak";

const TODAY = "2026-10-15";
const daily = { id: "h1", frequency: "daily" as const, schedule: {}, createdAt: "2026-08-01T00:00:00.000Z" };

describe("shared habitStreak (moved from dashboardModel, spec D4 §4.1 E1)", () => {
  it("dashboardModel re-exports the same function", () => {
    expect(dashboardHabitStreak).toBe(habitStreak);
  });

  it("counts from yesterday while today is open; skipped days neither break nor extend", () => {
    const checkIns = [
      { habitId: "h1", localDate: "2026-10-14", state: "completed" },
      { habitId: "h1", localDate: "2026-10-13", state: "skipped" },
      { habitId: "h1", localDate: "2026-10-12", state: "completed" },
      { habitId: "h2", localDate: "2026-10-11", state: "completed" },
    ];
    expect(habitStreak(daily, checkIns, TODAY, "2026-09-18")).toBe(2);
    expect(habitStreakDetail(daily, checkIns, TODAY, "2026-09-18")).toEqual({ streak: 2, capped: false });
  });

  it("capped is true only when the window ends the count", () => {
    const checkIns = Array.from({ length: 5 }, (_, index) => ({ habitId: "h1", localDate: `2026-10-1${4 - index}`, state: "completed" }));
    expect(habitStreakDetail(daily, checkIns, TODAY, "2026-10-12")).toEqual({ streak: 3, capped: true });
    expect(habitStreakDetail(daily, [], TODAY, "2026-10-12")).toEqual({ streak: 0, capped: false });
  });
});
