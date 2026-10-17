// Today layout pass (interview Q12-Q17): pure models for the Today page. No hooks, no React, so every rule
// here runs in node tests. Writes are described, never sent: the page hands each descriptor to the existing
// tRPC procedures (task.update, occurrence.resolve, recovery.resolve, dailyPlan.*, task.reserve,
// dailyCheckIn.upsert). No schema change: every field read here already exists in the planner snapshot.
import { validateRecoveryDecision, type RecoveryDecision } from "@shared/recovery";
import type { TodayHabitRow, TodayProjection, TodayTaskRow } from "@shared/todayProjection";
import { zonedDateTimeToUtc } from "@shared/planningAvailability";
import { taskReservationLocalParts, roundedTaskReservationMinutes } from "@shared/taskReservation";

type DateValue = Date | string;

export type TodayTaskFact = {
  id: string;
  title: string;
  state: string;
  version: number;
  estimateMinutes?: number | null;
  categoryId?: string | null;
  projectId?: string | null;
  dueLocalDate?: string | null;
  scheduledLocalDate?: string | null;
  plannedStartAt?: DateValue | null;
  plannedEndAt?: DateValue | null;
  recurrenceRule?: unknown;
  outcome?: string | null;
  archivedAt?: DateValue | null;
  rescheduleCount?: number | null;
  parentTaskId?: string | null;
  horizon?: string | null;
  completedAt?: DateValue | null;
};
export type TodayPlanFact = { id: string; localDate: string; state: string; version?: number; reflection?: string | null };
export type TodayPlanItemFact = { id: string; dailyPlanId: string; taskId: string; state: string; version?: number; position?: number };
export type TodayOccurrenceFact = { id: string; taskId: string; localDate: string; state: string; version?: number };
export type TodayCarryFact = { id: string; taskId: string; rootDailyPlanItemId: string; targetLocalDate: string; scope: string; state: string; version: number };
export type TodayEventFact = { id: string; title: string; startsAt: DateValue; endsAt: DateValue; status?: string; isAllDay?: number | boolean | null; payload?: unknown };

export type TodayFacts = {
  localDate: string;
  timezone: string;
  tasks: readonly TodayTaskFact[];
  plans: readonly TodayPlanFact[];
  items: readonly TodayPlanItemFact[];
  occurrences: readonly TodayOccurrenceFact[];
  carries: readonly TodayCarryFact[];
};

/** Which record a Today tick closes (interview Q14). */
export type TodayItemSource = "task" | "occurrence" | "daily_commitment" | "carried_commitment";

export type TodayItem = {
  /** Stable per row: the carry id for carried scope, else the task id. */
  key: string;
  taskId: string;
  title: string;
  source: TodayItemSource;
  projectionSource: TodayTaskRow["source"];
  startsAt: DateValue | null;
  endsAt: DateValue | null;
  estimateMinutes: number | null;
  categoryId: string | null;
  dailyPlanItemId?: string;
  occurrenceId?: string;
  carryId?: string;
};

const ms = (value: DateValue | null | undefined) => (value ? new Date(value).getTime() : NaN);

function planDates(facts: Pick<TodayFacts, "plans">) {
  return new Map(facts.plans.filter(plan => plan.state !== "archived").map(plan => [plan.id, plan.localDate]));
}

/** The open commitment a tick must close: today's first, else the latest earlier one still open. */
export function openCommitmentFor(taskId: string, facts: Pick<TodayFacts, "plans" | "items" | "localDate">) {
  const dates = planDates(facts);
  const open = facts.items
    .filter(item => item.taskId === taskId && item.state === "committed" && dates.has(item.dailyPlanId) && dates.get(item.dailyPlanId)! <= facts.localDate)
    .sort((left, right) => {
      const leftToday = dates.get(left.dailyPlanId) === facts.localDate;
      const rightToday = dates.get(right.dailyPlanId) === facts.localDate;
      return Number(rightToday) - Number(leftToday) || dates.get(right.dailyPlanId)!.localeCompare(dates.get(left.dailyPlanId)!) || left.id.localeCompare(right.id);
    });
  const item = open[0];
  return item ? { item, localDate: dates.get(item.dailyPlanId)! } : null;
}

