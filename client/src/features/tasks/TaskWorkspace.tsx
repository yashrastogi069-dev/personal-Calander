// Tasks workspace container (D3, reshaped by Tasks T2a to the approved prototype): tabs Inbox · List · Board
// plus the quiet Archive. Inbox = undecided work with triage cards (Q1/Q2); List = calm rows grouped by When,
// Project or Category (Q6/Q7) with ticked work dimming in place until midnight (Fable Q2); Archive = Completed
// | Archived (Q9). Board (T2b-1) = the Week board by default, with the Status lens (Q3-Q5), in TaskWeekBoard.
import { resolveCategoryTones } from "@/design/categoryTone";
import { cn } from "@/lib/utils";
import type { CanonicalTask } from "@shared/canonicalTask";
import { isInboxTask } from "@shared/taskBuckets";
import type { TaskBoardFilter } from "@shared/taskBoardUrl";
import { committedTaskPlans, taskArchiveCheck } from "@shared/taskDrop";
import type { TaskOccurrenceLike } from "@shared/taskRecurrence";
import { rowPills, type RowPillContext } from "@shared/taskRowPills";
import { topReason, type WhyReason } from "@shared/whyItMatters";
import { Archive, CalendarCheck, PanelRight, Play } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { whyFactsFromSnapshot } from "@/features/why/whyFacts";
import { InboxTriage } from "./InboxTriage";
import { inboxDecisionMessage, inboxDecisionPatch, inboxDecisionUndoPatch, type InboxDecision } from "./inboxTriageModel";
import { TaskArchive, type TaskArchiveTab } from "./TaskArchive";
import { TaskDetailSheet, type TaskMutationResult } from "./TaskDetailSheet";
import { TaskHeader } from "./TaskHeader";
import { TaskListGroups, type CalmTaskGroup } from "./TaskListGroups";
import type { TaskListEmpty } from "./TaskListSections";
import type { TaskRowAction } from "./TaskRow";
import { TaskSkeleton } from "./TaskSkeleton";
import { isSearchShortcut, TaskToolbar } from "./TaskToolbar";
import { TaskWeekBoard, type BoardLens } from "./TaskWeekBoard";
import { createTaskCardContext, taskCardModel, type TaskCardModel } from "./taskCardModel";
import {
  adaptSavedTaskView as adaptSavedTaskViewV2,
  boardLensShown,
  clearedTaskFilters,
  emptyTaskFacets,
  hasActiveTaskFilters,
  quickFilterCounts,
  readStoredTaskListGroup,
  searchWithTaskBoardLensAndFacets,
  sortWorkspaceTasks,
  storeTaskListGroup,
  taskBoardLensAndFacetsFromSearch,
  taskHeaderSummary,
  taskListGroups,
  taskQuickFilters,
  taskRowsForWorkspace as workspaceRows,
  type TaskFacetFilters,
  type TaskBoardLens,
  type TaskListGroupBy,
  type TaskWorkspaceSort,
  type TaskWorkspaceView,
} from "./taskWorkspaceModel";
import "./task-workspace.css";
import "./tasks-premium.css";

export type { TaskWorkspaceSort, TaskWorkspaceView };

type TaskLike = {
  state: string;
  id: string;
  title: string;
  description?: string | null;
  horizon?: string | null;
  priority?: string | null;
  sortOrder?: number;
  dueLocalDate?: string | null;
  scheduledLocalDate?: string | null;
  plannedStartAt?: unknown;
  plannedEndAt?: unknown;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
};

export const TASK_REORDER_GUIDANCE = "Move up and down use Manual order. Switch Order to Manual to rearrange this lane.";

export async function runTaskReorder(sort: TaskWorkspaceSort, action: () => Promise<unknown>) {
  if (sort !== "manual") return false;
  await action();
  return true;
}

export type TaskWorkspaceState = {
  view: TaskWorkspaceView;
  query: string;
  filter: TaskBoardFilter;
  sort: TaskWorkspaceSort;
  today: string;
};

