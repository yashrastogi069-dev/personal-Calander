import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getReminderDevicePresentation } from "@/lib/reminderDevicePresentation";
import { capturesForWorkspace, createOfflineTaskCapture, isRetryableCaptureError, queueOfflineTaskCapture, removeOfflineTaskCapture } from "@/lib/offlineTaskCapture";
import { displayLocalDate, getWorkspaceScope, localDateInTimezone, shiftLocalDate, type WorkspaceScope } from "@/lib/workspace";
import { trpc } from "@/lib/trpc";
import { FocusWorkspace } from "@/features/focus/FocusWorkspace";
import { NaturalLanguageCaptureWorkspace } from "@/features/capture/NaturalLanguageCaptureWorkspace";
import { WorkspaceSearchWorkspace } from "@/features/search/WorkspaceSearchWorkspace";
import { PlanningInsightsWorkspace } from "@/features/insights/PlanningInsightsWorkspace";
import { CalendarIntegrationWorkspace } from "@/features/integrations/CalendarIntegrationWorkspace";
import { ProjectExecutionWorkspace } from "@/features/projects/ProjectExecutionWorkspace";
import { HabitDisciplineWorkspace } from "@/features/habits/HabitDisciplineWorkspace";
import { PlanWorkspace } from "@/features/planning/PlanWorkspace";
import { isHabitScheduledOnLocalDate } from "@shared/habitSchedule";
import { completedLanePreviewLimit, laneForTaskState, stateForTaskLane, taskBoardLanes, type TaskBoardLaneId, visibleTasksForLane } from "@shared/taskBoard";
import { searchWithTaskBoardView, taskBoardViewFromSearch, type TaskBoardFilter } from "@shared/taskBoardUrl";
import { localDateForReservation, plannerObjectDefinitions, taskSchedulingLanguage, validateTimeReservation } from "@shared/planningLanguage";
import { deadlineRiskForTask, deadlineRiskLabel } from "@shared/planningForecast";
import { taskEditorSourceKey } from "@shared/taskEditor";
import { todayEntryStage } from "@shared/plannerEntryFlow";
import {
  mobileMorePlannerDestinations,
  mobilePlannerDestinations,
  mobilePrimaryPlannerDestinations,
  type MobilePlannerDestination,
} from "@shared/mobileNavigation";
import {
  ArrowDownUp,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Command,
  Flag,
  Goal,
  GripVertical,
  Grid2X2,
  Inbox,
  ListFilter,
  ListChecks,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Target,
  TimerReset,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";

type Surface = MobilePlannerDestination;
type ComposerKind = "task" | "goal" | "project" | "habit";
type CalendarMode = "Day" | "Week" | "Month" | "Quarter" | "Year";

const navItems: { id: Surface; label: string; icon: typeof Grid2X2 }[] = [
  { id: "today", label: "Today", icon: Grid2X2 },
  { id: "capture", label: "Capture", icon: Plus },
  { id: "search", label: "Search", icon: Search },
  { id: "plan", label: "Plan", icon: ListChecks },
  { id: "tasks", label: "Tasks", icon: Inbox },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "goals", label: "Goals", icon: Target },
  { id: "projects", label: "Projects", icon: Flag },
  { id: "habits", label: "Habits", icon: TimerReset },
  { id: "focus", label: "Focus", icon: Command },
  { id: "connections", label: "Connections", icon: CalendarDays },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "review", label: "Review", icon: Sparkles },
];

const offlineCaptureChangedEvent = "personal-calander:offline-capture-queue-changed";

function announceOfflineCaptureChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(offlineCaptureChangedEvent));
}

const priorityMeta = {
  none: { label: "No priority", className: "text-stone-400" },
  low: { label: "Low", className: "text-sky-300" },
  medium: { label: "Medium", className: "text-amber-300" },
  high: { label: "High", className: "text-orange-300" },
  critical: { label: "Critical", className: "text-rose-300" },
} as const;

const priorityOrder = ["none", "low", "medium", "high", "critical"] as const;

function isoRange(today: string) {
  return { start: shiftLocalDate(today, -27), end: shiftLocalDate(today, 28) };
}

function shortTime(date: Date | null) {
  if (!date) return null;
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(date));
}

function dateTimeLocalValue(date: Date | null | undefined) {
  if (!date) return "";
  const value = new Date(date);
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function EmptyState({ title, detail, action, actionLabel = "Create" }: { title: string; detail: string; action?: () => void; actionLabel?: string }) {
  const progressiveDetail = title === "Begin with one honest commitment" ? "Start with one task. Capacity, deadline review, and calendar time become useful as you plan it." : title === "Projects make goals executable" ? "Create a finite project. Then use Break down to add up to five reviewed linked tasks." : title === "Build a rhythm, not a streak" ? "Repeated behavior stays in the dedicated Habit tracker, not in task time blocks." : detail;
  const content = <><span className="empty-state-mark" aria-hidden="true"><Plus size={18} strokeWidth={1.7} /></span><span><span className="empty-state-title">{title}</span><span className="empty-state-copy">{progressiveDetail}</span></span>{action ? <span className="empty-state-action">{actionLabel}</span> : null}</>;
  return action ? <button type="button" className="empty-state empty-state-trigger" onClick={action} aria-label={`${actionLabel}: ${title}`}>{content}</button> : <div className="empty-state">{content}</div>;
}

function LoadingBoard() {
  return (
    <div className="planner-loading" aria-busy="true" aria-label="Loading planning workspace">
      <div className="loading-rail" />
      <main className="loading-main"><div className="loading-top" /><div className="loading-columns"><div /><div /></div></main>
    </div>
  );
}

function TaskCheck({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return <button className={cn("task-check", checked && "is-checked")} onClick={onClick} aria-label={`${checked ? "Reopen" : "Complete"} ${label}`}><Check size={12} strokeWidth={3} /></button>;
}

function TaskRow({ task, categoryColor, parentTitle, childCount = 0, onToggle, onSchedule, onQuickReschedule }: { task: any; categoryColor?: string; parentTitle?: string; childCount?: number; onToggle: (task: any) => void; onSchedule?: (task: any, date: string) => void; onQuickReschedule?: (task: any, amount: number) => void }) {
  const completed = task.state === "completed";
  const priority = priorityMeta[task.priority as keyof typeof priorityMeta] ?? priorityMeta.none;
  const [editorOpen, setEditorOpen] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [dueLocalDate, setDueLocalDate] = useState(task.dueLocalDate ?? "");
  const [scheduledLocalDate, setScheduledLocalDate] = useState(task.scheduledLocalDate ?? "");
  const [estimateMinutes, setEstimateMinutes] = useState(task.estimateMinutes?.toString() ?? "");
  const [scheduleMode, setScheduleMode] = useState(task.scheduleMode ?? "manual");
  const [reservedStart, setReservedStart] = useState(dateTimeLocalValue(task.plannedStartAt));
  const [reservedEnd, setReservedEnd] = useState(dateTimeLocalValue(task.plannedEndAt));
  const [formError, setFormError] = useState<string | null>(null);
  const [state, setState] = useState(task.state);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const scope = useMemo(() => getWorkspaceScope(), []);
  const deadlineRisk = deadlineRiskForTask(task, localDateInTimezone(scope.timezone));
  const utils = trpc.useUtils();
  const saveTask = trpc.planner.task.update.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const createSubtask = trpc.planner.task.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });

  const editorSourceKey = taskEditorSourceKey(task);
  useEffect(() => { const rule = task.recurrenceRule as Record<string, unknown> | null; const frequency = rule?.frequency; setTitle(task.title); setDueLocalDate(task.dueLocalDate ?? ""); setScheduledLocalDate(task.scheduledLocalDate ?? ""); setEstimateMinutes(task.estimateMinutes?.toString() ?? ""); setScheduleMode(task.scheduleMode === "flexible" || task.scheduleMode === "pinned" ? task.scheduleMode : "manual"); setReservedStart(dateTimeLocalValue(task.plannedStartAt)); setReservedEnd(dateTimeLocalValue(task.plannedEndAt)); setFormError(null); setState(task.state); setRecurrenceFrequency(frequency === "daily" || frequency === "weekly" || frequency === "monthly" ? frequency : "none"); setRecurrenceInterval(String(Math.max(1, Number(rule?.interval) || 1))); setRecurrenceUntil(task.recurrenceUntilLocalDate ?? ""); setRecurrenceWeekdays(frequency === "weekly" && Array.isArray(rule?.weekdays) ? rule.weekdays.filter(value => typeof value === "number" && value >= 0 && value <= 6) : []); }, [editorSourceKey]);
  const submit = async (event: FormEvent) => { event.preventDefault(); const submittedTitle = (event.currentTarget.querySelector<HTMLInputElement>(`#task-title-${task.id}`)?.value ?? title).trim(); if (!submittedTitle) { setFormError("Name this task before saving it."); return; } const reservationError = validateTimeReservation(reservedStart || null, reservedEnd || null); if (reservationError) { setFormError(reservationError); return; } setFormError(null); const recurrenceRule = recurrenceFrequency === "none" ? null : { frequency: recurrenceFrequency, interval: Math.max(1, Number(recurrenceInterval) || 1), ...(recurrenceFrequency === "weekly" && recurrenceWeekdays.length ? { weekdays: recurrenceWeekdays } : {}) }; const planFor = localDateForReservation(reservedStart) ?? (scheduledLocalDate || null); try { await saveTask.mutateAsync({ ...scope, id: task.id, expectedVersion: task.version, patch: { title: submittedTitle, dueLocalDate: dueLocalDate || null, scheduledLocalDate: planFor, plannedStartAt: reservedStart ? new Date(reservedStart) : null, plannedEndAt: reservedEnd ? new Date(reservedEnd) : null, estimateMinutes: estimateMinutes ? Number(estimateMinutes) : null, scheduleMode, state, recurrenceRule, recurrenceAnchor: recurrenceRule ? "scheduled" : null, recurrenceUntilLocalDate: recurrenceRule ? recurrenceUntil || null : null } }); setEditorOpen(false); toast.success("Task details saved."); } catch (error) { setFormError(error instanceof Error ? error.message : "This task could not be saved. Review the details and try again."); } };
  const addSubtask = () => { const subtaskTitle = window.prompt(`Add a subtask beneath “${task.title}”`); if (!subtaskTitle?.trim()) return; createSubtask.mutate({ ...scope, title: subtaskTitle.trim(), parentTaskId: task.id, goalId: task.goalId, projectId: task.projectId, categoryId: task.categoryId, state: "not_started", priority: task.priority, horizon: task.horizon, sortOrder: task.sortOrder + 1 }); };
  const toggleRecurrenceWeekday = (weekday: number) => setRecurrenceWeekdays(current => current.includes(weekday) ? current.filter(value => value !== weekday) : [...current, weekday].sort((left, right) => left - right));
  const nextPriority = priorityOrder[(Math.max(0, priorityOrder.indexOf(task.priority as typeof priorityOrder[number])) + 1) % priorityOrder.length];
  const cyclePriority = () => saveTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { priority: nextPriority } }, {
    onSuccess: () => toast.success(`${task.title} priority is now ${priorityMeta[nextPriority].label}.`),
    onError: error => toast.error(error.message || "This priority could not be updated. Refresh the task and try again."),
  });

  const recordPointerStart = (event: React.PointerEvent<HTMLElement>) => { if (onQuickReschedule) pointerStart.current = { x: event.clientX, y: event.clientY }; };
  const resolveSwipe = (event: React.PointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || !onQuickReschedule) return;
    const horizontal = event.clientX - start.x;
    const vertical = event.clientY - start.y;
    if (Math.abs(horizontal) < 52 || Math.abs(horizontal) < Math.abs(vertical) * 1.35) return;
    onQuickReschedule(task, horizontal < 0 ? 1 : -1);
  };
  return <><article className={cn("task-row", completed && "is-complete", onQuickReschedule && "is-reschedulable")} draggable={!completed && Boolean(onSchedule)} onDragStart={event => event.dataTransfer.setData("text/plain", task.id)} onPointerDown={recordPointerStart} onPointerUp={resolveSwipe}>
    <TaskCheck checked={completed} label={task.title} onClick={() => onToggle(task)} />
    <div className="task-row-main"><p className="task-row-title">{task.title}</p><div className="task-row-meta">{parentTitle ? <span>Subtask of {parentTitle}</span> : null}{childCount ? <span>{childCount} {childCount === 1 ? "subtask" : "subtasks"}</span> : null}{categoryColor ? <span className="category-dot" style={{ backgroundColor: categoryColor }} /> : null}{task.dueLocalDate ? <span>Deadline {task.dueLocalDate}</span> : null}{task.scheduledLocalDate ? <span>Plan {task.scheduledLocalDate}</span> : <span>No plan yet</span>}{task.estimateMinutes ? <span>Focus {task.estimateMinutes}m</span> : null}{deadlineRisk ? <span className="deadline-risk-mark">{deadlineRiskLabel(deadlineRisk)}</span> : null}{task.state === "blocked" ? <span className="blocked-mark">Blocked</span> : null}</div></div>
    <Tooltip><TooltipTrigger asChild><button type="button" className="task-priority" aria-label={`Change priority for ${task.title}. Current ${priority.label}; next ${priorityMeta[nextPriority].label}.`} onClick={cyclePriority} disabled={saveTask.isPending}><Flag size={14} className={priority.className} /></button></TooltipTrigger><TooltipContent>{priority.label} priority · click to set {priorityMeta[nextPriority].label}</TooltipContent></Tooltip>
    {onQuickReschedule ? <div className="task-row-reschedule" aria-label={`Move ${task.title} to a nearby day`}><button type="button" aria-label={`Plan ${task.title} for yesterday`} onClick={() => onQuickReschedule(task, -1)}><ChevronLeft size={15} /></button><button type="button" aria-label={`Plan ${task.title} for tomorrow`} onClick={() => onQuickReschedule(task, 1)}><ChevronRight size={15} /></button></div> : null}
    <div className="task-row-actions"><button className="icon-quiet" aria-label={`Add a subtask to ${task.title}`} onClick={addSubtask}><Plus size={15} /></button><button className="icon-quiet" aria-label={`Edit ${task.title}`} onClick={() => setEditorOpen(true)}><MoreHorizontal size={17} /></button></div>
  </article><Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent className="composer-dialog small-dialog"><DialogHeader><DialogTitle>Refine the commitment</DialogTitle><DialogDescription>Set the deadline, planning day, focus-time estimate, and optional calendar reservation deliberately.</DialogDescription></DialogHeader><form className="composer-form" noValidate onSubmit={submit}><div className="field"><Label htmlFor={`task-title-${task.id}`}>Task</Label><Input id={`task-title-${task.id}`} value={title} required onInvalid={() => setFormError("Name this task before saving it.")} onChange={event => { setTitle(event.target.value); setFormError(null); }} /></div><div className="field"><Label>State</Label><Select value={state} onValueChange={setState}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["not_started", "in_progress", "blocked", "completed", "archived"].map(value => <SelectItem key={value} value={value}>{value.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div><div className="field-grid"><div className="field"><Label htmlFor={`task-due-${task.id}`}>{taskSchedulingLanguage.deadline.label}</Label><Input id={`task-due-${task.id}`} type="date" value={dueLocalDate} onChange={event => setDueLocalDate(event.target.value)} /><p className="field-guidance">{taskSchedulingLanguage.deadline.help}</p></div><div className="field"><Label htmlFor={`task-plan-${task.id}`}>{taskSchedulingLanguage.planFor.label}</Label><Input id={`task-plan-${task.id}`} type="date" value={scheduledLocalDate} onChange={event => { setScheduledLocalDate(event.target.value); setFormError(null); }} /><p className="field-guidance">{taskSchedulingLanguage.planFor.help}</p></div></div><div className="field"><Label htmlFor={`task-estimate-${task.id}`}>{taskSchedulingLanguage.focusTime.label}</Label><Input id={`task-estimate-${task.id}`} type="number" min="0" max="1440" value={estimateMinutes} onChange={event => setEstimateMinutes(event.target.value)} placeholder="Minutes" /><p className="field-guidance">{taskSchedulingLanguage.focusTime.help}</p></div><div className="field"><Label>Scheduling</Label><Select value={scheduleMode} onValueChange={value => setScheduleMode(value as "manual" | "flexible" | "pinned")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="manual">Manual — you choose time</SelectItem><SelectItem value="flexible">Flexible — proposal eligible</SelectItem><SelectItem value="pinned">Pinned — protect this block</SelectItem></SelectContent></Select><p className="field-guidance">Flexible work can receive a reviewable slot proposal. Pinned work is never moved by assistance.</p></div><fieldset className="time-reservation-fields"><legend>{taskSchedulingLanguage.reserveTime.label}</legend><p>{taskSchedulingLanguage.reserveTime.help}</p><div className="field-grid"><div className="field"><Label htmlFor={`task-reserve-start-${task.id}`}>Start</Label><Input id={`task-reserve-start-${task.id}`} type="datetime-local" value={reservedStart} onChange={event => { setReservedStart(event.target.value); const planned = localDateForReservation(event.target.value); if (planned) setScheduledLocalDate(planned); setFormError(null); }} /></div><div className="field"><Label htmlFor={`task-reserve-end-${task.id}`}>End</Label><Input id={`task-reserve-end-${task.id}`} type="datetime-local" value={reservedEnd} onChange={event => { setReservedEnd(event.target.value); setFormError(null); }} /></div></div></fieldset>{formError ? <p className="form-error" role="alert">{formError}</p> : null}<div className="recurrence-fields"><div className="field"><Label>Repeat</Label><Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Does not repeat</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>{recurrenceFrequency === "weekly" ? <fieldset className="recurrence-weekdays"><legend>Repeat on</legend><div>{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label, weekday) => <button key={label} type="button" className={cn(recurrenceWeekdays.includes(weekday) && "is-selected")} aria-pressed={recurrenceWeekdays.includes(weekday)} onClick={() => toggleRecurrenceWeekday(weekday)}>{label}</button>)}</div><p className="recurrence-help">No selected days uses the task’s planned date as the weekly anchor.</p></fieldset> : null}{recurrenceFrequency !== "none" ? <><div className="field"><Label htmlFor={`task-recurrence-interval-${task.id}`}>Every</Label><Input id={`task-recurrence-interval-${task.id}`} type="number" min="1" max="365" value={recurrenceInterval} onChange={event => setRecurrenceInterval(event.target.value)} /></div><div className="field"><Label htmlFor={`task-recurrence-until-${task.id}`}>Stop after</Label><Input id={`task-recurrence-until-${task.id}`} type="date" value={recurrenceUntil} onChange={event => setRecurrenceUntil(event.target.value)} /></div><p className="recurrence-help">Occurrences use the planned date when set; otherwise, they follow the due date.</p></> : null}</div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => setEditorOpen(false)}>Cancel</Button><Button type="submit" className="primary-action" disabled={saveTask.isPending}>{saveTask.isPending ? "Saving…" : "Save changes"}</Button></div></form></DialogContent></Dialog></>;
}