function pendingOccurrence(taskId: string, localDate: string, occurrences: readonly TodayOccurrenceFact[]) {
  return occurrences.find(row => row.taskId === taskId && row.localDate === localDate && row.state === "pending") ?? null;
}

/** One list of today's task rows: timed blocks then flexible work, each with the record a tick closes. */
export function buildTodayItems(projection: Pick<TodayProjection, "timeline" | "flexible">, facts: TodayFacts): TodayItem[] {
  const taskById = new Map(facts.tasks.map(task => [task.id, task]));
  const rows = [
    ...projection.timeline.filter((row): row is TodayTaskRow => row.kind === "task"),
    ...projection.flexible,
  ];
  const seen = new Set<string>();
  const out: TodayItem[] = [];
  for (const row of rows) {
    const key = row.carryId ? `carry:${row.carryId}` : row.recordId;
    if (seen.has(key)) continue;
    seen.add(key);
    const task = taskById.get(row.recordId);
    // A task let go (won't do) or closed elsewhere leaves the list; the snapshot keeps its history.
    if (task && (task.outcome === "wont_do" || task.state === "archived" || task.archivedAt)) continue;
    const base = {
      key,
      taskId: row.recordId,
      title: row.title,
      projectionSource: row.source,
      startsAt: row.startsAt ?? null,
      endsAt: row.endsAt ?? null,
      estimateMinutes: typeof task?.estimateMinutes === "number" ? task.estimateMinutes : null,
      categoryId: task?.categoryId ?? null,
    };
    if (row.source === "carried_commitment" && row.carryId) {
      out.push({ ...base, source: "carried_commitment", carryId: row.carryId, dailyPlanItemId: row.rootDailyPlanItemId });
      continue;
    }
    const commitment = openCommitmentFor(row.recordId, facts);
    if (commitment) {
      const occurrence = pendingOccurrence(row.recordId, commitment.localDate, facts.occurrences);
      out.push({ ...base, source: "daily_commitment", dailyPlanItemId: commitment.item.id, ...(occurrence ? { occurrenceId: occurrence.id } : {}) });
      continue;
    }
    const occurrence = pendingOccurrence(row.recordId, facts.localDate, facts.occurrences);
    if (occurrence) {
      out.push({ ...base, source: "occurrence", occurrenceId: occurrence.id });
      continue;
    }
    out.push({ ...base, source: "task" });
  }
  return out;
}

export type TodayWrite =
  | { procedure: "planner.task.update"; taskId: string; patch: Record<string, unknown> }
  | { procedure: "planner.occurrence.resolve"; input: { id: string; expectedVersion: number; state: "completed" | "skipped" | "rescheduled"; rescheduledToLocalDate?: string | null } }
  | { procedure: "planner.recovery.resolve"; decision: RecoveryDecision };

export type TodayCompletion = { kind: "write"; write: TodayWrite } | { kind: "refuse"; reason: string };

/**
 * The ONE dispatcher behind every Today check (Q14). Recurring rows close only today's occurrence; committed
 * and carried rows close their plan record through Recovery (which also completes the task); plain tasks get
 * `state: completed`. A row that cannot be closed safely returns a reason and no write.
 */
