import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { displayLocalDate } from "@/lib/workspace";
import type { PlanBoard, PlanBoardCard } from "./planBoard";
import "./plan-week.css";

const sourceLabel = { planned_day: "Planned day", reservation: "Reserved time", commitment: "Daily commitment", occurrence: "Recurring occurrence" } as const;
function timeLabel(value: Date | string, timezone: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(date);
}

function TaskCard({ card, timezone, onOpenTask }: { card: PlanBoardCard; timezone: string; onOpenTask: (id: string) => void }) {
  return <article className={`plan-week-card ${card.missingTask ? "is-missing" : ""}`} data-task-id={card.taskId}>
    <button type="button" onClick={() => onOpenTask(card.taskId)} disabled={card.missingTask} aria-label={`Open task ${card.title}`}>
      <strong>{card.title}</strong>
      <span>{card.missingTask ? "Saved link needs reconciliation" : card.estimateMinutes ? `${card.estimateMinutes} min estimate` : "Estimate not set"}</span>
    </button>
    <div className="plan-week-facts">
      {card.sources.map(source => <span key={`${source.kind}:${source.id}`} className={`source-${source.kind}`} title={`${sourceLabel[source.kind]} · ${source.id}`}>
        {sourceLabel[source.kind]}{source.kind === "reservation" && card.reservation ? ` · ${timeLabel(card.reservation.startsAt, timezone)}–${timeLabel(card.reservation.endsAt, timezone)}` : ""}{source.state ? ` · ${source.state.replaceAll("_", " ")}` : ""}
      </span>)}
      {card.dueLocalDate ? <span className="source-deadline">Due by {card.dueLocalDate}</span> : null}
    </div>
  </article>;
}

export function PlanWeekBoard({ board, selectedDate, timezone, onSelectDay, onPreviousWeek, onNextWeek, onOpenTask, onOpenCalendar }: {
  board: PlanBoard;
  selectedDate: string;
  timezone: string;
  onSelectDay: (date: string) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onOpenTask: (id: string) => void;
  onOpenCalendar: (date: string) => void;
}) {
  const selected = board.days.find(day => day.localDate === selectedDate) ?? board.days[0];
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Keep the selected day visible when the board is narrower than seven columns.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const column = scroller?.querySelector<HTMLElement>(`[data-local-date="${selected.localDate}"]`);
    if (!scroller || !column || scroller.scrollWidth <= scroller.clientWidth) return;
    const left = column.offsetLeft - scroller.offsetLeft;
    if (left < scroller.scrollLeft || left + column.offsetWidth > scroller.scrollLeft + scroller.clientWidth) scroller.scrollTo({ left: Math.max(0, left - 8) });
  }, [selected.localDate]);
  return <div className="plan-week-studio">
    <div className="plan-week-toolbar">
      <div><span className="plan-eyebrow">Dated work</span><h3>Week of {displayLocalDate(board.weekStart, timezone, { month: "long", day: "numeric", year: "numeric" })}</h3><p>Planner snapshot · {timezone}. Cards show saved dates and commitments, not proposed time.</p></div>
      <div className="plan-week-arrows">
        <button type="button" aria-label="Previous planning week" onClick={onPreviousWeek}><ChevronLeft size={18} /></button>
        <button type="button" aria-label="Next planning week" onClick={onNextWeek}><ChevronRight size={18} /></button>
      </div>
    </div>
    {!board.complete ? <p role="status" className="plan-coverage-note">This week extends beyond the loaded planner snapshot. Select a fully loaded week to review its work and calendar context.</p> : null}
    <div className="plan-week-phone-days" role="group" aria-label="Planning week">
      {board.days.map(day => <button key={day.localDate} type="button" aria-pressed={selected.localDate === day.localDate} disabled={!day.covered} onClick={() => onSelectDay(day.localDate)}>
        <span>{displayLocalDate(day.localDate, timezone, { weekday: "short" })}</span><strong>{day.localDate.slice(-2)}</strong>
      </button>)}
    </div>
    <div className="plan-week-layout">
      <section className="plan-week-pool" aria-label="Unplanned work">
        <h4>Unplanned work <span>{board.complete ? board.unplanned.length : "—"}</span></h4>
        <p>No planned day or reserved time in this snapshot. Deadlines remain deadlines.</p>
        {board.complete ? (board.unplanned.length ? <ul>{board.unplanned.map(task => <li key={task.id}><button type="button" onClick={() => onOpenTask(task.id)}><strong>{task.title}</strong><span>{task.dueLocalDate ? `Due by ${task.dueLocalDate}` : "No date saved"}</span></button></li>)}</ul> : <p className="plan-week-empty">No unplanned tasks in the loaded snapshot.</p>) : <p className="plan-week-empty">Unplanned context unavailable for this week.</p>}
      </section>
      <div ref={scrollerRef} className="plan-week-scroller" role="region" aria-label="Week board" tabIndex={0}>
        <div className="plan-week-columns">
          {board.days.map(day => <section key={day.localDate} data-local-date={day.localDate} className={`plan-week-day ${day.localDate === selected.localDate ? "is-selected" : ""}`} aria-label={displayLocalDate(day.localDate, timezone, { weekday: "long", month: "long", day: "numeric" })}>
            <button className="plan-week-day-head" type="button" aria-pressed={day.localDate === selected.localDate} disabled={!day.covered} onClick={() => onSelectDay(day.localDate)}><span>{displayLocalDate(day.localDate, timezone, { weekday: "short" })}</span><strong>{day.localDate.slice(-2)}</strong><small>{day.covered ? `${day.cards.length} saved ${day.cards.length === 1 ? "task" : "tasks"}` : "Outside snapshot"}</small></button>
            {day.covered ? day.cards.map(card => <TaskCard key={card.taskId} card={card} timezone={timezone} onOpenTask={onOpenTask} />) : <p className="plan-week-empty">Context unavailable</p>}
          </section>)}
        </div>
      </div>
      <aside className="plan-week-selected" aria-label="Selected day plan">
        <span className="plan-eyebrow">Selected day</span>
        <h4>{displayLocalDate(selected.localDate, timezone, { weekday: "long", month: "short", day: "numeric", year: "numeric" })}</h4>
        {selected.covered ? <><p>{selected.cards.length} saved {selected.cards.length === 1 ? "task" : "tasks"} with explicit dated facts.</p><div className="plan-week-phone-cards">{selected.cards.length ? selected.cards.map(card => <TaskCard key={card.taskId} card={card} timezone={timezone} onOpenTask={onOpenTask} />) : <p className="plan-week-empty">No dated work in this loaded day.</p>}</div><div className="plan-week-events"><h5>External calendar in snapshot</h5>{selected.events.length ? selected.events.map(event => <article key={event.id}><strong>{event.title}</strong><span>{event.isAllDay ? "All day" : `${timeLabel(event.startsAt, timezone)}–${timeLabel(event.endsAt, timezone)}`} · {event.source}</span></article>) : <p>No imported event was returned for this loaded day. Provider coverage may vary.</p>}</div><button type="button" className="plan-week-calendar-link" onClick={() => onOpenCalendar(selected.localDate)}><CalendarDays size={16} /> Review {selected.localDate} in Calendar <ChevronRight size={16} /></button></> : <p>Calendar and plan context for this date is outside the loaded snapshot.</p>}
      </aside>
    </div>
  </div>;
}
