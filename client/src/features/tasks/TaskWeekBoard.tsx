// Tasks T2b-1: the Board (owner decisions Q3-Q5, approved prototype `tasks.html` Board section).
// Week lens (default): Unscheduled · Mon…Sun of the shown week (`weekBoardColumns`), ← → paging and a Today
// chip. Dragging a card with the mouse lifts it, highlights the target day and sets Plan for through the T1
// drop engine (`useTaskDnd`, `day:` zones); a drop past the deadline asks once on the card (Q4). The card ⋯
// menu is the keyboard and touch alternative ("Plan today / tomorrow / Sat 18 … / Unschedule"); touch drag is
// off in v1 (Fable Q3), so a swipe always scrolls. Status lens: To do · Doing · Done for this week's work
// (`inStatusWeekScope`), Done = finished today. Cards show only what the column doesn't say (Fable Q5).
// Every write is one `planner.task.update` (or today's occurrence resolve) with an Undo toast.
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  GripVertical,
  Inbox,
  Info,
  Lock,
  MousePointer2,
  PanelRight,
  ArrowRightLeft,
  Sun,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { toast } from "sonner";
import { RollingCount } from "@/components/premium/FilterChips";
import { SegmentedTabs } from "@/components/premium/SegmentedTabs";
import type { ToneOrNeutral } from "@/design/categoryTone";
import { toneClassName } from "@/design/categoryTone";
import { prefersReducedMotion } from "@/design/motion";
import { formatMinutes } from "@/design/timeFormat";
import { cn } from "@/lib/utils";
import type { CanonicalTask } from "@shared/canonicalTask";
import { statusLaneForTaskState } from "@shared/taskBoard";
import { dayMonthLabel, weekdayDayLabel, weekdayLabel } from "@shared/taskDateLabels";
import type { TaskDropContext, TaskDropPatch } from "@shared/taskDrop";
import type { TaskOccurrenceLike } from "@shared/taskRecurrence";
import { shiftLocalDate } from "@shared/taskRecurrence";
import type { RowPill } from "@shared/taskRowPills";
import { inStatusWeekScope, localWeekDays, pagedWeekStart, weekBoardColumns, type WeekStartsOn } from "@shared/taskWeekBoard";
import { CheckButton } from "./CheckButton";
import type { TaskMutationResult } from "./TaskDetailSheet";
import type { TaskCardModel } from "./taskCardModel";
import type { TaskBoardLaneView, TaskDropZoneId, TaskLateDropRequest } from "./taskDndTypes";
import { TaskActionsMenu, type TaskRowAction } from "./TaskRow";
import { TaskRowPills } from "./TaskRowPills";
import { dayZone, TASK_DRAG_HANDLE_ATTRIBUTE, UNSCHEDULED_ZONE, useTaskDnd, type UseTaskDndResult } from "./useTaskDnd";
import "./task-week-board.css";

export type BoardLens = "week" | "status";

export type BoardCardView = {
  task: CanonicalTask;
  model: TaskCardModel;
  pills: readonly RowPill[];
};

export type BoardColumnView = {
  zone: TaskDropZoneId;
  /** "Unscheduled", "Fri 16", "To do". */
  label: string;
  date: string | null;
  isToday: boolean;
  isPast: boolean;
  cards: BoardCardView[];
  count: number;
  estimateMinutes: number;
};

const STATUS_COLUMNS = [
  { zone: "lane:todo" as const, label: "To do" },
  { zone: "lane:in_progress" as const, label: "Doing" },
  { zone: "lane:done" as const, label: "Done" },
];

function isOpen(task: { state: string }) {
  return task.state !== "completed" && task.state !== "archived";
}

/** Status lens column of a task: Waiting (blocked) work stays in To do with its amber chip (prototype). */
export function statusColumnZone(state: string): TaskDropZoneId | null {
  const lane = statusLaneForTaskState(state);
  if (!lane) return null;
  if (lane === "blocked") return "lane:todo";
  return `lane:${lane}`;
}

