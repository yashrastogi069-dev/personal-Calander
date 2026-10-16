import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { claimGesture, resetGestureOwner } from "./gestureOwner";
import { PULL_MESSAGES, PULL_TIMING, PullToRefreshEngine } from "./usePullToRefresh";

function setup(overrides: { canRefresh?: () => string | null; onRefresh?: () => Promise<void> } = {}) {
  const callbacks = {
    canRefresh: vi.fn(overrides.canRefresh ?? (() => null)),
    onRefresh: vi.fn(overrides.onRefresh ?? (() => Promise.resolve())),
  };
  const engine = new PullToRefreshEngine(callbacks);
  return { engine, callbacks };
}

const top = { scrollTop: 0, startX: 180, viewportWidth: 390, touches: 1 };

beforeEach(() => {
  vi.useFakeTimers();
  resetGestureOwner();
});
afterEach(() => vi.useRealTimers());

describe("PullToRefreshEngine start", () => {
  it("tracks only at the top, with one finger, outside the edge guard", () => {
    const { engine } = setup();
    expect(engine.start({ ...top, scrollTop: 1 })).toBe(false);
    expect(engine.start({ ...top, touches: 2 })).toBe(false);
    expect(engine.start({ ...top, startX: 10 })).toBe(false);
    expect(engine.start({ ...top, optOut: true })).toBe(false);
    expect(engine.start(top)).toBe(true);
  });
});

describe("PullToRefreshEngine move", () => {
  it("abandons an upward or horizontal first movement without preventing default", () => {
    const up = setup().engine;
    up.start(top);
    expect(up.move(0, -20).preventDefault).toBe(false);
    expect(up.move(0, 200).preventDefault).toBe(false); // abandoned for this touch

    const sideways = setup().engine;
    sideways.start(top);
    expect(sideways.move(40, 10).preventDefault).toBe(false);
    expect(sideways.getSnapshot().phase).toBe("idle");
  });
  it("prevents default only while pulling, and arms at a raw 140px", () => {
    const { engine } = setup();
    engine.start(top);
    expect(engine.move(0, 5).preventDefault).toBe(false); // under the axis lock
    const pulling = engine.move(0, 100);
    expect(pulling.preventDefault).toBe(true);
    expect(pulling.display).toBeCloseTo(60);
    expect(engine.getSnapshot()).toEqual({ phase: "pulling", message: PULL_MESSAGES.pulling });
    const armed = engine.move(0, 140);
    expect(armed.progress).toBe(1);
    expect(armed.display).toBeCloseTo(84);
    expect(engine.getSnapshot()).toEqual({ phase: "armed", message: PULL_MESSAGES.armed });
    engine.move(0, 120);
    expect(engine.getSnapshot().phase).toBe("pulling"); // reversing disarms
  });
  it("a second finger or a higher-priority gesture abandons the pull", () => {
    const { engine } = setup();
    engine.start(top);
    engine.move(0, 50);
    expect(engine.move(0, 60, 2).preventDefault).toBe(false);
    expect(engine.getSnapshot().phase).toBe("idle");

    const other = setup().engine;
    other.start(top);
    other.move(0, 50);
    claimGesture("row", Symbol("row"));
    expect(other.move(0, 80).preventDefault).toBe(false);
  });
});

describe("PullToRefreshEngine release", () => {
  it("does nothing below the armed point", async () => {
    const { engine, callbacks } = setup();
    engine.start(top);
    engine.move(0, 139);
    await engine.release();
    expect(callbacks.onRefresh).not.toHaveBeenCalled();
    expect(engine.getSnapshot().phase).toBe("idle");
  });
  it("refreshes once, shows refreshing for at least 700ms, then done, then idle", async () => {
    const { engine, callbacks } = setup();
    engine.start(top);
    engine.move(0, 160);
    const cycle = engine.release();
    expect(callbacks.onRefresh).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot()).toEqual({ phase: "refreshing", message: PULL_MESSAGES.refreshing });
    await vi.advanceTimersByTimeAsync(PULL_TIMING.minRefreshingMs - 1);
    expect(engine.getSnapshot().phase).toBe("refreshing");
    await vi.advanceTimersByTimeAsync(1);
    await cycle;
    expect(engine.getSnapshot()).toEqual({ phase: "done", message: PULL_MESSAGES.done });
    expect(engine.start(top)).toBe(false); // busy while the result shows
    await vi.advanceTimersByTimeAsync(PULL_TIMING.doneHoldMs);
    expect(engine.getSnapshot().phase).toBe("idle");
  });
  it("refuses offline with the reason, makes no call, and clears after 2.4s", async () => {
    const { engine, callbacks } = setup({ canRefresh: () => "Offline. Showing saved data." });
    engine.start(top);
    engine.move(0, 200);
    await engine.release();
    expect(callbacks.onRefresh).not.toHaveBeenCalled();
    expect(engine.getSnapshot()).toEqual({ phase: "refused", message: "Offline. Showing saved data." });
    await vi.advanceTimersByTimeAsync(PULL_TIMING.refusedHoldMs);
    expect(engine.getSnapshot().phase).toBe("idle");
  });
  it("says so when the refresh fails", async () => {
    const { engine } = setup({ onRefresh: () => Promise.reject(new Error("network")) });
    engine.start(top);
    engine.move(0, 200);
    const cycle = engine.release();
    await vi.advanceTimersByTimeAsync(PULL_TIMING.minRefreshingMs);
    await cycle;
    expect(engine.getSnapshot()).toEqual({ phase: "refused", message: PULL_MESSAGES.failed });
  });
  it("refresh() is the button path with the same rules and ignores a second press while running", async () => {
    const { engine, callbacks } = setup();
    const first = engine.refresh();
    void engine.refresh();
    expect(callbacks.onRefresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(PULL_TIMING.minRefreshingMs);
    await first;
    expect(engine.getSnapshot().phase).toBe("done");
  });
  it("a browser touchcancel returns to idle without refreshing", () => {
    const { engine, callbacks } = setup();
    engine.start(top);
    engine.move(0, 200);
    engine.cancel();
    expect(engine.getSnapshot().phase).toBe("idle");
    expect(callbacks.onRefresh).not.toHaveBeenCalled();
  });
  it("does not publish after disposal", async () => {
    const { engine } = setup();
    const cycle = engine.refresh();
    engine.markDisposed();
    engine.dispose();
    await vi.advanceTimersByTimeAsync(PULL_TIMING.minRefreshingMs);
    await cycle;
    expect(engine.getSnapshot().phase).toBe("refreshing");
  });
});