export function completeTodayItem(item: TodayItem, facts: TodayFacts, operationId: string): TodayCompletion {
  const task = facts.tasks.find(candidate => candidate.id === item.taskId);
  if (!task) return { kind: "refuse", reason: "This task is not loaded. Refresh and try again." };
  if (task.id.startsWith("offline:")) return { kind: "refuse", reason: "Sync this captured task first. Nothing was changed." };
  if (task.state === "completed" || task.state === "archived" || task.outcome === "wont_do") return { kind: "refuse", reason: "This task is already closed." };
  if (task.state === "blocked") return { kind: "refuse", reason: "This task is blocked. Open it to clear the blocker first." };
  if (item.source === "carried_commitment") {
    const carry = facts.carries.find(row => row.id === item.carryId);
    if (!carry) return { kind: "refuse", reason: "This carried item is not loaded. Refresh and try again." };
    return { kind: "write", write: { procedure: "planner.recovery.resolve", decision: validateRecoveryDecision({
      operationId, action: "done", dailyPlanItemId: carry.rootDailyPlanItemId, taskId: carry.taskId,
      taskExpectedVersion: task.version, sourceCarryId: carry.id, carryExpectedVersion: carry.version,
    }) } };
  }
  if (item.source === "daily_commitment") {
    const planItem = facts.items.find(row => row.id === item.dailyPlanItemId);
    if (!planItem?.version) return { kind: "refuse", reason: "This plan item is not loaded. Refresh and try again." };
    const occurrence = item.occurrenceId ? facts.occurrences.find(row => row.id === item.occurrenceId) : null;
    if (task.recurrenceRule && !occurrence?.version) return { kind: "refuse", reason: "Today's repeat is not loaded yet. Refresh and try again." };
    return { kind: "write", write: { procedure: "planner.recovery.resolve", decision: validateRecoveryDecision({
      operationId, action: "done", dailyPlanItemId: planItem.id, taskId: task.id, taskExpectedVersion: task.version,
      itemExpectedVersion: planItem.version,
      ...(occurrence?.version ? { occurrenceId: occurrence.id, occurrenceExpectedVersion: occurrence.version } : {}),
    }) } };
  }
  if (item.source === "occurrence") {
    const occurrence = facts.occurrences.find(row => row.id === item.occurrenceId);
    if (!occurrence?.version) return { kind: "refuse", reason: "Today's repeat is not loaded yet. Refresh and try again." };
    return { kind: "write", write: { procedure: "planner.occurrence.resolve", input: { id: occurrence.id, expectedVersion: occurrence.version, state: "completed" } } };
  }
  if (task.recurrenceRule) return { kind: "refuse", reason: "Today's repeat is not loaded yet. Refresh and try again." };
  return { kind: "write", write: { procedure: "planner.task.update", taskId: task.id, patch: { state: "completed" } } };
}

/** How long a tick waits for Undo before its one write is sent (Undo then sends nothing). */
export const TODAY_UNDO_MS = 5000;

// ---------------------------------------------------------------------------------------------------------
// Time helpers

export function localMinuteOfDay(value: DateValue, timezone: string, localDate: string) {
  const parts = taskReservationLocalParts(new Date(value), timezone);
  if (parts.localDate < localDate) return 0;
  if (parts.localDate > localDate) return 1440;
  return parts.minuteOfDay;
}

export function timeToMinutes(value: string | null | undefined, fallback: number) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : fallback;
}

export function isAllDayEvent(event: TodayEventFact) {
  if (event.isAllDay === true || event.isAllDay === 1) return true;
  return ms(event.endsAt) - ms(event.startsAt) >= 20 * 60 * 60_000;
}

/** Timed (not all-day) active events that touch the local day. */
export function timedEventsForDay(events: readonly TodayEventFact[], localDate: string, timezone: string) {
  return events.filter(event => (event.status ?? "active") === "active" && !isAllDayEvent(event)).filter(event => {
    const start = localMinuteOfDay(event.startsAt, timezone, localDate);
    const end = localMinuteOfDay(new Date(ms(event.endsAt) - 1), timezone, localDate);
    return end > 0 && start < 1440 && taskReservationLocalParts(new Date(event.startsAt), timezone).localDate <= localDate
      && taskReservationLocalParts(new Date(ms(event.endsAt) - 1), timezone).localDate >= localDate;
  }).sort((left, right) => ms(left.startsAt) - ms(right.startsAt));
}

export function allDayEventsForDay(events: readonly TodayEventFact[], localDate: string, timezone: string) {
  return events.filter(event => (event.status ?? "active") === "active" && isAllDayEvent(event)).filter(event =>
    taskReservationLocalParts(new Date(event.startsAt), timezone).localDate <= localDate
    && taskReservationLocalParts(new Date(ms(event.endsAt) - 1), timezone).localDate >= localDate);
}

