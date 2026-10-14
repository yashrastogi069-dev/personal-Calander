// D3 ChipSelect / ChipMultiSelect: the premium replacement for native selects. A Radix Popover holds an
// ARIA listbox (aria-activedescendant, so DOM focus stays on the list): Up/Down/Home/End move, Enter or
// Space picks, printable keys type ahead, Escape closes and Radix returns focus to the trigger.
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { toneClassName, type ToneOrNeutral } from "@/design/categoryTone";
import { cn } from "@/lib/utils";
import "./premium.css";

export type ChipSelectOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  tone?: ToneOrNeutral;
  icon?: LucideIcon;
  disabled?: boolean;
};

/** Next enabled option index from `from` in `delta` direction (1 or -1), clamped at the ends. -1 when none is enabled. */
export function nextEnabledIndex(options: ReadonlyArray<{ disabled?: boolean }>, from: number, delta: 1 | -1): number {
  let index = from;
  for (let step = 0; step < options.length; step += 1) {
    const next = index + delta;
    if (next < 0 || next >= options.length) break;
    index = next;
    if (!options[index].disabled) return index;
  }
  return options[from] && !options[from].disabled ? from : -1;
}

export function firstEnabledIndex(options: ReadonlyArray<{ disabled?: boolean }>): number {
  return options.findIndex(option => !option.disabled);
}

export function lastEnabledIndex(options: ReadonlyArray<{ disabled?: boolean }>): number {
  for (let index = options.length - 1; index >= 0; index -= 1) if (!options[index].disabled) return index;
  return -1;
}

/**
 * Type-ahead: the next enabled option whose label starts with `buffer`, searching after `from` first so
 * repeating one letter cycles through matches. -1 when nothing matches.
 */
export function typeaheadIndex(options: ReadonlyArray<{ label: string; disabled?: boolean }>, buffer: string, from: number): number {
  const needle = buffer.trim().toLocaleLowerCase();
  if (!needle) return -1;
  const cycling = needle.length > 1 && needle.split("").every(char => char === needle[0]);
  const query = cycling ? needle[0] : needle;
  const start = needle.length === 1 || cycling ? from + 1 : from;
  for (let offset = 0; offset < options.length; offset += 1) {
    const index = (start + offset + options.length) % options.length;
    const option = options[index];
    if (!option.disabled && option.label.toLocaleLowerCase().startsWith(query)) return index;
  }
  return -1;
}

type CommonProps<T extends string> = {
  options: ReadonlyArray<ChipSelectOption<T>>;
  /** Accessible name of the control and its list ("Sort", "Status"). */
  label: string;
  /** Show `label` as a visible key before the value ("Sort  Manual"). */
  showLabel?: boolean;
  icon?: LucideIcon;
  placeholder?: string;
  /** "chip" = compact pill (toolbars); "field" = full-width form control. */
  variant?: "chip" | "field";
  align?: "start" | "end";
  disabled?: boolean;
  className?: string;
  id?: string;
};

type SelectShellProps<T extends string> = CommonProps<T> & {
  multiple: boolean;
  selected: ReadonlyArray<T>;
  onPick: (value: T) => void;
  summary?: (selected: ReadonlyArray<ChipSelectOption<T>>) => string;
};

