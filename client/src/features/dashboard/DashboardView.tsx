// D2 premium Dashboard body. Renders only saved-record facts from DashboardModel;
// the page header (date, greeting, intention, view tabs) belongs to the shell.
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  AlarmClock,
  ArrowUpRight,
  BarChart3,
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Flag,
  Flame,
  ListChecks,
  Milestone,
  Play,
  Repeat,
  Sparkles,
  Sunrise,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { SegmentedTabs } from "@/components/premium/SegmentedTabs";
import { StatusPill, TimeChip } from "@/components/premium/Pills";
import { toneClassName, type ToneOrNeutral } from "@/design/categoryTone";
import { easeOutQuart, prefersReducedMotion as prefersStill, useBecameTrue, useChangeCount } from "@/design/motion";
import { formatMinutes } from "@/design/timeFormat";
import { cn } from "@/lib/utils";
import type {
  DashboardActions,
  DashboardFocusWeek,
  DashboardHabit,
  DashboardHabitConsistency,
  DashboardMilestone,
  DashboardModel,
  DashboardProject,
  DashboardSchedule,
  DashboardScheduleItem,
  DashboardUpNext,
  DashboardWeekDay,
} from "./dashboardTypes";
import "./dashboard.css";

type Lens = "day" | "week";

const ICON = { size: 16, strokeWidth: 2, "aria-hidden": true } as const;

/** Stagger index for the shared pc-rise / pc-grow-* entrance classes. */
const stagger = (index: number) => ({ "--pc-i": index }) as CSSProperties;

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

// ---------------------------------------------------------------------------------------------
// Motion helpers

/**
 * Counts up to `target` once, on first mount. Returns the final value immediately when
 * matchMedia is unavailable (SSR, tests) or the user prefers reduced motion. Later changes jump.
 */
