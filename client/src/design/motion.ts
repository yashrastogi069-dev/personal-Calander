// Shared motion helpers for the premium redesign. CSS owns most motion (tokens-v2.css);
// these cover the few cases that need JS: state-change triggers and framer-motion configs.
// framer-motion honours prefers-reduced-motion through the app-level <MotionConfig reducedMotion="user">.
import { useEffect, useRef, useState } from "react";

/**
 * Mirrors the motion tokens in tokens-v2.css (milliseconds). motion.test.ts fails if the two drift.
 * Taps stay crisp; entrances are visibly slower; data motion (count-ups, rings, bars) is long and gentle.
 */
export const MOTION_MS = {
  press: 120,
  fast: 160,
  base: 220,
  exit: 200,
  enter: 480,
  pop: 380,
  glide: 380,
  tick: 360,
  sheet: 500,
  data: 1300,
  dataDelay: 260,
  stagger: 70,
} as const;

/** Mirrors --pc-ease (strong ease-out) for framer-motion. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Mirrors --pc-ease-data (easeOutCubic) for CSS-side parity with easeOutCubic below. */
export const EASE_DATA = [0.33, 1, 0.68, 1] as const;

/** Shared-element glide for tab and nav indicators (mirrors --pc-dur-glide). */
export const GLIDE = { type: "tween", duration: MOTION_MS.glide / 1000, ease: EASE_OUT } as const;

/** Dialog / popover entrance (mirrors --pc-dur-enter). */
export const ENTER = { type: "tween", duration: MOTION_MS.enter / 1000, ease: EASE_OUT } as const;

/** Exits are quicker than entrances (mirrors --pc-dur-exit). */
export const EXIT = { type: "tween", duration: MOTION_MS.exit / 1000, ease: EASE_OUT } as const;

/** Mirrors --pc-ease-sheet (iOS sheet curve) for framer-motion. */
export const SHEET_EASE = [0.32, 0.72, 0, 1] as const;

/** Phone sheets and the pill-to-sheet move (mirrors --pc-dur-sheet). */
export const SHEET = { type: "tween", duration: MOTION_MS.sheet / 1000, ease: SHEET_EASE } as const;

/** Start time of a card's data motion: after the card's own rise, then one stagger step per card (cap 8). */
export function dataStartMs(cardIndex: number): number {
  return MOTION_MS.dataDelay + Math.min(Math.max(0, cardIndex), 8) * MOTION_MS.stagger;
}

/** Momentum threshold for flick-to-dismiss, in px per ms (Vaul / Emil Kowalski). */
export const DISMISS_VELOCITY = 0.11;

/**
 * True when a downward sheet drag should dismiss: a fast flick (≥0.11 px/ms) or a drag past
 * a quarter of the sheet's height. `velocityPxPerSecond` is framer-motion's info.velocity.y.
 */
export function shouldDismissSheet(offsetPx: number, velocityPxPerSecond: number, sheetHeightPx: number): boolean {
  if (offsetPx <= 0) return false;
  if (velocityPxPerSecond / 1000 >= DISMISS_VELOCITY) return true;
  return offsetPx >= Math.max(80, sheetHeightPx * 0.25);
}

/** Damped upward drag: the sheet moves less the further it is pulled past its rest position. */
export function dampUpward(offsetPx: number): number {
  if (offsetPx >= 0) return offsetPx;
  return -8 * Math.log1p(-offsetPx / 8);
}

/** framer-motion corrects border-radius during layout scale only for numeric radii, so these mirror the tokens. */
export const RADIUS = { control: 12, pill: 999 } as const;

/** True when the user asked for reduced motion, or when there is no window to ask (SSR, tests). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const easeOutQuart = (progress: number) => 1 - Math.pow(1 - progress, 4);

/** JS twin of --pc-ease-data, so a count-up and the ring or bar beside it travel together. */
export const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

/** A false-to-true transition: the only moment a completion should celebrate. */
export function becameTrue(previous: boolean, next: boolean): boolean {
  return !previous && next;
}

/**
 * True for `holdMs` after `value` flips from false to true while mounted. Never true on first
 * render, so records that load already complete do not replay their celebration.
 */
export function useBecameTrue(value: boolean, holdMs = 720): boolean {
  const previous = useRef(value);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const flipped = becameTrue(previous.current, value);
    previous.current = value;
    if (!flipped) {
      if (!value) setActive(false);
      return;
    }
    setActive(true);
    const timer = setTimeout(() => setActive(false), holdMs);
    return () => clearTimeout(timer);
  }, [value, holdMs]);
  return active;
}

/**
 * Counts how many times `value` changed after mount (0 on first render). Use it as a React key
 * with a class that is only applied when it is above zero, so a change replays a CSS animation
 * but the first paint stays still.
 */
export function useChangeCount<T>(value: T): number {
  const previous = useRef(value);
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (Object.is(previous.current, value)) return;
    previous.current = value;
    setCount(current => current + 1);
  }, [value]);
  return count;
}
