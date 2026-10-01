import { useEffect, useMemo, useRef, useState } from "react";
import {
  previewRoadmapMove,
  roadmapProjection,
  type RoadmapItem,
  type RoadmapMovePreview,
  type RoadmapPeriod,
  type RoadmapProject,
  type RoadmapResolution,
  validRoadmapLocalDate,
} from "@shared/roadmap";
import "./roadmap.css";

type RoadmapWorkspaceProps = {
  snapshot: any;
  workspaceId: string;
  todayLocalDate: string;
  selectedProjectId?: string | null;
  isOnline: boolean;
  onOpenProject?: (id: string) => void;
  onOpenTask?: (id: string) => void;
  onApplyMove?: (input: { id: string; expectedVersion: number; patch: { startLocalDate?: string | null; dueLocalDate?: string | null } }) => Promise<unknown>;
};

type StoredPreview = {
  result: RoadmapMovePreview;
  projectId: string;
  version: number;
  originalStart: string | null;
  originalDue: string | null;
  proposedStart: string | null;
  proposedDue: string | null;
  snapshotSignature: string;
};

export type TimelineTask = {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  title: string;
  state: string;
  outcome?: string | null;
  scheduledLocalDate?: string | null;
  dueLocalDate?: string | null;
};

type TaskPoint = { task: TimelineTask; planned: string | null; deadline: string | null };
type TaskPeriod = { key: string; startLocalDate: string; endLocalDate: string; points: TaskPoint[] };

const TASK_PAGE_SIZE = 12;

function taskPeriod(date: string, resolution: RoadmapResolution): TaskPeriod {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const firstMonth = resolution === "year" ? 1 : resolution === "quarter" ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  const lastMonth = resolution === "year" ? 12 : resolution === "quarter" ? firstMonth + 2 : firstMonth;
  const startLocalDate = `${year}-${String(firstMonth).padStart(2, "0")}-01`;
  const endLocalDate = new Date(Date.UTC(year, lastMonth, 0)).toISOString().slice(0, 10);
  const key = resolution === "year" ? `${year}` : resolution === "quarter" ? `${year}-Q${Math.floor((month - 1) / 3) + 1}` : `${year}-${String(month).padStart(2, "0")}`;
  return { key, startLocalDate, endLocalDate, points: [] };
}

function taskStatus(task: TimelineTask) {
  if (task.state === "completed") return "Completed";
  if (task.state === "archived") return "Archived";
  if (task.outcome === "wont_do") return "Won't do";
  return task.state.replaceAll("_", " ");
}

/** Keeps planned action days and deadlines as separate points, never as a task span. */
export function projectTaskTimeline(tasks: readonly TimelineTask[], workspaceId: string, projectId: string, resolution: RoadmapResolution) {
  const byPeriod = new Map<string, TaskPeriod>();
  const undated: TimelineTask[] = [];
  for (const task of tasks) {
    if (task.workspaceId !== workspaceId || task.projectId !== projectId) continue;
    const planned = task.scheduledLocalDate && validRoadmapLocalDate(task.scheduledLocalDate) ? task.scheduledLocalDate : null;
    const deadline = task.dueLocalDate && validRoadmapLocalDate(task.dueLocalDate) ? task.dueLocalDate : null;
    if (!planned && !deadline) { undated.push(task); continue; }
    const keys = new Set([planned, deadline].filter((date): date is string => Boolean(date)).map(date => taskPeriod(date, resolution).key));
    for (const key of Array.from(keys)) {
      const date = planned && taskPeriod(planned, resolution).key === key ? planned : deadline!;
      const group = byPeriod.get(key) ?? taskPeriod(date, resolution);
      group.points.push({ task, planned: planned && taskPeriod(planned, resolution).key === key ? planned : null, deadline: deadline && taskPeriod(deadline, resolution).key === key ? deadline : null });
      byPeriod.set(key, group);
    }
  }
  for (const group of Array.from(byPeriod.values())) group.points.sort((a, b) => (a.planned ?? a.deadline ?? "").localeCompare(b.planned ?? b.deadline ?? "") || a.task.title.localeCompare(b.task.title));
  return { periods: byPeriod, undated };
}

