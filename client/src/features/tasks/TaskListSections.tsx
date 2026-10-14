// D3 TaskListSections: the List grouped by When (Past due, Today, Next 7 days, Later, No date) with Done
// collapsed at the end. Headers are sticky, carry a rolling count and real facts (overdue, someday, planned
// minutes), and collapse with an animated height. Counts and groups come from taskWorkspaceModel's
// taskListSections(); this file only draws them.
import { AlertTriangle, CalendarClock, CalendarRange, CheckCircle2, ChevronDown, Inbox, ListChecks, SearchX, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { EmptyState } from "@/components/premium/Surfaces";
import { RollingCount } from "@/components/premium/FilterChips";
import { formatMinutes } from "@/design/timeFormat";
import { cn } from "@/lib/utils";
import { plannerObjectDefinitions, taskSchedulingLanguage } from "@shared/planningLanguage";
import type { TaskListSectionId } from "@shared/taskBuckets";
import type { TaskCardModel } from "./taskCardModel";
import { TaskRow, type TaskRowAction, type TaskRowProps } from "./TaskRow";
import type { TaskListSection } from "./taskWorkspaceModel";
import "./tasks-premium.css";

const SECTION_ICONS: Record<TaskListSectionId, { icon: LucideIcon; tone: string }> = {
  past_due: { icon: AlertTriangle, tone: "tk-tone-off" },
  today: { icon: Sun, tone: "pc-tone-accent" },
  next_7_days: { icon: CalendarRange, tone: "pc-tone-work" },
  later: { icon: CalendarClock, tone: "pc-tone-personal" },
  no_date: { icon: Inbox, tone: "pc-tone-neutral" },
  done: { icon: CheckCircle2, tone: "tk-tone-ok" },
};

export type TaskListEmpty =
  | { kind: "filtered"; /** "Today", "All"... the quick filter the empty result sits in. */ scope: string; query?: string; onClear: () => void }
  | { kind: "first-run"; onCapture: () => void };

export type TaskListSectionsProps = {
  sections: ReadonlyArray<TaskListSection<TaskCardModel>>;
  onOpen: TaskRowProps["onOpen"];
  onToggle: TaskRowProps["onToggle"];
  onBlockedCheck?: TaskRowProps["onBlockedCheck"];
  onStartFocus?: TaskRowProps["onStartFocus"];
  actionsFor?: (model: TaskCardModel) => ReadonlyArray<TaskRowAction>;
  /** Drag handle per row (Manual sort only); D3b supplies it. */
  dragHandleFor?: (model: TaskCardModel) => ReactNode;
  /** Sections collapsed on first render. Done is collapsed unless told otherwise. */
  defaultCollapsed?: ReadonlyArray<TaskListSectionId>;
  /** Shown instead of the sections when there are none. */
  empty?: TaskListEmpty;
  className?: string;
};

/** Facts shown after a section's count, from real data only. */
export function sectionFacts(section: Pick<TaskListSection<unknown>, "id" | "overdueCount" | "somedayCount" | "plannedMinutes" | "doneTodayCount">): string[] {
  const facts: string[] = [];
  if (section.id === "past_due" && section.overdueCount > 0) facts.push(`${section.overdueCount} overdue`);
  if (section.id === "no_date" && section.somedayCount > 0) facts.push(`${section.somedayCount} someday`);
  if (section.id === "today") {
    if (section.plannedMinutes && section.plannedMinutes > 0) facts.push(`${formatMinutes(section.plannedMinutes)} planned`);
    if (section.doneTodayCount > 0) facts.push(`${section.doneTodayCount} done`);
  }
  return facts;
}

function SectionBlock({
  section,
  collapsed,
  onToggleCollapsed,
  animateEnter,
  rows,
}: {
  section: TaskListSection<TaskCardModel>;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  animateEnter: boolean;
  rows: (model: TaskCardModel, index: number) => ReactNode;
}) {
  const headingId = useId();
  const regionId = useId();
  const { icon: Icon, tone } = SECTION_ICONS[section.id];
  const facts = sectionFacts(section);
  const done = section.id === "done";
  return (
    <section className={cn("tk-section", collapsed && "is-collapsed")} aria-labelledby={headingId} data-section={section.id}>
      <h3 className="tk-section-head" id={headingId}>
        <button type="button" className="tk-section-toggle pc-focusable" aria-expanded={!collapsed} aria-controls={regionId} onClick={onToggleCollapsed}>
          <span className={cn("pc-icon-tile", tone)} aria-hidden="true"><Icon size={16} strokeWidth={2} /></span>
          <span className="tk-section-title">{section.label}</span>
          <RollingCount value={section.count} className="tk-section-count" />
          {facts.length ? <span className="tk-section-facts">{facts.join(" · ")}</span> : null}
          <span className="tk-section-hint">
            {done ? <span className="tk-section-hint-text">{collapsed ? "Show done" : "Hide done"}</span> : null}
            <ChevronDown size={16} strokeWidth={2.25} aria-hidden="true" className="tk-section-caret" />
          </span>
        </button>
      </h3>
      <div className="tk-section-body" id={regionId} inert={collapsed || undefined}>
        <div className="tk-section-clip">
          <ul className={cn("tk-rows", animateEnter && "is-entering")} role="list" aria-labelledby={headingId}>
            {section.tasks.map(rows)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function TaskListSections({
  sections,
  onOpen,
  onToggle,
  onBlockedCheck,
  onStartFocus,
  actionsFor,
  dragHandleFor,
  defaultCollapsed = ["done"],
  empty,
  className,
}: TaskListSectionsProps) {
  const [collapsed, setCollapsed] = useState<Partial<Record<TaskListSectionId, boolean>>>(() => Object.fromEntries(defaultCollapsed.map(id => [id, true])));
  // The entrance rise plays on the first mount only, never when a refetch adds or moves rows.
  const first = useRef(true);
  useEffect(() => {
    first.current = false;
  }, []);

  if (!sections.length) {
    if (empty?.kind === "first-run") {
      return (
        <div className={cn("tk-empty", className)}>
          <EmptyState
            icon={ListChecks}
            title="Your tasks start with one captured thought"
            body={plannerObjectDefinitions.task.description}
            action={<button type="button" className="tk-btn is-accent pc-focusable" onClick={empty.onCapture}>Capture a task</button>}
          />
          <ul className="tk-definitions" aria-label="How tasks use dates">
            {([taskSchedulingLanguage.deadline, taskSchedulingLanguage.planFor, taskSchedulingLanguage.reserveTime] as const).map(item => (
              <li key={item.label} className="tk-pill is-neutral" title={item.help}>
                <span className="tk-pill-text">{item.label}</span>
                <span className="pc-sr-only">{`: ${item.help}`}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    if (empty?.kind === "filtered") {
      return (
        <div className={cn("tk-empty", className)}>
          <EmptyState
            icon={SearchX}
            title={empty.query ? `No task matches "${empty.query}" in ${empty.scope}` : `No task in ${empty.scope}`}
            body="Clear the filters to see every task again. Your sort order stays."
            action={<button type="button" className="tk-btn is-ghost pc-focusable" onClick={empty.onClear}>Clear filters</button>}
          />
        </div>
      );
    }
    return null;
  }

  return (
    <div className={cn("tk-sections", className)}>
      {sections.map(section => (
        <SectionBlock
          key={section.id}
          section={section}
          collapsed={Boolean(collapsed[section.id])}
          onToggleCollapsed={() => setCollapsed(current => ({ ...current, [section.id]: !current[section.id] }))}
          animateEnter={first.current}
          rows={(model, index) => (
            <TaskRow
              key={model.id}
              model={model}
              index={index}
              enter={first.current && index < 8}
              onOpen={onOpen}
              onToggle={onToggle}
              onBlockedCheck={onBlockedCheck}
              onStartFocus={onStartFocus}
              actions={actionsFor?.(model)}
              dragHandle={dragHandleFor?.(model)}
            />
          )}
        />
      ))}
    </div>
  );
}
