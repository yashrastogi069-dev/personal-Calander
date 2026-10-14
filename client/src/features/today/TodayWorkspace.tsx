import { Button } from "@/components/ui/button";
import {
  TaskDetailSheet,
  type TaskMutationResult,
} from "@/features/tasks/TaskDetailSheet";
import type { CanonicalTask } from "@shared/canonicalTask";
import type {
  TodayDailyPlan,
  TodayDailyPlanItem,
  TodayProjection,
  TodayTaskOccurrence,
} from "@shared/todayProjection";
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  ChevronDown,
  CalendarDays,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TodayFlexibleWork } from "./TodayFlexibleWork";
import { TodayHabits } from "./TodayHabits";
import { TodayTimeline } from "./TodayTimeline";
import { nextTodayMilestone, type TodayHabitCheckInFact, type TodayMilestoneFact } from "./todayContext";
import {
  RecoveryIndicator,
  type AccountabilityLevel,
} from "@/features/recovery/RecoveryIndicator";
import "./today-workspace.css";

export type TodayHeaderAction =
  | { id: "resolve_recovery"; label: "Resolve remaining work" }
  | { id: "plan_today"; label: "Plan today" }
  | { id: "start_focus"; label: "Start focus" };

export function isExecutableTodayTask(task: CanonicalTask | null | undefined) {
  return Boolean(
    task &&
      !task.id.startsWith("offline:") &&
      task.state !== "blocked" &&
      task.state !== "completed" &&
      task.state !== "archived" &&
      task.outcome !== "wont_do"
  );
}

export type TodayLinkedResolution = "plan" | "review" | "both" | "reconcile";

export function todayLinkedResolution(
  taskId: string,
  localDate: string,
  plans: TodayDailyPlan[],
  items: TodayDailyPlanItem[],
  occurrences: TodayTaskOccurrence[],
  isRecurringSeries = false
): TodayLinkedResolution | null {
  const planIds = new Set(
    plans
      .filter(plan => plan.localDate <= localDate && plan.state !== "archived")
      .map(plan => plan.id)
  );
  const commitment = items.some(
    item =>
      item.taskId === taskId &&
      item.state === "committed" &&
      planIds.has(item.dailyPlanId)
  );
  const occurrence = occurrences.some(
    item =>
      item.taskId === taskId &&
      item.localDate === localDate &&
      item.state === "pending"
  );
  return commitment && occurrence
    ? "both"
    : commitment
      ? "plan"
      : occurrence
        ? "review"
        : isRecurringSeries
          ? "reconcile"
          : null;
}

