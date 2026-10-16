// Tasks T2b-2: the D3.5 row gestures mounted on Tasks (spec 2026-10-14 §3, G1-G3), on List rows and Inbox cards
// only, never on Board cards. A static host holds the underlay; the face (the visible row) follows the finger.
//   G1 swipe right    -> complete (the same check path as the row's check button; recurring resolves today's occurrence)
//   G2 partial left   -> rests open on two real buttons: Tomorrow and Pick date
//   G3 full left      -> plan for tomorrow (the board's day-drop rules; refusals nudge and say why)
// The gesture is never the only path: the check button and the More menu items do the same work.
// Long-press (phone) on the face enters select mode; it shares the pointer stream with the swipe and gives up
// as soon as the finger moves (8px), so a swipe never also selects.
import type { RowSide } from "@/features/gestures/swipeMath";
import { useLongPress } from "@/features/gestures/useLongPress";
import { useSwipeRow, type SwipeCommitHow } from "@/features/gestures/useSwipeRow";
import { cn } from "@/lib/utils";
import { motion, useTransform } from "framer-motion";
import { CalendarClock, CalendarDays, Check, Lock } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";

export type TaskSwipeConfig = {
  enabled: boolean;
  /** Refusal reason for a side, or null when it may commit. */
  canCommit: (side: RowSide) => string | null;
  onCommit: (side: RowSide, how: SwipeCommitHow) => void;
  onRefuse?: (side: RowSide, reason: string) => void;
  /** The revealed "Pick date" button. */
  onPickDate: () => void;
  /** Long-press (phone) enters select mode with this task. */
  onLongPress?: () => void;
  /** Desktop testing only. */
  allowMouse?: boolean;
};

type Handler = (event: never) => void;

/** Calls both handlers (gesture + long-press both listen to the same pointer stream). */
export function mergeHandlers<T extends Record<string, unknown>>(first: T, second: Record<string, unknown>): T {
  const merged: Record<string, unknown> = { ...second, ...first };
  for (const key of Object.keys(second)) {
    const a = first[key];
    const b = second[key];
    if (typeof a === "function" && typeof b === "function") {
      merged[key] = (event: never) => {
        (b as Handler)(event);
        (a as Handler)(event);
      };
    }
  }
  return merged as T;
}

const DISABLED: TaskSwipeConfig = { enabled: false, canCommit: () => null, onCommit: () => undefined, onPickDate: () => undefined };

/**
 * Host + underlay + moving face. `face` props (className, data attributes, key handlers) go on the moving
 * element, which keeps the row's visual styles; the host only positions the underlay.
 */
export function TaskSwipeFrame({
  as = "li",
  hostClassName,
  faceClassName,
  faceProps,
  swipe = DISABLED,
  children,
}: {
  as?: "li" | "div";
  hostClassName?: string;
  faceClassName?: string;
  faceProps?: HTMLAttributes<HTMLElement> & Record<string, unknown>;
  swipe?: TaskSwipeConfig;
  children: ReactNode;
}) {
  const row = useSwipeRow({
    enabled: swipe.enabled,
    allowMouse: swipe.allowMouse,
    canCommit: swipe.canCommit,
    onCommit: swipe.onCommit,
    onRefuse: swipe.onRefuse,
  });
  const press = useLongPress({ enabled: Boolean(swipe.enabled && swipe.onLongPress), onLongPress: () => swipe.onLongPress?.() });
  const completeOpacity = useTransform(row.progress.complete, value => (value > 0 ? 0.35 + value * 0.65 : 0));
  const rescheduleOpacity = useTransform(row.progress.reschedule, value => (value > 0 ? 0.35 + value * 0.65 : 0));
  const revealed = row.phase === "revealed";
  const refusedSide = row.phase === "refused" ? row.side : null;
  const armed = row.phase === "armed" ? row.side : null;
  const Host = as;

  const bound = row.bind() as Record<string, unknown>;
  const { style: bindStyle, ...bindRest } = bound as { style?: Record<string, unknown> } & Record<string, unknown>;
  const longPressHandlers = swipe.enabled && swipe.onLongPress
    ? { onPointerDown: press.onPointerDown, onPointerMove: press.onPointerMove, onPointerUp: press.onPointerUp, onPointerCancel: press.onPointerCancel, onContextMenu: press.onContextMenu, onClickCapture: press.onClickCapture }
    : {};
  const { style: faceStyle, className: _ignored, ...restFace } = (faceProps ?? {}) as { style?: Record<string, unknown>; className?: string } & Record<string, unknown>;
  const handlers = mergeHandlers(mergeHandlers(bindRest, longPressHandlers), restFace);

  return (
    <Host className={cn("tk-swipe-host", hostClassName)} data-swipe-host={swipe.enabled ? "on" : undefined}>
      {swipe.enabled ? (
        <div className={cn("tk-swipe-under", revealed && "is-revealed")} aria-hidden={revealed ? undefined : true} inert={revealed ? undefined : true}>
          <motion.div className={cn("tk-swipe-side is-complete", armed === "complete" && "is-armed", refusedSide === "complete" && "is-refused")} style={{ opacity: refusedSide === "complete" ? 1 : completeOpacity }}>
            {refusedSide === "complete" ? <Lock size={18} strokeWidth={2.25} aria-hidden="true" /> : <Check size={18} strokeWidth={2.5} aria-hidden="true" />}
            <span>{refusedSide === "complete" ? "Can't complete" : armed === "complete" ? "Release to complete" : "Done"}</span>
          </motion.div>
          <motion.div className={cn("tk-swipe-side is-reschedule", armed === "reschedule" && "is-armed", refusedSide === "reschedule" && "is-refused")} style={{ opacity: revealed || refusedSide === "reschedule" ? 1 : rescheduleOpacity }}>
            {revealed ? (
              <>
                <button type="button" className="tk-swipe-btn pc-focusable" data-no-gesture="" onClick={() => row.press("reschedule")}>
                  <CalendarClock size={18} strokeWidth={2.25} aria-hidden="true" /><span>Tomorrow</span>
                </button>
                <button type="button" className="tk-swipe-btn is-pick pc-focusable" data-no-gesture="" onClick={() => { row.close(); swipe.onPickDate(); }}>
                  <CalendarDays size={18} strokeWidth={2.25} aria-hidden="true" /><span>Pick date</span>
                </button>
              </>
            ) : (
              <>
                {refusedSide === "reschedule" ? <Lock size={18} strokeWidth={2.25} aria-hidden="true" /> : <CalendarClock size={18} strokeWidth={2.25} aria-hidden="true" />}
                <span>{refusedSide === "reschedule" ? "Can't move" : armed === "reschedule" ? "Release for tomorrow" : "Tomorrow"}</span>
              </>
            )}
          </motion.div>
        </div>
      ) : null}
      <motion.div
        {...(handlers as Record<string, unknown>)}
        className={cn(faceClassName, press.pressing && "is-pressing")}
        style={{ ...(faceStyle ?? {}), ...(bindStyle ?? {}), x: row.x }}
      >
        {children}
        {row.refusal && row.phase !== "revealed" ? <span className="pc-sr-only" role="status">{row.refusal}</span> : null}
      </motion.div>
    </Host>
  );
}
