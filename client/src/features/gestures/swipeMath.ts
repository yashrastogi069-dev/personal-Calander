// D3.5 gesture maths (spec 2026-10-14-premium-redesign-d3-5-iphone-nav.md, section 3).
// Pure functions and the numbers they use, so every threshold is unit-tested in node. The hooks in this
// folder only read these; no hook hard-codes a gesture number.

/** Every number from spec section 3, in px and px/ms. */
export const GESTURE = {
  /** Axis is decided once, after this much movement on either axis. */
  axisLockPx: 10,
  /** Horizontal wins only when |dx| >= |dy| * ratio (same ratio as resolveMobileTaskGesture). */
  axisRatio: 1.35,
  /** Ignore gestures that start this close to the left or right screen edge (Safari back swipe). */
  edgeGuardPx: 20,
  row: {
    /** G1 complete: dx >= max(88px, 28% of the row width). */
    completeMinPx: 88,
    completeFraction: 0.28,
    /** G1 complete by flick: velocity >= 0.55 px/ms with at least 40px of travel. */
    completeVelocity: 0.55,
    flickMinPx: 40,
    /** Rightward travel past this is log-damped. */
    resistanceStartPx: 140,
    /** G2 partial left: released past -56px reveals the two buttons. */
    revealMinPx: 56,
    /** G2 rest position: two 84px buttons. */
    revealRestPx: -168,
    /** G3 full left: dx <= -(60% of the row width), or a leftward flick >= 0.7 px/ms. */
    rescheduleFraction: 0.6,
    rescheduleVelocity: 0.7,
    /** Leftward travel past this fraction of the width is log-damped. */
    leftResistanceFraction: 0.75,
    /** Refusal nudge (spec section 4: "nudge 12px and back"). */
    refusalNudgePx: 12,
  },
  day: {
    /** G4/G5 commit: dx >= 72px, or velocity >= 0.45 px/ms with dx >= 40px. */
    commitPx: 72,
    commitVelocity: 0.45,
    flickMinPx: 40,
    /** Content follows the finger at 0.4x, capped at 40px. */
    followRatio: 0.4,
    followMaxPx: 40,
    /** Clamped ends bounce this far. */
    bouncePx: 8,
  },
  pull: {
    /** G9: a raw pull of 140px arms the refresh (84px displayed after 0.6 resistance). */
    armRawPx: 140,
    resistance: 0.6,
    armDisplayPx: 84,
  },
  longPress: {
    /** G6: hold 450ms with less than 8px of movement. */
    delayMs: 450,
    tolerancePx: 8,
  },
} as const;

/** Spring for row settle / snap back (spec section 4: stiffness 380, damping 34, about 320ms). */
export const ROW_SPRING = { type: "spring", stiffness: 380, damping: 34 } as const;

export type GestureAxis = "pending" | "x" | "y";

/**
 * Locks the axis once either axis has moved `axisLockPx`. Horizontal only when |dx| >= |dy| * 1.35;
 * anything else is vertical, so the browser keeps the scroll.
 */
export function lockAxis(dx: number, dy: number): GestureAxis {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ax < GESTURE.axisLockPx && ay < GESTURE.axisLockPx) return "pending";
  return ax >= ay * GESTURE.axisRatio ? "x" : "y";
}

/** True when a touch starts inside the left or right edge guard. */
export function startsInEdgeGuard(startX: number, viewportWidth: number): boolean {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) return false;
  return startX < GESTURE.edgeGuardPx || startX > viewportWidth - GESTURE.edgeGuardPx;
}

/** Mouse keeps buttons and menus; only touch and pen gesture (spec section 3). */
export function isGesturePointer(pointerType: string | undefined, allowMouse = false): boolean {
  if (pointerType === "mouse") return allowMouse;
  return pointerType === "touch" || pointerType === "pen";
}

/**
 * Log damping beyond `limit` (same family as `dampUpward` in design/motion.ts). Identity up to the limit,
 * then monotonic and ever slower. Symmetric for negative input.
 */
