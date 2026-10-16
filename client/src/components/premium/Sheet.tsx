// Shared premium Sheet: a bottom sheet on phones (drag down to dismiss, momentum 0.11 px/ms, damped
// upward pull), a centred dialog on larger screens, or a right-docked side panel (variant "side",
// 480px, slides in on x with the SHEET curve; it becomes the bottom sheet on phones). The labelled Close button is always present,
// so the gesture is never the only way out. Radix Dialog owns focus trapping and focus return.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { animate, AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo, type TargetAndTransition, type Transition } from "framer-motion";
import { X } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ENTER, EXIT, SHEET, shouldDismissSheet } from "@/design/motion";
import { cn } from "@/lib/utils";
import { useIsPhone } from "./useMediaQuery";
import "./premium.css";

export type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  /** Visually hidden title when the content carries its own visible heading. */
  hideTitle?: boolean;
  description?: ReactNode;
  /** "auto" = bottom sheet on phones, dialog elsewhere. "side" = right panel (bottom sheet on phones). */
  variant?: "auto" | "sheet" | "dialog" | "side";
  className?: string;
  /** Extra class on the content panel, e.g. a tone class. */
  contentClassName?: string;
  /** Focus target on open; defaults to Radix (first focusable). */
  onOpenAutoFocus?: (event: Event) => void;
  /** Focus target on close; call event.preventDefault() and focus your own element (Radix otherwise has no trigger to return to). */
  onCloseAutoFocus?: (event: Event) => void;
  /** Escape handler; call event.preventDefault() to keep the sheet open. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  closeLabel?: string;
  /**
   * Shared-element open: the viewport rect of the element the panel grows from (a task row). The panel opens
   * from that rect to its own place (FLIP on transform), then its content fades in. Ignored with reduced motion.
   */
  morphFrom?: SheetMorphOrigin | null;
  children: ReactNode;
};

export type SheetMorphOrigin = { left: number; top: number; width: number; height: number };

/** FLIP start values: the transform (origin top-left) that lays the panel over the origin rect. */
export function sheetMorphStart(origin: SheetMorphOrigin, panel: SheetMorphOrigin) {
  const safe = (value: number) => (Number.isFinite(value) && value > 0 ? value : 1);
  return {
    x: origin.left - panel.left,
    y: origin.top - panel.top,
    scaleX: Math.min(1, safe(origin.width) / safe(panel.width)),
    scaleY: Math.min(1, safe(origin.height) / safe(panel.height)),
  };
}

export type SheetKind = "sheet" | "dialog" | "side";

/** Which panel a variant renders at the current width. */
export function sheetKind(variant: NonNullable<SheetProps["variant"]>, phone: boolean): SheetKind {
  if (variant === "sheet" || (phone && (variant === "auto" || variant === "side"))) return "sheet";
  return variant === "side" ? "side" : "dialog";
}

const INSTANT: Transition = { duration: 0 };

/**
 * Enter/exit motion per panel kind. Reduced motion makes the panel appear and leave in place
 * (no travel, no scale), instantly.
 */
