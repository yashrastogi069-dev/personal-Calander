// D4 "Why it matters" reason engine (spec docs/superpowers/specs/2026-10-15-premium-redesign-d4-why-it-matters.md).
// Pure rules over facts the planner snapshot already holds: no AI, no scoring, no new field. Every rule reuses the
// helper that drives the matching pill or badge, so a reason can never contradict one. `now` and `timezone` are
// the only clock inputs; the caller passes `safeTimeZone(workspace.timezone)`. The engine never reads a database.

import { dependencyExecutionState, type DependencyEdge } from "./dependencyPolicy";
import { habitStartLocalDate, habitWeeklyTarget, isHabitAvailableOnLocalDate, isHabitScheduledOnLocalDate, type CalendarHabit } from "./habitSchedule";
import { habitStreakDetail } from "./habitStreak";
import { deadlineIsSeriesAnchor, isOverdueTask, overdueDays, reservedLocalDate } from "./taskBuckets";
import { dayMonthLabel, localDateForInstant, localDaysBetween, weekdayDayMonthLabel } from "./taskDateLabels";
import { recurrenceCadenceLabel, recurringTaskStatus, shiftLocalDate, type TaskOccurrenceLike } from "./taskRecurrence";

type DateValue = Date | string;

export type WhyTask = {
  id: string; title: string; state: string;
  horizon?: string | null; outcome?: string | null; archivedAt?: DateValue | null;
  goalId?: string | null; projectId?: string | null;
  dueLocalDate?: string | null; scheduledLocalDate?: string | null;
  plannedStartAt?: DateValue | null; plannedEndAt?: DateValue | null;
  recurrenceRule?: unknown; recurrenceAnchor?: string | null; recurrenceUntilLocalDate?: string | null;
  rescheduleCount?: number | null; createdAt?: DateValue | null;
};

export type WhyHabit = CalendarHabit & {
  id: string; name: string; goalId?: string | null; archivedAt?: DateValue | null; createdAt?: DateValue | null;
};

export type WhyEntity = { kind: "task"; task: WhyTask } | { kind: "habit"; habit: WhyHabit };

export type WhyGoalFact = { id: string; title: string; state: string; intentionKind?: string | null; dueLocalDate?: string | null; archivedAt?: DateValue | null };
export type WhyMilestoneFact = { id: string; goalId: string; title: string; state: string; dueLocalDate?: string | null; archivedAt?: DateValue | null };
export type WhyProjectFact = { id: string; title: string; state: string; goalId?: string | null; dueLocalDate?: string | null; riskLevel?: string | null; riskNote?: string | null; archivedAt?: DateValue | null };
export type WhyDailyPlanFact = { id: string; localDate: string; state: string };
export type WhyDailyPlanItemFact = { dailyPlanId: string; taskId: string; state: string };
export type WhyWeeklyObjectiveFact = { id: string; title: string; state: string; weekStartLocalDate: string; goalId?: string | null; projectId?: string | null; archivedAt?: DateValue | null };
export type WhyCheckInFact = { habitId: string; localDate: string; state: string };

export type WhyFacts = {
  /** Every task, finished ones included: dependency state needs them. */
  tasks: readonly WhyTask[];
  goals: readonly WhyGoalFact[];
  milestones: readonly WhyMilestoneFact[];
  projects: readonly WhyProjectFact[];
  dependencies: readonly DependencyEdge[];
  occurrences: readonly TaskOccurrenceLike[];
  dailyPlans: readonly WhyDailyPlanFact[];
  dailyPlanItems: readonly WhyDailyPlanItemFact[];
  weeklyObjectives: readonly WhyWeeklyObjectiveFact[];
  habitCheckIns: readonly WhyCheckInFact[];
  /** When the snapshot was fetched. Missing = treat as fresh. */
  snapshotAt?: DateValue | null;
  /**
   * First local day the `habitCheckIns` list covers (the snapshot range start). Build note: only with this can
   * the engine honestly say "not done in N days" for a habit with no completion in the list. Missing = unknown,
   * and that branch of `habit_gap` stays silent.
   */
  habitCheckInsFrom?: string | null;
};

