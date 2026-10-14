// D3 TaskMetaPills: every fact about a task as a labelled pill, always in the same order so rows scan
// like a table. Reads only the TaskCardModel (spec §5.1). Icons sit beside words; colour is never alone.
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Clock,
  CloudUpload,
  Flag,
  FolderKanban,
  History,
  Link2,
  ListChecks,
  Lock,
  Moon,
  Repeat,
  Target,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { toneClassName } from "@/design/categoryTone";
import { formatMinutes } from "@/design/timeFormat";
import { cn } from "@/lib/utils";
import type { TaskCardModel, TaskDatePill } from "./taskCardModel";
import "./tasks-premium.css";

export type PillTone = "neutral" | "accent" | "risk" | "off" | "ok";

export type TaskPillSpec = {
  key: string;
  /** Stable group name, used for ordering on narrow rows and in tests. */
  group: "state" | "context" | "category" | "priority" | "repeat" | "date" | "subtasks" | "dependency" | "someday" | "estimate" | "done" | "pending" | "conflict";
  tone: PillTone;
  icon: LucideIcon;
  label: string;
  /** Spoken form when the visible label is terse. */
  ariaLabel?: string;
  /** Category pills carry the category tone class instead of a status tone. */
  categoryTone?: TaskCardModel["tone"];
  progress?: { done: number; total: number };
};

const DATE_ICONS: Record<TaskDatePill["kind"], LucideIcon> = {
  overdue: AlertTriangle,
  slipped: History,
  reserved: Clock,
  occurrence: CalendarDays,
  plan: CalendarDays,
  due: CalendarClock,
};

export function datePillSpec(pill: TaskDatePill, index: number): TaskPillSpec {
  return { key: `date-${pill.kind}-${index}`, group: "date", tone: pill.tone, icon: DATE_ICONS[pill.kind], label: pill.label, ariaLabel: pill.accessibleLabel };
}

/** The pills a task shows, in the fixed order: state, project/goal, category, priority, repeat, dates, subtasks, dependency, someday, estimate, done, pending, conflict. */
export function taskPillSpecs(model: TaskCardModel): TaskPillSpec[] {
  const specs: TaskPillSpec[] = [];
  if (model.state === "blocked") specs.push({ key: "state", group: "state", tone: "off", icon: Ban, label: "Blocked" });
  else if (model.state === "in_progress") specs.push({ key: "state", group: "state", tone: "accent", icon: CircleDashed, label: "In progress" });
  if (model.context) {
    specs.push({ key: "context", group: "context", tone: "neutral", icon: model.context.kind === "project" ? FolderKanban : Target, label: model.context.title, ariaLabel: `${model.context.kind === "project" ? "Project" : "Goal"} ${model.context.title}` });
  }
  if (model.categoryName) specs.push({ key: "category", group: "category", tone: "neutral", icon: Flag, label: model.categoryName, ariaLabel: `Category ${model.categoryName}`, categoryTone: model.tone });
  if (model.priority) {
    specs.push({ key: "priority", group: "priority", tone: model.priority === "critical" ? "off" : "risk", icon: Flag, label: model.priority === "critical" ? "Critical" : "High", ariaLabel: `${model.priority === "critical" ? "Critical" : "High"} priority` });
  }
  if (model.recurring) specs.push({ key: "repeat", group: "repeat", tone: "neutral", icon: Repeat, label: model.recurring.cadence, ariaLabel: `Repeats ${model.recurring.cadence.toLocaleLowerCase()}` });
  model.dates.forEach((pill, index) => specs.push(datePillSpec(pill, index)));
  if (model.subtasks && model.subtasks.total > 0) {
    const { done, total } = model.subtasks;
    specs.push({ key: "subtasks", group: "subtasks", tone: "neutral", icon: ListChecks, label: `${done}/${total}`, ariaLabel: `${done} of ${total} ${total === 1 ? "subtask" : "subtasks"} done`, progress: { done, total } });
  }
  if (model.waitingOn > 0) specs.push({ key: "waiting", group: "dependency", tone: "risk", icon: Lock, label: `Waiting on ${model.waitingOn}`, ariaLabel: `Waiting on ${model.waitingOn} ${model.waitingOn === 1 ? "task" : "tasks"}` });
  if (model.blocks > 0) specs.push({ key: "blocks", group: "dependency", tone: "neutral", icon: Link2, label: `Blocks ${model.blocks}`, ariaLabel: `Blocks ${model.blocks} ${model.blocks === 1 ? "task" : "tasks"}` });
  if (model.someday) specs.push({ key: "someday", group: "someday", tone: "neutral", icon: Moon, label: "Someday" });
  if (model.estimateMinutes) specs.push({ key: "estimate", group: "estimate", tone: "neutral", icon: Timer, label: formatMinutes(model.estimateMinutes), ariaLabel: `Estimate ${formatMinutes(model.estimateMinutes)}` });
  if (model.completedLabel) specs.push({ key: "done", group: "done", tone: "ok", icon: CheckCircle2, label: model.completedLabel });
  if (model.pending) specs.push({ key: "pending", group: "pending", tone: "neutral", icon: CloudUpload, label: "Saved on this device" });
  if (model.conflictCount > 0) {
    specs.push({ key: "conflict", group: "conflict", tone: "risk", icon: AlertTriangle, label: `${model.conflictCount} ${model.conflictCount === 1 ? "conflict" : "conflicts"}`, ariaLabel: `${model.conflictCount} field ${model.conflictCount === 1 ? "conflict" : "conflicts"} kept for review` });
  }
  return specs;
}

export function TaskMetaPills({ model, className, omit }: { model: TaskCardModel; className?: string; /** Groups to leave out (for example `state` inside a lane that already says it). */ omit?: ReadonlyArray<TaskPillSpec["group"]> }) {
  const specs = taskPillSpecs(model).filter(spec => !omit?.includes(spec.group));
  if (!specs.length) return null;
  return (
    <ul className={cn("tk-pills", className)} aria-label="Task details">
      {specs.map(spec => {
        const Icon = spec.icon;
        return (
          <li
            key={spec.key}
            className={cn("tk-pill", `is-${spec.tone}`, spec.categoryTone && ["is-cat", toneClassName(spec.categoryTone)], spec.group === "conflict" && "pc-pop")}
            data-pill={spec.group}
          >
            {spec.group === "category" ? <span className="pc-dot" aria-hidden="true" /> : <Icon size={13} strokeWidth={2.25} aria-hidden="true" />}
            <span className="tk-pill-text" aria-hidden={spec.ariaLabel ? true : undefined}>{spec.label}</span>
            {spec.ariaLabel ? <span className="pc-sr-only">{spec.ariaLabel}</span> : null}
            {spec.progress ? (
              <span className="tk-mini-bar" aria-hidden="true">
                <i style={{ transform: `scaleX(${spec.progress.done / spec.progress.total})` }} />
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
