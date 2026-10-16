// D3b drag logic (spec D3 §3.3, §6, §12; contract `taskDndTypes.ts`).
// The behaviour lives in `TaskDndEngine`, a plain object with no React or DOM dependency, so every rule is
// unit-tested in node. `useTaskDnd` wraps it with dnd-kit sensors, collision detection and announcements.
// Writes go through injected callbacks only (no Home or tRPC imports); every write is one `planTaskDrop` plan.
import {
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type Activators,
  type Announcements,
  type Collision,
  type CollisionDetection,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
  type KeyboardSensorOptions,
  type PointerSensorOptions,
  type TouchSensorOptions,
} from "@dnd-kit/core";
import { statusLaneForTaskState, statusLaneLabel, taskStatusLanes, type TaskStatusLaneId } from "@shared/taskBoard";
import { reservedLocalDate, taskWhenBuckets, taskWhenPlacement, type TaskWhenBucket } from "@shared/taskBuckets";
import { weekdayDayLabel } from "@shared/taskDateLabels";
import {
  planTaskDrop,
  sortOrderNotice,
  taskDropDateChoice,
  taskLateDropChoice,
  type DropTask,
  type TaskLateDropConfirm,
  type TaskDropContext,
  type TaskDropPatch,
  type TaskDropPlan,
  type TaskDropTarget,
  type TaskDropWrite,
} from "@shared/taskDrop";
import type { SortableTask } from "@shared/taskOrdering";
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from "react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type {
  TaskBoardLaneView,
  TaskDateRequest,
  TaskDndAnnouncement,
  TaskDndController,
  TaskDragPreview,
  TaskDropZoneId,
  TaskLateDropRequest,
} from "./taskDndTypes";
import { sortWorkspaceTasks, taskTieBreak, type TaskBoardLens, type WorkspaceTask } from "./taskWorkspaceModel";

export type TaskDndTask = DropTask & { title: string; version?: number };

export type TaskDndOptions<T extends TaskDndTask = TaskDndTask> = {
  lens: TaskBoardLens;
  /**
   * Every task record, unfiltered (all states). The raw record is what `onUpdate` receives (it carries the
   * version), and the FULL Status lane for re-order maths is built from it (review #9).
   */
  tasks: readonly T[];
  /** The lanes as rendered: filtered, sorted, preview-limited. */
  lanes: readonly TaskBoardLaneView[];
  /** today, timezone, sort, occurrences, dependencies, committedTasks. `ctx.tasks` defaults to `tasks`. */
  ctx: TaskDropContext;
  /** `planner.task.update` (Home's `persistTaskPatch`). `{queued: true}` means it was saved on this device. */
  onUpdate(task: T, patch: TaskDropPatch): Promise<unknown>;
  /** `planner.occurrence.resolve(..., "completed")` for today's occurrence of a recurring task. */
  onResolveOccurrence?(task: T, occurrence: { id: string; expectedVersion: number }): Promise<unknown>;
  /** Defaults to tRPC's `error.data.code === "CONFLICT"`. */
  isConflict?(error: unknown): boolean;
  /** Called after a conflict rolled the card back (refetch, show "Changed elsewhere"). */
  onConflict?(taskId: string): void;
  /** How long an inline error stays under the card. Default 6000ms. */
  errorTtlMs?: number;
  /** Exposed back to the UI unchanged; the logic never depends on it. */
  reducedMotion?: boolean;
  /**
   * Long-press touch drag (default true). The Week board passes false (owner Q3, T2b-1): on touch the card
   * ⋯ "Plan for" menu is the way to move work, so a swipe always scrolls.
   */
  touch?: boolean;
};

export type TaskDndSnapshot = {
  preview: TaskDragPreview | null;
  pendingIds: ReadonlySet<string>;
  optimisticZone: ReadonlyMap<string, TaskDropZoneId>;
  optimisticPatches: ReadonlyMap<string, TaskDropPatch>;
  dateRequest: TaskDateRequest | null;
  /** The late-drop prompt (Q4) waiting for Plan anyway / Move deadline / Cancel. */
  lateDrop: TaskLateDropRequest | null;
  inlineErrors: ReadonlyMap<string, string>;
  announcement: TaskDndAnnouncement | null;
};

export type TaskDropOutcome = {
  /** What the drop says right away (dnd-kit's end announcement, or the Move-to live message). */
  message: string;
  /** Resolves once the write settled (or immediately when nothing is written). Never rejects. */
  done: Promise<void>;
};

export const TASK_DRAG_HANDLE_ATTRIBUTE = "data-task-drag-handle";
export const TASK_DND_ERROR_TTL_MS = 6000;
export const TASK_DND_INSTRUCTIONS =
  "To move a task, press Space. Use the arrow keys to move it, Left and Right to change lane. Press Space to drop or Escape to cancel.";
/** Same copy as the TaskWorkspace check-off path when no resolver is wired. */
export const OCCURRENCE_UNAVAILABLE_REASON = "Today's repeat can only be resolved from Plan here. Nothing was saved.";
export const CONFLICT_REASON = "Changed elsewhere.";
export const STILL_SAVING_REASON = "The last move is still saving.";
export const WHEN_LENS_REORDER_REASON = "Dates set the order in the When lens.";
export const WEEK_LENS_REORDER_REASON = "Plan days set the order on the Week board.";
export const UNSCHEDULED_ZONE: TaskDropZoneId = "day:none";
const DAY_ZONE = /^day:\d{4}-\d{2}-\d{2}$/;
const FALLBACK_ERROR = "Nothing was saved.";