type ProjectBreakdownDraft = { requestId: string; title: string; estimateMinutes: string; scheduledLocalDate: string };

function createProjectBreakdownDraft(): ProjectBreakdownDraft {
  const uuid = typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { requestId: `project-task-${uuid}`, title: "", estimateMinutes: "", scheduledLocalDate: "" };
}

function ProjectBreakdownDialog({ project, onOpenChange, onCreate }: { project: any | null; onOpenChange: (open: boolean) => void; onCreate: (project: any, drafts: ProjectBreakdownDraft[]) => Promise<void> }) {
  const [drafts, setDrafts] = useState<ProjectBreakdownDraft[]>([createProjectBreakdownDraft()]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  useEffect(() => { if (project) { setDrafts([createProjectBreakdownDraft()]); setFormError(null); setIsCreating(false); } }, [project]);
  const updateDraft = (requestId: string, patch: Partial<ProjectBreakdownDraft>) => setDrafts(current => current.map(draft => draft.requestId === requestId ? { ...draft, ...patch } : draft));
  const reviewedDrafts = drafts.filter(draft => draft.title.trim());
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!project) return;
    if (!reviewedDrafts.length) { setFormError("Add at least one explicit task before creating linked work."); return; }
    if (reviewedDrafts.some(draft => draft.estimateMinutes && (!Number.isFinite(Number(draft.estimateMinutes)) || Number(draft.estimateMinutes) < 0 || Number(draft.estimateMinutes) > 1440))) { setFormError("Focus time must be between 0 and 1,440 minutes."); return; }
    setFormError(null); setIsCreating(true);
    try { await onCreate(project, reviewedDrafts); onOpenChange(false); } catch (error) { setFormError(error instanceof Error ? error.message : "The linked tasks could not all be created. Review the rows and retry."); } finally { setIsCreating(false); }
  };
  return <Dialog open={Boolean(project)} onOpenChange={onOpenChange}><DialogContent className="composer-dialog breakdown-dialog"><DialogHeader><DialogTitle>Break down {project?.title ?? "project"}</DialogTitle><DialogDescription>Review the next explicit actions. Nothing is created until you choose Create linked tasks; each row is linked to this project and retries are duplicate-safe.</DialogDescription></DialogHeader><form className="composer-form project-breakdown-form" noValidate onSubmit={submit}><div className="project-breakdown-summary"><span>Project deadline</span><strong>{project?.dueLocalDate ?? "No project deadline"}</strong><p>Task deadlines are left empty deliberately. Add one only when the task has its own latest finish date.</p></div><div className="breakdown-rows">{drafts.map((draft, index) => <div className="breakdown-row" key={draft.requestId}><div className="field"><Label htmlFor={`breakdown-title-${draft.requestId}`}>Task {index + 1}</Label><Input id={`breakdown-title-${draft.requestId}`} value={draft.title} onChange={event => { updateDraft(draft.requestId, { title: event.target.value }); setFormError(null); }} placeholder="Describe a concrete next action" /></div><div className="field"><Label htmlFor={`breakdown-estimate-${draft.requestId}`}>Focus time</Label><Input id={`breakdown-estimate-${draft.requestId}`} type="number" min="0" max="1440" value={draft.estimateMinutes} onChange={event => updateDraft(draft.requestId, { estimateMinutes: event.target.value })} placeholder="Minutes" /></div><div className="field"><Label htmlFor={`breakdown-plan-${draft.requestId}`}>Plan for</Label><Input id={`breakdown-plan-${draft.requestId}`} type="date" value={draft.scheduledLocalDate} onChange={event => updateDraft(draft.requestId, { scheduledLocalDate: event.target.value })} /></div>{drafts.length > 1 ? <button type="button" className="breakdown-remove" onClick={() => setDrafts(current => current.filter(item => item.requestId !== draft.requestId))} aria-label={`Remove task ${index + 1}`}>Remove</button> : null}</div>)}</div>{drafts.length < 5 ? <button type="button" className="breakdown-add" onClick={() => setDrafts(current => [...current, createProjectBreakdownDraft()])}>Add another task</button> : <p className="field-guidance">Five reviewed tasks is the maximum for one breakdown. Create this set, then continue from the project if more work is needed.</p>}{formError ? <p className="form-error" role="alert">{formError}</p> : null}<div className="composer-submit"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isCreating}>Cancel</Button><Button type="submit" className="primary-action" disabled={isCreating}>{isCreating ? "Creating linked tasks…" : `Create ${reviewedDrafts.length || "reviewed"} linked task${reviewedDrafts.length === 1 ? "" : "s"}`}</Button></div></form></DialogContent></Dialog>;
}

function TaskBoard({ tasks, categories, onToggle, onMove, onCompose, onArchiveCompleted, isSearching }: { tasks: any[]; categories: any[]; onToggle: (task: any) => void; onMove: (task: any, lane: TaskBoardLaneId) => void; onCompose: () => void; onArchiveCompleted: (tasks: any[]) => Promise<boolean>; isSearching: boolean }) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropLane, setDropLane] = useState<TaskBoardLaneId | null>(null);
  const [moveAnnouncement, setMoveAnnouncement] = useState("");
  const [expandedLanes, setExpandedLanes] = useState<Partial<Record<TaskBoardLaneId, boolean>>>({});
  const [isArchivingCompleted, setIsArchivingCompleted] = useState(false);
  const categoryColors = useMemo(() => new Map(categories.map(category => [category.id, category.color])), [categories]);
  const taskTitles = useMemo(() => new Map(tasks.map(task => [task.id, task.title])), [tasks]);
  const childCountByParent = useMemo(() => tasks.reduce((counts, task) => { if (task.parentTaskId) counts.set(task.parentTaskId, (counts.get(task.parentTaskId) ?? 0) + 1); return counts; }, new Map<string, number>()), [tasks]);
  const move = (task: any, lane: TaskBoardLaneId) => {
    if (laneForTaskState(task.state) === lane) { setMoveAnnouncement(`${task.title} is already in ${taskBoardLanes.find(item => item.id === lane)?.label}.`); return; }
    setMoveAnnouncement(`Moving ${task.title} to ${taskBoardLanes.find(item => item.id === lane)?.label}.`);
    onMove(task, lane);
  };
  const startDrag = (event: React.DragEvent<HTMLDivElement>, task: any) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", task.id); setDraggedTaskId(task.id); };
  const completedTasks = tasks.filter(task => laneForTaskState(task.state) === "completed");
  const archiveCompleted = async () => {
    if (!completedTasks.length || !window.confirm(`Archive ${completedTasks.length} completed task${completedTasks.length === 1 ? "" : "s"}? They will leave active planning but remain restorable in Archived work.`)) return;
    setIsArchivingCompleted(true);
    const archived = await onArchiveCompleted(completedTasks);
    if (archived) setExpandedLanes(current => ({ ...current, completed: false }));
    setIsArchivingCompleted(false);
  };
  return <section className="task-board" aria-labelledby="task-board-heading">
    <div className="task-board-heading"><div><h2 id="task-board-heading">Work lanes</h2><p>Move work forward by dragging a task, or use its move control when you prefer the keyboard or touch.</p></div><span>{tasks.length} shown</span></div>
    <p className="sr-only" id="task-board-help">Drag a task card to another lane to change its state. Each card also includes a Move to control.</p>
    <p className="sr-only" role="status" aria-live="polite">{moveAnnouncement}</p>
    <div className="task-lane-grid">{taskBoardLanes.map(lane => {
      const laneTasks = tasks.filter(task => laneForTaskState(task.state) === lane.id);
      const laneExpanded = Boolean(expandedLanes[lane.id]) || isSearching;
      const visibleLane = visibleTasksForLane(laneTasks, lane.id, laneExpanded);
      const moreLabel = `Show ${visibleLane.hiddenCount} more ${lane.label.toLowerCase()} task${visibleLane.hiddenCount === 1 ? "" : "s"}`;
      return <section className={cn("task-lane", `task-lane-${lane.id}`, dropLane === lane.id && "is-drop-target")} key={lane.id} aria-labelledby={`task-lane-${lane.id}`}>
        <header className="task-lane-header"><div><span className="task-lane-marker" aria-hidden="true" /><h3 id={`task-lane-${lane.id}`}>{lane.label}</h3></div><span aria-label={`${laneTasks.length} tasks`}>{laneTasks.length}</span></header>
        <p className="task-lane-description">{lane.description}</p>
        <div className="task-lane-list" role="list" aria-describedby="task-board-help" onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (dropLane !== lane.id) setDropLane(lane.id); }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropLane(null); }} onDrop={event => { event.preventDefault(); const taskId = event.dataTransfer.getData("text/plain") || draggedTaskId; const task = tasks.find(item => item.id === taskId); if (task) move(task, lane.id); setDraggedTaskId(null); setDropLane(null); }}>
          {visibleLane.items.length ? visibleLane.items.map(task => <div key={task.id} className={cn("task-lane-task", draggedTaskId === task.id && "is-dragging")} role="listitem" draggable onDragStart={event => startDrag(event, task)} onDragEnd={() => { setDraggedTaskId(null); setDropLane(null); }}><span className="task-drag-handle" aria-hidden="true"><GripVertical size={15} /></span><TaskRow task={task} categoryColor={categoryColors.get(task.categoryId)} parentTitle={task.parentTaskId ? taskTitles.get(task.parentTaskId) : undefined} childCount={childCountByParent.get(task.id)} onToggle={onToggle} /><label className="task-lane-select"><span>Move to</span><select value={laneForTaskState(task.state)} onChange={event => move(task, event.target.value as TaskBoardLaneId)}>{taskBoardLanes.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label></div>) : <div className="task-lane-empty">{lane.id === "todo" ? <button type="button" onClick={onCompose}>Add a task to begin</button> : `No tasks are ${lane.id === "in_progress" ? "in progress" : "completed"} yet.`}</div>}
          {visibleLane.hiddenCount ? <button type="button" className="task-history-toggle" onClick={() => setExpandedLanes(current => ({ ...current, [lane.id]: true }))}>{moreLabel}</button> : null}
          {!isSearching && expandedLanes[lane.id] && laneTasks.length > visibleLane.previewLimit ? <button type="button" className="task-history-toggle" onClick={() => setExpandedLanes(current => ({ ...current, [lane.id]: false }))}>Show recent {visibleLane.previewLimit}</button> : null}
        </div>
        {lane.id === "completed" && laneTasks.length ? <button type="button" className="task-archive-completed" disabled={isArchivingCompleted} onClick={() => void archiveCompleted()}>{isArchivingCompleted ? "Archiving…" : `Archive ${laneTasks.length} completed`}</button> : null}
      </section>;
    })}</div>
  </section>;
}

function TaskArchivePanel({ tasks, query, onRestore }: { tasks: any[]; query: string; onRestore: (task: any) => void }) {
  const [showAll, setShowAll] = useState(false);
  const matches = useMemo(() => tasks.filter(task => task.title.toLowerCase().includes(query.toLowerCase())), [tasks, query]);
  const visible = showAll ? matches : matches.slice(0, completedLanePreviewLimit);
  return <section className="task-archive-panel" aria-labelledby="archived-task-heading"><div><h2 id="archived-task-heading">Archived work</h2><p>Archived tasks are removed from active planning, not deleted. Restore only what deserves a place in the plan again.</p></div><span>{matches.length} stored</span>{visible.length ? <ul>{visible.map(task => <li key={task.id}><div><strong>{task.title}</strong><small>{task.completedAt ? `completed ${new Date(task.completedAt).toLocaleDateString()}` : "archived without completion"}</small></div><Button type="button" variant="ghost" onClick={() => onRestore(task)}>Restore</Button></li>)}</ul> : <p>{query ? "No archived task matches this search." : "No archived tasks yet."}</p>}{matches.length > completedLanePreviewLimit ? <button type="button" className="task-history-toggle" onClick={() => setShowAll(current => !current)}>{showAll ? `Show recent ${completedLanePreviewLimit}` : `Show all ${matches.length} archived tasks`}</button> : null}</section>;
}

function DailyCompass() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const [intention, setIntention] = useState("");
  const [energy, setEnergy] = useState("3");
  const [mood, setMood] = useState("3");
  const checkIn = trpc.planner.dailyCheckIn.upsert.useMutation();
  const submit = (event: FormEvent) => { event.preventDefault(); checkIn.mutate({ ...scope, localDate: today, intention: intention.trim() || null, energy: Number(energy), mood: Number(mood) }); };
  return <form className="daily-compass" onSubmit={submit}><div className="daily-compass-copy"><span>Daily signal</span><p>Set the conditions, not just the list.</p></div><Input value={intention} onChange={event => setIntention(event.target.value)} placeholder="One sentence for today" aria-label="Daily intention" /><div className="daily-compass-controls"><label>Energy<Select value={energy} onValueChange={setEnergy}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map(value => <SelectItem key={value} value={String(value)}>{value}/5</SelectItem>)}</SelectContent></Select></label><label>Mood<Select value={mood} onValueChange={setMood}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5].map(value => <SelectItem key={value} value={String(value)}>{value}/5</SelectItem>)}</SelectContent></Select></label><Button type="submit" variant="ghost" disabled={checkIn.isPending}>{checkIn.isPending ? "Saving" : "Check in"}</Button></div></form>;
}

function RecurringWorkControl() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const utils = trpc.useUtils();
  const materialize = trpc.planner.occurrence.materialize.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const end = shiftLocalDate(today, 28);
  return <div className="recurrence-control"><span>Recurring work</span><p>{materialize.data ? `${materialize.data.length} dated occurrences are ready through ${end}.` : "Generate the next four weeks of scheduled repetitions."}</p><Button type="button" variant="ghost" onClick={() => materialize.mutate({ ...scope, start: today, end })} disabled={materialize.isPending}>{materialize.isPending ? "Refreshing…" : "Refresh series"}</Button></div>;
}

function ReviewRitual({ sessions }: { sessions: any[] }) {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const [localReview, setLocalReview] = useState<any>(null);
  const [reflection, setReflection] = useState("");
  const utils = trpc.useUtils();
  const activeFromSnapshot = sessions.find(session => session.kind === "weekly" && session.state === "in_progress") ?? null;
  const review = localReview ?? activeFromSnapshot;
  const completedReviews = sessions.filter(session => session.kind === "weekly" && session.state === "completed").slice(0, 3);
  const refresh = () => utils.planner.workspace.snapshot.invalidate();
  const start = trpc.planner.review.start.useMutation({ onSuccess: session => { setLocalReview(session); refresh(); } });
  const complete = trpc.planner.review.complete.useMutation({ onSuccess: session => { setLocalReview(session); refresh(); } });
  const periodStartLocalDate = shiftLocalDate(today, -6);
  const history = completedReviews.length ? <div className="review-history" aria-label="Recent completed weekly reviews"><span>Recent completed reviews</span>{completedReviews.map(session => <div key={session.id}><strong>{session.periodStartLocalDate} → {session.periodEndLocalDate}</strong><p>{session.reflection || "Completed without a written reflection."}</p></div>)}</div> : null;
  if (!review) return <div className="review-ritual"><div><span>Weekly review</span><p>Clear the week, name what changed, and choose one honest next move.</p></div><Button type="button" variant="ghost" onClick={() => start.mutate({ ...scope, kind: "weekly", periodStartLocalDate, periodEndLocalDate: today, snapshot: { openPeriod: true } })} disabled={start.isPending}>{start.isPending ? "Opening…" : "Begin review"}</Button>{history}</div>;
  if (review.state === "completed") return <div className="review-ritual"><div><span>Weekly review</span><p>Reflection saved. The next review can begin when you are ready.</p></div><Button type="button" variant="ghost" onClick={() => { setLocalReview(null); setReflection(""); }}>New review</Button>{history}</div>;
  return <div className="review-ritual is-active"><span>Weekly review · {review.periodStartLocalDate} to {review.periodEndLocalDate}</span><textarea value={reflection} onChange={event => setReflection(event.target.value)} placeholder="What moved, what was blocked, and what will change next week?" aria-label="Weekly review reflection" /><Button type="button" className="primary-action" onClick={() => complete.mutate({ ...scope, id: review.id, expectedVersion: review.version, reflection: reflection.trim() || null })} disabled={complete.isPending}>{complete.isPending ? "Saving…" : "Close review"}</Button>{history}</div>;
}

function PlanningHealthStrip() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => isoRange(today), [today]);
  const dashboard = trpc.planner.dashboard.useQuery({ ...scope, todayLocalDate: today, rangeStart: range.start, rangeEnd: range.end });
  const health = dashboard.data?.planningHealth;
  if (!health) return null;
  const advice = health.blockedCount ? "Unblock one stalled item before adding new work." : health.carryoverCount ? "Reschedule carryover deliberately, then protect one focus task." : health.focusCompletionRate === 100 && health.completedToday ? "Today’s planned work is moving. Keep the next commitment small." : "Choose one protected focus before the day expands.";
  return <div className="planning-health"><div><span>Plan health</span><p>{advice}</p></div><dl><div><dt>Carryover</dt><dd>{health.carryoverCount}</dd></div><div><dt>Blocked</dt><dd>{health.blockedCount}</dd></div><div><dt>Focus</dt><dd>{health.focusCompletionRate}%</dd></div></dl></div>;
}

function DecisionSignals() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => isoRange(today), [today]);
  const dashboard = trpc.planner.dashboard.useQuery({ ...scope, todayLocalDate: today, rangeStart: range.start, rangeEnd: range.end });
  const signals = dashboard.data?.decisionSignals;
  if (!signals) return null;
  const reliability = signals.scheduleReliability === null ? "No scheduled history" : `${signals.scheduleReliability}% kept`;
  const advice = signals.carryoverRate >= 35 ? "Reduce the next plan before adding more commitments." : signals.estimateCoverage < 60 ? "Add estimates to make capacity guidance more useful." : signals.averageBlockedAgeDays >= 3 ? "Resolve or deliberately close ageing blocked work." : "Your plan has enough signal for a deliberate next move.";
  return <div className="decision-signals"><div><span>Decision signals</span><p>{advice}</p></div><dl><div><dt>Reliability</dt><dd>{reliability}</dd></div><div><dt>Carryover</dt><dd>{signals.carryoverRate}%</dd></div><div><dt>Estimated</dt><dd>{signals.estimateCoverage}%</dd></div></dl></div>;
}

