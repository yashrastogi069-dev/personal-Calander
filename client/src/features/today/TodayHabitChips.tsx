// Habits due today as one chip row (Q15). Tap = done (the ring fills), the small menu = skip, a done or
// skipped chip fades and a second tap clears it. Hidden when nothing is due. History lives on Habits.
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ArrowRight, Check, MoreHorizontal, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { habitChipRow, type HabitChipState } from "./todayModel";
import type { TodayHabitRow } from "@shared/todayProjection";

export type TodayHabitChipsProps = {
  rows: readonly TodayHabitRow[];
  pending: boolean;
  error: string | null;
  onTap: (habitId: string, state: HabitChipState) => void;
  onSkip: (habitId: string) => void;
  onOpenHabits: () => void;
};

const STATE_LABEL: Record<HabitChipState, string> = { due: "Due", done: "Done", skipped: "Skipped", missed: "Missed" };

export function TodayHabitChips({ rows, pending, error, onTap, onSkip, onOpenHabits }: TodayHabitChipsProps) {
  const model = habitChipRow(rows);
  if (!model.visible) return null;
  return (
    <section className="td-card td-habits" aria-labelledby="td-habits-title" data-today-section="habits">
      <header className="td-card-head">
        <span className="pc-icon-tile pc-tone-health" aria-hidden="true"><Sparkles size={16} strokeWidth={2} /></span>
        <div className="td-card-head-text">
          <h2 id="td-habits-title">Habits due</h2>
          <p className="pc-num">{model.allSettled ? "All settled for today" : `${model.doneCount} of ${model.dueCount} done`}</p>
        </div>
        <button type="button" className="tk-ghost-btn pc-focusable" onClick={onOpenHabits}>History<ArrowRight size={14} strokeWidth={2} aria-hidden="true" /></button>
      </header>
      <ul className="td-chips">
        {model.chips.map((chip, index) => {
          const settled = chip.state !== "due" && chip.state !== "missed";
          return (
            <li key={chip.id} className={cn("td-chip pc-pop", `is-${chip.state}`)} style={{ ["--pc-i" as string]: index } as CSSProperties} data-habit-id={chip.id} data-habit-state={chip.state}>
              <button
                type="button"
                className="td-chip-main pc-focusable"
                aria-pressed={chip.state === "done"}
                aria-label={chip.state === "done" ? `${chip.title}: done. Tap to clear` : chip.state === "skipped" ? `${chip.title}: skipped. Tap to clear` : `Mark ${chip.title} done`}
                aria-disabled={pending || undefined}
                onClick={() => { if (!pending) onTap(chip.id, chip.state); }}
              >
                <span className="td-ring" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22"><circle className="td-ring-track" cx="12" cy="12" r="9.5" /><circle className="td-ring-fill" cx="12" cy="12" r="9.5" pathLength="100" /></svg>
                  <Check size={12} strokeWidth={3.2} className="td-ring-check" />
                </span>
                <span className="td-chip-title">{chip.title}</span>
                {chip.weekProgress ? <span className="td-chip-sub pc-num">{chip.weekProgress.completed}/{chip.weekProgress.target} wk</span> : null}
                <span className="pc-sr-only">{STATE_LABEL[chip.state]}</span>
              </button>
              {!settled ? (
                <DropdownMenuPrimitive.Root>
                  <DropdownMenuPrimitive.Trigger asChild>
                    <button type="button" className="td-chip-more pc-focusable" aria-label={`More for ${chip.title}`}><MoreHorizontal size={15} strokeWidth={2} aria-hidden="true" /></button>
                  </DropdownMenuPrimitive.Trigger>
                  <DropdownMenuPrimitive.Portal>
                    <DropdownMenuPrimitive.Content className="tk-menu" align="end" sideOffset={6} collisionPadding={12}>
                      <DropdownMenuPrimitive.Item className="tk-menu-item" disabled={pending} onSelect={() => onSkip(chip.id)}>Skip today</DropdownMenuPrimitive.Item>
                    </DropdownMenuPrimitive.Content>
                  </DropdownMenuPrimitive.Portal>
                </DropdownMenuPrimitive.Root>
              ) : null}
            </li>
          );
        })}
      </ul>
      {error ? <p className="td-inline-error" role="alert">{error}</p> : null}
    </section>
  );
}