const DOCK_LABELS: Record<"dock:plan_today" | "dock:archive", string> = {
  "dock:plan_today": "Plan for today",
  "dock:archive": "Archive",
};

// ---------- pure helpers ----------

export function isTaskDropZoneId(id: unknown): id is TaskDropZoneId {
  if (typeof id !== "string") return false;
  if (id === "dock:plan_today" || id === "dock:archive") return true;
  if (id.startsWith("lane:")) return taskStatusLanes.some(lane => `lane:${lane.id}` === id);
  if (id.startsWith("bucket:")) return taskWhenBuckets.some(bucket => `bucket:${bucket.id}` === id);
  if (id.startsWith("day:")) return id === UNSCHEDULED_ZONE || DAY_ZONE.test(id);
  return false;
}

/** The Week board zone for a local day, or Unscheduled for null. */
export function dayZone(localDate: string | null): TaskDropZoneId {
  return localDate ? `day:${localDate}` : UNSCHEDULED_ZONE;
}

export function dropTargetForZone(zone: TaskDropZoneId): TaskDropTarget {
  if (zone.startsWith("lane:")) return { kind: "status", lane: zone.slice(5) as TaskStatusLaneId };
  if (zone.startsWith("bucket:")) return { kind: "when", bucket: zone.slice(7) as TaskWhenBucket };
  if (zone.startsWith("day:")) return { kind: "day", date: zone === UNSCHEDULED_ZONE ? null : zone.slice(4) };
  return { kind: "dock", action: zone === "dock:archive" ? "archive" : "plan_today" };
}

/**
 * The zone a task sits in under a lens; archived work leaves the board (`dock:archive`). Week lens: the
 * Plan for day (a reservation stands in when there is no Plan for, as in the When buckets), else Unscheduled.
 */
export function zoneForTask(task: DropTask, lens: TaskBoardLens, ctx: Pick<TaskDropContext, "today" | "timezone" | "occurrences">): TaskDropZoneId {
  if (task.state === "archived") return "dock:archive";
  if (lens === "status") return `lane:${statusLaneForTaskState(task.state) ?? "todo"}`;
  if (lens === "week") return dayZone(task.scheduledLocalDate ?? reservedLocalDate(task, ctx.timezone));
  return `bucket:${taskWhenPlacement(task, ctx).bucket}`;
}

export function zoneLabel(zone: TaskDropZoneId, lanes: readonly TaskBoardLaneView[] = []) {
  const view = lanes.find(lane => lane.zone === zone);
  if (view) return view.label;
  if (zone === "dock:plan_today" || zone === "dock:archive") return DOCK_LABELS[zone];
  if (zone === UNSCHEDULED_ZONE) return "Unscheduled";
  if (zone.startsWith("day:")) return weekdayDayLabel(zone.slice(4));
  if (zone.startsWith("lane:")) return statusLaneLabel(zone.slice(5) as TaskStatusLaneId);
  return taskWhenBuckets.find(bucket => `bucket:${bucket.id}` === zone)?.label ?? zone;
}

/** Spec §12 announcement strings (positions are 1-based). */
export const taskDndMessages = {
  start: (title: string, lane: string, position: number, total: number) => `Picked up ${title}. In ${lane}, position ${position} of ${total}.`,
  over: (title: string, lane: string, position: number | null, total: number | null) =>
    position !== null && total !== null ? `${title} is over ${lane}, position ${position} of ${total}.` : `${title} is over ${lane}.`,
  refused: (lane: string, reason: string) => `${lane} is not available. ${reason}`,
  end: (title: string, lane: string, position: number | null) => (position !== null ? `${title} moved to ${lane}, position ${position}.` : `${title} moved to ${lane}.`),
  saved: (queued: boolean) => (queued ? "Saved on this device." : "Saved."),
  failed: (reason: string, title: string, origin: string) => `Could not move. ${reason} ${title} is back in ${origin}.`,
  cancel: (title: string, lane: string) => `Move cancelled. ${title} is back in ${lane}.`,
};

export function defaultIsConflict(error: unknown) {
  const value = error as { data?: { code?: string }; shape?: { data?: { code?: string } }; code?: string } | null;
  return value?.data?.code === "CONFLICT" || value?.shape?.data?.code === "CONFLICT" || value?.code === "CONFLICT";
}

function errorText(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return FALLBACK_ERROR;
}

/** Non-null when in-lane re-ordering is off: a non-Manual sort, or the When lens (dates order it). */
export function taskReorderDisabledReason(lens: TaskBoardLens, sort: TaskDropContext["sort"]) {
  return sortOrderNotice(sort) ?? (lens === "when" ? WHEN_LENS_REORDER_REASON : lens === "week" ? WEEK_LENS_REORDER_REASON : null);
}

const INTERACTIVE_SELECTOR =
  "button, a[href], input, textarea, select, summary, [role='button'], [role='menuitem'], [role='checkbox'], [role='switch'], [contenteditable='true']";

type ClosestCapable = { closest(selector: string): unknown };

