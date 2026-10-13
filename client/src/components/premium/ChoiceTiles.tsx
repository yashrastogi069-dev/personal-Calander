// Radio tiles: a labelled radiogroup with arrow-key movement (roving tabindex). The selected tile
// takes the tone fill and a full 1.5px border (never a side stripe); its extra control reveals
// with a clip-path wipe. Disabled tiles keep their reason visible.
import { useRef, type KeyboardEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import "./premium.css";

export type ChoiceTileOption<T extends string> = {
  value: T;
  title: ReactNode;
  description?: ReactNode;
  icon: LucideIcon;
  disabled?: boolean;
  /** Shown under the title when disabled. */
  disabledReason?: ReactNode;
  /** Extra control shown inside the tile while it is selected (outside the radio button). */
  reveal?: ReactNode;
  /** Inline error for this choice (role="alert"), placed next to the tile it concerns. */
  error?: ReactNode;
  /** Tone class for the icon tile, e.g. "pc-tone-health". */
  tone?: string;
};

export function ChoiceTiles<T extends string>({
  labelledBy,
  label,
  value,
  onChange,
  options,
  className,
  name,
}: {
  labelledBy?: string;
  label?: string;
  value: T | null;
  onChange: (value: T) => void;
  options: ReadonlyArray<ChoiceTileOption<T>>;
  className?: string;
  name?: string;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.map((option, index) => (option.disabled ? -1 : index)).filter(index => index >= 0);
  const selectedIndex = options.findIndex(option => option.value === value);
  const tabStop = selectedIndex >= 0 && !options[selectedIndex].disabled ? selectedIndex : enabled[0] ?? -1;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const forward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const backward = event.key === "ArrowUp" || event.key === "ArrowLeft";
    if (!forward && !backward) return;
    event.preventDefault();
    const position = enabled.indexOf(index);
    const next = enabled[(position + (forward ? 1 : -1) + enabled.length) % enabled.length];
    if (next === undefined) return;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} aria-label={labelledBy ? undefined : label} className={cn("pc-choices", className)} data-name={name}>
      {options.map((option, index) => {
        const Icon = option.icon;
        const selected = option.value === value;
        return (
          <div key={option.value} className={cn("pc-choice", selected && "is-selected", option.disabled && "is-disabled")}>
            <button
              ref={element => { refs.current[index] = element; }}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-disabled={option.disabled || undefined}
              disabled={option.disabled}
              tabIndex={index === tabStop ? 0 : -1}
              className="pc-choice-button pc-focusable"
              onClick={() => { if (!option.disabled) onChange(option.value); }}
              onKeyDown={event => onKeyDown(event, index)}
            >
              <span className={cn("pc-choice-icon", option.tone)} aria-hidden="true"><Icon size={18} strokeWidth={2} /></span>
              <span className="pc-choice-text">
                <span className="pc-choice-title">{option.title}</span>
                {option.disabled && option.disabledReason ? (
                  <span className="pc-choice-description">{option.disabledReason}</span>
                ) : option.description ? (
                  <span className="pc-choice-description">{option.description}</span>
                ) : null}
              </span>
              <span className="pc-choice-radio" aria-hidden="true"><span /></span>
            </button>
            {option.reveal && selected ? <div className="pc-choice-reveal">{option.reveal}</div> : null}
            {option.error ? <div className="pc-choice-error" role="alert">{option.error}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
