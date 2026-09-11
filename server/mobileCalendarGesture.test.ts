import { describe, expect, it } from "vitest";
import { resolveMobileCalendarGesture } from "@shared/mobileCalendarGesture";

describe("resolveMobileCalendarGesture", () => {
  const base = { pointerType: "touch", startX: 200, startY: 100, endY: 100 };

  it("moves to the next day on a decisive left swipe", () => {
    expect(resolveMobileCalendarGesture({ ...base, endX: 110 })).toBe(1);
  });

  it("moves to the previous day on a decisive right swipe", () => {
    expect(resolveMobileCalendarGesture({ ...base, endX: 290 })).toBe(-1);
  });

  it("does not steal vertical scrolling or short taps", () => {
    expect(resolveMobileCalendarGesture({ ...base, endX: 250, endY: 190 })).toBeNull();
    expect(resolveMobileCalendarGesture({ ...base, endX: 255 })).toBeNull();
  });

  it("ignores mouse and pen input", () => {
    expect(resolveMobileCalendarGesture({ ...base, endX: 100, pointerType: "mouse" })).toBeNull();
    expect(resolveMobileCalendarGesture({ ...base, endX: 100, pointerType: "pen" })).toBeNull();
  });
});