function TaskPointCard({ point, onOpenTask }: { point: TaskPoint; onOpenTask?: (id: string) => void }) {
  const content = <><span className="roadmap-task-heading"><strong>{point.task.title}</strong><span className="roadmap-task-status">{taskStatus(point.task)}</span></span><span className="roadmap-task-dates">{point.planned ? <span><b>Planned</b> {dateLabel(point.planned)}</span> : null}{point.deadline ? <span><b>Deadline</b> {dateLabel(point.deadline)}</span> : null}{!point.planned && !point.deadline ? <span>No planned day or deadline</span> : null}</span></>;
  return onOpenTask ? <button type="button" className="roadmap-task-point" onClick={() => onOpenTask(point.task.id)} aria-label={`Open task ${point.task.title}, ${taskStatus(point.task)}${point.planned ? `, planned ${dateLabel(point.planned)}` : ""}${point.deadline ? `, deadline ${dateLabel(point.deadline)}` : ""}`}>{content}</button> : <div className="roadmap-task-point">{content}</div>;
}

function dateLabel(date: string | null) {
  if (!date) return "Not set";
  if (!validRoadmapLocalDate(date)) return date;
  const parsed = new Date(`${date}T00:00:00Z`);
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed);
}

function periodLabel(period: RoadmapPeriod, resolution: RoadmapResolution) {
  if (resolution === "year") return period.key;
  if (resolution === "quarter") return period.key.replace("-Q", " · Q");
  return new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${period.startLocalDate}T00:00:00Z`));
}

function dateDescription(item: RoadmapItem) {
  if (item.startLocalDate && item.dueLocalDate) return `${dateLabel(item.startLocalDate)} – ${dateLabel(item.dueLocalDate)}`;
  if (item.startLocalDate) return `Start only: ${dateLabel(item.startLocalDate)} · Due date not set`;
  if (item.dueLocalDate) return `Due only: ${dateLabel(item.dueLocalDate)} · Start date not set`;
  return "Not yet dated";
}

function itemKind(item: RoadmapItem) {
  return item.kind === "project" ? "Project" : "Goal checkpoint";
}

function attentionLabel(key: RoadmapItem["attention"][number]) {
  return ({
    explicit_risk: "Risk recorded",
    blocked: "Blocked",
    review_due: "Review due",
    deadline_overdue: "Past due",
    execution_gap: "No scheduled next task",
  } as const)[key];
}

function ItemButton({ item, active, onSelect }: { item: RoadmapItem; active: boolean; onSelect: () => void }) {
  return <button type="button" className={`roadmap-item ${active ? "is-active" : ""}`} onClick={onSelect} aria-pressed={active}>
    <span className="roadmap-item-main"><strong>{item.title}</strong><span className="roadmap-item-kind">{itemKind(item)}</span></span>
    <span className="roadmap-item-dates">{dateDescription(item)}</span>
    {item.attention.length > 0 ? <span className="roadmap-item-attention">{item.attention.map(attentionLabel).join(" · ")}</span> : null}
  </button>;
}

function utcDay(date: string) { return Date.parse(`${date}T00:00:00Z`) / 86_400_000; }

function contiguousPeriods(periods: RoadmapPeriod[], resolution: RoadmapResolution): RoadmapPeriod[] {
  if (!periods.length) return [];
  const output: RoadmapPeriod[] = [];
  let cursor = periods[0].startLocalDate;
  const last = periods[periods.length - 1].startLocalDate;
  while (cursor <= last) {
    const year = Number(cursor.slice(0, 4));
    const month = Number(cursor.slice(5, 7));
    const finalMonth = resolution === "year" ? 12 : resolution === "quarter" ? month + 2 : month;
    const endLocalDate = new Date(Date.UTC(year, finalMonth, 0)).toISOString().slice(0, 10);
    const key = resolution === "year" ? `${year}` : resolution === "quarter" ? `${year}-Q${Math.floor((month - 1) / 3) + 1}` : `${year}-${String(month).padStart(2, "0")}`;
    output.push({ key, startLocalDate: cursor, endLocalDate, items: [] });
    const next = new Date(`${endLocalDate}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return output;
}

function timelineSegment(item: RoadmapItem, period: RoadmapPeriod) {
  const start = item.startLocalDate ?? item.dueLocalDate;
  const end = item.dueLocalDate ?? item.startLocalDate;
  if (!start || !end || end < period.startLocalDate || start > period.endLocalDate) return null;
  const periodStart = utcDay(period.startLocalDate);
  const total = utcDay(period.endLocalDate) - periodStart + 1;
  const left = Math.max(0, (utcDay(start) - periodStart) / total * 100);
  const right = Math.min(100, (utcDay(end) - periodStart + 1) / total * 100);
  return { left: `${left}%`, width: `${Math.max(2, right - left)}%` };
}