/** "This week", else "12 Oct – 18 Oct". */
export function weekRangeLabel(weekStart: string, offset: number) {
  if (offset === 0) return "This week";
  return `${dayMonthLabel(weekStart)} – ${dayMonthLabel(shiftLocalDate(weekStart, 6))}`;
}

/** The ⋯ menu days: today, tomorrow, then the next five weekdays by name ("Plan Sat 18"). Never a past day. */
export function planMenuDays(today: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = shiftLocalDate(today, index);
    const label = index === 0 ? "Plan today" : index === 1 ? "Plan tomorrow" : `Plan ${weekdayDayLabel(date)}`;
    return { date, label };
  });
}

/** Toast copy for a board write, or null for re-order-only writes (siblings' sortOrder). */
export function boardWriteMessage(patch: TaskDropPatch) {
  if ("scheduledLocalDate" in patch) {
    if (!patch.scheduledLocalDate) return "Moved to Unscheduled";
    const day = weekdayDayLabel(patch.scheduledLocalDate);
    return "dueLocalDate" in patch ? `Planned for ${day} · deadline moved` : `Planned for ${day}`;
  }
  if (patch.state) {
    const zone = statusColumnZone(patch.state);
    return `Moved to ${STATUS_COLUMNS.find(column => column.zone === zone)?.label ?? "lane"}`;
  }
  return null;
}

/** The patch that puts the task back the way it was before `patch`. */
export function boardUndoPatch(before: Pick<CanonicalTask, "scheduledLocalDate" | "dueLocalDate" | "state">, patch: TaskDropPatch): Record<string, unknown> {
  const undo: Record<string, unknown> = {};
  if ("scheduledLocalDate" in patch) undo.scheduledLocalDate = before.scheduledLocalDate ?? null;
  if ("dueLocalDate" in patch) undo.dueLocalDate = before.dueLocalDate ?? null;
  if ("state" in patch) undo.state = before.state;
  return undo;
}

/**
 * The card ⋯ menu, the keyboard and touch alternative to drag (Q3). Week lens: Plan today / tomorrow / the
 * next five days by name, then Unschedule; every choice is `moveTo` on that day's zone, so it runs the same
 * rules as a drop (late drops still ask once). Status lens: Move to the other columns. Then Open details.
 */
export function boardMenuActions({
  task,
  column,
  lens,
  today,
  moveTo,
  onOpen,
}: {
  task: Pick<CanonicalTask, "id" | "state" | "recurrenceRule">;
  column: Pick<BoardColumnView, "zone" | "date">;
  lens: BoardLens;
  today: string;
  moveTo: (taskId: string, zone: TaskDropZoneId) => void;
  onOpen: (task: Pick<CanonicalTask, "id">) => void;
}): TaskRowAction[] {
  const actions: TaskRowAction[] = [];
  if (isOpen(task) && lens === "week") {
    if (task.recurrenceRule) {
      actions.push({ id: "plan-recurring", label: "Plan for a day", icon: CalendarDays, disabled: true, reason: "It repeats, so its schedule sets the day.", onSelect: () => undefined });
    } else {
      for (const day of planMenuDays(today)) {
        if (column.date === day.date) continue;
        actions.push({ id: `plan-${day.date}`, label: day.label, icon: day.date === today ? Sun : CalendarCheck, onSelect: () => moveTo(task.id, dayZone(day.date)) });
      }
      if (column.zone !== UNSCHEDULED_ZONE) actions.push({ id: "unschedule", label: "Unschedule", icon: CalendarX2, onSelect: () => moveTo(task.id, UNSCHEDULED_ZONE) });
    }
  }
  if (lens === "status") {
    for (const target of STATUS_COLUMNS) {
      if (target.zone === column.zone) continue;
      actions.push({ id: `move-${target.zone}`, label: `Move to ${target.label}`, icon: ArrowRightLeft, onSelect: () => moveTo(task.id, target.zone) });
    }
  }
  actions.push({ id: "open", label: "Open details", icon: PanelRight, onSelect: () => onOpen(task) });
  return actions;
}

