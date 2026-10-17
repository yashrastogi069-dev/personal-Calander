// One tickable list of today's items (Q14): ONE check per row, whatever record sits behind it. A ticked row
// dims in place until the day is reloaded; "Done today" collects what was finished earlier.
import { CalendarCheck2, ChevronDown, ListChecks, Play, Repeat, Undo2, FileText } from "lucide-react";
import type { CSSProperties } from "react";
import type { WhyReason } from "@shared/whyItMatters";
import type { ToneOrNeutral } from "@/design/categoryTone";
import { toneClassName } from "@/design/categoryTone";
import { cn } from "@/lib/utils";
import { CheckButton } from "@/features/tasks/CheckButton";
import { TaskActionsMenu } from "@/features/tasks/TaskRow";
import { capacityTime, clockRange, weekdayLabel, type TodayItem } from "./todayModel";

export type TodayListRow = {
  item: TodayItem;
  ticked: boolean;
  /** The Undo window closed and the write was sent: the check is final here. */
  committed: boolean;
  tone: ToneOrNeutral;
  reason: WhyReason | null;
  /** The earlier day of a carried or leftover commitment. */
  fromLocalDate: string | null;
  blockedReason: string | null;
};

export type TodayDoneRow = { key: string; title: string; detail: string; time: string | null };

export type TodayItemListProps = {
  rows: readonly TodayListRow[];
  done: readonly TodayDoneRow[];
  timezone: string;
  enterKey: number;
  onToggle: (row: TodayListRow) => void;
  onBlocked: (row: TodayListRow) => void;
  onOpen: (row: TodayListRow, trigger: HTMLElement) => void;
  onStartFocus: (row: TodayListRow) => void;
  onPlanDay: () => void;
};

function sourceNote(row: TodayListRow) {
  if (row.item.source === "carried_commitment") return { icon: Undo2, text: row.fromLocalDate ? `Carried from ${weekdayLabel(row.fromLocalDate)}` : "Carried over" };
  if (row.item.source === "occurrence" || row.item.occurrenceId) return { icon: Repeat, text: "Today's repeat" };
  if (row.fromLocalDate) return { icon: Undo2, text: `From ${weekdayLabel(row.fromLocalDate)}` };
  return null;
}

export function TodayItemList({ rows, done, timezone, enterKey, onToggle, onBlocked, onOpen, onStartFocus, onPlanDay }: TodayItemListProps) {
  const open = rows.filter(row => !row.ticked).length;
  return (
    <section className="td-card td-list" aria-labelledby="td-list-title" data-today-section="list">
      <header className="td-card-head">
        <span className="pc-icon-tile pc-tone-accent" aria-hidden="true"><ListChecks size={16} strokeWidth={2} /></span>
        <div className="td-card-head-text">
          <h2 id="td-list-title">Today's list</h2>
          <p>{rows.length ? `${open} to do${rows.length - open ? ` · ${rows.length - open} just done` : ""}` : "Nothing on the list yet"}</p>
        </div>
      </header>
      {rows.length ? (
        <ul className="td-rows" key={enterKey}>
          {rows.map((row, index) => {
            const note = sourceNote(row);
            const time = row.item.startsAt ? clockRange(row.item.startsAt, row.item.endsAt, timezone) : null;
            const risk = row.reason && (row.reason.tone === "risk" || row.reason.tone === "off") ? row.reason : null;
            return (
              <li
                key={row.item.key}
                className={cn("td-row pc-rise", toneClassName(row.tone), row.ticked && "is-ticked")}
                style={{ ["--pc-i" as string]: index } as CSSProperties}
                data-today-item={row.item.key}
                data-task-record-id={row.item.taskId}
                data-source={row.item.source}
              >
                <CheckButton
                  title={row.item.title}
                  checked={row.ticked}
                  tone={row.tone}
                  blockedReason={row.ticked ? null : row.blockedReason}
                  inert={row.committed}
                  onToggle={() => onToggle(row)}
                  onBlockedPress={() => onBlocked(row)}
                />
                <div className="td-row-main">
                  <button type="button" className="td-row-title pc-focusable" onClick={event => onOpen(row, event.currentTarget)}>{row.item.title}</button>
                  {time || note || risk ? (
                    <p className="td-row-meta">
                      {time ? <span className="td-row-time">{time}</span> : null}
                      {note ? <span className="td-row-note"><note.icon size={12} strokeWidth={2.2} aria-hidden="true" />{note.text}</span> : null}
                      {risk ? <span className={cn("tk-pill", risk.tone === "off" ? "is-off" : "is-risk")} title={risk.accessible}>{risk.short}</span> : null}
                    </p>
                  ) : null}
                </div>
                {row.item.estimateMinutes ? <span className="td-row-estimate pc-num">{capacityTime(row.item.estimateMinutes)}</span> : <span className="td-row-estimate" aria-hidden="true" />}
                <TaskActionsMenu
                  title={row.item.title}
                  actions={row.ticked ? [] : [
                    { id: "focus", label: "Start focus", icon: Play, onSelect: () => onStartFocus(row), disabled: Boolean(row.blockedReason), reason: row.blockedReason ?? undefined },
                    { id: "open", label: "Open details", icon: FileText, onSelect: () => { const el = document.querySelector<HTMLElement>(`[data-today-item="${CSS.escape(row.item.key)}"] .td-row-title`); if (el) onOpen(row, el); } },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="td-empty">
          <p>Your list is clear. Add a few things from your tasks so the day has a shape.</p>
          <button type="button" className="tk-btn is-accent" onClick={onPlanDay}>Plan my day</button>
        </div>
      )}
      {done.length ? (
        <details className="td-done" data-today-section="completed">
          <summary className="pc-focusable"><CalendarCheck2 size={15} strokeWidth={2} aria-hidden="true" /><span>Done today · {done.length}</span><ChevronDown size={15} strokeWidth={2} aria-hidden="true" className="td-done-chevron" /></summary>
          <ul>
            {done.map(row => (
              <li key={row.key}><span className="td-done-mark" aria-hidden="true"><CalendarCheck2 size={13} strokeWidth={2.2} /></span><span className="td-done-title">{row.title}</span><small>{row.time ?? row.detail}</small></li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