/** Inbox = undecided open work: no date, no project, not Someday (shared rule, so the rail badge agrees). */
export function inboxTasks<TTask extends TaskLike>(tasks: readonly TTask[]): TTask[] {
  return tasks.filter(isInboxTask);
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

/** v1 signature kept for callers that pass `today` in the state; facets are empty and dates use UTC. */
export function taskRowsForWorkspace<TTask extends TaskLike>(
  tasks: readonly TTask[],
  state: TaskWorkspaceState,
): TTask[] {
  return workspaceRows(tasks as unknown as CanonicalTask[], { ...state, ...emptyTaskFacets }, { today: state.today, timezone: "UTC" }) as unknown as TTask[];
}

/** v1 shape ({query, filter, sort}) of a saved view; the container reads the full v2 config. */
export function adaptSavedTaskView(configuration: Record<string, unknown>) {
  const { query, filter, sort } = adaptSavedTaskViewV2(configuration);
  return { query, filter, sort };
}

export type TaskCheckDispatch =
  | { kind: "complete" }
  | { kind: "reopen" }
  | { kind: "resolve_occurrence"; occurrence: { id: string; expectedVersion: number } }
  | { kind: "refuse"; reason: string; action?: "open_plan" | "open_detail" }
  | { kind: "none" };

/**
 * What a check press does, from the card model only. A recurring series resolves today's occurrence (never
 * `state: completed`, which R1 rejects); a guarded task (R1-R3) is refused with its reason and writes nothing.
 */
export function taskCheckDispatch(model: Pick<TaskCardModel, "check" | "completionBlock">): TaskCheckDispatch {
  const action = model.check.action;
  if (action.kind === "reopen") return { kind: "reopen" };
  if (action.kind === "resolve_occurrence") return { kind: "resolve_occurrence", occurrence: { id: action.occurrenceId, expectedVersion: action.expectedVersion } };
  if (action.kind === "complete") return { kind: "complete" };
  if (model.completionBlock) return { kind: "refuse", reason: model.completionBlock.reason, ...(model.completionBlock.action ? { action: model.completionBlock.action } : {}) };
  return { kind: "none" };
}

export function resetTaskWorkspaceState() {
  return { query: "", filter: "all" as TaskBoardFilter };
}

function readFacetsFromUrl(): TaskFacetFilters {
  if (typeof window === "undefined") return emptyTaskFacets;
  const { categoryIds, projectIds, priorities } = taskBoardLensAndFacetsFromSearch(window.location.search);
  return { categoryIds, projectIds, priorities };
}

function writeFacetsToUrl(facets: TaskFacetFilters) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const current = taskBoardLensAndFacetsFromSearch(url.search);
    url.search = searchWithTaskBoardLensAndFacets(url.search, { lens: current.lens, ...facets });
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // The filter still applies for this session when the URL cannot be written.
  }
}

function readLensFromUrl(): TaskBoardLens {
  if (typeof window === "undefined") return "week";
  return taskBoardLensAndFacetsFromSearch(window.location.search).lens;
}

function writeLensToUrl(lens: TaskBoardLens) {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const current = taskBoardLensAndFacetsFromSearch(url.search);
    url.search = searchWithTaskBoardLensAndFacets(url.search, { ...current, lens });
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // The lens still applies for this session when the URL cannot be written.
  }
}

/** True when a key press should open Capture: a bare "c" outside any text field (prototype header, T2b-1). */
export function isCaptureShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey">, target: EventTarget | null) {
  if ((event.key !== "c" && event.key !== "C") || event.ctrlKey || event.metaKey || event.altKey) return false;
  return isSearchShortcut({ key: "/", ctrlKey: false, metaKey: false, altKey: false }, target);
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** First paint before the snapshot: the header text stays, rows are skeleton shapes (D3 §6). */
export function TaskWorkspaceLoading() {
  return (
    <section className="task-workspace tk-workspace" aria-label="Task workspace" aria-busy="true">
      {/* The shell bar carries the one "Tasks" title and Capture (T2b-1: one header, not two). */}
      <div className="tk-header">
        <p className="tk-summary-line">Loading your tasks</p>
      </div>
      <TaskSkeleton variant="list" />
    </section>
  );
}

type PlanRecord = { id: string; localDate: string; state: string };
type PlanItemRecord = { dailyPlanId: string; taskId: string; state: string };