type BuildContext = {
  lens: BoardLens;
  today: string;
  timezone: string;
  occurrences?: readonly TaskOccurrenceLike[];
  weekStart: string;
  weekStartsOn: WeekStartsOn;
  optimisticZone?: ReadonlyMap<string, TaskDropZoneId>;
  view: (task: CanonicalTask) => BoardCardView;
};

/** Builds the rendered columns (pure, so the tests and the engine see the same lanes). */
export function buildBoardColumns(tasks: readonly CanonicalTask[], ctx: BuildContext): BoardColumnView[] {
  let columns: BoardColumnView[];
  if (ctx.lens === "week") {
    columns = weekBoardColumns(tasks, { today: ctx.today, timezone: ctx.timezone, occurrences: ctx.occurrences, weekStart: ctx.weekStart }).map(column => ({
      zone: dayZone(column.date),
      label: column.label,
      date: column.date,
      isToday: column.isToday,
      isPast: column.isPast,
      cards: column.tasks.map(ctx.view),
      count: column.count,
      estimateMinutes: column.estimateMinutes,
    }));
  } else {
    const scope = tasks.filter(task => inStatusWeekScope(task, { today: ctx.today, timezone: ctx.timezone, occurrences: ctx.occurrences, weekStartsOn: ctx.weekStartsOn }));
    columns = STATUS_COLUMNS.map(column => {
      const items = scope.filter(task => statusColumnZone(task.state) === column.zone);
      return {
        zone: column.zone,
        label: column.label,
        date: null,
        isToday: false,
        isPast: false,
        cards: items.map(ctx.view),
        count: items.length,
        estimateMinutes: items.reduce((sum, task) => sum + (Number(task.estimateMinutes) || 0), 0),
      };
    });
  }
  // A card waiting on the late-drop prompt sits in the day it was dropped on (nothing written yet).
  ctx.optimisticZone?.forEach((zone, id) => {
    const from = columns.find(column => column.cards.some(card => card.task.id === id));
    const to = columns.find(column => column.zone === zone);
    if (!from || !to || from === to) return;
    const card = from.cards.find(item => item.task.id === id)!;
    from.cards = from.cards.filter(item => item !== card);
    to.cards = [...to.cards, card];
    if (isOpen(card.task)) {
      const minutes = Number(card.task.estimateMinutes) || 0;
      from.count -= 1;
      from.estimateMinutes -= minutes;
      to.count += 1;
      to.estimateMinutes += minutes;
    }
  });
  return columns;
}

export type TaskWeekBoardProps = {
  lens: BoardLens;
  onLensChange: (lens: BoardLens) => void;
  /** Board-visible tasks (search, quick filter and facets applied), in display order. */
  tasks: readonly CanonicalTask[];
  /** Every task record, for the drop rules (prerequisites, re-order maths). */
  allTasks: readonly CanonicalTask[];
  today: string;
  timezone: string;
  weekStartsOn?: WeekStartsOn;
  occurrences?: readonly TaskOccurrenceLike[];
  dropContext: Omit<TaskDropContext, "today" | "timezone" | "occurrences" | "tasks">;
  modelFor: (task: CanonicalTask) => TaskCardModel;
  pillsFor: (task: CanonicalTask, lens: BoardLens) => readonly RowPill[];
  categoryTones?: ReadonlyMap<string, ToneOrNeutral>;
  onUpdate: (task: CanonicalTask, patch: Record<string, unknown>) => Promise<TaskMutationResult>;
  onResolveOccurrence?: (task: CanonicalTask, occurrence: { id: string; expectedVersion: number }) => Promise<unknown>;
  onOpen: (task: CanonicalTask, trigger: HTMLElement | null) => void;
  onToggle: (task: CanonicalTask, model: TaskCardModel) => void;
  onBlockedCheck: (task: CanonicalTask, model: TaskCardModel) => void;
};

