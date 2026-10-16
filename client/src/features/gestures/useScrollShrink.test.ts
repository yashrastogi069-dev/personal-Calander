import { describe, expect, it } from "vitest";
import { SCROLL_SHRINK, ScrollShrinkTracker, keyboardLikelyOpen, type ScrollShrinkInput } from "./useScrollShrink";

const maxY = 3000;

function run(tracker: ScrollShrinkTracker, ys: number[], extra: Partial<ScrollShrinkInput> = {}) {
  return ys.map(y => tracker.update({ y, maxY, ...extra }));
}

function scrolledDown(to = 400) {
  const tracker = new ScrollShrinkTracker();
  const ys: number[] = [];
  for (let y = 0; y <= to; y += 20) ys.push(y);
  run(tracker, ys);
  return tracker;
}

describe("ScrollShrinkTracker", () => {
  it("shrinks only above 96px after 48px of downward travel", () => {
    const tracker = new ScrollShrinkTracker();
    expect(run(tracker, [0, 40, 80, 96]).at(-1)).toBe("rest"); // never above 96 yet
    expect(tracker.update({ y: 97, maxY })).toBe("shrunk"); // 97 > 96 and 97 - 0 >= 48

    const late = new ScrollShrinkTracker();
    run(late, [300]); // first sample: no travel yet
    expect(late.update({ y: 340, maxY })).toBe("rest"); // 40px of travel
    expect(late.update({ y: 348, maxY })).toBe("shrunk"); // 48px
  });
  it("expands after 12px of upward travel", () => {
    const tracker = scrolledDown();
    expect(tracker.current).toBe("shrunk");
    expect(tracker.update({ y: 390, maxY })).toBe("shrunk"); // 10px up
    expect(tracker.update({ y: 389, maxY })).toBe("shrunk"); // 11px up
    expect(tracker.update({ y: 388, maxY })).toBe("rest"); // 12px up
  });
  it("has hysteresis: small jitter around a position never flickers", () => {
    const tracker = scrolledDown();
    const states = run(tracker, [395, 400, 394, 401, 396, 402, 397]);
    expect(new Set(states)).toEqual(new Set(["shrunk"]));
    const rested = new ScrollShrinkTracker();
    run(rested, [200]);
    expect(new Set(run(rested, [230, 205, 235, 210, 240, 215]))).toEqual(new Set(["rest"]));
  });
  it("rests near the top and at the document bottom", () => {
    const tracker = scrolledDown();
    expect(tracker.update({ y: 7, maxY })).toBe("rest");
    const bottom = scrolledDown(2900);
    expect(bottom.current).toBe("shrunk");
    expect(bottom.update({ y: maxY - SCROLL_SHRINK.bottomSlack, maxY })).toBe("rest");
  });
  it("never shrinks with reduced motion", () => {
    const tracker = new ScrollShrinkTracker();
    const states = run(tracker, [0, 100, 200, 300, 400, 800], { reducedMotion: true });
    expect(new Set(states)).toEqual(new Set(["rest"]));
  });
  it("keeps its state while a sheet is open", () => {
    const rest = new ScrollShrinkTracker();
    expect(new Set(run(rest, [0, 100, 200, 400], { suspended: true }))).toEqual(new Set(["rest"]));
    const shrunk = scrolledDown();
    expect(shrunk.update({ y: 5, maxY, suspended: true })).toBe("shrunk");
  });
  it("expands and stays expanded while focus is inside the bar", () => {
    const tracker = scrolledDown();
    expect(new Set(run(tracker, [420, 500, 700], { focusInside: true }))).toEqual(new Set(["rest"]));
  });
  it("expand() forces rest and measures travel again from the given position", () => {
    const tracker = scrolledDown();
    expect(tracker.expand(400)).toBe("rest");
    expect(tracker.update({ y: 440, maxY })).toBe("rest");
    expect(tracker.update({ y: 448, maxY })).toBe("shrunk");
  });
});

describe("keyboardLikelyOpen", () => {
  it("is true below 75% of the window height", () => {
    expect(keyboardLikelyOpen(500, 844)).toBe(true);
    expect(keyboardLikelyOpen(632, 844)).toBe(true);
    expect(keyboardLikelyOpen(633, 844)).toBe(false); // exactly 75%
    expect(keyboardLikelyOpen(undefined, 844)).toBe(false);
  });
});
