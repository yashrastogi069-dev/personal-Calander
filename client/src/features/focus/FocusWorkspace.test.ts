import { describe, expect, it, vi } from "vitest";
import { FOCUS_OFFLINE_GUIDANCE, formatElapsedDuration, formatFocusTargetGuidance, initialFocusTaskSelection, runFocusMutation } from "./FocusWorkspace";

describe("focus task entry", () => {
  const eligibleTasks = [{ id: "active-task" }, { id: "next-task" }];

  it("honors an explicitly linked eligible task", () => {
    expect(initialFocusTaskSelection(eligibleTasks, "next-task")).toBe("next-task");
  });

  it("does not silently link another task when an explicit task is ineligible or missing", () => {
    expect(initialFocusTaskSelection(eligibleTasks, "wont-do-task")).toBe("none");
  });

  it("keeps the ordinary Focus entry's suggested first task", () => {
    expect(initialFocusTaskSelection(eligibleTasks)).toBe("active-task");
  });
});

describe("focus mutation connectivity boundary", () => {
  it("blocks a mutation and explains why while offline", () => {
    const mutate = vi.fn();
    const onBlocked = vi.fn();

    const ran = runFocusMutation(false, mutate, onBlocked);

    expect(ran).toBe(false);
    expect(mutate).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledOnce();
    expect(FOCUS_OFFLINE_GUIDANCE).toContain("Reconnect");
  });

  it("runs a mutation when online", () => {
    const mutate = vi.fn();
    const onBlocked = vi.fn();

    const ran = runFocusMutation(true, mutate, onBlocked);

    expect(ran).toBe(true);
    expect(mutate).toHaveBeenCalledOnce();
    expect(onBlocked).not.toHaveBeenCalled();
  });
});

describe("focus elapsed-time display", () => {
  it("keeps minute-and-second precision for sessions under an hour", () => {
    expect(formatElapsedDuration(25 * 60 + 7)).toBe("25:07");
    expect(formatElapsedDuration(59 * 60 + 59)).toBe("59:59");
  });

  it("uses readable hour units after the first hour", () => {
    expect(formatElapsedDuration(60 * 60)).toBe("1h 0m");
    expect(formatElapsedDuration(129 * 60 * 60 + 48 * 60)).toBe("5d 9h 48m");
  });

  it("normalizes fractional and negative durations without changing stored values", () => {
    expect(formatElapsedDuration(3600.9)).toBe("1h 0m");
    expect(formatElapsedDuration(-1)).toBe("00:00");
  });
});

describe("focus target guidance", () => {
  it("shows remaining time before the target and a boundary state at the target", () => {
    expect(formatFocusTargetGuidance(49 * 60, 50 * 60)).toBe("1 minute to target");
    expect(formatFocusTargetGuidance(50 * 60, 50 * 60)).toBe("Target reached");
  });

  it("shows readable overrun after the target without implying the session stopped", () => {
    expect(formatFocusTargetGuidance(55 * 60, 50 * 60)).toBe("Target reached · 5m over");
    expect(formatFocusTargetGuidance(129 * 60 * 60 + 54 * 60, 50 * 60)).toBe("Target reached · 5d 9h 4m over");
  });

  it("omits target guidance when no target was set", () => {
    expect(formatFocusTargetGuidance(3600, 0)).toBe("");
  });
});
