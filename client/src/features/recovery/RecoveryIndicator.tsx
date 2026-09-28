import { ArrowUpRight, CircleDot } from "lucide-react";
import type { Ref } from "react";
import "./recovery.css";

export type AccountabilityLevel = "gentle" | "structured" | "strict";

export function RecoveryIndicator({
  count,
  level,
  onOpen,
  buttonRef,
}: {
  count: number;
  level: AccountabilityLevel;
  onOpen: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  if (!count) return null;
  return (
    <section
      className={`recovery-indicator recovery-indicator--${level}`}
      aria-label="Open commitment decisions"
    >
      <span className="recovery-indicator-mark">
        <CircleDot size={18} aria-hidden="true" />
      </span>
      <div>
        <span className="recovery-eyebrow">Commitment trail</span>
        <strong>
          {count} open decision{count === 1 ? "" : "s"}
        </strong>
        <p>
          {level === "gentle"
            ? "Review when ready."
            : level === "strict"
              ? "The count stays here until each decision is saved."
              : "Choose what happens next, one item at a time."}
        </p>
      </div>
      <button ref={buttonRef} type="button" onClick={onOpen}>
        Review decisions <ArrowUpRight size={17} aria-hidden="true" />
      </button>
    </section>
  );
}