export function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(() => (prefersStill() ? target : 0));
  const settled = useRef(false);
  useEffect(() => {
    if (settled.current || prefersStill() || typeof requestAnimationFrame !== "function") {
      settled.current = true;
      setValue(target);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      setValue(target * easeOutQuart(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
      else settled.current = true;
    };
    frame = requestAnimationFrame(tick);
    // A cancelled run (StrictMode remount, target change) restarts rather than jumping.
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}

/** Animated number; screen readers get the final text only. */
function CountUp({ value, format = n => String(Math.round(n)) }: { value: number; format?: (n: number) => string }) {
  const shown = useCountUp(value);
  return (
    <>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="pc-dash-sr">{format(value)}</span>
    </>
  );
}

function Ring({ value, size, stroke, className }: { value: number; size: number; stroke: number; className?: string }) {
  const radius = (size - stroke) / 2;
  const centre = size / 2;
  const fraction = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
  return (
    <svg className={cn("pc-dash-ring", className)} width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <circle className="pc-dash-ring-track" cx={centre} cy={centre} r={radius} fill="none" strokeWidth={stroke} />
      {fraction > 0 && (
        <circle
          className="pc-dash-ring-arc"
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100 100"
          transform={`rotate(-90 ${centre} ${centre})`}
          style={{ strokeDashoffset: 100 - fraction * 100 }}
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------------------------
// Time helpers (all in the workspace timezone)

function useFormatters(timezone: string) {
  return useMemo(() => {
    const time = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" });
    const clock = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const day = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
    return {
      /** "9:00 AM" for an instant. */
      time(iso: string | null) {
        if (!iso) return null;
        const date = new Date(iso);
        return Number.isFinite(date.getTime()) ? time.format(date) : null;
      },
      /** "10:45 AM" for minutes since local midnight. */
      minuteOfDay(minute: number) {
        return clock.format(new Date(Date.UTC(2000, 0, 1, Math.floor(minute / 60) % 24, minute % 60)));
      },
      /** Local date + minute of day for an instant. */
      local(iso: string) {
        const date = new Date(iso);
        if (!Number.isFinite(date.getTime())) return null;
        const map = Object.fromEntries(parts.formatToParts(date).map(part => [part.type, part.value]));
        return { localDate: `${map.year}-${map.month}-${map.day}`, minute: (Number(map.hour) % 24) * 60 + Number(map.minute) };
      },
      /** "30 Nov" for a YYYY-MM-DD local date. */
      date(localDate: string) {
        const date = new Date(`${localDate}T12:00:00Z`);
        return Number.isFinite(date.getTime()) ? day.format(date) : localDate;
      },
    };
  }, [timezone]);
}

type Formatters = ReturnType<typeof useFormatters>;

// ---------------------------------------------------------------------------------------------
// Day lens layout

type PlacedItem = { item: DashboardScheduleItem; start: number; end: number; col: number; cols: number };

/** Clamps items to the window and assigns side-by-side columns to overlapping items (greedy). */
export function layoutScheduleItems(
  items: readonly DashboardScheduleItem[],
  localDate: string,
  startHour: number,
  endHour: number,
  local: Formatters["local"]
): PlacedItem[] {
  const windowStart = startHour * 60;
  const windowEnd = endHour * 60;
  const rows = items
    .flatMap(item => {
      const start = local(item.startsAt);
      const end = local(item.endsAt);
      if (!start || !end) return [];
      const startMinute = start.localDate < localDate ? 0 : start.localDate > localDate ? 24 * 60 : start.minute;
      const endMinute = end.localDate > localDate ? 24 * 60 : end.localDate < localDate ? 0 : end.minute;
      const clampedStart = Math.max(windowStart, startMinute);
      const clampedEnd = Math.min(windowEnd, Math.max(endMinute, startMinute + 15));
      return clampedEnd > clampedStart ? [{ item, start: clampedStart, end: clampedEnd }] : [];
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const placed: PlacedItem[] = [];
  let cluster: PlacedItem[] = [];
  let clusterEnd = -1;
  let columnEnds: number[] = [];
  const flush = () => {
    const cols = Math.max(1, columnEnds.length);
    for (const entry of cluster) entry.cols = cols;
    cluster = [];
    columnEnds = [];
    clusterEnd = -1;
  };
  for (const row of rows) {
    if (cluster.length && row.start >= clusterEnd) flush();
    let col = columnEnds.findIndex(end => end <= row.start);
    if (col === -1) {
      col = columnEnds.length;
      columnEnds.push(row.end);
    } else {
      columnEnds[col] = row.end;
    }
    const entry: PlacedItem = { ...row, col, cols: 1 };
    cluster.push(entry);
    placed.push(entry);
    clusterEnd = Math.max(clusterEnd, row.end);
  }
  flush();
  return placed;
}

/** Spreads milestone labels over as few lanes as needed so neighbours never overlap. */
export function milestoneLanes(milestones: readonly DashboardMilestone[], minGap = 34): Array<DashboardMilestone & { lane: number }> {
  const laneEnds: number[] = [];
  return [...milestones]
    .sort((a, b) => a.offsetPercent - b.offsetPercent)
    .map(milestone => {
      const offset = Math.max(0, Math.min(100, milestone.offsetPercent));
      let lane = laneEnds.findIndex(last => offset - last >= minGap);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(offset);
      } else {
        laneEnds[lane] = offset;
      }
      return { ...milestone, offsetPercent: offset, lane };
    });
}

// ---------------------------------------------------------------------------------------------
// Cards

function Card({
  id,
  area,
  index,
  className,
  children,
}: {
  id: string;
  area: string;
  index: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("pc-dash-card pc-rise", `pc-dash-area-${area}`, className)} aria-labelledby={id} style={stagger(index)}>
      {children}
    </section>
  );
}

/** Card heading with a quiet leading icon; the icon is decorative, the text is the accessible name. */
function Title({ id, icon: Icon, children, className }: { id: string; icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn("pc-dash-title", className)}>
      <Icon {...ICON} className="pc-dash-title-icon" />
      <span>{children}</span>
    </h2>
  );
}

/** Muted one-line note (empty states) with a leading icon. */
function Note({ icon: Icon, children, className }: { icon: LucideIcon; children: ReactNode; className?: string }) {
  return (
    <p className={cn("pc-dash-muted pc-dash-note", className)}>
      <Icon {...ICON} size={15} />
      <span>{children}</span>
    </p>
  );
}

function HeroCard({ model, actions }: { model: DashboardModel; actions: DashboardActions }) {
  const id = useId();
  const { total, done, segments, dueToday, overdue, openPlannedMinutes } = model.commitments;
  // A later completion rolls the figure in; the first paint keeps the count-up.
  const doneChanges = useChangeCount(done);
  const pills = [
    dueToday > 0 ? `${dueToday} due today` : null,
    overdue > 0 ? `${overdue} overdue` : null,
    openPlannedMinutes ? `${formatMinutes(openPlannedMinutes)} focus left` : null,
  ].filter((value): value is string => value != null);
  const segmented = segments.length > 0 && segments.length <= 12;
  const complete = total > 0 && done >= total;
  return (
    <Card id={id} area="hero" index={0} className={cn("pc-dash-hero", complete && "is-complete")}>
      <header className="pc-dash-hero-head">
        <Title id={id} icon={ListChecks}>Today's commitments</Title>
        <button type="button" className="pc-dash-hero-open" onClick={actions.openToday} aria-label="Open Today">
          <ArrowUpRight {...ICON} size={18} />
        </button>
      </header>
      {total > 0 ? (
        <>
          <div className="pc-dash-hero-main">
            <p className="pc-dash-hero-count pc-num">
              <span key={doneChanges} className={cn("pc-dash-hero-done", doneChanges > 0 && "pc-dash-tick")}>
                {doneChanges > 0 ? done : <CountUp value={done} />}
              </span>
              <span className="pc-dash-hero-of"> / {total} done</span>
            </p>
            <span className="pc-dash-hero-ring">
              <Ring value={done / total} size={76} stroke={9} className="pc-dash-ring-hero" />
              {complete && <Check {...ICON} size={26} strokeWidth={3} className="pc-dash-hero-check" />}
            </span>
          </div>
          {segmented ? (
            <div className="pc-dash-segbar" aria-hidden="true">
              {segments.map((segment, index) => (
                <span key={index} className={cn("pc-grow-x", segment === "done" && "is-done")} style={stagger(index)} />
              ))}
            </div>
          ) : (
            <div className="pc-dash-segbar is-continuous" aria-hidden="true">
              <span className="pc-grow-x is-done" style={{ flexBasis: `${(done / total) * 100}%` }} />
            </div>
          )}
          {pills.length > 0 && (
            <ul className="pc-dash-hero-pills">
              {pills.map(pill => (
                <li key={pill} className="pc-dash-hero-pill pc-num">{pill}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="pc-dash-hero-empty">
          <Sunrise {...ICON} size={22} className="pc-dash-hero-empty-icon" />
          <p>Nothing committed yet</p>
          <button type="button" className="pc-dash-btn pc-dash-btn-light" onClick={actions.openPlanDay}>Plan the day</button>
        </div>
      )}
    </Card>
  );
}

function HabitConsistencyCard({ data }: { data: DashboardHabitConsistency }) {
  const id = useId();
  const counts = data.days.reduce<Record<string, number>>((acc, day) => ({ ...acc, [day.level]: (acc[day.level] ?? 0) + 1 }), {});
  const stripLabel = `Last ${data.days.length} days: ${counts.full ?? 0} complete, ${counts.partial ?? 0} partial, ${counts.missed ?? 0} missed, ${counts.none ?? 0} with nothing scheduled`;
  return (
    <Card id={id} area="habit" index={1} className="pc-dash-kpi">
      <header className="pc-dash-kpi-head">
        <span className="pc-dash-kpi-icon pc-tone-health"><Repeat {...ICON} /></span>
        <h2 id={id}>
          <span className="pc-dash-long">Habit consistency · {data.windowDays} days</span>
          <span className="pc-dash-short">Habits {data.windowDays}d</span>
        </h2>
      </header>
      {data.percent == null ? (
        <p className="pc-dash-kpi-empty">No scheduled habits yet</p>
      ) : (
        <>
          <div className="pc-dash-kpi-metric">
            <Ring value={data.percent / 100} size={60} stroke={8} className="pc-dash-ring-done pc-dash-kpi-detail" />
            <p className="pc-dash-kpi-figure">
              <b className="pc-num"><CountUp value={data.percent} format={n => `${Math.round(n)}%`} /></b>
              <span className="pc-dash-kpi-sub pc-dash-kpi-detail pc-num">{data.completed} of {data.scheduled} check-ins</span>
            </p>
          </div>
          <ol className="pc-dash-days pc-dash-kpi-detail" aria-label={stripLabel}>
            {data.days.map((day, index) => (
              <li key={day.localDate} className={cn("pc-dash-sq pc-pop", `is-${day.level}`)} style={stagger(index)} title={`${day.localDate}: ${day.level}`} />
            ))}
          </ol>
        </>
      )}
    </Card>
  );
}

function FocusCard({ data, actions }: { data: DashboardFocusWeek; actions: DashboardActions }) {
  const id = useId();
  const scale = Math.max(data.actualMinutes, data.plannedMinutes ?? 0, 1);
  return (
    <Card id={id} area="focus" index={2} className="pc-dash-kpi">
      <header className="pc-dash-kpi-head">
        <span className="pc-dash-kpi-icon pc-tone-personal"><Timer {...ICON} /></span>
        <h2 id={id}>
          <span className="pc-dash-long">Focus this week</span>
          <span className="pc-dash-short">Focus week</span>
        </h2>
      </header>
      {data.actualMinutes <= 0 ? (
        <div className="pc-dash-kpi-empty">
          <p>No focus logged this week</p>
          <button type="button" className="pc-dash-link pc-dash-kpi-detail" onClick={actions.openFocus}>
            <Play {...ICON} size={14} /> Start focus
          </button>
        </div>
      ) : (
        <>
          <p className="pc-dash-kpi-figure is-inline">
            <b className="pc-num"><CountUp value={data.actualMinutes} format={formatMinutes} /></b>
            <span className="pc-dash-kpi-sub pc-dash-kpi-detail pc-num">
              {data.plannedMinutes ? `of ${formatMinutes(data.plannedMinutes)} planned` : "tracked"}
            </span>
          </p>
          <div className="pc-dash-stack pc-dash-kpi-detail" aria-hidden="true">
            {data.byTone.map((entry, index) => (
              <span
                key={`${entry.tone}-${entry.label}`}
                className={cn("pc-grow-x", toneClassName(entry.tone))}
                style={{ ...stagger(index), width: `${(entry.minutes / scale) * 100}%` }}
              />
            ))}
          </div>
          <ul className="pc-dash-legend pc-dash-kpi-detail">
            {data.byTone.map(entry => (
              <li key={`${entry.tone}-${entry.label}`} className={toneClassName(entry.tone)}>
                <span className="pc-dot" aria-hidden="true" />
                {entry.label} <b className="pc-num">{formatMinutes(entry.minutes)}</b>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

function DueCard({ model, actions }: { model: DashboardModel; actions: DashboardActions }) {
  const id = useId();
  const { dueToday, overdue } = model.commitments;
  const clear = dueToday === 0 && overdue === 0;
  return (
    <Card id={id} area="due" index={3} className={cn("pc-dash-kpi pc-dash-due", clear && "is-clear")}>
      <header className="pc-dash-kpi-head">
        <span className="pc-dash-kpi-icon pc-dash-due-icon">{clear ? <CalendarCheck2 {...ICON} /> : <AlarmClock {...ICON} />}</span>
        <h2 id={id}>Due</h2>
      </header>
      {clear ? (
        <p className="pc-dash-due-clear">
          <CheckCircle2 {...ICON} size={20} />
          <span>Nothing due</span>
        </p>
      ) : (
        <>
          <p className="pc-dash-kpi-figure">
            <b className="pc-num"><CountUp value={dueToday} /></b>
            <span className="pc-dash-kpi-sub pc-num">
              today{overdue > 0 ? ` · ${overdue} overdue` : ""}
            </span>
          </p>
          <button type="button" className="pc-dash-link pc-dash-due-review" onClick={() => actions.openTasks(overdue > 0 ? "overdue" : "today")}>
            Review<span className="pc-dash-sr"> {overdue > 0 ? "overdue tasks" : "tasks due today"}</span>
          </button>
        </>
      )}
    </Card>
  );
}

function DayLens({ schedule, model, actions, fmt }: { schedule: DashboardSchedule; model: DashboardModel; actions: DashboardActions; fmt: Formatters }) {
  const scroller = useRef<HTMLDivElement>(null);
  const hours = Math.max(1, schedule.endHour - schedule.startHour);
  const windowStart = schedule.startHour * 60;
  const placed = useMemo(
    () => layoutScheduleItems(schedule.items, model.localDate, schedule.startHour, schedule.endHour, fmt.local),
    [schedule.items, model.localDate, schedule.startHour, schedule.endHour, fmt]
  );
  const anchorMinute = schedule.nowMinute ?? placed[0]?.start ?? null;

  useEffect(() => {
    const element = scroller.current;
    if (!element || anchorMinute == null || element.scrollHeight <= element.clientHeight) return;
    const hourPx = element.scrollHeight / hours;
    element.scrollTop = Math.max(0, ((anchorMinute - windowStart) / 60 - 0.75) * hourPx);
    // Only on first mount of the lens; later data changes keep the user's scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!schedule.items.length) {
    return (
      <div className="pc-dash-empty">
        <CalendarDays {...ICON} size={20} />
        <p>Nothing is scheduled today</p>
        <button type="button" className="pc-dash-btn pc-dash-btn-accent" onClick={actions.openPlanDay}>Plan the day</button>
      </div>
    );
  }

  return (
    <div className="pc-dash-day-scroll" ref={scroller}>
      <div className="pc-dash-day" style={{ "--pc-dash-hours": hours } as CSSProperties}>
        {Array.from({ length: hours }, (_, index) => (
          <div key={index} className="pc-dash-hour" style={{ "--pc-dash-at": index } as CSSProperties}>
            <span className="pc-num">{fmt.minuteOfDay((schedule.startHour + index) * 60)}</span>
          </div>
        ))}
        <ol className="pc-dash-day-lane" aria-label="Today's timeline">
          {placed.map(({ item, start, end, col, cols }) => {
            const range = `${fmt.time(item.startsAt) ?? ""}-${fmt.time(item.endsAt) ?? ""}`;
            const style = {
              "--pc-dash-top": (start - windowStart) / 60,
              "--pc-dash-len": (end - start) / 60,
              "--pc-dash-col": col,
              "--pc-dash-cols": cols,
            } as CSSProperties;
            const compact = end - start < 45;
            if (item.kind === "appointment" || !item.taskId) {
              return (
                <li key={item.id} className={cn("pc-dash-ev is-busy", compact && "is-compact")} style={style}>
                  <span className="pc-dash-ev-title">{item.title}</span>
                  <span className="pc-dash-ev-meta pc-num">{range} · busy</span>
                </li>
              );
            }
            const taskId = item.taskId;
            return (
              <li key={item.id} className={cn("pc-dash-ev-slot", compact && "is-compact")} style={style}>
                <button
                  type="button"
                  className={cn("pc-dash-ev is-task", toneClassName(item.tone), item.done && "is-done")}
                  onClick={event => actions.openTask(taskId, event.currentTarget)}
                  aria-label={`${item.title}, ${range}${item.done ? ", done" : ""}`}
                >
                  <span className="pc-dash-ev-title">
                    {item.done ? <CheckCircle2 {...ICON} size={14} /> : <Circle {...ICON} size={14} />}
                    <span>{item.title}</span>
                  </span>
                  <span className="pc-dash-ev-meta pc-num">{range}{item.categoryName ? ` · ${item.categoryName}` : ""}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {schedule.nowMinute != null && (
          <div className="pc-dash-now" style={{ "--pc-dash-top": (schedule.nowMinute - windowStart) / 60 } as CSSProperties} data-testid="dashboard-now-line">
            <span className="pc-dash-now-dot pc-pulse" aria-hidden="true" />
            <span className="pc-dash-now-time pc-num">
              <span className="pc-dash-sr">Now </span>
              {fmt.minuteOfDay(schedule.nowMinute)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function WeekLens({ week, actions }: { week: DashboardWeekDay[]; actions: DashboardActions }) {
  return (
    <ol className="pc-dash-weeklens">
      {week.map(day => (
        <li key={day.localDate}>
          <button
            type="button"
            className={cn("pc-dash-weekday", day.isToday && "is-today", day.isFuture && "is-future")}
            onClick={actions.openCalendar}
            aria-label={`${day.isToday ? "Today" : day.label}: ${day.done} of ${day.committed} done, ${plural(day.events, "event")}. Open Calendar`}
          >
            <span className="pc-dash-weekday-name">{day.isToday ? "Today" : day.label}</span>
            <span className="pc-dash-weekday-count pc-num"><b>{day.done}</b>/{day.committed}</span>
            <span className="pc-dash-weekday-bar" aria-hidden="true">
              <span style={{ width: day.committed ? `${(day.done / day.committed) * 100}%` : 0 }} />
            </span>
            <span className="pc-dash-weekday-events pc-num">{day.events ? plural(day.events, "event") : "No events"}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function ScheduleCard({ model, actions, fmt }: { model: DashboardModel; actions: DashboardActions; fmt: Formatters }) {
  const id = useId();
  const [lens, setLens] = useState<Lens>("day");
  const { schedule } = model;
  return (
    <Card id={id} area="sched" index={4} className="pc-dash-schedule">
      <header className="pc-dash-head pc-dash-schedule-head">
        <Title id={id} icon={CalendarClock}>Schedule</Title>
        <SegmentedTabs<Lens>
          label="Schedule lens"
          value={lens}
          onValueChange={setLens}
          activationMode="automatic"
          items={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }]}
        />
        <span className="pc-time pc-dash-capacity">
          Planned <b>{schedule.plannedMinutes == null ? "—" : formatMinutes(schedule.plannedMinutes)}</b> · Free <b>{formatMinutes(schedule.freeMinutes)}</b>
        </span>
        <button type="button" className="pc-dash-btn pc-dash-btn-ghost pc-dash-schedule-open" onClick={actions.openCalendar}>
          Open Calendar <ArrowUpRight {...ICON} size={15} />
        </button>
      </header>
      {lens === "day" && schedule.allDay.length > 0 && (
        <ul className="pc-dash-allday" aria-label="All day">
          {schedule.allDay.map(item => (
            <li key={item.id}><span className="pc-dash-allday-tag">All day</span> {item.title}</li>
          ))}
        </ul>
      )}
      <div key={lens} className="pc-dash-lens" data-lens={lens}>
        {lens === "day" ? <DayLens schedule={schedule} model={model} actions={actions} fmt={fmt} /> : <WeekLens week={model.week} actions={actions} />}
      </div>
      {lens === "day" && schedule.unscheduledCount > 0 && (
        <button type="button" className="pc-dash-link pc-dash-unscheduled" onClick={actions.openToday}>
          {plural(schedule.unscheduledCount, "unscheduled task")}
          <ArrowUpRight {...ICON} size={14} />
        </button>
      )}
    </Card>
  );
}

function upNextTiming(upNext: DashboardUpNext): string {
  if (upNext.timing === "now") return "Now";
  if (upNext.timing === "anytime") return "Anytime";
  if (upNext.minutesUntil == null) return "Up next";
  if (upNext.minutesUntil < 1) return "Up next · starting";
  return `Up next · in ${upNext.minutesUntil < 60 ? `${upNext.minutesUntil} min` : formatMinutes(upNext.minutesUntil)}`;
}

function UpNextCard({ model, actions, fmt }: { model: DashboardModel; actions: DashboardActions; fmt: Formatters }) {
  const id = useId();
  const laterId = useId();
  const { upNext, laterToday } = model;
  const start = upNext ? fmt.time(upNext.startsAt) : null;
  const end = upNext ? fmt.time(upNext.endsAt) : null;
  return (
    <Card id={id} area="up" index={5} className="pc-dash-night">
      <h2 id={id} className="pc-dash-sr">Up next</h2>
      {upNext ? (
        <div className="pc-dash-up">
          <div className="pc-dash-up-pills">
            <span className={cn("pc-dash-night-pill", upNext.timing === "now" && "is-now")}>
              {upNext.timing === "now" ? (
                <span className="pc-live pc-dash-live" aria-hidden="true" />
              ) : upNext.timing === "next" ? (
                <Clock3 {...ICON} size={13} />
              ) : null}
              {upNextTiming(upNext)}
            </span>
            {upNext.categoryName && (
              <span className={cn("pc-dash-night-pill", toneClassName(upNext.tone))}>
                <span className="pc-dot" aria-hidden="true" />
                {upNext.categoryName}
              </span>
            )}
          </div>
          <p className="pc-dash-up-title">{upNext.title}</p>
          {upNext.projectTitle && (
            <p className="pc-dash-up-project">Part of <b>{upNext.projectTitle}</b></p>
          )}
          <div className="pc-dash-up-meta">
            {start && end && <span className="pc-dash-up-range pc-num">{start}-{end}</span>}
            <TimeChip plannedMinutes={upNext.plannedMinutes} actualMinutes={upNext.actualMinutes} className="pc-dash-time-night" />
          </div>
          <div className="pc-dash-up-actions">
            <button type="button" className="pc-dash-btn pc-dash-btn-light" onClick={() => actions.startFocus(upNext.taskId)}>
              <Play {...ICON} size={14} fill="currentColor" /> Start focus
            </button>
            <button type="button" className="pc-dash-btn pc-dash-btn-night" onClick={event => actions.openTask(upNext.taskId, event.currentTarget)}>
              Open<span className="pc-dash-sr"> {upNext.title}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="pc-dash-up is-clear">
          <p className="pc-dash-up-title">You're clear for now</p>
          <div className="pc-dash-up-actions">
            <button type="button" className="pc-dash-btn pc-dash-btn-light" onClick={actions.openPlanDay}>Plan the day</button>
          </div>
        </div>
      )}
      <section className="pc-dash-later" aria-labelledby={laterId}>
        <h3 id={laterId}>Later today</h3>
        {laterToday.length ? (
          <ul>
            {laterToday.map(item => (
              <li key={item.id} className={toneClassName(item.kind === "appointment" ? "neutral" : item.tone)}>
                <span className="pc-dot" aria-hidden="true" />
                <span className="pc-dash-later-title">{item.title}</span>
                <time className="pc-num" dateTime={item.startsAt}>{fmt.time(item.startsAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pc-dash-later-empty">Nothing else is timed today</p>
        )}
      </section>
    </Card>
  );
}

function WeekRhythmCard({ week, actions }: { week: DashboardWeekDay[]; actions: DashboardActions }) {
  const id = useId();
  const max = Math.max(1, ...week.map(day => day.committed));
  const committed = week.reduce((sum, day) => sum + day.committed, 0);
  const done = week.reduce((sum, day) => sum + day.done, 0);
  return (
    <Card id={id} area="week" index={6} className="pc-dash-rhythm">
      <header className="pc-dash-head">
        <div>
          <Title id={id} icon={BarChart3}>Week rhythm</Title>
          <p className="pc-dash-head-sub pc-num">{committed ? `${done} of ${committed} done this week` : "Nothing committed this week"}</p>
        </div>
        <ul className="pc-dash-rhythm-legend">
          <li><span className="pc-dash-swatch is-done" aria-hidden="true" />Done</li>
          <li><span className="pc-dash-swatch is-hatched" aria-hidden="true" />Committed</li>
        </ul>
      </header>
      <ol className="pc-dash-bars">
        {week.map((day, index) => {
          const remaining = Math.max(0, day.committed - day.done);
          const label = `${day.isToday ? "Today" : day.label}: ${day.isFuture ? `${day.committed} committed` : `${day.done} of ${day.committed} done`}`;
          return (
            <li key={day.localDate} className={cn("pc-dash-bar", day.isToday && "is-today", day.isFuture && "is-future")} aria-label={label}>
              <div className="pc-dash-bar-track" aria-hidden="true">
                {day.isToday && day.committed > 0 && (
                  <span className="pc-dash-bar-bubble pc-num">{day.done} of {day.committed}</span>
                )}
                {day.committed === 0 ? (
                  <span className="pc-dash-bar-tick" />
                ) : (
                  <span className="pc-dash-bar-stack pc-grow-y" style={{ ...stagger(index), height: `${(day.committed / max) * 100}%` }}>
                    {remaining > 0 && <span className="pc-dash-bar-rest" style={{ flexGrow: remaining }} />}
                    {!day.isFuture && day.done > 0 && <span className="pc-dash-bar-done" style={{ flexGrow: day.done }} />}
                  </span>
                )}
              </div>
              <span className="pc-dash-bar-label" aria-hidden="true">{day.isToday ? "Today" : day.label}</span>
            </li>
          );
        })}
      </ol>
      <nav className="pc-dash-thread" aria-label="Weekly planning">
        <button type="button" className="pc-dash-quiet" onClick={actions.openWeeklyPlan} aria-label="Open weekly objectives">
          <CalendarRange {...ICON} size={14} className="pc-dash-lead" /> Weekly objectives <ArrowUpRight {...ICON} size={13} className="pc-dash-nudge" />
        </button>
        <button type="button" className="pc-dash-quiet" onClick={actions.openReviewHistory} aria-label="Open saved reviews">
          <Sparkles {...ICON} size={14} className="pc-dash-lead" /> Saved reviews <ArrowUpRight {...ICON} size={13} className="pc-dash-nudge" />
        </button>
      </nav>
    </Card>
  );
}

function ProjectRow({ project, actions, fmt }: { project: DashboardProject; actions: DashboardActions; fmt: Formatters }) {
  const meta = [`${project.done} of ${project.total} tasks`, project.dueLocalDate ? `due ${fmt.date(project.dueLocalDate)}` : null].filter(Boolean).join(" · ");
  return (
    <li>
      <button type="button" className={cn("pc-dash-project", toneClassName(project.tone))} onClick={() => actions.openProject(project.id)}>
        <Ring value={project.total ? project.done / project.total : 0} size={36} stroke={5} className="pc-dash-ring-tone" />
        <span className="pc-dash-project-text">
          <span className="pc-dash-project-title">{project.title}</span>
          <span className="pc-dash-project-meta pc-num">{meta}</span>
        </span>
        {project.status && project.statusLabel && <StatusPill status={project.status} label={project.statusLabel} />}
      </button>
    </li>
  );
}

function GoalsCard({ model, actions, fmt }: { model: DashboardModel; actions: DashboardActions; fmt: Formatters }) {
  const id = useId();
  const stripId = useId();
  const lanes = milestoneLanes(model.milestones);
  const laneCount = lanes.reduce((max, item) => Math.max(max, item.lane + 1), 0);
  return (
    <Card id={id} area="goals" index={7} className="pc-dash-goals">
      <header className="pc-dash-head">
        <Title id={id} icon={Target}>Goals &amp; Projects</Title>
        <div className="pc-dash-head-links">
          <button type="button" className="pc-dash-quiet" onClick={actions.openGoals} aria-label="Open goals">
            <Target {...ICON} size={14} className="pc-dash-lead" /> Goals
          </button>
          <button type="button" className="pc-dash-link" onClick={actions.openRoadmap}>
            <Milestone {...ICON} size={14} className="pc-dash-lead" /> Open roadmap
          </button>
        </div>
      </header>
      {model.projects.length ? (
        <ul className="pc-dash-projects">
          {model.projects.map(project => <ProjectRow key={project.id} project={project} actions={actions} fmt={fmt} />)}
        </ul>
      ) : (
        <Note icon={Flag}>No active projects</Note>
      )}
      <section className="pc-dash-strip" aria-labelledby={stripId}>
        <h3 id={stripId}>Next 30 days</h3>
        {lanes.length ? (
          <>
            <div className="pc-dash-strip-line" aria-hidden="true">
              {lanes.map(milestone => (
                <span key={milestone.id} className="pc-dash-strip-marker pc-pop" style={{ left: `${milestone.offsetPercent}%` }} />
              ))}
            </div>
            <ol className="pc-dash-strip-labels" style={{ "--pc-dash-lanes": laneCount } as CSSProperties}>
              {lanes.map(milestone => (
                <li
                  key={milestone.id}
                  className={cn(milestone.offsetPercent < 18 && "is-start", milestone.offsetPercent > 82 && "is-end")}
                  style={{ left: `${milestone.offsetPercent}%`, "--pc-dash-lane": milestone.lane } as CSSProperties}
                >
                  <span className="pc-dash-strip-title">{milestone.title}</span> · <time dateTime={milestone.dueLocalDate}>{fmt.date(milestone.dueLocalDate)}</time>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <Note icon={Milestone}>No milestones in the next 30 days</Note>
        )}
      </section>
    </Card>
  );
}

const TRACE_LABEL: Record<DashboardHabit["trace"][number], string> = {
  completed: "completed",
  missed: "missed",
  skipped: "skipped",
  unrecorded: "not recorded",
};

function habitStatusLine(habit: DashboardHabit): string {
  if (habit.state === "completed") return habit.streak > 1 ? `Done · ${habit.streak}-day streak` : "Done";
  if (habit.weekProgress) return `${habit.weekProgress.completed} of ${habit.weekProgress.target} this week`;
  if (habit.state === "skipped") return "Skipped today";
  if (habit.state === "missed") return "Missed today";
  if (habit.streak > 0) return `Streak of ${habit.streak}`;
  return "Due today";
}

function HabitItem({ habit, disabled, onCheckIn }: { habit: DashboardHabit; disabled: boolean; onCheckIn: () => void }) {
  const completed = habit.state === "completed";
  // Celebrate only the moment a check-in lands, never a habit that loads already done.
  const celebrating = useBecameTrue(completed);
  const traceCounts = habit.trace.reduce<Record<string, number>>((acc, state) => ({ ...acc, [state]: (acc[state] ?? 0) + 1 }), {});
  const traceLabel = `Last 7 days: ${Object.entries(traceCounts).map(([state, count]) => `${count} ${TRACE_LABEL[state as keyof typeof TRACE_LABEL]}`).join(", ")}`;
  return (
    <li className={cn("pc-dash-habit", toneClassName(habit.tone), completed && "is-done", celebrating && "is-celebrating")}>
      <span className="pc-dash-check-wrap">
        <button
          type="button"
          className="pc-dash-check"
          aria-pressed={completed}
          aria-label={`Check in ${habit.title}`}
          disabled={disabled}
          onClick={onCheckIn}
        >
          {/* Always rendered so the stroke can draw in when the state flips. */}
          <Check {...ICON} size={18} strokeWidth={3} className="pc-dash-check-mark" />
        </button>
        <span className="pc-dash-burst" aria-hidden="true" />
      </span>
      <div className="pc-dash-habit-text">
        <p className="pc-dash-habit-title">{habit.title}</p>
        <p className="pc-dash-habit-status pc-num">
          {completed && habit.streak > 1 && <Flame {...ICON} size={13} className="pc-dash-streak" />}
          {habitStatusLine(habit)}
        </p>
        <ol className="pc-dash-trace" aria-label={traceLabel}>
          {habit.trace.map((state, index) => (
            <li key={index} className={`is-${state}`} />
          ))}
        </ol>
      </div>
    </li>
  );
}

function HabitsCard({ model, actions, pending, error }: { model: DashboardModel; actions: DashboardActions; pending: boolean; error: string | null }) {
  const id = useId();
  const habits = model.habitsToday;
  const checkedIn = habits.filter(habit => habit.state === "completed").length;
  const checkedInChanges = useChangeCount(checkedIn);
  const canCheckIn = typeof actions.checkInHabit === "function";
  return (
    <Card id={id} area="habits" index={8} className="pc-dash-habits">
      <header className="pc-dash-head">
        <Title id={id} icon={Repeat}>Habits due today</Title>
        {habits.length > 0 && (
          <span className="pc-time pc-num">
            Checked in{" "}
            <b key={checkedInChanges} className={checkedInChanges > 0 ? "pc-dash-tick" : undefined}>
              {checkedIn} of {habits.length}
            </b>
          </span>
        )}
      </header>
      {error && <p className="pc-dash-habit-error" role="alert">{error}</p>}
      {habits.length ? (
        <ul className="pc-dash-habit-row" aria-busy={pending || undefined}>
          {habits.map(habit => (
            <HabitItem key={habit.id} habit={habit} disabled={!canCheckIn || pending} onCheckIn={() => actions.checkInHabit?.(habit.id)} />
          ))}
        </ul>
      ) : (
        <div className="pc-dash-empty is-inline">
          <p className="pc-dash-note"><Repeat {...ICON} size={16} /><span>No habits due today</span></p>
          <button type="button" className="pc-dash-link" onClick={actions.openHabits}>Open habits</button>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------

export function DashboardView({
  model,
  actions,
  timezone,
  habitPending = false,
  habitError = null,
}: {
  model: DashboardModel;
  actions: DashboardActions;
  timezone: string;
  /** A habit write is in flight; check-ins wait so a double tap cannot send a conflicting create. */
  habitPending?: boolean;
  habitError?: string | null;
}) {
  const fmt = useFormatters(timezone);
  return (
    <section className="pc-dash" aria-label="Dashboard">
      <HeroCard model={model} actions={actions} />
      <HabitConsistencyCard data={model.habitConsistency} />
      <FocusCard data={model.focusWeek} actions={actions} />
      <DueCard model={model} actions={actions} />
      <ScheduleCard model={model} actions={actions} fmt={fmt} />
      <UpNextCard model={model} actions={actions} fmt={fmt} />
      <WeekRhythmCard week={model.week} actions={actions} />
      <GoalsCard model={model} actions={actions} fmt={fmt} />
      <HabitsCard model={model} actions={actions} pending={habitPending} error={habitError} />
    </section>
  );
}

export type { ToneOrNeutral };
