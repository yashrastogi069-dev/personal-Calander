import { afterEach, describe, expect, it } from "vitest";
import { claimGesture, currentGestureOwner, ownsGesture, releaseGesture, resetGestureOwner } from "./gestureOwner";
import {
  GESTURE,
  dampBeyond,
  dayFollowOffset,
  dayShiftAllowed,
  isGestureOptOut,
  isGesturePointer,
  lockAxis,
  pullArmed,
  pullDisplayOffset,
  pullProgress,
  resolveDaySwipe,
  resolveRowRelease,
  rowArmedSide,
  rowCompleteThreshold,
  rowDisplayOffset,
  rowProgress,
  rowRescheduleThreshold,
  signedVelocity,
  startsInEdgeGuard,
} from "./swipeMath";

describe("axis lock (10px, 1.35)", () => {
  it.each([
    [0, 0, "pending"],
    [9, 9, "pending"],
    [-9, 5, "pending"],
    [10, 0, "x"],
    [-10, 0, "x"],
    [27, 20, "x"], // 27 >= 20 * 1.35
    [26, 20, "y"], // 26 < 27
    [-27, 20, "x"],
    [13.5, 10, "x"],
    [13.4, 10, "y"],
    [0, 10, "y"],
    [10, 10, "y"], // a 45-degree drag scrolls
    [30, Math.tan(Math.PI / 6) * 30, "x"], // the 30-degree diagonal from spec risk 3: ratio 1.73
  ] as const)("dx=%s dy=%s -> %s", (dx, dy, axis) => {
    expect(lockAxis(dx, dy)).toBe(axis);
  });
});

describe("edge guard and pointer filter", () => {
  it("rejects starts within 20px of either edge", () => {
    expect(startsInEdgeGuard(8, 390)).toBe(true);
    expect(startsInEdgeGuard(19.9, 390)).toBe(true);
    expect(startsInEdgeGuard(20, 390)).toBe(false);
    expect(startsInEdgeGuard(370, 390)).toBe(false);
    expect(startsInEdgeGuard(371, 390)).toBe(true);
    expect(startsInEdgeGuard(5, 0)).toBe(false);
  });
  it("takes touch and pen only unless mouse is allowed", () => {
    expect(isGesturePointer("touch")).toBe(true);
    expect(isGesturePointer("pen")).toBe(true);
    expect(isGesturePointer("mouse")).toBe(false);
    expect(isGesturePointer("mouse", true)).toBe(true);
    expect(isGesturePointer(undefined)).toBe(false);
  });
  it("honours data-no-gesture", () => {
    expect(isGestureOptOut({ closest: () => ({}) } as unknown as EventTarget)).toBe(true);
    expect(isGestureOptOut({ closest: () => null } as unknown as EventTarget)).toBe(false);
    expect(isGestureOptOut(null)).toBe(false);
  });
});

describe("damping", () => {
  it("is the identity up to the limit and monotonic but slower beyond it", () => {
    expect(dampBeyond(100, 140)).toBe(100);
    expect(dampBeyond(-100, 140)).toBe(-100);
    let previous = 140;
    for (let raw = 150; raw <= 600; raw += 10) {
      const damped = dampBeyond(raw, 140);
      expect(damped).toBeGreaterThan(previous);
      expect(damped).toBeLessThan(raw);
      previous = damped;
    }
    expect(dampBeyond(-300, 140)).toBe(-dampBeyond(300, 140));
  });
  it("damps the row past 140px right and past 75% of the width left", () => {
    expect(rowDisplayOffset(140, 358)).toBe(140);
    expect(rowDisplayOffset(200, 358)).toBeLessThan(200);
    expect(rowDisplayOffset(-200, 358)).toBe(-200);
    expect(rowDisplayOffset(-300, 358)).toBeGreaterThan(-300);
  });
});

