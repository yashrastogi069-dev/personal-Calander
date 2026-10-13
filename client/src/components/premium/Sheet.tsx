// Shared premium Sheet: a bottom sheet on phones (drag down to dismiss, momentum 0.11 px/ms, damped
// upward pull) and a centred dialog on larger screens. The labelled Close button is always present,
// so the gesture is never the only way out. Radix Dialog owns focus trapping and focus return.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, useDragControls, type PanInfo } from "framer-motion";
import { X } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { EASE_OUT, SHEET, shouldDismissSheet } from "@/design/motion";
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
  /** "auto" = bottom sheet on phones, dialog elsewhere. */
  variant?: "auto" | "sheet" | "dialog";
  className?: string;
  /** Extra class on the content panel, e.g. a tone class. */
  contentClassName?: string;
  /** Focus target on open; defaults to Radix (first focusable). */
  onOpenAutoFocus?: (event: Event) => void;
  /** Escape handler; call event.preventDefault() to keep the sheet open. */
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  closeLabel?: string;
  children: ReactNode;
};

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
  onEscapeKeyDown,
  closeLabel = "Close",
  children,
}: SheetProps) {
  const phone = useIsPhone();
  const asSheet = variant === "sheet" || (variant === "auto" && phone);
  const controls = useDragControls();
  const panel = useRef<HTMLDivElement | null>(null);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    const height = panel.current?.offsetHeight ?? 400;
    if (shouldDismissSheet(info.offset.y, info.velocity.y, height)) onOpenChange(false);
  };
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="pc-sheet-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } }}
                transition={asSheet ? SHEET : { duration: 0.24, ease: EASE_OUT }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content
              asChild
              forceMount
              onOpenAutoFocus={onOpenAutoFocus}
              onEscapeKeyDown={onEscapeKeyDown}
              {...(description ? {} : { "aria-describedby": undefined })}
            >
              <motion.div
                ref={panel}
                className={cn("pc-sheet", asSheet ? "is-sheet" : "is-dialog", className, contentClassName)}
                initial={asSheet ? { y: "100%" } : { opacity: 0, scale: 0.96, y: 8 }}
                animate={asSheet ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
                exit={asSheet ? { y: "100%", transition: { duration: 0.2, ease: EASE_OUT } } : { opacity: 0, scale: 0.98, transition: { duration: 0.16, ease: EASE_OUT } }}
                transition={asSheet ? SHEET : { duration: 0.24, ease: EASE_OUT }}
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