/** A meeting link already present on the stored event payload (Google `hangoutLink`, ICS URL); never guessed. */
export function meetingJoinUrl(event: TodayEventFact): string | null {
  const payload = event.payload && typeof event.payload === "object" ? event.payload as Record<string, unknown> : null;
  if (!payload) return null;
  const conference = payload.conferenceData && typeof payload.conferenceData === "object" ? payload.conferenceData as Record<string, unknown> : null;
  const entry = Array.isArray(conference?.entryPoints) ? (conference!.entryPoints as Array<Record<string, unknown>>).find(point => point?.entryPointType === "video") : null;
  for (const candidate of [payload.hangoutLink, payload.joinUrl, payload.conferenceUrl, entry?.uri, payload.url, payload.location]) {
    if (typeof candidate === "string" && /^https:\/\/\S+$/.test(candidate.trim())) return candidate.trim();
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Capacity (Plan my day move 2): meetings count, so "free" is the workday minus break minus meetings.

/** "4h10", "6h", "45m": the compact capacity copy from the locked prototype. */
export function capacityTime(minutes: number) {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours}h`;
}

function mergedMinutes(intervals: Array<[number, number]>) {
  const ordered = intervals.filter(([start, end]) => end > start).sort((left, right) => left[0] - right[0]);
  let total = 0;
  let current: [number, number] | null = null;
  for (const interval of ordered) {
    if (!current || interval[0] > current[1]) {
      if (current) total += current[1] - current[0];
      current = [...interval];
    } else current[1] = Math.max(current[1], interval[1]);
  }
  if (current) total += current[1] - current[0];
  return total;
}

export type TodayCapacity = {
  workdayMinutes: number;
  breakMinutes: number;
  meetingMinutes: number;
  freeMinutes: number;
  plannedMinutes: number;
  /** planned / free, 0 when there is no free time. */
  ratio: number;
  state: "ok" | "tight" | "over";
  label: string;
};

export function todayCapacity(input: {
  workdayStartsAt: string;
  workdayEndsAt: string;
  breakMinutes: number;
  /** Local minute ranges of timed meetings on this day. */
  meetings: ReadonlyArray<readonly [number, number]>;
  plannedMinutes: number;
  unavailable?: boolean;
}): TodayCapacity {
  const start = timeToMinutes(input.workdayStartsAt, 8 * 60 + 30);
  const end = timeToMinutes(input.workdayEndsAt, 17 * 60 + 30);
  const workdayMinutes = input.unavailable ? 0 : Math.max(0, end - start);
  const breakMinutes = Math.max(0, Math.min(workdayMinutes, Math.floor(input.breakMinutes || 0)));
  const meetingMinutes = workdayMinutes ? mergedMinutes(input.meetings.map(([from, to]) => [Math.max(from, start), Math.min(to, end)])) : 0;
  const freeMinutes = Math.max(0, workdayMinutes - breakMinutes - meetingMinutes);
  const plannedMinutes = Math.max(0, Math.round(input.plannedMinutes));
  const ratio = freeMinutes ? plannedMinutes / freeMinutes : plannedMinutes ? Infinity : 0;
  const state = ratio > 1 ? "over" : ratio > 0.85 ? "tight" : "ok";
  return { workdayMinutes, breakMinutes, meetingMinutes, freeMinutes, plannedMinutes, ratio: Number.isFinite(ratio) ? ratio : 1, state,
    label: `planned ${capacityTime(plannedMinutes)} of ${capacityTime(freeMinutes)} free` };
}

/** What an item adds to the plan: its estimate, else its reserved length, else nothing (never a fake 30m). */
export function itemPlannedMinutes(item: Pick<TodayItem, "estimateMinutes" | "startsAt" | "endsAt">) {
  if (typeof item.estimateMinutes === "number" && item.estimateMinutes > 0) return item.estimateMinutes;
  const length = (ms(item.endsAt) - ms(item.startsAt)) / 60_000;
  return Number.isFinite(length) && length > 0 ? length : 0;
}

// ---------------------------------------------------------------------------------------------------------
// Habit chips (Q15): tap = done (ring fills), menu = skip, done chips fade, hidden when nothing is due.

export type HabitChipState = "due" | "done" | "skipped" | "missed";

export function habitChipState(row: Pick<TodayHabitRow, "state">): HabitChipState {
  if (row.state === "completed") return "done";
  if (row.state === "skipped") return "skipped";
  if (row.state === "missed") return "missed";
  return "due";
}

export type HabitChipAction = { kind: "check_in"; state: "completed" | "skipped" } | { kind: "clear" };

/** Tap on a due chip records done; tap on a done or skipped chip clears today's check-in (its undo). */
export function habitChipAction(state: HabitChipState, intent: "tap" | "skip"): HabitChipAction | null {
  if (intent === "skip") return state === "due" || state === "missed" ? { kind: "check_in", state: "skipped" } : null;
  if (state === "done" || state === "skipped") return { kind: "clear" };
  return { kind: "check_in", state: "completed" };
}

export function habitChipRow(rows: readonly TodayHabitRow[]) {
  const chips = rows.map(row => ({ id: row.recordId, title: row.title, state: habitChipState(row), weekProgress: row.weekProgress ?? null }));
  const doneCount = chips.filter(chip => chip.state === "done").length;
  return { chips, visible: chips.length > 0, doneCount, dueCount: chips.length, allSettled: chips.length > 0 && chips.every(chip => chip.state !== "due") };
}

// ---------------------------------------------------------------------------------------------------------
// Carry count and the shutdown decision model (Q16: calm but strict).

/** Items pushed back this many times cannot use "Move all to tomorrow". */
export const STRICT_CARRY_MIN = 3;

/**
 * How many times a task has moved to a later day: `tasks.rescheduleCount` (rollovers and plan moves) plus
 * earlier plan items resolved as rescheduled/deferred (the same sum as D4 "Pushed back N times"), plus
 * carried commitments for the task beyond its first.
 */
export function carryCount(taskId: string, facts: Pick<TodayFacts, "tasks" | "plans" | "items" | "carries" | "localDate">) {
  const task = facts.tasks.find(row => row.id === taskId);
  const rollovers = Math.max(0, Math.floor(Number(task?.rescheduleCount ?? 0)) || 0);
  const dates = planDates(facts);
  const planMoves = facts.items.filter(item => item.taskId === taskId && (item.state === "rescheduled" || item.state === "deferred")
    && (dates.get(item.dailyPlanId) ?? "9999") < facts.localDate).length;
  const carries = facts.carries.filter(carry => carry.taskId === taskId).length;
  return rollovers + planMoves + Math.max(0, carries - 1);
}

export type ShutdownItem = {
  key: string;
  taskId: string;
  title: string;
  source: TodayItemSource;
  carryCount: number;
  /** "Carried from Tue" style note for leftovers from earlier days. */
  fromLocalDate?: string;
  dailyPlanItemId?: string;
  occurrenceId?: string;
  carryId?: string;
};

export type ShutdownDecision = { kind: "tomorrow" } | { kind: "pick"; localDate: string } | { kind: "let_go" };

export function isStrictItem(item: Pick<ShutdownItem, "carryCount">) {
  return item.carryCount >= STRICT_CARRY_MIN;
}

/** A 3+ carry must be placed on a chosen day or let go; the one-tap "Tomorrow" is not offered. */
export function decisionAllowed(item: Pick<ShutdownItem, "carryCount">, decision: ShutdownDecision) {
  return !(decision.kind === "tomorrow" && isStrictItem(item));
}

export function shutdownState(items: readonly ShutdownItem[], decisions: Readonly<Record<string, ShutdownDecision | undefined>>) {
  const undecided = items.filter(item => {
    const decision = decisions[item.key];
    return !decision || !decisionAllowed(item, decision) || (decision.kind === "pick" && !decision.localDate);
  });
  const strict = items.filter(isStrictItem);
  return {
    total: items.length,
    decidedCount: items.length - undecided.length,
    undecidedCount: undecided.length,
    undecidedKeys: undecided.map(item => item.key),
    strictKeys: strict.map(item => item.key),
    /** Close day stays disabled until every open item has an explicit, allowed decision. */
    canClose: undecided.length === 0,
    /** Undecided items "Move all" would set; strict ones are skipped and stay undecided. */
    moveAllKeys: undecided.filter(item => !isStrictItem(item)).map(item => item.key),
  };
}

export function applyMoveAll(items: readonly ShutdownItem[], decisions: Readonly<Record<string, ShutdownDecision | undefined>>) {
  const next: Record<string, ShutdownDecision | undefined> = { ...decisions };
  for (const key of shutdownState(items, decisions).moveAllKeys) next[key] = { kind: "tomorrow" };
  return next;
}

export function decisionDate(decision: ShutdownDecision, tomorrow: string) {
  return decision.kind === "tomorrow" ? tomorrow : decision.kind === "pick" ? decision.localDate : null;
}

/** The existing write behind one shutdown or leftover decision. */
export function shutdownWrite(item: ShutdownItem, decision: ShutdownDecision, facts: TodayFacts, tomorrow: string, operationId: string): TodayCompletion {
  const task = facts.tasks.find(row => row.id === item.taskId);
  if (!task) return { kind: "refuse", reason: "This task is not loaded. Refresh and try again." };
  const date = decisionDate(decision, tomorrow);
  if (item.carryId) {
    const carry = facts.carries.find(row => row.id === item.carryId);
    if (!carry) return { kind: "refuse", reason: "This carried item is not loaded." };
    const common = { operationId, dailyPlanItemId: carry.rootDailyPlanItemId, taskId: carry.taskId, taskExpectedVersion: task.version, sourceCarryId: carry.id, carryExpectedVersion: carry.version };
    return { kind: "write", write: { procedure: "planner.recovery.resolve", decision: validateRecoveryDecision(date ? { ...common, action: "reschedule", resolvedToLocalDate: date } : { ...common, action: "abandon" }) } };
  }
  if (item.dailyPlanItemId) {
    const planItem = facts.items.find(row => row.id === item.dailyPlanItemId);
    if (!planItem?.version) return { kind: "refuse", reason: "This plan item is not loaded." };
    const occurrence = item.occurrenceId ? facts.occurrences.find(row => row.id === item.occurrenceId) : null;
    const common = { operationId, dailyPlanItemId: planItem.id, taskId: task.id, taskExpectedVersion: task.version, itemExpectedVersion: planItem.version,
      ...(occurrence?.version ? { occurrenceId: occurrence.id, occurrenceExpectedVersion: occurrence.version } : {}) };
    return { kind: "write", write: { procedure: "planner.recovery.resolve", decision: validateRecoveryDecision(date ? { ...common, action: "reschedule", resolvedToLocalDate: date } : { ...common, action: "abandon" }) } };
  }
  if (item.occurrenceId) {
    const occurrence = facts.occurrences.find(row => row.id === item.occurrenceId);
    if (!occurrence?.version) return { kind: "refuse", reason: "Today's repeat is not loaded." };
    return { kind: "write", write: { procedure: "planner.occurrence.resolve", input: date
      ? { id: occurrence.id, expectedVersion: occurrence.version, state: "rescheduled", rescheduledToLocalDate: date }
      : { id: occurrence.id, expectedVersion: occurrence.version, state: "skipped" } } };
  }
  // A plain task: move its Plan for date, or let it go back to Tasks (unscheduled). Its record is kept.
  return { kind: "write", write: { procedure: "planner.task.update", taskId: task.id, patch: { scheduledLocalDate: date, plannedStartAt: null, plannedEndAt: null } } };
}

// ---------------------------------------------------------------------------------------------------------
// Next-up hero (Q12, Q51): a meeting that is on or starts within the lead time wins; else the running or next
// task; else nothing.

export const MEETING_LEAD_MINUTES = 30;

export type NextUp =
  | { kind: "meeting"; event: TodayEventFact; minutesUntil: number; ongoing: boolean; joinUrl: string | null }
  | { kind: "task"; item: TodayItem; running: boolean }
  | { kind: "none" };

export function nextUp(input: { now: Date; items: readonly TodayItem[]; events: readonly TodayEventFact[]; excludedKeys?: ReadonlySet<string> }): NextUp {
  const now = input.now.getTime();
  const meeting = input.events
    .filter(event => !isAllDayEvent(event) && ms(event.endsAt) > now && ms(event.startsAt) - now <= MEETING_LEAD_MINUTES * 60_000)
    .sort((left, right) => ms(left.startsAt) - ms(right.startsAt))[0];
  if (meeting) {
    const minutesUntil = Math.max(0, Math.ceil((ms(meeting.startsAt) - now) / 60_000));
    return { kind: "meeting", event: meeting, minutesUntil, ongoing: ms(meeting.startsAt) <= now, joinUrl: meetingJoinUrl(meeting) };
  }
  const open = input.items.filter(item => !input.excludedKeys?.has(item.key));
  const running = open.find(item => ms(item.startsAt) <= now && ms(item.endsAt) > now);
  if (running) return { kind: "task", item: running, running: true };
  const upcoming = open.filter(item => ms(item.startsAt) > now).sort((left, right) => ms(left.startsAt) - ms(right.startsAt))[0];
  const flexible = open.find(item => !item.startsAt);
  const choice = flexible && (!upcoming || ms(upcoming.startsAt) - now > 45 * 60_000) ? flexible : upcoming ?? flexible;
  return choice ? { kind: "task", item: choice, running: false } : { kind: "none" };
}

export function meetingHeadline(next: Extract<NextUp, { kind: "meeting" }>) {
  if (next.ongoing) return `${next.event.title} · now`;
  if (next.minutesUntil <= 0) return `${next.event.title} · starting`;
  return `${next.event.title} in ${next.minutesUntil} min`;
}

// ---------------------------------------------------------------------------------------------------------
// Plan my day move 2: the pick tray. Open, unplanned-for-today tasks in three groups.

export type TrayGroup = "overdue" | "due_soon" | "this_week";

export function weekEnd(localDate: string) {
  const date = new Date(`${localDate}T12:00:00Z`);
  const offset = (7 - ((date.getUTCDay() + 6) % 7) - 1);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function shiftDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function pickTray(tasks: readonly TodayTaskFact[], input: { localDate: string; excludeTaskIds: ReadonlySet<string>; dueSoonDays?: number }) {
  const soon = shiftDate(input.localDate, input.dueSoonDays ?? 3);
  const end = weekEnd(input.localDate);
  const groups: Record<TrayGroup, TodayTaskFact[]> = { overdue: [], due_soon: [], this_week: [] };
  for (const task of tasks) {
    if (input.excludeTaskIds.has(task.id) || task.recurrenceRule || task.archivedAt) continue;
    if (task.state === "completed" || task.state === "archived" || task.state === "blocked" || task.outcome === "wont_do") continue;
    if (task.id.startsWith("offline:")) continue;
    const due = task.dueLocalDate ?? null;
    const planned = task.scheduledLocalDate ?? null;
    if ((due && due < input.localDate) || (planned && planned < input.localDate)) groups.overdue.push(task);
    else if (due && due <= soon) groups.due_soon.push(task);
    else if ((planned && planned > input.localDate && planned <= end) || (due && due <= end)) groups.this_week.push(task);
  }
  const byDate = (left: TodayTaskFact, right: TodayTaskFact) =>
    (left.dueLocalDate ?? left.scheduledLocalDate ?? "9999").localeCompare(right.dueLocalDate ?? right.scheduledLocalDate ?? "9999") || left.title.localeCompare(right.title);
  return (Object.keys(groups) as TrayGroup[]).map(group => ({ group, tasks: groups[group].sort(byDate) }));
}

export const TRAY_LABELS: Record<TrayGroup, string> = { overdue: "Overdue", due_soon: "Due soon", this_week: "This week" };

// ---------------------------------------------------------------------------------------------------------
// Plan my day move 3: click-to-place. Free slots in the workday window after now, avoiding busy time.

export function freeSlots(input: {
  localDate: string;
  timezone: string;
  workdayStartsAt: string;
  workdayEndsAt: string;
  now: Date;
  durationMinutes: number;
  busy: ReadonlyArray<{ startsAt: DateValue; endsAt: DateValue }>;
  limit?: number;
}) {
  const duration = roundedTaskReservationMinutes(input.durationMinutes);
  const start = timeToMinutes(input.workdayStartsAt, 510);
  const end = timeToMinutes(input.workdayEndsAt, 1050);
  const nowParts = taskReservationLocalParts(input.now, input.timezone);
  const nowMinute = nowParts.localDate === input.localDate ? nowParts.minuteOfDay : nowParts.localDate < input.localDate ? 0 : 1440;
  let cursor = Math.max(start, Math.ceil(nowMinute / 15) * 15);
  const busy = input.busy.map(row => [localMinuteOfDay(row.startsAt, input.timezone, input.localDate), localMinuteOfDay(row.endsAt, input.timezone, input.localDate)] as const)
    .filter(([from, to]) => to > from).sort((left, right) => left[0] - right[0]);
  const slots: Array<{ startMinute: number; endMinute: number; startsAt: Date; endsAt: Date }> = [];
  const limit = input.limit ?? 3;
  while (cursor + duration <= end && slots.length < limit) {
    const clash = busy.find(([from, to]) => cursor < to && cursor + duration > from);
    if (clash) { cursor = Math.ceil(clash[1] / 15) * 15; continue; }
    slots.push({ startMinute: cursor, endMinute: cursor + duration,
      startsAt: zonedDateTimeToUtc(input.localDate, cursor, input.timezone),
      endsAt: zonedDateTimeToUtc(input.localDate, cursor + duration, input.timezone) });
    cursor += duration;
  }
  return slots;
}

export function minuteLabel(minute: number) {
  const hours = Math.floor(minute / 60) % 24;
  const minutes = minute % 60;
  const suffix = hours < 12 ? "am" : "pm";
  const twelve = hours % 12 || 12;
  return minutes ? `${twelve}:${String(minutes).padStart(2, "0")} ${suffix}` : `${twelve} ${suffix}`;
}

/** Today's greeting for the morning card. */
export function dayPart(minuteOfDay: number) {
  if (minuteOfDay < 12 * 60) return "morning";
  if (minuteOfDay < 17 * 60) return "afternoon";
  return "evening";
}

/** Whether the evening shutdown card shows (from the owner's `preferredShutdownAt`). */
export function shutdownDue(minuteOfDay: number, preferredShutdownAt: string | null | undefined) {
  return minuteOfDay >= timeToMinutes(preferredShutdownAt, 18 * 60);
}

/** "9:15 am" in the workspace timezone. */
export function clockLabel(value: DateValue, timezone: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-NZ", { timeZone: timezone, hour: "numeric", minute: "2-digit", hour12: true }).format(date).replace(/\s?([ap])\.?m\.?/i, " $1m").toLowerCase();
}

export function clockRange(start: DateValue | null, end: DateValue | null, timezone: string) {
  if (!start) return "";
  const from = clockLabel(start, timezone);
  if (!end) return from;
  const to = clockLabel(end, timezone);
  const fromSuffix = from.slice(-2);
  return fromSuffix === to.slice(-2) ? `${from.slice(0, -3)}–${to}` : `${from}–${to}`;
}

export function weekdayLabel(localDate: string) {
  return new Intl.DateTimeFormat("en-NZ", { weekday: "short", timeZone: "UTC" }).format(new Date(`${localDate}T12:00:00Z`));
}
