import { CanonicalTaskRow } from "@/features/tasks/CanonicalTaskRow";
import type { CanonicalTask } from "@shared/canonicalTask";
import type { TodayProjection } from "@shared/todayProjection";
import { CalendarClock, LockKeyhole } from "lucide-react";

type TimelineRow = TodayProjection["timeline"][number];

export type TodayTimelineProps = {
  rows: TimelineRow[];
  tasks: CanonicalTask[];
  timezone: string;
  projectTitles: ReadonlyMap<string, string>;
  goalTitles: ReadonlyMap<string, string>;
  categoryNames: ReadonlyMap<string, string>;
  pendingTaskIds: ReadonlySet<string>;
  onToggleTask: (task: CanonicalTask) => void | Promise<unknown>;
  onArchiveTask?: (task: CanonicalTask) => void | Promise<unknown>;
  onStartFocus: (task: CanonicalTask) => void;
  onOpenTask: (task: CanonicalTask, trigger: HTMLElement) => void;
};

function timeLabel(value: Date | string, timezone: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function TodayTimeline({
  rows,
  tasks,
  timezone,
  projectTitles,
  goalTitles,
  categoryNames,
  pendingTaskIds,
  onToggleTask,
  onArchiveTask,
  onStartFocus,
  onOpenTask,
}: TodayTimelineProps) {
  const taskById = new Map(tasks.map(task => [task.id, task]));
  const externalCount = rows.filter(row => row.kind === "appointment").length;

  return (
    <section className="today-timeline" data-today-section="timeline" aria-labelledby="today-timeline-heading">
      <header className="today-section-heading">
        <div>
          <span>Chronology</span>
          <h2 id="today-timeline-heading">Fixed time first</h2>
        </div>
        <small>{rows.length ? `${rows.length} timed ${rows.length === 1 ? "item" : "items"}` : "Open day"}</small>
      </header>

      <div className="today-timeline-list">
        {rows.map(row => {
          const start = row.startsAt ? timeLabel(row.startsAt, timezone) : "Time unavailable";
          const end = row.endsAt ? timeLabel(row.endsAt, timezone) : "Time unavailable";
          if (row.kind === "appointment") {
            return (
              <article className="today-appointment-row" key={`appointment:${row.recordId}`} data-calendar-source="external">
                <time dateTime={new Date(row.startsAt).toISOString()}>{start}</time>
                <span className="today-timeline-marker" aria-hidden="true"><i /></span>
                <div>
                  <span className="today-source-label"><LockKeyhole aria-hidden="true" size={14} /> External calendar · Read-only context</span>
                  <h3>{row.title}</h3>
                  <p>{start}–{end} · Fixed appointment</p>
                </div>
              </article>
            );
          }

          const task = taskById.get(row.recordId);
          if (!task) return null;
          return (
            <article className="today-reservation-row" key={`task:${row.recordId}`}>
              <time dateTime={new Date(row.startsAt as Date | string).toISOString()}>{start}</time>
              <span className="today-timeline-marker is-task" aria-hidden="true"><i /></span>
              <div>
                <span className="today-source-label"><CalendarClock aria-hidden="true" size={14} /> Reserved task · Actionable here</span>
                <CanonicalTaskRow
                  task={task}
                  context={{
                    surface: "today",
                    localDate: row.startsAt ? new Intl.DateTimeFormat("en-CA", {
                      timeZone: timezone,
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    }).format(new Date(row.startsAt)) : "",
                    timezone,
                    projectTitle: task.projectId ? projectTitles.get(task.projectId) : null,
                    goalTitle: task.goalId ? goalTitles.get(task.goalId) : null,
                    categoryName: task.categoryId ? categoryNames.get(task.categoryId) : null,
                  }}
                  pending={pendingTaskIds.has(task.id) || String(task.id).startsWith("offline:")}
                  contextualActionLabel={task.state === "blocked" ? "Review blockers" : "Start focus"}
                  onToggle={onToggleTask}
                  onArchive={onArchiveTask}
                  onPrimaryAction={(record, _actionId, trigger) => task.state === "blocked" ? onOpenTask(record, trigger) : onStartFocus(record)}
                  onOpenDetail={onOpenTask}
                />
                <small className="today-time-range">{start}–{end}</small>
              </div>
            </article>
          );
        })}
        {!rows.length ? (
          <div className="today-timeline-empty">
            <CalendarClock aria-hidden="true" size={20} />
            <div><strong>No fixed time yet</strong><span>Flexible work can stay flexible until a reservation is useful.</span></div>
          </div>
        ) : null}
      </div>

      {!externalCount ? (
        <p className="today-calendar-boundary">
          <LockKeyhole aria-hidden="true" size={16} />
          <span><strong>No incoming calendar appointments.</strong> Apple Calendar subscription is outgoing only; no Apple appointment is implied here.</span>
        </p>
      ) : null}
    </section>
  );
}