function DailyCapacityForecast({ workload, onOpenDeadlineRisk }: { workload: any; onOpenDeadlineRisk: () => void }) {
  if (!workload) return <section className="capacity-forecast" aria-label="Daily capacity forecast"><div><h2>Daily capacity</h2><p>Calculating today’s known focus time…</p></div></section>;
  const remaining = workload.remainingMinutes as number;
  const summary = workload.isOverCapacity ? `${Math.abs(remaining)} minutes over capacity` : `${remaining} minutes still available`;
  return <section className={cn("capacity-forecast", workload.isOverCapacity && "is-over-capacity")} aria-label="Daily capacity forecast"><div className="capacity-forecast-main"><div><h2>Daily capacity</h2><p>{summary} from known estimates. {workload.unestimatedCount ? `${workload.unestimatedCount} task${workload.unestimatedCount === 1 ? "" : "s"} still needs focus time.` : "Every task in today’s load has a focus-time estimate."}</p></div><strong>{workload.plannedMinutes}<small> / {workload.capacityMinutes} min</small></strong></div><dl><div><dt>Reserved</dt><dd>{workload.reservedMinutes} min</dd></div><div><dt>Deadline only</dt><dd>{workload.deadlineOnlyMinutes} min</dd></div><div><dt>Risk</dt><dd>{workload.deadlineRiskCount}</dd></div></dl><button type="button" className="capacity-risk-link" onClick={onOpenDeadlineRisk}>{workload.deadlineRiskCount ? `Review ${workload.deadlineRiskCount} deadline risk${workload.deadlineRiskCount === 1 ? "" : "s"}` : "Review deadline risk"}</button></section>;
}

function TaskTriagePanel() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => ({ start: shiftLocalDate(today, -31), end: shiftLocalDate(today, 31) }), [today]);
  const utils = trpc.useUtils();
  const snapshot = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range });
  const [filter, setFilter] = useState("open");
  const [sort, setSort] = useState("priority");
  const [selected, setSelected] = useState<string[]>([]);
  const bulk = trpc.planner.task.bulkSetState.useMutation({ onSuccess: () => { setSelected([]); utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const createView = trpc.planner.savedView.create.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  const updateView = trpc.planner.savedView.update.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  const deleteView = trpc.planner.savedView.delete.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  const priorityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
  const allTasks = snapshot.data?.tasks ?? [];
  const filtered = allTasks.filter(task => filter === "today" ? task.scheduledLocalDate === today || task.dueLocalDate === today : filter === "risk" ? deadlineRiskForTask(task, today) !== null : filter === "open" ? task.state !== "completed" && task.state !== "archived" : task.state !== "archived");
  const rows = [...filtered].sort((a, b) => sort === "due" ? (a.dueLocalDate ?? "9999-12-31").localeCompare(b.dueLocalDate ?? "9999-12-31") : sort === "scheduled" ? (a.scheduledLocalDate ?? "9999-12-31").localeCompare(b.scheduledLocalDate ?? "9999-12-31") : sort === "created" ? Number(new Date(b.createdAt).getTime()) - Number(new Date(a.createdAt).getTime()) : (priorityRank[a.priority] ?? 5) - (priorityRank[b.priority] ?? 5));
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const applyView = (view: any) => { const config = view.configuration as { filter?: string; sort?: string }; setFilter(config.filter ?? "open"); setSort(config.sort ?? "priority"); };
  const views = (snapshot.data?.savedViews ?? []).filter(view => view.viewType === "tasks");
  const saveCurrent = () => { const name = window.prompt("Name this task view. Reuse a name to overwrite its filter and sort."); if (!name?.trim()) return; const existing = views.find(view => view.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase()); if (existing) updateView.mutate({ ...scope, id: existing.id, expectedVersion: existing.version, configuration: { filter, sort } }); else createView.mutate({ ...scope, name: name.trim(), viewType: "tasks", configuration: { filter, sort }, isPinned: 0 }); };
  return <section className="triage-panel" aria-labelledby="triage-heading"><div className="triage-heading"><div><span>Action queue</span><h2 id="triage-heading">Triage before you add</h2></div><button type="button" onClick={saveCurrent} disabled={createView.isPending}>Save view</button></div><div className="triage-controls"><div><label>Show<select value={filter} onChange={event => setFilter(event.target.value)}><option value="open">Open work</option><option value="today">Today</option><option value="risk">Deadline risk</option><option value="all">All active history</option></select></label><label>Order<select value={sort} onChange={event => setSort(event.target.value)}><option value="priority">Priority</option><option value="due">Due date</option><option value="scheduled">Planned date</option><option value="created">Newest</option></select></label></div>{views.length ? <div className="saved-view-chips">{views.map(view => <span key={view.id}><button type="button" onClick={() => applyView(view)}>{view.name}</button><button type="button" aria-label={`${view.isPinned ? "Unpin" : "Pin"} ${view.name}`} onClick={() => updateView.mutate({ ...scope, id: view.id, expectedVersion: view.version, isPinned: view.isPinned ? 0 : 1 })}>{view.isPinned ? "★" : "☆"}</button><button type="button" aria-label={`Delete ${view.name}`} onClick={() => deleteView.mutate({ ...scope, id: view.id })}>×</button></span>)}</div> : null}</div>{selected.length ? <div className="bulk-actions"><span>{selected.length} selected</span><button type="button" onClick={() => bulk.mutate({ ...scope, ids: selected, state: "in_progress" })}>Start</button><button type="button" onClick={() => bulk.mutate({ ...scope, ids: selected, state: "completed" })}>Complete</button><button type="button" onClick={() => bulk.mutate({ ...scope, ids: selected, state: "archived" })}>Archive</button></div> : null}<div className="triage-list">{rows.slice(0, 6).map(task => { const risk = deadlineRiskForTask(task, today); return <label key={task.id}><input type="checkbox" checked={selected.includes(task.id)} onChange={() => toggle(task.id)} /><span><strong>{task.title}</strong><small>{task.state.replace("_", " ")} · {task.dueLocalDate ?? task.scheduledLocalDate ?? "no date"}{risk ? ` · ${deadlineRiskLabel(risk)}` : ""}</small></span><em>{task.priority}</em></label>; })}{!rows.length ? <p>No tasks match this decision lens.</p> : null}</div></section>;
}

function CalendarSubscriptionControl() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [feed, setFeed] = useState<any>(null);
  const ensure = trpc.planner.calendarFeed.ensure.useMutation({ onSuccess: setFeed });
  const revoke = trpc.planner.calendarFeed.revoke.useMutation({ onSuccess: () => setFeed(null) });
  const url = feed ? `${window.location.origin}/api/calendar/${feed.token}.ics` : null;
  return <div className="calendar-subscription"><span>iPhone Calendar</span>{!feed ? <><p>Create a private, read-only calendar link for the iPhone Calendar app.</p><Button type="button" variant="ghost" onClick={() => ensure.mutate(scope)} disabled={ensure.isPending}>{ensure.isPending ? "Creating…" : "Create link"}</Button></> : <><p>Use this link with <strong>Calendar → Add Subscription Calendar</strong> on iPhone.</p><div className="calendar-feed-actions"><Button type="button" variant="ghost" onClick={() => navigator.clipboard?.writeText(url!)}>Copy link</Button><a href={url ?? undefined} target="_blank" rel="noreferrer">Open .ics</a><Button type="button" variant="ghost" onClick={() => revoke.mutate({ ...scope, id: feed.id })}>Revoke</Button></div></>}</div>;
}

function vapidKeyToUint8Array(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const raw = window.atob(base64);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

function BrowserNotificationControl() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => typeof Notification === "undefined" || !navigator.serviceWorker ? "unsupported" : Notification.permission);
  const [message, setMessage] = useState<string | null>(null);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const devices = trpc.planner.notification.devices.useQuery(scope);
  const currentDeviceQuery = trpc.planner.notification.currentDevice.useQuery({ ...scope, endpoint: currentEndpoint ?? "https://placeholder.invalid/personal-calander" }, { enabled: Boolean(currentEndpoint) });
  const enableDevice = trpc.planner.notification.enableDevice.useMutation({ onSuccess: () => { setMessage("This device is ready for visible planning reminders."); utils.planner.notification.devices.invalidate(); utils.planner.notification.currentDevice.invalidate(); } });
  const disableDevice = trpc.planner.notification.disableDevice.useMutation({ onSuccess: () => { setMessage("This device will no longer receive planning reminders."); setCurrentEndpoint(null); utils.planner.notification.devices.invalidate(); utils.planner.notification.currentDevice.invalidate(); } });
  const testDevice = trpc.planner.notification.testDevice.useMutation({ onSuccess: () => { setMessage("Test notification accepted. Check this device’s notification center."); utils.planner.notification.devices.invalidate(); }, onError: error => setMessage(error.message) });
  const reminderRules = trpc.planner.reminder.rules.useQuery(scope);
  const activateCadence = trpc.planner.reminder.activateApproved.useMutation({ onSuccess: () => { setMessage("Daily 11:00 and Sunday 17:00 Pacific/Auckland reminders are now scheduled."); utils.planner.reminder.rules.invalidate(); }, onError: error => setMessage(error.message) });
  const pauseCadence = trpc.planner.reminder.pauseApproved.useMutation({ onSuccess: () => { setMessage("Automatic planning reminders are paused. Your device remains connected for manual tests."); utils.planner.reminder.rules.invalidate(); }, onError: error => setMessage(error.message) });
  const currentDevice = currentDeviceQuery.data?.status === "active" ? currentDeviceQuery.data : null;
  const registerSubscription = async (subscription: PushSubscriptionJSON) => {
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys.auth) throw new Error("This browser did not return the keys required for secure reminders.");
    setCurrentEndpoint(subscription.endpoint);
    await enableDevice.mutateAsync({ ...scope, subscription: { endpoint: subscription.endpoint, keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth }, deviceLabel: "This device", userAgent: navigator.userAgent } });
  };
  const enable = async () => {
    if (typeof Notification === "undefined" || !navigator.serviceWorker || !window.PushManager || !import.meta.env.VITE_VAPID_PUBLIC_KEY) {
      setPermission("unsupported");
      setMessage("This browser cannot enroll for web push. On iPhone, open the installed Home Screen app in Safari and try again.");
      return;
    }
    try {
      setIsRequestingPermission(true);
      setMessage("Waiting for the notification permission choice…");
      const nextPermission: NotificationPermission | "timeout" = await Promise.race([
        Notification.requestPermission() as Promise<NotificationPermission>,
        new Promise<"timeout">(resolve => window.setTimeout(() => resolve("timeout"), 8_000)),
      ]);
      if (nextPermission === "timeout") {
        setMessage("No permission response arrived. On iPhone, open the Home Screen app, keep it in front, and tap this button again.");
        return;
      }
      setPermission(nextPermission);
      if (nextPermission === "default") {
        setMessage("iOS did not show a permission choice. Open Personal Calendar from its Home Screen icon, then tap this button again.");
        return;
      }
      if (nextPermission === "denied") {
        setMessage("Notifications are blocked for this app. Re-enable them in iPhone Settings, then return here and try again.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let existing: PushSubscription | null = null;
      try {
        existing = await registration.pushManager.getSubscription();
      } catch {
        setMessage("No current subscription could be read. Requesting a fresh reminder connection now…");
      }
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY) });
      await registerSubscription(subscription.toJSON());
    } catch (error) {
      const failure = error as { name?: string; message?: string };
      setMessage(failure?.name === "AbortError"
        ? "This browser could not create a Push API subscription. On iPhone, open Personal Calendar from its Home Screen icon (not a normal browser tab), then try again."
        : failure?.message || "This device could not be enabled for reminders.");
    } finally {
      setIsRequestingPermission(false);
    }
  };
  const disable = async () => {
    const device = currentDevice;
    if (!device) return;
    try {
      await disableDevice.mutateAsync({ ...scope, id: device.id });
      if (navigator.serviceWorker) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        await subscription?.unsubscribe();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The local browser subscription could not be removed. Your saved device remains unchanged.");
    }
  };
  useEffect(() => {
    let cancelled = false;
    if (!navigator.serviceWorker) return;
    void navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription()).then(subscription => { if (!cancelled) setCurrentEndpoint(subscription?.endpoint ?? null); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!navigator.serviceWorker) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "personal-calander:subscription-changed" && event.data.subscription) registerSubscription(event.data.subscription);
      if (event.data?.type === "personal-calander:subscription-refresh-needed") setMessage("This device needs reminders re-enabled after its browser refreshed the subscription.");
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
  const cadenceEnabled = (reminderRules.data ?? []).length === 2 && (reminderRules.data ?? []).every(rule => rule.isEnabled === 1);
  const devicePresentation = getReminderDevicePresentation(permission, Boolean(currentDevice));
  return <section className="notification-control" aria-label="Phone reminders"><div className="reminder-summary"><span>Phone reminders</span><p>Manage this iPhone and its schedule separately.</p></div><div className="device-connection" aria-label="This iPhone reminder connection"><div><b>This iPhone</b><p>{devicePresentation.status}</p></div>{currentDevice ? <div className="device-connection-actions"><Button type="button" variant="ghost" onClick={() => testDevice.mutate({ ...scope, subscriptionId: currentDevice.id, origin: window.location.origin })} disabled={testDevice.isPending}>{testDevice.isPending ? "Sending…" : "Send test"}</Button><Button type="button" variant="ghost" className="danger-action" onClick={disable} disabled={disableDevice.isPending}>{disableDevice.isPending ? "Disconnecting…" : devicePresentation.actionLabel}</Button></div> : <Button type="button" variant="ghost" onClick={enable} disabled={devicePresentation.isBlocked || isRequestingPermission || enableDevice.isPending || currentDeviceQuery.isLoading}>{isRequestingPermission || enableDevice.isPending || currentDeviceQuery.isLoading ? "Connecting…" : devicePresentation.actionLabel}</Button>}</div><div className="reminder-cadence"><div><b>Schedule</b><p>Daily 11:00 · Sunday 17:00 · New Zealand time</p></div>{cadenceEnabled ? <Button type="button" variant="ghost" className="danger-action" onClick={() => pauseCadence.mutate(scope)} disabled={pauseCadence.isPending}>Pause reminders</Button> : <Button type="button" variant="ghost" onClick={() => activateCadence.mutate(scope)} disabled={!currentDevice || activateCadence.isPending}>{activateCadence.isPending ? "Scheduling…" : currentDevice ? "Enable reminders" : "Connect iPhone first"}</Button>}</div>{devices.data && devices.data.length > 1 ? <p className="notification-feedback">{devices.data.length - 1} other saved device{devices.data.length === 2 ? "" : "s"} remain separate; this control acts only on this iPhone.</p> : null}{message ? <p className="notification-feedback" role="status">{message}</p> : null}{devices.data?.some(device => device.status === "expired") ? <p className="notification-feedback" role="alert">A previous device subscription expired. Connect that device again.</p> : null}</section>;
}

function OccurrencePanel() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => ({ start: shiftLocalDate(today, -7), end: shiftLocalDate(today, 7) }), [today]);
  const utils = trpc.useUtils();
  const snapshot = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range });
  const resolve = trpc.planner.occurrence.resolve.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const taskTitles = new Map((snapshot.data?.tasks ?? []).map(task => [task.id, task.title]));
  const pending = (snapshot.data?.taskOccurrences ?? []).filter(item => item.state === "pending" && item.localDate <= today).slice(0, 3);
  if (!pending.length) return null;
  return <div className="occurrence-panel"><div><span>Recurring work due</span><p>{pending.length} dated commitment{pending.length === 1 ? "" : "s"} need an outcome.</p></div><div className="occurrence-list">{pending.map(item => <div className="occurrence-row" key={item.id}><p><strong>{taskTitles.get(item.taskId) ?? "Recurring task"}</strong><small>{item.localDate === today ? "Today" : item.localDate}</small></p><div><button type="button" onClick={() => resolve.mutate({ ...scope, id: item.id, expectedVersion: item.version, state: "completed" })} disabled={resolve.isPending}>Done</button><button type="button" onClick={() => resolve.mutate({ ...scope, id: item.id, expectedVersion: item.version, state: "skipped" })} disabled={resolve.isPending}>Skip</button><button type="button" onClick={() => resolve.mutate({ ...scope, id: item.id, expectedVersion: item.version, state: "missed" })} disabled={resolve.isPending}>Missed</button></div></div>)}</div></div>;
}

function ResponsiveSupportGroup({ title, detail, children, className }: { title: string; detail: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(() => typeof window === "undefined" || !window.matchMedia("(max-width: 680px)").matches);
  return <details className={cn("mobile-support-group", className)} open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary><span>{title}</span><small>{detail}</small><ChevronRight size={18} aria-hidden="true" /></summary><div className="mobile-support-content">{children}</div></details>;
}

function FocusPanel({ tasks, categories, onToggle, onCompose }: { tasks: any[]; categories: any[]; onToggle: (task: any) => void; onCompose: () => void }) {
  const categoryColors = new Map(categories.map(category => [category.id, category.color]));
  const entryStage = todayEntryStage(tasks.filter(task => task.state !== "completed").length);
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [rescheduleMessage, setRescheduleMessage] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const reschedule = trpc.planner.task.update.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const quickReschedule = (task: any, amount: number) => {
    const nextDate = shiftLocalDate(localDateInTimezone(scope.timezone), amount);
    setRescheduleMessage(`Planning “${task.title}” for ${displayLocalDate(nextDate, scope.timezone, { weekday: "short", month: "short", day: "numeric" })}…`);
    reschedule.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { scheduledLocalDate: nextDate } }, {
      onSuccess: () => setRescheduleMessage(`Planned “${task.title}” for ${displayLocalDate(nextDate, scope.timezone, { weekday: "short", month: "short", day: "numeric" })}.`),
      onError: error => setRescheduleMessage(error.message),
    });
  };
  return (
    <section className="focus-panel" data-entry-stage={entryStage} aria-labelledby="focus-heading">
      <div className="panel-heading"><div><span className="eyebrow">Immediate focus</span><h2 id="focus-heading">Today’s commitment</h2></div><span className="panel-count">{tasks.filter(task => task.state !== "completed").length} open</span></div>
      <div className="focus-list">
        {tasks.length ? tasks.map(task => <TaskRow key={task.id} task={task} categoryColor={categoryColors.get(task.categoryId)} onToggle={onToggle} onQuickReschedule={quickReschedule} />) : <EmptyState title="Begin with one honest commitment" detail="Capture a task, then decide whether it belongs in today." action={onCompose} />}
      </div>
      {tasks.length ? <p className="today-reschedule-hint">Swipe a task left or right to plan it for yesterday or tomorrow.</p> : null}
      {rescheduleMessage ? <p className="today-reschedule-status" role="status">{rescheduleMessage}</p> : null}
      {entryStage === "plan" ? <><OfflineCaptureIndicator />
        <DailyCompass />
        <ResponsiveSupportGroup title="Plan tools" detail="Triage, recurring work, and plan health"><TaskTriagePanel /><RecurringWorkControl /><OccurrencePanel /><PlanningHealthStrip /><DecisionSignals /></ResponsiveSupportGroup>
        <ResponsiveSupportGroup title="Connected tools" detail="Calendar and this iPhone" className="mobile-connection-group"><CalendarSubscriptionControl /><BrowserNotificationControl /></ResponsiveSupportGroup>
        <AICompanion /></> : <p className="first-task-next-step">After you capture a task, planning tools, capacity signals, and calendar choices appear here.</p>}
    </section>
  );
}