/**
 * Drag may start from the card body or from the handle (`data-task-drag-handle`), never from a button,
 * link or field inside the card. An interactive element that is itself the listener node (a card with
 * role="button") still drags.
 */
export function canStartTaskDrag(target: unknown, currentTarget: unknown) {
  const element = target as ClosestCapable | null;
  if (!element || typeof element.closest !== "function") return true;
  if (element.closest(`[${TASK_DRAG_HANDLE_ATTRIBUTE}]`)) return true;
  const interactive = element.closest(INTERACTIVE_SELECTOR);
  return !interactive || interactive === currentTarget;
}

/** Mouse and pen only (touch goes to the long-press sensor, so a quick swipe still scrolls). */
export class TaskPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent: event, currentTarget }: ReactPointerEvent, { onActivation }: PointerSensorOptions) => {
        if (!event.isPrimary || event.button !== 0 || event.pointerType === "touch") return false;
        if (!canStartTaskDrag(event.target, currentTarget)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

export class TaskTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: ({ nativeEvent: event, currentTarget }: ReactTouchEvent, { onActivation }: TouchSensorOptions) => {
        if (event.touches.length > 1) return false;
        if (!canStartTaskDrag(event.target, currentTarget)) return false;
        onActivation?.({ event });
        return true;
      },
    },
  ];
}

export class TaskKeyboardSensor extends KeyboardSensor {
  static activators: Activators<KeyboardSensorOptions> = [
    {
      eventName: "onKeyDown",
      handler: (event, options, context) => {
        if (!canStartTaskDrag(event.target, event.currentTarget)) return false;
        return KeyboardSensor.activators[0].handler(event, options, context);
      },
    },
  ];
}

/** Pointer: 6px. Touch: 250ms long-press with 8px tolerance (spec §12). */
export const TASK_POINTER_ACTIVATION = { distance: 6 } as const;
export const TASK_TOUCH_ACTIVATION = { delay: 250, tolerance: 8 } as const;

type LaneStops = { zone: TaskDropZoneId; stops: string[] };

function laneStops(lanes: readonly TaskBoardLaneView[], activeId: string): LaneStops[] {
  return lanes
    .filter(lane => lane.zone.startsWith("lane:") || lane.zone.startsWith("bucket:") || lane.zone.startsWith("day:"))
    .map(lane => {
      const ids = lane.models.map(model => model.id);
      // Another lane ends with its own well (= drop at the end); the origin lane is just its cards.
      return { zone: lane.zone, stops: ids.includes(activeId) ? ids : [...ids, lane.zone] };
    });
}

/**
 * Keyboard moves between cards and lanes: ↑/↓ within the lane, ←/→ to the top of the adjacent lane.
 * `onTarget` receives the droppable id the move aims at; the collision detection then returns exactly it.
 */
export function createTaskKeyboardCoordinates(getLanes: () => readonly TaskBoardLaneView[], onTarget: (id: string) => void): KeyboardCoordinateGetter {
  return (event, { active, context }) => {
    const code = event.code;
    if (code !== "ArrowUp" && code !== "ArrowDown" && code !== "ArrowLeft" && code !== "ArrowRight") return undefined;
    event.preventDefault();
    const activeId = String(active);
    const lanes = laneStops(getLanes(), activeId);
    if (!lanes.length) return undefined;
    const overId = context.over ? String(context.over.id) : activeId;
    let laneIndex = lanes.findIndex(lane => lane.stops.includes(overId));
    if (laneIndex < 0) laneIndex = lanes.findIndex(lane => lane.stops.includes(activeId));
    if (laneIndex < 0) return undefined;
    const slot = lanes[laneIndex].stops.indexOf(lanes[laneIndex].stops.includes(overId) ? overId : activeId);

    let targetId: string | undefined;
    if (code === "ArrowUp") targetId = lanes[laneIndex].stops[slot - 1];
    else if (code === "ArrowDown") targetId = lanes[laneIndex].stops[slot + 1];
    else targetId = lanes[laneIndex + (code === "ArrowRight" ? 1 : -1)]?.stops[0];
    if (!targetId) return undefined;

    const rect = context.droppableRects.get(targetId);
    if (!rect) return undefined;
    onTarget(targetId);
    return { x: rect.left, y: rect.top };
  };
}

/**
 * Pointer: the drop dock wins (it floats over the lanes), then the card under the pointer, then the lane well.
 * Keyboard: exactly the droppable the coordinate getter aimed at.
 */
export function createTaskCollisionDetection(getKeyboardTarget: () => string | null): CollisionDetection {
  return args => {
    if (!args.pointerCoordinates) {
      const targetId = getKeyboardTarget();
      const container = targetId ? args.droppableContainers.find(entry => String(entry.id) === targetId) : undefined;
      if (container) return [{ id: container.id, data: { droppableContainer: container, value: 0 } }];
      return closestCorners(args);
    }
    const within = pointerWithin(args);
    const first = (test: (id: string) => boolean): Collision | undefined => within.find(collision => test(String(collision.id)));
    const hit = first(id => id.startsWith("dock:")) ?? first(id => !isTaskDropZoneId(id)) ?? first(id => isTaskDropZoneId(id));
    if (hit) return [hit];
    return rectIntersection(args);
  };
}

// ---------- engine ----------

type DragSession = { activeId: string; origin: TaskDropZoneId };

