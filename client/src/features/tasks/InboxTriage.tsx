import type { CanonicalTask } from "@shared/canonicalTask";
import { CalendarPlus, Inbox } from "lucide-react";
import { CanonicalTaskRow } from "./CanonicalTaskRow";

export const INBOX_TRIAGE_GUIDANCE = "Keep the thought without making every planning decision now. Clarify, plan, link, or archive here. Intentional noncompletion is recorded from the matching Plan commitment.";

export type InboxTriageProps = {
  tasks: CanonicalTask[];
  today: string;
  timezone: string;
  categories: any[];
  projects: any[];
  goals: any[];
  allTasks: CanonicalTask[];
  pendingTaskIds?: ReadonlySet<string>;
  onToggle: (task: CanonicalTask) => void | Promise<unknown>;
  onPlanToday: (task: CanonicalTask) => void | Promise<unknown>;
  onArchive: (task: CanonicalTask) => void | Promise<unknown>;
  onOpenDetail: (task: CanonicalTask, trigger: HTMLElement) => void;
  onCapture: () => void;
  queryActive?: boolean;
  onResetQuery?: () => void;
};

export function InboxTriage({
  tasks,
  today,
  timezone,
  categories,
  projects,
  goals,
  allTasks,
  pendingTaskIds = new Set(),
  onToggle,
  onPlanToday,
  onArchive,
  onOpenDetail,
  onCapture,
  queryActive = false,
  onResetQuery,
}: InboxTriageProps) {
  const categoryNames = new Map(categories.map(item => [item.id, item.name]));
  const projectTitles = new Map(projects.map(item => [item.id, item.title]));
  const goalTitles = new Map(goals.map(item => [item.id, item.title]));
  const taskTitles = new Map(allTasks.map(item => [item.id, item.title]));
  const childCounts = allTasks.reduce((counts, task) => {
    if (task.parentTaskId) counts.set(task.parentTaskId, (counts.get(task.parentTaskId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return (
    <section className="inbox-triage" aria-labelledby="inbox-triage-heading">
      <header>
        <div>
          <span className="eyebrow">Unclarified and unscheduled</span>
          <h2 id="inbox-triage-heading">Inbox</h2>
          <p>{INBOX_TRIAGE_GUIDANCE}</p>
        </div>
        <span className="inbox-triage-count"><Inbox aria-hidden="true" size={18} />{tasks.length}</span>
      </header>
      {tasks.length ? (
        <div className="canonical-task-list">
          {tasks.map(task => (
            <CanonicalTaskRow
              key={task.id}
              task={task}
              context={{
                surface: "tasks",
                localDate: today,
                timezone,
                categoryName: task.categoryId ? categoryNames.get(task.categoryId) : null,
                projectTitle: task.projectId ? projectTitles.get(task.projectId) : null,
                goalTitle: task.goalId ? goalTitles.get(task.goalId) : null,
              }}
              parentTitle={task.parentTaskId ? taskTitles.get(task.parentTaskId) : null}
              childCount={childCounts.get(task.id)}
              pending={pendingTaskIds.has(task.id) || String(task.id).startsWith("offline:")}
              contextualActionLabel="Plan today"
              onToggle={onToggle}
              onArchive={onArchive}
              onPrimaryAction={taskToPlan => onPlanToday(taskToPlan)}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      ) : (
        <div className="task-workspace-empty">
          <CalendarPlus aria-hidden="true" size={24} />
          <h3>{queryActive ? "No Inbox task matches this search" : "Inbox is clear"}</h3>
          <p>{queryActive ? "Reset the task search to see every unplanned Inbox record." : "New title-only captures land here until you deliberately plan or clarify them."}</p>
          <button type="button" onClick={queryActive ? onResetQuery : onCapture}>{queryActive ? "Reset task search" : "Capture a thought"}</button>
        </div>
      )}
    </section>
  );
}