function OfflineCaptureIndicator() {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [queued, setQueued] = useState(() => capturesForWorkspace(scope.workspaceId).length);
  useEffect(() => {
    const refresh = () => setQueued(capturesForWorkspace(scope.workspaceId).length);
    window.addEventListener(offlineCaptureChangedEvent, refresh);
    window.addEventListener("online", refresh);
    return () => { window.removeEventListener(offlineCaptureChangedEvent, refresh); window.removeEventListener("online", refresh); };
  }, [scope.workspaceId]);
  if (!queued) return null;
  return <p className="offline-capture-indicator" role="status">{queued} capture{queued === 1 ? "" : "s"} saved on this device and waiting for a connection.</p>;
}

function Timeline({ tasks, selectedDate, onDrop, onMoveDay, onOpenTasks, onComplete, onResize, scheduleError, onRetrySchedule, onOpenHabits = () => window.dispatchEvent(new Event("personal-calander:open-habits")) }: { tasks: any[]; selectedDate: string; onDrop: (id: string, localDate: string) => void; onMoveDay: (amount: number) => void; onOpenTasks: () => void; onComplete: (task: any) => void; onResize: (task: any, minutes: number) => void; scheduleError: string | null; onRetrySchedule: () => void; onOpenHabits?: () => void }) {
  const hours = Array.from({ length: 10 }, (_, index) => index + 8);
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [guidanceDismissedFor, setGuidanceDismissedFor] = useState<string | null>(null);
  const scheduled = tasks.filter(task => task.scheduledLocalDate === selectedDate && task.state !== "completed");
  const allDay = scheduled.filter(task => !task.plannedStartAt || !task.plannedEndAt);
  const timed = scheduled.filter(task => task.plannedStartAt && task.plannedEndAt);
  const unscheduled = tasks.filter(task => !task.scheduledLocalDate && task.state !== "completed" && task.state !== "archived").slice(0, 8);
  return (
    <section className="timeline-panel" aria-labelledby="timeline-heading">
      <div className="timeline-heading"><div><span className="eyebrow">Time canvas</span><h2 id="timeline-heading">{displayLocalDate(selectedDate, scope.timezone, { weekday: "long", month: "short", day: "numeric" })}</h2></div><div className="date-pager"><button onClick={() => onMoveDay(-1)} aria-label="Previous day"><ChevronLeft size={17} /></button><button onClick={() => onMoveDay(1)} aria-label="Next day"><ChevronRight size={17} /></button></div></div>
      {allDay.length ? <section className="calendar-all-day" aria-label="Planned work without a time reservation"><div><strong>Planned, no time reserved</strong><span>All-day work stays separate from timed reservations.</span></div><div>{allDay.map(task => <article key={task.id} draggable onDragStart={event => event.dataTransfer.setData("text/plain", task.id)}><button type="button" className="calendar-complete" onClick={() => onComplete(task)} aria-label={`Complete ${task.title}`}><Check size={12} /></button><span>{task.title}</span><small>{task.estimateMinutes ? `${task.estimateMinutes}m` : "No estimate"}</small></article>)}</div></section> : null}
      <div className="timeline-scroller">
        {hours.map(hour => {
          const slotTasks = timed.filter(task => new Date(task.plannedStartAt).getHours() === hour);
          return <div key={hour} className="time-slot" onDragOver={event => event.preventDefault()} onDrop={event => onDrop(event.dataTransfer.getData("text/plain"), selectedDate)}><time>{String(hour).padStart(2, "0")}:00</time><div className="time-slot-line">{slotTasks.map(task => <div className="time-block" key={task.id}><button type="button" className="calendar-complete" onClick={() => onComplete(task)} aria-label={`Complete ${task.title}`}><Check size={12} /></button><span className="time-block-title">{task.title}</span><span>{shortTime(task.plannedStartAt)} · {shortTime(task.plannedEndAt)}</span><span className="time-block-resize"><button type="button" onClick={() => onResize(task, -15)} aria-label={`Shorten ${task.title} by 15 minutes`}>−15</button><button type="button" onClick={() => onResize(task, 15)} aria-label={`Extend ${task.title} by 15 minutes`}>+15</button></span></div>)}</div></div>;
        })}
        {!scheduled.length && guidanceDismissedFor !== selectedDate ? <div className="timeline-empty timeline-empty-guided"><div><strong>No time reserved yet</strong><p>Reserve time only for a task that benefits from a calendar commitment. Repeated habits belong in their own tracker and never use these time slots.</p></div><div className="timeline-empty-actions"><button type="button" onClick={onOpenTasks}>Choose a task to reserve time</button><button type="button" className="timeline-habit-link" onClick={onOpenHabits}>Open Habit tracker</button><button type="button" className="timeline-empty-dismiss" onClick={() => setGuidanceDismissedFor(selectedDate)}>Keep the day open</button></div></div> : null}{scheduleError ? <div className="timeline-feedback" role="alert"><span>{scheduleError} The task has not moved.</span><button type="button" onClick={onRetrySchedule}>Retry</button></div> : null}
      </div>
      <section className="calendar-unscheduled" aria-labelledby="unscheduled-work-heading"><div><h3 id="unscheduled-work-heading">Unscheduled work</h3><p>Drag a task to a day, or keep it here until a date is intentional.</p></div>{unscheduled.length ? <div>{unscheduled.map(task => <article key={task.id} draggable onDragStart={event => event.dataTransfer.setData("text/plain", task.id)}><span>{task.title}</span><small>{task.estimateMinutes ? `${task.estimateMinutes}m` : "Effort unknown"}</small></article>)}</div> : <p>Nothing is waiting without a Plan for date.</p>}</section>
    </section>
  );
}

const horizonOrder: Record<string, number> = { yearly: 0, quarterly: 1, monthly: 2 };
const nextActionCopy: Record<string, string> = {
  add_execution: "Connect a project, task, or habit that makes the outcome actionable.",
  add_milestone: "Add a dated monthly or quarterly checkpoint to make the runway visible.",
  review_plan: "Review the plan: pace, deadline, or review rhythm needs attention before the next commitment.",
  none: "The current evidence supports the next step. Keep the plan honest as conditions change.",
};

function GoalPlanningControl({ goals }: { goals: any[] }) {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState<"monthly" | "quarterly" | "yearly">("yearly");
  const [parentGoalId, setParentGoalId] = useState("none");
  const [dueLocalDate, setDueLocalDate] = useState("");
  const [startLocalDate, setStartLocalDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const createGoal = trpc.planner.goal.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); setOpen(false); setTitle(""); setHorizon("yearly"); setParentGoalId("none"); setDueLocalDate(""); setStartLocalDate(""); setFormError(null); }, onError: error => setFormError(error.message || "This goal could not be created. Review the plan and try again.") });
  const submit = (event: FormEvent) => { event.preventDefault(); const submittedTitle = (event.currentTarget.querySelector<HTMLInputElement>("#planning-goal-title")?.value ?? title).trim(); if (!submittedTitle) { setFormError("Name the measurable outcome before creating it."); return; } setFormError(null); createGoal.mutate({ ...scope, title: submittedTitle, parentGoalId: parentGoalId === "none" ? null : parentGoalId, startLocalDate: startLocalDate || null, dueLocalDate: dueLocalDate || null, state: "not_started", priority: "medium", horizon, progressMode: "task", progressValue: 0, targetValue: 100 }); };
  return <><button type="button" className="text-button" onClick={() => setOpen(true)}>Plan goal <Plus size={14} /></button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="composer-dialog"><DialogHeader><DialogTitle>Plan a long-horizon goal</DialogTitle><DialogDescription>{plannerObjectDefinitions.goal.description} Use a concrete time horizon and optional explicit parent; hierarchy is never inferred from similar names.</DialogDescription></DialogHeader><form className="composer-form" noValidate onSubmit={submit}><div className="field"><Label htmlFor="planning-goal-title">Goal</Label><Input id="planning-goal-title" autoFocus value={title} required onInvalid={() => setFormError("Name the measurable outcome before creating it.")} onChange={event => { setTitle(event.target.value); setFormError(null); }} placeholder="What meaningful outcome are you building?" /></div><div className="field-grid"><div className="field"><Label>Horizon</Label><Select value={horizon} onValueChange={value => setHorizon(value as "monthly" | "quarterly" | "yearly")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="yearly">Yearly direction</SelectItem><SelectItem value="quarterly">Quarterly outcome</SelectItem><SelectItem value="monthly">Monthly focus</SelectItem></SelectContent></Select></div><div className="field"><Label>Parent goal</Label><Select value={parentGoalId} onValueChange={setParentGoalId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No parent goal</SelectItem>{goals.map(goal => <SelectItem key={goal.id} value={goal.id}>{goal.title}</SelectItem>)}</SelectContent></Select></div></div><div className="field-grid"><div className="field"><Label htmlFor="planning-goal-start">Start date</Label><Input id="planning-goal-start" type="date" value={startLocalDate} onChange={event => setStartLocalDate(event.target.value)} /></div><div className="field"><Label htmlFor="planning-goal-due">Deadline</Label><Input id="planning-goal-due" type="date" value={dueLocalDate} onChange={event => { setDueLocalDate(event.target.value); setFormError(null); }} /><p className="field-guidance">The latest date this outcome should be achieved.</p></div></div><p className="recurrence-help">Pace is shown only if both dates are valid. Link a project, task, habit, or milestone afterward to make the outcome executable.</p>{formError ? <p className="form-error" role="alert">{formError}</p> : null}<div className="composer-submit"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" className="primary-action" disabled={createGoal.isPending}>{createGoal.isPending ? "Creating…" : "Create goal"}</Button></div></form></DialogContent></Dialog></>;
}

function HorizonCompass({ goals }: { goals: any[] }) {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => ({ start: shiftLocalDate(today, -31), end: shiftLocalDate(today, 62) }), [today]);
  const utils = trpc.useUtils();
  const snapshot = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range });
  const dashboard = trpc.planner.dashboard.useQuery({ ...scope, todayLocalDate: today, rangeStart: range.start, rangeEnd: range.end });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [goalId, setGoalId] = useState("");
  const [title, setTitle] = useState("");
  const [horizon, setHorizon] = useState<"monthly" | "quarterly">("monthly");
  const [dueLocalDate, setDueLocalDate] = useState("");
  const [progressValue, setProgressValue] = useState("0");
  const [targetValue, setTargetValue] = useState("100");
  const [cue, setCue] = useState("");
  const [response, setResponse] = useState("");
  const activeGoals = goals.filter(goal => goal.state !== "archived").sort((left, right) => (horizonOrder[left.horizon] ?? 9) - (horizonOrder[right.horizon] ?? 9));
  const healthByGoal = new Map((dashboard.data?.longHorizon ?? []).map((item: any) => [item.goalId, item]));
  const milestones = snapshot.data?.milestones ?? [];
  const reset = () => { setEditing(null); setTitle(""); setHorizon("monthly"); setDueLocalDate(""); setProgressValue("0"); setTargetValue("100"); setCue(""); setResponse(""); };
  const openMilestone = (forGoal: any, milestone?: any) => { setGoalId(forGoal.id); setEditing(milestone ?? null); setTitle(milestone?.title ?? ""); setHorizon(milestone?.horizon ?? "monthly"); setDueLocalDate(milestone?.dueLocalDate ?? ""); setProgressValue(String(milestone?.progressValue ?? 0)); setTargetValue(String(milestone?.targetValue ?? 100)); setCue(milestone?.cue ?? ""); setResponse(milestone?.response ?? ""); setOpen(true); };
  const refresh = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const create = trpc.planner.milestone.create.useMutation({ onSuccess: () => { refresh(); setOpen(false); reset(); } });
  const update = trpc.planner.milestone.update.useMutation({ onSuccess: () => { refresh(); setOpen(false); reset(); } });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!goalId || !title.trim()) return; const values = { title: title.trim(), horizon, dueLocalDate: dueLocalDate || null, progressValue: Math.max(0, Number(progressValue) || 0), targetValue: Math.max(1, Number(targetValue) || 100), cue: cue.trim() || null, response: response.trim() || null }; if (editing) update.mutate({ ...scope, id: editing.id, expectedVersion: editing.version, patch: values }); else create.mutate({ ...scope, goalId, ...values }); };
  if (!activeGoals.length) return null;
  return <section className="horizon-compass" aria-labelledby="horizon-heading"><div className="panel-heading"><div><span className="eyebrow">Decision analytics</span><h2 id="horizon-heading">Horizon compass</h2></div><span className="panel-count">Live planning evidence</span></div><p className="horizon-intro">Progress is attributed to a visible source; pace appears only when a valid start and due date exist. It is a planning cue, not a productivity score.</p><div className="horizon-grid">{activeGoals.map(goal => { const health = healthByGoal.get(goal.id); const goalMilestones = milestones.filter((milestone: any) => milestone.goalId === goal.id && milestone.state !== "archived"); const status = health?.isOverdue ? "overdue" : health?.paceStatus === "behind" ? "behind" : health?.paceStatus === "ahead" ? "ahead" : "on pace"; return <article className={cn("horizon-card", health?.isOverdue && "is-overdue", health?.paceStatus === "behind" && "is-behind")} key={goal.id}><div className="horizon-card-top"><span className="horizon-label">{goal.horizon || "long-term"}</span><span className="horizon-status">{status}</span></div><h3>{goal.title}</h3><div className="horizon-progress-row"><strong>{health?.progress ?? 0}%</strong><span>{health ? health.progressSource.replace("_", " ") : "calculating"}</span></div><Progress value={health?.progress ?? 0} className="goal-progress" /><dl className="horizon-facts"><div><dt>Expected</dt><dd>{health?.expectedProgress === null || health?.expectedProgress === undefined ? "Needs dates" : `${health.expectedProgress}%`}</dd></div><div><dt>Runway</dt><dd>{health?.daysUntilDue === null || health?.daysUntilDue === undefined ? "No due date" : health.daysUntilDue < 0 ? `${Math.abs(health.daysUntilDue)}d overdue` : `${health.daysUntilDue}d left`}</dd></div><div><dt>Evidence</dt><dd>{health ? `${health.activeTaskCount + health.activeProjectCount + health.activeHabitCount} linked` : "—"}</dd></div></dl><p className="horizon-next-action"><b>Next:</b> {nextActionCopy[health?.nextAction ?? "none"]}</p><div className="milestone-list">{goalMilestones.length ? goalMilestones.map((milestone: any) => <button type="button" key={milestone.id} onClick={() => openMilestone(goal, milestone)}><span>{milestone.title}</span><small>{milestone.horizon} · {milestone.dueLocalDate || "no due date"}</small></button>) : <p>No milestones yet.</p>}</div><button type="button" className="text-button" onClick={() => openMilestone(goal)}>Add milestone <Plus size={14} /></button></article>; })}</div><Dialog open={open} onOpenChange={value => { setOpen(value); if (!value) reset(); }}><DialogContent className="composer-dialog"><DialogHeader><DialogTitle>{editing ? "Refine milestone" : "Add milestone"}</DialogTitle><DialogDescription>Milestones are dated evidence for a monthly or quarterly outcome. If–then cues remain optional and user-authored.</DialogDescription></DialogHeader><form className="composer-form" onSubmit={submit}><div className="field"><Label>Goal</Label><Select value={goalId} onValueChange={setGoalId}><SelectTrigger><SelectValue placeholder="Choose a goal" /></SelectTrigger><SelectContent>{activeGoals.map(goal => <SelectItem value={goal.id} key={goal.id}>{goal.title}</SelectItem>)}</SelectContent></Select></div><div className="field"><Label htmlFor="milestone-title">Milestone</Label><Input id="milestone-title" value={title} onChange={event => setTitle(event.target.value)} placeholder="What proof belongs on the runway?" /></div><div className="field-grid"><div className="field"><Label>Horizon</Label><Select value={horizon} onValueChange={value => setHorizon(value as "monthly" | "quarterly")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="quarterly">Quarterly</SelectItem></SelectContent></Select></div><div className="field"><Label htmlFor="milestone-due">Due date</Label><Input id="milestone-due" type="date" value={dueLocalDate} onChange={event => setDueLocalDate(event.target.value)} /></div></div><div className="field-grid"><div className="field"><Label htmlFor="milestone-progress">Current value</Label><Input id="milestone-progress" type="number" min="0" value={progressValue} onChange={event => setProgressValue(event.target.value)} /></div><div className="field"><Label htmlFor="milestone-target">Target value</Label><Input id="milestone-target" type="number" min="1" value={targetValue} onChange={event => setTargetValue(event.target.value)} /></div></div><div className="field"><Label htmlFor="milestone-cue">If</Label><Input id="milestone-cue" value={cue} onChange={event => setCue(event.target.value)} placeholder="Optional situation or cue" /></div><div className="field"><Label htmlFor="milestone-response">Then</Label><Input id="milestone-response" value={response} onChange={event => setResponse(event.target.value)} placeholder="Optional response you choose" /></div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" className="primary-action" disabled={create.isPending || update.isPending}>{create.isPending || update.isPending ? "Saving…" : editing ? "Save milestone" : "Create milestone"}</Button></div></form></DialogContent></Dialog></section>;
}

function GoalPanel({ goals, projects, tasks, categories, onCompose }: { goals: any[]; projects: any[]; tasks: any[]; categories: any[]; onCompose: () => void }) {
  const categoryColors = new Map(categories.map(category => [category.id, category.color]));
  const activeGoals = goals.filter(goal => goal.state !== "archived");
  const progress = (goal: any) => {
    if (goal.progressMode === "manual" || goal.progressMode === "measure") return Math.round((goal.progressValue / Math.max(1, goal.targetValue)) * 100);
    const related = tasks.filter(task => task.goalId === goal.id || projects.find(project => project.id === task.projectId)?.goalId === goal.id);
    return related.length ? Math.round((related.filter(task => task.state === "completed").length / related.length) * 100) : 0;
  };
  return <section className="goal-panel" aria-labelledby="goals-heading"><div className="panel-heading"><div><span className="eyebrow">Longer horizon</span><h2 id="goals-heading">Goal runway</h2></div><GoalPlanningControl goals={activeGoals} /></div>{activeGoals.length ? <><div className="goal-list">{activeGoals.slice(0, 3).map(goal => { const value = progress(goal); return <div className="goal-line" key={goal.id}><div className="goal-line-top"><span className="category-dot" style={{ background: goal.color || categoryColors.get(goal.categoryId) || "#C6F06A" }} /><span>{goal.title}</span><strong>{value}%</strong></div><Progress value={value} className="goal-progress" /></div>; })}</div><HorizonCompass goals={activeGoals} /></> : <EmptyState title="Give today a destination" detail="A goal turns daily work into a visible direction." action={onCompose} />}</section>;
}