function SelectShell<T extends string>({
  options,
  label,
  showLabel = false,
  icon: Icon,
  placeholder = "Choose",
  variant = "chip",
  align = "start",
  disabled,
  className,
  id,
  multiple,
  selected,
  onPick,
  summary,
}: SelectShellProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const baseId = useId();
  const listRef = useRef<HTMLDivElement | null>(null);
  const buffer = useRef({ text: "", timer: 0 as ReturnType<typeof setTimeout> | 0 });
  const chosen = options.filter(option => selected.includes(option.value));
  const valueText = summary ? summary(chosen) : chosen.length ? chosen.map(option => option.label).join(", ") : placeholder;
  const lead = chosen.length === 1 ? chosen[0] : null;
  const optionId = (index: number) => `${baseId}-o${index}`;

  const openAt = () => {
    const selectedIndex = options.findIndex(option => selected.includes(option.value) && !option.disabled);
    setActive(selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options));
  };

  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: "nearest" });
    // optionId depends only on baseId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, active]);
  useEffect(() => () => { if (buffer.current.timer) clearTimeout(buffer.current.timer); }, []);

  const pick = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onPick(option.value);
    if (!multiple) setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(current => (current < 0 ? firstEnabledIndex(options) : nextEnabledIndex(options, current, 1))); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setActive(current => (current < 0 ? lastEnabledIndex(options) : nextEnabledIndex(options, current, -1))); return; }
    if (event.key === "Home") { event.preventDefault(); setActive(firstEnabledIndex(options)); return; }
    if (event.key === "End") { event.preventDefault(); setActive(lastEnabledIndex(options)); return; }
    if (event.key === "Enter" || event.key === " ") {
      // Space continues a type-ahead word; otherwise it picks.
      if (event.key === " " && buffer.current.text) { event.preventDefault(); return; }
      event.preventDefault();
      pick(active);
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (buffer.current.timer) clearTimeout(buffer.current.timer);
      buffer.current.text += event.key;
      buffer.current.timer = setTimeout(() => { buffer.current.text = ""; buffer.current.timer = 0; }, 600);
      const index = typeaheadIndex(options, buffer.current.text, active);
      if (index >= 0) setActive(index);
    }
  };

  return (
    <PopoverPrimitive.Root
      open={open}
      onOpenChange={next => {
        if (next) openAt();
        setOpen(next);
      }}
    >
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-label={`${label}: ${valueText}`}
          className={cn("pc-cselect pc-focusable", `is-${variant}`, lead?.tone && toneClassName(lead.tone), open && "is-open", className)}
        >
          {Icon ? <Icon size={15} strokeWidth={2} aria-hidden="true" className="pc-cselect-icon" /> : null}
          {showLabel ? <span className="pc-cselect-key">{label}</span> : null}
          {lead?.tone ? <span className="pc-dot" aria-hidden="true" /> : null}
          <span className={cn("pc-cselect-value", !chosen.length && "is-placeholder")}>{valueText}</span>
          <ChevronDown size={15} strokeWidth={2.25} aria-hidden="true" className="pc-cselect-caret" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="pc-cselect-panel"
          align={align}
          sideOffset={6}
          collisionPadding={12}
          onOpenAutoFocus={event => {
            event.preventDefault();
            listRef.current?.focus();
          }}
        >
          <div
            ref={listRef}
            role="listbox"
            tabIndex={0}
            aria-label={label}
            aria-multiselectable={multiple || undefined}
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            className="pc-cselect-list"
            onKeyDown={onKeyDown}
          >
            {options.map((option, index) => {
              const isSelected = selected.includes(option.value);
              const OptionIcon = option.icon;
              return (
                <div
                  key={option.value}
                  id={optionId(index)}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  data-active={index === active || undefined}
                  className={cn("pc-cselect-option", option.tone && toneClassName(option.tone), isSelected && "is-selected")}
                  onPointerMove={() => { if (!option.disabled && active !== index) setActive(index); }}
                  onClick={() => pick(index)}
                >
                  {option.tone ? <span className="pc-dot" aria-hidden="true" /> : OptionIcon ? <OptionIcon size={15} strokeWidth={2} aria-hidden="true" className="pc-cselect-option-icon" /> : null}
                  <span className="pc-cselect-option-text">
                    <span className="pc-cselect-option-label">{option.label}</span>
                    {option.description ? <span className="pc-cselect-option-desc">{option.description}</span> : null}
                  </span>
                  {isSelected ? <Check size={15} strokeWidth={3} aria-hidden="true" className="pc-cselect-option-check" /> : null}
                </div>
              );
            })}
            {!options.length ? <p className="pc-cselect-empty">Nothing to choose yet.</p> : null}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export type ChipSelectProps<T extends string> = CommonProps<T> & {
  value: T | null;
  onValueChange: (value: T) => void;
};

export function ChipSelect<T extends string>({ value, onValueChange, ...rest }: ChipSelectProps<T>) {
  return <SelectShell<T> {...rest} multiple={false} selected={value == null ? [] : [value]} onPick={onValueChange} />;
}

export type ChipMultiSelectProps<T extends string> = CommonProps<T> & {
  values: ReadonlyArray<T>;
  onValuesChange: (values: T[]) => void;
  /** Overrides the trigger text, e.g. "2 categories". */
  summary?: (selected: ReadonlyArray<ChipSelectOption<T>>) => string;
};

export function ChipMultiSelect<T extends string>({ values, onValuesChange, summary, ...rest }: ChipMultiSelectProps<T>) {
  return (
    <SelectShell<T>
      {...rest}
      multiple
      selected={values}
      summary={summary}
      onPick={value => onValuesChange(values.includes(value) ? values.filter(item => item !== value) : [...values, value])}
    />
  );
}