type Located = { zone: TaskDropZoneId; index: number | null };

type DateSession = { token: number; taskId: string; zone: TaskDropZoneId; origin: TaskDropZoneId; write: Extract<TaskDropWrite, { kind: "needsDate" }> };

type LateSession = { token: number; taskId: string; zone: TaskDropZoneId; origin: TaskDropZoneId; write: TaskLateDropConfirm };

const EMPTY_SNAPSHOT: TaskDndSnapshot = {
  preview: null,
  pendingIds: new Set(),
  optimisticZone: new Map(),
  optimisticPatches: new Map(),
  dateRequest: null,
  lateDrop: null,
  inlineErrors: new Map(),
  announcement: null,
};

/** "Mon is after the Sat deadline. Plan anyway, move the deadline, or cancel." */
export function lateQuestion(write: Pick<TaskLateDropConfirm, "prompt">) {
  return `${write.prompt}. Plan anyway, move the deadline, or cancel.`;
}

function hasQueuedFlag(result: unknown) {
  return Boolean(result && typeof result === "object" && (result as { queued?: unknown }).queued === true);
}

function manualOrder(left: TaskDndTask, right: TaskDndTask) {
  return taskTieBreak(
    { id: left.id, state: left.state, title: left.title, sortOrder: left.sortOrder },
    { id: right.id, state: right.state, title: right.title, sortOrder: right.sortOrder },
  );
}

export class TaskDndEngine<T extends TaskDndTask = TaskDndTask> {
  options: TaskDndOptions<T>;
  private snapshot: TaskDndSnapshot = EMPTY_SNAPSHOT;
  private listeners = new Set<() => void>();
  private errorTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private inFlight = new Set<Promise<void>>();
  private drag: DragSession | null = null;
  private dateSession: DateSession | null = null;
  private lateSession: LateSession | null = null;
  private sequence = 0;
  private dateToken = 0;
  /** The last message per dnd-kit event, read by `announcements` right after the matching handler ran. */
  readonly messages: { start?: string; over?: string; end?: string; cancel?: string } = {};
  keyboardTarget: string | null = null;

  constructor(options: TaskDndOptions<T>) {
    this.options = options;
  }

  // store
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<TaskDndSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  /** Resolves when every write in flight has settled (tests, and the harness). */
  async idle() {
    while (this.inFlight.size) await Promise.all(Array.from(this.inFlight));
  }
  /** Stops the inline-error timers (unmount). Subscriptions stay with useSyncExternalStore (StrictMode-safe). */
  dispose() {
    this.errorTimers.forEach(timer => clearTimeout(timer));
    this.errorTimers.clear();
  }

  // data
  private get dropCtx(): TaskDropContext {
    const ctx = this.options.ctx;
    const pendingTaskIds = ctx.pendingTaskIds ?? this.snapshot.pendingIds;
    return ctx.tasks ? { ...ctx, pendingTaskIds } : { ...ctx, pendingTaskIds, tasks: this.effectiveTasks() as TaskDropContext["tasks"] };
  }
  private rawTask(id: string) {
    return this.options.tasks.find(task => task.id === id) ?? null;
  }
  private effectiveTask(id: string): T | null {
    const raw = this.rawTask(id);
    if (!raw) return null;
    const patch = this.snapshot.optimisticPatches.get(id);
    return patch ? { ...raw, ...patch } : raw;
  }
  private effectiveTasks(): T[] {
    const patches = this.snapshot.optimisticPatches;
    if (!patches.size) return [...this.options.tasks];
    return this.options.tasks.map(task => (patches.has(task.id) ? { ...task, ...patches.get(task.id) } : task));
  }
  private laneView(zone: TaskDropZoneId) {
    return this.options.lanes.find(lane => lane.zone === zone) ?? null;
  }
  private title(id: string) {
    return this.rawTask(id)?.title ?? "Task";
  }
  /** Where the card is now: its optimistic zone, else the rendered lane holding it, else where its data puts it. */
  zoneOf(taskId: string): TaskDropZoneId {
    const optimistic = this.snapshot.optimisticZone.get(taskId);
    if (optimistic) return optimistic;
    const lane = this.options.lanes.find(view => view.models.some(model => model.id === taskId));
    if (lane) return lane.zone;
    const task = this.effectiveTask(taskId);
    return task ? zoneForTask(task, this.options.lens, this.options.ctx) : `lane:todo`;
  }
  private label(zone: TaskDropZoneId) {
    return zoneLabel(zone, this.options.lanes);
  }

  /** Maps a dnd-kit `over` id to a zone and a visible index (moved card taken out; null = no position). */
  locate(activeId: string, overId: string | null): Located | null {
    if (overId === null) return null;
    if (isTaskDropZoneId(overId)) {
      const view = this.laneView(overId);
      if (!view) return { zone: overId, index: null };
      return { zone: overId, index: view.models.filter(model => model.id !== activeId).length };
    }
    const view = this.options.lanes.find(lane => lane.models.some(model => model.id === overId));
    if (!view) return null;
    // Same lane: arrayMove semantics (lands at the hovered slot). Other lane: inserts before the hovered card.
    return { zone: view.zone, index: view.models.findIndex(model => model.id === overId) };
  }