function HabitPanel({ habits, checkIns, today, streaks = [], onCheckIn, onClearCheckIn, onRetry, pending, error, onCompose }: { habits: any[]; checkIns: any[]; today: string; streaks?: { habitId: string; streak: number }[]; onCheckIn: (habitId: string, localDate: string, state: "completed" | "skipped") => void; onClearCheckIn: (habitId: string, localDate: string) => void; onRetry: () => void; pending: boolean; error: string | null; onCompose: () => void }) {
  const days = Array.from({ length: 7 }, (_, index) => shiftLocalDate(today, index - 6));
  const stateFor = (habitId: string, day: string) => checkIns.find(checkIn => checkIn.habitId === habitId && checkIn.localDate === day)?.state;
  const streakByHabit = new Map(streaks.map(item => [item.habitId, item.streak]));
  const visibleStreak = (habit: any) => {
    if (streakByHabit.has(habit.id)) return streakByHabit.get(habit.id) ?? 0;
    let cursor = today;
    let streak = 0;
    for (let guard = 0; guard < 730; guard += 1) {
      if (!isHabitScheduledOnLocalDate(habit, cursor)) { cursor = shiftLocalDate(cursor, -1); continue; }
      const state = stateFor(habit.id, cursor);
      if (state === "completed") { streak += 1; cursor = shiftLocalDate(cursor, -1); continue; }
      if (state === "skipped") { cursor = shiftLocalDate(cursor, -1); continue; }
      break;
    }
    return streak;
  };
  const activeHabits = habits.filter(habit => !habit.archivedAt);
  const todayHabits = activeHabits.filter(habit => isHabitScheduledOnLocalDate(habit, today));
  const completedToday = todayHabits.filter(habit => stateFor(habit.id, today) === "completed").length;
  const skippedToday = todayHabits.filter(habit => stateFor(habit.id, today) === "skipped").length;
  return <section className="habit-panel habit-rhythm-workspace" aria-labelledby="habits-heading"><div className="panel-heading"><div><h2 id="habits-heading">Habits</h2><p className="habit-route-intro">A dedicated rhythm tracker—separate from task time blocks.</p></div><button className="text-button" onClick={onCompose}>Add habit <Plus size={14} /></button></div>{activeHabits.length ? <><section className="habit-today-deck" aria-labelledby="habit-today-heading"><div className="habit-today-heading"><div><span>{displayLocalDate(today, "UTC", { weekday: "long", month: "short", day: "numeric" })}</span><h3 id="habit-today-heading">Your rhythm today</h3><p>{todayHabits.length ? completedToday === todayHabits.length ? "Everything scheduled today is complete." : `${completedToday} of ${todayHabits.length} habits complete${skippedToday ? ` · ${skippedToday} intentionally skipped` : ""}.` : "Nothing is scheduled today. Your rhythm has room to breathe."}</p></div><div className={cn("habit-today-status", completedToday === todayHabits.length && todayHabits.length > 0 && "is-complete")}><Check size={16} /><span>{completedToday}/{todayHabits.length || 0}</span></div></div>{todayHabits.length ? <div className="habit-today-list">{todayHabits.map(habit => { const todayState = stateFor(habit.id, today); const clear = todayState === "completed" || todayState === "skipped"; return <article className={cn("habit-today-row", todayState && `is-${todayState}`)} key={habit.id}><div className="habit-today-name"><i style={{ background: habit.color }} /><div><strong>{habit.name}</strong><span>{todayState === "completed" ? "Completed today" : todayState === "skipped" ? "Intentionally skipped" : `${visibleStreak(habit)} day rhythm`}</span></div></div><div className="habit-today-actions">{clear ? <button type="button" className="habit-today-undo" onClick={() => onClearCheckIn(habit.id, today)} disabled={pending}>Undo {todayState}</button> : <><button type="button" className="habit-today-complete" onClick={() => onCheckIn(habit.id, today, "completed")} disabled={pending}><Check size={15} /> Complete</button><button type="button" className="habit-today-skip" onClick={() => onCheckIn(habit.id, today, "skipped")} disabled={pending}>Skip</button></>}</div></article>; })}</div> : <p className="habit-today-rest">Use the calendar below to inspect the next scheduled day or add a new rhythm.</p>}</section><section className="habit-trace-section" aria-labelledby="habit-trace-heading"><div className="habit-trace-heading"><div><h3 id="habit-trace-heading">Seven-day trace</h3><p>History and continuity across your active rhythms.</p></div><span>Tap a past square to complete or undo</span></div><div className="habit-grid"><div className="habit-grid-days">{days.map(day => <span key={day}>{displayLocalDate(day, "UTC", { weekday: "narrow" })}</span>)}</div>{activeHabits.slice(0, 4).map(habit => { const todayScheduled = isHabitScheduledOnLocalDate(habit, today); const todayState = stateFor(habit.id, today); const isComplete = todayState === "completed"; return <div className="habit-line" key={habit.id}><span className="habit-name"><i style={{ background: habit.color }} />{habit.name}</span><span className="habit-streak">{visibleStreak(habit)}d</span><div className="habit-squares">{days.map(day => { const scheduled = isHabitScheduledOnLocalDate(habit, day); const state = stateFor(habit.id, day); const canEdit = scheduled && day <= today; const clear = state === "completed" || state === "skipped"; if (!scheduled) return <span key={day} className="habit-square is-unscheduled" aria-label={`${habit.name} is not scheduled on ${day}`} />; return <button key={day} type="button" className={cn("habit-square", state && `is-${state}`)} aria-label={`${clear ? "Clear" : "Complete"} ${habit.name} on ${day}`} aria-pressed={state === "completed"} onClick={() => clear ? onClearCheckIn(habit.id, day) : onCheckIn(habit.id, day, "completed")} disabled={!canEdit || pending}>{pending && day === today ? <Loader2 className="animate-spin" size={11} /> : state === "completed" ? <Check size={11} /> : state === "skipped" ? <X size={11} /> : null}</button>; })}</div><div className="habit-actions">{todayScheduled ? <><button type="button" className={cn("habit-primary-action", isComplete && "is-complete")} onClick={() => isComplete || todayState === "skipped" ? onClearCheckIn(habit.id, today) : onCheckIn(habit.id, today, "completed")} disabled={pending}>{pending ? "Saving…" : isComplete ? "Undo today" : todayState === "skipped" ? "Clear skip" : "Complete today"}</button>{!isComplete && todayState !== "skipped" ? <button type="button" className="habit-skip-action" onClick={() => onCheckIn(habit.id, today, "skipped")} disabled={pending}>Skip today</button> : null}</> : <span className="habit-rest-day">Not scheduled today</span>}</div></div>; })}</div></section></> : <EmptyState title="Build a rhythm, not a streak" detail="Track habits with intentional skips and a visible history." action={onCompose} />}{error ? <div className="habit-feedback" role="alert"><span>{error} Your previous record has not been changed.</span><button type="button" onClick={onRetry} disabled={pending}>Retry</button></div> : <p className="habit-feedback" role="status">Scheduled past and current days can be completed or undone. A skip is intentional and does not break a streak.</p>}</section>;
}

function HabitCalendarTracker({ habits, checkIns, today, onCheckIn, onClearCheckIn, pending, onCompose = () => window.dispatchEvent(new Event("personal-calander:compose-habit")) }: { habits: any[]; checkIns: any[]; today: string; onCheckIn: (habitId: string, localDate: string, state: "completed" | "skipped") => void; onClearCheckIn: (habitId: string, localDate: string) => void; pending: boolean; onCompose?: () => void }) {
  const [anchor, setAnchor] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const dates = useMemo(() => Array.from({ length: 28 }, (_, index) => shiftLocalDate(anchor, index - 27)), [anchor]);
  const selectedHabits = habits.filter(habit => !habit.archivedAt && isHabitScheduledOnLocalDate(habit, selectedDate));
  const stateFor = (habitId: string, localDate: string) => checkIns.find(checkIn => checkIn.habitId === habitId && checkIn.localDate === localDate)?.state;
  const activeHabits = habits.filter(habit => !habit.archivedAt);
  return <section className="habit-calendar-tracker" aria-labelledby="habit-calendar-heading"><div className="panel-heading"><div><span className="eyebrow">Habit tracker</span><h2 id="habit-calendar-heading">Your habit calendar</h2></div><div className="habit-calendar-pager"><button type="button" aria-label="Previous four weeks" onClick={() => setAnchor(date => shiftLocalDate(date, -28))}><ChevronLeft size={16} /></button><span>{displayLocalDate(anchor, "UTC", { month: "short", year: "numeric" })}</span><button type="button" aria-label="Next four weeks" onClick={() => setAnchor(date => shiftLocalDate(date, 28))} disabled={anchor >= today}><ChevronRight size={16} /></button></div></div><p className="habit-calendar-copy">Choose a day to review its scheduled habits. The main Calendar remains reserved for tasks and time blocks.</p>{activeHabits.length ? <><div className="habit-calendar-weekdays">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <span key={`${day}-${index}`}>{day}</span>)}</div><div className="habit-calendar-grid">{dates.map(date => { const scheduled = activeHabits.filter(habit => isHabitScheduledOnLocalDate(habit, date)); const completed = scheduled.filter(habit => stateFor(habit.id, date) === "completed").length; const skipped = scheduled.filter(habit => stateFor(habit.id, date) === "skipped").length; return <button type="button" key={date} className={cn("habit-calendar-day", date === selectedDate && "is-selected", date === today && "is-today", date > today && "is-future")} onClick={() => setSelectedDate(date)} aria-pressed={date === selectedDate}><time>{date.slice(-2)}</time>{scheduled.length ? <span className="habit-calendar-status"><b>{completed}</b>/{scheduled.length}{skipped ? <i>·{skipped} skip</i> : null}</span> : <span className="habit-calendar-status is-empty">—</span>}</button>; })}</div><div className="habit-day-detail"><div><span>{displayLocalDate(selectedDate, "UTC", { weekday: "long", month: "long", day: "numeric" })}</span><p>{selectedDate > today ? "Future habits are visible for planning but cannot be checked in yet." : selectedHabits.length ? "Complete, deliberately skip, or undo the scheduled habits for this date." : "No habits are scheduled for this date."}</p></div>{selectedHabits.length ? <div className="habit-day-actions">{selectedHabits.map(habit => { const state = stateFor(habit.id, selectedDate); const clear = state === "completed" || state === "skipped"; return <div key={habit.id}><span><i style={{ background: habit.color }} />{habit.name}</span>{clear ? <button type="button" onClick={() => onClearCheckIn(habit.id, selectedDate)} disabled={pending || selectedDate > today}>Undo {state}</button> : <><button type="button" className="habit-complete-button" onClick={() => onCheckIn(habit.id, selectedDate, "completed")} disabled={pending || selectedDate > today}>Complete</button><button type="button" onClick={() => onCheckIn(habit.id, selectedDate, "skipped")} disabled={pending || selectedDate > today}>Skip</button></>}</div>; })}</div> : null}</div></> : <EmptyState title="Add a habit to start the calendar" detail="Your habit tracker will show scheduled check-ins without filling the main task calendar." action={onCompose} actionLabel="Create habit" />}</section>;
}

