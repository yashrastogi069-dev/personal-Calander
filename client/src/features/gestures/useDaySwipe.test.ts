import { beforeEach, describe, expect, it } from "vitest";
import { resetGestureOwner } from "./gestureOwner";
import { DaySwipeEngine } from "./useDaySwipe";

const start = { pointerType: "touch", startX: 200, viewportWidth: 390 };

beforeEach(resetGestureOwner);

describe("DaySwipeEngine (G4, G5)", () => {
  it("ignores mouse and edge starts", () => {
    const engine = new DaySwipeEngine();
    expect(engine.start({ ...start, pointerType: "mouse" })).toBe(false);
    expect(engine.start({ ...start, startX: 4 })).toBe(false);
    expect(engine.start(start)).toBe(true);
  });
  it("follows at 0.4x and shifts to the next day on a 72px left swipe", () => {
    const engine = new DaySwipeEngine();
    engine.start(start);
    expect(engine.move(-50, 2)).toEqual({ axis: "x", display: -20 });
    expect(engine.release(-80, 0)).toEqual({ kind: "shift", dir: 1 });
  });
  it("shifts to the previous day on a right flick", () => {
    const engine = new DaySwipeEngine();
    engine.start(start);
    engine.move(45, 0);
    expect(engine.release(45, 0.5)).toEqual({ kind: "shift", dir: -1 });
  });
  it("springs back below the threshold", () => {
    const engine = new DaySwipeEngine();
    engine.start(start);
    engine.move(-60, 0);
    expect(engine.release(-60, 0.1)).toEqual({ kind: "rest" });
  });
  it("a vertical drag scrolls and never shifts", () => {
    const engine = new DaySwipeEngine();
    engine.start(start);
    expect(engine.move(10, 60).axis).toBe("y");
    expect(engine.release(-200, 1)).toEqual({ kind: "rest" });
  });
  it("bounces at a clamped end (Today strip: -1..1)", () => {
    const engine = new DaySwipeEngine();
    engine.start(start);
    engine.move(-100, 0);
    expect(engine.release(-100, 0, { position: 1, min: -1, max: 1 })).toEqual({ kind: "bounce", dir: 1 });
    engine.start(start);
    engine.move(100, 0);
    expect(engine.release(100, 0, { position: 1, min: -1, max: 1 })).toEqual({ kind: "shift", dir: -1 });
  });
});
