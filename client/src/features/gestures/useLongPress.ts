// D3.5 G6: long-press on the bar tabs and `+` opens the quick menu (spec 2.4, 3).
// `LongPressEngine` is a plain class (timer + tolerance rules) tested in node; `useLongPress` returns
// pointer handlers to spread on the button.
//
// Button / keyboard alternative: the ContextMenu key or Shift+F10 on the focused item fires a
// `contextmenu` event, which `onContextMenu` turns into the same `onLongPress` (origin = the item's centre).
// Every quick-menu action also exists elsewhere (spec 2.4). No haptics: `pressing` drives the visible
// hold feedback (icon 1 -> 1.12 over 450ms, or a ring at 450ms under reduced motion).
import { useCallback, useEffect, useState, useSyncExternalStore, type MouseEvent, type PointerEvent } from "react";
import { GESTURE } from "./swipeMath";

export type LongPressOrigin = { x: number; y: number };

type Press = { pointerId: number; x: number; y: number };

/** A click later than this after the lift is a new, deliberate click. */
export const CLICK_AFTER_RELEASE_MS = 600;

export class LongPressEngine {
  private press: Press | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pressing = false;
  private fired = false;
  private releasedAt = -Infinity;
  private listeners = new Set<() => void>();

  constructor(
    private onLongPress: (origin: LongPressOrigin) => void,
    private delayMs: number = GESTURE.longPress.delayMs,
    private tolerancePx: number = GESTURE.longPress.tolerancePx
  ) {}

  configure(onLongPress: (origin: LongPressOrigin) => void, delayMs: number, tolerancePx: number) {
    this.onLongPress = onLongPress;
    this.delayMs = delayMs;
    this.tolerancePx = tolerancePx;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.pressing;

  private setPressing(value: boolean) {
    if (this.pressing === value) return;
    this.pressing = value;
    this.listeners.forEach(listener => listener());
  }

  /** True once the hold completed for the current press: the following click must be swallowed. */
  get firedThisPress(): boolean {
    return this.fired;
  }

  down(input: { pointerId: number; x: number; y: number; isPrimary?: boolean; button?: number }) {
    if (this.press) {
      // A second finger cancels.
      this.cancel();
      return;
    }
    if (input.isPrimary === false || (input.button !== undefined && input.button !== 0)) return;
    this.fired = false;
    this.press = { pointerId: input.pointerId, x: input.x, y: input.y };
    this.setPressing(true);
    this.timer = setTimeout(() => {
      this.timer = null;
      const press = this.press;
      if (!press) return;
      this.fired = true;
      this.setPressing(false);
      this.onLongPress({ x: press.x, y: press.y });
    }, this.delayMs);
  }

  move(input: { pointerId: number; x: number; y: number }) {
    const press = this.press;
    if (!press || press.pointerId !== input.pointerId) return;
    if (Math.hypot(input.x - press.x, input.y - press.y) >= this.tolerancePx) this.cancel();
  }

  /** Pointer lifted. Returns true when the hold had fired (the caller swallows the click). */
  up(pointerId: number, now: number = Date.now()): boolean {
    if (this.press && this.press.pointerId !== pointerId) return this.fired;
    this.clear();
    this.releasedAt = now;
    return this.fired;
  }

  cancel() {
    this.clear();
  }

  /** Keyboard (ContextMenu key, Shift+F10) or the platform's own long-press callout. */
  contextMenu(origin: LongPressOrigin, now: number = Date.now()): "opened" | "suppressed" {
    if (this.press || (this.fired && now - this.releasedAt <= CLICK_AFTER_RELEASE_MS)) {
      // The touch long-press already handles this press; just block the native callout.
      return "suppressed";
    }
    this.onLongPress(origin);
    return "opened";
  }

  /**
   * Called on the click that follows a press. True (swallow it) only when the hold fired and the click
   * arrives within `CLICK_AFTER_RELEASE_MS` of the lift, so a later keyboard click is never eaten.
   */
  consumeFired(now: number = Date.now()): boolean {
    const fired = this.fired && !this.press && now - this.releasedAt <= CLICK_AFTER_RELEASE_MS;
    this.fired = false;
    return fired;
  }

  private clear() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.press = null;
    this.setPressing(false);
  }

  dispose() {
    this.clear();
    this.fired = false;
  }
}

export type UseLongPressOptions = {
  onLongPress(origin: LongPressOrigin): void;
  delayMs?: number;
  tolerancePx?: number;
  /** Default true. */
  enabled?: boolean;
};

export type UseLongPress = {
  onPointerDown(event: PointerEvent<HTMLElement>): void;
  onPointerMove(event: PointerEvent<HTMLElement>): void;
  onPointerUp(event: PointerEvent<HTMLElement>): void;
  onPointerCancel(event: PointerEvent<HTMLElement>): void;
  onContextMenu(event: MouseEvent<HTMLElement>): void;
  /** Swallows the click that ends a completed hold, so a long-press never also runs the tap action. */
  onClickCapture(event: MouseEvent<HTMLElement>): void;
  /** True while a press is being held (for the hold feedback). */
  pressing: boolean;
};

/** Spread the handlers on the button. The button also needs `-webkit-touch-callout: none` in CSS. */
export function useLongPress(options: UseLongPressOptions): UseLongPress {
  const { onLongPress, delayMs = GESTURE.longPress.delayMs, tolerancePx = GESTURE.longPress.tolerancePx, enabled = true } = options;
  const [engine] = useState(() => new LongPressEngine(onLongPress, delayMs, tolerancePx));
  engine.configure(onLongPress, delayMs, tolerancePx);
  const pressing = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

  useEffect(() => {
    if (!enabled) engine.cancel();
  }, [enabled, engine]);
  useEffect(() => () => engine.dispose(), [engine]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      engine.down({ pointerId: event.pointerId, x: event.clientX, y: event.clientY, isPrimary: event.isPrimary, button: event.button });
    },
    [enabled, engine]
  );
  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => engine.move({ pointerId: event.pointerId, x: event.clientX, y: event.clientY }),
    [engine]
  );
  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => void engine.up(event.pointerId), [engine]);
  const onPointerCancel = useCallback(() => engine.cancel(), [engine]);
  const onContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!enabled) return;
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      // Keyboard-initiated contextmenu has no pointer position; use the item's centre.
      const fromKeyboard = event.clientX === 0 && event.clientY === 0;
      engine.contextMenu(fromKeyboard ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: event.clientX, y: event.clientY });
    },
    [enabled, engine]
  );
  const onClickCapture = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      if (!engine.consumeFired()) return;
      event.preventDefault();
      event.stopPropagation();
    },
    [engine]
  );

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu, onClickCapture, pressing };
}