export type TaskWorkspaceProps = {
  taskDraftScopeKey?: string;
  view: TaskWorkspaceView;
  tasks: CanonicalTask[];
  categories: any[];
  projects: any[];
  goals: any[];
  /** Saved task views. The pill row that uses them (Q8) arrives in T2b; the Views tab is gone. */
  savedViews: any[];
  dependencies?: any[];
  /** `snapshot.milestones` and `snapshot.weeklyObjectives`, for the D4 reasons (milestone soon, weekly objective). */
  milestones?: readonly unknown[];
  weeklyObjectives?: readonly unknown[];
  /** `snapshot.taskOccurrences`: recurring rows show their occurrence, and checking one resolves it. */
  occurrences?: readonly TaskOccurrenceLike[];
  /** `snapshot.dailyPlans` and `snapshot.dailyPlanItems`, for the R3 "committed in a plan" check. */
  dailyPlans?: readonly PlanRecord[];
  dailyPlanItems?: readonly PlanItemRecord[];
  today: string;
  timezone: string;
  query: string;
  filter: TaskBoardFilter;
  sort: TaskWorkspaceSort;
  selectedRecordId?: string | null;
  pendingTaskIds?: ReadonlySet<string>;
  conflictCountByTask?: ReadonlyMap<string, number>;
  isOnline?: boolean;
  onViewChange: (view: TaskWorkspaceView) => void;
  onViewStateChange: (state: { query: string; filter: TaskBoardFilter; sort: TaskWorkspaceSort }) => void;
  onSelectedRecordChange: (recordId: string | null) => void;
  onCapture: () => void;
  onStartFocus?: (task: CanonicalTask) => void;
  onUpdate: (task: any, patch: Record<string, unknown>) => Promise<TaskMutationResult>;
  /** `planner.occurrence.resolve(..., "completed")` for today's occurrence of a recurring task. */
  onResolveOccurrence?: (task: CanonicalTask, occurrence: { id: string; expectedVersion: number }) => Promise<unknown>;
  /** Opens Plan, where R3 commitments are resolved. */
  onOpenPlan?: () => void;
  onCreateSubtask: (task: any, title: string) => Promise<TaskMutationResult>;
  /** Legacy ↑/↓ lane re-order. Unused since T2b-1: Board re-order runs through the drop engine. Kept for Home. */
  onReorder: (task: any, direction: -1 | 1, laneTasks: any[]) => Promise<string | null>;
  onAddDependency?: (task: any, dependsOnTaskId: string) => Promise<void>;
  onRemoveDependency?: (dependency: any) => Promise<void>;
};

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_MAP: ReadonlyMap<string, number> = new Map();