  /**
   * Review #9: re-order maths always run on the FULL Status lane (every record in that state, including tasks
   * hidden by search, filters or the preview limit), in the Manual order. The visible drop slot is mapped onto
   * it: before the next visible card, else after the previous visible card.
   */
  fullLanePlacement(lane: TaskStatusLaneId, zone: TaskDropZoneId, movedId: string, visibleIndex: number): { laneTasks: SortableTask[]; index: number } {
    const full = this.effectiveTasks()
      .filter(task => statusLaneForTaskState(task.state) === lane)
      .sort(manualOrder);
    const laneTasks = full.map(task => ({ id: task.id, sortOrder: Number(task.sortOrder) || 0 }));
    const fullOthers = laneTasks.filter(task => task.id !== movedId);
    const visible = (this.laneView(zone)?.models ?? []).map(model => model.id);
    const ownVisible = visible.indexOf(movedId);
    if (ownVisible >= 0 && ownVisible === visibleIndex) {
      const own = laneTasks.findIndex(task => task.id === movedId);
      if (own >= 0) return { laneTasks, index: own };
    }
    const visibleOthers = visible.filter(id => id !== movedId);
    const next = visibleOthers[visibleIndex];
    const prev = visibleOthers[visibleIndex - 1];
    const nextAt = next ? fullOthers.findIndex(task => task.id === next) : -1;
    const prevAt = prev ? fullOthers.findIndex(task => task.id === prev) : -1;
    const index = nextAt >= 0 ? nextAt : prevAt >= 0 ? prevAt + 1 : fullOthers.length;
    return { laneTasks, index };
  }

  plan(taskId: string, zone: TaskDropZoneId, index: number | null): { task: T; target: TaskDropTarget; plan: TaskDropPlan } | null {
    const task = this.effectiveTask(taskId);
    if (!task) return null;
    let target = dropTargetForZone(zone);
    if (target.kind === "status" && index !== null) {
      target = { ...target, placement: this.fullLanePlacement(target.lane, zone, taskId, index) };
    }
    return { task, target, plan: planTaskDrop(task, target, this.dropCtx) };
  }

  /** 1-based position the card will take in `zone`, or null when the zone has no rendered lane (dock, List view). */
  private landingPosition(taskId: string, zone: TaskDropZoneId, index: number | null, patched: T) {
    const view = this.laneView(zone);
    if (!view) return null;
    if (this.options.ctx.sort === "manual" && index !== null && zone.startsWith("lane:")) return index + 1;
    const others = view.models.map(model => this.effectiveTask(model.id)).filter((task): task is T => Boolean(task) && task!.id !== taskId);
    const sorted = sortWorkspaceTasks([...others, patched] as unknown as WorkspaceTask[], this.options.ctx.sort);
    return sorted.findIndex(task => task.id === taskId) + 1;
  }

  // dnd-kit events
  dragStart(activeId: string): string {
    if (this.dateSession) this.cancelDate(this.dateSession.token);
    if (this.lateSession) this.cancelLate(this.lateSession.token);
    const origin = this.zoneOf(activeId);
    this.drag = { activeId, origin };
    this.keyboardTarget = activeId;
    this.messages.over = this.messages.end = this.messages.cancel = undefined;
    this.update({ preview: { activeId, overZone: origin, refusal: null } });
    const view = this.laneView(origin);
    const ids = view?.models.map(model => model.id) ?? [];
    const position = Math.max(0, ids.indexOf(activeId)) + 1;
    const total = ids.length + (view?.hiddenCount ?? 0);
    const message = taskDndMessages.start(this.title(activeId), this.label(origin), position, Math.max(total, position));
    this.messages.start = message;
    return message;
  }

  dragOver(activeId: string, overId: string | null): string | undefined {
    const located = this.locate(activeId, overId);
    if (!located) {
      this.update({ preview: { activeId, overZone: null, refusal: null } });
      this.messages.over = undefined;
      return undefined;
    }
    const planned = this.plan(activeId, located.zone, located.index);
    const refusal = planned && !planned.plan.ok ? { reason: planned.plan.reason, rule: planned.plan.rule, ...(planned.plan.action ? { action: planned.plan.action } : {}) } : null;
    const lateWarning = planned?.plan.ok && planned.plan.write.kind === "confirmLate" ? planned.plan.write.prompt : null;
    this.update({ preview: { activeId, overZone: located.zone, refusal, ...(lateWarning ? { lateWarning } : {}) } });
    const label = this.label(located.zone);
    let message: string;
    if (refusal) {
      message = taskDndMessages.refused(label, refusal.reason);
    } else {
      const view = this.laneView(located.zone);
      if (!view || located.index === null) {
        message = taskDndMessages.over(this.title(activeId), label, null, null);
      } else {
        const holdsActive = view.models.some(model => model.id === activeId);
        const total = view.models.length + (holdsActive ? 0 : 1) + view.hiddenCount;
        message = taskDndMessages.over(this.title(activeId), label, located.index + 1, total);
      }
    }
    this.messages.over = message;
    return message;
  }

  dragEnd(activeId: string, overId: string | null): TaskDropOutcome {
    const origin = this.drag?.activeId === activeId ? this.drag.origin : this.zoneOf(activeId);
    this.drag = null;
    this.keyboardTarget = null;
    this.update({ preview: null });
    const located = this.locate(activeId, overId);
    const outcome = located ? this.execute(activeId, located, origin) : { message: taskDndMessages.cancel(this.title(activeId), this.label(origin)), done: Promise.resolve() };
    this.messages.end = outcome.message;
    return outcome;
  }

