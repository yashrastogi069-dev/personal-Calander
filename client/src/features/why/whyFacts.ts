// D4 adapter: planner snapshot (`trpc.planner.workspace.snapshot`) → `WhyFacts` for the reason engine
// (spec D4 §4.1). A plain function, no hooks, so it runs in node tests; memoised per snapshot object so a list
// that asks once per row builds the facts (and the engine's WeakMap index) only once. Read-only: it never
// reads the workspace timezone; callers pass `safeTimeZone(workspace.timezone)` to the engine themselves.

import type { DependencyEdge } from "@shared/dependencyPolicy";
import type { TaskOccurrenceLike } from "@shared/taskRecurrence";
import type {
  WhyCheckInFact,
  WhyDailyPlanFact,
  WhyDailyPlanItemFact,
  WhyFacts,
  WhyGoalFact,
  WhyHabit,
  WhyMilestoneFact,
  WhyProjectFact,
  WhyTask,
  WhyWeeklyObjectiveFact,
} from "@shared/whyItMatters";

type DateValue = Date | string;
type Row = Record<string, unknown>;

/** The snapshot fields the adapter reads. The client snapshot is untyped (`any`), so every field is optional. */
export type WhySnapshotLike = {
  tasks?: readonly unknown[] | null;
  goals?: readonly unknown[] | null;
  milestones?: readonly unknown[] | null;
  projects?: readonly unknown[] | null;
  taskDependencies?: readonly unknown[] | null;
  taskOccurrences?: readonly unknown[] | null;
  dailyPlans?: readonly unknown[] | null;
  dailyPlanItems?: readonly unknown[] | null;
  weeklyObjectives?: readonly unknown[] | null;
  habits?: readonly unknown[] | null;
  habitCheckIns?: readonly unknown[] | null;
};

export type WhyFactsOptions = {
  /** When the snapshot was fetched, e.g. react-query `dataUpdatedAt`. Missing = treat as fresh. */
  snapshotAt?: DateValue | number | null;
  /** First local day of the range the snapshot was requested with (`{ start }` passed to the query). */
  rangeStart?: string | null;
};

function rows(value: readonly unknown[] | null | undefined): Row[] {
  return Array.isArray(value) ? value.filter((item): item is Row => Boolean(item) && typeof item === "object") : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length ? value : null;
}

function dateValue(value: unknown): DateValue | null {
  if (value instanceof Date) return value;
  return typeof value === "string" && value.length ? value : null;
}

function localDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function hasIds<T extends { id: string }>(list: Array<T | null>): T[] {
  return list.filter((item): item is T => item !== null);
}

export function toWhyTask(row: Row): WhyTask | null {
  const id = str(row.id);
  if (!id) return null;
  const count = Number(row.rescheduleCount);
  return {
    id,
    title: typeof row.title === "string" ? row.title : "",
    state: str(row.state) ?? "not_started",
    horizon: str(row.horizon),
    outcome: str(row.outcome),
    archivedAt: dateValue(row.archivedAt),
    goalId: str(row.goalId),
    projectId: str(row.projectId),
    dueLocalDate: localDate(row.dueLocalDate),
    scheduledLocalDate: localDate(row.scheduledLocalDate),
    plannedStartAt: dateValue(row.plannedStartAt),
    plannedEndAt: dateValue(row.plannedEndAt),
    recurrenceRule: row.recurrenceRule ?? null,
    recurrenceAnchor: str(row.recurrenceAnchor),
    recurrenceUntilLocalDate: localDate(row.recurrenceUntilLocalDate),
    rescheduleCount: Number.isFinite(count) ? count : 0,
    createdAt: dateValue(row.createdAt),
  };
}

const HABIT_FREQUENCIES = new Set(["daily", "days_of_week", "times_per_week", "interval"]);

/** A snapshot habit row → the engine's habit entity, or null when it is not a usable habit. */
export function toWhyHabit(row: Row): WhyHabit | null {
  const id = str(row.id);
  const frequency = str(row.frequency);
  if (!id || !frequency || !HABIT_FREQUENCIES.has(frequency)) return null;
  return {
    id,
    name: typeof row.name === "string" ? row.name : "",
    frequency: frequency as WhyHabit["frequency"],
    schedule: row.schedule ?? null,
    goalId: str(row.goalId),
    archivedAt: dateValue(row.archivedAt),
    createdAt: dateValue(row.createdAt),
  };
}

