import { CanonicalTaskRow } from "@/features/tasks/CanonicalTaskRow";
import type { CanonicalTask } from "@shared/canonicalTask";
import type { TodayProjection } from "@shared/todayProjection";
import { Layers3 } from "lucide-react";

export type TodayFlexibleWorkProps = {
  rows: TodayProjection["flexible"];
  tasks: CanonicalTask[];
  localDate: string;
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

const sourceLabel = {
  planned_no_time: "Planned today · no time reserved",
  daily_commitment: "Daily-plan commitment",
  occurrence: "Recurring occurrence",
  reservation: "Reserved",
} as const;

export function TodayFlexibleWork({
  rows,
  tasks,
  localDate,
  timezone,
  projectTitles,
  goalTitles,
  categoryNames,
  pendingTaskIds,
  onToggleTask,
  onArchiveTask,
  onStartFocus,
  onOpenTask,
}: TodayFlexibleWorkProps) {
  const taskById = new Map(tasks.map(task => [task.id, task]));

  return (
    <section className="today-flexible" data-today-section="flexible" aria-labelledby="today-flexible-heading">
      <header className="today-section-heading">
        <div>
          <span>Flexible work</span>
          <h2 id="today-flexible-heading">Choose what fits</h2>
        </div>
        <small>{rows.length} {rows.length === 1 ? "item" : "items"}</small>
      </header>
      <div className="today-flexible-list">
        {rows.map(row => {
          const task = taskById.get(row.recordId);
          if (!task) return null;
          return (
            <div className="today-flexible-row" key={row.recordId} data-today-task-source={row.source}>
              <span className="today-source-label">{sourceLabel[row.source]}</span>
              <CanonicalTaskRow
                task={task}
                context={{
                  surface: "today",
                  localDate,
                  timezone,
                  projectTitle: task.projectId ? projectTitles.get(task.projectId) : null,
                  goalTitle: task.goalId ? goalTitles.get(task.goalId) : null,
                  categoryName: task.categoryId ? categoryNames.get(task.categoryId) : null,
                }}
                pending={pendingTaskIds.has(task.id) || String(task.id).startsWith("offline:")}
                contextualActionLabel="Start focus"
                onToggle={onToggleTask}
                onArchive={onArchiveTask}
                onPrimaryAction={onStartFocus}
                onOpenDetail={onOpenTask}
              />
            </div>
          );
        })}
        {!rows.length ? (
          <div className="today-flexible-empty">
            <Layers3 aria-hidden="true" size={20} />
            <div><strong>No flexible work chosen</strong><span>Due work remains visible below as a planning decision, not a silent commitment.</span></div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
