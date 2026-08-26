import { describe, expect, it } from "vitest";
import { localDateForReservation, plannerObjectDefinitions, taskSchedulingLanguage, validateTimeReservation } from "../shared/planningLanguage";

describe("planning language contract", () => {
  it("keeps the four planner objects operationally distinct", () => {
    expect(plannerObjectDefinitions.goal.description).toContain("measurable outcome");
    expect(plannerObjectDefinitions.project.description).toContain("finite body of work");
    expect(plannerObjectDefinitions.habit.description).toContain("cadence and completion rule");
    expect(plannerObjectDefinitions.habit.description).toContain("Habit tracker");
  });

  it("states the planner consequences of dates, focus time, and reservation", () => {
    expect(taskSchedulingLanguage.deadline.help).toContain("latest date");
    expect(taskSchedulingLanguage.planFor.help).toContain("does not reserve time");
    expect(taskSchedulingLanguage.focusTime.help).toContain("today still fits");
    expect(taskSchedulingLanguage.reserveTime.help).toContain("calendar");
  });

  it("validates a complete reservation and derives its planned date", () => {
    expect(validateTimeReservation(null, null)).toBeNull();
    expect(validateTimeReservation(null, "2026-08-26T10:00")).toBe("Choose when the reserved time starts.");
    expect(validateTimeReservation("2026-08-26T10:00", null)).toBe("Choose when the reserved time ends.");
    expect(validateTimeReservation("2026-08-26T10:00", "2026-08-26T09:30")).toBe("Reserved time must end after it starts.");
    expect(validateTimeReservation("2026-08-26T10:00", "2026-08-26T10:30")).toBeNull();
    expect(localDateForReservation("2026-08-26T10:00")).toBe("2026-08-26");
  });
});