function buildFacts(snapshot: WhySnapshotLike, options: WhyFactsOptions): WhyFacts {
  const tasks = hasIds(rows(snapshot.tasks).map(toWhyTask));
  const goals = hasIds(rows(snapshot.goals).map((row): WhyGoalFact | null => {
    const id = str(row.id);
    return id ? { id, title: typeof row.title === "string" ? row.title : "", state: str(row.state) ?? "not_started", intentionKind: str(row.intentionKind), dueLocalDate: localDate(row.dueLocalDate), archivedAt: dateValue(row.archivedAt) } : null;
  }));
  const milestones = hasIds(rows(snapshot.milestones).map((row): WhyMilestoneFact | null => {
    const id = str(row.id);
    const goalId = str(row.goalId);
    return id && goalId ? { id, goalId, title: typeof row.title === "string" ? row.title : "", state: str(row.state) ?? "not_started", dueLocalDate: localDate(row.dueLocalDate), archivedAt: dateValue(row.archivedAt) } : null;
  }));
  const projects = hasIds(rows(snapshot.projects).map((row): WhyProjectFact | null => {
    const id = str(row.id);
    return id ? { id, title: typeof row.title === "string" ? row.title : "", state: str(row.state) ?? "not_started", goalId: str(row.goalId), dueLocalDate: localDate(row.dueLocalDate), riskLevel: str(row.riskLevel), riskNote: typeof row.riskNote === "string" ? row.riskNote : null, archivedAt: dateValue(row.archivedAt) } : null;
  }));
  const dependencies: DependencyEdge[] = rows(snapshot.taskDependencies).flatMap(row => {
    const taskId = str(row.taskId);
    const dependsOnTaskId = str(row.dependsOnTaskId);
    if (!taskId || !dependsOnTaskId) return [];
    return [{ taskId, dependsOnTaskId, dependencyType: row.dependencyType === "soft" ? "soft" as const : "hard" as const }];
  });
  const occurrences: TaskOccurrenceLike[] = rows(snapshot.taskOccurrences).flatMap(row => {
    const id = str(row.id);
    const taskId = str(row.taskId);
    const day = localDate(row.localDate);
    if (!id || !taskId || !day) return [];
    return [{ id, taskId, localDate: day, state: str(row.state) ?? "pending", ...(typeof row.version === "number" ? { version: row.version } : {}) }];
  });
  const dailyPlans = hasIds(rows(snapshot.dailyPlans).map((row): WhyDailyPlanFact | null => {
    const id = str(row.id);
    const day = localDate(row.localDate);
    return id && day ? { id, localDate: day, state: str(row.state) ?? "draft" } : null;
  }));
  const dailyPlanItems: WhyDailyPlanItemFact[] = rows(snapshot.dailyPlanItems).flatMap(row => {
    const dailyPlanId = str(row.dailyPlanId);
    const taskId = str(row.taskId);
    return dailyPlanId && taskId ? [{ dailyPlanId, taskId, state: str(row.state) ?? "committed" }] : [];
  });
  const weeklyObjectives = hasIds(rows(snapshot.weeklyObjectives).map((row): WhyWeeklyObjectiveFact | null => {
    const id = str(row.id);
    const week = localDate(row.weekStartLocalDate);
    return id && week ? { id, title: typeof row.title === "string" ? row.title : "", state: str(row.state) ?? "active", weekStartLocalDate: week, goalId: str(row.goalId), projectId: str(row.projectId), archivedAt: dateValue(row.archivedAt) } : null;
  }));
  const habitCheckIns: WhyCheckInFact[] = rows(snapshot.habitCheckIns).flatMap(row => {
    const habitId = str(row.habitId);
    const day = localDate(row.localDate);
    const state = str(row.state);
    return habitId && day && state ? [{ habitId, localDate: day, state }] : [];
  });
  const snapshotAt = typeof options.snapshotAt === "number"
    ? (options.snapshotAt > 0 ? new Date(options.snapshotAt) : null)
    : options.snapshotAt ?? null;
  return {
    tasks, goals, milestones, projects, dependencies, occurrences, dailyPlans, dailyPlanItems, weeklyObjectives, habitCheckIns,
    snapshotAt,
    habitCheckInsFrom: localDate(options.rangeStart) ?? null,
  };
}

type CacheEntry = { snapshotAt: WhyFactsOptions["snapshotAt"]; rangeStart: string | null | undefined; facts: WhyFacts };
const cache = new WeakMap<object, CacheEntry>();

const EMPTY_FACTS: WhyFacts = Object.freeze({
  tasks: [], goals: [], milestones: [], projects: [], dependencies: [], occurrences: [], dailyPlans: [], dailyPlanItems: [],
  weeklyObjectives: [], habitCheckIns: [], snapshotAt: null, habitCheckInsFrom: null,
});

function sameInstant(left: WhyFactsOptions["snapshotAt"], right: WhyFactsOptions["snapshotAt"]) {
  const ms = (value: WhyFactsOptions["snapshotAt"]) => value == null ? null : value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  return ms(left) === ms(right);
}

/**
 * Snapshot → `WhyFacts`, memoised per snapshot object (and options). The same snapshot returns the same
 * facts object, so the engine's per-facts index is shared by every row. A missing snapshot yields empty facts.
 */
export function whyFactsFromSnapshot(snapshot: WhySnapshotLike | null | undefined, options: WhyFactsOptions = {}): WhyFacts {
  if (!snapshot || typeof snapshot !== "object") return EMPTY_FACTS;
  const cached = cache.get(snapshot);
  if (cached && cached.rangeStart === options.rangeStart && sameInstant(cached.snapshotAt, options.snapshotAt)) return cached.facts;
  const facts = buildFacts(snapshot, options);
  cache.set(snapshot, { snapshotAt: options.snapshotAt, rangeStart: options.rangeStart, facts });
  return facts;
}

/** The engine entity for a snapshot habit row (for Today habit rows), or null. */
export function whyHabitFromSnapshot(snapshot: WhySnapshotLike | null | undefined, habitId: string): WhyHabit | null {
  const row = rows(snapshot?.habits).find(item => item.id === habitId);
  return row ? toWhyHabit(row) : null;
}
