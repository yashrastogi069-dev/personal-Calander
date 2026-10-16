// Tasks T2a: the calm List (owner decisions Q6, Q7). Groups come from the T1 selectors through
// taskWorkspaceModel.taskListGroups(): When (Overdue · Today · This week · Later · Someday · No date, then
// "Done today" collapsed), Project or Category. Each header carries the open count and total time and
// collapses with the animated height the D3 sections use. Rows are calm TaskRows: at most 2 smart pills, the
// D4 reason chip and the estimate. Presentation only: the container builds every row.
import {
  AlarmClock,
  Calendar,
  CalendarRange,
  ChevronDown,
  CircleCheck,
  CircleDashed,
  Cloud,
  FolderKanban,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { RollingCount } from "@/components/premium/FilterChips";
import { toneClassName, type ToneOrNeutral } from "@/design/categoryTone";
import { formatMinutes } from "@/design/timeFormat";
import { cn } from "@/lib/utils";
import type { RowPill } from "@shared/taskRowPills";
import type { TaskCardModel } from "./taskCardModel";
import { TaskListEmptyState, type TaskListEmpty } from "./TaskListSections";
import { TaskRow, type TaskRowAction, type TaskRowProps } from "./TaskRow";
import { TaskRowPills } from "./TaskRowPills";
import type { TaskListGroupBy } from "./taskWorkspaceModel";
import "./tasks-premium.css";

const WHEN_ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  overdue: { icon: AlarmClock, tone: "tk-tone-off" },
  today: { icon: Sun, tone: "pc-tone-accent" },
  this_week: { icon: CalendarRange, tone: "pc-tone-work" },
  later: { icon: Calendar, tone: "pc-tone-personal" },
  someday: { icon: Cloud, tone: "pc-tone-neutral" },
  no_date: { icon: CircleDashed, tone: "pc-tone-neutral" },
  done_today: { icon: CircleCheck, tone: "tk-tone-ok" },
};

export type CalmTaskRow = {
  model: TaskCardModel;
  pills: readonly RowPill[];
  estimateMinutes: number | null;
};

export type CalmTaskGroup = {
  id: string;
  label: string;
  rows: readonly CalmTaskRow[];
  /** Open tasks (Done today: finished ones). */
  count: number;
  estimateMinutes: number;
  collapsedByDefault: boolean;
  /** Category groups draw their palette dot. */
  tone?: ToneOrNeutral;
};

/** The header's time fact: total open estimate, or the time finished for Done today. Nothing when unknown. */
export function groupTimeLabel(group: Pick<CalmTaskGroup, "id" | "estimateMinutes">) {
  if (!group.estimateMinutes) return null;
  return group.id === "done_today" ? `${formatMinutes(group.estimateMinutes)} done` : formatMinutes(group.estimateMinutes);
}

export type TaskListGroupsProps = {
  groupBy: TaskListGroupBy;
  groups: readonly CalmTaskGroup[];
  categoryTones?: ReadonlyMap<string, ToneOrNeutral>;
  onOpen: TaskRowProps["onOpen"];
  onToggle: TaskRowProps["onToggle"];
  onBlockedCheck?: TaskRowProps["onBlockedCheck"];
  onStartFocus?: TaskRowProps["onStartFocus"];
  actionsFor?: (model: TaskCardModel) => ReadonlyArray<TaskRowAction>;
  empty?: TaskListEmpty;
  className?: string;
};

function GroupMark({ groupBy, group }: { groupBy: TaskListGroupBy; group: CalmTaskGroup }) {
  const when = WHEN_ICONS[group.id];
  if (groupBy === "when" || group.id === "done_today") {
    const { icon: Icon, tone } = when ?? WHEN_ICONS.no_date;
    return <span className={cn("pc-icon-tile", tone)} aria-hidden="true"><Icon size={16} strokeWidth={2} /></span>;
  }
  if (groupBy === "category") return <span className={cn("tk-group-dot", toneClassName(group.tone ?? "neutral"))} aria-hidden="true"><span className="pc-dot" /></span>;
  return <span className="pc-icon-tile pc-tone-neutral" aria-hidden="true"><FolderKanban size={16} strokeWidth={2} /></span>;
}

function GroupBlock({
  groupBy,
  group,
  collapsed,
  onToggleCollapsed,
  animateEnter,
  rows,
}: {
  groupBy: TaskListGroupBy;
  group: CalmTaskGroup;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  animateEnter: boolean;
  rows: (row: CalmTaskRow, index: number) => ReactNode;
}) {
  const headingId = useId();
  const regionId = useId();
  const time = groupTimeLabel(group);
  const done = group.id === "done_today";
  return (
    <section className={cn("tk-section tk-group", collapsed && "is-collapsed")} aria-labelledby={headingId} data-section={group.id} data-group-by={groupBy}>
      <h3 className="tk-section-head" id={headingId}>
        <button type="button" className="tk-section-toggle pc-focusable" aria-expanded={!collapsed} aria-controls={regionId} onClick={onToggleCollapsed}>
          <GroupMark groupBy={groupBy} group={group} />
          <span className="tk-section-title">{group.label}</span>
          <RollingCount value={group.count} className="tk-section-count" />
          {time ? <span className="tk-section-facts tk-group-time">{time}</span> : null}
          <span className="tk-section-hint">
            {done ? <span className="tk-section-hint-text">{collapsed ? "Show done" : "Hide done"}</span> : null}
            <ChevronDown size={16} strokeWidth={2.25} aria-hidden="true" className="tk-section-caret" />
          </span>
        </button>
      </h3>
      <div className="tk-section-body" id={regionId} inert={collapsed || undefined}>
        <div className="tk-section-clip">
          <ul className={cn("tk-rows", animateEnter && "is-entering")} role="list" aria-labelledby={headingId}>
            {group.rows.map(rows)}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function TaskListGroups({
  groupBy,
  groups,
  categoryTones,
  onOpen,
  onToggle,
  onBlockedCheck,
  onStartFocus,
  actionsFor,
  empty,
  className,
}: TaskListGroupsProps) {
  // Keyed by grouping, so switching When / Project / Category starts from each group's default.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const first = useRef(true);
  useEffect(() => {
    first.current = false;
  }, []);

  if (!groups.length) return empty ? <TaskListEmptyState empty={empty} className={className} /> : null;

  return (
    <div className={cn("tk-sections tk-groups", className)} data-group-by={groupBy}>
      {groups.map(group => {
        const key = `${groupBy}:${group.id}`;
        const isCollapsed = collapsed[key] ?? group.collapsedByDefault;
        return (
          <GroupBlock
            key={key}
            groupBy={groupBy}
            group={group}
            collapsed={isCollapsed}
            onToggleCollapsed={() => setCollapsed(current => ({ ...current, [key]: !isCollapsed }))}
            animateEnter={first.current}
            rows={(row, index) => (
              <TaskRow
                key={row.model.id}
                model={row.model}
                index={index}
                enter={first.current && index < 8}
                onOpen={onOpen}
                onToggle={onToggle}
                onBlockedCheck={onBlockedCheck}
                onStartFocus={onStartFocus}
                actions={actionsFor?.(row.model)}
                meta={<TaskRowPills pills={row.pills} why={row.model.why} repeat={row.model.recurring?.cadence} categoryTones={categoryTones} />}
                estimate={row.estimateMinutes}
              />
            )}
          />
        );
      })}
    </div>
  );
}
