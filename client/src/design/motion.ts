// Shared motion helpers for the premium redesign. CSS owns most motion (tokens-v2.css);
// these cover the few cases that need JS: state-change triggers and framer-motion configs.
// framer-motion honours prefers-reduced-motion through the app-level <MotionConfig reducedMotion="user">.
import { useEffect, useRef, useState } from "react";

/** Mirrors --pc-ease (strong ease-out) for framer-motion. */
export const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Shared-element glide for tab and nav indicators (mirrors --pc-dur-base). */
export const GLIDE = { type: "tween", duration: 0.24, ease: EASE_OUT } as const;

/** framer-motion corrects border-radius during layout scale only for numeric radii, so these mirror the tokens. */
export const RADIUS = { control: 12, pill: 999 } as const;

/** True when the user asked for reduced motion, or when there is no window to ask (SSR, tests). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const easeOutQuart = (progress: number) => 1 - Math.pow(1 - progress, 4);

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
