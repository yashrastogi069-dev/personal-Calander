import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLICK_AFTER_RELEASE_MS, LongPressEngine } from "./useLongPress";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  const onLongPress = vi.fn();
  const engine = new LongPressEngine(onLongPress);
  return { engine, onLongPress };
}

describe("LongPressEngine (G6)", () => {
  it("fires after 450ms with the press origin", () => {
    const { engine, onLongPress } = setup();
    engine.down({ pointerId: 1, x: 100, y: 700 });
    expect(engine.getSnapshot()).toBe(true);
    vi.advanceTimersByTime(449);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onLongPress).toHaveBeenCalledWith({ x: 100, y: 700 });
    expect(engine.getSnapshot()).toBe(false);
  });
  it("a 300ms hold does nothing", () => {
    const { engine, onLongPress } = setup();
    engine.down({ pointerId: 1, x: 100, y: 700 });
    vi.advanceTimersByTime(300);
    expect(engine.up(1)).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });
  it("movement of 8px or more cancels; 7px does not", () => {
    const moved = setup();
    moved.engine.down({ pointerId: 1, x: 100, y: 700 });
    moved.engine.move({ pointerId: 1, x: 108, y: 700 });
    vi.advanceTimersByTime(500);
    expect(moved.onLongPress).not.toHaveBeenCalled();

    const still = setup();
    still.engine.down({ pointerId: 1, x: 100, y: 700 });
    still.engine.move({ pointerId: 1, x: 107, y: 700 });
    vi.advanceTimersByTime(450);
    expect(still.onLongPress).toHaveBeenCalledTimes(1);
  });
  it("a second finger cancels", () => {
    const { engine, onLongPress } = setup();
    engine.down({ pointerId: 1, x: 100, y: 700 });
    engine.down({ pointerId: 2, x: 140, y: 700 });
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });
  it("ignores non-primary buttons", () => {
    const { engine, onLongPress } = setup();
    engine.down({ pointerId: 1, x: 0, y: 0, button: 2 });
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });
  it("swallows only the click that follows a completed hold", () => {
    const { engine } = setup();
    engine.down({ pointerId: 1, x: 100, y: 700 });
    vi.advanceTimersByTime(450);
    expect(engine.up(1, 1000)).toBe(true);
    expect(engine.consumeFired(1000 + CLICK_AFTER_RELEASE_MS)).toBe(true);
    expect(engine.consumeFired(1001)).toBe(false); // only once

    engine.down({ pointerId: 1, x: 100, y: 700 });
    vi.advanceTimersByTime(450);
    engine.up(1, 5000);
    expect(engine.consumeFired(5000 + CLICK_AFTER_RELEASE_MS + 1)).toBe(false); // a later, deliberate click
  });
  it("the keyboard contextmenu (ContextMenu key, Shift+F10) opens the menu; the touch one is suppressed", () => {
    const { engine, onLongPress } = setup();
    expect(engine.contextMenu({ x: 50, y: 50 })).toBe("opened");
    expect(onLongPress).toHaveBeenCalledWith({ x: 50, y: 50 });
    engine.down({ pointerId: 1, x: 100, y: 700 });
    vi.advanceTimersByTime(450);
    expect(engine.contextMenu({ x: 100, y: 700 })).toBe("suppressed"); // finger still down
    expect(onLongPress).toHaveBeenCalledTimes(2);
  });
  it("dispose clears a pending timer", () => {
    const { engine, onLongPress } = setup();
    engine.down({ pointerId: 1, x: 100, y: 700 });
    engine.dispose();
    vi.advanceTimersByTime(1000);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
