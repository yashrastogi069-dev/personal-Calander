import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { XIcon } from "lucide-react";
import { type ReactNode, type RefObject, useCallback, useRef } from "react";
import "./planner-sheet.css";

export interface PlannerSheetProps {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  footer?: ReactNode;
}

function canReceiveFocus(element: HTMLElement | null): element is HTMLElement {
  return Boolean(
    element?.isConnected &&
      !(element as HTMLButtonElement).disabled &&
      element.getAttribute("aria-disabled") !== "true"
  );
}

export function PlannerSheet({
  open,
  title,
  description,
  onOpenChange,
  returnFocusRef,
  children,
  footer,
}: PlannerSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const handleOpenAutoFocus = useCallback((event: Event) => {
    event.preventDefault();
    if (canReceiveFocus(closeButtonRef.current)) closeButtonRef.current.focus();
  }, []);

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      event.preventDefault();
      const returnTarget = returnFocusRef.current;

      queueMicrotask(() => {
        if (canReceiveFocus(returnTarget)) returnTarget.focus();
      });
    },
    [returnFocusRef]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="planner-sheet-content"
        showCloseButton={false}
        onOpenAutoFocus={handleOpenAutoFocus}
        onCloseAutoFocus={handleCloseAutoFocus}
      >
        <DialogHeader className="planner-sheet-header">
          <div className="planner-sheet-heading">
            <DialogTitle className="planner-sheet-title">{title}</DialogTitle>
            <DialogDescription className="planner-sheet-description">
              {description}
            </DialogDescription>
          </div>
          <DialogClose
            ref={closeButtonRef}
            className="planner-sheet-close"
            aria-label="Close"
          >
            <XIcon aria-hidden="true" />
          </DialogClose>
        </DialogHeader>
        <div className="planner-sheet-body">{children}</div>
        {footer ? (
          <footer className="planner-sheet-footer">{footer}</footer>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export default PlannerSheet;