function AnalyticsPanel({ dashboard, categories }: { dashboard: any; categories: any[] }) {
  const distribution = (dashboard?.categoryDistribution ?? []).filter((item: any) => item.count > 0).map((item: any) => ({ ...item, color: categories.find(category => category.id === item.id)?.color ?? "#C6F06A" }));
  return <section className="analytics-panel" aria-labelledby="insight-heading"><div className="panel-heading"><div><span className="eyebrow">Observed pattern</span><h2 id="insight-heading">Momentum</h2></div><span className="panel-count">Past 28 days</span></div><div className="analytics-grid"><div className="trend-chart"><p className="chart-label">Completions</p>{dashboard?.completionTrend?.some((point: any) => point.completed) ? <ResponsiveContainer width="100%" height={126}><AreaChart data={dashboard.completionTrend}><defs><linearGradient id="completionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C6F06A" stopOpacity={0.35} /><stop offset="100%" stopColor="#C6F06A" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(245,245,239,0.08)" /><XAxis dataKey="localDate" tickFormatter={(value: string) => value.slice(5)} tickLine={false} axisLine={false} tick={{ fill: "#6F766E", fontSize: 10 }} interval="preserveStartEnd" /><YAxis hide /><ChartTooltip contentStyle={{ background: "#191D1A", border: "1px solid rgba(245,245,239,0.12)", borderRadius: 10 }} labelStyle={{ color: "#D9DCD4" }} itemStyle={{ color: "#C6F06A" }} /><Area type="monotone" dataKey="completed" stroke="#C6F06A" strokeWidth={2} fill="url(#completionFill)" /></AreaChart></ResponsiveContainer> : <div className="chart-zero"><CircleDot size={18} /> Complete tasks to reveal your pace.</div>}</div><div className="distribution-chart"><p className="chart-label">Category load</p>{distribution.length ? <ResponsiveContainer width="100%" height={126}><BarChart data={distribution} layout="vertical" margin={{ left: 0, right: 8 }}><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={72} tick={{ fill: "#9AA198", fontSize: 11 }} tickLine={false} axisLine={false} /><ChartTooltip contentStyle={{ background: "#191D1A", border: "1px solid rgba(245,245,239,0.12)", borderRadius: 10 }} cursor={{ fill: "rgba(245,245,239,0.05)" }} /><Bar dataKey="count" fill="#7DB8E0" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer> : <div className="chart-zero"><Target size={18} /> Categories will reveal balance.</div>}</div></div></section>;
}

function FullComposer({ open, kind, categories, goals = [], onOpenChange, onKindChange, onCreate, onManageCategories }: { open: boolean; kind: ComposerKind; categories: any[]; goals?: any[]; onOpenChange: (open: boolean) => void; onKindChange: (kind: ComposerKind) => void; onCreate: (values: { title: string; categoryId: string | null; goalId: string | null; parentGoalId: string | null; goalHorizon: "monthly" | "quarterly" | "yearly"; dueLocalDate: string | null; scheduledLocalDate: string | null; plannedStartAt: Date | null; plannedEndAt: Date | null; estimateMinutes: number | null; recurrenceRule: Record<string, unknown> | null; recurrenceUntilLocalDate: string | null; habitFrequency: "daily" | "days_of_week" | "interval" | null; habitSchedule: Record<string, unknown> | null }) => Promise<void>; onManageCategories: () => void }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("none");
  const [dueLocalDate, setDueLocalDate] = useState("");
  const [scheduledLocalDate, setScheduledLocalDate] = useState("");
  const [reservedStart, setReservedStart] = useState("");
  const [reservedEnd, setReservedEnd] = useState("");
  const [estimate, setEstimate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState("1");
  const [recurrenceUntilLocalDate, setRecurrenceUntilLocalDate] = useState("");
  const [habitFrequency, setHabitFrequency] = useState<"daily" | "days_of_week" | "interval">("daily");
  const [habitWeekdays, setHabitWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [habitIntervalDays, setHabitIntervalDays] = useState("2");
  const [habitAnchorLocalDate, setHabitAnchorLocalDate] = useState("");
  const [goalId, setGoalId] = useState("none");
  const [parentGoalId, setParentGoalId] = useState("none");
  const [goalHorizon, setGoalHorizon] = useState<"monthly" | "quarterly" | "yearly">("yearly");
  const label = { task: "Task", goal: "Goal", project: "Project", habit: "Habit" }[kind];
  const toggleHabitWeekday = (weekday: number) => setHabitWeekdays(current => current.includes(weekday) ? current.filter(value => value !== weekday) : [...current, weekday].sort((left, right) => left - right));
  const submit = async (event: FormEvent) => { event.preventDefault(); const submittedTitle = (event.currentTarget.querySelector<HTMLInputElement>("#composer-title")?.value ?? title).trim(); if (!submittedTitle) { setFormError(`Name this ${label.toLowerCase()} before creating it.`); return; } const reservationError = kind === "task" ? validateTimeReservation(reservedStart || null, reservedEnd || null) : null; if (reservationError) { setFormError(reservationError); return; } setFormError(null); setIsCreating(true); const recurrenceRule = kind === "task" && recurrenceFrequency !== "none" ? { frequency: recurrenceFrequency, interval: Math.max(1, Number(recurrenceInterval) || 1) } : null; const habitSchedule = kind !== "habit" ? null : habitFrequency === "daily" ? { cadence: "daily" } : habitFrequency === "days_of_week" ? { weekdays: habitWeekdays.length ? habitWeekdays : [1, 2, 3, 4, 5] } : { intervalDays: Math.max(1, Number(habitIntervalDays) || 1), ...(habitAnchorLocalDate ? { startLocalDate: habitAnchorLocalDate } : {}) }; try { await onCreate({ title: submittedTitle, categoryId: categoryId === "none" ? null : categoryId, goalId: goalId === "none" ? null : goalId, parentGoalId: parentGoalId === "none" ? null : parentGoalId, goalHorizon, dueLocalDate: dueLocalDate || null, scheduledLocalDate: localDateForReservation(reservedStart) ?? (scheduledLocalDate || null), plannedStartAt: reservedStart ? new Date(reservedStart) : null, plannedEndAt: reservedEnd ? new Date(reservedEnd) : null, estimateMinutes: estimate ? Number(estimate) : null, recurrenceRule, recurrenceUntilLocalDate: recurrenceRule ? recurrenceUntilLocalDate || null : null, habitFrequency: kind === "habit" ? habitFrequency : null, habitSchedule }); setTitle(""); setDueLocalDate(""); setScheduledLocalDate(""); setReservedStart(""); setReservedEnd(""); setEstimate(""); setGoalId("none"); setParentGoalId("none"); setGoalHorizon("yearly"); setRecurrenceFrequency("none"); setRecurrenceInterval("1"); setRecurrenceUntilLocalDate(""); setHabitFrequency("daily"); setHabitWeekdays([1, 2, 3, 4, 5]); setHabitIntervalDays("2"); setHabitAnchorLocalDate(""); onOpenChange(false); } catch (error) { setFormError(error instanceof Error ? error.message : `This ${label.toLowerCase()} could not be created. Review the details and try again.`); } finally { setIsCreating(false); } };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="composer-dialog"><DialogHeader><DialogTitle>Shape a new {label.toLowerCase()}</DialogTitle><DialogDescription>{plannerObjectDefinitions[kind].description}</DialogDescription></DialogHeader><form noValidate onSubmit={submit} className="composer-form"><div className="composer-kind">{(["task", "goal", "project", "habit"] as ComposerKind[]).map(item => <button type="button" className={cn(item === kind && "is-active")} onClick={() => { onKindChange(item); setFormError(null); }} key={item} aria-label={`Create ${plannerObjectDefinitions[item].label}: ${plannerObjectDefinitions[item].short}`}><b>{plannerObjectDefinitions[item].label}</b><span>{plannerObjectDefinitions[item].short}</span></button>)}</div><div className="composer-object-definition"><strong>{plannerObjectDefinitions[kind].short}</strong><span>{kind === "habit" ? "Cadence and completion live in the dedicated Habit tracker." : kind === "task" ? "Dates guide planning; only Reserve time places work on the Calendar." : kind === "project" ? "Link it to the goal it advances after creation." : "Set a horizon and deadline so progress can be measured."}</span></div><div className="field"><Label htmlFor="composer-title">Name</Label><Input id="composer-title" autoFocus value={title} required onInvalid={() => setFormError(`Name this ${label.toLowerCase()} before creating it.`)} onChange={event => { setTitle(event.target.value); setFormError(null); }} placeholder={kind === "habit" ? "Read for 20 minutes" : kind === "goal" ? "Build a sustainable routine" : "What needs attention?"} /></div>{kind !== "habit" ? <div className="field-grid"><div className="field"><Label htmlFor="composer-date">{taskSchedulingLanguage.deadline.label}</Label><Input id="composer-date" type="date" value={dueLocalDate} onChange={event => { setDueLocalDate(event.target.value); setFormError(null); }} /><p className="field-guidance">{taskSchedulingLanguage.deadline.help}</p></div>{kind === "task" ? <div className="field"><Label htmlFor="composer-estimate">{taskSchedulingLanguage.focusTime.label}</Label><Input id="composer-estimate" type="number" min="0" max="1440" value={estimate} onChange={event => { setEstimate(event.target.value); setFormError(null); }} placeholder="Minutes" /><p className="field-guidance">{taskSchedulingLanguage.focusTime.help}</p></div> : null}</div> : null}{kind === "task" ? <><div className="field"><Label htmlFor="composer-plan-for">{taskSchedulingLanguage.planFor.label}</Label><Input id="composer-plan-for" type="date" value={scheduledLocalDate} onChange={event => { setScheduledLocalDate(event.target.value); setFormError(null); }} /><p className="field-guidance">{taskSchedulingLanguage.planFor.help}</p></div><fieldset className="time-reservation-fields"><legend>{taskSchedulingLanguage.reserveTime.label}</legend><p>{taskSchedulingLanguage.reserveTime.help}</p><div className="field-grid"><div className="field"><Label htmlFor="composer-reserve-start">Start</Label><Input id="composer-reserve-start" type="datetime-local" value={reservedStart} onChange={event => { setReservedStart(event.target.value); const planned = localDateForReservation(event.target.value); if (planned) setScheduledLocalDate(planned); setFormError(null); }} /></div><div className="field"><Label htmlFor="composer-reserve-end">End</Label><Input id="composer-reserve-end" type="datetime-local" value={reservedEnd} onChange={event => { setReservedEnd(event.target.value); setFormError(null); }} /></div></div></fieldset></> : null}{formError ? <p className="form-error" role="alert">{formError}</p> : null}{kind === "task" ? <div className="recurrence-fields"><div className="field"><Label>Repeat</Label><Select value={recurrenceFrequency} onValueChange={setRecurrenceFrequency}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Does not repeat</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent></Select></div>{recurrenceFrequency !== "none" ? <><div className="field"><Label htmlFor="composer-recurrence-interval">Every</Label><Input id="composer-recurrence-interval" type="number" min="1" max="365" value={recurrenceInterval} onChange={event => setRecurrenceInterval(event.target.value)} /></div><div className="field"><Label htmlFor="composer-recurrence-until">Stop after</Label><Input id="composer-recurrence-until" type="date" value={recurrenceUntilLocalDate} onChange={event => setRecurrenceUntilLocalDate(event.target.value)} /></div><p className="recurrence-help">The series follows this task’s due date; a planned date takes precedence when one is set.</p></> : null}</div> : null}{kind === "habit" ? <div className="habit-schedule-fields"><div className="field"><Label>Planned rhythm</Label><Select value={habitFrequency} onValueChange={value => { const next = value as "daily" | "days_of_week" | "interval"; setHabitFrequency(next); if (next === "days_of_week" && habitWeekdays.length === 0) setHabitWeekdays([1, 2, 3, 4, 5]); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Every day</SelectItem><SelectItem value="days_of_week">Selected weekdays</SelectItem><SelectItem value="interval">Every N days</SelectItem></SelectContent></Select></div>{habitFrequency === "days_of_week" ? <div className="field"><Label>Scheduled days</Label><div className="weekday-picker" aria-label="Scheduled weekdays">{[[0, "Sun"], [1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"]].map(([weekday, weekdayLabel]) => <button key={String(weekday)} type="button" className={cn(habitWeekdays.includes(weekday as number) && "is-selected")} aria-pressed={habitWeekdays.includes(weekday as number)} onClick={() => toggleHabitWeekday(weekday as number)}>{weekdayLabel}</button>)}</div><p className="recurrence-help">Choose the specific days this habit should appear in its dedicated tracker.</p></div> : null}{habitFrequency === "interval" ? <div className="field-grid"><div className="field"><Label htmlFor="habit-interval-days">Every</Label><Input id="habit-interval-days" type="number" min="1" max="365" value={habitIntervalDays} onChange={event => setHabitIntervalDays(event.target.value)} /></div><div className="field"><Label htmlFor="habit-start-date">Starting on</Label><Input id="habit-start-date" type="date" value={habitAnchorLocalDate} onChange={event => setHabitAnchorLocalDate(event.target.value)} /></div></div> : null}</div> : null}<div className="field"><div className="field-label-row"><Label>Category</Label><button type="button" className="field-inline-action" onClick={onManageCategories}>New category</button></div><Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue placeholder="No category" /></SelectTrigger><SelectContent><SelectItem value="none">No category</SelectItem>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div><div className="composer-submit"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-action" disabled={isCreating}>{isCreating ? "Creating…" : `Create ${label}`}</Button></div></form></DialogContent></Dialog>;
}

function Composer({ open, kind, categories: _categories, goals = [], onOpenChange, onKindChange, onCreate, onManageCategories: _onManageCategories }: { open: boolean; kind: ComposerKind; categories: any[]; goals?: any[]; onOpenChange: (open: boolean) => void; onKindChange: (kind: ComposerKind) => void; onCreate: (values: any) => Promise<void>; onManageCategories: () => void }) {
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const projectWorkspace = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...isoRange(today) }, { enabled: open && kind === "project" });
  const projectGoals = projectWorkspace.data?.goals ?? goals;
  const [title, setTitle] = useState("");
  const [dueLocalDate, setDueLocalDate] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState("");
  const [goalId, setGoalId] = useState("none");
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const label = plannerObjectDefinitions[kind].label;
  const reset = () => { setTitle(""); setDueLocalDate(""); setEstimateMinutes(""); setGoalId("none"); setFormError(null); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name) { setFormError(`Name this ${label.toLowerCase()} before creating it.`); return; }
    setFormError(null); setIsCreating(true);
    try {
      await onCreate({ title: name, categoryId: null, goalId: kind === "project" && goalId !== "none" ? goalId : null, parentGoalId: null, goalHorizon: "yearly", dueLocalDate: dueLocalDate || null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, estimateMinutes: kind === "task" && estimateMinutes ? Number(estimateMinutes) : null, recurrenceRule: null, recurrenceUntilLocalDate: null, habitFrequency: kind === "habit" ? "daily" : null, habitSchedule: kind === "habit" ? { cadence: "daily" } : null });
      reset(); onOpenChange(false);
    } catch (error) { setFormError(error instanceof Error ? error.message : `This ${label.toLowerCase()} could not be created. Review the details and try again.`); }
    finally { setIsCreating(false); }
  };
  return <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) reset(); onOpenChange(nextOpen); }}><DialogContent className="composer-dialog quick-create-dialog"><DialogHeader><DialogTitle>Add a {label.toLowerCase()}</DialogTitle><DialogDescription>{plannerObjectDefinitions[kind].description}</DialogDescription></DialogHeader><form noValidate onSubmit={submit} className="composer-form quick-create-form"><div className="composer-kind">{(["task", "goal", "project", "habit"] as ComposerKind[]).map(item => <button type="button" className={cn(item === kind && "is-active")} onClick={() => { onKindChange(item); setFormError(null); }} key={item} aria-label={`Create ${plannerObjectDefinitions[item].label}: ${plannerObjectDefinitions[item].short}`}><b>{plannerObjectDefinitions[item].label}</b><span>{plannerObjectDefinitions[item].short}</span></button>)}</div><div className="quick-create-intent"><strong>{kind === "task" ? "One actionable commitment" : plannerObjectDefinitions[kind].short}</strong><span>{kind === "task" ? "Start small. You can plan a date, reserve time, repeat it, or categorize it after creation." : kind === "project" ? "Choose a goal only when this project clearly advances it." : kind === "habit" ? "This starts as a daily rhythm in the dedicated Habit tracker." : "A deadline remains optional until the outcome needs one."}</span></div><div className="field"><Label htmlFor="quick-create-title">Name</Label><Input id="quick-create-title" autoFocus value={title} onChange={event => { setTitle(event.target.value); setFormError(null); }} placeholder={kind === "task" ? "What needs attention?" : kind === "goal" ? "What outcome are you building?" : kind === "project" ? "What finite work advances it?" : "What repeated behavior matters?"} /></div>{kind !== "habit" ? <div className="field-grid"><div className="field"><Label htmlFor="quick-create-deadline">Deadline</Label><Input id="quick-create-deadline" type="date" value={dueLocalDate} onChange={event => setDueLocalDate(event.target.value)} /><p className="field-guidance">The latest date this should be finished.</p></div>{kind === "task" ? <div className="field"><Label htmlFor="quick-create-estimate">Focus time needed</Label><Input id="quick-create-estimate" type="number" min="0" max="1440" value={estimateMinutes} onChange={event => setEstimateMinutes(event.target.value)} placeholder="Minutes" /><p className="field-guidance">Optional, but makes capacity useful.</p></div> : null}</div> : null}{kind === "project" ? <div className="field"><Label>Goal this project advances</Label><Select value={goalId} onValueChange={setGoalId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No linked goal yet</SelectItem>{projectGoals.map(goal => <SelectItem key={goal.id} value={goal.id}>{goal.title}</SelectItem>)}</SelectContent></Select><p className="field-guidance">Create it first, then use Break down to add reviewed linked tasks.</p></div> : null}{kind === "habit" ? <p className="quick-create-habit-note">Daily is selected for this first habit. The Habit tracker owns check-ins, skips, and its separate calendar.</p> : null}{formError ? <p className="form-error" role="alert">{formError}</p> : null}<div className="composer-submit"><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" className="primary-action" disabled={isCreating}>{isCreating ? "Creating…" : `Create ${label}`}</Button></div></form></DialogContent></Dialog>;
}

function CategoryManagerRow({ category, onUpdate, onDelete, busy }: { category: any; onUpdate: (category: any, patch: { name: string; color: string }) => void; onDelete: (category: any) => void; busy: boolean }) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  useEffect(() => { setName(category.name); setColor(category.color); }, [category]);
  const changed = name.trim() !== category.name || color !== category.color;
  return <li className="category-manager-row"><input type="color" value={color} onChange={event => setColor(event.target.value)} aria-label={`Color for ${category.name}`} /><Input value={name} onChange={event => setName(event.target.value)} aria-label={`Name for ${category.name}`} maxLength={80} /><Button type="button" variant="ghost" disabled={!changed || busy || !name.trim()} onClick={() => onUpdate(category, { name: name.trim(), color })}>Save</Button><Button type="button" variant="ghost" className="danger-action" disabled={busy} onClick={() => onDelete(category)}>Remove</Button></li>;
}

function CategoryDialog({ open, onOpenChange, categories }: { open: boolean; onOpenChange: (open: boolean) => void; categories: any[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7DB8E0");
  const scope = useMemo(() => getWorkspaceScope(), []);
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => ({ start: shiftLocalDate(today, -31), end: shiftLocalDate(today, 31) }), [today]);
  const utils = trpc.useUtils();
  const refresh = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const workspace = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range }, { enabled: open });
  const create = trpc.planner.category.create.useMutation({ onSuccess: () => { setName(""); refresh(); } });
  const update = trpc.planner.category.update.useMutation({ onSuccess: refresh });
  const remove = trpc.planner.category.delete.useMutation({ onSuccess: refresh });
  const archiveTask = trpc.planner.task.update.useMutation({ onSuccess: refresh });
  const archiveGoal = trpc.planner.goal.archive.useMutation({ onSuccess: refresh });
  const archiveProject = trpc.planner.project.archive.useMutation({ onSuccess: refresh });
  const archiveHabit = trpc.planner.habit.archive.useMutation({ onSuccess: refresh });
  const restoreTask = trpc.planner.task.update.useMutation({ onSuccess: () => { toast.success("Task restored to To do."); refresh(); }, onError: error => toast.error(error.message || "This task could not be restored. Refresh and try again.") });
  const restoreGoal = trpc.planner.goal.restore.useMutation({ onSuccess: () => { toast.success("Goal restored to active planning."); refresh(); }, onError: error => toast.error(error.message || "This goal could not be restored. Refresh and try again.") });
  const restoreProject = trpc.planner.project.restore.useMutation({ onSuccess: () => { toast.success("Project restored to active planning."); refresh(); }, onError: error => toast.error(error.message || "This project could not be restored. Refresh and try again.") });
  const restoreHabit = trpc.planner.habit.restore.useMutation({ onSuccess: () => { toast.success("Habit restored to active tracking."); refresh(); }, onError: error => toast.error(error.message || "This habit could not be restored. Refresh and try again.") });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!name.trim()) return; create.mutate({ ...scope, name: name.trim(), color, sortOrder: categories.length }); };
  const deleteCategory = (category: any) => { if (window.confirm(`Remove “${category.name}”? Existing tasks, goals, projects, and habits will keep their history but lose this category label.`)) remove.mutate({ ...scope, id: category.id, expectedVersion: category.version }); };
  const busy = create.isPending || update.isPending || remove.isPending || archiveTask.isPending || archiveGoal.isPending || archiveProject.isPending || archiveHabit.isPending || restoreTask.isPending || restoreGoal.isPending || restoreProject.isPending || restoreHabit.isPending;
  const archive = (type: "task" | "goal" | "project" | "habit", item: any) => { if (!window.confirm(`Archive “${item.title ?? item.name}”? It will leave active planning but its history will be kept.`)) return; if (type === "task") archiveTask.mutate({ ...scope, id: item.id, expectedVersion: item.version, patch: { state: "archived" } }); if (type === "goal") archiveGoal.mutate({ ...scope, id: item.id, expectedVersion: item.version }); if (type === "project") archiveProject.mutate({ ...scope, id: item.id, expectedVersion: item.version }); if (type === "habit") archiveHabit.mutate({ ...scope, id: item.id, expectedVersion: item.version }); };
  const restore = (type: "task" | "goal" | "project" | "habit", item: any) => { if (type === "task") restoreTask.mutate({ ...scope, id: item.id, expectedVersion: item.version, patch: { state: "not_started" } }); if (type === "goal") restoreGoal.mutate({ ...scope, id: item.id, expectedVersion: item.version }); if (type === "project") restoreProject.mutate({ ...scope, id: item.id, expectedVersion: item.version }); if (type === "habit") restoreHabit.mutate({ ...scope, id: item.id, expectedVersion: item.version }); };
  const activeItems = [
    ...(workspace.data?.tasks ?? []).filter(item => item.state !== "archived").map(item => ({ type: "task" as const, item, label: item.title })),
    ...(workspace.data?.goals ?? []).filter(item => item.state !== "archived").map(item => ({ type: "goal" as const, item, label: item.title })),
    ...(workspace.data?.projects ?? []).filter(item => item.state !== "archived").map(item => ({ type: "project" as const, item, label: item.title })),
    ...(workspace.data?.habits ?? []).filter(item => !item.archivedAt).map(item => ({ type: "habit" as const, item, label: item.name })),
  ].sort((left, right) => left.label.localeCompare(right.label));
  const archivedItems = [
    ...(workspace.data?.tasks ?? []).filter(item => item.state === "archived").map(item => ({ type: "task" as const, item, label: item.title })),
    ...(workspace.data?.goals ?? []).filter(item => item.state === "archived").map(item => ({ type: "goal" as const, item, label: item.title })),
    ...(workspace.data?.projects ?? []).filter(item => item.state === "archived").map(item => ({ type: "project" as const, item, label: item.title })),
    ...(workspace.data?.habits ?? []).filter(item => Boolean(item.archivedAt)).map(item => ({ type: "habit" as const, item, label: item.name })),
  ].sort((left, right) => left.label.localeCompare(right.label));
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="composer-dialog category-manager-dialog"><DialogHeader><DialogTitle>Organize planning</DialogTitle><DialogDescription>Categories organize work by color. Removing a category detaches its label; archiving an item removes it from active planning while keeping history.</DialogDescription></DialogHeader><form className="composer-form category-create-form" onSubmit={submit}><div className="field"><Label htmlFor="category-name">New category</Label><Input id="category-name" autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Deep work" maxLength={80} /></div><div className="field"><Label htmlFor="category-color">Color signal</Label><div className="color-input-wrap"><input id="category-color" type="color" value={color} onChange={event => setColor(event.target.value)} /><code>{color.toUpperCase()}</code></div></div><Button type="submit" className="primary-action" disabled={busy || !name.trim()}>Add category</Button></form><div className="category-manager-list"><span>Current categories</span>{categories.length ? <ul>{categories.map(category => <CategoryManagerRow key={category.id} category={category} busy={busy} onUpdate={(current, patch) => update.mutate({ ...scope, id: current.id, expectedVersion: current.version, patch })} onDelete={deleteCategory} />)}</ul> : <p>No categories yet. Add one above, then apply it from any creation form.</p>}</div><div className="lifecycle-manager"><span>Archive active workspace items</span><p>Use archive for cleanup. It is safer than permanent deletion and preserves completed work, check-ins, and review history.</p>{workspace.isLoading ? <p>Loading active items…</p> : activeItems.length ? <ul>{activeItems.map(({ type, item, label }) => <li key={`${type}-${item.id}`}><span><small>{type}</small>{label}</span><Button type="button" variant="ghost" className="danger-action" disabled={busy} onClick={() => archive(type, item)}>Archive</Button></li>)}</ul> : <p>No active workspace items are available to archive.</p>}</div><div className="lifecycle-manager lifecycle-recovery"><span>Restore archived work</span><p>Restore puts a record back into active planning as unfinished work. It does not erase task, check-in, or review history.</p>{workspace.isLoading ? <p>Loading archived items…</p> : archivedItems.length ? <ul>{archivedItems.map(({ type, item, label }) => <li key={`${type}-${item.id}`}><span><small>{type}</small>{label}</span><Button type="button" variant="ghost" disabled={busy} onClick={() => restore(type, item)}>Restore</Button></li>)}</ul> : <p>No archived work needs recovery.</p>}</div></DialogContent></Dialog>;
}

function AICompanion() {
  const [scope] = useState<WorkspaceScope>(() => getWorkspaceScope());
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const [thought, setThought] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const draft = trpc.planner.ai.draft.useMutation();
  const createTask = trpc.planner.task.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); setThought(""); setConfirmError(null); draft.reset(); }, onError: error => setConfirmError(error.message || "The task could not be added. Check the draft and try again.") });
  const createGoal = trpc.planner.goal.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); setThought(""); setConfirmError(null); draft.reset(); }, onError: error => setConfirmError(error.message || "The goal could not be added. Check the draft and try again.") });
  const requestDraft = () => {
    const value = thought.trim();
    if (value.length < 3) { setInputError("Write at least three characters so the companion has something to shape."); return; }
    setInputError(null);
    setConfirmError(null);
    draft.reset();
    draft.mutate({ ...scope, todayLocalDate: today, thought: value });
  };
  const confirm = () => {
    if (!draft.data) return;
    setConfirmError(null);
    if (draft.data.kind === "task") createTask.mutate({ ...scope, title: draft.data.title, dueLocalDate: draft.data.suggestedDueLocalDate, state: "not_started", priority: draft.data.priority, horizon: draft.data.horizon, sortOrder: 0 });
    else createGoal.mutate({ ...scope, title: draft.data.title, dueLocalDate: draft.data.suggestedDueLocalDate, state: "not_started", priority: draft.data.priority, horizon: draft.data.horizon, progressMode: "task", progressValue: 0, targetValue: 100 });
  };
  return <details className="ai-companion"><summary><span><Sparkles size={14} /> Optional companion</span><small>Turn a note into a reviewable draft</small></summary><div className="ai-companion-body" aria-labelledby="ai-heading"><div><h3 id="ai-heading">Give a loose thought a shape.</h3><p>Nothing enters your plan until you review and confirm the proposed draft.</p></div><form onSubmit={event => { event.preventDefault(); requestDraft(); }}><Input value={thought} onChange={event => { setThought(event.target.value); if (inputError) setInputError(null); }} placeholder="I keep postponing the budget review…" aria-label="Describe a planning thought for a draft" aria-describedby="ai-companion-help" minLength={3} maxLength={4000} /><Button type="submit" className="primary-action" disabled={draft.isPending || thought.trim().length < 3}>{draft.isPending ? <><Loader2 className="animate-spin" size={15} /> Thinking</> : <>Make a draft <Sparkles size={15} /></>}</Button></form><p id="ai-companion-help" className="ai-companion-help">Write a note, then review the draft before anything is added.</p>{inputError ? <p className="ai-error" role="alert">{inputError}</p> : null}{draft.error ? <div className="ai-error" role="alert"><p>{draft.error.message || "The draft request did not finish."}</p><Button type="button" variant="ghost" onClick={requestDraft}>Try again</Button></div> : null}{confirmError ? <p className="ai-error" role="alert">{confirmError}</p> : null}{draft.data ? <div className="ai-draft"><div><span className="ai-draft-type">{draft.data.source === "fallback" ? "Safe starting draft" : `Proposed ${draft.data.kind}`}</span><h3>{draft.data.title}</h3><p>{draft.data.summary}</p><small>{draft.data.priority} priority · {draft.data.horizon} horizon{draft.data.suggestedDueLocalDate ? ` · ${draft.data.suggestedDueLocalDate}` : ""}</small>{draft.data.source === "fallback" ? <p className="ai-fallback-note">The model did not return a usable draft, so this starting point uses your note directly. You can confirm it, discard it, or try the model again.</p> : null}</div><div className="ai-draft-actions"><Button variant="ghost" onClick={() => { draft.reset(); setConfirmError(null); }}>Discard</Button>{draft.data.source === "fallback" ? <Button variant="ghost" onClick={requestDraft} disabled={draft.isPending}>Try model again</Button> : null}<Button className="primary-action" onClick={confirm} disabled={createTask.isPending || createGoal.isPending}>{createTask.isPending || createGoal.isPending ? "Adding…" : "Confirm draft"}</Button></div></div> : null}</div></details>;
}

