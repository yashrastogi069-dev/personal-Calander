// Next-up hero (Q12, Q47, Q51): an outside meeting that is on or close ("Standup in 12 min · Join"), else
// the running or next task with Start focus and one D4 "because..." line, else a calm prompt to plan.
import { CalendarDays, CalendarPlus, Play, Video } from "lucide-react";
import type { WhyReason } from "@shared/whyItMatters";
import { capacityTime, clockRange, meetingHeadline, type NextUp, type TodayItem } from "./todayModel";

export type TodayHeroProps = {
  next: NextUp;
  timezone: string;
  because: WhyReason | null;
  /** The task that follows a meeting, offered as a quieter second action. */
  followingTask: TodayItem | null;
  focusDisabledReason?: string | null;
  onStartFocus: (item: TodayItem) => void;
  onOpenCalendar?: () => void;
  onPlanDay: () => void;
};

export function TodayHero({ next, timezone, because, followingTask, focusDisabledReason, onStartFocus, onOpenCalendar, onPlanDay }: TodayHeroProps) {
  if (next.kind === "meeting") {
    const event = next.event;
    return (
      <section className="td-hero is-meeting" aria-labelledby="td-hero-title" data-hero="meeting">
        <p className="td-hero-kicker"><Video size={15} strokeWidth={2} aria-hidden="true" />{next.ongoing ? "Meeting now" : "Next meeting"}</p>
        <h2 id="td-hero-title" className="td-hero-title">{meetingHeadline(next)}</h2>
        <p className="td-hero-meta">{clockRange(event.startsAt, event.endsAt, timezone)} · From your calendar</p>
        <div className="td-hero-actions">
          {next.joinUrl ? (
            <a className="td-hero-btn is-primary pc-focusable" href={next.joinUrl} target="_blank" rel="noreferrer noopener"><Video size={16} strokeWidth={2} aria-hidden="true" />Join</a>
          ) : null}
          {onOpenCalendar ? (
            <button type="button" className="td-hero-btn pc-focusable" onClick={onOpenCalendar}><CalendarDays size={16} strokeWidth={2} aria-hidden="true" />Open calendar</button>
          ) : null}
        </div>
        {followingTask ? (
          <div className="td-hero-after">
            <span>After that</span>
            <strong>{followingTask.title}</strong>
            <button type="button" className="td-hero-link pc-focusable" onClick={() => onStartFocus(followingTask)} disabled={Boolean(focusDisabledReason)} title={focusDisabledReason ?? undefined}>
              <Play size={14} strokeWidth={2.2} aria-hidden="true" />Start focus
            </button>
          </div>
        ) : null}
      </section>
    );
  }
  if (next.kind === "task") {
    const item = next.item;
    const time = item.startsAt ? clockRange(item.startsAt, item.endsAt, timezone) : null;
    const estimate = item.estimateMinutes ? capacityTime(item.estimateMinutes) : null;
    return (
      <section className="td-hero is-task" aria-labelledby="td-hero-title" data-hero="task">
        <p className="td-hero-kicker"><Play size={15} strokeWidth={2} aria-hidden="true" />{next.running ? "Now" : "Up next"}</p>
        <h2 id="td-hero-title" className="td-hero-title">{item.title}</h2>
        {time || estimate ? <p className="td-hero-meta">{[time, estimate].filter(Boolean).join(" · ")}</p> : null}
        {because ? <p className="td-hero-because" title={because.accessible}>Because {because.long.charAt(0).toLowerCase() + because.long.slice(1)}</p> : null}
        <div className="td-hero-actions">
          <button type="button" className="td-hero-btn is-primary pc-focusable" onClick={() => onStartFocus(item)} aria-disabled={focusDisabledReason ? true : undefined} title={focusDisabledReason ?? undefined}>
            <Play size={16} strokeWidth={2.2} aria-hidden="true" />Start focus
          </button>
        </div>
      </section>
    );
  }
  return (
    <section className="td-hero is-empty" aria-labelledby="td-hero-title" data-hero="none">
      <p className="td-hero-kicker"><CalendarPlus size={15} strokeWidth={2} aria-hidden="true" />Up next</p>
      <h2 id="td-hero-title" className="td-hero-title">Nothing is lined up yet</h2>
      <p className="td-hero-meta">Pick what matters today. It takes about two minutes.</p>
      <div className="td-hero-actions">
        <button type="button" className="td-hero-btn is-primary pc-focusable" onClick={onPlanDay}><CalendarPlus size={16} strokeWidth={2} aria-hidden="true" />Plan my day</button>
      </div>
    </section>
  );
}
