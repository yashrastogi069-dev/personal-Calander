import { describe, expect, it } from "vitest";
import { nextFreeReservationMinute, plannerShortcutCommand } from "../shared/plannerKeyboard";

describe("planner keyboard contracts", () => {
  it("allows only unmodified n and t commands outside text editing, dialogs, and composition", () => {
    expect(plannerShortcutCommand({ key: "n" })).toBe("new-task");
    expect(plannerShortcutCommand({ key: "T" })).toBe("today");
    expect(plannerShortcutCommand({ key: "n", targetIsEditable: true })).toBeNull();
    expect(plannerShortcutCommand({ key: "t", dialogOpen: true })).toBeNull();
    expect(plannerShortcutCommand({ key: "n", isComposing: true })).toBeNull();
    expect(plannerShortcutCommand({ key: "n", ctrlKey: true })).toBeNull();
  });

  it("finds the next grid-aligned free start without crossing busy time or the end of the workday", () => {
    const slots = [540, 555, 570, 585, 600, 615, 630, 645, 660, 675, 690, 705, 720, 735, 750, 765, 780, 795, 810, 825, 840, 855, 870, 885, 900, 915, 930, 945, 960];
    expect(nextFreeReservationMinute({ slotMinutes: slots, selectedMinute: 540, durationMinutes: 30, workEnd: 1020, busy: [{ startMinute: 540, endMinute: 600 }, { startMinute: 630, endMinute: 660 }] })).toBe(600);
    expect(nextFreeReservationMinute({ slotMinutes: slots, selectedMinute: 945, durationMinutes: 90, workEnd: 1020, busy: [] })).toBeNull();
  });
});
