import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MOTION_MS } from "@/design/motion";
import { claimGesture, resetGestureOwner } from "./gestureOwner";
import { GESTURE } from "./swipeMath";
import { SwipeRowEngine, currentOpenSwipeRow, type SwipeRowCallbacks } from "./useSwipeRow";

const WIDTH = 358;

function setup(overrides: Partial<SwipeRowCallbacks> = {}) {
  const callbacks = {
    canCommit: vi.fn((_side: "complete" | "reschedule") => null as string | null),
    onCommit: vi.fn(),
    onRefuse: vi.fn(),
    ...overrides,
  };
  const engine = new SwipeRowEngine(callbacks);
  const phases: string[] = [];
  engine.subscribe(() => phases.push(engine.getSnapshot().phase));
  return { engine, callbacks, phases };
}

function begin(engine: SwipeRowEngine, extra: Partial<Parameters<SwipeRowEngine["start"]>[0]> = {}) {
  return engine.start({ pointerType: "touch", startX: 120, viewportWidth: 390, width: WIDTH, ...extra });
}

beforeEach(() => {
  vi.useFakeTimers();
  resetGestureOwner();
});
afterEach(() => {
  currentOpenSwipeRow()?.dispose();
  vi.useRealTimers();
});

describe("SwipeRowEngine start filters", () => {
  it("ignores mouse, edge starts and opted-out targets", () => {
    const { engine } = setup();
    expect(begin(engine, { pointerType: "mouse" })).toBe(false);
    expect(begin(engine, { startX: 8 })).toBe(false);
    expect(begin(engine, { startX: 385 })).toBe(false);
    expect(begin(engine, { optOut: true })).toBe(false);
    expect(begin(engine, { pointerType: "mouse", allowMouse: true })).toBe(true);
    expect(begin(engine, { pointerType: "pen" })).toBe(true);
  });
});

describe("SwipeRowEngine axis lock", () => {
  it("abandons to the scroll on a vertical drag and commits nothing", () => {
    const { engine, callbacks } = setup();
    begin(engine);
    expect(engine.move(4, 3).axis).toBe("pending");
    expect(engine.move(6, 80).axis).toBe("y");
    expect(engine.move(200, 80).display).toBeNull();
    expect(engine.release(200, 2)).toEqual({ to: 0, nudge: 0 });
    expect(callbacks.onCommit).not.toHaveBeenCalled();
    expect(engine.getSnapshot().phase).toBe("idle");
  });
  it("follows the finger 1:1 once horizontal and arms past the threshold", () => {
    const { engine, phases } = setup();
    begin(engine);
    expect(engine.move(12, 2)).toEqual({ axis: "x", display: 12 });
    expect(engine.getSnapshot().phase).toBe("drag");
    expect(engine.move(110, 4).display).toBe(110);
    expect(engine.getSnapshot()).toMatchObject({ phase: "armed", side: "complete" });
    engine.move(60, 4);
    expect(engine.getSnapshot().phase).toBe("drag"); // reversing under the threshold disarms
    expect(phases).toEqual(["drag", "armed", "drag"]); // notifies on phase changes only
  });
  it("yields to a higher-priority gesture", () => {
    const { engine, callbacks } = setup();
    begin(engine);
    engine.move(20, 0);
    claimGesture("sheet", Symbol("sheet"));
    expect(engine.move(120, 0).axis).toBe("y");
    engine.release(120, 1);
    expect(callbacks.onCommit).not.toHaveBeenCalled();
  });
});

