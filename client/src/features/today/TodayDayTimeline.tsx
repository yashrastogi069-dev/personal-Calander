// Compact day timeline (Q12, Q51): planned blocks and outside meetings in time order, with a now-line.
// Meetings are read-only context, styled as external; ticking happens in the list, never here.
import { CalendarClock, CalendarDays, Video } from "lucide-react";
import type { CSSProperties } from "react";
import { toneClassName, type ToneOrNeutral } from "@/design/categoryTone";
import { cn } from "@/lib/utils";
import { clockLabel, clockRange, type TodayEventFact } from "./todayModel";

export type TimelineEntry =
  | { kind: "task"; key: string; taskId: string; title: string; startsAt: Date | string; endsAt: Date | string; tone: ToneOrNeutral; done: boolean }
  | { kind: "meeting"; key: string; title: string; startsAt: Date | string; endsAt: Date | string; joinUrl: string | null };

export type TodayDayTimelineProps = {
  entries: readonly TimelineEntry[];
  allDay: readonly TodayEventFact[];
  now: Date;
  timezone: string;
  onOpenTask: (taskId: string, trigger: HTMLElement) => void;
  onOpenCalendar?: () => void;
};

const time = (value: Date | string) => new Date(value).getTime();

export function TodayDayTimeline({ entries, allDay, now, timezone, onOpenTask, onOpenCalendar }: TodayDayTimelineProps) {
  const nowMs = now.getTime();
  const sorted = [...entries].sort((left, right) => time(left.startsAt) - time(right.startsAt) || left.title.localeCompare(right.title));
  // The now-line sits before the first entry that has not started; running entries keep it after them.
  let nowIndex = sorted.findIndex(entry => time(entry.startsAt) > nowMs);
  if (nowIndex === -1) nowIndex = sorted.length;
  const meetings = sorted.filter(entry => entry.kind === "meeting").length;
  return (
    <section className="td-card td-timeline" aria-labelledby="td-timeline-title" data-today-section="timeline">
      <header className="td-card-head">
        <span className="pc-icon-tile pc-tone-accent" aria-hidden="true"><CalendarClock size={16} strokeWidth={2} /></span>
        <div className="td-card-head-text">
          <h2 id="td-timeline-title">Timeline</h2>
          <p>{sorted.length ? `${sorted.length - meetings} planned ${sorted.length - meetings === 1 ? "block" : "blocks"} · ${meetings} ${meetings === 1 ? "meeting" : "meetings"}` : "No timed plans today"}</p>
        </div>
        {onOpenCalendar ? <button type="button" className="tk-ghost-btn pc-focusable" onClick={onOpenCalendar}><CalendarDays size={14} strokeWidth={2} aria-hidden="true" />Calendar</button> : null}
      </header>
      {allDay.length ? (
        <ul className="td-allday" aria-label="All-day events">
          {allDay.map(event => <li key={event.id}><span>All day</span>{event.title}</li>)}
        </ul>
      ) : null}
      <ol className="td-tl">
        {sorted.map((entry, index) => {
          const past = time(entry.endsAt) <= nowMs;
          const running = time(entry.startsAt) <= nowMs && time(entry.endsAt) > nowMs;
          const minutes = Math.max(15, Math.round((time(entry.endsAt) - time(entry.startsAt)) / 60_000));
          return (
            <li key={entry.key} className="td-tl-slot" style={{ ["--pc-i" as string]: index } as CSSProperties}>
              {index === nowIndex ? <NowLine now={now} timezone={timezone} /> : null}
              <div
                className={cn("td-tl-entry", entry.kind === "meeting" ? "is-external" : toneClassName(entry.tone), past && "is-past", running && "is-running", entry.kind === "task" && entry.done && "is-done")}
                data-timeline-kind={entry.kind}
                style={{ ["--td-len" as string]: Math.min(4, Math.max(1, minutes / 45)) } as CSSProperties}
              >
                <time className="td-tl-time pc-num" dateTime={new Date(entry.startsAt).toISOString()}>{clockLabel(entry.startsAt, timezone)}</time>
                <span className="td-tl-bar" aria-hidden="true" />
                <div className="td-tl-body">
                  {entry.kind === "task" ? (
                    <button type="button" className="td-tl-title pc-focusable" onClick={event => onOpenTask(entry.taskId, event.currentTarget)}>{entry.title}</button>
                  ) : (
                    <span className="td-tl-title">{entry.title}</span>
                  )}
                  <span className="td-tl-meta">
                    {clockRange(entry.startsAt, entry.endsAt, timezone)}
                    {entry.kind === "meeting" ? <span className="td-tl-tag">Calendar</span> : null}
                    {entry.kind === "meeting" && entry.joinUrl ? <a className="td-tl-join pc-focusable" href={entry.joinUrl} target="_blank" rel="noreferrer noopener"><Video size={12} strokeWidth={2.2} aria-hidden="true" />Join</a> : null}
                    {running ? <span className="td-tl-tag is-now">Now</span> : null}
                    {entry.kind === "task" && entry.done ? <span className="td-tl-tag is-done">Done</span> : null}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
        {nowIndex === sorted.length ? <li className="td-tl-slot"><NowLine now={now} timezone={timezone} /></li> : null}
      </ol>
    </section>
  );
}

function NowLine({ now, timezone }: { now: Date; timezone: string }) {
  return (
    <div className="td-now" role="presentation" data-now-line="">
      <span className="td-now-label pc-num"><span className="pc-sr-only">Now, </span>{clockLabel(now, timezone)}</span>
      <span className="td-now-rule" aria-hidden="true" />
    </div>
  );
}
