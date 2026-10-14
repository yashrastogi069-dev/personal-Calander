// D3 FilterChips: toggle chips with live counts. Horizontally scrollable with snap on phones, `aria-pressed`
// for state (colour is never the only signal: a pressed chip also gets a check mark). RollingCount is the
// shared rolling number: it replays a short tick only when the value changes after mount.
import { Check, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { toneClassName, type ToneOrNeutral } from "@/design/categoryTone";
import { useChangeCount } from "@/design/motion";
import { cn } from "@/lib/utils";
import "./premium.css";

/** A number whose digits tick in when it changes (never on first paint). Reads as plain text to assistive tech. */
export function RollingCount({ value, className }: { value: number; className?: string }) {
  const changes = useChangeCount(value);
  const text = String(Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)));
  return (
    <span className={cn("pc-count pc-num", className)}>
      <span className="pc-sr-only">{text}</span>
      <span key={changes} className={cn("pc-count-digits", changes > 0 && "pc-count-roll")} aria-hidden="true">{text}</span>
    </span>
  );
}

export type FilterChipItem = {
  value: string;
  label: ReactNode;
  /** Live count; omitted or null shows no count. */
  count?: number | null;
  icon?: LucideIcon;
  /** Category tone: adds a tone dot before the label. */
  tone?: ToneOrNeutral;
  /** Plain-text name when `label` is not a string. */
  ariaLabel?: string;
};

export type FilterChipsProps = {
  items: ReadonlyArray<FilterChipItem>;
  /** Pressed chips. A single value is accepted for one-of-many groups. */
  selected: ReadonlyArray<string> | string;
  onToggle: (value: string) => void;
  /** Accessible name of the group. */
  label: string;
  className?: string;
};

export function FilterChips({ items, selected, onToggle, label, className }: FilterChipsProps) {
  const pressed = new Set(typeof selected === "string" ? [selected] : selected);
  return (
    <div role="group" aria-label={label} className={cn("pc-chips", className)}>
      {items.map(item => {
        const on = pressed.has(item.value);
        const Icon = item.icon;
        const count = item.count;
        return (
          <button
            key={item.value}
            type="button"
            className={cn("pc-chip pc-focusable", item.tone && toneClassName(item.tone), on && "is-pressed")}
            aria-pressed={on}
            aria-label={count != null ? `${item.ariaLabel ?? (typeof item.label === "string" ? item.label : item.value)}, ${count}` : item.ariaLabel}
            onClick={() => onToggle(item.value)}
          >
            {item.tone ? <span className="pc-dot" aria-hidden="true" /> : null}
            {Icon ? <Icon size={14} strokeWidth={2} aria-hidden="true" /> : null}
            <span className="pc-chip-label">{item.label}</span>
            {count != null ? <RollingCount value={count} className="pc-chip-count" /> : null}
            {on ? <Check size={13} strokeWidth={3} aria-hidden="true" className="pc-chip-check" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** An applied filter shown as a removable chip: "Work x". The remove control names what it removes. */
export function RemovableChip({
  label,
  tone,
  onRemove,
  removeLabel,
  className,
}: {
  label: string;
  tone?: ToneOrNeutral;
  onRemove: () => void;
  /** Defaults to "Remove {label} filter". */
  removeLabel?: string;
  className?: string;
}) {
  return (
    <span className={cn("pc-chip is-applied", tone && toneClassName(tone), className)}>
      {tone ? <span className="pc-dot" aria-hidden="true" /> : null}
      <span className="pc-chip-label">{label}</span>
      <button type="button" className="pc-chip-remove pc-focusable" aria-label={removeLabel ?? `Remove ${label} filter`} onClick={onRemove}>
        <X size={13} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </span>
  );
}
