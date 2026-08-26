import { describe, expect, it } from "vitest";
import { dailyCapacityForecast, deadlineRiskForTask } from "@shared/planningForecast";

describe("daily capacity forecast and deadline risk", () => {
  it("counts planned work once, keeps unknown effort explicit, and separates reserved and deadline-only minutes", () => {
    const forecast = dailyCapacityForecast([
      { state: "not_started", scheduledLocalDate: "2026-08-26", dueLocalDate: "2026-08-26", estimateMinutes: 45, plannedStartAt: new Date("2026-08-26T09:00:00Z") },
      { state: "in_progress", dueLocalDate: "2026-08-26", estimateMinutes: 30 },
      { state: "not_started", scheduledLocalDate: "2026-08-26", estimateMinutes: null },
      { state: "completed", scheduledLocalDate: "2026-08-26", estimateMinutes: 60 },
    ], "2026-08-26", 90);

    expect(forecast).toMatchObject({ todayTaskCount: 3, plannedMinutes: 75, remainingMinutes: 15, reservedMinutes: 45, deadlineOnlyMinutes: 30, unestimatedCount: 1, isOverCapacity: false });
  });

  it("flags only explainable deadline risk without treating every future deadline as risky", () => {
    expect(deadlineRiskForTask({ state: "not_started", dueLocalDate: "2026-08-25" }, "2026-08-26")).toBe("overdue");
    expect(deadlineRiskForTask({ state: "not_started", dueLocalDate: "2026-08-26" }, "2026-08-26")).toBe("due_today");
    expect(deadlineRiskForTask({ state: "not_started", dueLocalDate: "2026-08-28" }, "2026-08-26")).toBe("unplanned_soon");
    expect(deadlineRiskForTask({ state: "not_started", dueLocalDate: "2026-08-28", scheduledLocalDate: "2026-08-27" }, "2026-08-26")).toBeNull();
    expect(deadlineRiskForTask({ state: "completed", dueLocalDate: "2026-08-25" }, "2026-08-26")).toBeNull();
  });
});