  dragCancel(activeId: string): string {
    const origin = this.drag?.activeId === activeId ? this.drag.origin : this.zoneOf(activeId);
    this.drag = null;
    this.keyboardTarget = null;
    this.update({ preview: null });
    const message = taskDndMessages.cancel(this.title(activeId), this.label(origin));
    this.messages.cancel = message;
    return message;
  }

  /**
   * The card "Move to" menu: exactly a drop on that zone's well (end of a rendered lane), through the same
   * plan → write path, announced through the live message instead of dnd-kit's.
   */
  moveTo(taskId: string, zone: TaskDropZoneId): TaskDropOutcome {
    if (this.dateSession) this.cancelDate(this.dateSession.token, false);
    if (this.lateSession) this.cancelLate(this.lateSession.token, false);
    const outcome = this.execute(taskId, this.locate(taskId, zone) ?? { zone, index: null }, this.zoneOf(taskId));
    this.announce(outcome.message);
    return outcome;
  }

  // the one write path
  private execute(taskId: string, located: Located, origin: TaskDropZoneId): TaskDropOutcome {
    const title = this.title(taskId);
    const originLabel = this.label(origin);
    const settled = Promise.resolve();
    if (this.snapshot.pendingIds.has(taskId)) {
      return { message: taskDndMessages.failed(STILL_SAVING_REASON, title, originLabel), done: settled };
    }
    const planned = this.plan(taskId, located.zone, located.index);
    if (!planned) return { message: taskDndMessages.cancel(title, originLabel), done: settled };
    const { task, plan } = planned;
    if (!plan.ok) {
      this.setInlineError(taskId, plan.reason);
      return { message: taskDndMessages.failed(plan.reason, title, originLabel), done: settled };
    }

    const zoneName = this.label(located.zone);
    const write = plan.write;
    const withNote = (text: string) => (plan.announcement ? `${text} ${plan.announcement}` : text);

    if (write.kind === "none") {
      return { message: withNote(taskDndMessages.end(title, zoneName, this.landingPosition(taskId, located.zone, located.index, task))), done: settled };
    }

    if (write.kind === "needsDate") {
      const token = ++this.dateToken;
      this.dateSession = { token, taskId, zone: located.zone, origin, write };
      const optimisticZone = new Map(this.snapshot.optimisticZone).set(taskId, located.zone);
      this.update({ optimisticZone, dateRequest: this.dateRequestFor(this.dateSession, null) });
      return { message: taskDndMessages.end(title, zoneName, null), done: settled };
    }

    if (write.kind === "confirmLate") {
      this.startLate(taskId, located.zone, origin, write);
      return { message: `${taskDndMessages.end(title, zoneName, null)} ${lateQuestion(write)}`, done: settled };
    }

    if (write.kind === "resolveOccurrence") {
      const raw = this.rawTask(taskId)!;
      const occurrence = { id: write.occurrenceId, expectedVersion: write.expectedVersion };
      const done = this.run(taskId, [taskId], new Map(), new Map(), originLabel, title, [
        () => {
          if (!this.options.onResolveOccurrence) return Promise.reject(new Error(OCCURRENCE_UNAVAILABLE_REASON));
          return this.options.onResolveOccurrence(raw, occurrence);
        },
      ]);
      return { message: plan.announcement ?? taskDndMessages.end(title, zoneName, null), done };
    }

    const siblings = write.kind === "rebalance" ? write.writes : [];
    const patched = { ...task, ...write.patch } as T;
    const position = this.landingPosition(taskId, located.zone, located.index, patched);
    const done = this.applyPatch(taskId, write.patch, siblings, originLabel, title);
    // A position is only announced when the card really lands in the target lane (an overdue card planned for
    // today stays in Past due, and the plan's own note says so).
    const lands = located.zone.startsWith("dock:") || zoneForTask(patched, this.options.lens, this.options.ctx) === located.zone;
    return { message: withNote(taskDndMessages.end(title, zoneName, lands ? position : null)), done };
  }

  private applyPatch(taskId: string, patch: TaskDropPatch, siblings: ReadonlyArray<{ id: string; sortOrder: number }>, originLabel: string, title: string) {
    const raw = this.rawTask(taskId)!;
    const patches = new Map<string, TaskDropPatch>();
    const zones = new Map<string, TaskDropZoneId>();
    for (const sibling of siblings) patches.set(sibling.id, { ...this.snapshot.optimisticPatches.get(sibling.id), sortOrder: sibling.sortOrder });
    const merged = { ...this.snapshot.optimisticPatches.get(taskId), ...patch };
    patches.set(taskId, merged);
    zones.set(taskId, zoneForTask({ ...raw, ...merged }, this.options.lens, this.options.ctx));
    const steps: Array<() => Promise<unknown>> = siblings.map(sibling => () => {
      const record = this.rawTask(sibling.id);
      return record ? this.options.onUpdate(record, { sortOrder: sibling.sortOrder }) : Promise.resolve();
    });
    // The moved card is written last, so an interrupted rebalance never strands it.
    steps.push(() => this.options.onUpdate(this.rawTask(taskId) ?? raw, patch));
    return this.run(taskId, [...siblings.map(sibling => sibling.id), taskId], patches, zones, originLabel, title, steps);
  }

