// D3b contract between the drag logic (`useTaskDnd`, opus) and the Board visuals (`TaskBoard`, Fable).
// Spec: docs/superpowers/specs/2026-10-13-premium-redesign-d3-tasks.md §3.3, §4.1-4.4, §6, §8, §12.
// Ids: draggable/sortable ids are task ids; droppable ids are `TaskDropZoneId` strings.
import type { DndContextProps } from "@dnd-kit/core";
import type { TaskStatusLaneId } from "@shared/taskBoard";
import type { TaskWhenBucket } from "@shared/taskBuckets";
import type { TaskDropPatch, TaskDropRefusal } from "@shared/taskDrop";
import type { TaskCardModel } from "./taskCardModel";

export type TaskDropZoneId =
  | `lane:${TaskStatusLaneId}`
  | `bucket:${TaskWhenBucket}`
  | "dock:plan_today"
  | "dock:archive";

/** One Board column, already filtered and ordered by the container. */
export type TaskBoardLaneView = {
  zone: TaskDropZoneId;
  label: string;
  /** Total open tasks in the lane (rolls on change), including any not shown. */
  count: number;
  models: readonly TaskCardModel[];
  /** Cards beyond the preview limit; the lane offers "Show all". */
  hiddenCount: number;
  showAll: boolean;
  onToggleShowAll?: () => void;
};

export type TaskDragRefusal = Pick<TaskDropRefusal, "reason" | "rule" | "action">;

/** Live drag state; null when nothing is being dragged. */
export type TaskDragPreview = {
  activeId: string;
  overZone: TaskDropZoneId | null;
  /** Set while hovering a zone that would refuse the drop (lock icon + reason). */
  refusal: TaskDragRefusal | null;
};

/** A drop that needs a date first (When lens "Next 7 days" / "Later", triage "Pick date"). */
export type TaskDateRequest = {
  taskId: string;
  min: string;
  max: string | null;
  resolve(localDate: string): void;
  cancel(): void;
  /** Additive (R3): the zone the card was dropped on, for anchoring the popover. */
  zone?: TaskDropZoneId;
  /** Additive (R3): why the last choice was refused (outside min/max); the popover stays open. */
  error?: string | null;
};

/** Additive (R3): a polite live-region message that dnd-kit's own announcer cannot carry (post-write, Move to menu). */
export type TaskDndAnnouncement = { id: number; text: string };

export type TaskDndController = {
  /** Spread onto `<DndContext>` (sensors, collision detection, handlers, accessibility announcements). */
  contextProps: Omit<DndContextProps, "children">;
  preview: TaskDragPreview | null;
  /** Task ids with an optimistic write in flight (2px shimmer on the card). */
  pendingIds: ReadonlySet<string>;
  /** Where a card sits optimistically before the server answers; the container applies it to lanes. */
  optimisticZone: ReadonlyMap<string, TaskDropZoneId>;
  dateRequest: TaskDateRequest | null;
  /** Non-null when in-lane reordering is off: non-Manual sort, or filters hide tasks (review #9). */
  reorderDisabledReason: string | null;
  /** Task id → server/policy error text shown under the card for about 6s. */
  inlineErrors: ReadonlyMap<string, string>;
  /** Same write path as a drop; used by the card "Move to" menu and keyboard. */
  moveTo(taskId: string, zone: TaskDropZoneId): void;
  /**
   * Additive (R3): the optimistic patch per task id (state, sortOrder, scheduledLocalDate), including rebalanced
   * siblings. Merge it into the records before building lanes so the card also keeps its new position.
   */
  optimisticPatches?: ReadonlyMap<string, TaskDropPatch>;
  /** Additive (R3): "Saved." / "Saved on this device." / "Could not move. …" and Move-to results; render in a polite live region. */
  announcement?: TaskDndAnnouncement | null;
};
