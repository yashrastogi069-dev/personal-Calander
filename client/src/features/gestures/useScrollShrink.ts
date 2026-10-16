// D3.5 section 2.2: the phone bar shrinks while scrolling down and expands on the way back.
// `ScrollShrinkTracker` holds the rules (thresholds with hysteresis, state flips only at thresholds,
// never per frame) as a plain class tested in node. `useScrollShrink` feeds it from framer's useScroll
// and publishes --pn-bar-clear on <html> for the Focus dock, toasts and the calendar block tray.
//
// Button alternative: none needed. Shrinking hides labels only; every item stays a 44px target and a tap on
// a shrunk item performs its normal action. `expand()` is for "tap the active tab" (G8).
import { useMotionValueEvent, useReducedMotionConfig, useScroll } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";

export type BarState = "rest" | "shrunk";

/** Spec 2.2 numbers, px. */
export const SCROLL_SHRINK = {
  /** Shrink only once scrollY is above this... */
  minScrollY: 96,
  /** ...and the page travelled this far down since the last direction change. */
  shrinkTravel: 48,
  /** Upward travel that expands. */
  expandTravel: 12,
  /** Near the top: always rest. */
  topY: 8,
  /** Within this of the document bottom: always rest. */
  bottomSlack: 4,
  /** visualViewport height under this share of the window means the on-screen keyboard is open. */
  keyboardRatio: 0.75,
} as const;

/** --pn-bar-clear values (the consumer adds env(safe-area-inset-bottom)). */
export const BAR_CLEAR = { rest: "76px", shrunk: "64px", hidden: "0px" } as const;

export type ScrollShrinkInput = {
  y: number;
  /** Largest reachable scrollY (scrollHeight - viewport height). */
  maxY: number;
  /** A sheet, the More launcher or the quick menu is open: no change. */
  suspended?: boolean;
  /** Keyboard or VoiceOver focus is inside the bar: stay at rest. */
  focusInside?: boolean;
  /** prefers-reduced-motion: the bar never shrinks. */
  reducedMotion?: boolean;
};

export class ScrollShrinkTracker {
  private state: BarState = "rest";
  private lastY: number | null = null;
  private anchorY = 0;
  private direction: -1 | 0 | 1 = 0;

  get current(): BarState {
    return this.state;
  }

  /** Forces rest and restarts travel measurement from `y` (G8, focus, sheet closed). */
  expand(y?: number): BarState {
    this.state = "rest";
    if (y !== undefined) {
      this.lastY = y;
      this.anchorY = y;
    }
    this.direction = 0;
    return this.state;
  }

  update(input: ScrollShrinkInput): BarState {
    const { y, maxY } = input;
    const previous = this.lastY ?? y;
    this.lastY = y;
    const delta = y - previous;
    const direction: -1 | 0 | 1 = delta > 0 ? 1 : delta < 0 ? -1 : 0;
    if (direction !== 0 && direction !== this.direction) {
      this.direction = direction;
      this.anchorY = previous;
    }

    if (input.reducedMotion) return (this.state = "rest");
    if (input.suspended) return this.state;
    if (input.focusInside) return (this.state = "rest");
    if (y < SCROLL_SHRINK.topY) return (this.state = "rest");
    if (maxY > 0 && y >= maxY - SCROLL_SHRINK.bottomSlack) return (this.state = "rest");

    if (this.direction === 1 && y > SCROLL_SHRINK.minScrollY && y - this.anchorY >= SCROLL_SHRINK.shrinkTravel) {
      this.state = "shrunk";
    } else if (this.direction === -1 && this.anchorY - y >= SCROLL_SHRINK.expandTravel) {
      this.state = "rest";
    }
    return this.state;
  }
}

/** True when the visual viewport is short enough that the on-screen keyboard must be open. */
export function keyboardLikelyOpen(visualHeight: number | undefined, windowHeight: number): boolean {
  if (!visualHeight || !windowHeight) return false;
  return visualHeight < windowHeight * SCROLL_SHRINK.keyboardRatio;
}

export type UseScrollShrinkOptions = {
  /** Default true. False keeps the bar at rest (desktop, tablet). */
  enabled?: boolean;
  /** A sheet, the More launcher or the quick menu is open: the bar keeps its current state. */
  suspended?: boolean;
};

export type UseScrollShrink = {
  state: BarState;
  /** Force rest (tap on the active tab, G8). */
  expand(): void;
  /** On-screen keyboard open: the bar should hide; --pn-bar-clear is 0px meanwhile. */
  keyboardOpen: boolean;
  /** Spread on the bar's <nav>: focus inside expands and keeps it expanded. */
  focusProps: { onFocus(event: FocusEvent<HTMLElement>): void; onBlur(event: FocusEvent<HTMLElement>): void };
};

function maxScrollY(): number {
  if (typeof document === "undefined" || typeof window === "undefined") return 0;
  const element = document.scrollingElement ?? document.documentElement;
  return Math.max(0, element.scrollHeight - window.innerHeight);
}

export function useScrollShrink(options: UseScrollShrinkOptions = {}): UseScrollShrink {
  const { enabled = true, suspended = false } = options;
  const reducedMotion = useReducedMotionConfig() === true;
  const { scrollY } = useScroll();
  const [tracker] = useState(() => new ScrollShrinkTracker());
  const [state, setState] = useState<BarState>("rest");
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const focusInside = useRef(false);
  const flags = useRef({ enabled, suspended, reducedMotion });
  flags.current = { enabled, suspended, reducedMotion };

  const publish = useCallback((next: BarState) => setState(current => (current === next ? current : next)), []);

  useMotionValueEvent(scrollY, "change", y => {
    const { enabled: on, suspended: paused, reducedMotion: reduced } = flags.current;
    publish(tracker.update({ y, maxY: maxScrollY(), suspended: paused, focusInside: focusInside.current, reducedMotion: reduced || !on }));
  });

  // Disabling or switching reduced motion on returns to rest at once.
  useEffect(() => {
    if (!enabled || reducedMotion) publish(tracker.expand());
  }, [enabled, reducedMotion, tracker, publish]);

  // On-screen keyboard: visualViewport shorter than 75% of the window.
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.visualViewport) return;
    const viewport = window.visualViewport;
    const check = () => setKeyboardOpen(keyboardLikelyOpen(viewport.height, window.innerHeight));
    check();
    viewport.addEventListener("resize", check);
    return () => viewport.removeEventListener("resize", check);
  }, [enabled]);

  // --pn-bar-clear for everything docked above the bar.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const value = keyboardOpen ? BAR_CLEAR.hidden : state === "shrunk" ? BAR_CLEAR.shrunk : BAR_CLEAR.rest;
    root.style.setProperty("--pn-bar-clear", value);
  }, [state, keyboardOpen]);
  useEffect(
    () => () => {
      if (typeof document !== "undefined") document.documentElement.style.removeProperty("--pn-bar-clear");
    },
    []
  );

  const expand = useCallback(() => {
    publish(tracker.expand(typeof window === "undefined" ? undefined : window.scrollY));
  }, [tracker, publish]);

  const focusProps = {
    onFocus: () => {
      focusInside.current = true;
      publish(tracker.expand());
    },
    onBlur: (event: FocusEvent<HTMLElement>) => {
      const next = event.relatedTarget as Node | null;
      if (next && event.currentTarget.contains(next)) return;
      focusInside.current = false;
    },
  };

  return { state: enabled && !reducedMotion ? state : "rest", expand, keyboardOpen, focusProps };
}