export function dampBeyond(offset: number, limit: number, softness = 32): number {
  const sign = offset < 0 ? -1 : 1;
  const magnitude = Math.abs(offset);
  if (magnitude <= limit) return offset;
  return sign * (limit + softness * Math.log1p((magnitude - limit) / softness));
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

// ---- Row swipe (G1 to G3) -------------------------------------------------------------------------------

export function rowCompleteThreshold(width: number): number {
  return Math.max(GESTURE.row.completeMinPx, GESTURE.row.completeFraction * Math.max(0, width));
}

export function rowRescheduleThreshold(width: number): number {
  // Never closer than the revealed rest position, so a partial swipe can always rest.
  return Math.max(-GESTURE.row.revealRestPx + 1, GESTURE.row.rescheduleFraction * Math.max(0, width));
}

/** What the row shows while the finger is at `offset` (1:1, damped at both ends). */
export function rowDisplayOffset(offset: number, width: number): number {
  if (offset >= 0) return dampBeyond(offset, GESTURE.row.resistanceStartPx);
  const leftLimit = Math.max(-GESTURE.row.revealRestPx, GESTURE.row.leftResistanceFraction * Math.max(0, width));
  return dampBeyond(offset, leftLimit);
}

/** 0..1 progress towards each commit threshold, for the underlay. */
export function rowProgress(offset: number, width: number): { complete: number; reschedule: number } {
  return {
    complete: offset > 0 ? clamp01(offset / rowCompleteThreshold(width)) : 0,
    reschedule: offset < 0 ? clamp01(-offset / rowRescheduleThreshold(width)) : 0,
  };
}

export type RowSide = "complete" | "reschedule";

/** Which side is armed while dragging (distance only; a flick can still commit on release). */
export function rowArmedSide(offset: number, width: number): RowSide | null {
  if (offset >= rowCompleteThreshold(width)) return "complete";
  if (offset <= -rowRescheduleThreshold(width)) return "reschedule";
  return null;
}

export type RowRelease = "complete" | "reschedule" | "reveal" | "rest";

/**
 * Resolves a released row. `offset` is the raw (undamped) total offset including any revealed base;
 * `velocity` is signed px/ms (positive = rightwards).
 * A leftward flick only counts once the row is past the reveal distance, so a tiny flick never reschedules.
 */
export function resolveRowRelease(offset: number, velocity: number, width: number): RowRelease {
  const row = GESTURE.row;
  if (offset >= rowCompleteThreshold(width)) return "complete";
  if (offset >= row.flickMinPx && velocity >= row.completeVelocity) return "complete";
  if (offset <= -rowRescheduleThreshold(width)) return "reschedule";
  if (offset <= -row.revealMinPx && velocity <= -row.rescheduleVelocity) return "reschedule";
  if (offset <= -row.revealMinPx) return "reveal";
  return "rest";
}

// ---- Day swipe (G4, G5) ---------------------------------------------------------------------------------

/** Content follows the finger at 0.4x, capped at 40px either way. */
export function dayFollowOffset(dx: number): number {
  const follow = dx * GESTURE.day.followRatio;
  return Math.max(-GESTURE.day.followMaxPx, Math.min(GESTURE.day.followMaxPx, follow));
}

/** Left (negative dx) = next day (+1), right = previous day (-1), null = spring back. */
export function resolveDaySwipe(dx: number, velocity: number): -1 | 1 | null {
  const day = GESTURE.day;
  const distance = Math.abs(dx);
  const speed = Math.abs(velocity);
  const commits = distance >= day.commitPx || (distance >= day.flickMinPx && speed >= day.commitVelocity);
  if (!commits) return null;
  // A flick against the drag direction does not commit.
  if (velocity !== 0 && Math.sign(velocity) !== Math.sign(dx) && distance < day.commitPx) return null;
  return dx < 0 ? 1 : -1;
}

/** True when shifting by `dir` from `position` stays inside [min, max]. */
export function dayShiftAllowed(position: number, dir: -1 | 1, min = -Infinity, max = Infinity): boolean {
  const next = position + dir;
  return next >= min && next <= max;
}

// ---- Pull to refresh (G9) -------------------------------------------------------------------------------

/** Displayed pull distance: 0.6 resistance, then log damping past the armed point. */
export function pullDisplayOffset(raw: number): number {
  if (raw <= 0) return 0;
  return dampBeyond(raw * GESTURE.pull.resistance, GESTURE.pull.armDisplayPx);
}

export function pullProgress(raw: number): number {
  return clamp01(raw / GESTURE.pull.armRawPx);
}

export function pullArmed(raw: number): boolean {
  return raw >= GESTURE.pull.armRawPx;
}

// ---- Shared helpers -------------------------------------------------------------------------------------

/** Signed velocity from use-gesture's absolute velocity and direction vectors. */
export function signedVelocity(absoluteVelocity: number, direction: number): number {
  if (!Number.isFinite(absoluteVelocity) || !Number.isFinite(direction) || direction === 0) return 0;
  return Math.abs(absoluteVelocity) * Math.sign(direction);
}

/** True when the event target sits inside an element that opted out with `data-no-gesture`. */
export function isGestureOptOut(target: EventTarget | null | undefined): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null | undefined;
  return typeof element?.closest === "function" && element.closest("[data-no-gesture]") !== null;
}

/** Viewport width without touching `window` during SSR. */
export function viewportWidth(): number {
  return typeof window === "undefined" ? 0 : window.innerWidth;
}
