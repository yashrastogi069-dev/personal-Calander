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
  linkedResolutionByTaskId: ReadonlyMap<string, "plan" | "review" | "both" | "reconcile">;
  linkedPlanContextByTaskId: ReadonlyMap<string, { isEarlier: boolean; needsRecovery: boolean }>;
  onOpenLinkedResolution: (task: CanonicalTask) => void;
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
  carried_commitment: "Carried commitment",
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
  linkedResolutionByTaskId,
  linkedPlanContextByTaskId,
  onOpenLinkedResolution,
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
          if (row.source === "carried_commitment") return (
            <div className="today-flexible-row" key={`carry:${row.carryId}`} data-today-task-source={row.source}>
              <span className="today-source-label">Carried commitment</span>
              <div><strong>{row.title}</strong><small>Separate from this task's recurring occurrence. Resolve this carried item in Recovery.</small></div>
            </div>
          );
          if (!task) return null;
          const linkedResolution = linkedResolutionByTaskId.get(task.id);
          const planContext = linkedPlanContextByTaskId.get(task.id);
          const resolutionCopy = linkedResolution === "reconcile" ? "Recurring series · Dated occurrence unavailable"
            : linkedResolution === "both"
            ? "Review dated occurrence; Plan commitment needs recovery flow after migration"
            : linkedResolution === "review" ? "Resolve dated occurrence in Review"
            : planContext?.needsRecovery ? "Plan commitment needs recovery flow after migration"
            : planContext?.isEarlier ? "Resolve earlier commitment in Plan" : "Resolve today’s commitment in Plan";
          const guardLabel = linkedResolution === "reconcile" ? `Explain why ${task.title} cannot be resolved here`
            : linkedResolution === "both"
            ? `Open ${task.title} occurrence in Review; plan recovery still required`
            : linkedResolution === "plan" && planContext?.needsRecovery ? `Open ${task.title} recovery status in Plan`
            : `Resolve ${task.title} in ${linkedResolution === "plan" ? "Plan" : "Review"}`;
          const detailLabel = linkedResolution === "reconcile" ? `Explain why ${task.title} cannot be resolved here`
            : linkedResolution === "both"
            ? `Open ${task.title} in Review; plan recovery still required`
            : linkedResolution === "plan" && planContext?.needsRecovery ? `Open ${task.title} recovery status in Plan`
            : `Open ${task.title} in ${linkedResolution === "plan" ? "Plan" : "Review"}`;
          return (
            <div className="today-flexible-row" key={row.recordId} data-today-task-source={row.source}>
              <span className="today-source-label">{sourceLabel[row.source]}{linkedResolution ? ` · ${resolutionCopy}` : null}</span>
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
                completionGuard={linkedResolution ? { label: guardLabel, onOpen: () => onOpenLinkedResolution(task) } : undefined}
                detailActionLabel={linkedResolution ? detailLabel : undefined}
                contextualActionLabel={linkedResolution ? linkedResolution === "reconcile" ? "Why unavailable" : linkedResolution === "plan" ? "Open Plan" : "Open Review" : String(task.id).startsWith("offline:") ? "Sync before focus" : task.state === "blocked" ? "Review blockers" : "Start focus"}
                onToggle={linkedResolution ? () => onOpenLinkedResolution(task) : onToggleTask}
                onArchive={linkedResolution ? undefined : onArchiveTask}
                onPrimaryAction={(record, _actionId, trigger) => linkedResolution ? onOpenLinkedResolution(record) : task.state === "blocked" ? onOpenTask(record, trigger) : onStartFocus(record)}
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