export function TaskWeekBoard({
  lens,
  onLensChange,
  tasks,
  allTasks,
  today,
  timezone,
  weekStartsOn = 1,
  occurrences,
  dropContext,
  modelFor,
  pillsFor,
  categoryTones,
  onUpdate,
  onResolveOccurrence,
  onOpen,
  onToggle,
  onBlockedCheck,
}: TaskWeekBoardProps) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [reducedMotion] = useState(() => prefersReducedMotion());
  const weekStart = pagedWeekStart(today, weekOffset, weekStartsOn);
  const byId = useMemo(() => new Map(allTasks.map(task => [task.id, task])), [allTasks]);

  // Waiting (blocked) work shows in To do; the engine sees it there too, so a re-order in To do never
  // unblocks it. Writes always go out with the real record (`byId`).
  const engineTasks = useMemo(
    () => (lens === "status" ? allTasks.map(task => (task.state === "blocked" ? { ...task, state: "not_started" as const } : task)) : [...allTasks]),
    [allTasks, lens],
  );

  const writeWithUndo = useCallback(async (task: { id: string }, patch: TaskDropPatch) => {
    const before = byId.get(task.id) ?? (task as CanonicalTask);
    const result = await onUpdate(before, patch as Record<string, unknown>);
    const message = boardWriteMessage(patch);
    if (message) {
      const undo = boardUndoPatch(before, patch);
      toast.success(result.queued ? `${message} (saved on this device)` : message, {
        action: {
          label: "Undo",
          onClick: () => {
            void onUpdate((result.record as CanonicalTask | undefined) ?? before, undo).then(
              () => toast.success("Undone."),
              (caught: unknown) => toast.error(caught instanceof Error ? caught.message : "Undo could not be saved."),
            );
          },
        },
      });
    }
    return result;
  }, [byId, onUpdate]);

  const resolveOccurrence = useCallback(async (task: { id: string }, occurrence: { id: string; expectedVersion: number }) => {
    if (!onResolveOccurrence) throw new Error("Today's repeat can only be resolved from Plan here. Nothing was saved.");
    const result = await onResolveOccurrence(byId.get(task.id) ?? (task as CanonicalTask), occurrence);
    toast.success("Today's repeat is done.");
    return result;
  }, [byId, onResolveOccurrence]);

  // The engine's optimistic patches feed the columns, and the columns are the engine's lanes. The engine only
  // reads `lanes` when an event arrives, so one stable array is refilled after the columns are built.
  const lanesRef = useRef<TaskBoardLaneView[]>([]);
  const lanes = lanesRef.current;
  const controller = useTaskDnd({
    lens,
    tasks: engineTasks,
    lanes,
    ctx: { ...dropContext, today, timezone, occurrences, tasks: allTasks },
    onUpdate: writeWithUndo,
    onResolveOccurrence: resolveOccurrence,
    reducedMotion,
    touch: false,
  });

  const patched = useMemo(() => {
    const patches = controller.optimisticPatches;
    if (!patches.size) return tasks;
    return tasks.map(task => (patches.has(task.id) ? ({ ...task, ...patches.get(task.id) } as CanonicalTask) : task));
  }, [controller.optimisticPatches, tasks]);

  const columns = useMemo(
    () => buildBoardColumns(patched, {
      lens,
      today,
      timezone,
      occurrences,
      weekStart,
      weekStartsOn,
      optimisticZone: controller.optimisticZone,
      view: task => ({ task, model: { ...modelFor(task), pending: modelFor(task).pending || controller.pendingIds.has(task.id) }, pills: pillsFor(task, lens) }),
    }),
    [controller.optimisticZone, controller.pendingIds, lens, modelFor, occurrences, patched, pillsFor, timezone, today, weekStart, weekStartsOn],
  );

  lanes.splice(0, lanes.length, ...columns.map(column => ({ zone: column.zone, label: column.label, count: column.count, models: column.cards.map(card => card.model), hiddenCount: 0, showAll: true })));

  const activeId = controller.preview?.activeId ?? null;
  const activeCard = activeId ? columns.flatMap(column => column.cards).find(card => card.task.id === activeId) ?? null : null;
  const weekDays = localWeekDays(weekStart);
  const template = lens === "week"
    ? columns.map(column => {
      if (column.date === null) return "minmax(150px, 1.1fr)";
      return column.isPast && !column.cards.length ? "minmax(88px, .55fr)" : "minmax(128px, 1fr)";
    }).join(" ")
    : undefined;

  const menuFor = (card: BoardCardView, column: BoardColumnView) => boardMenuActions({
    task: card.task,
    column,
    lens,
    today,
    moveTo: controller.moveTo,
    onOpen: () => onOpen(card.task, document.querySelector<HTMLElement>(`[data-task-record-id="${CSS.escape(card.task.id)}"] .tk-wcard-title`)),
  });

  return (
    <section className="tk-board" aria-label="Task board" data-lens={lens}>
      <div className="tk-board-bar">
        <SegmentedTabs<BoardLens>
          label="Board lens"
          value={lens}
          onValueChange={onLensChange}
          items={[
            { value: "week", label: <><CalendarRange size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />Week</> },
            { value: "status", label: <><Columns3 size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />Status</> },
          ]}
          className="tk-board-lens"
        />
        {lens === "week" ? (
          <div className="tk-board-pager" role="group" aria-label="Shown week">
            <button type="button" className="tk-icon-btn pc-focusable" aria-label="Previous week" onClick={() => setWeekOffset(offset => offset - 1)}>
              <ChevronLeft size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            <span className="tk-board-week" aria-live="polite">{weekRangeLabel(weekStart, weekOffset)}</span>
            <button type="button" className="tk-icon-btn pc-focusable" aria-label="Next week" onClick={() => setWeekOffset(offset => offset + 1)}>
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
            {weekOffset !== 0 ? (
              <button type="button" className="tk-btn is-ghost tk-board-today pc-focusable pc-pop" onClick={() => setWeekOffset(0)}>
                <Sun size={14} strokeWidth={2} aria-hidden="true" />Today
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="tk-board-note">
        {lens === "week" ? (
          <>
            <MousePointer2 size={14} strokeWidth={2} aria-hidden="true" />
            <span className="tk-board-note-wide">Drag a card onto a day to plan it. Unscheduled clears the plan day. Every drop can be undone.</span>
            <span className="tk-board-note-narrow">Tap ⋯ on a card to plan it for a day.</span>
          </>
        ) : (
          <>
            <Info size={14} strokeWidth={2} aria-hidden="true" />
            <span>This week's work by status. Waiting tasks keep an amber chip. Done shows today only; older work moves to Archive.</span>
          </>
        )}
      </p>
      <DndContext {...controller.contextProps}>
        <div className="tk-board-scroll">
          <div
            className={cn("tk-board-grid", lens === "status" && "is-status")}
            style={template ? ({ ["--tk-week-cols" as string]: template } as CSSProperties) : undefined}
            data-week-start={lens === "week" ? weekDays[0] : undefined}
          >
            {columns.map(column => (
              <BoardColumn key={column.zone} column={column} controller={controller} lens={lens}>
                {column.cards.map(card => (
                  <DraggableCard
                    key={card.task.id}
                    card={card}
                    lens={lens}
                    categoryTones={categoryTones}
                    controller={controller}
                    lateDrop={controller.lateDrop?.taskId === card.task.id ? controller.lateDrop : null}
                    actions={menuFor(card, column)}
                    onOpen={onOpen}
                    onToggle={onToggle}
                    onBlockedCheck={onBlockedCheck}
                  />
                ))}
              </BoardColumn>
            ))}
          </div>
        </div>
        <DragOverlay dropAnimation={reducedMotion ? null : { duration: 220, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
          {activeCard ? <CardFace card={activeCard} lens={lens} categoryTones={categoryTones} lifted /> : null}
        </DragOverlay>
      </DndContext>
      <p className="pc-sr-only" role="status" aria-live="polite">{controller.announcement?.text ?? ""}</p>
    </section>
  );
}

function ColumnHeading({ column, lens }: { column: BoardColumnView; lens: BoardLens }) {
  const time = column.estimateMinutes ? formatMinutes(column.estimateMinutes) : null;
  return (
    <header className="tk-col-head">
      <h3 className="tk-col-title">
        {lens === "status" ? (
          <span>{column.label}</span>
        ) : column.date === null ? (
          <><Inbox size={15} strokeWidth={2} aria-hidden="true" /><span>Unscheduled</span></>
        ) : (
          <>
            <span className="tk-col-dow">{weekdayLabel(column.date)}</span>
            <span className="tk-col-day">{Number(column.date.slice(8))}</span>
            {column.isToday ? <span className="tk-col-today">Today</span> : null}
          </>
        )}
      </h3>
      <p className="tk-col-facts">
        <RollingCount value={column.count} />
        <span className="pc-sr-only"> open</span>
        {time ? <><span aria-hidden="true"> · </span><span>{time}</span></> : null}
      </p>
    </header>
  );
}

function BoardColumn({ column, controller, lens, children }: { column: BoardColumnView; controller: UseTaskDndResult; lens: BoardLens; children: ReactNode }) {
  const { setNodeRef } = useDroppable({ id: column.zone });
  const preview = controller.preview;
  const over = preview?.overZone === column.zone && preview.activeId !== null;
  const refusal = over ? preview?.refusal ?? null : null;
  const late = over && !refusal ? preview?.lateWarning ?? null : null;
  const hint = lens === "status" ? "Drop to move" : column.date === null ? "Drop to unschedule" : `Plan for ${column.label}`;
  return (
    <section
      ref={setNodeRef}
      className={cn(
        "tk-col",
        column.date === null && lens === "week" && "is-unscheduled",
        column.isToday && "is-today",
        column.isPast && "is-past",
        !column.cards.length && "is-empty",
        over && "is-over",
        refusal && "is-refused",
      )}
      data-zone={column.zone}
      aria-label={`${column.label}, ${column.count} open`}
    >
      <ColumnHeading column={column} lens={lens} />
      <ul className="tk-col-cards" role="list">
        {children}
      </ul>
      {refusal ? (
        <p className="tk-col-hint is-refused" role="status"><Lock size={13} strokeWidth={2} aria-hidden="true" />{refusal.reason}</p>
      ) : late ? (
        <p className="tk-col-hint is-late" role="status"><TriangleAlert size={13} strokeWidth={2} aria-hidden="true" />{late}</p>
      ) : (
        <p className="tk-col-hint" aria-hidden="true">{hint}</p>
      )}
    </section>
  );
}

function CardFace({
  card,
  lens,
  categoryTones,
  lifted = false,
  check,
  title,
  tools,
  footer,
}: {
  card: BoardCardView;
  lens: BoardLens;
  categoryTones?: ReadonlyMap<string, ToneOrNeutral>;
  lifted?: boolean;
  check?: ReactNode;
  title?: ReactNode;
  tools?: ReactNode;
  footer?: ReactNode;
}) {
  const { model, pills } = card;
  const estimate = card.task.estimateMinutes && card.task.estimateMinutes > 0 ? card.task.estimateMinutes : null;
  return (
    <div className={cn("tk-wcard-face", lifted && "is-lifted", toneClassName(model.tone), model.isComplete && "is-done")} data-lens={lens}>
      <div className="tk-wcard-top">
        {check ?? <span className={cn("tk-wcard-dot", model.isComplete && "is-done")} aria-hidden="true" />}
        {title ?? <span className="tk-wcard-title">{model.title}</span>}
        {tools}
      </div>
      {pills.length || estimate || model.recurring ? (
        <div className="tk-wcard-meta">
          <TaskRowPills pills={pills} repeat={model.recurring?.cadence} categoryTones={categoryTones} />
          {estimate ? (
            <span className="tk-wcard-est"><span aria-hidden="true">{formatMinutes(estimate)}</span><span className="pc-sr-only">{`Estimate ${formatMinutes(estimate)}`}</span></span>
          ) : null}
        </div>
      ) : null}
      {footer}
    </div>
  );
}

export function LatePrompt({ request }: { request: TaskLateDropRequest }) {
  const first = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    first.current?.focus({ preventScroll: true });
  }, [request.taskId, request.day]);
  return (
    <div className="tk-late" role="alertdialog" aria-label={request.prompt} aria-describedby={`tk-late-${request.taskId}`}>
      <p className="tk-late-q" id={`tk-late-${request.taskId}`}>
        <TriangleAlert size={14} strokeWidth={2.25} aria-hidden="true" />
        <span>{request.prompt}</span>
      </p>
      <div className="tk-late-actions">
        <button ref={first} type="button" className="tk-late-btn is-go pc-focusable" onClick={() => request.planAnyway()}>Plan anyway</button>
        <button type="button" className="tk-late-btn pc-focusable" onClick={() => request.moveDeadline()}>Move deadline</button>
        <button type="button" className="tk-late-btn pc-focusable" onClick={() => request.cancel()}>Cancel</button>
      </div>
    </div>
  );
}

function DraggableCard({
  card,
  lens,
  categoryTones,
  controller,
  lateDrop,
  actions,
  onOpen,
  onToggle,
  onBlockedCheck,
}: {
  card: BoardCardView;
  lens: BoardLens;
  categoryTones?: ReadonlyMap<string, ToneOrNeutral>;
  controller: UseTaskDndResult;
  lateDrop: TaskLateDropRequest | null;
  actions: TaskRowAction[];
  onOpen: TaskWeekBoardProps["onOpen"];
  onToggle: TaskWeekBoardProps["onToggle"];
  onBlockedCheck: TaskWeekBoardProps["onBlockedCheck"];
}) {
  const { task, model } = card;
  const disabled = model.pending || Boolean(lateDrop);
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: task.id, disabled });
  const { setNodeRef: setDropRef } = useDroppable({ id: task.id });
  const setRef = useCallback((node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  }, [setDragRef, setDropRef]);
  // Pointer drag starts anywhere on the card (the title included); the keyboard drag lives on the grip, so
  // Enter on the title still opens the task.
  const { onKeyDown, ...pointerListeners } = (listeners ?? {}) as Record<string, (event: unknown) => void>;
  const guarded = model.completionBlock?.reason ?? null;
  const error = controller.inlineErrors.get(task.id);
  const handle = { [TASK_DRAG_HANDLE_ATTRIBUTE]: "" };
  return (
    <li
      ref={setRef}
      className={cn("tk-wcard", isDragging && "is-ghost", model.pending && "is-pending", lateDrop && "is-asking")}
      data-task-record-id={task.id}
      data-task-version={model.version}
      aria-busy={model.pending || undefined}
      {...pointerListeners}
    >
      <CardFace
        card={card}
        lens={lens}
        categoryTones={categoryTones}
        check={(
          <CheckButton
            title={model.title}
            checked={model.check.checked}
            tone={model.tone}
            blockedReason={guarded}
            inert={model.check.action.kind === "none" && !guarded}
            pending={model.pending}
            onToggle={() => onToggle(task, model)}
            onBlockedPress={() => onBlockedCheck(task, model)}
            className="tk-wcard-check"
          />
        )}
        title={(
          <button type="button" className="tk-wcard-title pc-focusable" title={model.title} {...handle} onClick={event => onOpen(task, event.currentTarget)}>
            {model.title}
          </button>
        )}
        tools={(
          <span className="tk-wcard-tools">
            <button
              type="button"
              className="tk-wcard-grip pc-focusable"
              {...handle}
              {...attributes}
              aria-label={`Drag ${model.title}`}
              onKeyDown={onKeyDown as never}
            >
              <GripVertical size={15} strokeWidth={2} aria-hidden="true" />
            </button>
            <TaskActionsMenu
              title={model.title}
              actions={actions}
              label={lens === "week" ? `Plan ${model.title} for a day` : `Move ${model.title}`}
              className="tk-wcard-more"
            />
          </span>
        )}
        footer={(
          <>
            {lateDrop ? <LatePrompt request={lateDrop} /> : null}
            {error ? <p className="tk-wcard-error" role="alert">{error}</p> : null}
          </>
        )}
      />
    </li>
  );
}