export default function Home() {
  const [scope] = useState<WorkspaceScope>(() => getWorkspaceScope());
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const [selectedDate, setSelectedDate] = useState(today);
  const [surface, setSurface] = useState<Surface>(() => { const requested = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("surface"); return mobilePlannerDestinations.some(destination => destination.id === requested) ? requested as Surface : "today"; });
  const [workspaceSearchQuery, setWorkspaceSearchQuery] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("q") ?? "");
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("Day");
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerKind, setComposerKind] = useState<ComposerKind>("task");
  const [breakdownProject, setBreakdownProject] = useState<any | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [offlineCaptureCount, setOfflineCaptureCount] = useState(() => capturesForWorkspace(scope.workspaceId).length);
  const [taskSearch, setTaskSearch] = useState(() => typeof window === "undefined" ? "" : taskBoardViewFromSearch(window.location.search).query);
  const [taskFilter, setTaskFilter] = useState<TaskBoardFilter>(() => typeof window === "undefined" ? "all" : taskBoardViewFromSearch(window.location.search).filter);
  const [optimisticTaskStates, setOptimisticTaskStates] = useState<Record<string, string>>({});
  const workspaceEnsured = useRef(false);
  const utils = trpc.useUtils();
  const range = useMemo(() => isoRange(today), [today]);
  const snapshotQuery = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range }, { refetchInterval: 30_000 });
  const dashboardQuery = trpc.planner.dashboard.useQuery({ ...scope, todayLocalDate: today, rangeStart: range.start, rangeEnd: range.end }, { refetchInterval: 30_000 });
  const ensureWorkspace = trpc.planner.workspace.ensure.useMutation();
  const createTask = trpc.planner.task.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const updateTask = trpc.planner.task.update.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const bulkSetTaskState = trpc.planner.task.bulkSetState.useMutation();
  const createGoal = trpc.planner.goal.create.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  const createProject = trpc.planner.project.create.useMutation({ onSuccess: () => utils.planner.workspace.snapshot.invalidate() });
  const createHabit = trpc.planner.habit.create.useMutation({ onSuccess: () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); } });
  const [habitActionError, setHabitActionError] = useState<string | null>(null);
  const [calendarActionError, setCalendarActionError] = useState<string | null>(null);
  const [lastCalendarMove, setLastCalendarMove] = useState<{ id: string; date: string } | null>(null);
  const [lastHabitAction, setLastHabitAction] = useState<{ kind: "checkIn"; habitId: string; localDate: string; state: "completed" | "skipped" } | { kind: "clear"; habitId: string; localDate: string } | null>(null);
  const refreshHabitData = async () => { setHabitActionError(null); setLastHabitAction(null); await Promise.all([utils.planner.workspace.snapshot.invalidate(), utils.planner.dashboard.invalidate()]); };
  const habitCheckIn = trpc.planner.habit.checkIn.useMutation({ onSuccess: refreshHabitData, onError: error => setHabitActionError(error.message) });
  const clearHabitCheckIn = trpc.planner.habit.clearCheckIn.useMutation({ onSuccess: refreshHabitData, onError: error => setHabitActionError(error.message) });

  useEffect(() => {
    if (workspaceEnsured.current) return;
    workspaceEnsured.current = true;
    ensureWorkspace.mutate(scope);
  }, [scope]);

  const snapshot = snapshotQuery.data ? { ...snapshotQuery.data, projects: snapshotQuery.data.projects.filter(project => project.state !== "archived"), habitCheckIn: snapshotQuery.data.habitCheckIns } : snapshotQuery.data;
  const activeTasks = useMemo(() => (snapshot?.tasks ?? []).map(task => optimisticTaskStates[task.id] ? { ...task, state: optimisticTaskStates[task.id] } : task).filter(task => task.state !== "archived"), [snapshot?.tasks, optimisticTaskStates]);
  const archivedTasks = useMemo(() => (snapshot?.tasks ?? []).filter(task => task.state === "archived"), [snapshot?.tasks]);
  const focusTasks = useMemo(() => activeTasks.filter(task => task.scheduledLocalDate === today || task.dueLocalDate === today).sort((a, b) => (a.state === "completed" ? 1 : 0) - (b.state === "completed" ? 1 : 0)), [activeTasks, today]);
  const taskRows = useMemo(() => activeTasks.filter(task => { const matchesText = task.title.toLowerCase().includes(taskSearch.toLowerCase()); const matchesFilter = taskFilter === "all" || (taskFilter === "today" && (task.scheduledLocalDate === today || task.dueLocalDate === today)) || (taskFilter === "deadline_risk" && deadlineRiskForTask(task, today) !== null); return matchesText && matchesFilter; }), [activeTasks, taskSearch, taskFilter, today]);
  const openComposer = (kind: ComposerKind) => { setComposerKind(kind); setComposerOpen(true); };
  useEffect(() => {
    const composeHabit = () => openComposer("habit");
    const openHabitTracker = () => { setSurface("habits"); setMobileMoreOpen(false); };
    window.addEventListener("personal-calander:compose-habit", composeHabit);
    window.addEventListener("personal-calander:open-habits", openHabitTracker);
    return () => { window.removeEventListener("personal-calander:compose-habit", composeHabit); window.removeEventListener("personal-calander:open-habits", openHabitTracker); };
  }, []);
  const selectSurface = (nextSurface: Surface) => { setSurface(nextSurface); setMobileMoreOpen(false); if (typeof window !== "undefined") { const url = new URL(window.location.href); url.searchParams.set("surface", nextSurface); window.history.replaceState(null, "", url); } };
  const updateWorkspaceSearchQuery = useCallback((query: string) => { setWorkspaceSearchQuery(query); if (typeof window !== "undefined") { const url = new URL(window.location.href); if (query) url.searchParams.set("q", query); else url.searchParams.delete("q"); window.history.replaceState(null, "", url); } }, []);
  const openSearchEntity = (entity: "task" | "goal" | "project" | "habit" | "review") => selectSurface(entity === "task" ? "tasks" : entity === "goal" ? "goals" : entity === "project" ? "projects" : entity === "habit" ? "habits" : "review");
  const updateTaskBoardUrl = useCallback((view: { query: string; filter: TaskBoardFilter }) => { if (typeof window !== "undefined") { const url = new URL(window.location.href); url.search = searchWithTaskBoardView(url.search, view); window.history.replaceState(null, "", url); } }, []);
  const updateTaskSearch = (query: string) => { setTaskSearch(query); updateTaskBoardUrl({ query, filter: taskFilter }); };
  const updateTaskFilter = (filter: TaskBoardFilter) => { setTaskFilter(filter); updateTaskBoardUrl({ query: taskSearch, filter }); };
  const focusTaskSearch = () => { selectSurface("tasks"); window.setTimeout(() => document.querySelector<HTMLInputElement>("[data-task-search]")?.focus(), 0); };
  const focusDeadlineRisk = () => { updateTaskSearch(""); updateTaskFilter("deadline_risk"); selectSurface("tasks"); };
  const invalidatePlan = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const refreshOfflineCaptureCount = useCallback(() => { setOfflineCaptureCount(capturesForWorkspace(scope.workspaceId).length); announceOfflineCaptureChange(); }, [scope.workspaceId]);
  const replayOfflineCaptures = useCallback(async () => {
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const captures = capturesForWorkspace(scope.workspaceId);
    if (!captures.length) return;
    let synced = 0;
    for (const capture of captures) {
      try {
        await createTask.mutateAsync({ workspaceId: capture.workspaceId, timezone: capture.timezone, title: capture.title, scheduledLocalDate: capture.scheduledLocalDate, state: "not_started", priority: "medium", horizon: "daily", sortOrder: 0, clientRequestId: capture.id });
        removeOfflineTaskCapture(capture.id);
        synced += 1;
      } catch (error) {
        if (!isRetryableCaptureError(error)) toast.error("A saved capture needs attention. Reopen it online and add it from the task composer.");
        break;
      }
    }
    refreshOfflineCaptureCount();
    if (synced) {
      toast.success(`${synced} saved capture${synced === 1 ? "" : "s"} added to Today.`);
      invalidatePlan();
    }
  }, [createTask, invalidatePlan, refreshOfflineCaptureCount, scope.workspaceId]);
  useEffect(() => {
    void replayOfflineCaptures();
    const onOnline = () => { void replayOfflineCaptures(); };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [replayOfflineCaptures]);
  const recordHabitCheckIn = (habitId: string, localDate: string, state: "completed" | "skipped") => { setHabitActionError(null); setLastHabitAction({ kind: "checkIn", habitId, localDate, state }); habitCheckIn.mutate({ ...scope, habitId, localDate, state }); };
  const undoHabitCheckIn = (habitId: string, localDate: string) => { setHabitActionError(null); setLastHabitAction({ kind: "clear", habitId, localDate }); clearHabitCheckIn.mutate({ ...scope, habitId, localDate }); };
  const retryHabitAction = () => { if (!lastHabitAction) return; if (lastHabitAction.kind === "checkIn") recordHabitCheckIn(lastHabitAction.habitId, lastHabitAction.localDate, lastHabitAction.state); else undoHabitCheckIn(lastHabitAction.habitId, lastHabitAction.localDate); };
  const moveTaskToLane = (task: any, lane: TaskBoardLaneId) => {
    const nextState = stateForTaskLane(lane);
    if (task.state === nextState) return;
    setOptimisticTaskStates(current => ({ ...current, [task.id]: nextState }));
    void updateTask.mutateAsync({ ...scope, id: task.id, expectedVersion: task.version, patch: { state: nextState } })
      .then(updated => {
        utils.planner.workspace.snapshot.setData({ ...scope, ...range }, current => current ? { ...current, tasks: current.tasks.map(item => item.id === task.id ? { ...item, ...updated } : item) } : current);
        setOptimisticTaskStates(current => { const { [task.id]: _, ...remaining } = current; return remaining; });
        utils.planner.dashboard.invalidate();
        toast.success(`${task.title} moved to ${taskBoardLanes.find(item => item.id === lane)?.label}.`);
      })
      .catch(error => {
        setOptimisticTaskStates(current => { const { [task.id]: _, ...remaining } = current; return remaining; });
        toast.error(error instanceof Error ? error.message : "This task could not be moved. The board was restored; try again.");
      });
  };
  const toggleTask = (task: any) => { void moveTaskToLane(task, task.state === "completed" ? "todo" : "completed"); };
  const archiveCompletedTasks = async (tasksToArchive: any[]) => {
    const batches = Array.from({ length: Math.ceil(tasksToArchive.length / 100) }, (_, index) => tasksToArchive.slice(index * 100, (index + 1) * 100));
    try {
      for (const batch of batches) await bulkSetTaskState.mutateAsync({ ...scope, ids: batch.map(task => task.id), state: "archived" });
      toast.success(`${tasksToArchive.length} completed task${tasksToArchive.length === 1 ? "" : "s"} archived. Restore them anytime from Archived work.`);
      invalidatePlan();
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The completed tasks were not all archived. Refresh the board and try again.");
      return false;
    }
  };
  const restoreArchivedTask = (task: any) => updateTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { state: "not_started" } }, { onSuccess: () => toast.success(`${task.title} restored to To do.`), onError: error => toast.error(error.message || "This archived task could not be restored. Refresh and try again.") });
  const scheduleTask = (id: string, date: string) => { const task = activeTasks.find(item => item.id === id); if (!task) return; setCalendarActionError(null); setLastCalendarMove({ id, date }); updateTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { scheduledLocalDate: date } }, { onSuccess: () => toast.success(`${task.title} planned for ${date}.`), onError: error => setCalendarActionError(error.message || "This task could not be planned on the calendar.") }); };
  const resizeTaskReservation = (task: any, minutes: number) => { if (!task.plannedStartAt || !task.plannedEndAt) return; const start = new Date(task.plannedStartAt); const end = new Date(task.plannedEndAt); const nextEnd = new Date(end.getTime() + minutes * 60_000); const nextDuration = Math.round((nextEnd.getTime() - start.getTime()) / 60_000); if (nextDuration < 5 || nextDuration > 1_440) { setCalendarActionError("Keep a reserved block between 5 minutes and one day. The task has not changed."); return; } setCalendarActionError(null); updateTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { plannedEndAt: nextEnd, estimateMinutes: nextDuration } }, { onSuccess: () => toast.success(`${task.title} now reserves ${nextDuration} minutes.`), onError: error => setCalendarActionError(error.message || "This reservation could not be resized. Refresh and try again.") }); };
  const retryCalendarMove = () => { if (lastCalendarMove) scheduleTask(lastCalendarMove.id, lastCalendarMove.date); };
  const createQuickTask = (event: FormEvent) => {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title || createTask.isPending) return;
    const capture = createOfflineTaskCapture({ workspaceId: scope.workspaceId, timezone: scope.timezone, title, scheduledLocalDate: today });
    setQuickTitle("");
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (queueOfflineTaskCapture(capture)) { refreshOfflineCaptureCount(); toast.message("Saved on this device. It will be added to Today when you are online."); }
      else toast.error("This device could not save the capture locally. Reconnect and try again.");
      return;
    }
    void createTask.mutateAsync({ ...scope, title, scheduledLocalDate: today, state: "not_started", priority: "medium", horizon: "daily", sortOrder: 0, clientRequestId: capture.id })
      .then(() => toast.success("Added to Today."))
      .catch(error => {
        if (isRetryableCaptureError(error) && queueOfflineTaskCapture(capture)) { refreshOfflineCaptureCount(); toast.message("Saved on this device. It will retry when you are online."); return; }
        toast.error(error instanceof Error ? error.message : "This capture could not be saved. Try again when connected.");
      });
  };
  const createFromComposer = async (values: { title: string; categoryId: string | null; goalId: string | null; parentGoalId: string | null; goalHorizon: "monthly" | "quarterly" | "yearly"; dueLocalDate: string | null; scheduledLocalDate: string | null; plannedStartAt: Date | null; plannedEndAt: Date | null; estimateMinutes: number | null; recurrenceRule: Record<string, unknown> | null; recurrenceUntilLocalDate: string | null; habitFrequency: "daily" | "days_of_week" | "interval" | null; habitSchedule: Record<string, unknown> | null }) => {
    if (composerKind === "task") await createTask.mutateAsync({ ...scope, title: values.title, categoryId: values.categoryId, goalId: values.goalId, dueLocalDate: values.dueLocalDate, scheduledLocalDate: values.scheduledLocalDate, plannedStartAt: values.plannedStartAt, plannedEndAt: values.plannedEndAt, estimateMinutes: values.estimateMinutes, state: "not_started", priority: "medium", horizon: "weekly", sortOrder: 0, recurrenceRule: values.recurrenceRule, recurrenceAnchor: values.recurrenceRule ? "scheduled" : null, recurrenceUntilLocalDate: values.recurrenceUntilLocalDate });
    if (composerKind === "goal") await createGoal.mutateAsync({ ...scope, title: values.title, categoryId: values.categoryId, parentGoalId: values.parentGoalId, dueLocalDate: values.dueLocalDate, state: "not_started", priority: "medium", horizon: values.goalHorizon, progressMode: "task", progressValue: 0, targetValue: 100 });
    if (composerKind === "project") await createProject.mutateAsync({ ...scope, title: values.title, categoryId: values.categoryId, goalId: values.goalId, dueLocalDate: values.dueLocalDate, state: "not_started", priority: "medium", horizon: "quarterly" });
    if (composerKind === "habit") await createHabit.mutateAsync({ ...scope, name: values.title, categoryId: values.categoryId, goalId: values.goalId, color: "#C6F06A", frequency: values.habitFrequency ?? "daily", schedule: values.habitSchedule ?? { cadence: "daily" } });
  };
  const createProjectBreakdown = async (project: any, drafts: ProjectBreakdownDraft[]) => {
    let created = 0;
    try {
      for (const draft of drafts) {
        await createTask.mutateAsync({ ...scope, title: draft.title.trim(), projectId: project.id, goalId: project.goalId ?? null, scheduledLocalDate: draft.scheduledLocalDate || null, estimateMinutes: draft.estimateMinutes ? Number(draft.estimateMinutes) : null, state: "not_started", priority: "medium", horizon: "weekly", sortOrder: 0, clientRequestId: draft.requestId });
        created += 1;
      }
      toast.success(`${created} linked task${created === 1 ? "" : "s"} added to ${project.title}.`);
      invalidatePlan();
    } catch (error) {
      throw new Error(`${created} of ${drafts.length} linked tasks were created. Retry safely to add the remaining rows without duplicates.`);
    }
  };

  if (snapshotQuery.isLoading || !snapshot) return <LoadingBoard />;
  if (snapshotQuery.error) return <div className="planner-error"><div><p className="eyebrow">Connection interrupted</p><h1>Planning data could not load.</h1><p>{snapshotQuery.error.message}</p><Button onClick={() => snapshotQuery.refetch()}>Try again</Button></div></div>;

  const surfaceTitle = surface === "today" ? "Today" : navItems.find(item => item.id === surface)?.label ?? "Planner";
  const modeCopy: Record<CalendarMode, string> = { Day: "Make one focused day believable.", Week: "Balance commitments across the week.", Month: "Keep due work and milestones in view.", Quarter: "Review active projects and runway.", Year: "Connect annual direction to current work." };

  const habitPending = habitCheckIn.isPending || clearHabitCheckIn.isPending;
  const mobileNavItem = (id: Surface) => navItems.find(item => item.id === id)!;
  const moreIsActive = mobileMorePlannerDestinations.some(item => item.id === surface);
  return <div className="planner-shell"><aside className="planner-rail"><div className="brand-lockup"><span className="brand-mark"><span /></span><span>Personal<br /><b>Calendar</b></span></div><nav aria-label="Planning views" className="planner-nav">{navItems.map(item => <button key={item.id} className={cn(surface === item.id && "is-active")} onClick={() => selectSurface(item.id)}><item.icon size={18} strokeWidth={1.75} /><span>{item.label}</span>{item.id === "today" && focusTasks.filter(task => task.state !== "completed").length ? <i>{focusTasks.filter(task => task.state !== "completed").length}</i> : null}</button>)}</nav><nav aria-label="Phone planning views" className="mobile-planner-nav">{mobilePrimaryPlannerDestinations.map(destination => { const item = mobileNavItem(destination.id); return <button key={item.id} className={cn(surface === item.id && "is-active")} onClick={() => selectSurface(item.id)}><item.icon size={20} strokeWidth={1.8} /><span>{item.label}</span>{item.id === "today" && focusTasks.filter(task => task.state !== "completed").length ? <i>{focusTasks.filter(task => task.state !== "completed").length}</i> : null}</button>; })}<button className={cn((moreIsActive || mobileMoreOpen) && "is-active")} aria-controls="mobile-more-sheet" aria-expanded={mobileMoreOpen} onClick={() => setMobileMoreOpen(open => !open)}><MoreHorizontal size={21} strokeWidth={1.8} /><span>More</span></button></nav>{mobileMoreOpen ? <div className="mobile-more-layer"><button className="mobile-more-scrim" aria-label="Close More planning menu" onClick={() => setMobileMoreOpen(false)} /><section id="mobile-more-sheet" className="mobile-more-sheet" aria-label="More planning views"><div className="mobile-more-handle" aria-hidden="true" /><div className="mobile-more-heading"><div><span>More planning</span><p>Keep your rhythm and reflect on the work.</p></div><button className="icon-quiet" aria-label="Close More planning menu" onClick={() => setMobileMoreOpen(false)}><X size={20} /></button></div><div className="mobile-more-destinations">{mobileMorePlannerDestinations.map(destination => { const item = mobileNavItem(destination.id); return <button key={item.id} className={cn(surface === item.id && "is-active")} onClick={() => selectSurface(item.id)}><item.icon size={21} strokeWidth={1.8} /><span><b>{item.label}</b><small>{item.id === "habits" ? "Track daily rhythm" : item.id === "goals" ? "Link work to outcomes" : item.id === "projects" ? "Sequence finite work" : item.id === "focus" ? "Protect attention" : item.id === "capture" ? "Review a parsed thought" : item.id === "connections" ? "Read calendar availability" : item.id === "search" ? "Find planning records" : item.id === "insights" ? "Read planning evidence" : "Close the week deliberately"}</small></span><ChevronRight size={18} /></button>; })}</div><div className="mobile-more-utility"><button type="button" onClick={() => { setCategoryDialogOpen(true); setMobileMoreOpen(false); }}><CircleDot size={18} /><span>Manage categories</span><ChevronRight size={18} /></button></div></section></div> : null}<div className="rail-footer"><div className="workspace-pill"><span className="workspace-avatar">P</span><div><strong>Personal space</strong><small>{scope.timezone.replace("_", " ")}</small></div></div></div></aside><main className="planner-main"><header className="planner-topbar"><div><p className="top-date">{displayLocalDate(today, scope.timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</p><h1>{surfaceTitle}</h1></div><form className="quick-capture" onSubmit={createQuickTask}><Plus size={19} /><Input value={quickTitle} onChange={event => setQuickTitle(event.target.value)} placeholder="Capture a task for today…" aria-label="Quickly capture a task" /><kbd>↵</kbd></form><div className="top-actions"><Tooltip><TooltipTrigger asChild><button className="icon-quiet" aria-label="Search workspace" onClick={() => selectSurface("search")}><Search size={19} /></button></TooltipTrigger><TooltipContent>Search tasks</TooltipContent></Tooltip><Button type="button" variant="ghost" onClick={() => setCategoryDialogOpen(true)}>Categories</Button><Button className="primary-action" onClick={() => openComposer("task")}><Plus size={18} /> New</Button></div></header>{surface === "today" ? <div className="today-canvas"><div className="today-columns"><FocusPanel tasks={focusTasks} categories={snapshot.categories} onToggle={toggleTask} onCompose={() => openComposer("task")} /><Timeline tasks={activeTasks} selectedDate={selectedDate} onMoveDay={amount => setSelectedDate(date => shiftLocalDate(date, amount))} onDrop={scheduleTask} onOpenTasks={focusTaskSearch} onComplete={toggleTask} onResize={resizeTaskReservation} scheduleError={calendarActionError} onRetrySchedule={retryCalendarMove} /></div><div className="lower-columns"><GoalPanel goals={snapshot.goals} projects={snapshot.projects} tasks={snapshot.tasks} categories={snapshot.categories} onCompose={() => openComposer("goal")} /><HabitPanel habits={snapshot.habits} checkIns={snapshot.habitCheckIns} today={today} streaks={dashboardQuery.data?.streaks} onCheckIn={recordHabitCheckIn} onClearCheckIn={undoHabitCheckIn} onRetry={retryHabitAction} pending={habitPending} error={habitActionError} onCompose={() => openComposer("habit")} /></div><DailyCapacityForecast workload={dashboardQuery.data?.workload} onOpenDeadlineRisk={focusDeadlineRisk} /><AnalyticsPanel dashboard={dashboardQuery.data} categories={snapshot.categories} /></div> : null}{surface === "plan" ? <PlanWorkspace scope={scope} today={today} snapshot={snapshot} dashboard={dashboardQuery.data} onOpenTasks={focusTaskSearch} onOpenGoals={() => selectSurface("goals")} /> : null}{surface === "capture" ? <NaturalLanguageCaptureWorkspace scope={scope} today={today} snapshot={snapshot} /> : null}{surface === "search" ? <WorkspaceSearchWorkspace scope={scope} initialQuery={workspaceSearchQuery} onQueryChange={updateWorkspaceSearchQuery} onOpenEntity={openSearchEntity} /> : null}{surface === "tasks" ? <section className="work-surface task-board-surface"><div className="surface-toolbar"><div className="task-search"><Search size={17} /><Input data-task-search value={taskSearch} onChange={event => updateTaskSearch(event.target.value)} placeholder="Search your plan" /></div><div className="filter-group"><button className={cn(taskFilter === "all" && "is-active")} onClick={() => updateTaskFilter("all")}>All</button><button className={cn(taskFilter === "today" && "is-active")} onClick={() => updateTaskFilter("today")}>Today</button><button className={cn(taskFilter === "deadline_risk" && "is-active")} onClick={() => updateTaskFilter("deadline_risk")}>Deadline risk</button></div></div><TaskBoard tasks={taskRows} categories={snapshot.categories} onToggle={toggleTask} onMove={moveTaskToLane} onCompose={() => openComposer("task")} onArchiveCompleted={archiveCompletedTasks} isSearching={Boolean(taskSearch.trim())} /><TaskArchivePanel tasks={archivedTasks} query={taskSearch} onRestore={restoreArchivedTask} /></section> : null}{surface === "calendar" ? <section className="calendar-surface"><div className="calendar-toolbar"><div className="calendar-mode-tabs">{(["Day", "Week", "Month", "Quarter", "Year"] as CalendarMode[]).map(mode => <button key={mode} className={cn(calendarMode === mode && "is-active")} onClick={() => setCalendarMode(mode)}>{mode}</button>)}</div><p>{modeCopy[calendarMode]}</p></div>{calendarMode === "Day" ? <Timeline tasks={activeTasks} selectedDate={selectedDate} onMoveDay={amount => setSelectedDate(date => shiftLocalDate(date, amount))} onDrop={scheduleTask} onOpenTasks={focusTaskSearch} onComplete={toggleTask} onResize={resizeTaskReservation} scheduleError={calendarActionError} onRetrySchedule={retryCalendarMove} /> : <CalendarMatrix mode={calendarMode} anchor={selectedDate} tasks={activeTasks} categories={snapshot.categories} today={today} onMoveDay={amount => setSelectedDate(date => shiftLocalDate(date, amount))} onOpenTasks={focusTaskSearch} />}</section> : null}{surface === "goals" ? <section className="work-surface goal-workspace"><GoalPanel goals={snapshot.goals} projects={snapshot.projects} tasks={snapshot.tasks} categories={snapshot.categories} onCompose={() => openComposer("goal")} /><div className="project-listing"><div className="panel-heading"><div><span className="eyebrow">Finite bodies of work</span><h2>Projects</h2></div><button className="text-button" onClick={() => openComposer("project")}>New project <Plus size={14} /></button></div>{snapshot.projects.length ? snapshot.projects.map(project => <div className="project-row" key={project.id}><div><strong>{project.title}</strong><span>{project.horizon} horizon{project.dueLocalDate ? ` · due ${project.dueLocalDate}` : ""}</span></div><div className="project-row-actions"><button type="button" className="text-button" onClick={() => setBreakdownProject(project)}>Break down</button><span className={cn("state-pill", `state-${project.state}`)}>{project.state.replace("_", " ")}</span></div></div>) : <EmptyState title="Projects make goals executable" detail="Create a finite project and connect daily work to it." action={() => openComposer("project")} />}</div></section> : null}{surface === "projects" ? <ProjectExecutionWorkspace scope={scope} snapshot={snapshot} onOpenTasks={focusTaskSearch} /> : null}{surface === "habits" ? <section className="work-surface habit-workspace"><HabitPanel habits={snapshot.habits} checkIns={snapshot.habitCheckIn} today={today} streaks={dashboardQuery.data?.streaks} onCheckIn={recordHabitCheckIn} onClearCheckIn={undoHabitCheckIn} onRetry={retryHabitAction} pending={habitPending} error={habitActionError} onCompose={() => openComposer("habit")} /><HabitCalendarTracker habits={snapshot.habits} checkIns={snapshot.habitCheckIn} today={today} onCheckIn={recordHabitCheckIn} onClearCheckIn={undoHabitCheckIn} pending={habitPending} /><HabitDisciplineWorkspace scope={scope} habits={snapshot.habits} checkIns={snapshot.habitCheckIns} today={today} onCheckIn={recordHabitCheckIn} onClearCheckIn={undoHabitCheckIn} pending={habitPending} /><AnalyticsPanel dashboard={dashboardQuery.data} categories={snapshot.categories} /></section> : null}{surface === "focus" ? <FocusWorkspace scope={scope} snapshot={snapshot} today={today} /> : null}{surface === "connections" ? <CalendarIntegrationWorkspace snapshot={snapshot} /> : null}{surface === "insights" ? <PlanningInsightsWorkspace dashboard={dashboardQuery.data} onOpenPlan={() => selectSurface("plan")} onOpenReview={() => selectSurface("review")} /> : null}{surface === "review" ? <section className="review-surface"><div className="review-intro"><span className="eyebrow">Weekly review</span><h2>Close the loop before you open a new one.</h2><p>Separate facts from judgement: complete or classify the recurring work that is due, then write the one adjustment that deserves next week.</p><Button className="primary-action" onClick={() => selectSurface("today")}>Return to today</Button></div><div className="review-workbench"><ReviewRitual sessions={snapshot.reviewSessions} /><OccurrencePanel /><PlanningHealthStrip /><DecisionSignals /></div></section> : null}</main><Composer open={composerOpen} kind={composerKind} categories={snapshot.categories} onOpenChange={setComposerOpen} onKindChange={setComposerKind} onCreate={createFromComposer} onManageCategories={() => setCategoryDialogOpen(true)} /><ProjectBreakdownDialog project={breakdownProject} onOpenChange={open => { if (!open) setBreakdownProject(null); }} onCreate={createProjectBreakdown} /><CategoryDialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen} categories={snapshot.categories} /></div>;
}

