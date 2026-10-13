// Recurrence maths shared by the server (occurrence materialization) and the client (occurrence labels,
// When buckets, drop pre-checks). Moved unchanged from server/plannerRules.ts; the server re-exports it.

export type RecurrenceRule = {
  frequency: "daily" | "weekly" | "monthly";
  interval?: number;
  weekdays?: number[];
};

export function shiftLocalDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function isRecurrenceRule(value: unknown): value is RecurrenceRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Record<string, unknown>;
  return rule.frequency === "daily" || rule.frequency === "weekly" || rule.frequency === "monthly";
}

/**
 * The first local date of a series, exactly as occurrence materialization picks it: Plan for, then Deadline,
 * then the UTC calendar day of createdAt. The last fallback mirrors the server so client and server agree on
 * which days are occurrences; it is not a workspace-local date.
 */
export function recurrenceSeriesStart(task: { scheduledLocalDate?: string | null; dueLocalDate?: string | null; createdAt?: Date | string | null }) {
  const planned = task.scheduledLocalDate ?? task.dueLocalDate;
  if (planned != null) return planned;
  if (!task.createdAt) return null;
  const created = task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt);
  return Number.isFinite(created.getTime()) ? created.toISOString().slice(0, 10) : null;
}

/** Checks one date against the same cadence used by occurrence materialization. */
export function isRecurringLocalDate(rule: RecurrenceRule, start: string, localDate: string, until?: string | null) {
  if (localDate < start || (until && localDate > until)) return false;
  const date = new Date(`${localDate}T12:00:00.000Z`);
  const anchor = new Date(`${start}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || Number.isNaN(anchor.getTime())) return false;
  const interval = Math.max(1, Math.floor(rule.interval ?? 1));
  const daysFromStart = Math.floor((date.getTime() - anchor.getTime()) / 86_400_000);
  if (rule.frequency === "daily") return daysFromStart % interval === 0;
  if (rule.frequency === "weekly") return Math.floor(daysFromStart / 7) % interval === 0
    && (rule.weekdays?.includes(date.getUTCDay()) ?? date.getUTCDay() === anchor.getUTCDay());
  const monthOffset = (date.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + date.getUTCMonth() - anchor.getUTCMonth();
  return monthOffset % interval === 0 && date.getUTCDate() === anchor.getUTCDate();
}

export function recurringLocalDates(rule: RecurrenceRule, start: string, end: string, until?: string | null) {
  const cappedEnd = until && until < end ? until : end;
  const results: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= cappedEnd && guard < 5000) {
    if (isRecurringLocalDate(rule, start, cursor, until)) results.push(cursor);
    cursor = shiftLocalDate(cursor, 1);
    guard += 1;
  }
  return results;
}

/** Longest scan for the next occurrence: covers any monthly rule up to a yearly interval twice over. */
const NEXT_OCCURRENCE_SCAN_DAYS = 800;

/**
 * The first cadence day on or after `from` (and on or after the series start), or null when the series has
 * ended or no cadence day falls inside the scan window (for example a weekly rule with no weekdays).
 * `skip` lets a caller pass over days whose occurrence was already resolved.
 */
export function nextRecurringLocalDate(
  rule: RecurrenceRule,
  start: string,
  from: string,
  until?: string | null,
  skip?: (localDate: string) => boolean,
) {
  let cursor = from < start ? start : from;
  for (let guard = 0; guard < NEXT_OCCURRENCE_SCAN_DAYS; guard += 1) {
    if (until && cursor > until) return null;
    if (isRecurringLocalDate(rule, start, cursor, until) && !skip?.(cursor)) return cursor;
    cursor = shiftLocalDate(cursor, 1);
  }
  return null;
}

/** The next `count` cadence days on or after `from`; used for the detail sheet's "Next:" preview. */
export function upcomingRecurringLocalDates(rule: RecurrenceRule, start: string, from: string, count: number, until?: string | null) {
  const dates: string[] = [];
  let cursor = from;
  while (dates.length < count) {
    const next = nextRecurringLocalDate(rule, start, cursor, until);
    if (!next) break;
    dates.push(next);
    cursor = shiftLocalDate(next, 1);
  }
  return dates;
}

/** Owner-facing cadence copy for the Repeat pill. */
export function recurrenceCadenceLabel(rule: RecurrenceRule) {
  const interval = Math.max(1, Math.floor(rule.interval ?? 1));
  if (rule.frequency === "daily") return interval === 1 ? "Daily" : `Every ${interval} days`;
  if (rule.frequency === "weekly") return interval === 1 ? "Weekly" : `Every ${interval} weeks`;
  return interval === 1 ? "Monthly" : `Every ${interval} months`;
}

/** The occurrence fields the client reads from `snapshot.taskOccurrences`. */
export type TaskOccurrenceLike = {
  id: string;
  taskId: string;
  localDate: string;
  state: string;
  version?: number;
};

export type RecurringTaskInput = {
  id: string;
  recurrenceRule?: unknown;
  recurrenceAnchor?: string | null;
  recurrenceUntilLocalDate?: string | null;
  scheduledLocalDate?: string | null;
  dueLocalDate?: string | null;
  createdAt?: Date | string | null;
};

export type RecurringTaskStatus =
  /** Today is an occurrence and it is still open. `occurrence` is null when it is not materialized yet. */
  | { kind: "pending_today"; rule: RecurrenceRule; localDate: string; occurrence: TaskOccurrenceLike | null }
  /** Today's occurrence already has an outcome; `next` is the following occurrence, if any. */
  | { kind: "resolved_today"; rule: RecurrenceRule; localDate: string; state: "completed" | "skipped" | "missed"; next: string | null }
  | { kind: "next"; rule: RecurrenceRule; localDate: string; occurrence: TaskOccurrenceLike | null }
  | { kind: "ended"; rule: RecurrenceRule; until: string }
  /** Completion-anchored series with no materialized future occurrence yet. */
  | { kind: "after_completion"; rule: RecurrenceRule }
  /** A valid rule with no cadence day in reach (for example weekly with an empty weekday list). */
  | { kind: "none"; rule: RecurrenceRule };

const RESOLVED_TODAY_STATES = new Set(["completed", "skipped", "missed"]);

/**
 * Where a recurring series stands on `today` (spec D3 §7). Returns null for a task without a valid rule.
 * Materialized occurrences win; otherwise the date is computed with the server's cadence maths.
 * When `occurrences` is omitted, only computed dates are used (no "done today" knowledge).
 */
export function recurringTaskStatus(
  task: RecurringTaskInput,
  today: string,
  occurrences?: readonly TaskOccurrenceLike[],
): RecurringTaskStatus | null {
  const rule = task.recurrenceRule;
  if (!isRecurrenceRule(rule)) return null;
  const own = (occurrences ?? []).filter(item => item.taskId === task.id);
  const byDate = new Map<string, TaskOccurrenceLike>();
  for (const item of own) {
    const existing = byDate.get(item.localDate);
    // A pending row for a day wins over a stale duplicate so the open occurrence stays actionable.
    if (!existing || item.state === "pending") byDate.set(item.localDate, item);
  }
  const start = recurrenceSeriesStart(task);
  const until = task.recurrenceUntilLocalDate ?? null;
  const tomorrow = shiftLocalDate(today, 1);
  const isResolved = (localDate: string) => {
    const item = byDate.get(localDate);
    return Boolean(item && item.state !== "pending");
  };
  const nextMaterialized = (from: string) => own
    .filter(item => item.state === "pending" && item.localDate >= from && (!until || item.localDate <= until))
    .sort((left, right) => left.localDate.localeCompare(right.localDate))[0] ?? null;
  const nextComputed = (from: string) => (start ? nextRecurringLocalDate(rule, start, from, until, isResolved) : null);
  const completionAnchored = task.recurrenceAnchor === "completion";
  const nextAfter = (from: string) => {
    const materialized = nextMaterialized(from);
    if (completionAnchored) return materialized?.localDate ?? null;
    const computed = nextComputed(from);
    if (materialized && (!computed || materialized.localDate <= computed)) return materialized.localDate;
    return computed;
  };

  const todayOccurrence = byDate.get(today);
  if (todayOccurrence?.state === "pending") return { kind: "pending_today", rule, localDate: today, occurrence: todayOccurrence };
  if (todayOccurrence && RESOLVED_TODAY_STATES.has(todayOccurrence.state)) {
    return { kind: "resolved_today", rule, localDate: today, state: todayOccurrence.state as "completed" | "skipped" | "missed", next: nextAfter(tomorrow) };
  }
  if (until && until < today) return { kind: "ended", rule, until };

  if (completionAnchored) {
    const materialized = nextMaterialized(tomorrow);
    return materialized ? { kind: "next", rule, localDate: materialized.localDate, occurrence: materialized } : { kind: "after_completion", rule };
  }

  if (!todayOccurrence && start && isRecurringLocalDate(rule, start, today, until)) {
    return { kind: "pending_today", rule, localDate: today, occurrence: null };
  }
  const next = nextAfter(tomorrow);
  if (next) {
    const materialized = byDate.get(next);
    return { kind: "next", rule, localDate: next, occurrence: materialized?.state === "pending" ? materialized : null };
  }
  if (until) return { kind: "ended", rule, until };
  return { kind: "none", rule };
}

/** The day a recurring series is next worked on (today while today's occurrence is open), or null. */
export function recurringTaskKeyDate(status: RecurringTaskStatus | null) {
  if (!status) return null;
  if (status.kind === "pending_today" || status.kind === "next") return status.localDate;
  return null;
}
