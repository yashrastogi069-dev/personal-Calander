import { cn } from "@/lib/utils";
import { displayLocalDate, shiftLocalDate, type WorkspaceScope } from "@/lib/workspace";
import { trpc } from "@/lib/trpc";
import { isTaskCalendarProjection, roundedTaskReservationMinutes, taskReservationGridMinutes, taskReservationLocalParts } from "@shared/taskReservation";
import { zonedDateTimeToUtc } from "@shared/planningAvailability";
import { nextFreeReservationMinute, plannerShortcutCommand } from "@shared/plannerKeyboard";
import { CalendarDays, Check, ChevronLeft, ChevronRight, GripVertical, Inbox, LockKeyhole, MoveRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import "./calendar-execution.css";

type CalendarExecutionSnapshot = {
  workspace: { workdayStartsAt: string; workdayEndsAt: string };
  tasks: any[];
  categories: any[];
  externalEvents: any[];
  planningAvailabilityExceptions: any[];
  icsOverlay?: { status: "unconfigured" | "ready" | "invalid"; label: string; message: string };
};

type GridSlot = { minute: number; label: string };

function minutesForTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return Math.max(0, Math.min(1440, hours * 60 + minutes));
}

function timeLabel(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "That reservation could not be saved. The calendar was left unchanged; refresh and try again.";
}

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.matches("input, textarea, select, [contenteditable=true]") || Boolean(target.closest("[role=dialog]"));
}

