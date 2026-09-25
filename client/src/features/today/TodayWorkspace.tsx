import { Button } from "@/components/ui/button";
import { TaskDetailSheet, type TaskMutationResult } from "@/features/tasks/TaskDetailSheet";
import type { CanonicalTask } from "@shared/canonicalTask";
import type { TodayProjection } from "@shared/todayProjection";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  Check,
  Clock3,
  ListChecks,
  Play,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { TodayFlexibleWork } from "./TodayFlexibleWork";
import { TodayHabits } from "./TodayHabits";
import { TodayTimeline } from "./TodayTimeline";
import "./today-workspace.css";

export type TodayHeaderAction =
  | { id: "resolve_recovery"; label: "Resolve remaining work" }
  | { id: "plan_today"; label: "Plan today" }
  | { id: "start_focus"; label: "Start focus" };

export function contextualTodayAction(input: {
  recoveryCount: number;
  hasActivePlan: boolean;
  selectedTaskId: string | null;
}): TodayHeaderAction | null {
  if (input.recoveryCount > 0) return { id: "resolve_recovery", label: "Resolve remaining work" };
  if (!input.hasActivePlan) return { id: "plan_today", label: "Plan today" };
  if (input.selectedTaskId) return { id: "start_focus", label: "Start focus" };
  return null;
}

export type TodaySuggestion = {
  id: string;
  kind: "task" | "habit";
  recordId: string;
  title: string;
  source: string;
  detail: string;
  actionLabel: string;
};

export function todaySuggestions(input: {
  projection: TodayProjection;
  tasks: CanonicalTask[];
  habits: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; title: string }>;
}): TodaySuggestion[] {
  const taskById = new Map(input.tasks.map(task => [task.id, task]));
  const projectById = new Map(input.projects.map(project => [project.id, project]));
  const suggestions: TodaySuggestion[] = input.projection.attention.map(row => {
    const task = taskById.get(row.recordId);
    const project = task?.projectId ? projectById.get(task.projectId) : null;
    return {
      id: `task:${row.recordId}`,
      kind: "task" as const,
      recordId: row.recordId,
      title: row.title,
      source: task?.state === "blocked" ? "Waiting follow-up" : project ? `From ${project.title}` : "Due task",
      detail: row.reason === "overdue_unplanned" ? "Overdue · not planned" : "Due today · not planned",
      actionLabel: "Review task",
    };
  });
  const dueHabit = input.projection.habits.find(habit => habit.state === "due");
  if (dueHabit) {
    suggestions.push({
      id: `habit:${dueHabit.recordId}`,
      kind: "habit",
      recordId: dueHabit.recordId,
      title: dueHabit.title,
      source: "Due habit",
      detail: "Scheduled for today",
      actionLabel: "Open habits",
    });
  }
  return suggestions.slice(0, 4);
}

function minutesLabel(minutes: number) {
  const safe = Math.max(0, Math.round(minutes));
  if (safe < 60) return `${safe} min`;
  const hours = Math.floor(safe / 60);
  const remainder = safe % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function localDateLabel(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return {
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(date),
    day: new Intl.DateTimeFormat("en-US", { day: "2-digit", timeZone: "UTC" }).format(date),
    month: new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(date).toUpperCase(),
    full: new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }).format(date),
  };
}

