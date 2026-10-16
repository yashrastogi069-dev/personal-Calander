// D3.5 G9: pull to refresh on the window scroll (phone scroll owner is the document, spec 1.9).
// Native non-passive touch listeners, not use-gesture: preventDefault runs only while a pull is live at
// scrollTop <= 0, so ordinary scrolling is never blocked. `PullToRefreshEngine` holds every rule as a plain
// class (no React, no DOM) and is unit-tested in node.
//
// Button alternative: "Refresh data" in the More launcher runs the same `onRefresh`; reload also works.
// No haptics: crossing the armed point is shown by `phase === "armed"` and the "Release to refresh" text.
import { animate, useMotionValue, useReducedMotionConfig, type AnimationPlaybackControls, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EASE_OUT, MOTION_MS } from "@/design/motion";
import { claimGesture, ownsGesture, releaseGesture } from "./gestureOwner";
import {
  GESTURE,
  isGestureOptOut,
  lockAxis,
  pullArmed,
  pullDisplayOffset,
  pullProgress,
  startsInEdgeGuard,
  type GestureAxis,
} from "./swipeMath";

export type PullPhase = "idle" | "pulling" | "armed" | "refreshing" | "done" | "refused";

export type PullSnapshot = { phase: PullPhase; message: string | null };

/** Spec section 4 timings for the ring. */
export const PULL_TIMING = {
  /** The refreshing state shows for at least this long, so a fast refresh still reads. */
  minRefreshingMs: 700,
  /** "Updated" holds this long before collapsing. */
  doneHoldMs: 600,
  /** Refusal / failure message holds this long before collapsing. */
  refusedHoldMs: 2400,
  /** Collapse back to rest (--pc-dur-pop). */
  collapseMs: MOTION_MS.pop,
} as const;

export const PULL_MESSAGES = {
  pulling: "Pull to refresh",
  armed: "Release to refresh",
  refreshing: "Refreshing",
  done: "Updated",
  failed: "Couldn't refresh. Showing saved data.",
} as const;

export type PullCallbacks = {
  /** Refusal reason (offline, cached snapshot) or null. A refusal makes no network call. */
  canRefresh(): string | null;
  onRefresh(): Promise<void>;
};

const idle: PullSnapshot = { phase: "idle", message: null };

export class PullToRefreshEngine {
  private snapshot: PullSnapshot = idle;
  private listeners = new Set<() => void>();
  private tracking = false;
  private axis: GestureAxis = "pending";
  private raw = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  readonly token = Symbol("pull-to-refresh");

  constructor(private callbacks: PullCallbacks) {}

  setCallbacks(callbacks: PullCallbacks) {
    this.callbacks = callbacks;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private set(next: PullSnapshot) {
    if (this.disposed) return;
    if (next.phase === this.snapshot.phase && next.message === this.snapshot.message) return;
    this.snapshot = next;
    this.listeners.forEach(listener => listener());
  }

  /** True while a refresh, its result or its refusal is on screen: new pulls are ignored. */
  get busy(): boolean {
    return this.snapshot.phase === "refreshing" || this.snapshot.phase === "done" || this.snapshot.phase === "refused";
  }

  /** A touch starts. Only tracked when at the very top, one finger, outside the edge guard and opt-outs. */
  start(input: { scrollTop: number; startX: number; viewportWidth: number; touches: number; optOut?: boolean }): boolean {
    this.tracking = false;
    this.axis = "pending";
    this.raw = 0;
    if (this.busy || input.touches !== 1 || input.optOut) return false;
    if (input.scrollTop > 0) return false;
    if (startsInEdgeGuard(input.startX, input.viewportWidth)) return false;
    this.tracking = true;
    return true;
  }

  /**
   * Movement since the start. `preventDefault` is true only while this pull owns the gesture (the
   * listener then blocks the native rubber band). Horizontal or upward first movement abandons the pull.
   */
  move(dx: number, dy: number, touches = 1): { preventDefault: boolean; display: number; progress: number } {
    const none = { preventDefault: false, display: 0, progress: 0 };
    if (!this.tracking) return none;
    if (touches !== 1) return this.abandon();
    if (this.axis === "pending") {
      const axis = lockAxis(dx, dy);
      if (axis === "pending") return none;
      if (axis === "x" || dy <= 0 || !claimGesture("pull", this.token)) return this.abandon();
      this.axis = "y";
    }
    if (!ownsGesture(this.token)) return this.abandon();
    this.raw = Math.max(0, dy);
    this.set({ phase: pullArmed(this.raw) ? "armed" : "pulling", message: pullArmed(this.raw) ? PULL_MESSAGES.armed : PULL_MESSAGES.pulling });
    return { preventDefault: true, display: pullDisplayOffset(this.raw), progress: pullProgress(this.raw) };
  }

  private abandon() {
    this.tracking = false;
    this.raw = 0;
    releaseGesture(this.token);
    if (this.snapshot.phase === "pulling" || this.snapshot.phase === "armed") this.set(idle);
    return { preventDefault: false, display: 0, progress: 0 };
  }

  /** Finger lifted. Resolves when the whole refresh cycle (including the minimum show time) is over. */
  async release(): Promise<void> {
    if (!this.tracking) return;
    const armed = pullArmed(this.raw);
    this.tracking = false;
    this.raw = 0;
    releaseGesture(this.token);
    if (!armed) {
      this.set(idle);
      return;
    }
    await this.refresh();
  }

  /** Same path as the gesture, for the More launcher's "Refresh data" button. */
  async refresh(): Promise<void> {
    if (this.snapshot.phase === "refreshing") return;
    this.clearTimer();
    const reason = this.callbacks.canRefresh();
    if (reason) {
      this.set({ phase: "refused", message: reason });
      this.later(PULL_TIMING.refusedHoldMs);
      return;
    }
    this.set({ phase: "refreshing", message: PULL_MESSAGES.refreshing });
    const minimum = new Promise<void>(resolve => setTimeout(resolve, PULL_TIMING.minRefreshingMs));
    let failed = false;
    try {
      await Promise.all([this.callbacks.onRefresh(), minimum]);
    } catch {
      failed = true;
      await minimum;
    }
    if (this.disposed) return;
    if (failed) {
      this.set({ phase: "refused", message: PULL_MESSAGES.failed });
      this.later(PULL_TIMING.refusedHoldMs);
      return;
    }
    this.set({ phase: "done", message: PULL_MESSAGES.done });
    this.later(PULL_TIMING.doneHoldMs);
  }

  /** Touch cancelled by the browser: back to rest, no refresh. */
  cancel() {
    if (!this.tracking) return;
    this.abandon();
  }

  private later(ms: number) {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.set(idle);
    }, ms);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  dispose() {
    this.clearTimer();
    this.tracking = false;
    releaseGesture(this.token);
  }

