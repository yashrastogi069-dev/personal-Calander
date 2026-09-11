import { describe, expect, it } from "vitest";
import { resolveMobileTaskGesture } from "@shared/mobileTaskGesture";

describe("resolveMobileTaskGesture", () => {
  const base = { pointerType: "touch", startX: 200, startY: 100, endY: 100, completed: false };

  it("completes an open task on a decisive left swipe", () => {
    expect(resolveMobileTaskGesture({ ...base, endX: 120 })).toBe("complete");
  });

  it("reveals reversible archive on a decisive right swipe", () => {
    expect(resolveMobileTaskGesture({ ...base, endX: 290 })).toBe("reveal_archive");
  });

  it("does not treat vertical scrolling or a short movement as an action", () => {
    expect(resolveMobileTaskGesture({ ...base, endX: 245, endY: 180 })).toBeNull();
    expect(resolveMobileTaskGesture({ ...base, endX: 250 })).toBeNull();
  });

  it("does not complete an already completed task by swipe", () => {
    expect(resolveMobileTaskGesture({ ...base, endX: 100, completed: true })).toBeNull();
  });

  it("does not activate from mouse or pen input", () => {
    expect(resolveMobileTaskGesture({ ...base, endX: 100, pointerType: "mouse" })).toBeNull();
  });
});