export type TodayWorkspaceProps = {
  projection: TodayProjection;
  tasks: CanonicalTask[];
  habits: Array<{ id: string; name: string; color?: string | null }>;
  projects: Array<{ id: string; title: string }>;
  goals: Array<{ id: string; title: string }>;
  categories: Array<{ id: string; name: string }>;
  dependencies?: any[];
  timezone: string;
  hasActivePlan: boolean;
  commitmentCount: number;
  selectedRecordId: string | null;
  pendingTaskIds?: ReadonlySet<string>;
  conflictCountByTask?: ReadonlyMap<string, number>;
  isOnline: boolean;
  habitPending: boolean;
  habitError: string | null;
  onPlanToday: () => void;
  onStartFocus: (task: CanonicalTask) => void;
  onResolveRecovery: () => void;
  onOpenHabits: () => void;
  onToggleTask?: (task: CanonicalTask) => void | Promise<unknown>;
  onArchiveTask?: (task: CanonicalTask) => void | Promise<unknown>;
  onUpdateTask: (task: CanonicalTask, patch: Record<string, unknown>) => Promise<TaskMutationResult>;
  onCreateSubtask: (task: CanonicalTask, title: string) => Promise<TaskMutationResult>;
  onAddDependency?: (task: CanonicalTask, dependsOnTaskId: string) => Promise<void>;
  onRemoveDependency?: (dependency: any) => Promise<void>;
  onHabitCheckIn: (habitId: string, localDate: string, state: "completed" | "skipped") => void;
  onClearHabitCheckIn: (habitId: string, localDate: string) => void;
  onRetryHabit?: () => void;
  onSelectedRecordChange: (recordId: string | null) => void;
};

