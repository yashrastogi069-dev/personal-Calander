// Tasks T2a: the one Archive (owner decision Q9) with a Completed | Archived switch. Completed is work finished
// before today, grouped by week with counts and time (`completedArchive`); Archived is work put away without
// doing it (`archivedList`). Both search and Restore. Work finished today is not here yet: it dims in place in
// the List until midnight (display rule only, nothing is moved or deleted).
import type { CanonicalTask } from "@shared/canonicalTask";
import { archivedList, completedArchive } from "@shared/taskListGroups";
import { localDateForInstant, weekdayDayMonthLabel } from "@shared/taskDateLabels";
import type { RowPill } from "@shared/taskRowPills";
import { Archive, CircleCheck, Info, Search, Undo2, X } from "lucide-react";
import type { ToneOrNeutral } from "@/design/categoryTone";
import { SegmentedTabs } from "@/components/premium/SegmentedTabs";
import { formatMinutes } from "@/design/timeFormat";
import { cn } from "@/lib/utils";
import { TaskRowPills } from "./TaskRowPills";
import "./tasks-premium.css";

export type TaskArchiveTab = "completed" | "archived";

export type TaskArchiveProps = {
  tasks: readonly CanonicalTask[];
  today: string;
  timezone: string;
  tab: TaskArchiveTab;
  onTabChange: (tab: TaskArchiveTab) => void;
  query: string;
  onQueryChange: (query: string) => void;
  pillsFor: (task: CanonicalTask) => readonly RowPill[];
  categoryTones?: ReadonlyMap<string, ToneOrNeutral>;
  onRestore: (task: CanonicalTask) => void | Promise<unknown>;
  onOpenDetail: (task: CanonicalTask, trigger: HTMLElement) => void;
};

function ArchiveRow({
  task,
  done,
  when,
  pills,
  categoryTones,
  onRestore,
  onOpenDetail,
}: {
  task: CanonicalTask;
  done: boolean;
  when?: string | null;
  pills: readonly RowPill[];
  categoryTones?: ReadonlyMap<string, ToneOrNeutral>;
  onRestore: TaskArchiveProps["onRestore"];
  onOpenDetail: TaskArchiveProps["onOpenDetail"];
}) {
  const estimate = typeof task.estimateMinutes === "number" && task.estimateMinutes > 0 ? task.estimateMinutes : null;
  return (
    <li className={cn("tk-arch-row", done && "is-done")} data-task-record-id={task.id}>
      <span className="tk-arch-mark" aria-hidden="true">{done ? <CircleCheck size={18} strokeWidth={2} /> : <Archive size={16} strokeWidth={2} />}</span>
      <button type="button" className="tk-arch-title pc-focusable" title={task.title} onClick={event => onOpenDetail(task, event.currentTarget)}>{task.title}</button>
      <TaskRowPills pills={pills} categoryTones={categoryTones} className="tk-arch-pills" />
      {when ? <span className="tk-arch-when">{when}</span> : null}
      <span className="tk-row-est">{estimate ? formatMinutes(estimate) : null}</span>
      <button type="button" className="tk-ghost-btn tk-arch-restore pc-focusable" aria-label={`Restore ${task.title}`} onClick={() => void onRestore(task)}>
        <Undo2 size={14} strokeWidth={2.25} aria-hidden="true" /><span>Restore</span>
      </button>
    </li>
  );
}

export function TaskArchive({ tasks, today, timezone, tab, onTabChange, query, onQueryChange, pillsFor, categoryTones, onRestore, onOpenDetail }: TaskArchiveProps) {
  const weeks = tab === "completed" ? completedArchive(tasks, today, { timezone, query }) : [];
  const archived = tab === "archived" ? archivedList(tasks, query) : [];
  const searching = Boolean(query.trim());
  return (
    <section className="tk-arch" aria-label="Archive">
      <div className="tk-arch-top">
        <SegmentedTabs<TaskArchiveTab>
          label="Archive"
          value={tab}
          onValueChange={onTabChange}
          items={[
            { value: "completed", label: <><CircleCheck size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />Completed</> },
            { value: "archived", label: <><Archive size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />Archived</> },
          ]}
        />
        <label className="tk-search tk-arch-search">
          <Search size={16} strokeWidth={2} aria-hidden="true" />
          <span className="pc-sr-only">Search the archive</span>
          <input data-task-search type="search" value={query} placeholder="Search the archive" autoComplete="off" onChange={event => onQueryChange(event.target.value)} />
          {query ? (
            <button type="button" className="tk-search-clear pc-focusable" aria-label="Clear search" onClick={() => onQueryChange("")}>
              <X size={14} strokeWidth={2.5} aria-hidden="true" />
            </button>
          ) : null}
        </label>
      </div>
      <p className="tk-arch-note">
        <Info size={14} strokeWidth={2} aria-hidden="true" />
        {tab === "completed"
          ? "Finished work dims in place for the rest of the day, then lands here. Nothing is deleted."
          : "Put away without doing them. Restore brings a task back to your list."}
      </p>
      {tab === "completed" ? (
        weeks.length ? (
          <div className="tk-sections">
            {weeks.map(week => (
              <section key={week.weekStart} className="tk-section" aria-label={week.label} data-section={`week-${week.weekStart}`}>
                <h3 className="tk-arch-head">
                  <span className="tk-section-title">{week.label}</span>
                  <span className="tk-section-count">{`${week.count} done`}</span>
                  {week.estimateMinutes ? <span className="tk-section-facts">{formatMinutes(week.estimateMinutes)}</span> : null}
                </h3>
                <ul className="tk-arch-rows" role="list">
                  {week.tasks.map(task => {
                    const day = task.completedAt ? localDateForInstant(task.completedAt, timezone) : null;
                    return <ArchiveRow key={task.id} task={task} done when={day ? weekdayDayMonthLabel(day) : null} pills={pillsFor(task)} categoryTones={categoryTones} onRestore={onRestore} onOpenDetail={onOpenDetail} />;
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="tk-empty tk-arch-empty">
            <h3>{searching ? "No matches" : "Nothing finished before today"}</h3>
            <p>{searching ? `Nothing finished matches "${query.trim()}".` : "Work you finish moves here after the day it was done."}</p>
          </div>
        )
      ) : archived.length ? (
        <ul className="tk-arch-rows" role="list" aria-label="Archived tasks">
          {archived.map(task => <ArchiveRow key={task.id} task={task} done={false} pills={pillsFor(task)} categoryTones={categoryTones} onRestore={onRestore} onOpenDetail={onOpenDetail} />)}
        </ul>
      ) : (
        <div className="tk-empty tk-arch-empty">
          <h3>{searching ? "No matches" : "Nothing archived"}</h3>
          <p>{searching ? `Nothing archived matches "${query.trim()}".` : "Tasks you put away without doing them will wait here."}</p>
        </div>
      )}
    </section>
  );
}
