// D3.5 G1 to G3: row swipe (right = complete, left partial = reveal Tomorrow / Pick date, left full =
// reschedule). Spec 2026-10-14-premium-redesign-d3-5-iphone-nav.md sections 3, 4 and 5.1.
//
// `SwipeRowEngine` holds every rule as a plain class (no React, no DOM) so it is unit-tested in node,
// the same split as useTaskDnd.ts. `useSwipeRow` wires it to @use-gesture/react and framer-motion.
//
// Button alternatives (the gesture is never the only path):
//   complete   -> the row's check button
//   reschedule -> the More menu items "Move to tomorrow" / "Pick a date", and the two revealed buttons,
//                 which call `press("reschedule")` (Tomorrow) or `close()` then open the picker (Pick date).
// No haptics (iPhone Safari has no Vibration API): "armed" is the visible state for a crossed threshold.
import { useDrag } from "@use-gesture/react";
import {
  animate,
  useMotionValue,
  useReducedMotionConfig,
  useTransform,
  type AnimationPlaybackControls,
  type MotionValue,
} from "framer-motion";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EASE_OUT, MOTION_MS } from "@/design/motion";
import { claimGesture, ownsGesture, releaseGesture } from "./gestureOwner";
import {
  GESTURE,
  ROW_SPRING,
  isGestureOptOut,
  isGesturePointer,
  lockAxis,
  resolveRowRelease,
  rowArmedSide,
  rowDisplayOffset,
  rowProgress,
  signedVelocity,
  startsInEdgeGuard,
  viewportWidth,
  type GestureAxis,
  type RowSide,
} from "./swipeMath";

export type SwipeRowPhase = "idle" | "drag" | "armed" | "revealed" | "refused";
export type SwipeCommitHow = "full" | "button";

export type SwipeRowCallbacks = {
  /** Refusal reason (shown to the user) or null when the side may commit. */
  canCommit(side: RowSide): string | null;
  onCommit(side: RowSide, how: SwipeCommitHow): void;
  /** Optional: show the refusal text (toast or inline). The reason is also on the snapshot. */
  onRefuse?(side: RowSide, reason: string): void;
};

export type SwipeRowSnapshot = {
  phase: SwipeRowPhase;
  /** Side that is armed (drag) or was refused; null otherwise. */
  side: RowSide | null;
  /** Last refusal reason, kept until the next gesture starts. */
  refusal: string | null;
};

/** Where the row should travel after a release or button: `nudge` adds the 12px refusal bounce. */
export type SwipeSettle = { to: number; nudge: number };

const idleSnapshot: SwipeRowSnapshot = { phase: "idle", side: null, refusal: null };

/** Module registry: only one row is revealed at a time. */
let openRow: SwipeRowEngine | null = null;

export class SwipeRowEngine {
  private snapshot: SwipeRowSnapshot = idleSnapshot;
  private listeners = new Set<() => void>();
  private axis: GestureAxis = "pending";
  private base = 0;
  private width = 0;
  private active = false;
  private refusedTimer: ReturnType<typeof setTimeout> | null = null;
  readonly token = Symbol("swipe-row");

  constructor(private callbacks: SwipeRowCallbacks, private onExternalClose?: (settle: SwipeSettle) => void) {}

  setCallbacks(callbacks: SwipeRowCallbacks) {
    this.callbacks = callbacks;
  }