export type WhyReasonKind =
  | "deadline_missed" | "deadline_soon" | "unblocks" | "in_today_plan" | "milestone_soon"
  | "project_due" | "goal_due_soon" | "project_at_risk" | "weekly_objective" | "carried_over"
  | "recurring_today" | "goal_link"
  | "streak_at_risk" | "week_target" | "habit_gap" | "habit_goal";

export type WhyFamily = "deadline" | "blocking" | "plan" | "goal" | "project" | "week" | "history" | "repeat" | "streak" | "target" | "gap";
export type WhyTone = "off" | "risk" | "accent" | "neutral";
export type WhyIcon = "CalendarX2" | "CalendarClock" | "LockOpen" | "ClipboardCheck" | "Milestone" | "FolderKanban"
  | "Target" | "TriangleAlert" | "Crosshair" | "History" | "Repeat" | "Flame" | "CalendarRange" | "Hourglass";
export type WhyRef = { kind: "task" | "goal" | "project" | "milestone" | "weekly_objective" | "daily_plan" | "habit"; id: string };

export type WhyReason = {
  kind: WhyReasonKind;
  family: WhyFamily;
  /** 1 = strongest. Fixed per kind (tables in §3). */
  rank: number;
  tone: WhyTone;
  /** A lucide-react export name. The UI maps it; the engine stays free of React. */
  icon: WhyIcon;
  /** Chip copy, about 24 characters or fewer, never names a record. */
  short: string;
  /** Sentence for detail and "because" lines; titles cut at 40 characters. */
  long: string;
  /** Full sentence with full titles, for screen readers and tooltips. */
  accessible: string;
  /** What a tap on the detail tile opens, or null. */
  ref: WhyRef | null;
  /** The numbers behind the copy, for tests and debugging. */
  basis: { days?: number; count?: number; localDate?: string };
};

/**
 * Where reasons are shown. Names describe the row pattern, not a page, so they follow rows into merged pages
 * (interview Q49): `today_row` is the Today "because" line wherever Today rows live (Today absorbs Plan › Daily);
 * task rows on Tasks, Goals › Timeline and Insights use `task_row`; the Dashboard uses only `dashboard_up_next` (Q47).
 */
export type WhySurface = "task_row" | "inbox_triage" | "task_detail" | "today_row" | "dashboard_up_next" | "habit_row";

/** Tunable windows (owner-approved, interview Q45). One source for the engine, the tests and later tweaks. */
export const WHY_WINDOWS = {
  deadlineSoonDays: 3,
  milestoneDays: 14,
  projectDays: 14,
  goalDays: 30,
  carriedOverMin: 2,
  streakMin: 3,
  streakLookbackDays: 28,
  habitGapDays: 7,
  habitGapLookbackDays: 60,
  titleMax: 40,
  riskNoteMax: 80,
} as const;

const RANK: Record<WhyReasonKind, number> = {
  deadline_missed: 1, deadline_soon: 2, unblocks: 3, in_today_plan: 4, milestone_soon: 5, project_due: 6,
  goal_due_soon: 7, project_at_risk: 8, weekly_objective: 9, carried_over: 10, recurring_today: 11, goal_link: 12,
  streak_at_risk: 1, week_target: 2, habit_gap: 3, habit_goal: 4,
};

const FAMILY: Record<WhyReasonKind, WhyFamily> = {
  deadline_missed: "deadline", deadline_soon: "deadline", unblocks: "blocking", in_today_plan: "plan",
  milestone_soon: "goal", project_due: "project", goal_due_soon: "goal", project_at_risk: "project",
  weekly_objective: "week", carried_over: "history", recurring_today: "repeat", goal_link: "goal",
  streak_at_risk: "streak", week_target: "target", habit_gap: "gap", habit_goal: "goal",
};

const ICON: Record<WhyReasonKind, WhyIcon> = {
  deadline_missed: "CalendarX2", deadline_soon: "CalendarClock", unblocks: "LockOpen", in_today_plan: "ClipboardCheck",
  milestone_soon: "Milestone", project_due: "FolderKanban", goal_due_soon: "Target", project_at_risk: "TriangleAlert",
  weekly_objective: "Crosshair", carried_over: "History", recurring_today: "Repeat", goal_link: "Target",
  streak_at_risk: "Flame", week_target: "CalendarRange", habit_gap: "Hourglass", habit_goal: "Target",
};