  private run(
    taskId: string,
    ids: string[],
    patches: ReadonlyMap<string, TaskDropPatch>,
    zones: ReadonlyMap<string, TaskDropZoneId>,
    originLabel: string,
    title: string,
    steps: Array<() => Promise<unknown>>,
  ): Promise<void> {
    const pendingIds = new Set(this.snapshot.pendingIds);
    ids.forEach(id => pendingIds.add(id));
    const optimisticPatches = new Map(this.snapshot.optimisticPatches);
    patches.forEach((patch, id) => optimisticPatches.set(id, patch));
    const optimisticZone = new Map(this.snapshot.optimisticZone);
    zones.forEach((zone, id) => optimisticZone.set(id, zone));
    this.clearInlineError(taskId);
    this.update({ pendingIds, optimisticPatches, optimisticZone });

    const job = (async () => {
      let queued = false;
      try {
        for (const step of steps) {
          if (hasQueuedFlag(await step())) queued = true;
        }
        this.settle(ids);
        this.announce(taskDndMessages.saved(queued));
      } catch (error) {
        // Rollback: drop the optimistic overlay; the records still hold the server truth.
        this.settle(ids);
        const conflict = (this.options.isConflict ?? defaultIsConflict)(error);
        const reason = conflict ? CONFLICT_REASON : errorText(error);
        this.setInlineError(taskId, reason);
        this.announce(taskDndMessages.failed(reason, title, originLabel));
        if (conflict) this.options.onConflict?.(taskId);
      }
    })();
    this.inFlight.add(job);
    void job.finally(() => this.inFlight.delete(job));
    return job;
  }

  private settle(ids: readonly string[]) {
    const pendingIds = new Set(this.snapshot.pendingIds);
    const optimisticPatches = new Map(this.snapshot.optimisticPatches);
    const optimisticZone = new Map(this.snapshot.optimisticZone);
    for (const id of ids) {
      pendingIds.delete(id);
      optimisticPatches.delete(id);
      optimisticZone.delete(id);
    }
    this.update({ pendingIds, optimisticPatches, optimisticZone });
  }

  // date popover
  private dateRequestFor(session: DateSession, error: string | null): TaskDateRequest {
    return {
      taskId: session.taskId,
      min: session.write.min,
      max: session.write.max,
      zone: session.zone,
      error,
      resolve: localDate => {
        void this.resolveDate(session.token, localDate);
      },
      cancel: () => this.cancelDate(session.token),
    };
  }

  resolveDate(token: number, localDate: string): Promise<void> {
    const session = this.dateSession;
    if (!session || session.token !== token) return Promise.resolve();
    const choice = taskDropDateChoice(session.write, localDate, this.options.ctx.today);
    if (!choice.ok) {
      this.update({ dateRequest: this.dateRequestFor(session, choice.reason) });
      this.announce(choice.reason);
      return Promise.resolve();
    }
    this.dateSession = null;
    if (choice.write.kind === "confirmLate") {
      // The chosen day is after the deadline: the popover closes and the late prompt asks once (Q4).
      this.update({ dateRequest: null });
      this.startLate(session.taskId, session.zone, session.origin, choice.write);
      this.announce(lateQuestion(choice.write));
      return Promise.resolve();
    }
    const optimisticZone = new Map(this.snapshot.optimisticZone);
    optimisticZone.delete(session.taskId);
    this.update({ dateRequest: null, optimisticZone });
    if (choice.write.kind !== "update") return Promise.resolve();
    return this.applyPatch(session.taskId, choice.write.patch, [], this.label(session.origin), this.title(session.taskId));
  }

  cancelDate(token: number, announce = true) {
    const session = this.dateSession;
    if (!session || session.token !== token) return;
    this.dateSession = null;
    const optimisticZone = new Map(this.snapshot.optimisticZone);
    optimisticZone.delete(session.taskId);
    this.update({ dateRequest: null, optimisticZone });
    if (announce) this.announce(taskDndMessages.cancel(this.title(session.taskId), this.label(session.origin)));
  }

  // late-drop prompt (Q4: ask once, then allow)
  private startLate(taskId: string, zone: TaskDropZoneId, origin: TaskDropZoneId, write: TaskLateDropConfirm) {
    const token = ++this.dateToken;
    this.lateSession = { token, taskId, zone, origin, write };
    const optimisticZone = new Map(this.snapshot.optimisticZone).set(taskId, zone);
    this.update({ optimisticZone, lateDrop: this.lateRequestFor(this.lateSession) });
  }

  private lateRequestFor(session: LateSession): TaskLateDropRequest {
    return {
      taskId: session.taskId,
      zone: session.zone,
      day: session.write.day,
      deadline: session.write.deadline,
      prompt: session.write.prompt,
      planAnyway: () => {
        void this.resolveLate(session.token, "plan_anyway");
      },
      moveDeadline: () => {
        void this.resolveLate(session.token, "move_deadline");
      },
      cancel: () => this.cancelLate(session.token),
    };
  }