function FocusedTimeline({ item, periods, resolution }: { item: RoadmapItem | null; periods: RoadmapPeriod[]; resolution: RoadmapResolution }) {
  return <section className="roadmap-focus" aria-labelledby="roadmap-focus-heading">
    <div className="roadmap-section-heading"><div><h3 id="roadmap-focus-heading">Focused timeline</h3><p>{item ? `${item.title} · ${dateDescription(item)}` : "Select a dated item to see its position across periods."}</p></div></div>
    {item && item.dateShape !== "undated" && periods.length ? <div className="roadmap-timeline-scroll" role="region" aria-label="Focused horizontal roadmap timeline" tabIndex={0}>
      <div className="roadmap-timeline" style={{ gridTemplateColumns: `repeat(${periods.length}, minmax(144px, 1fr))` }}>
        {periods.map(period => {
          const segment = timelineSegment(item, period);
          return <div className="roadmap-timeline-period" key={period.key}>
            <span>{periodLabel(period, resolution)}</span>
            <div className="roadmap-timeline-track">{segment ? <i className={`${item.dateShape === "partial" ? "is-partial" : ""} ${item.kind === "milestone" ? "is-milestone" : ""}`} style={segment} aria-hidden="true" /> : null}</div>
          </div>;
        })}
      </div>
    </div> : <p className="roadmap-empty-inline">{item?.dateShape === "undated" ? "This item has no date yet, so it has no timeline position." : "No dated items are available."}</p>}
    <p className="roadmap-legend">A line shows a recorded start-to-due range. A marker shows a single recorded date. Goal checkpoints come from goal milestones; tasks are not drawn as bars.</p>
  </section>;
}