  setExternalClose(handler: ((settle: SwipeSettle) => void) | undefined) {
    this.onExternalClose = handler;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private set(next: SwipeRowSnapshot) {
    if (next.phase === this.snapshot.phase && next.side === this.snapshot.side && next.refusal === this.snapshot.refusal) return;
    this.snapshot = next;
    this.listeners.forEach(listener => listener());
  }

  /** The offset the row rests at before a gesture (0, or the revealed position). */
  restingOffset(): number {
    return this.snapshot.phase === "revealed" ? GESTURE.row.revealRestPx : 0;
  }

  /**
   * Starts a gesture. Returns false (and the caller cancels) for a mouse, an edge-guard start or an
   * opted-out target. `allowMouse` is for desktop testing only.
   */
  start(input: { pointerType?: string; startX: number; viewportWidth: number; width: number; optOut?: boolean; allowMouse?: boolean }): boolean {
    if (!isGesturePointer(input.pointerType, input.allowMouse)) return false;
    if (input.optOut) return false;
    if (startsInEdgeGuard(input.startX, input.viewportWidth)) return false;
    this.clearRefusedTimer();
    this.axis = "pending";
    this.base = this.restingOffset();
    this.width = input.width;
    this.active = true;
    if (this.snapshot.refusal || this.snapshot.phase === "refused") {
      this.set({ phase: this.base ? "revealed" : "idle", side: null, refusal: null });
    }
    return true;
  }

  /**
   * Movement since the start. Returns the axis decision and, once horizontal, the display offset.
   * "y" means the caller cancels and the browser scrolls.
   */
  move(dx: number, dy: number): { axis: GestureAxis; display: number | null } {
    if (!this.active) return { axis: this.axis, display: null };
    if (this.axis === "pending") {
      this.axis = lockAxis(dx, dy);
      if (this.axis === "y") {
        this.abandon();
        return { axis: "y", display: null };
      }
      if (this.axis === "x" && !claimGesture("row", this.token)) {
        this.abandon();
        return { axis: "y", display: null };
      }
    }
    if (this.axis !== "x") return { axis: this.axis, display: null };
    if (!ownsGesture(this.token)) {
      this.abandon();
      return { axis: "y", display: null };
    }
    const offset = this.base + dx;
    const armed = rowArmedSide(offset, this.width);
    this.set({ phase: armed ? "armed" : "drag", side: armed, refusal: null });
    return { axis: "x", display: rowDisplayOffset(offset, this.width) };
  }

  /** Releases with movement `dx` and signed velocity (px/ms). Returns where the row should settle. */
  release(dx: number, velocity: number): SwipeSettle {
    if (!this.active || this.axis !== "x") {
      this.active = false;
      return { to: this.restingOffset(), nudge: 0 };
    }
    this.active = false;
    releaseGesture(this.token);
    const offset = this.base + dx;
    const outcome = resolveRowRelease(offset, velocity, this.width);
    if (outcome === "complete" || outcome === "reschedule") return this.commit(outcome, "full");
    if (outcome === "reveal") return this.reveal();
    return this.close();
  }

  /** Button path: the revealed Tomorrow button, or any visible button that wants the same rules. */
  press(side: RowSide): SwipeSettle {
    return this.commit(side, "button");
  }

  /** Closes the revealed row (tap elsewhere, scroll, Escape, an action ran, another row opened). */
  close(): SwipeSettle {
    this.active = false;
    releaseGesture(this.token);
    if (openRow === this) openRow = null;
    if (this.snapshot.phase !== "refused") this.set({ phase: "idle", side: null, refusal: this.snapshot.refusal });
    return { to: 0, nudge: 0 };
  }

  /** Abandoned to the scroll (vertical lock, preempted): back to where it was, no state change. */
  private abandon() {
    this.active = false;
    this.axis = "y";
    releaseGesture(this.token);
    if (this.snapshot.phase === "drag" || this.snapshot.phase === "armed") {
      this.set({ phase: this.base ? "revealed" : "idle", side: null, refusal: null });
    }
  }

  private reveal(): SwipeSettle {
    if (openRow && openRow !== this) {
      const other = openRow;
      openRow = null;
      const settle = other.close();
      other.onExternalClose?.(settle);
    }
    openRow = this;
    this.set({ phase: "revealed", side: "reschedule", refusal: null });
    return { to: GESTURE.row.revealRestPx, nudge: 0 };
  }

  private commit(side: RowSide, how: SwipeCommitHow): SwipeSettle {
    const reason = this.callbacks.canCommit(side);
    if (reason) {
      if (openRow === this) openRow = null;
      this.set({ phase: "refused", side, refusal: reason });
      this.callbacks.onRefuse?.(side, reason);
      this.clearRefusedTimer();
      this.refusedTimer = setTimeout(() => {
        this.refusedTimer = null;
        if (this.snapshot.phase === "refused") this.set({ phase: "idle", side: null, refusal: reason });
      }, MOTION_MS.pop);
      const nudge = side === "complete" ? GESTURE.row.refusalNudgePx : -GESTURE.row.refusalNudgePx;
      return { to: 0, nudge };
    }
    if (openRow === this) openRow = null;
    this.set({ phase: "idle", side: null, refusal: null });
    this.callbacks.onCommit(side, how);
    return { to: 0, nudge: 0 };
  }

  private clearRefusedTimer() {
    if (this.refusedTimer) clearTimeout(this.refusedTimer);
    this.refusedTimer = null;
  }

  dispose() {
    this.clearRefusedTimer();
    this.active = false;
    releaseGesture(this.token);
    if (openRow === this) openRow = null;
  }
}

/** Test helper: the row currently revealed, if any. */
export function currentOpenSwipeRow(): SwipeRowEngine | null {
  return openRow;
}

export type UseSwipeRowOptions = SwipeRowCallbacks & {
  enabled: boolean;
  /** Desktop testing only: let a mouse drag the row. Default false (mouse keeps buttons and menus). */
  allowMouse?: boolean;
};

export type UseSwipeRow = {
  /** Spread on the row's moving container: drag handlers, `touch-action: pan-y`, `data-swipe-phase`. */
  bind: () => Record<string, unknown>;
  /** Row translateX. Follows the finger 1:1 (damped at the ends); springs to rest on release. */
  x: MotionValue<number>;
  /** 0..1 of each commit threshold, derived from `x`, for the underlay's saturation and glyph scale. */
  progress: { complete: MotionValue<number>; reschedule: MotionValue<number> };
  phase: SwipeRowPhase;
  /** Armed or refused side. */
  side: RowSide | null;
  /** Last refusal reason, for inline text; cleared when the next gesture starts. */
  refusal: string | null;
  /** Button path with the same rules as the gesture (revealed Tomorrow button). */
  press(side: RowSide): void;
  close(): void;
};

/**
 * Row swipe hook. Mounting notes: the revealed buttons must carry `data-no-gesture` (so a tap on them is a
 * click, not a drag start), and the underlay stays `aria-hidden` + `inert` unless `phase === "revealed"`.
 */
export function useSwipeRow(options: UseSwipeRowOptions): UseSwipeRow {
  const { enabled, allowMouse = false, canCommit, onCommit, onRefuse } = options;
  const reducedMotion = useReducedMotionConfig() === true;
  const x = useMotionValue(0);
  const widthRef = useRef(0);
  const elementRef = useRef<HTMLElement | null>(null);
  const animationRef = useRef<AnimationPlaybackControls | null>(null);
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const [engine] = useState(() => new SwipeRowEngine({ canCommit, onCommit, onRefuse }));
  engine.setCallbacks({ canCommit, onCommit, onRefuse });
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

  const progressFor = useCallback((value: number) => rowProgress(value, widthRef.current || 1), []);
  const complete = useTransform(x, (value: number) => progressFor(value).complete);
  const reschedule = useTransform(x, (value: number) => progressFor(value).reschedule);

  const stopAnimation = useCallback(() => {
    animationRef.current?.stop();
    animationRef.current = null;
  }, []);

  const settle = useCallback(
    (target: { to: number; nudge: number }) => {
      stopAnimation();
      if (reducedRef.current) {
        x.set(target.to);
        return;
      }
      const controls = animate(x, target.to, ROW_SPRING);
      animationRef.current = controls;
      if (target.nudge) {
        controls.then(() => {
          if (animationRef.current !== controls) return;
          animationRef.current = animate(x, [target.to, target.to + target.nudge, target.to], {
            duration: MOTION_MS.pop / 1000,
            ease: EASE_OUT,
          });
        });
      }
    },
    [stopAnimation, x]
  );

  useEffect(() => {
    engine.setExternalClose(settle);
    return () => engine.setExternalClose(undefined);
  }, [engine, settle]);

  const close = useCallback(() => settle(engine.close()), [engine, settle]);
  const press = useCallback((side: RowSide) => settle(engine.press(side)), [engine, settle]);

  const dragBind = useDrag(
    state => {
      const { first, last, tap, movement, velocity, direction, initial, event, cancel } = state;
      if (first) {
        stopAnimation();
        const target = event.currentTarget as HTMLElement | null;
        if (target && typeof target.getBoundingClientRect === "function") {
          elementRef.current = target;
          widthRef.current = target.getBoundingClientRect().width;
        }
        const ok = engine.start({
          pointerType: (event as PointerEvent).pointerType,
          startX: initial[0],
          viewportWidth: viewportWidth(),
          width: widthRef.current,
          optOut: isGestureOptOut(event.target),
          allowMouse,
        });
        if (!ok) {
          cancel();
          return;
        }
      }
      if (last) {
        if (tap) {
          // A tap on a revealed row (not on its buttons, which opt out) closes it.
          if (engine.getSnapshot().phase === "revealed") close();
          else engine.release(0, 0);
          return;
        }
        settle(engine.release(movement[0], signedVelocity(velocity[0], direction[0])));
        return;
      }
      const result = engine.move(movement[0], movement[1]);
      if (result.axis === "y") {
        cancel();
        settle({ to: engine.restingOffset(), nudge: 0 });
        return;
      }
      if (result.display !== null) x.set(result.display);
    },
    { enabled, filterTaps: true }
  );

  // Close a revealed row on scroll, Escape or a press outside it.
  useEffect(() => {
    if (snapshot.phase !== "revealed" || typeof window === "undefined") return;
    const onScroll = () => close();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      const element = elementRef.current;
      if (element && event.target instanceof Node && element.contains(event.target)) return;
      close();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [snapshot.phase, close]);

  // Disabling (sheet opened, row became pending) closes the row.
  useEffect(() => {
    if (!enabled && engine.getSnapshot().phase === "revealed") close();
  }, [enabled, engine, close]);

  useEffect(
    () => () => {
      animationRef.current?.stop();
      engine.dispose();
    },
    [engine]
  );

  const bind = useCallback(
    () => ({
      ...(enabled ? dragBind() : {}),
      style: { touchAction: "pan-y" },
      "data-swipe-phase": snapshot.phase,
    }),
    [enabled, dragBind, snapshot.phase]
  );

  return {
    bind,
    x,
    progress: { complete, reschedule },
    phase: snapshot.phase,
    side: snapshot.side,
    refusal: snapshot.refusal,
    press,
    close,
  };
}