  /** Re-arm after a StrictMode effect replay. */
  revive() {
    this.disposed = false;
  }

  markDisposed() {
    this.disposed = true;
  }
}

export type UsePullToRefreshOptions = PullCallbacks & {
  enabled: boolean;
  /** Scroll position of the owner. Defaults to the window (the phone scroll owner). */
  getScrollTop?: () => number;
};

export type UsePullToRefresh = {
  /** 0..1 of the armed distance; drives the ring's stroke-dashoffset. Animates back to 0 on collapse. */
  progress: MotionValue<number>;
  /** Displayed pull in px (0.6 resistance, damped past 84px), for the ring's translateY. */
  offset: MotionValue<number>;
  phase: PullPhase;
  /** Polite status text for `role="status"`: "Pull to refresh", "Release to refresh", "Refreshing", "Updated", or a reason. */
  message: string | null;
  /** The button path (More launcher "Refresh data"): same refusal and timing rules as the gesture. */
  refresh(): Promise<void>;
};

function windowScrollTop(): number {
  if (typeof window === "undefined") return 0;
  return window.scrollY || document.scrollingElement?.scrollTop || 0;
}

export function usePullToRefresh(options: UsePullToRefreshOptions): UsePullToRefresh {
  const { enabled, canRefresh, onRefresh, getScrollTop = windowScrollTop } = options;
  const reducedMotion = useReducedMotionConfig() === true;
  const progress = useMotionValue(0);
  const offset = useMotionValue(0);
  const [engine] = useState(() => new PullToRefreshEngine({ canRefresh, onRefresh }));
  engine.setCallbacks({ canRefresh, onRefresh });
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);
  const scrollTopRef = useRef(getScrollTop);
  scrollTopRef.current = getScrollTop;
  const animations = useRef<AnimationPlaybackControls[]>([]);

  const stop = () => {
    animations.current.forEach(controls => controls.stop());
    animations.current = [];
  };

  // Collapse to rest whenever the engine returns to idle (and hold the armed position while refreshing).
  useEffect(() => {
    if (snapshot.phase === "pulling" || snapshot.phase === "armed") return;
    stop();
    const restOffset = snapshot.phase === "idle" ? 0 : pullDisplayOffset(GESTURE.pull.armRawPx);
    const restProgress = snapshot.phase === "idle" ? 0 : 1;
    if (reducedMotion) {
      offset.set(restOffset);
      progress.set(restProgress);
      return;
    }
    const transition = { duration: PULL_TIMING.collapseMs / 1000, ease: EASE_OUT };
    animations.current = [animate(offset, restOffset, transition), animate(progress, restProgress, transition)];
  }, [snapshot.phase, reducedMotion, offset, progress]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let startX = 0;
    let startY = 0;
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      if (engine.start({ scrollTop: scrollTopRef.current(), startX, viewportWidth: window.innerWidth, touches: event.touches.length, optOut: isGestureOptOut(event.target) })) stop();
    };
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      const result = engine.move(touch.clientX - startX, touch.clientY - startY, event.touches.length);
      if (!result.preventDefault) return;
      if (event.cancelable) event.preventDefault();
      offset.set(result.display);
      progress.set(result.progress);
    };
    const onEnd = () => {
      void engine.release();
    };
    const onCancel = () => engine.cancel();
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
      engine.cancel();
    };
  }, [enabled, engine, offset, progress]);

  useEffect(() => {
    engine.revive();
    return () => {
      stop();
      engine.markDisposed();
      engine.dispose();
    };
  }, [engine]);

  return {
    progress,
    offset,
    phase: snapshot.phase,
    message: snapshot.message,
    refresh: () => engine.refresh(),
  };
}