/** Reasons that depend on today's state; dropped when the snapshot is from an earlier local day (§3.4). */
const TODAY_STATE_KINDS = new Set<WhyReasonKind>(["in_today_plan", "recurring_today", "streak_at_risk", "week_target", "habit_gap"]);

type SurfaceRule = { max: number; suppress: ReadonlySet<WhyReasonKind> };

/**
 * §3.5 plus the owner answers. Q42: "Supports a goal" (`goal_link`) shows only on `task_detail` and
 * `inbox_triage`, so it is suppressed on every other task surface (the spec table only listed `task_row`).
 */
const SURFACES: Record<WhySurface, SurfaceRule> = {
  task_row: { max: 1, suppress: new Set<WhyReasonKind>(["deadline_missed", "deadline_soon", "recurring_today", "goal_link"]) },
  inbox_triage: { max: 1, suppress: new Set<WhyReasonKind>() },
  task_detail: { max: 3, suppress: new Set<WhyReasonKind>() },
  today_row: { max: 1, suppress: new Set<WhyReasonKind>(["in_today_plan", "recurring_today", "goal_link"]) },
  dashboard_up_next: { max: 1, suppress: new Set<WhyReasonKind>(["in_today_plan", "goal_link"]) },
  habit_row: { max: 1, suppress: new Set<WhyReasonKind>() },
};

// ---------------------------------------------------------------------------------------------------------
// Index: built once per facts object (module WeakMap). It never changes the output, only the cost.

type Index = {
  tasksById: Map<string, WhyTask>;
  goalsById: Map<string, WhyGoalFact>;
  projectsById: Map<string, WhyProjectFact>;
  milestonesByGoal: Map<string, WhyMilestoneFact[]>;
  hardEdgesByPrerequisite: Map<string, DependencyEdge[]>;
  occurrencesByTask: Map<string, TaskOccurrenceLike[]>;
  plansById: Map<string, WhyDailyPlanFact>;
  planItemsByTask: Map<string, WhyDailyPlanItemFact[]>;
  checkInsByHabit: Map<string, WhyCheckInFact[]>;
};

const indexCache = new WeakMap<WhyFacts, Index>();

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function indexFor(facts: WhyFacts): Index {
  const cached = indexCache.get(facts);
  if (cached) return cached;
  const index: Index = {
    tasksById: new Map(), goalsById: new Map(), projectsById: new Map(), milestonesByGoal: new Map(),
    hardEdgesByPrerequisite: new Map(), occurrencesByTask: new Map(), plansById: new Map(), planItemsByTask: new Map(),
    checkInsByHabit: new Map(),
  };
  for (const task of facts.tasks ?? []) index.tasksById.set(task.id, task);
  for (const goal of facts.goals ?? []) index.goalsById.set(goal.id, goal);
  for (const project of facts.projects ?? []) index.projectsById.set(project.id, project);
  for (const milestone of facts.milestones ?? []) push(index.milestonesByGoal, milestone.goalId, milestone);
  for (const edge of facts.dependencies ?? []) if (edge.dependencyType === "hard") push(index.hardEdgesByPrerequisite, edge.dependsOnTaskId, edge);
  for (const occurrence of facts.occurrences ?? []) push(index.occurrencesByTask, occurrence.taskId, occurrence);
  for (const plan of facts.dailyPlans ?? []) index.plansById.set(plan.id, plan);
  for (const item of facts.dailyPlanItems ?? []) push(index.planItemsByTask, item.taskId, item);
  for (const checkIn of facts.habitCheckIns ?? []) push(index.checkInsByHabit, checkIn.habitId, checkIn);
  indexCache.set(facts, index);
  return index;
}

