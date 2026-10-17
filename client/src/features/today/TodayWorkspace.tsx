// Today (layout pass, interview Q12-Q17): next-up hero, one tickable list, habits-due chips and a compact
// timeline, plus the "Plan my day" and "Shut down day" overlays. Every write goes through an existing tRPC
// procedure (see useTodayWrites); a tick waits TODAY_UNDO_MS for Undo before its single write is sent.
// The older Today sections (TodayFlexibleWork, TodayHabits heatmap/traces, TodayTimeline) stay in the
// codebase but are no longer mounted here.
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { CalendarDays, CalendarPlus, Moon, MoreHorizontal, RotateCcw, Sunrise, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TaskDetailSheet, type TaskMutationResult } from "@/features/tasks/TaskDetailSheet";
import type { CanonicalTask } from "@shared/canonicalTask";
import type { TodayDailyPlan, TodayDailyPlanItem, TodayProjection, TodayTaskOccurrence } from "@shared/todayProjection";
import { topReason, type WhyReason } from "@shared/whyItMatters";
import { whyFactsFromSnapshot } from "@/features/why/whyFacts";
import { resolveCategoryTones, type ToneOrNeutral } from "@/design/categoryTone";
import { buildRecoveryEntries, recoveryDecisionInput, type RecoveryEntry } from "@/features/recovery/recoveryModel";
import type { AccountabilityLevel } from "@/features/recovery/RecoveryIndicator";
import type { TodayHabitCheckInFact, TodayMilestoneFact } from "./todayContext";
import {
  buildTodayItems, carryCount, clockLabel, completeTodayItem, dayPart, habitChipAction, habitChipRow, itemPlannedMinutes,
  localMinuteOfDay, meetingJoinUrl, nextUp, pickTray, shiftDate, shutdownDue, shutdownWrite, timedEventsForDay, allDayEventsForDay,
  todayCapacity, TODAY_UNDO_MS,
  type HabitChipState, type ShutdownDecision, type ShutdownItem, type TodayCarryFact, type TodayEventFact, type TodayFacts,
  type TodayItem, type TodayWrite,
} from "./todayModel";
import { TodayHero } from "./TodayHero";
import { TodayItemList, type TodayDoneRow, type TodayListRow } from "./TodayItemList";
import { TodayHabitChips } from "./TodayHabitChips";
import { TodayDayTimeline, type TimelineEntry } from "./TodayDayTimeline";
import { CapacityBar, PlanMyDaySheet, type LeftoverChoice, type Placement } from "./PlanMyDaySheet";
import { ShutdownSheet } from "./ShutdownSheet";
import type { TodayWrites } from "./useTodayWrites";
import "@/features/tasks/tasks-premium.css";
import "./today-premium.css";

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

type Row = Record<string, unknown>;

export type TodayWorkspaceProps = {
  taskDraftScopeKey?: string;
  projection: TodayProjection;
  tasks: CanonicalTask[];
  habits: Array<{ id: string; name: string; color?: string | null }>;
  habitCheckIns?: TodayHabitCheckInFact[];
  milestones?: TodayMilestoneFact[];
  projects: Array<{ id: string; title: string; goalId?: string | null }>;
  goals: Array<{ id: string; title: string }>;
  categories: Array<{ id: string; name: string; color?: string | null }>;
  dependencies?: any[];
  dailyPlans?: TodayDailyPlan[];
  dailyPlanItems?: TodayDailyPlanItem[];
  taskOccurrences?: TodayTaskOccurrence[];
  /** Layout pass inputs (all already in the planner snapshot). */
  externalEvents?: readonly TodayEventFact[];
  focusSessions?: ReadonlyArray<{ startedAt: Date | string; activeSeconds?: number | null; state?: string }>;
  carriedCommitments?: readonly TodayCarryFact[];
  commitmentResolutions?: readonly Row[];
  weeklyObjectives?: readonly Row[];
  dailyCheckIns?: ReadonlyArray<{ localDate: string; energy?: number | null }>;
  workspace?: { workdayStartsAt?: string | null; workdayEndsAt?: string | null; defaultBreakMinutes?: number | null; preferredShutdownAt?: string | null } | null;
  /** Existing tRPC write adapters (useTodayWrites). Missing in render-only tests: the actions then explain. */
  writes?: TodayWrites;
  /** Fixed clock for tests; the page otherwise ticks once a minute. */
  now?: Date;
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
  onUpdateTask: (task: CanonicalTask, patch: Record<string, unknown>) => Promise<TaskMutationResult>;
  onCreateSubtask: (task: CanonicalTask, title: string) => Promise<TaskMutationResult>;
  onAddDependency?: (task: CanonicalTask, dependsOnTaskId: string) => Promise<void>;
  onRemoveDependency?: (dependency: any) => Promise<void>;
  onHabitCheckIn: (habitId: string, localDate: string, state: "completed" | "skipped") => void;
  onClearHabitCheckIn: (habitId: string, localDate: string) => void;
  onRetryHabit?: () => void;
  onSelectedRecordChange: (recordId: string | null) => void;
};

