import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { CanonicalTask } from "@shared/canonicalTask";
import { deadlineRiskForTask } from "@shared/planningForecast";
import {
  laneForTaskState,
  stateForTaskLane,
  taskBoardLanes,
  visibleTasksForLane,
  type TaskBoardLaneId,
} from "@shared/taskBoard";
import type { TaskBoardFilter } from "@shared/taskBoardUrl";
import { ArchiveRestore, GripVertical, Inbox, List, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CanonicalTaskRow } from "./CanonicalTaskRow";
import { InboxTriage } from "./InboxTriage";
import { TaskDetailSheet, type TaskMutationResult } from "./TaskDetailSheet";
import "./task-workspace.css";

export type TaskWorkspaceView = "inbox" | "list" | "board" | "saved" | "archive";

type TaskLike = {
  state: string;
  id: string;
  title: string;
  priority?: string | null;
  sortOrder?: number;
  dueLocalDate?: string | null;
  scheduledLocalDate?: string | null;
  plannedStartAt?: unknown;
  plannedEndAt?: unknown;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
};

export type TaskWorkspaceSort = "manual" | "priority" | "due" | "scheduled" | "created";

export type TaskWorkspaceState = {
  view: TaskWorkspaceView;
  query: string;
  filter: TaskBoardFilter;
  sort: TaskWorkspaceSort;
  today: string;
};

export function inboxTasks<TTask extends TaskLike>(tasks: readonly TTask[]): TTask[] {
  return tasks.filter(
    task =>
      task.state !== "archived" &&
      task.state !== "completed" &&
      !task.scheduledLocalDate &&
      !task.plannedStartAt &&
      !task.plannedEndAt,
  );
}

export function tasksForWorkspaceView<TTask extends TaskLike>(
  tasks: readonly TTask[],
  view: TaskWorkspaceView,
): TTask[] {
  if (view === "inbox") return inboxTasks(tasks);
  if (view === "archive") return tasks.filter(task => task.state === "archived");
  return tasks.filter(task => task.state !== "archived");
}

export function taskUndoPatch(
  taskBeforeAction: Pick<TaskLike, "state" | "completedAt">,
  action: "complete" | "archive" | "reopen",
): { state: string } | null {
  if (action === "reopen") return null;
  if (action === "archive" && (taskBeforeAction.state === "completed" || taskBeforeAction.completedAt)) return null;
  return { state: taskBeforeAction.state };
}

const priorityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };

