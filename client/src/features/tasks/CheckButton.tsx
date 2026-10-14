// D3 CheckButton: the spring check-off. A fresh completion (false to true while mounted, never on first
// paint) draws the stroke, springs the circle and sends a short burst. A guarded task (R1-R3) keeps the
// button focusable with aria-disabled so the reason is announced; pressing it hands the reason to
// `onBlockedPress` instead of writing.
import { Check } from "lucide-react";
import { toneClassName, type ToneOrNeutral } from "@/design/categoryTone";
import { useBecameTrue } from "@/design/motion";
import { cn } from "@/lib/utils";
import "./tasks-premium.css";

export type CheckButtonProps = {
  /** Task title, used for the accessible name. */
  title: string;
  checked: boolean;
  tone?: ToneOrNeutral;
  /** Why the task cannot be completed from here; shown as a tooltip and read by screen readers. */
  blockedReason?: string | null;
  /** The check has nothing to do (for example, archived work). */
  inert?: boolean;
  /** A write is in flight. */
  pending?: boolean;
  onToggle: () => void;
  onBlockedPress?: () => void;
  className?: string;
};

export function checkButtonLabel({ title, checked, blockedReason }: Pick<CheckButtonProps, "title" | "checked" | "blockedReason">) {
  if (blockedReason) return `${checked ? "Reopen" : "Complete"} ${title}. ${blockedReason}`;
  return `${checked ? "Reopen" : "Complete"} ${title}`;
}

export function CheckButton({ title, checked, tone = "neutral", blockedReason, inert, pending, onToggle, onBlockedPress, className }: CheckButtonProps) {
  const celebrating = useBecameTrue(checked);
  const blocked = Boolean(blockedReason) && !checked;
  return (
    <span className={cn("tk-check-wrap", toneClassName(tone), celebrating && "is-celebrating", className)}>
      <button
        type="button"
        className={cn("tk-check pc-focusable", checked && "is-checked", blocked && "is-blocked")}
        aria-label={checkButtonLabel({ title, checked, blockedReason: blocked ? blockedReason : null })}
        aria-disabled={blocked || inert || pending || undefined}
        title={blocked ? blockedReason ?? undefined : undefined}
        onClick={() => {
          if (inert || pending) return;
          if (blocked) onBlockedPress?.();
          else onToggle();
        }}
      >
        <Check size={14} strokeWidth={3.25} aria-hidden="true" className="tk-check-mark" />
      </button>
      <span className="tk-check-burst" aria-hidden="true" />
    </span>
  );
}