function PortfolioAxis({ items, periods, resolution, todayLocalDate, focused, onFocus }: { items: RoadmapItem[]; periods: RoadmapPeriod[]; resolution: RoadmapResolution; todayLocalDate: string; focused: RoadmapItem | null; onFocus: (item: RoadmapItem) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentHeadRef = useRef<HTMLSpanElement>(null);
  const dated = items.filter(item => item.dateShape !== "undated");
  if (!dated.length || !periods.length) return null;
  const axis = contiguousPeriods(periods, resolution);
  const current = axis.find(period => todayLocalDate >= period.startLocalDate && todayLocalDate <= period.endLocalDate);
  const columns = `minmax(220px, 240px) repeat(${axis.length}, minmax(144px, 1fr))`;
  const jumpToCurrent = () => {
    const scroll = scrollRef.current;
    const head = currentHeadRef.current;
    if (scroll && head) scroll.scrollTo({ left: Math.max(0, head.offsetLeft - scroll.clientWidth / 2), behavior: "auto" });
  };
  return <section className="roadmap-axis-panel" aria-labelledby="roadmap-axis-heading"><div className="roadmap-section-heading"><div><h3 id="roadmap-axis-heading">Portfolio timeline</h3><p>Each row uses the same period axis. Select a record for its focused timeline.</p></div>{current ? <button type="button" className="roadmap-button is-quiet" onClick={jumpToCurrent}>Jump to current period</button> : null}</div><div ref={scrollRef} className="roadmap-axis-scroll" role="region" aria-label="Portfolio roadmap timeline" tabIndex={0}>
    <div className="roadmap-axis-grid" style={{ gridTemplateColumns: columns }}>
      <span className="roadmap-axis-corner">Recorded work</span>{axis.map(period => <span ref={period.key === current?.key ? currentHeadRef : undefined} className={`roadmap-axis-head ${period.key === current?.key ? "is-current" : ""}`} key={period.key}>{periodLabel(period, resolution)}{period.key === current?.key ? <span className="roadmap-current-label">Current</span> : null}</span>)}
      {dated.map(item => <div className="roadmap-axis-row" key={`${item.kind}:${item.id}`} style={{ gridColumn: `1 / span ${axis.length + 1}`, gridTemplateColumns: columns }}>
        <button type="button" className={`roadmap-axis-name ${focused?.id === item.id && focused.kind === item.kind ? "is-active" : ""}`} onClick={() => onFocus(item)} aria-pressed={focused?.id === item.id && focused.kind === item.kind}><strong>{item.title}</strong><span>{itemKind(item)} · {dateDescription(item)}</span></button>
        {axis.map(period => { const segment = timelineSegment(item, period); return <div className="roadmap-axis-cell" key={period.key} aria-hidden="true">{segment ? <i className={`${item.dateShape === "partial" ? "is-partial" : ""} ${item.kind === "milestone" ? "is-milestone" : ""}`} style={segment} /> : null}</div>; })}
      </div>)}
    </div>
  </div></section>;
}

export function RoadmapWorkspace({ snapshot, workspaceId, todayLocalDate, selectedProjectId, isOnline, onOpenProject, onOpenTask, onApplyMove }: RoadmapWorkspaceProps) {
  const [resolution, setResolution] = useState<RoadmapResolution>("month");
  const [anchorLocalDate, setAnchorLocalDate] = useState(todayLocalDate);
  const [showTasks, setShowTasks] = useState(false);
  const [shownTaskCounts, setShownTaskCounts] = useState<Record<string, number>>({});
  const [shownOutsideCount, setShownOutsideCount] = useState(TASK_PAGE_SIZE);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [editorProjectId, setEditorProjectId] = useState<string | null>(selectedProjectId ?? null);
  const [start, setStart] = useState("");
  const [due, setDue] = useState("");
  const [preview, setPreview] = useState<StoredPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const projects = (snapshot?.projects ?? []) as RoadmapProject[];
  const milestones = snapshot?.milestones ?? [];
  const tasks = snapshot?.tasks ?? [];
  const dependencies = snapshot?.projectDependenciesAvailable ? (snapshot?.projectDependencies ?? []) : [];
  const snapshotSignature = JSON.stringify([projects, milestones, tasks, dependencies]);
  const projection = useMemo(() => {
    try {
      return { data: roadmapProjection({ workspaceId, todayLocalDate, anchorLocalDate, resolution, projects, milestones, tasks, projectDependencies: dependencies, capabilities: { projectRisk: Boolean(snapshot?.projectRiskAvailable), projectDependencies: Boolean(snapshot?.projectDependenciesAvailable) } }), error: null };
    } catch (error) {
      return { data: null, error: error instanceof Error ? error.message : "The roadmap could not be displayed." };
    }
  }, [workspaceId, todayLocalDate, anchorLocalDate, resolution, snapshot, projects, milestones, tasks, dependencies]);

  const scopedItems = useMemo(() => {
    const all = projection.data?.items ?? [];
    return selectedProjectId ? all.filter(item => item.kind === "project" ? item.id === selectedProjectId : item.projectIds.includes(selectedProjectId)) : all;
  }, [projection.data, selectedProjectId]);
  const scopedIds = new Set(scopedItems.map(item => `${item.kind}:${item.id}`));
  const axisPeriods = projection.data?.periods ?? [];
  const periods = axisPeriods.map(period => ({ ...period, items: period.items.filter(item => scopedIds.has(`${item.kind}:${item.id}`)) })).filter(period => period.items.length);
  const windowStart = projection.data?.windowStartLocalDate;
  const windowEnd = projection.data?.windowEndLocalDate;
  const inWindow = (item: RoadmapItem) => {
    const first = item.startLocalDate ?? item.dueLocalDate;
    const last = item.dueLocalDate ?? item.startLocalDate;
    return Boolean(first && last && windowStart && windowEnd && first <= windowEnd && last >= windowStart);
  };
  const windowItems = scopedItems.filter(item => item.dateShape !== "undated" && inWindow(item));
  const outsideItems = scopedItems.filter(item => item.dateShape !== "undated" && !inWindow(item));
  const linkedTasks = useMemo(() => selectedProjectId ? (tasks as TimelineTask[]).filter(task => task.workspaceId === workspaceId && task.projectId === selectedProjectId) : [], [tasks, workspaceId, selectedProjectId]);
  const taskGroups = useMemo(() => selectedProjectId ? projectTaskTimeline(linkedTasks, workspaceId, selectedProjectId, resolution) : { periods: new Map<string, TaskPeriod>(), undated: [] as TimelineTask[] }, [linkedTasks, workspaceId, selectedProjectId, resolution]);
  const displayPeriods = useMemo(() => {
    if (!selectedProjectId || !showTasks) return periods;
    const combined = new Map(periods.map(period => [period.key, period]));
    for (const taskPeriodEntry of Array.from(taskGroups.periods.values())) if (windowStart && windowEnd && taskPeriodEntry.startLocalDate >= windowStart && taskPeriodEntry.endLocalDate <= windowEnd && !combined.has(taskPeriodEntry.key)) combined.set(taskPeriodEntry.key, { key: taskPeriodEntry.key, startLocalDate: taskPeriodEntry.startLocalDate, endLocalDate: taskPeriodEntry.endLocalDate, items: [] });
    return Array.from(combined.values()).sort((a, b) => a.startLocalDate.localeCompare(b.startLocalDate));
  }, [periods, selectedProjectId, showTasks, taskGroups, windowStart, windowEnd]);
  const outsideTaskPoints = selectedProjectId && showTasks && windowStart && windowEnd
    ? Array.from(taskGroups.periods.values()).filter(group => group.endLocalDate < windowStart || group.startLocalDate > windowEnd).reduce((count, group) => count + group.points.length, 0)
    : 0;
  const undated = (projection.data?.undated ?? []).filter(item => scopedIds.has(`${item.kind}:${item.id}`));
  const archived = (projection.data?.archived ?? []).filter(item => !selectedProjectId || (item.kind === "project" ? item.id === selectedProjectId : item.projectIds.includes(selectedProjectId)));
  const focused = scopedItems.find(item => `${item.kind}:${item.id}` === focusId) ?? scopedItems.find(item => item.id === selectedProjectId && item.kind === "project") ?? windowItems[0] ?? scopedItems[0] ?? null;
  const editableProjects = selectedProjectId ? projects.filter(project => project.id === selectedProjectId) : projects.filter(project => project.state !== "archived");
  const editorProject = editableProjects.find(project => project.id === editorProjectId) ?? editableProjects[0] ?? null;

  useEffect(() => { setEditorProjectId(selectedProjectId ?? null); setFocusId(null); setPreview(null); setMessage(null); setShowTasks(false); setShownTaskCounts({}); setShownOutsideCount(TASK_PAGE_SIZE); const selected = projects.find(project => project.id === selectedProjectId); setAnchorLocalDate(selected?.startLocalDate ?? selected?.dueLocalDate ?? todayLocalDate); }, [selectedProjectId, todayLocalDate]);
  useEffect(() => { setShownTaskCounts({}); }, [resolution]);
  const shiftWindow = (direction: -1 | 1) => {
    const months = resolution === "month" ? 6 : resolution === "quarter" ? 18 : 48;
    const index = Number(anchorLocalDate.slice(0, 4)) * 12 + Number(anchorLocalDate.slice(5, 7)) - 1;
    const next = Math.max(12, Math.min(9999 * 12 + 11, index + direction * months));
    setAnchorLocalDate(`${String(Math.floor(next / 12)).padStart(4, "0")}-${String(next % 12 + 1).padStart(2, "0")}-01`);
  };
  const selectItem = (item: RoadmapItem) => {
    setFocusId(`${item.kind}:${item.id}`);
    if (!inWindow(item)) setAnchorLocalDate(item.startLocalDate ?? item.dueLocalDate ?? todayLocalDate);
  };
  useEffect(() => {
    setStart(editorProject?.startLocalDate ?? "");
    setDue(editorProject?.dueLocalDate ?? "");
    setPreview(null);
    setMessage(null);
  }, [editorProject?.id, editorProject?.version, editorProject?.startLocalDate, editorProject?.dueLocalDate]);

  const previewIsCurrent = Boolean(preview && editorProject && preview.projectId === editorProject.id && preview.version === editorProject.version && preview.originalStart === (editorProject.startLocalDate ?? null) && preview.originalDue === (editorProject.dueLocalDate ?? null) && preview.proposedStart === (start || null) && preview.proposedDue === (due || null) && preview.snapshotSignature === snapshotSignature);
  const reviewed = previewIsCurrent ? preview!.result : null;
  const projectName = (id: string) => projects.find(project => project.id === id)?.title ?? id;
  const milestoneName = (id: string) => milestones.find((milestone: { id: string; title: string }) => milestone.id === id)?.title ?? id;

  const reviewMove = () => {
    if (!editorProject) return;
    setMessage(null);
    try {
      const result = previewRoadmapMove({ workspaceId, project: editorProject, projects, milestones, tasks, projectDependencies: dependencies, expectedVersion: editorProject.version, startLocalDate: start || null, dueLocalDate: due || null });
      setPreview({ result, projectId: editorProject.id, version: editorProject.version, originalStart: editorProject.startLocalDate ?? null, originalDue: editorProject.dueLocalDate ?? null, proposedStart: start || null, proposedDue: due || null, snapshotSignature });
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "The proposed dates could not be reviewed.");
    }
  };

  const applyMove = async () => {
    if (!isOnline || !onApplyMove || pending || !reviewed?.apply || reviewed.dependencyConflicts.length || !previewIsCurrent) return;
    setPending(true);
    setMessage(null);
    try {
      await onApplyMove(reviewed.apply);
      setPreview(null);
      setMessage("Project dates saved. Related goal, task, and milestone dates were left unchanged.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project dates could not be saved. Review the current record and try again.");
    } finally {
      setPending(false);
    }
  };

  return <section className={`roadmap-workspace ${selectedProjectId ? "is-project" : ""}`} aria-labelledby="roadmap-heading">
    <header className="roadmap-header"><div><span className="roadmap-eyebrow">Projects &amp; goals</span><h2 id="roadmap-heading">{selectedProjectId ? `${projectName(selectedProjectId)} roadmap` : "Roadmap"}</h2><p>Recorded project dates and goal checkpoints across time. Dates here do not schedule tasks or move linked records.</p></div></header>
    {projection.error ? <p className="roadmap-error" role="alert">{projection.error}</p> : <>
      <div className="roadmap-toolbar" aria-label="Roadmap time scale"><span>Show by</span>{(["month", "quarter", "year"] as const).map(value => <button type="button" key={value} onClick={() => setResolution(value)} aria-pressed={resolution === value} className={resolution === value ? "is-active" : ""}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
      {windowStart && windowEnd ? <nav className="roadmap-window-navigation" aria-label="Timeline date window"><span className="roadmap-window-label">Showing {dateLabel(windowStart)} – {dateLabel(windowEnd)}</span><div><button type="button" className="roadmap-button" onClick={() => shiftWindow(-1)} aria-label="Previous time window">Previous</button><button type="button" className="roadmap-button is-quiet" onClick={() => setAnchorLocalDate(todayLocalDate)}>Today</button><button type="button" className="roadmap-button" onClick={() => shiftWindow(1)} aria-label="Next time window">Next</button></div></nav> : null}
      {selectedProjectId ? <div className="roadmap-task-toggle"><div><strong>Linked tasks</strong><p>Optional detail for this project. Planned is an action day; Deadline is when work is due. These dates are points, not a task duration.</p></div><button type="button" className="roadmap-button is-quiet" aria-pressed={showTasks} aria-controls="roadmap-project-periods" onClick={() => setShowTasks(value => !value)}>{showTasks ? "Hide linked tasks" : `Show linked tasks (${linkedTasks.length})`}</button></div> : null}
      {!scopedItems.length && !archived.length && !(selectedProjectId && showTasks && linkedTasks.length) ? <p className="roadmap-empty">{selectedProjectId ? "This project has no recorded timeline dates or linked goal checkpoints yet." : "No projects or goal checkpoints yet. Add dates to an existing project to place it on the roadmap."}</p> : <>
        {!selectedProjectId ? <PortfolioAxis items={windowItems} periods={axisPeriods} resolution={resolution} todayLocalDate={todayLocalDate} focused={focused} onFocus={selectItem} /> : null}
        <section className="roadmap-periods" id="roadmap-project-periods" aria-labelledby="roadmap-periods-heading"><div className="roadmap-section-heading"><h3 id="roadmap-periods-heading">{resolution === "month" ? "Months" : resolution === "quarter" ? "Quarters" : "Years"}</h3><p>Project and checkpoint ranges use recorded start and due dates.{selectedProjectId && showTasks ? " Task points show only their planned day or deadline." : ""}</p></div>
          {displayPeriods.length ? <div className="roadmap-period-list">{displayPeriods.map(period => {
            const taskPoints = selectedProjectId && showTasks ? taskGroups.periods.get(period.key)?.points ?? [] : [];
            const shown = shownTaskCounts[period.key] ?? TASK_PAGE_SIZE;
            return <section className="roadmap-period" key={period.key} aria-label={periodLabel(period, resolution)}><h4>{periodLabel(period, resolution)} <span>{period.items.length + taskPoints.length}</span></h4><div className="roadmap-period-items">{period.items.map(item => <ItemButton key={`${item.kind}:${item.id}`} item={item} active={focused?.id === item.id && focused.kind === item.kind} onSelect={() => selectItem(item)} />)}{taskPoints.slice(0, shown).map(point => <TaskPointCard key={point.task.id} point={point} onOpenTask={onOpenTask} />)}{taskPoints.length > shown ? <button type="button" className="roadmap-task-more" onClick={() => setShownTaskCounts(counts => ({ ...counts, [period.key]: shown + TASK_PAGE_SIZE }))}>Show {Math.min(TASK_PAGE_SIZE, taskPoints.length - shown)} more tasks in {periodLabel(period, resolution)} <span>({taskPoints.length - shown} remaining)</span></button> : null}</div></section>;
          })}</div> : <p className="roadmap-empty-inline">No dated items in this view.</p>}
          {outsideTaskPoints ? <p className="roadmap-empty-inline">{outsideTaskPoints} linked task date point{outsideTaskPoints === 1 ? " is" : "s are"} outside this window. Use Previous or Next to view those dates.</p> : null}
        </section>
        {outsideItems.length ? <section className="roadmap-secondary" aria-labelledby="roadmap-outside-heading"><div className="roadmap-section-heading"><h3 id="roadmap-outside-heading">Outside this window</h3><p>{outsideItems.length} dated record{outsideItems.length === 1 ? " is" : "s are"} outside the visible period. Select one to jump to its date.</p></div><div className="roadmap-secondary-list">{outsideItems.slice(0, shownOutsideCount).map(item => <ItemButton key={`${item.kind}:${item.id}`} item={item} active={focused?.id === item.id && focused.kind === item.kind} onSelect={() => selectItem(item)} />)}{outsideItems.length > shownOutsideCount ? <button type="button" className="roadmap-task-more" onClick={() => setShownOutsideCount(count => count + TASK_PAGE_SIZE)}>Show more dated records <span>({outsideItems.length - shownOutsideCount} remaining)</span></button> : null}</div></section> : null}
        <FocusedTimeline item={focused} periods={axisPeriods} resolution={resolution} />
        {focused ? <div className="roadmap-focus-facts"><strong>{focused.title}</strong><span>{itemKind(focused)} · {focused.state.replaceAll("_", " ")}</span>{focused.explicitRisk ? <p>Recorded risk: {focused.explicitRisk.level.replaceAll("_", " ")}{focused.explicitRisk.note ? ` · ${focused.explicitRisk.note}` : ""}</p> : null}{focused.blockedByProjectIds.length ? <p>Waiting for: {focused.blockedByProjectIds.map(projectName).join(", ")}</p> : null}{focused.dependencyIds.length ? <p>Project dependencies: {focused.dependencyIds.map(projectName).join(", ")}</p> : null}{focused.overlapProjectIds.length ? <p>Date overlap with: {focused.overlapProjectIds.map(projectName).join(", ")}</p> : null}{focused.attention.length ? <p>Attention: {focused.attention.map(attentionLabel).join(", ")}</p> : null}{focused.kind === "project" && onOpenProject ? <button type="button" className="roadmap-button is-quiet" onClick={() => onOpenProject(focused.id)}>Open project</button> : null}</div> : null}
        <section className="roadmap-secondary" aria-labelledby="roadmap-undated-heading"><div className="roadmap-section-heading"><h3 id="roadmap-undated-heading">Not yet dated</h3><p>Projects and checkpoints here have neither a start nor a due date.{selectedProjectId && showTasks ? " Tasks here have neither a planned day nor a deadline." : ""}</p></div>{undated.length || (selectedProjectId && showTasks && taskGroups.undated.length) ? <div className="roadmap-secondary-list">{undated.map(item => <ItemButton key={`${item.kind}:${item.id}`} item={item} active={focused?.id === item.id && focused.kind === item.kind} onSelect={() => selectItem(item)} />)}{selectedProjectId && showTasks ? taskGroups.undated.slice(0, shownTaskCounts.undated ?? TASK_PAGE_SIZE).map(task => <TaskPointCard key={task.id} point={{ task, planned: null, deadline: null }} onOpenTask={onOpenTask} />) : null}{selectedProjectId && showTasks && taskGroups.undated.length > (shownTaskCounts.undated ?? TASK_PAGE_SIZE) ? <button type="button" className="roadmap-task-more" onClick={() => setShownTaskCounts(counts => ({ ...counts, undated: (counts.undated ?? TASK_PAGE_SIZE) + TASK_PAGE_SIZE }))}>Show more undated tasks <span>({taskGroups.undated.length - (shownTaskCounts.undated ?? TASK_PAGE_SIZE)} remaining)</span></button> : null}</div> : <p className="roadmap-empty-inline">Everything in this view has at least one date.</p>}</section>
        <details className="roadmap-archived"><summary>Archived records <span>{archived.length}</span></summary>{archived.length ? <div className="roadmap-secondary-list">{archived.map(item => <div className="roadmap-archived-item" key={`${item.kind}:${item.id}`}><strong>{item.title}</strong><span>{itemKind(item)} · {dateDescription(item)}</span>{item.kind === "project" && onOpenProject ? <button type="button" className="roadmap-button is-quiet" onClick={() => onOpenProject(item.id)}>Open archived project</button> : null}</div>)}</div> : <p className="roadmap-empty-inline">No archived records in this view.</p>}</details>
      </>}
    </>}
    <section className="roadmap-editor" aria-labelledby="roadmap-editor-heading"><div className="roadmap-section-heading"><div><h3 id="roadmap-editor-heading">Review project dates</h3><p>Enter exact dates, review the effect, then apply only the project date changes.</p></div></div>
      {editorProject ? <><div className="roadmap-editor-fields">{!selectedProjectId ? <label>Project<select value={editorProject.id} onChange={event => { setEditorProjectId(event.target.value); setPreview(null); setMessage(null); }}>{editableProjects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label> : null}<label>Start date<input type="date" value={start} onChange={event => { setStart(event.target.value); setPreview(null); }} /></label><label>Due date<input type="date" value={due} onChange={event => { setDue(event.target.value); setPreview(null); }} /></label></div>
        <div className="roadmap-editor-actions"><button type="button" className="roadmap-button" onClick={reviewMove}>Preview exact change</button>{onOpenProject ? <button type="button" className="roadmap-button is-quiet" onClick={() => onOpenProject(editorProject.id)}>Open project</button> : null}</div>
        {preview && !previewIsCurrent ? <p className="roadmap-offline" role="status">The roadmap changed since this preview. Review the dates again before applying.</p> : null}
        {reviewed ? <div className="roadmap-preview" aria-live="polite"><h4>Exact change preview</h4>{reviewed.errors.length ? <ul className="roadmap-preview-errors">{reviewed.errors.map(error => <li key={error}>{error}</li>)}</ul> : reviewed.changes.length ? <ul>{reviewed.changes.map(change => <li key={change.field}>{change.field === "startLocalDate" ? "Start date" : "Due date"}: {dateLabel(change.before)} → {dateLabel(change.after)}</li>)}</ul> : <p>No project date change.</p>}
          <p>Unchanged: {reviewed.unchanged.goal.id ? "linked goal dates, " : ""}{reviewed.unchanged.linkedTaskIds.length} linked task{reviewed.unchanged.linkedTaskIds.length === 1 ? "" : "s"} and {reviewed.unchanged.milestoneIds.length} goal checkpoint{reviewed.unchanged.milestoneIds.length === 1 ? "" : "s"}. No dates cascade.</p>
          {reviewed.dependencyConflicts.length ? <div className="roadmap-preview-warning" role="alert"><strong>Cannot apply: hard dependency timing conflict</strong><ul>{reviewed.dependencyConflicts.map((conflict, index) => <li key={`${conflict.projectId}:${conflict.dependsOnProjectId}:${index}`}>{projectName(conflict.projectId)} starts before prerequisite {projectName(conflict.dependsOnProjectId)} is due.</li>)}</ul><p>Adjust these project dates and preview again.</p></div> : null}
          {reviewed.existingDependencyConflicts.length ? <div className="roadmap-preview-warning" role="status"><strong>Existing dependency timing needs attention</strong><ul>{reviewed.existingDependencyConflicts.map((conflict, index) => <li key={`${conflict.projectId}:${conflict.dependsOnProjectId}:${index}`}>{projectName(conflict.projectId)} already starts before prerequisite {projectName(conflict.dependsOnProjectId)} is due.</li>)}</ul><p>This edit does not introduce that conflict. Review the dates when you can; the existing records will not be changed automatically.</p></div> : null}
          {reviewed.milestoneEffects.length ? <div className="roadmap-preview-warning"><strong>Goal checkpoints outside proposed dates</strong><ul>{reviewed.milestoneEffects.map(effect => <li key={effect.milestoneId}>{milestoneName(effect.milestoneId)} remains on its recorded date.</li>)}</ul></div> : null}
          {!isOnline ? <p className="roadmap-offline">Reconnect to apply project date changes.</p> : null}
          {!onApplyMove ? <p className="roadmap-offline">Date changes are unavailable in this view.</p> : null}
          <button type="button" className="roadmap-button is-primary" onClick={applyMove} disabled={!reviewed.apply || reviewed.dependencyConflicts.length > 0 || !onApplyMove || !isOnline || pending}>{pending ? "Applying…" : "Apply project dates"}</button>
        </div> : null}
        {message ? <p className="roadmap-message" role="status">{message}</p> : null}
      </> : <p className="roadmap-empty-inline">{selectedProjectId ? "The selected project is not in this workspace snapshot." : "Add a project to review dates."}</p>}
    </section>
  </section>;
}