function taskTieBreak(left: TaskLike, right: TaskLike) {
  return (Number(left.sortOrder) || 0) - (Number(right.sortOrder) || 0) ||
    String(left.title ?? "").localeCompare(String(right.title ?? "")) ||
    String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

export function taskRowsForWorkspace<TTask extends TaskLike>(
  tasks: readonly TTask[],
  state: TaskWorkspaceState,
): TTask[] {
  const normalizedQuery = state.query.trim().toLowerCase();
  const filterApplies = state.view === "list" || state.view === "board";
  return tasksForWorkspaceView(tasks, state.view)
    .filter(task => {
      if (normalizedQuery && !String(task.title ?? "").toLowerCase().includes(normalizedQuery)) return false;
      if (!filterApplies) return true;
      if (state.filter === "open") return task.state !== "completed" && task.state !== "archived";
      if (state.filter === "today") return task.scheduledLocalDate === state.today || task.dueLocalDate === state.today;
      if (state.filter === "deadline_risk") return deadlineRiskForTask(task as unknown as CanonicalTask, state.today) !== null;
      return true;
    })
    .sort((left, right) => {
      if (state.sort === "priority") return (priorityRank[left.priority ?? ""] ?? 5) - (priorityRank[right.priority ?? ""] ?? 5) || taskTieBreak(left, right);
      if (state.sort === "due") return (left.dueLocalDate ?? "9999-12-31").localeCompare(right.dueLocalDate ?? "9999-12-31") || taskTieBreak(left, right);
      if (state.sort === "scheduled") return (left.scheduledLocalDate ?? "9999-12-31").localeCompare(right.scheduledLocalDate ?? "9999-12-31") || taskTieBreak(left, right);
      if (state.sort === "created") return new Date(right.createdAt ?? 0).getTime() - new Date(left.createdAt ?? 0).getTime() || taskTieBreak(left, right);
      return taskTieBreak(left, right);
    });
}

export function adaptSavedTaskView(configuration: Record<string, unknown>) {
  const requestedFilter = configuration.filter;
  const filter: TaskBoardFilter = requestedFilter === "risk"
    ? "deadline_risk"
    : requestedFilter === "open" || requestedFilter === "today" || requestedFilter === "deadline_risk" || requestedFilter === "all"
      ? requestedFilter
      : "all";
  const requestedSort = configuration.sort;
  const sort: TaskWorkspaceSort = requestedSort === "priority" || requestedSort === "due" || requestedSort === "scheduled" || requestedSort === "created" || requestedSort === "manual"
    ? requestedSort
    : "manual";
  return { query: typeof configuration.query === "string" ? configuration.query : "", filter, sort };
}

export function resetTaskWorkspaceState() {
  return { query: "", filter: "all" as TaskBoardFilter };
}

export type TaskWorkspaceProps = {
  view: TaskWorkspaceView;
  tasks: CanonicalTask[];
  categories: any[];
  projects: any[];
  goals: any[];
  savedViews: any[];
  dependencies?: any[];
  today: string;
  timezone: string;
  query: string;
  filter: TaskBoardFilter;
  selectedRecordId?: string | null;
  pendingTaskIds?: ReadonlySet<string>;
  conflictCountByTask?: ReadonlyMap<string, number>;
  isOnline?: boolean;
  onViewChange: (view: TaskWorkspaceView) => void;
  onViewStateChange: (state: { query: string; filter: TaskBoardFilter }) => void;
  onSelectedRecordChange: (recordId: string | null) => void;
  onCapture: () => void;
  onUpdate: (task: any, patch: Record<string, unknown>) => Promise<TaskMutationResult>;
  onCreateSubtask: (task: any, title: string) => Promise<TaskMutationResult>;
  onReorder: (task: any, direction: -1 | 1, laneTasks: any[]) => Promise<string | null>;
  onArchiveCompleted: (tasks: any[]) => Promise<boolean>;
  onAddDependency?: (task: any, dependsOnTaskId: string) => Promise<void>;
  onRemoveDependency?: (dependency: any) => Promise<void>;
};

export function TaskWorkspace({
  view,
  tasks,
  categories,
  projects,
  goals,
  savedViews,
  dependencies = [],
  today,
  timezone,
  query,
  filter,
  selectedRecordId,
  pendingTaskIds = new Set(),
  conflictCountByTask = new Map(),
  isOnline = true,
  onViewChange,
  onViewStateChange,
  onSelectedRecordChange,
  onCapture,
  onUpdate,
  onCreateSubtask,
  onReorder,
  onArchiveCompleted,
  onAddDependency,
  onRemoveDependency,
}: TaskWorkspaceProps) {
  const [activeMobileLane, setActiveMobileLane] = useState<TaskBoardLaneId>("todo");
  const [expandedLanes, setExpandedLanes] = useState<Partial<Record<TaskBoardLaneId, boolean>>>({});
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropLane, setDropLane] = useState<TaskBoardLaneId | null>(null);
  const [sort, setSort] = useState<TaskWorkspaceSort>("manual");
  const [undo, setUndo] = useState<{ label: string; task: any; patch: Record<string, unknown> } | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const selectedTask = tasks.find(task => task.id === selectedRecordId) ?? null;
  const categoryNames = useMemo(() => new Map(categories.map(item => [item.id, item.name])), [categories]);
  const projectTitles = useMemo(() => new Map(projects.map(item => [item.id, item.title])), [projects]);
  const goalTitles = useMemo(() => new Map(goals.map(item => [item.id, item.title])), [goals]);
  const taskTitles = useMemo(() => new Map(tasks.map(item => [item.id, item.title])), [tasks]);
  const childCounts = useMemo(
    () => tasks.reduce((counts, task) => {
      if (task.parentTaskId) counts.set(task.parentTaskId, (counts.get(task.parentTaskId) ?? 0) + 1);
      return counts;
    }, new Map<string, number>()),
    [tasks],
  );
  const filtered = useMemo(
    () => taskRowsForWorkspace(tasks, { view, query, filter, sort, today }),
    [filter, query, sort, tasks, today, view],
  );

  const contextFor = (task: CanonicalTask) => ({
    surface: "tasks" as const,
    localDate: today,
    timezone,
    categoryName: task.categoryId ? categoryNames.get(task.categoryId) : null,
    projectTitle: task.projectId ? projectTitles.get(task.projectId) : null,
    goalTitle: task.goalId ? goalTitles.get(task.goalId) : null,
  });
  const openDetail = (task: CanonicalTask, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    onSelectedRecordChange(task.id);
  };
  const reversible = async (
    task: CanonicalTask,
    action: "complete" | "archive",
    patch: Record<string, unknown>,
  ) => {
    try {
      const result = await onUpdate(task, patch);
      const inverse = taskUndoPatch(task, action);
      setUndo(inverse ? {
        label: action === "complete" ? `${task.title} completed.` : `${task.title} archived.`,
        task: result.record,
        patch: inverse,
      } : null);
      toast.success(result.queued ? "Saved on this device." : action === "complete" ? "Task completed." : "Task archived.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The task was left unchanged.");
    }
  };
  const toggle = async (task: CanonicalTask) => {
    if (task.state !== "completed") {
      await reversible(task, "complete", { state: "completed" });
      return;
    }
    try {
      const result = await onUpdate(task, { state: "not_started" });
      setUndo(null);
      toast.success(result.queued ? "Reopen saved on this device." : "Task reopened.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The completed task was left unchanged.");
    }
  };
  const archive = (task: CanonicalTask) => reversible(task, "archive", { state: "archived" });
  const planToday = async (task: CanonicalTask) => {
    try {
      const result = await onUpdate(task, { scheduledLocalDate: today });
      toast.success(result.queued ? "Plan for today saved on this device." : "Planned for today.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The task was left in Inbox.");
    }
  };
  const moveToLane = async (task: CanonicalTask, lane: TaskBoardLaneId) => {
    if (laneForTaskState(task.state) === lane) return;
    try {
      const result = await onUpdate(task, { state: stateForTaskLane(lane) });
      toast.success(result.queued ? "Move saved on this device." : `Moved to ${taskBoardLanes.find(item => item.id === lane)?.label ?? "lane"}.`);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The task stayed in its previous lane.");
    }
  };
  const archiveCompleted = async (completedTasks: CanonicalTask[]) => {
    if (!completedTasks.length) return;
    const confirmed = window.confirm(
      `Archive ${completedTasks.length} completed task${completedTasks.length === 1 ? "" : "s"}? They will remain restorable from Archived work.`,
    );
    if (confirmed) await onArchiveCompleted(completedTasks);
  };
  const restore = async (task: CanonicalTask) => {
    try {
      const result = await onUpdate(task, { state: "not_started" });
      toast.success(result.queued ? "Restore saved on this device." : "Task restored to To do.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The archived task was left unchanged.");
    }
  };
  const undoLast = async () => {
    if (!undo) return;
    const current = undo;
    setUndo(null);
    try {
      await onUpdate(current.task, current.patch);
      toast.success("Task restored. History and sync receipts were retained.");
    } catch (caught) {
      setUndo(current);
      toast.error(caught instanceof Error ? caught.message : "Undo could not be saved.");
    }
  };
  const renderRow = (task: CanonicalTask) => (
    <CanonicalTaskRow
      key={task.id}
      task={task}
      context={contextFor(task)}
      parentTitle={task.parentTaskId ? taskTitles.get(task.parentTaskId) : null}
      childCount={childCounts.get(task.id)}
      pending={pendingTaskIds.has(task.id) || String(task.id).startsWith("offline:")}
      onToggle={toggle}
      onArchive={archive}
      onOpenDetail={openDetail}
    />
  );

  return (
    <section className="task-workspace" aria-labelledby="task-workspace-heading">
      <header className="task-workspace-heading">
        <div>
          <span className="eyebrow">One record across every view</span>
          <h2 id="task-workspace-heading">Tasks</h2>
          <p>Inbox, List, Board, saved views, Search, Today, and archive all open the same task identity.</p>
        </div>
        <Button type="button" onClick={onCapture}>Capture</Button>
      </header>

      <nav className="task-workspace-tabs" aria-label="Task views">
        {(["inbox", "list", "board", "saved", "archive"] as TaskWorkspaceView[]).map(item => (
          <button key={item} type="button" aria-current={view === item ? "page" : undefined} className={cn(view === item && "is-active")} onClick={() => onViewChange(item)}>
            {item === "inbox" ? "Inbox" : item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </nav>

      {view !== "saved" ? (
        <div className="task-workspace-toolbar">
          <label className="task-search"><Search aria-hidden="true" size={18} /><Input data-task-search value={query} onChange={event => onViewStateChange({ query: event.target.value, filter })} placeholder="Search tasks" aria-label="Search tasks" /></label>
          {view !== "archive" && view !== "inbox" ? (
            <><div className="filter-group" aria-label="Task filters">
              {(["all", "open", "today", "deadline_risk"] as TaskBoardFilter[]).map(item => <button key={item} type="button" className={cn(filter === item && "is-active")} onClick={() => onViewStateChange({ query, filter: item })}>{item === "deadline_risk" ? "Deadline risk" : item.charAt(0).toUpperCase() + item.slice(1)}</button>)}
            </div><label className="task-sort">Order<select value={sort} onChange={event => setSort(event.target.value as TaskWorkspaceSort)}><option value="manual">Manual</option><option value="priority">Priority</option><option value="due">Due date</option><option value="scheduled">Planned date</option><option value="created">Newest</option></select></label></>
          ) : null}
        </div>
      ) : null}

      {undo ? <div className="task-undo" role="status"><span>{undo.label}</span><button type="button" onClick={() => void undoLast()}>Undo</button><button type="button" aria-label="Dismiss undo" onClick={() => setUndo(null)}>×</button></div> : null}

      {view === "inbox" ? (
        <InboxTriage
          tasks={filtered}
          allTasks={tasks}
          categories={categories}
          projects={projects}
          goals={goals}
          today={today}
          timezone={timezone}
          pendingTaskIds={pendingTaskIds}
          onToggle={toggle}
          onPlanToday={planToday}
          onArchive={archive}
          onOpenDetail={openDetail}
          onCapture={onCapture}
          queryActive={Boolean(query.trim())}
          onResetQuery={() => onViewStateChange({ query: "", filter })}
        />
      ) : null}

      {view === "list" ? (
        filtered.length ? <div className="canonical-task-list" role="list">{filtered.map(renderRow)}</div> : <div className="task-workspace-empty"><List aria-hidden="true" size={24} /><h3>No task matches this view</h3><p>Reset the search or filter to return to the complete list.</p>{query || filter !== "all" ? <button type="button" onClick={() => onViewStateChange(resetTaskWorkspaceState())}>Reset task filters</button> : <button type="button" onClick={onCapture}>Capture a task</button>}</div>
      ) : null}

      {view === "board" ? (
        <section className="task-board" aria-labelledby="task-board-heading">
          <div className="task-board-heading"><div><h3 id="task-board-heading">Work lanes</h3><p>Drag is optional. Every card has a visible Move to control.</p></div><span>{filtered.length} shown</span></div>
          <div className="task-lane-tabs" role="group" aria-label="Choose the task lane shown on small screens">
            {taskBoardLanes.map(lane => <button key={lane.id} type="button" aria-pressed={activeMobileLane === lane.id} className={cn("task-lane-tab", `task-lane-tab-${lane.id}`, activeMobileLane === lane.id && "is-active")} onClick={() => setActiveMobileLane(lane.id)}><span aria-hidden="true" /><b>{lane.id === "todo" ? "To do" : lane.id === "in_progress" ? "Doing" : "Done"}</b><small>{filtered.filter(task => laneForTaskState(task.state) === lane.id).length}</small></button>)}
          </div>
          <div className="task-lane-grid">
            {taskBoardLanes.map(lane => {
              const laneTasks = filtered.filter(task => laneForTaskState(task.state) === lane.id);
              const visible = visibleTasksForLane(laneTasks, lane.id, Boolean(expandedLanes[lane.id]) || Boolean(query));
              return (
                <section
                  key={lane.id}
                  className={cn(
                    "task-lane",
                    `task-lane-${lane.id}`,
                    activeMobileLane !== lane.id && "is-mobile-hidden",
                    dropLane === lane.id && "is-drop-target",
                  )}
                >
                  <header className="task-lane-header"><div><span className="task-lane-marker" aria-hidden="true" /><h3>{lane.label}</h3></div><span>{laneTasks.length}</span></header>
                  <p className="task-lane-description">{lane.description}</p>
                  <div
                    className="task-lane-list"
                    onDragOver={event => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                      setDropLane(lane.id);
                    }}
                    onDragLeave={event => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropLane(null);
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId;
                      const task = tasks.find(candidate => candidate.id === taskId);
                      if (task) void moveToLane(task, lane.id);
                      setDraggedTaskId(null);
                      setDropLane(null);
                    }}
                  >
                    {visible.items.length ? visible.items.map(task => (
                      <div
                        key={task.id}
                        className={cn("task-lane-task", draggedTaskId === task.id && "is-dragging")}
                        draggable
                        onDragStart={event => {
                          event.dataTransfer.effectAllowed = "move";
                          event.dataTransfer.setData("text/plain", task.id);
                          setDraggedTaskId(task.id);
                        }}
                        onDragEnd={() => {
                          setDraggedTaskId(null);
                          setDropLane(null);
                        }}
                      >
                        <span className="task-drag-handle" aria-hidden="true"><GripVertical size={15} /></span>
                        {renderRow(task)}
                        <div className="task-order-actions" aria-label={`Reorder ${task.title}`}><button type="button" aria-label={`Move ${task.title} up in ${lane.label}`} disabled={laneTasks.indexOf(task) === 0} onClick={() => void onReorder(task, -1, laneTasks)}>↑</button><button type="button" aria-label={`Move ${task.title} down in ${lane.label}`} disabled={laneTasks.indexOf(task) === laneTasks.length - 1} onClick={() => void onReorder(task, 1, laneTasks)}>↓</button></div>
                        <label className="task-lane-select"><span>Move to</span><select value={laneForTaskState(task.state)} onChange={event => void moveToLane(task, event.target.value as TaskBoardLaneId)}>{taskBoardLanes.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
                      </div>
                    )) : <div className="task-lane-empty">No tasks in this lane.</div>}
                    {visible.hiddenCount ? <button type="button" className="task-history-toggle" onClick={() => setExpandedLanes(current => ({ ...current, [lane.id]: true }))}>Show {visible.hiddenCount} more</button> : null}
                    {lane.id === "completed" && laneTasks.length ? <button type="button" className="task-archive-completed" onClick={() => void archiveCompleted(laneTasks)}><ArchiveRestore size={16} /> Archive {laneTasks.length} completed</button> : null}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      ) : null}

      {view === "saved" ? (
        <section className="task-saved-views" aria-labelledby="task-saved-heading"><header><h3 id="task-saved-heading">Saved views</h3><p>Saved filters point to the same task records; they never copy task state.</p></header>{savedViews.filter(saved => saved.viewType === "tasks").length ? <div>{savedViews.filter(saved => saved.viewType === "tasks").map(saved => <button type="button" key={saved.id} onClick={() => { const adapted = adaptSavedTaskView(saved.configuration ?? {}); setSort(adapted.sort); onViewStateChange({ query: adapted.query, filter: adapted.filter }); onViewChange("list"); }}><strong>{saved.name}</strong><span>{saved.isPinned ? "Pinned" : "Saved"}</span></button>)}</div> : <div className="task-workspace-empty"><Inbox aria-hidden="true" size={24} /><h3>No task views saved yet</h3><p>Your current task filters remain available in List and Board.</p></div>}</section>
      ) : null}

      {view === "archive" ? (
        <section className="task-archive-panel" aria-labelledby="archived-task-heading"><div><h3 id="archived-task-heading">Archived work</h3><p>Archive retains identity and history. Restore returns the same record to To do.</p></div><span>{filtered.length} stored</span>{filtered.length ? <ul>{filtered.map(task => <li key={task.id}><div><strong>{task.title}</strong><small>{task.completedAt ? "Completed before archive" : "Archived without completion"}</small></div><Button type="button" variant="ghost" onClick={() => void restore(task)}><ArchiveRestore size={16} /> Restore</Button></li>)}</ul> : <div className="task-workspace-empty"><p>{query ? "No archived task matches this search." : "No archived tasks yet."}</p>{query ? <button type="button" onClick={() => onViewStateChange({ query: "", filter })}>Reset task search</button> : null}</div>}</section>
      ) : null}

      <TaskDetailSheet
        task={selectedTask}
        open={Boolean(selectedTask)}
        returnFocusRef={returnFocusRef}
        projects={projects}
        goals={goals}
        categories={categories}
        tasks={tasks}
        dependencies={dependencies}
        conflictCount={selectedTask ? conflictCountByTask.get(selectedTask.id) ?? 0 : 0}
        isOnline={isOnline}
        onOpenChange={open => { if (!open) onSelectedRecordChange(null); }}
        onUpdate={onUpdate}
        onCreateSubtask={onCreateSubtask}
        onAddDependency={onAddDependency}
        onRemoveDependency={onRemoveDependency}
      />
    </section>
  );
}
