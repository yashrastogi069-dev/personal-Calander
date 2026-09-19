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

export function isEligibleReturnFocusTarget(
  element: HTMLElement | null
): element is HTMLElement {
  return Boolean(
    element?.isConnected &&
      !element.hidden &&
      !(element as HTMLButtonElement).disabled &&
      element.getAttribute("aria-disabled") !== "true" &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0 &&
      element.matches(":not([hidden])") &&
      !element.closest("[inert]")
  );
}

export function restorePlannerSheetFocus(
  event: { preventDefault: () => void },
  element: HTMLElement | null
) {
  if (!isEligibleReturnFocusTarget(element)) return false;
  event.preventDefault();
  element.focus();
  return true;
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
    if (isEligibleReturnFocusTarget(closeButtonRef.current)) closeButtonRef.current.focus();
  }, []);

  const handleCloseAutoFocus = useCallback(
    (event: Event) => {
      restorePlannerSheetFocus(event, returnFocusRef.current);
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