export function contextualTodayAction(input: {
  recoveryCount: number;
  hasActivePlan: boolean;
  selectedTaskId: string | null;
}): TodayHeaderAction | null {
  if (input.recoveryCount > 0)
    return { id: "resolve_recovery", label: "Resolve remaining work" };
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
  const projectById = new Map(
    input.projects.map(project => [project.id, project])
  );
  const suggestions: TodaySuggestion[] = input.projection.attention.map(row => {
    const task = taskById.get(row.recordId);
    const project = task?.projectId ? projectById.get(task.projectId) : null;
    return {
      id: `task:${row.recordId}`,
      kind: "task" as const,
      recordId: row.recordId,
      title: row.title,
      source:
        task?.state === "blocked"
          ? "Blocked task"
          : project
            ? `From ${project.title}`
            : "Due task",
      detail:
        row.reason === "overdue_unplanned"
          ? "Overdue · not planned"
          : "Due today · not planned",
      actionLabel: "Review task",
    };
  });
  const plannedProjectTask = input.projection.flexible
    .map(row => taskById.get(row.recordId))
    .find(task => task?.projectId && projectById.has(task.projectId));
  if (plannedProjectTask) {
    const project = projectById.get(plannedProjectTask.projectId!);
    suggestions.push({
      id: `project-task:${plannedProjectTask.id}`,
      kind: "task",
      recordId: plannedProjectTask.id,
      title: plannedProjectTask.title,
      source: `From ${project?.title}`,
      detail: "Planned today · project next action",
      actionLabel: "Review task",
    });
  }
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

export type TodayWorkspaceProps = {
  taskDraftScopeKey?: string;
  projection: TodayProjection;
  tasks: CanonicalTask[];
  habits: Array<{ id: string; name: string; color?: string | null }>;
  habitCheckIns?: TodayHabitCheckInFact[];
  milestones?: TodayMilestoneFact[];
  projects: Array<{ id: string; title: string; goalId?: string | null }>;
  goals: Array<{ id: string; title: string }>;
  categories: Array<{ id: string; name: string }>;
  dependencies?: any[];
  dailyPlans?: TodayDailyPlan[];
  dailyPlanItems?: TodayDailyPlanItem[];
  taskOccurrences?: TodayTaskOccurrence[];
  timezone: string;
  hasActivePlan: boolean;
  commitmentCount: number;
  recoveryCount?: number;
  accountabilityLevel?: AccountabilityLevel;
  isUnavailableToday?: boolean;
  captureStatus?: ReactNode;
  selectedRecordId: string | null;
  pendingTaskIds?: ReadonlySet<string>;
  conflictCountByTask?: ReadonlyMap<string, number>;
  isOnline: boolean;
  habitPending: boolean;
  habitError: string | null;
  onPlanToday: () => void;
  onOpenPlan?: (dailyPlanItemId: string) => void;
  onOpenReview?: (occurrenceId: string) => void;
  onStartFocus: (task: CanonicalTask) => void;
  onResolveRecovery: () => void;
  onOpenHabits: () => void;
  onOpenHabit?: (habitId: string) => void;
  onOpenProject?: (projectId: string) => void;
  onOpenCalendar?: () => void;
  onToggleTask?: (task: CanonicalTask) => void | Promise<unknown>;
  onArchiveTask?: (task: CanonicalTask) => void | Promise<unknown>;
  onUpdateTask: (
    task: CanonicalTask,
    patch: Record<string, unknown>
  ) => Promise<TaskMutationResult>;
  onCreateSubtask: (
    task: CanonicalTask,
    title: string
  ) => Promise<TaskMutationResult>;
  onAddDependency?: (
    task: CanonicalTask,
    dependsOnTaskId: string
  ) => Promise<void>;
  onRemoveDependency?: (dependency: any) => Promise<void>;
  onHabitCheckIn: (
    habitId: string,
    localDate: string,
    state: "completed" | "skipped"
  ) => void;
  onClearHabitCheckIn: (habitId: string, localDate: string) => void;
  onRetryHabit?: () => void;
  onSelectedRecordChange: (recordId: string | null) => void;
};

export function TodayWorkspace({
  taskDraftScopeKey,
  projection,
  tasks,
  habits,
  habitCheckIns = [],
  milestones = [],
  projects,
  goals,
  categories,
  dependencies = [],
  dailyPlans = [],
  dailyPlanItems = [],
  taskOccurrences = [],
  timezone,
  hasActivePlan,
  commitmentCount,
  recoveryCount = projection.recovery.length,
  accountabilityLevel = "structured",
  isUnavailableToday = false,
  captureStatus,
  selectedRecordId,
  pendingTaskIds = new Set(),
  conflictCountByTask = new Map(),
  isOnline,
  habitPending,
  habitError,
  onPlanToday,
  onOpenPlan = onPlanToday,
  onOpenReview = onPlanToday,
  onStartFocus,
  onResolveRecovery,
  onOpenHabits,
  onOpenHabit,
  onOpenProject,
  onOpenCalendar,
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
  const taskById = useMemo(
    () => new Map(tasks.map(task => [task.id, task])),
    [tasks]
  );
  const linkedResolutionByTaskId = useMemo(
    () =>
      new Map(
        tasks.flatMap(task => {
          const route = todayLinkedResolution(
            task.id,
            projection.localDate,
            dailyPlans,
            dailyPlanItems,
            taskOccurrences,
            Boolean(task.recurrenceRule)
          );
          return route ? [[task.id, route] as const] : [];
        })
      ),
    [tasks, projection.localDate, dailyPlans, dailyPlanItems, taskOccurrences]
  );
  const linkedPlanContextByTaskId = useMemo(() => {
    const planDateById = new Map(
      dailyPlans.map(plan => [plan.id, plan.localDate])
    );
    const occurrenceTaskIds = new Set(taskOccurrences.map(item => item.taskId));
    return new Map(
      tasks.map(
        task =>
          [
            task.id,
            {
              isEarlier: dailyPlanItems.some(
                item =>
                  item.taskId === task.id &&
                  item.state === "committed" &&
                  (planDateById.get(item.dailyPlanId) ?? projection.localDate) <
                    projection.localDate
              ),
              needsRecovery: Boolean(
                task.recurrenceRule || occurrenceTaskIds.has(task.id)
              ),
            },
          ] as const
      )
    );
  }, [
    tasks,
    dailyPlans,
    dailyPlanItems,
    taskOccurrences,
    projection.localDate,
  ]);
  const firstExecutableId =
    [
      ...projection.flexible.map(row => row.recordId),
      ...projection.timeline
        .filter(row => row.kind === "task")
        .map(row => row.recordId),
      ...projection.attention.map(row => row.recordId),
    ].find(
      id =>
        isExecutableTodayTask(taskById.get(id)) &&
        !linkedResolutionByTaskId.has(id)
    ) ?? null;
  const [focusTaskId, setFocusTaskId] = useState(firstExecutableId);
  const [unsupportedMessage, setUnsupportedMessage] = useState<string | null>(
    null
  );
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (
      focusTaskId &&
      isExecutableTodayTask(taskById.get(focusTaskId)) &&
      !linkedResolutionByTaskId.has(focusTaskId)
    )
      return;
    setFocusTaskId(firstExecutableId);
  }, [firstExecutableId, focusTaskId, taskById, linkedResolutionByTaskId]);

  const projectTitles = useMemo(
    () => new Map(projects.map(project => [project.id, project.title])),
    [projects]
  );
  const goalTitles = useMemo(
    () => new Map(goals.map(goal => [goal.id, goal.title])),
    [goals]
  );
  const categoryNames = useMemo(
    () => new Map(categories.map(category => [category.id, category.name])),
    [categories]
  );
  const selectedTask =
    tasks.find(
      task =>
        task.id === selectedRecordId && !linkedResolutionByTaskId.has(task.id)
    ) ?? null;
  const effectiveFocusTaskId =
    focusTaskId &&
    isExecutableTodayTask(taskById.get(focusTaskId)) &&
    !linkedResolutionByTaskId.has(focusTaskId)
      ? focusTaskId
      : firstExecutableId;
  const focusTask = effectiveFocusTaskId
    ? (taskById.get(effectiveFocusTaskId) ?? null)
    : null;
  const headerAction = contextualTodayAction({
    recoveryCount: accountabilityLevel === "gentle" ? 0 : recoveryCount,
    hasActivePlan,
    selectedTaskId: focusTask?.id ?? null,
  });
  const flexibleEstimateMinutes = projection.flexible.reduce((total, row) => {
    const estimate = taskById.get(row.recordId)?.estimateMinutes;
    return total + (typeof estimate === "number" ? Math.max(0, estimate) : 0);
  }, 0);
  const unavailableMinutes = projection.capacity.breakMinutes;
  const suggestions = todaySuggestions({ projection, tasks, habits, projects });
  const nextMilestone = nextTodayMilestone({
    localDate: projection.localDate,
    visibleTaskIds: [...projection.flexible, ...projection.timeline.filter(row => row.kind === "task")].map(row => row.recordId),
    tasks,
    projects,
    milestones,
  });
  const milestoneGoal = nextMilestone?.goalId ? goals.find(goal => goal.id === nextMilestone.goalId) : null;
  const milestoneProject = nextMilestone?.goalId ? projects.find(project => project.goalId === nextMilestone.goalId) : null;

  const openLinkedResolution = (task: CanonicalTask) => {
    const route = linkedResolutionByTaskId.get(task.id);
    if (route === "reconcile") {
      setUnsupportedMessage(
        "Dated occurrence unavailable. This recurring series cannot be completed, archived, or focused from Today until its dated occurrence is available. No task outcome was changed."
      );
      return;
    }
    if (route === "review" || route === "both") {
      const occurrence = taskOccurrences.find(
        item =>
          item.taskId === task.id &&
          item.localDate === projection.localDate &&
          item.state === "pending"
      );
      if (occurrence) onOpenReview(occurrence.id);
    } else if (route) {
      const planDateById = new Map(
        dailyPlans
          .filter(
            plan =>
              plan.localDate <= projection.localDate &&
              plan.state !== "archived"
          )
          .map(plan => [plan.id, plan.localDate])
      );
      const item = dailyPlanItems
        .filter(
          candidate =>
            candidate.taskId === task.id &&
            candidate.state === "committed" &&
            planDateById.has(candidate.dailyPlanId)
        )
        .sort((left, right) => {
          const leftDate = planDateById.get(left.dailyPlanId)!;
          const rightDate = planDateById.get(right.dailyPlanId)!;
          const leftEarlier = leftDate < projection.localDate;
          const rightEarlier = rightDate < projection.localDate;
          return (
            Number(rightEarlier) - Number(leftEarlier) ||
            rightDate.localeCompare(leftDate) ||
            left.id.localeCompare(right.id)
          );
        })[0];
      if (item) onOpenPlan(item.id);
    }
  };
  const openTask = (task: CanonicalTask, trigger: HTMLElement) => {
    if (linkedResolutionByTaskId.has(task.id))
      return openLinkedResolution(task);
    returnFocusRef.current = trigger;
    setFocusTaskId(task.id);
    onSelectedRecordChange(task.id);
  };
  const toggleTask = (task: CanonicalTask) => {
    if (linkedResolutionByTaskId.has(task.id))
      return openLinkedResolution(task);
    if (onToggleTask) return onToggleTask(task);
    return onUpdateTask(task, {
      state: task.state === "completed" ? "not_started" : "completed",
    });
  };
  const startFocus = (task: CanonicalTask) => {
    if (linkedResolutionByTaskId.has(task.id))
      return openLinkedResolution(task);
    if (task.id.startsWith("offline:")) {
      setUnsupportedMessage(
        "Sync this captured task before starting focus. No session was started."
      );
      return;
    }
    if (!isExecutableTodayTask(task)) {
      setUnsupportedMessage(
        "Review this task's blocker before starting focus. No session was started."
      );
      return;
    }
    setFocusTaskId(task.id);
    if (!isOnline) {
      setUnsupportedMessage(
        "Reconnect to start focus. No focus session was started; the last confirmed state is unchanged."
      );
      return;
    }
    onStartFocus(task);
  };
  const resolveRecovery = () => {
    onResolveRecovery();
  };
  return (
    <section className="today-workspace" aria-label="Today's work">
      <div className="today-capacity-strip" data-today-section="summary">
        <details className="today-summary" aria-label="Today commitment and capacity details">
          <summary>
            <span className="today-summary-heading">{commitmentCount} commitments · {minutesLabel(projection.capacity.knownDemandMinutes)} known <ChevronDown aria-hidden="true" size={17} /></span>
            <small>{projection.capacity.unestimatedTaskCount ? `${projection.capacity.unestimatedTaskCount} without estimates` : "All known demand estimated"}</small>
          </summary>
          <div className="today-summary-metrics">
            <div><span>Commitments</span><strong>{commitmentCount} chosen</strong><small>{recoveryCount ? `${recoveryCount} earlier ${recoveryCount === 1 ? "item" : "items"} for review` : "No unresolved earlier plan"}</small></div>
            <div><span>Scheduled demand</span><strong>{minutesLabel(projection.capacity.busyMinutes)}</strong><small>Merged timed work and busy context</small></div>
            <div><span>Flexible estimates</span><strong>{minutesLabel(flexibleEstimateMinutes)}</strong><small>{projection.flexible.length} planned without a time</small></div>
            <div><span>Unavailable</span><strong>{isUnavailableToday ? "All day" : minutesLabel(unavailableMinutes)}</strong><small>{isUnavailableToday ? "Availability exception" : "Break allowance; calendar busy is above"}</small></div>
            <div><span>Estimate gaps</span><strong>{projection.capacity.unestimatedTaskCount}</strong><small>{projection.capacity.isCompleteEstimate ? "Known demand is fully estimated" : "Not counted as zero"}</small></div>
          </div>
        </details>
        {headerAction?.id === "start_focus" && focusTask ? <button className="today-context-action" type="button" onClick={() => startFocus(focusTask)}>Focus {focusTask.title}</button> : null}
        <Button type="button" className="today-plan-action" onClick={onPlanToday}><CalendarDays aria-hidden="true" size={17} />Plan day</Button>
      </div>

      {captureStatus}

      {!isOnline ? (
        <p className="today-offline-state" role="status">
          <WifiOff aria-hidden="true" size={17} />
          <span>
            <strong>Offline · task changes remain available.</strong> Reconnect
            to check in habits, start focus, or resolve earlier commitments.
            Last confirmed state is shown for those actions.
          </span>
        </p>
      ) : null}
      {unsupportedMessage ? (
        <p className="today-inline-guidance" role="status">
          <span>{unsupportedMessage}</span>
          <button
            type="button"
            aria-label="Dismiss reconnect guidance"
            onClick={() => setUnsupportedMessage(null)}
          >
            ×
          </button>
        </p>
      ) : null}

      {recoveryCount && accountabilityLevel !== "gentle" ? (
        <div data-today-section="recovery">
          <RecoveryIndicator count={recoveryCount} level={accountabilityLevel} onOpen={resolveRecovery} />
        </div>
      ) : null}

      <div className="today-execution-grid">
        <div className="today-work-column" data-today-section="work">
          <TodayFlexibleWork
            rows={projection.flexible} tasks={tasks} localDate={projection.localDate} timezone={timezone} occurrences={taskOccurrences}
            projectTitles={projectTitles} goalTitles={goalTitles} categoryNames={categoryNames}
            pendingTaskIds={pendingTaskIds} linkedResolutionByTaskId={linkedResolutionByTaskId}
            linkedPlanContextByTaskId={linkedPlanContextByTaskId} onOpenLinkedResolution={openLinkedResolution}
            onToggleTask={toggleTask} onArchiveTask={onArchiveTask} onStartFocus={startFocus} onOpenTask={openTask}
          />
        </div>
        <div className="today-habit-column">
          <TodayHabits
            rows={projection.habits} habits={habits} checkIns={habitCheckIns} localDate={projection.localDate} timezone={timezone}
            isOnline={isOnline} pending={habitPending} error={habitError} onCheckIn={onHabitCheckIn}
            onClearCheckIn={onClearHabitCheckIn} onRetry={onRetryHabit} onOpenHabits={onOpenHabits}
            onOpenHabit={onOpenHabit} onUnsupportedOffline={setUnsupportedMessage}
          />
        </div>
        <div className="today-day-column" data-today-section="day">
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
          <TodayTimeline
            rows={projection.timeline} tasks={tasks} timezone={timezone} localDate={projection.localDate} occurrences={taskOccurrences} projectTitles={projectTitles}
            goalTitles={goalTitles} categoryNames={categoryNames} pendingTaskIds={pendingTaskIds}
            linkedResolutionByTaskId={linkedResolutionByTaskId} linkedPlanContextByTaskId={linkedPlanContextByTaskId}
            onOpenLinkedResolution={openLinkedResolution} onToggleTask={toggleTask} onArchiveTask={onArchiveTask}
            onStartFocus={startFocus} onOpenTask={openTask} onOpenCalendar={onOpenCalendar} onPlanToday={onPlanToday}
          />
          {nextMilestone ? <section className="today-milestone" aria-label="Upcoming milestone">
            <span>Upcoming milestone · {milestoneGoal?.title ?? "Linked goal"}</span>
            <strong>{nextMilestone.title}</strong>
            <small>Due <time dateTime={nextMilestone.dueLocalDate!}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${nextMilestone.dueLocalDate}T12:00:00Z`))}</time></small>
            {milestoneProject && onOpenProject ? <button type="button" onClick={() => onOpenProject(milestoneProject.id)}>Open {milestoneProject.title} <ArrowRight aria-hidden="true" size={16} /></button> : null}
          </section> : null}
          <section className="today-suggestions" data-today-section="suggestions" aria-labelledby="today-suggestions-heading">
            <header className="today-section-heading"><div><h2 id="today-suggestions-heading">Remaining decisions</h2></div><small>{suggestions.length} sourced</small></header>
            {suggestions.length ? <div className="today-suggestion-list">{suggestions.map(suggestion => (
              <article key={suggestion.id} data-suggestion-source={suggestion.source}>
                <span>{suggestion.source}</span><div><strong>{suggestion.title}</strong><small>{suggestion.detail}</small></div>
                <button type="button" onClick={event => { if (suggestion.kind === "habit") onOpenHabits(); else { const task = taskById.get(suggestion.recordId); if (task) openTask(task, event.currentTarget); } }}>{suggestion.actionLabel} <ArrowRight aria-hidden="true" size={16} /></button>
              </article>
            ))}</div> : <p className="today-suggestions-empty"><Check aria-hidden="true" size={18} /> Nothing else is asking for a planning decision.</p>}
          </section>
        </div>
      </div>

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
        conflictCount={
          selectedTask ? (conflictCountByTask.get(selectedTask.id) ?? 0) : 0
        }
        isOnline={isOnline}
        onOpenChange={open => {
          if (!open) onSelectedRecordChange(null);
        }}
        onUpdate={onUpdateTask}
        onCreateSubtask={onCreateSubtask}
        onAddDependency={onAddDependency}
        onRemoveDependency={onRemoveDependency}
        onStartFocus={startFocus}
      />
    </section>
  );
}