  /** Applies "Plan anyway" or "Move deadline" through the same optimistic write path as a drop. */
  resolveLate(token: number, choice: "plan_anyway" | "move_deadline"): Promise<void> {
    const session = this.lateSession;
    if (!session || session.token !== token) return Promise.resolve();
    this.lateSession = null;
    const optimisticZone = new Map(this.snapshot.optimisticZone);
    optimisticZone.delete(session.taskId);
    this.update({ lateDrop: null, optimisticZone });
    const plan = taskLateDropChoice(session.write, choice);
    if (!plan.ok || plan.write.kind !== "update") return Promise.resolve();
    if (plan.announcement) this.announce(plan.announcement);
    return this.applyPatch(session.taskId, plan.write.patch, [], this.label(session.origin), this.title(session.taskId));
  }

  cancelLate(token: number, announce = true) {
    const session = this.lateSession;
    if (!session || session.token !== token) return;
    this.lateSession = null;
    const optimisticZone = new Map(this.snapshot.optimisticZone);
    optimisticZone.delete(session.taskId);
    this.update({ lateDrop: null, optimisticZone });
    if (announce) this.announce(taskDndMessages.cancel(this.title(session.taskId), this.label(session.origin)));
  }

  // messages
  announce(text: string) {
    this.sequence += 1;
    this.update({ announcement: { id: this.sequence, text } });
  }

  private setInlineError(taskId: string, text: string) {
    const inlineErrors = new Map(this.snapshot.inlineErrors).set(taskId, text);
    const existing = this.errorTimers.get(taskId);
    if (existing) clearTimeout(existing);
    this.errorTimers.set(taskId, setTimeout(() => this.clearInlineError(taskId), this.options.errorTtlMs ?? TASK_DND_ERROR_TTL_MS));
    this.update({ inlineErrors });
  }

  private clearInlineError(taskId: string) {
    const timer = this.errorTimers.get(taskId);
    if (timer) clearTimeout(timer);
    this.errorTimers.delete(taskId);
    if (!this.snapshot.inlineErrors.has(taskId)) return;
    const inlineErrors = new Map(this.snapshot.inlineErrors);
    inlineErrors.delete(taskId);
    this.update({ inlineErrors });
  }
}

/** Builds the dnd-kit `DndContext` props for an engine (sensors are added by the hook). */
export function taskDndContextHandlers(engine: TaskDndEngine<any>) {
  const announcements: Announcements = {
    onDragStart: () => engine.messages.start,
    onDragOver: () => engine.messages.over,
    onDragEnd: () => engine.messages.end,
    onDragCancel: () => engine.messages.cancel,
  };
  return {
    collisionDetection: createTaskCollisionDetection(() => engine.keyboardTarget),
    onDragStart: (event: DragStartEvent) => {
      engine.dragStart(String(event.active.id));
    },
    onDragOver: (event: DragOverEvent) => {
      engine.dragOver(String(event.active.id), event.over ? String(event.over.id) : null);
    },
    onDragEnd: (event: DragEndEvent) => {
      void engine.dragEnd(String(event.active.id), event.over ? String(event.over.id) : null).done;
    },
    onDragCancel: (event: DragCancelEvent) => {
      engine.dragCancel(String(event.active.id));
    },
    accessibility: { announcements, screenReaderInstructions: { draggable: TASK_DND_INSTRUCTIONS } },
  };
}

export type UseTaskDndResult = TaskDndController & {
  optimisticPatches: ReadonlyMap<string, TaskDropPatch>;
  announcement: TaskDndAnnouncement | null;
  reducedMotion: boolean;
};

export function useTaskDnd<T extends TaskDndTask>(options: TaskDndOptions<T>): UseTaskDndResult {
  const [engine] = useState(() => new TaskDndEngine<T>(options));
  // Latest props for every handler; the engine never caches derived data across renders.
  engine.options = options;
  useEffect(() => () => engine.dispose(), [engine]);
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot, engine.getSnapshot);

  const coordinateGetter = useMemo(
    () => createTaskKeyboardCoordinates(() => engine.options.lanes, id => {
      engine.keyboardTarget = id;
    }),
    [engine],
  );
  const pointerSensor = useSensor(TaskPointerSensor, { activationConstraint: TASK_POINTER_ACTIVATION });
  const touchSensor = useSensor(TaskTouchSensor, { activationConstraint: TASK_TOUCH_ACTIVATION });
  const keyboardSensor = useSensor(TaskKeyboardSensor, { coordinateGetter });
  const sensors = useSensors(pointerSensor, options.touch === false ? null : touchSensor, keyboardSensor);
  const handlers = useMemo(() => taskDndContextHandlers(engine), [engine]);
  const contextProps = useMemo(() => ({ ...handlers, sensors }), [handlers, sensors]);
  const moveTo = useMemo(() => (taskId: string, zone: TaskDropZoneId) => {
    void engine.moveTo(taskId, zone).done;
  }, [engine]);

  return {
    contextProps,
    preview: snapshot.preview,
    pendingIds: snapshot.pendingIds,
    optimisticZone: snapshot.optimisticZone,
    optimisticPatches: snapshot.optimisticPatches,
    dateRequest: snapshot.dateRequest,
    lateDrop: snapshot.lateDrop,
    reorderDisabledReason: taskReorderDisabledReason(options.lens, options.ctx.sort),
    inlineErrors: snapshot.inlineErrors,
    announcement: snapshot.announcement,
    moveTo,
    reducedMotion: Boolean(options.reducedMotion),
  };
}