// ---------------------------------------------------------------------------------------------------------
// Copy helpers

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function cut(text: string, max: number) {
  const clean = text.trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Curly-quoted title, cut for `long`. */
function quoted(title: string) {
  return `“${cut(title, WHY_WINDOWS.titleMax)}”`;
}

/** Curly-quoted full title, for `accessible`. */
function quotedFull(title: string) {
  return `“${title.trim()}”`;
}

/** "today", "tomorrow", "in N days". */
function dayWords(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** Builds a reason from copy where `{t}` stands for a title: cut in `long`, whole in `accessible`. */
function reason(
  kind: WhyReasonKind,
  tone: WhyTone,
  short: string,
  long: (q: (title: string) => string) => string,
  ref: WhyRef | null,
  basis: WhyReason["basis"],
): WhyReason {
  return {
    kind, family: FAMILY[kind], rank: RANK[kind], tone, icon: ICON[kind], short,
    long: long(quoted), accessible: long(quotedFull), ref, basis,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Shared predicates

const zoneValidity = new Map<string, boolean>();

function isValidTimeZone(timezone: string) {
  if (typeof timezone !== "string" || !timezone) return false;
  const known = zoneValidity.get(timezone);
  if (known !== undefined) return known;
  let valid = false;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone });
    valid = true;
  } catch {
    valid = false;
  }
  zoneValidity.set(timezone, valid);
  return valid;
}

/** `localDateForInstant(now, timezone)`, remembered for the last (instant, zone) pair: a list asks once per row. */
let lastToday: { ms: number; timezone: string; today: string | null } | null = null;

function todayFor(now: Date, timezone: string) {
  const ms = now instanceof Date ? now.getTime() : Number.NaN;
  if (!Number.isFinite(ms)) return null;
  if (lastToday && lastToday.ms === ms && lastToday.timezone === timezone) return lastToday.today;
  const today = localDateForInstant(now, timezone);
  lastToday = { ms, timezone, today };
  return today;
}

/** Exists, not completed or archived, and no archivedAt (§3.3). */
function isActiveRecord(record: { state: string; archivedAt?: DateValue | null } | undefined | null): boolean {
  return Boolean(record && record.state !== "completed" && record.state !== "archived" && !record.archivedAt);
}

function isFinishedTask(task: WhyTask) {
  return task.state === "completed" || task.state === "archived" || Boolean(task.archivedAt) || task.outcome === "wont_do";
}

function isOpenTask(task: WhyTask | undefined): task is WhyTask {
  return Boolean(task && !isFinishedTask(task));
}

function isStale(facts: WhyFacts, today: string, timezone: string) {
  if (!facts.snapshotAt) return false;
  const day = localDateForInstant(facts.snapshotAt, timezone);
  return Boolean(day && day < today);
}

/** Monday-start week, the same three-line rule as `weekStartFor` in client/src/features/planning/planBoard.ts. */
export function mondayWeekStart(localDate: string) {
  const weekday = new Date(`${localDate}T12:00:00.000Z`).getUTCDay();
  return shiftLocalDate(localDate, weekday === 0 ? -6 : 1 - weekday);
}

/** Per kind, best-ranked first, at most one per family. */
function finalize(reasons: WhyReason[]) {
  const sorted = [...reasons].sort((left, right) => left.rank - right.rank);
  const seen = new Set<WhyFamily>();
  const result: WhyReason[] = [];
  for (const item of sorted) {
    if (seen.has(item.family)) continue;
    seen.add(item.family);
    result.push(item);
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------
// Task rules

function unblocksReason(task: WhyTask, index: Index): WhyReason | null {
  const edges = index.hardEdgesByPrerequisite.get(task.id) ?? [];
  if (!edges.length) return null;
  const { blocksIds } = dependencyExecutionState(task.id, [...edges], []);
  const dependents = Array.from(new Set(blocksIds))
    .map(id => index.tasksById.get(id))
    .filter(isOpenTask)
    .sort((left, right) => {
      const leftDue = left.dueLocalDate ?? "9999-12-31";
      const rightDue = right.dueLocalDate ?? "9999-12-31";
      return leftDue.localeCompare(rightDue) || left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
    });
  if (!dependents.length) return null;
  const first = dependents[0];
  const count = dependents.length;
  return reason(
    "unblocks", "accent", `Unblocks ${plural(count, "task", "tasks")}`,
    q => count === 1 ? `${q(first.title)} is waiting on this.` : `${count} tasks are waiting on this, including ${q(first.title)}.`,
    { kind: "task", id: first.id }, { count },
  );
}

function deadlineReason(task: WhyTask, today: string, timezone: string): WhyReason | null {
  const due = task.dueLocalDate;
  if (!due) return null;
  if (isOverdueTask(task, today)) {
    const days = overdueDays(due, today);
    return reason(
      "deadline_missed", "off", `Overdue ${plural(days, "day", "days")}`,
      () => days === 1 ? "The deadline was yesterday." : `The deadline was ${weekdayDayMonthLabel(due)}, ${days} days ago.`,
      null, { days, localDate: due },
    );
  }
  if (deadlineIsSeriesAnchor(task)) return null;
  const days = localDaysBetween(today, due);
  if (days < 0 || days > WHY_WINDOWS.deadlineSoonDays) return null;
  // Same test as `deadlineRiskForTask` (a Plan for on or before the deadline), widened to a reservation on or
  // before the deadline (spec test 28). The reservation day comes from `reservedLocalDate`, never a UTC slice.
  const reserved = reservedLocalDate(task, timezone);
  const planned = Boolean((task.scheduledLocalDate && task.scheduledLocalDate <= due) || (reserved && reserved <= due));
  const short = days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
  return reason(
    "deadline_soon", days <= 1 ? "risk" : "neutral", short,
    () => `Due ${weekdayDayMonthLabel(due)}.${planned ? "" : " Not planned yet."}`,
    null, { days, localDate: due },
  );
}

function todayPlanReason(task: WhyTask, today: string, index: Index): WhyReason | null {
  const plan = (index.planItemsByTask.get(task.id) ?? [])
    .filter(item => item.state === "committed")
    .map(item => index.plansById.get(item.dailyPlanId))
    .filter((item): item is WhyDailyPlanFact => Boolean(item && item.localDate === today && (item.state === "draft" || item.state === "active")))
    .sort((left, right) => left.id.localeCompare(right.id))[0];
  if (!plan) return null;
  return reason("in_today_plan", "accent", "On today's plan", () => "You committed to this in today's plan.", { kind: "daily_plan", id: plan.id }, { localDate: today });
}

function carriedOverReason(task: WhyTask, today: string, index: Index): WhyReason | null {
  const rollovers = Math.max(0, Math.floor(Number(task.rescheduleCount ?? 0)) || 0);
  let planMoves = 0;
  for (const item of index.planItemsByTask.get(task.id) ?? []) {
    if (item.state !== "rescheduled" && item.state !== "deferred") continue;
    const plan = index.plansById.get(item.dailyPlanId);
    if (plan && plan.localDate < today) planMoves += 1;
  }
  const count = rollovers + planMoves;
  if (count < WHY_WINDOWS.carriedOverMin) return null;
  return reason("carried_over", "risk", `Pushed back ${count} times`, () => `This has moved to a later day ${count} times.`, null, { count });
}

function recurringReason(task: WhyTask, today: string, index: Index): WhyReason | null {
  const status = recurringTaskStatus(task, today, index.occurrencesByTask.get(task.id) ?? []);
  if (status?.kind !== "pending_today") return null;
  const cadence = recurrenceCadenceLabel(status.rule).toLowerCase();
  return reason("recurring_today", "accent", "Today's repeat", () => `This repeats ${cadence}, and today's one is still open.`, null, { localDate: today });
}

function goalReasons(goal: WhyGoalFact, today: string, index: Index): WhyReason[] {
  const out: WhyReason[] = [];
  const milestone = (index.milestonesByGoal.get(goal.id) ?? [])
    .filter(item => isActiveRecord(item) && item.dueLocalDate)
    .map(item => ({ item, days: localDaysBetween(today, item.dueLocalDate!) }))
    .filter(entry => entry.days >= 0 && entry.days <= WHY_WINDOWS.milestoneDays)
    .sort((left, right) => left.days - right.days || left.item.title.localeCompare(right.item.title) || left.item.id.localeCompare(right.item.id))[0];
  if (milestone) {
    const { item, days } = milestone;
    out.push(reason(
      "milestone_soon", "neutral", days === 0 ? "Milestone today" : `Milestone ${dayWords(days)}`,
      q => `Your goal ${q(goal.title)} has a milestone, ${q(item.title)}, due ${weekdayDayMonthLabel(item.dueLocalDate!)}.`,
      { kind: "milestone", id: item.id }, { days, localDate: item.dueLocalDate! },
    ));
  }
  if (goal.intentionKind !== "direction" && goal.dueLocalDate) {
    const days = localDaysBetween(today, goal.dueLocalDate);
    if (days >= 0 && days <= WHY_WINDOWS.goalDays) {
      out.push(reason(
        "goal_due_soon", "neutral", `Goal due ${dayWords(days)}`,
        q => `This supports ${q(goal.title)}, due ${weekdayDayMonthLabel(goal.dueLocalDate!)}.`,
        { kind: "goal", id: goal.id }, { days, localDate: goal.dueLocalDate },
      ));
    }
  }
  // `goal_link` only when no other goal-family reason fired; `finalize` keeps the best one anyway.
  if (!out.length) out.push(reason("goal_link", "neutral", "Supports a goal", q => `This supports ${q(goal.title)}.`, { kind: "goal", id: goal.id }, {}));
  return out;
}

function projectReasons(project: WhyProjectFact, today: string): WhyReason[] {
  const out: WhyReason[] = [];
  const ref: WhyRef = { kind: "project", id: project.id };
  if (project.dueLocalDate) {
    const due = project.dueLocalDate;
    const days = localDaysBetween(today, due);
    if (days <= WHY_WINDOWS.projectDays) {
      if (days < 0) {
        out.push(reason("project_due", "risk", "Project past its date", q => `Part of ${q(project.title)}, which passed its date on ${dayMonthLabel(due)}.`, ref, { days, localDate: due }));
      } else {
        out.push(reason("project_due", "neutral", `Project due ${dayWords(days)}`, q => `Part of ${q(project.title)}, due ${weekdayDayMonthLabel(due)}.`, ref, { days, localDate: due }));
      }
    }
  }
  const blocked = project.riskLevel === "blocked" || project.state === "blocked";
  if (blocked || project.riskLevel === "at_risk") {
    const label = blocked ? "blocked" : "at risk";
    const note = project.riskNote?.trim() ? cut(project.riskNote.replace(/\s+/g, " "), WHY_WINDOWS.riskNoteMax) : "";
    const tail = note ? `: ${note}${/[.!?…]$/.test(note) ? "" : "."}` : ".";
    out.push(reason("project_at_risk", "risk", blocked ? "Project blocked" : "Project at risk", q => `${q(project.title)} is marked ${label}${tail}`, ref, {}));
  }
  return out;
}

function weeklyObjectiveReason(task: WhyTask, goal: WhyGoalFact | null, today: string, facts: WhyFacts): WhyReason | null {
  const match = (facts.weeklyObjectives ?? [])
    .filter(item => item.state === "active" && !item.archivedAt
      && item.weekStartLocalDate <= today && today <= shiftLocalDate(item.weekStartLocalDate, 6)
      && ((task.projectId && item.projectId === task.projectId) || (goal && item.goalId === goal.id)))
    .sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id))[0];
  if (!match) return null;
  return reason("weekly_objective", "accent", "This week's aim", q => `Part of this week's aim: ${q(match.title)}.`, { kind: "weekly_objective", id: match.id }, { localDate: match.weekStartLocalDate });
}

function taskReasons(task: WhyTask, facts: WhyFacts, today: string, timezone: string): WhyReason[] {
  if (isFinishedTask(task)) return [];
  const index = indexFor(facts);
  const unblocks = unblocksReason(task, index);
  // Q46: Someday is a decision to park the task; only "Unblocks N tasks" may fire.
  if (task.horizon === "someday") return unblocks ? [unblocks] : [];

  const project = task.projectId ? index.projectsById.get(task.projectId) : undefined;
  const activeProject = isActiveRecord(project) ? project! : null;
  const goal = resolvedGoalFor(task, index);

  const reasons: Array<WhyReason | null> = [
    deadlineReason(task, today, timezone),
    unblocks,
    todayPlanReason(task, today, index),
    carriedOverReason(task, today, index),
    recurringReason(task, today, index),
    weeklyObjectiveReason(task, goal, today, facts),
  ];
  if (goal) reasons.push(...goalReasons(goal, today, index));
  if (activeProject) reasons.push(...projectReasons(activeProject, today));

  let list = reasons.filter((item): item is WhyReason => item !== null);
  if (isStale(facts, today, timezone)) list = list.filter(item => !TODAY_STATE_KINDS.has(item.kind));
  return finalize(list);
}

/** §3.3: `active(task.goalId) ?? active(project(task.projectId).goalId) ?? null`. */
function resolvedGoalFor(task: WhyTask, index: Index): WhyGoalFact | null {
  const direct = task.goalId ? index.goalsById.get(task.goalId) : undefined;
  if (isActiveRecord(direct)) return direct!;
  const project = task.projectId ? index.projectsById.get(task.projectId) : undefined;
  const viaProject = project?.goalId ? index.goalsById.get(project.goalId) : undefined;
  return isActiveRecord(viaProject) ? viaProject! : null;
}

// ---------------------------------------------------------------------------------------------------------
// Habit rules

function habitReasons(habit: WhyHabit, facts: WhyFacts, today: string, timezone: string): WhyReason[] {
  if (habit.archivedAt) return [];
  const index = indexFor(facts);
  const checkIns = index.checkInsByHabit.get(habit.id) ?? [];
  if (checkIns.some(item => item.localDate === today)) return [];
  const out: WhyReason[] = [];
  const scheduledToday = isHabitScheduledOnLocalDate(habit, today);

  if (scheduledToday) {
    const earliest = shiftLocalDate(today, -(WHY_WINDOWS.streakLookbackDays - 1));
    const { streak, capped } = habitStreakDetail(habit, checkIns, today, earliest);
    if (streak >= WHY_WINDOWS.streakMin) {
      const shown = capped ? `${streak}+` : `${streak}`;
      out.push(reason(
        "streak_at_risk", "accent", `${shown} day streak`,
        () => `Your streak is ${shown} days. Doing it today keeps it going.`,
        null, { count: streak },
      ));
    }
  }

  const target = habitWeeklyTarget(habit);
  if (target !== null && isHabitAvailableOnLocalDate(habit, today)) {
    const weekStart = mondayWeekStart(today);
    const weekEnd = shiftLocalDate(weekStart, 6);
    const done = checkIns.filter(item => item.state === "completed" && item.localDate >= weekStart && item.localDate <= weekEnd).length;
    const remaining = target - done;
    const daysLeft = localDaysBetween(today, weekEnd) + 1;
    if (remaining > 0 && remaining >= daysLeft) {
      out.push(reason(
        "week_target", remaining === daysLeft ? "risk" : "neutral", `${remaining} more, ${plural(daysLeft, "day", "days")} left`,
        () => `Your target is ${target} this week. ${done} done, ${plural(daysLeft, "day", "days")} left.`,
        null, { count: remaining, days: daysLeft },
      ));
    }
  }

  if (scheduledToday) {
    const lookback = shiftLocalDate(today, -WHY_WINDOWS.habitGapLookbackDays);
    const lastDone = checkIns
      .filter(item => item.state === "completed" && item.localDate < today && item.localDate >= lookback)
      .map(item => item.localDate)
      .sort()
      .pop();
    if (lastDone) {
      const days = localDaysBetween(lastDone, today);
      if (days >= WHY_WINDOWS.habitGapDays) {
        out.push(reason("habit_gap", "neutral", `Last done ${days} days ago`, () => `Last done ${weekdayDayMonthLabel(lastDone)}, ${days} days ago.`, null, { days, localDate: lastDone }));
      }
    } else {
      // No completion in the lookback: only speak when the list provably covers the whole lookback and the
      // habit is older than the gap window (build note in the spec).
      const start = habitStartLocalDate(habit);
      const age = start ? localDaysBetween(start, today) : null;
      const covered = Boolean(facts.habitCheckInsFrom && facts.habitCheckInsFrom <= lookback);
      if (covered && age !== null && age > WHY_WINDOWS.habitGapDays) {
        const days = Math.min(age, WHY_WINDOWS.habitGapLookbackDays);
        const shown = age > WHY_WINDOWS.habitGapLookbackDays ? `${days}+` : `${days}`;
        out.push(reason("habit_gap", "neutral", `Not done in ${shown} days`, () => `Not done in the last ${shown} days.`, null, { days }));
      }
    }
  }

  if (habit.goalId) {
    const goal = index.goalsById.get(habit.goalId);
    if (isActiveRecord(goal)) out.push(reason("habit_goal", "neutral", "Supports a goal", q => `This supports ${q(goal!.title)}.`, { kind: "goal", id: goal!.id }, {}));
  }

  const list = isStale(facts, today, timezone) ? out.filter(item => !TODAY_STATE_KINDS.has(item.kind)) : out;
  return finalize(list);
}

// ---------------------------------------------------------------------------------------------------------
// Public API

/**
 * All reasons for one task or habit, best first, at most one per family.
 * `today` = localDateForInstant(now, timezone). Pure and deterministic: same inputs, same output.
 * Returns [] for finished work, an archived habit, an invalid timezone, or when no rule fires. Never throws.
 */
export function whyItMatters(entity: WhyEntity, facts: WhyFacts, now: Date, timezone: string): WhyReason[] {
  try {
    if (!entity || !facts || !isValidTimeZone(timezone)) return [];
    const today = todayFor(now, timezone);
    if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
    if (entity.kind === "task") return taskReasons(entity.task, facts, today, timezone);
    if (entity.kind === "habit") return habitReasons(entity.habit, facts, today, timezone);
    return [];
  } catch {
    return [];
  }
}

/** Drops what the surface already shows (§3.5, Q42), then keeps the first N in rank order. */
export function reasonsForSurface(reasons: readonly WhyReason[], surface: WhySurface): WhyReason[] {
  const rule = SURFACES[surface];
  if (!rule) return [];
  return [...reasons].sort((left, right) => left.rank - right.rank).filter(item => !rule.suppress.has(item.kind)).slice(0, rule.max);
}

/** Convenience: the single reason a one-line surface shows, or null. */
export function topReason(entity: WhyEntity, facts: WhyFacts, now: Date, timezone: string, surface: WhySurface): WhyReason | null {
  return reasonsForSurface(whyItMatters(entity, facts, now, timezone), surface)[0] ?? null;
}

/**
 * What the detail "Why it matters" section renders (spec §5.2, interview Q43):
 * - `reasons`: up to 3 rows (the `task_detail` surface).
 * - `empty`: an open, non-Someday task with no reason. Show `message` as one muted line plus a
 *   "Link to a goal" text button (`action: "link_goal"`). The message says "goal or project" only when the
 *   task has neither, so it is never false for a task that sits in a project with no goal.
 * - `hidden`: render nothing (done, archived, won't do, Someday with no reason, a habit with no reason,
 *   or an invalid timezone).
 */
export type WhyDetailSection =
  | { kind: "reasons"; reasons: WhyReason[] }
  | { kind: "empty"; message: string; action: "link_goal" }
  | { kind: "hidden" };

export const WHY_EMPTY_MESSAGES = {
  unlinked: "Not linked to a goal or project yet.",
  projectOnly: "Not linked to a goal yet.",
} as const;

export function whyDetailSection(entity: WhyEntity, facts: WhyFacts, now: Date, timezone: string): WhyDetailSection {
  const reasons = reasonsForSurface(whyItMatters(entity, facts, now, timezone), "task_detail");
  if (reasons.length) return { kind: "reasons", reasons };
  if (!entity || entity.kind !== "task" || !facts || !isValidTimeZone(timezone)) return { kind: "hidden" };
  const task = entity.task;
  if (isFinishedTask(task) || task.horizon === "someday") return { kind: "hidden" };
  const project = task.projectId ? indexFor(facts).projectsById.get(task.projectId) : undefined;
  return { kind: "empty", message: isActiveRecord(project) ? WHY_EMPTY_MESSAGES.projectOnly : WHY_EMPTY_MESSAGES.unlinked, action: "link_goal" };
}