function CalendarMatrix({ mode, anchor, tasks, categories, today, onMoveDay, onOpenTasks }: { mode: CalendarMode; anchor: string; tasks: any[]; categories: any[]; today: string; onMoveDay: (amount: number) => void; onOpenTasks: () => void }) {
  const categoryColors = new Map(categories.map(category => [category.id, category.color]));
  const scope = useMemo(() => getWorkspaceScope(), []);
  const utils = trpc.useUtils();
  const slots = mode === "Week" ? 7 : mode === "Month" ? 35 : mode === "Quarter" ? 12 : 12;
  const step = mode === "Week" ? 1 : mode === "Month" ? 1 : mode === "Quarter" ? 7 : 30;
  const start = shiftLocalDate(anchor, mode === "Month" ? -14 : mode === "Week" ? -3 : -Math.floor(slots / 2) * step);
  const dates = Array.from({ length: slots }, (_, index) => shiftLocalDate(start, index * step));
  const refresh = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const updateTask = trpc.planner.task.update.useMutation({ onSuccess: refresh });
  const scheduleFromDrop = (taskId: string, localDate: string) => { const task = tasks.find(item => item.id === taskId); if (task) updateTask.mutate({ ...scope, id: task.id, expectedVersion: task.version, patch: { scheduledLocalDate: localDate } }); };
  return <div className={cn("calendar-matrix", `matrix-${mode.toLowerCase()}`)}>
    <div className="matrix-header"><button onClick={() => onMoveDay(-slots * step)} aria-label="Previous calendar period"><ChevronLeft size={17} /></button><strong>{mode === "Year" ? anchor.slice(0, 4) : displayLocalDate(anchor, scope.timezone, { month: "long", year: "numeric" })}</strong><button onClick={() => onMoveDay(slots * step)} aria-label="Next calendar period"><ChevronRight size={17} /></button></div>
    <div className="calendar-task-legend"><span>Tasks and time blocks live here. Repeated habits have a separate tracker and calendar.</span><button type="button" onClick={() => window.dispatchEvent(new Event("personal-calander:open-habits"))}>Open Habit tracker</button></div>
    <div className="matrix-grid">{dates.map(date => {
      const scheduledItems = tasks.filter(task => task.scheduledLocalDate === date || task.dueLocalDate === date);
      const items = scheduledItems.slice(0, 3);
      const hiddenCount = scheduledItems.length - items.length;
      return <article key={date} className={cn("matrix-cell", date === today && "is-today")} onDragOver={event => event.preventDefault()} onDrop={event => scheduleFromDrop(event.dataTransfer.getData("text/plain"), date)}>
        <time>{mode === "Quarter" || mode === "Year" ? displayLocalDate(date, scope.timezone, { month: "short", year: mode === "Year" ? "2-digit" : undefined }) : displayLocalDate(date, scope.timezone, { weekday: mode === "Week" ? "short" : undefined, month: "short", day: "numeric" })}</time>
        {items.map(task => <div className="matrix-task" key={task.id}><i style={{ background: categoryColors.get(task.categoryId) ?? "#C6F06A" }} />{task.title}</div>)}
        {hiddenCount > 0 ? <button type="button" className="matrix-overflow" onClick={onOpenTasks} aria-label={`Open Tasks and search to review ${hiddenCount} more task${hiddenCount === 1 ? "" : "s"} on ${date}`}>View {hiddenCount} more in Tasks</button> : null}
        {items.length === 0 ? <span className="matrix-empty">—</span> : null}
      </article>;
    })}</div>
  </div>;
}