export function TaskWorkspace({
  taskDraftScopeKey,
  view,
  tasks,
  categories,
  projects,
  goals,
  dependencies = [],
  milestones,
  weeklyObjectives,
  occurrences,
  dailyPlans,
  dailyPlanItems,
  today,
  timezone,
  query,
  filter,
  sort,
  selectedRecordId,
  pendingTaskIds = EMPTY_SET,
  conflictCountByTask = EMPTY_MAP,
  isOnline = true,
  onViewChange,
  onViewStateChange,
  onSelectedRecordChange,
  onCapture,
  onStartFocus,
  onUpdate,
  onResolveOccurrence,
  onOpenPlan,
  onCreateSubtask,
  onAddDependency,
  onRemoveDependency,
}: TaskWorkspaceProps) {
  const [boardLens, setBoardLensState] = useState<TaskBoardLens>(readLensFromUrl);
  const setBoardLens = useCallback((next: BoardLens) => {
    setBoardLensState(next);
    writeLensToUrl(next);
  }, []);
  const [undo, setUndo] = useState<{ label: string; task: any; patch: Record<string, unknown> } | null>(null);
  const [facets, setFacetsState] = useState<TaskFacetFilters>(readFacetsFromUrl);
  const [listGroup, setListGroupState] = useState<TaskListGroupBy>(() => readStoredTaskListGroup(safeLocalStorage()));
  const [archiveTab, setArchiveTab] = useState<TaskArchiveTab>("completed");
  // Ids ticked this session (Fable Q2): they dim in place in their group until reload or local midnight.
  const [tickedIds, setTickedIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => setTickedIds(new Set()), [today]);
  const setListGroup = useCallback((next: TaskListGroupBy) => {
    setListGroupState(next);
    storeTaskListGroup(safeLocalStorage(), next);
  }, []);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const setFacets = useCallback((next: TaskFacetFilters) => {
    setFacetsState(next);
    writeFacetsToUrl(next);
  }, []);
  // Back/forward restores the facets that the URL carries.
  useEffect(() => {
    const onPop = () => {
      setFacetsState(readFacetsFromUrl());
      setBoardLensState(readLensFromUrl());
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // C opens Capture from anywhere on Tasks (the one Capture button in the shell bar shows the key).
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || !isCaptureShortcut(event, event.target)) return;
      if (document.querySelector("[role='dialog'][data-state='open'], [role='menu']")) return;
      event.preventDefault();
      onCapture();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCapture]);

  const selectedTask = tasks.find(task => task.id === selectedRecordId) ?? null;
  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const bucketCtx = useMemo(() => ({ today, timezone, occurrences }), [occurrences, timezone, today]);
  const committedTasks = useMemo(() => committedTaskPlans(dailyPlans ?? [], dailyPlanItems ?? []), [dailyPlanItems, dailyPlans]);
  const cardCtx = useMemo(
    () => createTaskCardContext({
      today,
      timezone,
      tasks,
      categories,
      projects,
      goals,
      dependencies,
      occurrences,
      committedTasks,
      pendingTaskIds,
      conflictCountByTask,
      sort,
    }),
    [categories, committedTasks, conflictCountByTask, dependencies, goals, occurrences, pendingTaskIds, projects, sort, tasks, timezone, today],
  );
  const filterState = useMemo(() => ({ view, query, filter, sort, ...facets }), [facets, filter, query, sort, view]);
  const filtered = useMemo(() => workspaceRows(tasks, filterState, bucketCtx), [bucketCtx, filterState, tasks]);
  const summary = useMemo(() => taskHeaderSummary(tasks, bucketCtx), [bucketCtx, tasks]);
  const counts = useMemo(() => quickFilterCounts(tasks, { query, ...facets }, bucketCtx), [bucketCtx, facets, query, tasks]);
  // D4 facts from the snapshot slices this page receives; memoised so the engine's index is built once.
  const whyFacts = useMemo(
    () => whyFactsFromSnapshot({ tasks, goals, projects, milestones, taskDependencies: dependencies, taskOccurrences: occurrences, dailyPlans, dailyPlanItems, weeklyObjectives }),
    [dailyPlanItems, dailyPlans, dependencies, goals, milestones, occurrences, projects, tasks, weeklyObjectives],
  );
  const whyFactTasks = useMemo(() => new Map(whyFacts.tasks.map(task => [task.id, task])), [whyFacts]);
  const whyFor = useCallback((task: CanonicalTask, surface: "task_row" | "inbox_triage"): WhyReason | null => {
    const entity = whyFactTasks.get(task.id);
    if (!entity) return null;
    try {
      return topReason({ kind: "task", task: entity }, whyFacts, new Date(), timezone, surface);
    } catch {
      return null;
    }
  }, [timezone, whyFactTasks, whyFacts]);
  const pillCtx = useMemo<RowPillContext>(() => ({
    timezone,
    variant: "list",
    groupBy: listGroup,
    projects: new Map(projects.map(item => [String(item.id), { id: String(item.id), name: String(item.title), color: item.color ?? null, categoryId: item.categoryId ?? null }])),
    categories: new Map(categories.map(item => [String(item.id), { id: String(item.id), name: String(item.name), color: item.color ?? null }])),
    occurrences,
    dependencies,
    tasks,
  }), [categories, dependencies, listGroup, occurrences, projects, tasks, timezone]);
  const categoryTones = useMemo(() => resolveCategoryTones(categories), [categories]);
  // Board (T2b-1): stable callbacks, so the board's columns only rebuild when the data changes.
  const boardModelFor = useCallback((task: CanonicalTask) => taskCardModel(task, cardCtx), [cardCtx]);
  const boardPillsFor = useCallback(
    (task: CanonicalTask, lens: BoardLens) => rowPills(task, today, { ...pillCtx, variant: "board", boardLens: lens, groupBy: undefined }),
    [pillCtx, today],
  );
  const boardDropContext = useMemo(() => ({ sort, dependencies, committedTasks }), [committedTasks, dependencies, sort]);
  const listGroups = useMemo<CalmTaskGroup[]>(() => {
    if (view !== "list") return [];
    // The List shows decided work; undecided work waits in the Inbox (Q1).
    const rows = filtered.filter(task => !isInboxTask(task));
    return taskListGroups(rows, listGroup, { today, timezone, occurrences, keepInPlaceIds: tickedIds, projects, categories }).map(group => ({
      id: group.id,
      label: group.label,
      count: group.count,
      estimateMinutes: group.estimateMinutes,
      collapsedByDefault: group.collapsedByDefault,
      tone: listGroup === "category" && group.id !== "none" && group.id !== "done_today" ? categoryTones.get(group.id) ?? "neutral" : undefined,
      rows: group.tasks.map(task => ({
        model: { ...taskCardModel(task, cardCtx), why: whyFor(task, "task_row") },
        pills: rowPills(task, today, pillCtx),
        estimateMinutes: typeof task.estimateMinutes === "number" && task.estimateMinutes > 0 ? task.estimateMinutes : null,
      })),
    }));
  }, [cardCtx, categories, categoryTones, filtered, listGroup, occurrences, pillCtx, projects, tickedIds, timezone, today, view, whyFor]);
  const inboxRows = useMemo(() => sortWorkspaceTasks(tasks.filter(isInboxTask), "created"), [tasks]);
  const categoryOptions = useMemo(
    () => categories.map(item => ({ value: String(item.id), label: String(item.name), tone: cardCtx.categoryTones.get(item.id) ?? "neutral" })),
    [cardCtx, categories],
  );
  const projectOptions = useMemo(
    () => projects.filter(item => item.state !== "archived").map(item => ({ value: String(item.id), label: String(item.title) })),
    [projects],
  );
  const conflictedTaskIds = useMemo(
    () => tasks.filter(task => (conflictCountByTask.get(task.id) ?? 0) > 0).map(task => task.id),
    [conflictCountByTask, tasks],
  );
  const filtersActive = hasActiveTaskFilters({ query, filter, ...facets });
  const viewState = (patch: Partial<{ query: string; filter: TaskBoardFilter; sort: TaskWorkspaceSort }>) =>
    onViewStateChange({ query, filter, sort, ...patch });
  const clearFilters = () => {
    const cleared = clearedTaskFilters();
    setFacets({ categoryIds: cleared.categoryIds, projectIds: cleared.projectIds, priorities: cleared.priorities });
    onViewStateChange({ query: cleared.query, filter: cleared.filter, sort });
  };

  const openDetail = (task: Pick<CanonicalTask, "id">, trigger: HTMLElement | null) => {
    returnFocusRef.current = trigger;
    onSelectedRecordChange(task.id);
  };
  const rowTrigger = (taskId: string) =>
    document.querySelector<HTMLElement>(`[data-task-record-id="${CSS.escape(taskId)}"] .tk-row-title, [data-task-record-id="${CSS.escape(taskId)}"] .canonical-task-title`);
  const reversible = async (
    task: CanonicalTask,
    action: "complete" | "archive",
    patch: Record<string, unknown>,
  ) => {
    try {
      const result = await onUpdate(task, patch);
      if (action === "complete") setTickedIds(current => new Set(current).add(task.id));
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
  const reopen = async (task: CanonicalTask) => {
    try {
      const result = await onUpdate(task, { state: "not_started" });
      setUndo(null);
      toast.success(result.queued ? "Reopen saved on this device." : "Task reopened.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The completed task was left unchanged.");
    }
  };
  /** A guarded check (R1-R3) never writes: it says why, and offers the place where it can be fixed. */
  const explainBlockedCheck = (task: CanonicalTask, model: TaskCardModel) => {
    const block = model.completionBlock;
    if (!block) return;
    const action = block.action === "open_plan" && onOpenPlan
      ? { label: "Open Plan", onClick: () => onOpenPlan() }
      : block.action === "open_detail"
        ? { label: "Open details", onClick: () => openDetail(task, rowTrigger(task.id)) }
        : undefined;
    toast.info(block.reason, action ? { action } : undefined);
  };
  const resolveTodayOccurrence = async (task: CanonicalTask, occurrence: { id: string; expectedVersion: number }) => {
    if (!onResolveOccurrence) {
      toast.error("Today's repeat can only be resolved from Plan here. Nothing was saved.");
      return;
    }
    try {
      await onResolveOccurrence(task, occurrence);
      toast.success("Today's repeat is done.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Today's repeat was left unchanged.");
    }
  };
  /** The one check-off path for every Tasks view: the card model decides update, occurrence resolve or refusal. */
  const checkTask = async (task: CanonicalTask, model: TaskCardModel = taskCardModel(task, cardCtx)) => {
    const dispatch = taskCheckDispatch(model);
    if (dispatch.kind === "reopen") return reopen(task);
    if (dispatch.kind === "resolve_occurrence") return resolveTodayOccurrence(task, dispatch.occurrence);
    if (dispatch.kind === "complete") return reversible(task, "complete", { state: "completed" });
    if (dispatch.kind === "refuse") explainBlockedCheck(task, model);
  };
  const toggle = (task: CanonicalTask) => checkTask(task);
  const archive = async (task: CanonicalTask) => {
    const allowed = taskArchiveCheck(task, cardCtx);
    if (!allowed.ok) {
      toast.info(allowed.reason);
      return;
    }
    await reversible(task, "archive", { state: "archived" });
  };
  const planToday = async (task: CanonicalTask) => {
    try {
      const result = await onUpdate(task, { scheduledLocalDate: today });
      toast.success(result.queued ? "Plan for today saved on this device." : "Planned for today.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The task was left unchanged.");
    }
  };
  const restore = async (task: CanonicalTask) => {
    try {
      const result = await onUpdate(task, { state: "not_started" });
      toast.success(result.queued ? "Restore saved on this device." : "Restored to your tasks.");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The task was left unchanged.");
    }
  };
  /** One Inbox decision (Q1): a single patch, then an Undo toast that puts the task back in the Inbox. */
  const decideInbox = async (task: CanonicalTask, decision: InboxDecision) => {
    if (decision.kind === "delete") {
      const allowed = taskArchiveCheck(task, cardCtx);
      if (!allowed.ok) {
        toast.info(allowed.reason);
        return;
      }
    }
    try {
      const result = await onUpdate(task, inboxDecisionPatch(decision, today));
      const undoPatch = inboxDecisionUndoPatch(decision, task);
      const message = inboxDecisionMessage(decision, today);
      toast.success(result.queued ? `${message} (saved on this device).` : message, {
        action: {
          label: "Undo",
          onClick: () => {
            void onUpdate(result.record ?? task, undoPatch).then(
              () => toast.success("Back in the Inbox."),
              (caught: unknown) => toast.error(caught instanceof Error ? caught.message : "Undo could not be saved."),
            );
          },
        },
      });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "The task stayed in the Inbox.");
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
  const canFocusOn = (task: CanonicalTask) => Boolean(onStartFocus && task.state !== "completed" && task.state !== "archived" && task.outcome !== "wont_do");
  const rowActions = (model: TaskCardModel): TaskRowAction[] => {
    const task = taskById.get(model.id);
    if (!task) return [];
    const actions: TaskRowAction[] = [
      { id: "open", label: "Open details", icon: PanelRight, onSelect: () => openDetail(task, rowTrigger(task.id)) },
    ];
    if (canFocusOn(task)) actions.push({ id: "focus", label: "Start focus", icon: Play, onSelect: () => onStartFocus?.(task) });
    const open = task.state !== "completed" && task.state !== "archived";
    if (open && !model.recurring && task.scheduledLocalDate !== today) {
      actions.push({ id: "plan-today", label: "Plan for today", icon: CalendarCheck, onSelect: () => void planToday(task) });
    }
    if (task.state !== "archived") {
      const allowed = taskArchiveCheck(task, cardCtx);
      actions.push({
        id: "archive",
        label: "Archive",
        icon: Archive,
        danger: true,
        disabled: !allowed.ok,
        reason: allowed.ok ? undefined : allowed.reason,
        onSelect: () => void archive(task),
      });
    }
    return actions;
  };
  const withTask = (handler: (task: CanonicalTask, model: TaskCardModel) => void) => (model: TaskCardModel) => {
    const task = taskById.get(model.id);
    if (task) handler(task, model);
  };
  const listEmpty: TaskListEmpty = !tasks.length || (!filtersActive && !filtered.length)
    ? { kind: "first-run", onCapture }
    : {
      kind: "filtered",
      scope: taskQuickFilters.find(item => item.id === filter)?.label ?? "All",
      query: query.trim() || undefined,
      onClear: clearFilters,
    };
  const selectedModel = selectedTask ? taskCardModel(selectedTask, cardCtx) : null;

  return (
    <section className="task-workspace tk-workspace" aria-label="Task workspace">
      <TaskHeader
        summary={summary}
        view={view}
        onViewChange={next => onViewChange(next)}
        reviewCount={conflictedTaskIds.length}
        onReview={conflictedTaskIds.length ? () => openDetail({ id: conflictedTaskIds[0] }, rowTrigger(conflictedTaskIds[0])) : undefined}
        offline={!isOnline}
      />

      {view === "list" || view === "board" ? (
        <TaskToolbar
          view={view}
          query={query}
          onQueryChange={next => viewState({ query: next })}
          searchRef={searchRef}
          filter={filter}
          counts={counts}
          onFilterChange={next => viewState({ filter: next })}
          facets={facets}
          onFacetsChange={setFacets}
          categoryOptions={categoryOptions}
          projectOptions={projectOptions}
          sort={sort}
          onSortChange={next => viewState({ sort: next })}
          group={listGroup}
          onGroupChange={setListGroup}
        />
      ) : null}

      {undo ? <div className="task-undo" role="status"><span>{undo.label}</span><button type="button" onClick={() => void undoLast()}>Undo</button><button type="button" aria-label="Dismiss undo" onClick={() => setUndo(null)}>×</button></div> : null}

      {view === "inbox" ? (
        <InboxTriage
          tasks={inboxRows}
          today={today}
          timezone={timezone}
          projects={projects}
          pendingTaskIds={pendingTaskIds}
          whyFor={task => whyFor(task, "inbox_triage")}
          onDecide={decideInbox}
          onOpenDetail={openDetail}
          onCapture={onCapture}
        />
      ) : null}

      {view === "list" ? (
        <TaskListGroups
          groupBy={listGroup}
          groups={listGroups}
          categoryTones={categoryTones}
          onOpen={(model, trigger) => openDetail(model, trigger)}
          onToggle={withTask((task, model) => void checkTask(task, model))}
          onBlockedCheck={withTask(explainBlockedCheck)}
          onStartFocus={onStartFocus ? withTask(task => onStartFocus(task)) : undefined}
          actionsFor={rowActions}
          empty={listEmpty}
        />
      ) : null}

      {view === "board" ? (
        <TaskWeekBoard
          lens={boardLensShown(boardLens)}
          onLensChange={setBoardLens}
          tasks={filtered}
          allTasks={tasks}
          today={today}
          timezone={timezone}
          occurrences={occurrences}
          dropContext={boardDropContext}
          modelFor={boardModelFor}
          pillsFor={boardPillsFor}
          categoryTones={categoryTones}
          onUpdate={onUpdate}
          onResolveOccurrence={onResolveOccurrence}
          onOpen={openDetail}
          onToggle={(task, model) => void checkTask(task, model)}
          onBlockedCheck={explainBlockedCheck}
        />
      ) : null}

      {view === "archive" ? (
        <TaskArchive
          tasks={tasks}
          today={today}
          timezone={timezone}
          tab={archiveTab}
          onTabChange={setArchiveTab}
          query={query}
          onQueryChange={next => viewState({ query: next })}
          pillsFor={task => rowPills(task, today, pillCtx)}
          categoryTones={categoryTones}
          onRestore={restore}
          onOpenDetail={openDetail}
        />
      ) : null}

      <TaskDetailSheet
        draftScopeKey={taskDraftScopeKey}
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
        cardModel={selectedModel}
        onComplete={task => { if (selectedModel) void checkTask(task, selectedModel); }}
        onOpenChange={open => { if (!open) onSelectedRecordChange(null); }}
        onStartFocus={onStartFocus}
        onUpdate={onUpdate}
        onCreateSubtask={onCreateSubtask}
        onAddDependency={onAddDependency}
        onRemoveDependency={onRemoveDependency}
      />
    </section>
  );
}