describe("row thresholds (G1 to G3)", () => {
  it("completes at max(88px, 28% of the width)", () => {
    expect(rowCompleteThreshold(200)).toBe(88);
    expect(rowCompleteThreshold(400)).toBeCloseTo(112);
  });
  it("reschedules fully at 60% of the width, never inside the revealed rest", () => {
    expect(rowRescheduleThreshold(400)).toBe(240);
    expect(rowRescheduleThreshold(200)).toBe(169);
  });
  it.each([
    // offset, velocity, width -> outcome
    [120, 0, 358, "complete"], // 120 >= 100.24
    [100, 0, 358, "rest"],
    [40, 0.55, 358, "complete"], // flick with 40px
    [39, 0.9, 358, "rest"], // flick too short
    [60, 0.54, 358, "rest"],
    [-30, 0, 358, "rest"],
    [-56, 0, 358, "reveal"],
    [-100, 0, 358, "reveal"],
    [-100, -0.7, 358, "reschedule"], // leftward flick past reveal distance
    [-40, -2, 358, "rest"], // tiny flick never reschedules
    [-215, 0, 358, "reschedule"], // 60% of 358 = 214.8
    [-214, 0, 358, "reveal"],
    [-240, 0, 358, "reschedule"],
  ] as const)("offset %s, v %s, width %s -> %s", (offset, velocity, width, outcome) => {
    expect(resolveRowRelease(offset, velocity, width)).toBe(outcome);
  });
  it("progress and armed side follow the thresholds", () => {
    expect(rowProgress(50, 200)).toEqual({ complete: 50 / 88, reschedule: 0 });
    expect(rowProgress(200, 200).complete).toBe(1);
    expect(rowProgress(-120, 400)).toEqual({ complete: 0, reschedule: 0.5 });
    expect(rowArmedSide(88, 200)).toBe("complete");
    expect(rowArmedSide(87, 200)).toBeNull();
    expect(rowArmedSide(-240, 400)).toBe("reschedule");
    expect(rowArmedSide(-239, 400)).toBeNull();
  });
});

describe("day swipe (G4, G5)", () => {
  it("follows at 0.4x capped at 40px", () => {
    expect(dayFollowOffset(50)).toBe(20);
    expect(dayFollowOffset(-50)).toBe(-20);
    expect(dayFollowOffset(500)).toBe(40);
    expect(dayFollowOffset(-500)).toBe(-40);
  });
  it.each([
    [-72, 0, 1],
    [72, 0, -1],
    [-71, 0, null],
    [-40, -0.45, 1],
    [40, 0.45, -1],
    [-39, -1, null],
    [-50, 0.6, null], // flick against the drag
    [-80, 0.6, 1], // distance wins
  ] as const)("dx %s v %s -> %s", (dx, velocity, dir) => {
    expect(resolveDaySwipe(dx, velocity)).toBe(dir);
  });
  it("clamps at the bounds", () => {
    expect(dayShiftAllowed(0, 1, -1, 1)).toBe(true);
    expect(dayShiftAllowed(1, 1, -1, 1)).toBe(false);
    expect(dayShiftAllowed(-1, -1, -1, 1)).toBe(false);
    expect(dayShiftAllowed(500, 1)).toBe(true);
  });
});

describe("pull to refresh (G9)", () => {
  it("arms at a raw 140px, which displays as 84px", () => {
    expect(pullArmed(139)).toBe(false);
    expect(pullArmed(140)).toBe(true);
    expect(pullDisplayOffset(140)).toBeCloseTo(GESTURE.pull.armDisplayPx);
    expect(pullDisplayOffset(100)).toBeCloseTo(60);
    expect(pullDisplayOffset(300)).toBeLessThan(300 * 0.6);
    expect(pullDisplayOffset(-10)).toBe(0);
    expect(pullProgress(70)).toBe(0.5);
    expect(pullProgress(400)).toBe(1);
  });
});

describe("signed velocity", () => {
  it("combines use-gesture's absolute velocity with direction", () => {
    expect(signedVelocity(0.8, -1)).toBe(-0.8);
    expect(signedVelocity(0.8, 1)).toBe(0.8);
    expect(signedVelocity(0.8, 0)).toBe(0);
    expect(signedVelocity(Number.NaN, 1)).toBe(0);
  });
});

describe("gesture owner", () => {
  afterEach(resetGestureOwner);
  it("lets a higher priority take over and blocks equal or lower ones", () => {
    const pull = Symbol("pull");
    const row = Symbol("row");
    const otherRow = Symbol("row2");
    const sheet = Symbol("sheet");
    expect(claimGesture("pull", pull)).toBe(true);
    expect(claimGesture("row", row)).toBe(true);
    expect(ownsGesture(pull)).toBe(false);
    expect(claimGesture("row", otherRow)).toBe(false);
    expect(claimGesture("day", Symbol("day"))).toBe(false);
    expect(claimGesture("sheet", sheet)).toBe(true);
    expect(currentGestureOwner()).toBe("sheet");
    releaseGesture(row); // not the owner: no effect
    expect(currentGestureOwner()).toBe("sheet");
    releaseGesture(sheet);
    expect(currentGestureOwner()).toBeNull();
  });
});
