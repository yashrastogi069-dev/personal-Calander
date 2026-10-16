// D3.5 G4 (Calendar day grid and date rail) and G5 (Today day strip, clamped to Yesterday..Tomorrow).
// `DaySwipeEngine` holds the rules as a plain class tested in node; `useDaySwipe` wires use-gesture.
//
// Button alternatives: the chevron buttons, the date rail, the Today button (G4); the strip's chevrons and
// the "Back to Today" chip (G5). Mount this only on the strip / grid wrap, never on rows (rows own
// horizontal swipe). No haptics: a clamped end bounces 8px instead.
import { useDrag } from "@use-gesture/react";
import { animate, useMotionValue, useReducedMotionConfig, type AnimationPlaybackControls, type MotionValue } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { EASE_OUT, MOTION_MS } from "@/design/motion";
import { claimGesture, ownsGesture, releaseGesture } from "./gestureOwner";
import {
  GESTURE,
  ROW_SPRING,
  dayFollowOffset,
  dayShiftAllowed,
  isGestureOptOut,
  isGesturePointer,
  lockAxis,
  resolveDaySwipe,
  signedVelocity,
  startsInEdgeGuard,
  viewportWidth,
  type GestureAxis,
} from "./swipeMath";

export type DaySwipeOutcome = { kind: "shift"; dir: -1 | 1 } | { kind: "bounce"; dir: -1 | 1 } | { kind: "rest" };

export class DaySwipeEngine {
  private axis: GestureAxis = "pending";
  private active = false;
  readonly token = Symbol("day-swipe");

  start(input: { pointerType?: string; startX: number; viewportWidth: number; optOut?: boolean; allowMouse?: boolean }): boolean {
    this.axis = "pending";
    this.active = false;
    if (!isGesturePointer(input.pointerType, input.allowMouse)) return false;
    if (input.optOut || startsInEdgeGuard(input.startX, input.viewportWidth)) return false;
    this.active = true;
    return true;
  }

  move(dx: number, dy: number): { axis: GestureAxis; display: number | null } {
    if (!this.active) return { axis: this.axis, display: null };
    if (this.axis === "pending") {
      this.axis = lockAxis(dx, dy);
      if (this.axis === "x" && !claimGesture("day", this.token)) this.axis = "y";
      if (this.axis === "y") {
        this.active = false;
        releaseGesture(this.token);
        return { axis: "y", display: null };
      }
    }
    if (this.axis !== "x") return { axis: this.axis, display: null };
    if (!ownsGesture(this.token)) {
      this.active = false;
      this.axis = "y";
      return { axis: "y", display: null };
    }
    return { axis: "x", display: dayFollowOffset(dx) };
  }

  /** `position` is the current offset (e.g. -1..1 days from today for G5); min/max clamp it. */
  release(dx: number, velocity: number, bounds: { position?: number; min?: number; max?: number } = {}): DaySwipeOutcome {
    const wasActive = this.active && this.axis === "x";
    this.active = false;
    releaseGesture(this.token);
    if (!wasActive) return { kind: "rest" };
    const dir = resolveDaySwipe(dx, velocity);
    if (dir === null) return { kind: "rest" };
    if (!dayShiftAllowed(bounds.position ?? 0, dir, bounds.min, bounds.max)) return { kind: "bounce", dir };
    return { kind: "shift", dir };
  }

  dispose() {
    this.active = false;
    releaseGesture(this.token);
  }
}

export type UseDaySwipeOptions = {
  enabled: boolean;
  /** Current offset from the anchor day (G5: days from today). Default 0. */
  position?: number;
  /** Lowest / highest allowed position (G5: -1 and 1). Default unbounded (G4). */
  min?: number;
  max?: number;
  /** -1 = previous day (swipe right), 1 = next day (swipe left). */
  onShift(dir: -1 | 1): void;
  /** Desktop testing only. */
  allowMouse?: boolean;
};

export type UseDaySwipe = {
  /** Spread on the strip or grid wrap: drag handlers plus `touch-action: pan-y`. */
  bind: () => Record<string, unknown>;
  /** Live follow offset (0.4x, capped at 40px) for the content's translateX. Reset to 0 on a shift. */
  offset: MotionValue<number>;
};

export function useDaySwipe(options: UseDaySwipeOptions): UseDaySwipe {
  const { enabled, position = 0, min, max, onShift, allowMouse = false } = options;
  const reducedMotion = useReducedMotionConfig() === true;
  const offset = useMotionValue(0);
  const [engine] = useState(() => new DaySwipeEngine());
  const animation = useRef<AnimationPlaybackControls | null>(null);
  const latest = useRef({ position, min, max, onShift, reducedMotion });
  latest.current = { position, min, max, onShift, reducedMotion };

  const stop = useCallback(() => {
    animation.current?.stop();
    animation.current = null;
  }, []);

  const settle = useCallback(
    (bounceDir: -1 | 1 | null) => {
      stop();
      if (latest.current.reducedMotion) {
        offset.set(0);
        return;
      }
      if (bounceDir === null) {
        animation.current = animate(offset, 0, ROW_SPRING);
        return;
      }
      // Swiping left (next) at the end pushes content left a little, then back.
      const push = bounceDir === 1 ? -GESTURE.day.bouncePx : GESTURE.day.bouncePx;
      animation.current = animate(offset, [offset.get(), push, 0], { duration: MOTION_MS.pop / 1000, ease: EASE_OUT });
    },
    [offset, stop]
  );

  const dragBind = useDrag(
    ({ first, last, movement, velocity, direction, initial, event, cancel }) => {
      if (first) {
        stop();
        const ok = engine.start({
          pointerType: (event as PointerEvent).pointerType,
          startX: initial[0],
          viewportWidth: viewportWidth(),
          optOut: isGestureOptOut(event.target),
          allowMouse,
        });
        if (!ok) {
          cancel();
          return;
        }
      }
      if (last) {
        const { position: at, min: lo, max: hi } = latest.current;
        const outcome = engine.release(movement[0], signedVelocity(velocity[0], direction[0]), { position: at, min: lo, max: hi });
        if (outcome.kind === "shift") {
          stop();
          // The new day's content animates in (translateX(dir * 28px) + opacity, 380ms) on the consumer side.
          offset.set(0);
          latest.current.onShift(outcome.dir);
          return;
        }
        settle(outcome.kind === "bounce" ? outcome.dir : null);
        return;
      }
      const result = engine.move(movement[0], movement[1]);
      if (result.axis === "y") {
        cancel();
        settle(null);
        return;
      }
      if (result.display !== null) offset.set(result.display);
    },
    { enabled, filterTaps: true }
  );

  useEffect(
    () => () => {
      animation.current?.stop();
      engine.dispose();
    },
    [engine]
  );

  const bind = useCallback(() => ({ ...(enabled ? dragBind() : {}), style: { touchAction: "pan-y" } }), [enabled, dragBind]);

  return { bind, offset };
}