type Tick = { item: TodayItem; index: number; committed: boolean };

let operationCounter = 0;
function operationId(prefix: string) {
  operationCounter += 1;
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `today-${prefix}-${operationCounter}-${random}`.slice(0, 120);
}

function errorText(error: unknown) {
  return error instanceof Error && error.message ? error.message : "That change did not save. Nothing else was changed.";
}

const EMPTY: never[] = [];

export function TodayWorkspace(props: TodayWorkspaceProps) {
  const {
    taskDraftScopeKey, projection, tasks, milestones = EMPTY, projects, goals, categories,
    dependencies = EMPTY, dailyPlans = EMPTY, dailyPlanItems = EMPTY, taskOccurrences = EMPTY, externalEvents = EMPTY,
    focusSessions = EMPTY, carriedCommitments = EMPTY, commitmentResolutions = EMPTY, weeklyObjectives = EMPTY, dailyCheckIns = EMPTY,
    workspace, writes, timezone, isUnavailableToday = false, captureStatus, selectedRecordId, conflictCountByTask = new Map(),
    isOnline, habitPending, habitError, onStartFocus, onOpenHabits, onOpenCalendar, onUpdateTask, onCreateSubtask,
    onAddDependency, onRemoveDependency, onHabitCheckIn, onClearHabitCheckIn, onSelectedRecordChange,
  } = props;
  const localDate = projection.localDate;
  const tomorrow = shiftDate(localDate, 1);

  // A minute clock (or the fixed test clock) drives the hero, now-line and evening card.
  const [clock, setClock] = useState(() => props.now ?? new Date());
  useEffect(() => {
    if (props.now) return;
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [props.now]);
  const now = props.now ?? clock;

  const facts: TodayFacts = useMemo(() => ({
    localDate, timezone, tasks, plans: dailyPlans as TodayFacts["plans"], items: dailyPlanItems as TodayFacts["items"],
    occurrences: taskOccurrences as TodayFacts["occurrences"], carries: carriedCommitments,
  }), [localDate, timezone, tasks, dailyPlans, dailyPlanItems, taskOccurrences, carriedCommitments]);
  const factsRef = useRef(facts);
  factsRef.current = facts;
  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const tasksRef = useRef(taskById);
  tasksRef.current = taskById;
  const categoryTones = useMemo(() => resolveCategoryTones(categories), [categories]);
  const toneFor = useCallback((categoryId: string | null): ToneOrNeutral => (categoryId ? categoryTones.get(categoryId) ?? "neutral" : "neutral"), [categoryTones]);

  const whyFacts = useMemo(() => whyFactsFromSnapshot({ tasks, goals, projects, milestones, taskDependencies: dependencies, taskOccurrences, dailyPlans, dailyPlanItems, weeklyObjectives }),
    [tasks, goals, projects, milestones, dependencies, taskOccurrences, dailyPlans, dailyPlanItems, weeklyObjectives]);
  const whyTasks = useMemo(() => new Map(whyFacts.tasks.map(task => [task.id, task])), [whyFacts]);
  const whyFor = useCallback((taskId: string): WhyReason | null => {
    const entity = whyTasks.get(taskId);
    if (!entity) return null;
    try { return topReason({ kind: "task", task: entity }, whyFacts, now, timezone, "today_row"); } catch { return null; }
  }, [whyTasks, whyFacts, now, timezone]);

  const todayPlan = facts.plans.find(plan => plan.localDate === localDate && plan.state !== "archived") ?? null;
  const planState = todayPlan?.state ?? "none";
  const planDate = useMemo(() => new Map(dailyPlans.map(plan => [plan.id, plan.localDate])), [dailyPlans]);
  const itemDate = useCallback((itemId?: string) => {
    const item = itemId ? dailyPlanItems.find(row => row.id === itemId) : null;
    return item ? planDate.get(item.dailyPlanId) ?? null : null;
  }, [dailyPlanItems, planDate]);

  const items = useMemo(() => buildTodayItems(projection, facts), [projection, facts]);

  // ---------------------------------------------------------------- ticks with a deferred, undoable write
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const timers = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, { write: TodayWrite; title: string }>());
  const [notice, setNotice] = useState<string | null>(null);
  const [busyWriting, setBusyWriting] = useState(false);

  const runWrite = useCallback(async (write: TodayWrite): Promise<boolean> => {
    try {
      if (write.procedure === "planner.task.update") {
        const task = tasksRef.current.get(write.taskId);
        if (!task) throw new Error("This task is not loaded. Refresh and try again.");
        await onUpdateTask(task, write.patch);
        return true;
      }
      if (!writes) throw new Error("This action is not available here.");
      if (write.procedure === "planner.occurrence.resolve") await writes.resolveOccurrence(write.input);
      else await writes.resolveCommitment(write.decision);
      return true;
    } catch (error) {
      toast.error(errorText(error));
      return false;
    }
  }, [onUpdateTask, writes]);
  const runWriteRef = useRef(runWrite);
  runWriteRef.current = runWrite;

  const commitTick = useCallback(async (key: string) => {
    window.clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    const entry = pending.current.get(key);
    if (!entry) return true;
    pending.current.delete(key);
    const ok = await runWriteRef.current(entry.write);
    setTicks(current => {
      if (!current[key]) return current;
      if (!ok) { const next = { ...current }; delete next[key]; return next; }
      return { ...current, [key]: { ...current[key], committed: true } };
    });
    return ok;
  }, []);

  const undoTick = useCallback((key: string) => {
    window.clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    if (!pending.current.delete(key)) return;
    setTicks(current => { const next = { ...current }; delete next[key]; return next; });
    toast.dismiss(`today-tick-${key}`);
  }, []);

  // Leaving Today sends what is waiting (the Undo window is a delay, not a cancel-on-navigate).
  useEffect(() => () => {
    for (const [key, entry] of Array.from(pending.current.entries())) {
      window.clearTimeout(timers.current.get(key));
      void runWriteRef.current(entry.write);
    }
    pending.current.clear();
    timers.current.clear();
  }, []);

  const flushTicks = useCallback(async () => {
    const keys = Array.from(pending.current.keys());
    for (const key of keys) if (!(await commitTick(key))) return false;
    return true;
  }, [commitTick]);

  const needsServer = (write: TodayWrite) => write.procedure !== "planner.task.update";

  const toggle = (row: TodayListRow) => {
    const key = row.item.key;
    const tick = ticks[key];
    if (tick) { if (!tick.committed) undoTick(key); return; }
    const completion = completeTodayItem(row.item, factsRef.current, operationId("done"));
    if (completion.kind === "refuse") { setNotice(completion.reason); return; }
    if (needsServer(completion.write) && !isOnline) { setNotice("Reconnect to close this plan item or repeat. Nothing was changed."); return; }
    if (needsServer(completion.write) && !writes) { setNotice("This action is not available here. Nothing was changed."); return; }
    setNotice(null);
    const index = Math.max(0, items.findIndex(item => item.key === key));
    pending.current.set(key, { write: completion.write, title: row.item.title });
    setTicks(current => ({ ...current, [key]: { item: row.item, index, committed: false } }));
    timers.current.set(key, window.setTimeout(() => { void commitTick(key); }, TODAY_UNDO_MS));
    toast(`Done · ${row.item.title}`, { id: `today-tick-${key}`, duration: TODAY_UNDO_MS, action: { label: "Undo", onClick: () => undoTick(key) } });
  };

  const tickedKeys = useMemo(() => new Set(Object.keys(ticks)), [ticks]);
  const openItems = useMemo(() => items.filter(item => !tickedKeys.has(item.key)), [items, tickedKeys]);

  const blockedReasonFor = (item: TodayItem) => {
    const task = taskById.get(item.taskId);
    if (!task) return null;
    if (task.id.startsWith("offline:")) return "Sync this captured task first";
    if (task.state === "blocked") return "Blocked. Open it to clear the blocker";
    return null;
  };
  const fromDateFor = (item: TodayItem) => {
    if (item.carryId) {
      const carry = carriedCommitments.find(row => row.id === item.carryId);
      return carry ? itemDate(carry.rootDailyPlanItemId) : null;
    }
    const date = itemDate(item.dailyPlanItemId);
    return date && date < localDate ? date : null;
  };
  const listRows: TodayListRow[] = useMemo(() => {
    const live = items.map(item => ({ item, ticked: tickedKeys.has(item.key), committed: Boolean(ticks[item.key]?.committed) }));
    // A ticked row stays where it was (dimmed) even after the snapshot drops it.
    const missing = Object.values(ticks).filter(tick => !items.some(item => item.key === tick.item.key)).sort((left, right) => left.index - right.index);
    for (const tick of missing) live.splice(Math.min(tick.index, live.length), 0, { item: tick.item, ticked: true, committed: tick.committed });
    return live.map(row => ({ ...row, tone: toneFor(row.item.categoryId), reason: row.ticked ? null : whyFor(row.item.taskId), fromLocalDate: fromDateFor(row.item), blockedReason: blockedReasonFor(row.item) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, ticks, tickedKeys, toneFor, whyFor, carriedCommitments, itemDate, taskById]);

  const tickedTaskIds = new Set(Object.values(ticks).map(tick => tick.item.taskId));
  const doneRows: TodayDoneRow[] = projection.completionEvidence
    .filter(evidence => evidence.kind !== "habit" && !tickedTaskIds.has(evidence.recordId))
    .map(evidence => ({ key: `${evidence.kind}:${evidence.evidenceId}`, title: evidence.title,
      detail: evidence.kind === "task_occurrence" ? "Today's repeat" : "Task", time: evidence.completedAt ? clockLabel(evidence.completedAt, timezone) : null }));

  // ---------------------------------------------------------------- events, hero, timeline, capacity
  const timedEvents = useMemo(() => timedEventsForDay(externalEvents, localDate, timezone), [externalEvents, localDate, timezone]);
  const allDay = useMemo(() => allDayEventsForDay(externalEvents, localDate, timezone), [externalEvents, localDate, timezone]);
  const next = nextUp({ now, items: openItems, events: timedEvents });
  const followingTask = next.kind === "meeting" ? (() => { const after = nextUp({ now: new Date(Math.max(now.getTime(), new Date(next.event.endsAt).getTime())), items: openItems, events: [] }); return after.kind === "task" ? after.item : null; })() : null;
  const heroTaskId = next.kind === "task" ? next.item.taskId : null;
  const because = heroTaskId ? whyFor(heroTaskId) : null;

  const timelineEntries: TimelineEntry[] = [
    ...listRows.filter(row => row.item.startsAt && row.item.endsAt).map(row => ({ kind: "task" as const, key: `task:${row.item.key}`, taskId: row.item.taskId, title: row.item.title,
      startsAt: row.item.startsAt!, endsAt: row.item.endsAt!, tone: row.tone, done: row.ticked })),
    ...timedEvents.map(event => ({ kind: "meeting" as const, key: `event:${event.id}`, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, joinUrl: meetingJoinUrl(event) })),
  ];

  const capacityInput = {
    workdayStartsAt: workspace?.workdayStartsAt ?? "08:30",
    workdayEndsAt: workspace?.workdayEndsAt ?? "17:30",
    breakMinutes: workspace?.defaultBreakMinutes ?? 30,
    meetings: timedEvents.map(event => [localMinuteOfDay(event.startsAt, timezone, localDate), localMinuteOfDay(event.endsAt, timezone, localDate)] as const),
    unavailable: isUnavailableToday,
  };
  const basePlannedMinutes = openItems.reduce((total, item) => total + itemPlannedMinutes(item), 0);
  const capacity = todayCapacity({ ...capacityInput, plannedMinutes: basePlannedMinutes });

  const habitModel = habitChipRow(projection.habits);
  const minuteNow = localMinuteOfDay(now, timezone, localDate);
  const eveningDue = shutdownDue(minuteNow, workspace?.preferredShutdownAt) && planState !== "closed";

  // ---------------------------------------------------------------- focus and detail
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const selectedTask = tasks.find(task => task.id === selectedRecordId) ?? null;
  const focusBlockReason = (task: CanonicalTask | undefined | null) => {
    if (!task) return "This task is not loaded";
    if (task.id.startsWith("offline:")) return "Sync this captured task before starting focus";
    if (!isExecutableTodayTask(task)) return "Clear this task's blocker before starting focus";
    if (!isOnline) return "Reconnect to start focus";
    return null;
  };
  const startFocusFor = (task: CanonicalTask | undefined | null) => {
    const reason = focusBlockReason(task);
    if (reason || !task) { setNotice(`${reason}. No session was started.`); return; }
    onStartFocus(task);
  };
  const openTaskId = (taskId: string, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    onSelectedRecordChange(taskId);
  };
  const heroFocusReason = next.kind === "task" ? focusBlockReason(taskById.get(next.item.taskId)) : followingTask ? focusBlockReason(taskById.get(followingTask.taskId)) : null;

  // ---------------------------------------------------------------- habits
  const tapHabit = (habitId: string, state: HabitChipState, intent: "tap" | "skip") => {
    const action = habitChipAction(state, intent);
    if (!action) return;
    if (!isOnline) { setNotice("Reconnect to check in habits. The last confirmed state is shown."); return; }
    if (action.kind === "clear") onClearHabitCheckIn(habitId, localDate);
    else onHabitCheckIn(habitId, localDate, action.state);
  };

  // ---------------------------------------------------------------- Plan my day
  const [planOpen, setPlanOpen] = useState(false);
  const [shutdownOpen, setShutdownOpen] = useState(false);
  const leftovers: RecoveryEntry[] = useMemo(() => buildRecoveryEntries({
    todayLocalDate: localDate, plans: dailyPlans, items: dailyPlanItems, tasks, occurrences: taskOccurrences,
    carries: carriedCommitments, resolutions: commitmentResolutions,
  } as unknown as Parameters<typeof buildRecoveryEntries>[0]).filter(entry => entry.canResolve), [localDate, dailyPlans, dailyPlanItems, tasks, taskOccurrences, carriedCommitments, commitmentResolutions]);
  const tray = useMemo(() => pickTray(tasks, { localDate, excludeTaskIds: new Set([...items.map(item => item.taskId), ...leftovers.map(entry => entry.taskId)]) }), [tasks, localDate, items, leftovers]);
  const placeable = openItems.filter(item => !item.startsAt && !taskById.get(item.taskId)?.recurrenceRule && !item.carryId)
    .map(item => ({ taskId: item.taskId, title: item.title, estimateMinutes: item.estimateMinutes }));
  const busy = [
    ...timedEvents.map(event => ({ startsAt: event.startsAt, endsAt: event.endsAt })),
    ...openItems.filter(item => item.startsAt && item.endsAt).map(item => ({ startsAt: item.startsAt!, endsAt: item.endsAt! })),
  ];
  const energy = dailyCheckIns.find(row => row.localDate === localDate)?.energy ?? null;
  const [energyDraft, setEnergyDraft] = useState<number | null>(null);
  useEffect(() => { setEnergyDraft(null); }, [energy]);

  const guardServer = () => {
    if (!writes) { toast.error("This action is not available here. Nothing was changed."); return false; }
    if (!isOnline) { toast.error("Reconnect to change today's plan. Nothing was changed."); return false; }
    return true;
  };
  const withBusy = async (work: () => Promise<boolean>) => {
    setBusyWriting(true);
    try { return await work(); } catch (error) { toast.error(errorText(error)); return false; } finally { setBusyWriting(false); }
  };
  const ensureActivePlan = async () => {
    const plan = factsRef.current.plans.find(row => row.localDate === localDate && row.state !== "archived");
    if (plan && plan.state === "active") return { id: plan.id };
    if (plan) return writes!.upsertPlan({ localDate, expectedVersion: plan.version, state: "active" });
    return writes!.upsertPlan({ localDate, state: "active" });
  };
  const onLeftovers = (choices: Record<string, LeftoverChoice>) => withBusy(async () => {
    if (!guardServer()) return false;
    for (const entry of leftovers) {
      const choice = choices[entry.key];
      if (!choice) continue;
      const form = choice === "let_go" ? { action: "abandon" as const } : { action: "reschedule" as const, resolvedToLocalDate: choice === "keep" ? localDate : tomorrow };
      await writes!.resolveCommitment(recoveryDecisionInput(entry, form, operationId("leftover")));
    }
    return true;
  });
  const onPicks = (taskIds: string[]) => withBusy(async () => {
    if (!guardServer()) return false;
    const plan = await ensureActivePlan();
    for (const taskId of taskIds) await writes!.addPlanItem({ dailyPlanId: plan.id, taskId });
    return true;
  });
  const onPlace = (placements: Placement[]) => withBusy(async () => {
    if (!guardServer()) return false;
    for (const placement of placements) {
      const task = tasksRef.current.get(placement.taskId);
      if (!task) continue;
      await writes!.reserveTask({ id: task.id, expectedVersion: task.version, localDate, plannedStartAt: placement.startsAt, plannedEndAt: placement.endsAt });
    }
    return true;
  });
  const recordEnergy = (level: number) => {
    if (!guardServer()) return;
    setEnergyDraft(level);
    void writes!.recordEnergy({ localDate, energy: level }).catch(error => { setEnergyDraft(null); toast.error(errorText(error)); });
  };
  const openPlan = () => { setNotice(null); setPlanOpen(true); };

  // ---------------------------------------------------------------- Shut down day
  const shutdownItems: ShutdownItem[] = useMemo(() => {
    const out: ShutdownItem[] = openItems.map(item => ({
      key: item.key, taskId: item.taskId, title: item.title, source: item.source, carryCount: carryCount(item.taskId, facts),
      fromLocalDate: fromDateFor(item) ?? undefined, dailyPlanItemId: item.dailyPlanItemId, occurrenceId: item.occurrenceId, carryId: item.carryId,
    }));
    const covered = new Set(out.flatMap(item => [item.dailyPlanItemId, item.carryId].filter(Boolean) as string[]));
    for (const entry of leftovers) {
      if (covered.has(entry.sourceCarryId ?? entry.dailyPlanItemId) || tickedTaskIds.has(entry.taskId)) continue;
      out.push({ key: `leftover:${entry.key}`, taskId: entry.taskId, title: entry.originalScope, source: entry.sourceCarryId ? "carried_commitment" : "daily_commitment",
        carryCount: carryCount(entry.taskId, facts), fromLocalDate: entry.sourceLocalDate, dailyPlanItemId: entry.dailyPlanItemId, occurrenceId: entry.occurrenceId, carryId: entry.sourceCarryId });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openItems, leftovers, facts, ticks]);
  const focusMinutes = Math.round(focusSessions
    .filter(session => clockDate(session.startedAt, timezone) === localDate)
    .reduce((total, session) => total + Math.max(0, Number(session.activeSeconds ?? 0)), 0) / 60);
  const wins = {
    doneCount: projection.completionEvidence.filter(evidence => evidence.kind !== "habit" && !tickedTaskIds.has(evidence.recordId)).length + Object.keys(ticks).length,
    focusMinutes, habitsDone: habitModel.doneCount, habitsDue: habitModel.dueCount,
  };
  const onCloseDay = (decisions: Record<string, ShutdownDecision>, reflection: string) => withBusy(async () => {
    if (!guardServer()) return false;
    if (!(await flushTicks())) return false;
    for (const item of shutdownItems) {
      const decision = decisions[item.key];
      if (!decision) return false;
      const write = shutdownWrite(item, decision, factsRef.current, tomorrow, operationId("shutdown"));
      if (write.kind === "refuse") throw new Error(`${item.title}: ${write.reason}`);
      if (!(await runWriteRef.current(write.write))) return false;
    }
    const plan = factsRef.current.plans.find(row => row.localDate === localDate && row.state !== "archived");
    if (plan?.version) await writes!.closePlan({ id: plan.id, expectedVersion: plan.version, reflection: reflection || null });
    else await writes!.upsertPlan({ localDate, state: "closed", reflection: reflection || null });
    setShutdownOpen(false);
    toast("Day closed. See you tomorrow.");
    return true;
  });
  const reopenDay = () => void withBusy(async () => {
    if (!guardServer() || !todayPlan) return false;
    await writes!.upsertPlan({ localDate, expectedVersion: todayPlan.version, state: "active" });
    toast("Day reopened.");
    return true;
  });
  const openShutdown = () => { setNotice(null); setShutdownOpen(true); };

  // ---------------------------------------------------------------- render
  const openCount = listRows.filter(row => !row.ticked).length;
  return (
    <section className="td-page" aria-label="Today's work" data-plan-state={planState}>
      <header className="td-head" data-today-section="summary">
        <div className="td-head-text">
          <p className="td-head-sum pc-num"><strong>{openCount} to do</strong> · {capacity.label}</p>
        </div>
        <div className="td-head-actions">
          {planState !== "closed" ? <button type="button" className="tk-btn" data-plan-open="" onClick={openPlan}><CalendarPlus size={16} strokeWidth={2} aria-hidden="true" />Plan my day</button> : null}
          <DropdownMenuPrimitive.Root>
            <DropdownMenuPrimitive.Trigger asChild>
              <button type="button" className="tk-icon-btn td-more pc-focusable" aria-label="More for today" data-today-menu=""><MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" /></button>
            </DropdownMenuPrimitive.Trigger>
            <DropdownMenuPrimitive.Portal>
              <DropdownMenuPrimitive.Content className="tk-menu" align="end" sideOffset={6} collisionPadding={12}>
                {planState !== "closed" ? <DropdownMenuPrimitive.Item className="tk-menu-item" onSelect={openPlan}><CalendarPlus size={16} aria-hidden="true" />Plan my day</DropdownMenuPrimitive.Item> : null}
                {planState !== "closed" ? <DropdownMenuPrimitive.Item className="tk-menu-item" data-menu-shutdown="" onSelect={openShutdown}><Moon size={16} aria-hidden="true" />Shut down day</DropdownMenuPrimitive.Item> : null}
                {planState === "closed" ? <DropdownMenuPrimitive.Item className="tk-menu-item" data-menu-reopen="" onSelect={reopenDay}><RotateCcw size={16} aria-hidden="true" />Reopen day</DropdownMenuPrimitive.Item> : null}
                {props.onOpenCalendar ? <DropdownMenuPrimitive.Item className="tk-menu-item" onSelect={props.onOpenCalendar}><CalendarDays size={16} aria-hidden="true" />Open calendar</DropdownMenuPrimitive.Item> : null}
              </DropdownMenuPrimitive.Content>
            </DropdownMenuPrimitive.Portal>
          </DropdownMenuPrimitive.Root>
        </div>
      </header>

      {captureStatus}
      {!isOnline ? (
        <p className="td-banner" role="status"><WifiOff size={16} strokeWidth={2} aria-hidden="true" /><span><strong>Offline.</strong> Task ticks still save. Reconnect to check in habits, start focus or change today's plan.</span></p>
      ) : null}
      {notice ? (
        <p className="td-banner is-notice" role="status"><span>{notice}</span><button type="button" className="tk-icon-btn" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button></p>
      ) : null}

      {planState === "closed" ? (
        <section className="td-card td-note is-closed" data-today-card="closed">
          <span className="pc-icon-tile pc-tone-accent" aria-hidden="true"><Moon size={16} strokeWidth={2} /></span>
          <div><h2>Day closed</h2><p>{todayPlan?.reflection ? `"${todayPlan.reflection}"` : "Everything open has a decision. Rest well."}</p></div>
          <button type="button" className="tk-btn is-quiet" onClick={reopenDay} disabled={busyWriting}><RotateCcw size={15} strokeWidth={2} aria-hidden="true" />Reopen day</button>
        </section>
      ) : eveningDue ? (
        <section className="td-card td-note is-evening" data-today-card="evening">
          <span className="pc-icon-tile pc-tone-accent" aria-hidden="true"><Moon size={16} strokeWidth={2} /></span>
          <div><h2>Time to shut down</h2><p>{shutdownItems.length ? `${shutdownItems.length} open ${shutdownItems.length === 1 ? "item needs" : "items need"} a decision before tomorrow.` : "Nothing is left open. Close the day in one tap."}</p></div>
          <button type="button" className="tk-btn is-accent" data-shutdown-open="" onClick={openShutdown}>Shut down day</button>
        </section>
      ) : planState === "none" || planState === "draft" ? (
        <section className="td-card td-note is-morning" data-today-card="morning">
          <span className="pc-icon-tile pc-tone-accent" aria-hidden="true"><Sunrise size={16} strokeWidth={2} /></span>
          <div><h2>Good {dayPart(minuteNow)}</h2><p>{leftovers.length ? `${leftovers.length} left over from earlier. Shape the day in about two minutes.` : "Shape the day in about two minutes."}</p></div>
          <button type="button" className="tk-btn is-accent" data-morning-plan="" onClick={openPlan}>Plan my day</button>
        </section>
      ) : null}

      <div className="td-grid">
        <div className="td-main">
          <TodayHero next={next} timezone={timezone} because={because} followingTask={followingTask} focusDisabledReason={heroFocusReason}
            onStartFocus={item => startFocusFor(taskById.get(item.taskId))} onOpenCalendar={onOpenCalendar} onPlanDay={openPlan} />
          <TodayItemList rows={listRows} done={doneRows} timezone={timezone} enterKey={0}
            onToggle={toggle} onBlocked={row => setNotice(`${row.blockedReason ?? "This item cannot be ticked here"}. Nothing was changed.`)}
            onOpen={(row, trigger) => openTaskId(row.item.taskId, trigger)} onStartFocus={row => startFocusFor(taskById.get(row.item.taskId))} onPlanDay={openPlan} />
        </div>
        <aside className="td-side" aria-label="Habits and timeline">
          <TodayHabitChips rows={projection.habits} pending={habitPending} error={habitError}
            onTap={(habitId, state) => tapHabit(habitId, state, "tap")} onSkip={habitId => tapHabit(habitId, "due", "skip")} onOpenHabits={onOpenHabits} />
          <TodayDayTimeline entries={timelineEntries} allDay={allDay} now={now} timezone={timezone} onOpenTask={openTaskId} onOpenCalendar={onOpenCalendar} />
          <section className="td-card td-cap-card" data-today-section="capacity" aria-label="Today's capacity"><CapacityBar capacity={capacity} /></section>
        </aside>
      </div>

      <PlanMyDaySheet open={planOpen} onOpenChange={setPlanOpen} localDate={localDate} timezone={timezone} now={now} leftovers={leftovers} tray={tray}
        basePlannedMinutes={basePlannedMinutes} capacityInput={capacityInput} placeable={placeable} busy={busy} energy={energyDraft ?? energy} busyWriting={busyWriting}
        onRecordEnergy={recordEnergy} onLeftovers={onLeftovers} onPicks={onPicks} onPlace={onPlace} onDone={() => { setPlanOpen(false); toast("Today is planned."); }} />
      <ShutdownSheet open={shutdownOpen} onOpenChange={setShutdownOpen} localDate={localDate} tomorrow={tomorrow} wins={wins} items={shutdownItems}
        initialReflection={todayPlan?.reflection ?? ""} busyWriting={busyWriting} onCloseDay={onCloseDay} />

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
        conflictCount={selectedTask ? (conflictCountByTask.get(selectedTask.id) ?? 0) : 0}
        isOnline={isOnline}
        onOpenChange={open => { if (!open) onSelectedRecordChange(null); }}
        onUpdate={onUpdateTask}
        onCreateSubtask={onCreateSubtask}
        onAddDependency={onAddDependency}
        onRemoveDependency={onRemoveDependency}
        onStartFocus={startFocusFor}
      />
    </section>
  );
}

function clockDate(value: Date | string, timezone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