describe("SwipeRowEngine release (G1 to G3)", () => {
  it("completes on a full right swipe", () => {
    const { engine, callbacks } = setup();
    begin(engine);
    engine.move(120, 0);
    expect(engine.release(120, 0.1)).toEqual({ to: 0, nudge: 0 });
    expect(callbacks.canCommit).toHaveBeenCalledWith("complete");
    expect(callbacks.onCommit).toHaveBeenCalledTimes(1);
    expect(callbacks.onCommit).toHaveBeenCalledWith("complete", "full");
  });
  it("completes on a flick of 40px at 0.55 px/ms", () => {
    const { engine, callbacks } = setup();
    begin(engine);
    engine.move(40, 0);
    engine.release(40, 0.55);
    expect(callbacks.onCommit).toHaveBeenCalledWith("complete", "full");
  });
  it("refuses with a reason, nudges 12px and returns to idle after the pop duration", () => {
    const { engine, callbacks } = setup({ canCommit: vi.fn(() => "Finish the prerequisite first") });
    begin(engine);
    engine.move(130, 0);
    expect(engine.release(130, 0)).toEqual({ to: 0, nudge: GESTURE.row.refusalNudgePx });
    expect(callbacks.onCommit).not.toHaveBeenCalled();
    expect(callbacks.onRefuse).toHaveBeenCalledWith("complete", "Finish the prerequisite first");
    expect(engine.getSnapshot()).toEqual({ phase: "refused", side: "complete", refusal: "Finish the prerequisite first" });
    vi.advanceTimersByTime(MOTION_MS.pop);
    expect(engine.getSnapshot()).toMatchObject({ phase: "idle", refusal: "Finish the prerequisite first" });
    begin(engine);
    expect(engine.getSnapshot().refusal).toBeNull(); // cleared by the next gesture
  });
  it("reveals the two buttons on a partial left swipe and rests at -168px", () => {
    const { engine, callbacks } = setup();
    begin(engine);
    engine.move(-90, 0);
    expect(engine.release(-90, -0.2)).toEqual({ to: GESTURE.row.revealRestPx, nudge: 0 });
    expect(engine.getSnapshot().phase).toBe("revealed");
    expect(callbacks.onCommit).not.toHaveBeenCalled();
    expect(engine.restingOffset()).toBe(-168);
  });
  it("snaps back under the reveal distance", () => {
    const { engine } = setup();
    begin(engine);
    engine.move(-40, 0);
    expect(engine.release(-40, 0)).toEqual({ to: 0, nudge: 0 });
    expect(engine.getSnapshot().phase).toBe("idle");
  });
  it("reschedules on a full left swipe and on a fast leftward flick", () => {
    const full = setup();
    begin(full.engine);
    full.engine.move(-240, 0);
    full.engine.release(-240, 0);
    expect(full.callbacks.onCommit).toHaveBeenCalledWith("reschedule", "full");

    const flick = setup();
    begin(flick.engine);
    flick.engine.move(-80, 0);
    flick.engine.release(-80, -0.7);
    expect(flick.callbacks.onCommit).toHaveBeenCalledWith("reschedule", "full");
  });
  it("refuses a recurring reschedule with the model's reason", () => {
    const { engine, callbacks } = setup({
      canCommit: vi.fn(side => (side === "reschedule" ? "Repeats. Change this occurrence in details" : null)),
    });
    begin(engine);
    engine.move(-260, 0);
    expect(engine.release(-260, 0)).toEqual({ to: 0, nudge: -GESTURE.row.refusalNudgePx });
    expect(callbacks.onCommit).not.toHaveBeenCalled();
    expect(engine.getSnapshot().refusal).toBe("Repeats. Change this occurrence in details");
  });
  it("continues from the revealed position on the next drag", () => {
    const { engine, callbacks } = setup();
    begin(engine);
    engine.move(-90, 0);
    engine.release(-90, 0);
    begin(engine);
    expect(engine.move(-20, 0).display).toBe(-188);
    engine.release(-80, 0); // -168 - 80 = -248 -> full reschedule
    expect(callbacks.onCommit).toHaveBeenCalledWith("reschedule", "full");
    expect(engine.getSnapshot().phase).toBe("idle");
  });
  it("closes when dragged back right from revealed", () => {
    const { engine } = setup();
    begin(engine);
    engine.move(-90, 0);
    engine.release(-90, 0);
    begin(engine);
    engine.move(150, 0);
    expect(engine.release(150, 0)).toEqual({ to: 0, nudge: 0 }); // -168 + 150 = -18 -> rest
    expect(engine.getSnapshot().phase).toBe("idle");
  });
});

describe("SwipeRowEngine buttons and single open row", () => {
  it("press() runs the same rules as the gesture with how = button", () => {
    const { engine, callbacks } = setup();
    begin(engine);
    engine.move(-90, 0);
    engine.release(-90, 0);
    expect(engine.press("reschedule")).toEqual({ to: 0, nudge: 0 });
    expect(callbacks.onCommit).toHaveBeenCalledWith("reschedule", "button");
    expect(engine.getSnapshot().phase).toBe("idle");
    expect(currentOpenSwipeRow()).toBeNull();
  });
  it("revealing a second row closes the first", () => {
    const a = setup();
    const b = setup();
    const closedA = vi.fn();
    a.engine.setExternalClose(closedA);
    begin(a.engine);
    a.engine.move(-90, 0);
    a.engine.release(-90, 0);
    expect(currentOpenSwipeRow()).toBe(a.engine);
    begin(b.engine);
    b.engine.move(-90, 0);
    b.engine.release(-90, 0);
    expect(currentOpenSwipeRow()).toBe(b.engine);
    expect(a.engine.getSnapshot().phase).toBe("idle");
    expect(closedA).toHaveBeenCalledWith({ to: 0, nudge: 0 });
  });
  it("close() and dispose() release the open row", () => {
    const { engine } = setup();
    begin(engine);
    engine.move(-90, 0);
    engine.release(-90, 0);
    expect(engine.close()).toEqual({ to: 0, nudge: 0 });
    expect(currentOpenSwipeRow()).toBeNull();
    begin(engine);
    engine.move(-90, 0);
    engine.release(-90, 0);
    engine.dispose();
    expect(currentOpenSwipeRow()).toBeNull();
  });
});