export function sheetMotion(kind: SheetKind, reduced: boolean): { initial: TargetAndTransition; animate: TargetAndTransition; exit: TargetAndTransition; transition: Transition } {
  if (reduced) return { initial: { opacity: 1 }, animate: { opacity: 1, x: 0, y: 0, scale: 1 }, exit: { opacity: 0, transition: INSTANT }, transition: INSTANT };
  if (kind === "sheet") return { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%", transition: EXIT }, transition: SHEET };
  if (kind === "side") return { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%", transition: EXIT }, transition: SHEET };
  return { initial: { opacity: 0, scale: 0.96, y: 8 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.98, transition: EXIT }, transition: ENTER };
}

export function Sheet({
  open,
  onOpenChange,
  title,
  hideTitle = false,
  description,
  variant = "auto",
  className,
  contentClassName,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  closeLabel = "Close",
  morphFrom = null,
  children,
}: SheetProps) {
  const phone = useIsPhone();
  const kind = sheetKind(variant, phone);
  const asSheet = kind === "sheet";
  const reduced = useReducedMotion() ?? false;
  const morphing = Boolean(open && morphFrom && !reduced);
  const baseMotion = sheetMotion(kind, reduced);
  // The morph owns the entrance: the panel mounts in place (no slide) and the layout effect plays the FLIP.
  const panelMotion = morphing ? { ...baseMotion, initial: { opacity: 1 }, animate: { opacity: 1 } } : baseMotion;
  const morphRef = useRef<SheetMorphOrigin | null>(null);
  morphRef.current = morphing ? morphFrom : null;
  const controls = useDragControls();
  const panel = useRef<HTMLDivElement | null>(null);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const height = panel.current?.offsetHeight ?? 400;
    if (shouldDismissSheet(info.offset.y, info.velocity.y, height)) onOpenChange(false);
  };
  // Radix mounts the portal a commit after `open`, so the FLIP starts from the panel's ref callback (still
  // before paint) rather than from an effect here.
  const played = useRef(false);
  const stopMorph = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    if (!open) played.current = false;
  }, [open]);
  useLayoutEffect(() => () => stopMorph.current?.(), []);
  const attachPanel = (element: HTMLDivElement | null) => {
    panel.current = element;
    const origin = morphRef.current;
    if (!element || !origin || played.current) return;
    played.current = true;
    const rect = element.getBoundingClientRect();
    const start = sheetMorphStart(origin, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    element.style.transformOrigin = "0 0";
    const growth = animate(element, { x: [start.x, 0], y: [start.y, 0], scaleX: [start.scaleX, 1], scaleY: [start.scaleY, 1] }, SHEET);
    const inner = Array.from(element.querySelectorAll<HTMLElement>(":scope > .pc-sheet-head, :scope > .pc-sheet-body, :scope > .pc-sheet-description"));
    const fades = inner.map(node => animate(node, { opacity: [0, 1] }, { duration: 0.26, delay: 0.16, ease: [0.22, 1, 0.36, 1] }));
    void growth.then(() => { element.style.transformOrigin = ""; });
    stopMorph.current = () => {
      growth.stop();
      fades.forEach(fade => fade.stop());
      inner.forEach(node => { node.style.opacity = ""; });
    };
  };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className={cn("pc-sheet-overlay", kind === "side" && "is-side")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: EXIT }}
                transition={reduced ? INSTANT : asSheet || kind === "side" ? SHEET : ENTER}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              onOpenAutoFocus={onOpenAutoFocus}
              onCloseAutoFocus={onCloseAutoFocus}
              onEscapeKeyDown={onEscapeKeyDown}
              {...(description ? {} : { "aria-describedby": undefined })}
            >
              <motion.div
                ref={attachPanel}
                className={cn("pc-sheet", `is-${kind}`, className, contentClassName)}
                data-sheet-kind={kind}
                data-morph={morphing ? "row" : undefined}
                initial={panelMotion.initial}
                animate={panelMotion.animate}
                exit={panelMotion.exit}
                transition={panelMotion.transition}
                drag={asSheet ? "y" : false}
                dragListener={false}
                dragControls={controls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.04, bottom: 1 }}
                onDragEnd={asSheet ? onDragEnd : undefined}
              >
                {asSheet ? (
                  <div className="pc-sheet-grabber" onPointerDown={event => controls.start(event)} aria-hidden="true">
                    <span />
                  </div>
                ) : null}
                <header className="pc-sheet-head" onPointerDown={asSheet ? event => { if ((event.target as HTMLElement).closest("button")) return; controls.start(event); } : undefined}>
                  <DialogPrimitive.Title className={cn("pc-sheet-title", hideTitle && "pc-sr-only")}>{title}</DialogPrimitive.Title>
                  <DialogPrimitive.Close className="pc-sheet-close pc-focusable" aria-label={closeLabel}>
                    <X size={18} aria-hidden="true" />
                    <span className="pc-sheet-close-text">{closeLabel}</span>
                  </DialogPrimitive.Close>
                </header>
                {description ? <DialogPrimitive.Description className="pc-sheet-description">{description}</DialogPrimitive.Description> : null}
                <div className="pc-sheet-body">{children}</div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