export function CalendarExecutionWorkspace({ scope, snapshot, today, onOpenTasks, onComplete }: { scope: WorkspaceScope; snapshot: CalendarExecutionSnapshot; today: string; onOpenTasks: () => void; onComplete: (task: any) => Promise<string | null> }) {
  const utils = trpc.useUtils();
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSlotMinute, setSelectedSlotMinute] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const reserveTask = trpc.planner.task.reserve.useMutation();

  const exception = snapshot.planningAvailabilityExceptions.find(item => item.localDate === selectedDate);
  const workStart = exception?.isUnavailable ? 0 : minutesForTime(exception?.workdayStartsAt ?? snapshot.workspace.workdayStartsAt);
  const workEnd = exception?.isUnavailable ? 0 : minutesForTime(exception?.workdayEndsAt ?? snapshot.workspace.workdayEndsAt);
  const slots = useMemo<GridSlot[]>(() => {
    const result: GridSlot[] = [];
    for (let minute = workStart; minute < workEnd; minute += taskReservationGridMinutes) result.push({ minute, label: timeLabel(minute) });
    return result;
  }, [workEnd, workStart]);
  useEffect(() => { setSelectedSlotMinute(slots[0]?.minute ?? null); }, [selectedDate, slots]);

  const activeTasks = snapshot.tasks.filter(task => task.state !== "completed" && task.state !== "archived");
  const selectedTask = activeTasks.find(task => task.id === selectedTaskId) ?? null;
  const inboxTasks = activeTasks.filter(task => !task.plannedStartAt || !task.plannedEndAt).slice(0, 24);
  const categoryColors = useMemo(() => new Map(snapshot.categories.map(category => [category.id, category.color])), [snapshot.categories]);
  const timedTasks = activeTasks.filter(task => task.scheduledLocalDate === selectedDate && isTaskCalendarProjection(task));
  const slotIndexFor = (value: Date | string) => {
    const minute = taskReservationLocalParts(new Date(value), scope.timezone).minuteOfDay;
    return Math.floor((minute - workStart) / taskReservationGridMinutes);
  };

  const reserveAt = async (task: any, minute: number, durationOverride?: number) => {
    if (!task) {
      setFeedback("Choose a task from the inbox first, then place it on a 15-minute calendar slot.");
      return;
    }
    if (!slots.length) {
      setFeedback("This day is marked unavailable. Choose another day or update its availability before reserving time.");
      return;
    }
    const durationMinutes = durationOverride ?? roundedTaskReservationMinutes(task.estimateMinutes);
    if (minute + durationMinutes > workEnd) {
      setFeedback(`This ${durationMinutes}-minute reservation does not fit before ${timeLabel(workEnd)}. Choose an earlier slot, resize it, or update availability.`);
      return;
    }
    const plannedStartAt = zonedDateTimeToUtc(selectedDate, minute, scope.timezone);
    const plannedEndAt = zonedDateTimeToUtc(selectedDate, minute + durationMinutes, scope.timezone);
    setFeedback(null);
    try {
      await reserveTask.mutateAsync({ ...scope, id: task.id, expectedVersion: task.version, localDate: selectedDate, plannedStartAt, plannedEndAt });
      setSelectedTaskId(task.id);
      await Promise.all([utils.planner.workspace.snapshot.invalidate(), utils.planner.dashboard.invalidate()]);
      const defaultDuration = !task.estimateMinutes;
      toast.success(`${task.title} reserved at ${timeLabel(minute)}${defaultDuration ? " for a visible 30-minute default" : ""}.`);
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  };

  const completeTask = async (task: any) => {
    const message = await onComplete(task);
    if (message) setFeedback(message);
  };

  const externalBusy = snapshot.externalEvents.flatMap(event => {
    const start = taskReservationLocalParts(new Date(event.startsAt), scope.timezone);
    const end = taskReservationLocalParts(new Date(event.endsAt), scope.timezone);
    if (start.localDate > selectedDate || end.localDate < selectedDate) return [];
    const startMinute = start.localDate === selectedDate ? Math.max(workStart, start.minuteOfDay) : workStart;
    const endMinute = end.localDate === selectedDate ? Math.min(workEnd, end.minuteOfDay) : workEnd;
    if (endMinute <= startMinute) return [];
    return [{ id: event.id, startMinute, span: Math.max(1, Math.ceil((endMinute - startMinute) / taskReservationGridMinutes)) }];
  });
  const occupiedIntervals = useMemo(() => [
    ...timedTasks.filter(task => task.id !== selectedTask?.id).map(task => ({ startMinute: taskReservationLocalParts(new Date(task.plannedStartAt), scope.timezone).minuteOfDay, endMinute: taskReservationLocalParts(new Date(task.plannedEndAt), scope.timezone).minuteOfDay })),
    ...externalBusy.map(event => ({ startMinute: event.startMinute, endMinute: event.startMinute + event.span * taskReservationGridMinutes })),
  ], [externalBusy, scope.timezone, selectedTask?.id, timedTasks]);
  const reserveNextFreeSlot = () => {
    if (!selectedTask) {
      setFeedback("Select an inbox task first. Enter then reserves it at the next free 15-minute slot from the current grid selection.");
      return;
    }
    const durationMinutes = roundedTaskReservationMinutes(selectedTask.estimateMinutes);
    const startMinute = nextFreeReservationMinute({ slotMinutes: slots.map(slot => slot.minute), selectedMinute: selectedSlotMinute ?? workStart, durationMinutes, workEnd, busy: occupiedIntervals });
    if (startMinute === null) {
      setFeedback(`No ${durationMinutes}-minute opening remains from ${timeLabel(selectedSlotMinute ?? workStart)}. Choose another day, an earlier grid slot, or resize the task.`);
      return;
    }
    void reserveAt(selectedTask, startMinute);
  };
  const moveGridSelection = (currentMinute: number, offset: number) => {
    const currentIndex = slots.findIndex(slot => slot.minute === currentMinute);
    const next = slots[Math.max(0, Math.min(slots.length - 1, currentIndex + offset))];
    if (!next) return;
    setSelectedSlotMinute(next.minute);
    window.setTimeout(() => document.querySelector<HTMLButtonElement>(`[data-calendar-slot="${next.minute}"]`)?.focus(), 0);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = plannerShortcutCommand({ key: event.key, ctrlKey: event.ctrlKey, metaKey: event.metaKey, altKey: event.altKey, shiftKey: event.shiftKey, isComposing: event.isComposing, targetIsEditable: isEditableShortcutTarget(event.target), dialogOpen: Boolean(document.querySelector("[role=dialog]")) });
      const withinGrid = event.target instanceof HTMLElement && Boolean(event.target.closest(".calendar-day-grid"));
      if (!event.defaultPrevented && withinGrid && !event.isComposing && selectedSlotMinute !== null) {
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          moveGridSelection(selectedSlotMinute, -1);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          moveGridSelection(selectedSlotMinute, 1);
          return;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          reserveNextFreeSlot();
          return;
        }
      }
      if (command === "new-task") {
        event.preventDefault();
        window.location.assign("/?surface=tasks&create=task");
      } else if (command === "today") {
        event.preventDefault();
        setSelectedDate(today);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedSlotMinute, slots, today]);

  return <section className="calendar-execution" aria-labelledby="calendar-execution-heading">
    <header className="calendar-execution-header">
      <div><span className="eyebrow">Task execution calendar</span><h2 id="calendar-execution-heading">Reserve real focus time</h2><p>Tasks own their calendar blocks. Drag or select an inbox task, then place it deliberately; completing the task removes its block.</p></div>
      <div className="calendar-execution-day-controls"><button type="button" aria-label="Previous calendar day" onClick={() => setSelectedDate(date => shiftLocalDate(date, -1))}><ChevronLeft size={17} /></button><strong>{displayLocalDate(selectedDate, scope.timezone, { weekday: "short", month: "short", day: "numeric" })}</strong><button type="button" aria-label="Next calendar day" onClick={() => setSelectedDate(date => shiftLocalDate(date, 1))}><ChevronRight size={17} /></button></div>
    </header>
    <div className="calendar-execution-note"><CalendarDays size={16} /><span><b>Manual reservation</b> changes only this task’s plan and time block. Flexible proposals remain review-first.</span></div>
    <div className="calendar-keyboard-guide" aria-label="Calendar keyboard shortcuts"><span>Keyboard</span><p><kbd>n</kbd> new task <kbd>t</kbd> today <kbd>↑</kbd><kbd>↓</kbd> or <kbd>←</kbd><kbd>→</kbd> move grid selection <kbd>Enter</kbd> reserve the selected inbox task in the next free slot.</p></div>
    <div className="calendar-execution-layout">
      <aside className="calendar-inbox" aria-labelledby="calendar-inbox-heading"><div className="calendar-inbox-heading"><div><span className="eyebrow">Inbox</span><h3 id="calendar-inbox-heading">Unreserved tasks</h3></div><span>{inboxTasks.length}</span></div><p className="calendar-inbox-help">Drag a task to a slot, or select it and tap a slot. A task with no estimate uses a visible 30-minute default without changing its estimate.</p><div className="calendar-inbox-list">{inboxTasks.length ? inboxTasks.map(task => <button key={task.id} type="button" draggable className={cn("calendar-inbox-task", selectedTaskId === task.id && "is-selected")} aria-pressed={selectedTaskId === task.id} onClick={() => { setSelectedTaskId(task.id); setFeedback(null); }} onDragStart={event => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-personal-calendar-task", task.id); event.dataTransfer.setData("text/plain", task.id); }}><GripVertical size={15} aria-hidden="true" /><span className="calendar-task-dot" style={{ backgroundColor: categoryColors.get(task.categoryId) ?? "#C6F06A" }} /><span><b>{task.title}</b><small>{task.estimateMinutes ? `${roundedTaskReservationMinutes(task.estimateMinutes)} min focus` : "30 min default · effort unknown"}</small></span><MoveRight size={15} aria-hidden="true" /></button>) : <div className="calendar-inbox-empty"><Inbox size={18} /><p>Every active task already has a time reservation.</p><button type="button" onClick={onOpenTasks}>Open Tasks</button></div>}</div>
      </aside>
      <section className="calendar-day-grid-wrap" aria-label={`Task execution grid for ${selectedDate}`}>
        <div className="calendar-day-grid-status"><span>{slots.length ? `${timeLabel(workStart)}–${timeLabel(workEnd)} · ${taskReservationGridMinutes}-minute slots` : "Unavailable day"}</span>{snapshot.externalEvents.length ? <span><LockKeyhole size={13} /> Read-only busy context</span> : <span title={snapshot.icsOverlay?.message}>{snapshot.icsOverlay?.status === "ready" ? "Secure ICS source ready · no events imported" : snapshot.icsOverlay?.status === "invalid" ? "Secure ICS configuration needs attention" : "External overlay not configured"}</span>}</div>
        {slots.length ? <div className="calendar-day-grid" role="grid" aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter" aria-label={`Calendar time grid for ${displayLocalDate(selectedDate, scope.timezone, { month: "long", day: "numeric" })}. Use arrow keys to choose a time. Enter reserves the selected inbox task at the next free slot.`} style={{ gridTemplateRows: `repeat(${slots.length}, 30px)` }}>
          {slots.map((slot, index) => <button key={slot.minute} data-calendar-slot={slot.minute} type="button" role="gridcell" tabIndex={selectedSlotMinute === slot.minute ? 0 : -1} className={cn("calendar-grid-slot", selectedTask && "is-ready", selectedSlotMinute === slot.minute && "is-keyboard-selected")} aria-label={`${slot.label}. ${selectedTask ? `Reserve ${selectedTask.title} here.` : "Select an inbox task to reserve time."}`} onFocus={() => setSelectedSlotMinute(slot.minute)} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (event.key === "ArrowUp" || event.key === "ArrowLeft") { event.preventDefault(); moveGridSelection(slot.minute, -1); } else if (event.key === "ArrowDown" || event.key === "ArrowRight") { event.preventDefault(); moveGridSelection(slot.minute, 1); } else if (event.key === "Enter") { event.preventDefault(); reserveNextFreeSlot(); } }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={event => { event.preventDefault(); const taskId = event.dataTransfer.getData("application/x-personal-calendar-task") || event.dataTransfer.getData("text/plain"); const movedDuration = Number(event.dataTransfer.getData("application/x-personal-calendar-duration")); const task = activeTasks.find(item => item.id === taskId); void reserveAt(task, slot.minute, Number.isFinite(movedDuration) && movedDuration > 0 ? movedDuration : undefined); }} onClick={() => { setSelectedSlotMinute(slot.minute); void reserveAt(selectedTask, slot.minute); }}>{slot.minute % 60 === 0 ? <time>{slot.label}</time> : null}{index === 0 ? <span className="calendar-grid-hint">Drop or place selected task</span> : null}</button>)}
          {externalBusy.map(event => <div key={`busy-${event.id}`} className="calendar-busy-overlay" style={{ gridRow: `${slotIndexFor(zonedDateTimeToUtc(selectedDate, event.startMinute, scope.timezone)) + 1} / span ${event.span}` }} aria-label="Read-only busy calendar time" title="Read-only busy calendar time" />)}
          {timedTasks.map(task => {
            const duration = Math.max(taskReservationGridMinutes, Math.round((new Date(task.plannedEndAt).getTime() - new Date(task.plannedStartAt).getTime()) / 60_000));
            const roundedDuration = roundedTaskReservationMinutes(duration);
            const startIndex = slotIndexFor(task.plannedStartAt);
            if (startIndex < 0 || startIndex >= slots.length) return null;
            return <article key={task.id} className="calendar-task-block" draggable style={{ gridRow: `${startIndex + 1} / span ${Math.max(1, Math.ceil(roundedDuration / taskReservationGridMinutes))}`, borderColor: categoryColors.get(task.categoryId) ?? "#C6F06A" }} onDragStart={event => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-personal-calendar-task", task.id); event.dataTransfer.setData("text/plain", task.id); event.dataTransfer.setData("application/x-personal-calendar-duration", String(roundedDuration)); }}><div><span className="calendar-task-dot" style={{ backgroundColor: categoryColors.get(task.categoryId) ?? "#C6F06A" }} /><b>{task.title}</b></div><span>{timeLabel(taskReservationLocalParts(new Date(task.plannedStartAt), scope.timezone).minuteOfDay)} · {roundedDuration} min</span><button type="button" className="calendar-block-complete" onClick={() => void completeTask(task)} aria-label={`Complete ${task.title}`}><Check size={14} /> Complete</button><div className="calendar-block-resize"><button type="button" onClick={() => void reserveAt(task, taskReservationLocalParts(new Date(task.plannedStartAt), scope.timezone).minuteOfDay, roundedDuration - taskReservationGridMinutes)} disabled={roundedDuration <= taskReservationGridMinutes} aria-label={`Shorten ${task.title} by 15 minutes`}>−15</button><button type="button" onClick={() => void reserveAt(task, taskReservationLocalParts(new Date(task.plannedStartAt), scope.timezone).minuteOfDay, roundedDuration + taskReservationGridMinutes)} aria-label={`Extend ${task.title} by 15 minutes`}>+15</button></div></article>;
          })}
        </div> : <div className="calendar-grid-unavailable"><h3>This planning day is unavailable</h3><p>No reservation was created. Select another day or update availability in Plan before timeboxing work.</p></div>}
      </section>
    </div>
    {feedback ? <div className="calendar-execution-feedback" role="alert"><span>{feedback}</span><button type="button" onClick={() => setFeedback(null)}>Dismiss</button></div> : null}
  </section>;
}