export function TodayWorkspace({
  projection,
  tasks,
  habits,
  projects,
  goals,
  categories,
  dependencies = [],
  timezone,
  hasActivePlan,
  commitmentCount,
  selectedRecordId,
  pendingTaskIds = new Set(),
  conflictCountByTask = new Map(),
  isOnline,
  habitPending,
  habitError,
  onPlanToday,
  onStartFocus,
  onResolveRecovery,
  onOpenHabits,
  onToggleTask,
  onArchiveTask,
  onUpdateTask,
  onCreateSubtask,
  onAddDependency,
  onRemoveDependency,
  onHabitCheckIn,
  onClearHabitCheckIn,
  onRetryHabit = () => undefined,
  onSelectedRecordChange,
}: TodayWorkspaceProps) {
  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const firstExecutableId = projection.flexible[0]?.recordId
    ?? projection.timeline.find(row => row.kind === "task")?.recordId
    ?? projection.attention[0]?.recordId
    ?? null;
  const [focusTaskId, setFocusTaskId] = useState(firstExecutableId);
  const [unsupportedMessage, setUnsupportedMessage] = useState<string | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (focusTaskId && taskById.has(focusTaskId)) return;
    setFocusTaskId(firstExecutableId);
  }, [firstExecutableId, focusTaskId, taskById]);

  const date = localDateLabel(projection.localDate);
  const projectTitles = useMemo(() => new Map(projects.map(project => [project.id, project.title])), [projects]);
  const goalTitles = useMemo(() => new Map(goals.map(goal => [goal.id, goal.title])), [goals]);
  const categoryNames = useMemo(() => new Map(categories.map(category => [category.id, category.name])), [categories]);
  const selectedTask = tasks.find(task => task.id === selectedRecordId) ?? null;
  const focusTask = focusTaskId ? taskById.get(focusTaskId) ?? null : null;
  const headerAction = contextualTodayAction({
    recoveryCount: projection.recovery.length,
    hasActivePlan,
    selectedTaskId: focusTask?.id ?? null,
  });
  const flexibleEstimateMinutes = projection.flexible.reduce((total, row) => {
    const estimate = taskById.get(row.recordId)?.estimateMinutes;
    return total + (typeof estimate === "number" ? Math.max(0, estimate) : 0);
  }, 0);
  const unavailableMinutes = Math.max(0, projection.capacity.workdayMinutes - projection.capacity.availableMinutes);
  const suggestions = todaySuggestions({ projection, tasks, habits, projects });

  const openTask = (task: CanonicalTask, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    setFocusTaskId(task.id);
    onSelectedRecordChange(task.id);
  };
  const toggleTask = (task: CanonicalTask) => {
    if (onToggleTask) return onToggleTask(task);
    return onUpdateTask(task, { state: task.state === "completed" ? "not_started" : "completed" });
  };
  const startFocus = (task: CanonicalTask) => {
    setFocusTaskId(task.id);
    if (!isOnline) {
      setUnsupportedMessage("Reconnect to start focus. No focus session was started; the last confirmed state is unchanged.");
      return;
    }
    onStartFocus(task);
  };
  const resolveRecovery = () => {
    if (!isOnline) {
      setUnsupportedMessage("Reconnect to resolve earlier commitments. Their last confirmed state remains unchanged.");
      return;
    }
    onResolveRecovery();
  };
  const runHeaderAction = () => {
    if (!headerAction) return;
    if (headerAction.id === "resolve_recovery") return resolveRecovery();
    if (headerAction.id === "plan_today") return onPlanToday();
    if (focusTask) startFocus(focusTask);
  };

  return (
    <main className="today-workspace" aria-labelledby="today-workspace-heading">
      <header className="today-workspace-intro">
        <div>
          <span className="today-kicker">Home / Today</span>
          <h1 id="today-workspace-heading">A day you can still believe.</h1>
          <p>{date.full}. Fixed time is protected, flexible work stays honest, and unfinished promises keep their history.</p>
        </div>
        <div className="today-workspace-action">
          {headerAction ? (
            <Button type="button" className="today-primary-action" onClick={runHeaderAction}>
              {headerAction.id === "resolve_recovery" ? <AlertTriangle aria-hidden="true" size={18} /> : headerAction.id === "plan_today" ? <ListChecks aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
              {headerAction.label}
            </Button>
          ) : null}
          <small>Capture remains available in the global bar.</small>
        </div>
        <div className="today-date-stamp" aria-label={date.full}><span>{date.weekday.slice(0, 3).toUpperCase()}</span><strong>{date.day}</strong><small>{date.month}</small></div>
      </header>

      <section className="today-summary" data-today-section="summary" aria-label="Today commitment and capacity summary">
        <div><span>Commitments</span><strong>{commitmentCount} chosen</strong><small>{projection.recovery.length ? `${projection.recovery.length} earlier ${projection.recovery.length === 1 ? "decision" : "decisions"}` : "No unresolved earlier plan"}</small></div>
        <div><span>Scheduled demand</span><strong>{minutesLabel(projection.capacity.busyMinutes)}</strong><small>Merged timed work and busy context</small></div>
        <div><span>Flexible estimates</span><strong>{minutesLabel(flexibleEstimateMinutes)}</strong><small>{projection.flexible.length} planned without a time</small></div>
        <div><span>Unavailable</span><strong>{minutesLabel(unavailableMinutes)}</strong><small>Calendar context and break allowance</small></div>
        <div><span>Estimate gaps</span><strong>{projection.capacity.unestimatedTaskCount}</strong><small>{projection.capacity.isCompleteEstimate ? "Known demand is fully estimated" : "Not counted as zero"}</small></div>
      </section>

      {!isOnline ? (
        <p className="today-offline-state" role="status"><WifiOff aria-hidden="true" size={17} /><span><strong>Offline · task changes remain available.</strong> Reconnect to check in habits, start focus, or resolve earlier commitments. Last confirmed state is shown for those actions.</span></p>
      ) : null}
      {unsupportedMessage ? <p className="today-inline-guidance" role="status"><span>{unsupportedMessage}</span><button type="button" aria-label="Dismiss reconnect guidance" onClick={() => setUnsupportedMessage(null)}>×</button></p> : null}

      {projection.recovery.length ? (
        <section className="today-recovery-entry" data-today-section="recovery" aria-labelledby="today-recovery-heading">
          <span className="today-recovery-count">{String(projection.recovery.length).padStart(2, "0")}</span>
          <div><span><AlertTriangle aria-hidden="true" size={15} /> Needs a decision</span><h2 id="today-recovery-heading">Earlier work did not disappear</h2><p>{projection.recovery[0].title}{projection.recovery.length > 1 ? ` and ${projection.recovery.length - 1} more` : ""} remain attached to their original plan.</p></div>
          <button type="button" onClick={resolveRecovery}>Resolve remaining work <ArrowRight aria-hidden="true" size={18} /></button>
        </section>
      ) : null}

      <div className="today-execution-grid">
        <TodayTimeline
          rows={projection.timeline}
          tasks={tasks}
          timezone={timezone}
          projectTitles={projectTitles}
          goalTitles={goalTitles}
          categoryNames={categoryNames}
          pendingTaskIds={pendingTaskIds}
          onToggleTask={toggleTask}
          onArchiveTask={onArchiveTask}
          onStartFocus={startFocus}
          onOpenTask={openTask}
        />
        <TodayFlexibleWork
          rows={projection.flexible}
          tasks={tasks}
          localDate={projection.localDate}
          timezone={timezone}
          projectTitles={projectTitles}
          goalTitles={goalTitles}
          categoryNames={categoryNames}
          pendingTaskIds={pendingTaskIds}
          onToggleTask={toggleTask}
          onArchiveTask={onArchiveTask}
          onStartFocus={startFocus}
          onOpenTask={openTask}
        />
      </div>

      <TodayHabits
        rows={projection.habits}
        habits={habits}
        localDate={projection.localDate}
        isOnline={isOnline}
        pending={habitPending}
        error={habitError}
        onCheckIn={onHabitCheckIn}
        onClearCheckIn={onClearHabitCheckIn}
        onRetry={onRetryHabit}
        onOpenHabits={onOpenHabits}
        onUnsupportedOffline={setUnsupportedMessage}
      />

      <section className="today-suggestions" data-today-section="suggestions" aria-labelledby="today-suggestions-heading">
        <header className="today-section-heading">
          <div><span>Context, not a score</span><h2 id="today-suggestions-heading">Useful next decisions</h2></div>
          <small>{suggestions.length} sourced</small>
        </header>
        {suggestions.length ? <div className="today-suggestion-list">{suggestions.map(suggestion => (
          <article key={suggestion.id} data-suggestion-source={suggestion.source}>
            <span>{suggestion.source}</span>
            <div><strong>{suggestion.title}</strong><small>{suggestion.detail}</small></div>
            <button type="button" onClick={event => {
              if (suggestion.kind === "habit") onOpenHabits();
              else {
                const task = taskById.get(suggestion.recordId);
                if (task) openTask(task, event.currentTarget);
              }
            }}>{suggestion.actionLabel} <ArrowRight aria-hidden="true" size={16} /></button>
          </article>
        ))}</div> : <p className="today-suggestions-empty"><Check aria-hidden="true" size={18} /> Nothing else is asking for a planning decision.</p>}
      </section>

      <details className="today-completed-evidence" data-today-section="completed">
        <summary><span><Sparkles aria-hidden="true" size={17} /> Completed today</span><span>{projection.completionEvidence.length} evidence {projection.completionEvidence.length === 1 ? "record" : "records"}</span></summary>
        <div className="today-completed-list">
          {projection.completionEvidence.length ? projection.completionEvidence.map(evidence => (
            <article key={`${evidence.kind}:${evidence.evidenceId}`}>
              <CalendarCheck2 aria-hidden="true" size={17} />
              <div><strong>{evidence.title}</strong><small>{evidence.kind === "habit" ? "Habit check-in" : evidence.kind === "task_occurrence" ? "Recurring task occurrence" : "Task completion"}</small></div>
              <time>{evidence.completedAt ? new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", minute: "2-digit" }).format(new Date(evidence.completedAt)) : "Time not recorded"}</time>
            </article>
          )) : <p>No completion evidence has been recorded today.</p>}
        </div>
      </details>

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
        onUpdate={onUpdateTask}
        onCreateSubtask={onCreateSubtask}
        onAddDependency={onAddDependency}
        onRemoveDependency={onRemoveDependency}
      />
    </main>
  );
}
