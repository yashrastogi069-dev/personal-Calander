// Drop → mutation planning for the Tasks board, List section headers, the drop dock, the More menu
// "Move to" items and Select-mode bulk actions (spec D3 §3.3, §9). Every write maps to an EXISTING mutation:
// `planner.task.update`, `planner.occurrence.resolve` or `planner.task.bulkSetState`.
//
// The completion pre-checks mirror the server rejections in server/planning.ts so a refused move is
// explained before it is attempted, never after a failed write:
//   R1 `updateTask`/`bulkSetTaskState`: any task with a recurrenceRule cannot become completed/archived.
//   R3 `assertNoOutstandingTaskCommitments`: completed/archived is refused while a non-archived daily plan
//      still holds a `committed` item for the task. (Checked before R2, as the server does.)
//   R2 `incompleteHardPrerequisites`: completed is refused while a hard prerequisite is not completed
//      (a missing prerequisite record also blocks). Only checked when the task is not already completed.

import { incompleteHardPrerequisites, type DependencyEdge, type DependencyTask } from "./dependencyPolicy";
import { isInboxTask, reservedLocalDate, taskWhenPlacement, type BucketTask, type TaskWhenBucket } from "./taskBuckets";
import { stateForStatusLane, statusLaneForTaskState, statusLaneLabel, type TaskStatusLaneId } from "./taskBoard";
import { dayMonthLabel, localDaysBetween, localTimeLabel, weekdayDayMonthLabel, weekdayLabel } from "./taskDateLabels";
import { planSortOrderMove, type SortableTask } from "./taskOrdering";
import { isRecurrenceRule, recurrenceCadenceLabel, recurringTaskStatus, shiftLocalDate, type TaskOccurrenceLike } from "./taskRecurrence";

export type TaskDropSort = "manual" | "priority" | "due" | "scheduled" | "created";

export type DropTask = BucketTask & {
  title?: string;
  sortOrder?: number;
};

export type TaskDropContext = {
  /** Workspace-local today. */
  today: string;
  timezone: string;
  sort: TaskDropSort;
  /** `snapshot.taskOccurrences`. */
  occurrences?: readonly TaskOccurrenceLike[];
  /** `snapshot.taskDependencies`. */
  dependencies?: readonly DependencyEdge[];
  /** Every task record (any state) so prerequisites can be looked up. */
  tasks?: readonly DependencyTask[];
  /** Task id → local date of the open plan that commits it; build with `committedTaskPlans`. */
  committedTasks?: ReadonlyMap<string, string>;
  /** Tasks with a write still in flight: every drop on them is refused until it settles. */
  pendingTaskIds?: ReadonlySet<string>;
};

export type TaskDropTarget =
  /** `placement.laneTasks` is the full target lane in display order (it may contain the moved task). */
  | { kind: "status"; lane: TaskStatusLaneId; placement?: { laneTasks: readonly SortableTask[]; index: number } }
  | { kind: "when"; bucket: TaskWhenBucket }
  /** Week board day column (Q3): `date` sets Plan for; null is the Unscheduled column (clears Plan for). */
  | { kind: "day"; date: string | null }
  | { kind: "dock"; action: "plan_today" | "archive" };

export type TaskDropPatch = {
  state?: "not_started" | "in_progress" | "blocked" | "completed" | "archived";
  sortOrder?: number;
  scheduledLocalDate?: string | null;
  /** Only written by the late-drop "Move deadline" choice. */
  dueLocalDate?: string | null;
};

/**
 * A drop on a day after the deadline (Q4, "ask once, then allow"). The UI shows the inline prompt on the card
 * ("Mon is after the Sat deadline") with Plan anyway / Move deadline / Cancel; resolve with
 * `taskLateDropChoice`. Nothing is written until the owner chooses.
 */
export type TaskLateDropConfirm = {
  kind: "confirmLate";
  /** The day the card was dropped on (the new Plan for). */
  day: string;
  /** The deadline it lands after. */
  deadline: string;
  /** "Mon is after the Sat deadline" */
  prompt: string;
  /** "Plan anyway": keep the deadline. */
  planAnyway: TaskDropPatch;
  /** "Move deadline": the deadline moves to the dropped day. */
  moveDeadline: TaskDropPatch;
};

export type TaskDropWrite =
  /** One `planner.task.update` with this patch. */
  | { kind: "update"; patch: TaskDropPatch }
  /** Sequential `planner.task.update({sortOrder})` for each sibling in order, then `patch` on the moved task last. */
  | { kind: "rebalance"; writes: Array<{ id: string; sortOrder: number }>; patch: TaskDropPatch }
  /** `planner.occurrence.resolve({id, expectedVersion, state: "completed"})`. */
  | { kind: "resolveOccurrence"; occurrenceId: string; expectedVersion: number; state: "completed" }
  /**
   * Open a date popover limited to [min, max] (max null = open-ended); resolve with `taskDropDateChoice`.
   * `deadline` is set when a choice after it must be confirmed (the choice then returns `confirmLate`).
   */
  | { kind: "needsDate"; min: string; max: string | null; deadline?: string }
  | TaskLateDropConfirm
  /** Nothing to write (dropped where it already is). */
  | { kind: "none" };

export type TaskDropRule =
  | "R1" | "R2" | "R3" | "past" | "recurring_schedule" | "reserved" | "deadline" | "long_lane" | "occurrence_loading"
  | "archived" | "saving";

export type TaskDropRefusal = {
  ok: false;
  reason: string;
  rule: TaskDropRule;
  /** Where the owner can fix it: Plan (R3), the detail sheet, or Calendar (reservations). */
  action?: "open_plan" | "open_detail" | "open_calendar";
};

export type TaskDropPlan = { ok: true; write: TaskDropWrite; announcement?: string } | TaskDropRefusal;

const sortNames: Record<Exclude<TaskDropSort, "manual">, string> = {
  priority: "priority",
  due: "due date",
  scheduled: "plan date",
  created: "newest",
};

/** "Sorted by due date, so the order follows the sort." */
export function sortOrderNotice(sort: TaskDropSort) {
  return sort === "manual" ? null : `Sorted by ${sortNames[sort]}, so the order follows the sort.`;
}

/**
 * Open daily-plan commitments per task, as `assertNoOutstandingTaskCommitments` sees them: an item in state
 * `committed` whose plan is present and not archived. Pass `snapshot.dailyPlans` and `snapshot.dailyPlanItems`
 * (the snapshot already loads older plans that still own committed items).
 */
export function committedTaskPlans(
  plans: readonly { id: string; localDate: string; state: string }[],
  items: readonly { dailyPlanId: string; taskId: string; state: string }[],
) {
  const planById = new Map(plans.map(plan => [plan.id, plan]));
  const result = new Map<string, string>();
  for (const item of items) {
    if (item.state !== "committed") continue;
    const plan = planById.get(item.dailyPlanId);
    if (!plan || plan.state === "archived") continue;
    const existing = result.get(item.taskId);
    // Prefer today's or the latest plan date for the copy.
    if (!existing || plan.localDate > existing) result.set(item.taskId, plan.localDate);
  }
  return result;
}

function repeatsPhrase(rule: unknown) {
  const cadence = recurrenceCadenceLabel(rule as Parameters<typeof recurrenceCadenceLabel>[0]);
  return `Repeats ${cadence.charAt(0).toLowerCase()}${cadence.slice(1)}`;
}

function hasRecurrence(task: DropTask) {
  // Same truthiness test as the server; a malformed rule still blocks terminal states.
  return Boolean(task.recurrenceRule);
}

export type TaskCompletionCheck =
  | { ok: true; via: "update" }
  | { ok: true; via: "occurrence"; occurrence: TaskOccurrenceLike & { version: number } }
  | (TaskDropRefusal & { shortReason: string });

function refusal(rule: TaskDropRule, reason: string, shortReason: string, action?: TaskDropRefusal["action"]) {
  return { ok: false as const, rule, reason, shortReason, ...(action ? { action } : {}) };
}

function recurringCompletion(task: DropTask, ctx: TaskDropContext): TaskCompletionCheck {
  const status = recurringTaskStatus(task, ctx.today, ctx.occurrences);
  if (!status) return refusal("R1", "Repeating task. Resolve it from its occurrence in Plan.", "Repeats", "open_plan");
  const repeats = repeatsPhrase(status.rule);
  if (status.kind === "pending_today") {
    if (status.occurrence) return { ok: true, via: "occurrence", occurrence: { ...status.occurrence, version: status.occurrence.version ?? 1 } };
    return refusal("occurrence_loading", "Today's repeat is not loaded yet. Refresh, then try again.", repeats);
  }
  if (status.kind === "resolved_today") {
    const next = status.next ? ` Next one is ${weekdayDayMonthLabel(status.next)}.` : "";
    const outcome = status.state === "completed" ? "done" : status.state;
    return refusal("R1", `${repeats}. Today's is already ${outcome}.${next}`, repeats, "open_detail");
  }
  if (status.kind === "next") return refusal("R1", `${repeats}. Next one is ${weekdayDayMonthLabel(status.localDate)}.`, repeats, "open_detail");
  if (status.kind === "ended") return refusal("R1", `${repeats}. The series ended ${dayMonthLabel(status.until)}.`, repeats, "open_detail");
  if (status.kind === "after_completion") return refusal("R1", "Repeats after completion. No occurrence is open today.", "Repeats after completion", "open_detail");
  return refusal("R1", `${repeats}. No occurrence is open today.`, repeats, "open_detail");
}

function commitmentRefusal(task: DropTask, ctx: TaskDropContext) {
  const planDate = ctx.committedTasks?.get(task.id);
  if (!planDate) return null;
  const where = planDate === ctx.today ? "today's plan" : `the plan for ${weekdayDayMonthLabel(planDate)}`;
  return refusal("R3", `Committed in ${where}. Resolve it in Plan.`, `Committed in ${where}`, "open_plan");
}

function prerequisiteRefusal(task: DropTask, ctx: TaskDropContext, completedIds?: ReadonlySet<string>) {
  if (task.state === "completed") return null;
  const states = (ctx.tasks ?? []).map(item => (completedIds?.has(item.id) ? { ...item, state: "completed" } : item));
  const waiting = incompleteHardPrerequisites(task.id, [...(ctx.dependencies ?? [])], states);
  if (!waiting.length) return null;
  const reason = waiting.length === 1 ? "Waiting on 1 task: finish it first." : `Waiting on ${waiting.length} tasks: finish them first.`;
  return refusal("R2", reason, `Waiting on ${waiting.length} ${waiting.length === 1 ? "task" : "tasks"}`, "open_detail");
}

/**
 * Can this task be marked done right now, and how? Recurring series resolve today's pending occurrence
 * (never `state: completed`, which R1 rejects); everything else is a `task.update`. Mirrors R1 → R3 → R2.
 */
export function taskCompletionCheck(task: DropTask, ctx: TaskDropContext): TaskCompletionCheck {
  if (hasRecurrence(task)) return recurringCompletion(task, ctx);
  return commitmentRefusal(task, ctx) ?? prerequisiteRefusal(task, ctx) ?? { ok: true, via: "update" };
}

/** Archive pre-check: R1 and R3 (the server does not check prerequisites for archive). */
export function taskArchiveCheck(task: DropTask, ctx: TaskDropContext): { ok: true } | (TaskDropRefusal & { shortReason: string }) {
  if (hasRecurrence(task)) {
    const repeats = isRecurrenceRule(task.recurrenceRule) ? repeatsPhrase(task.recurrenceRule) : "Repeats";
    return refusal("R1", `${repeats}. Remove the repeat in details before archiving.`, repeats, "open_detail");
  }
  return commitmentRefusal(task, ctx) ?? { ok: true };
}

function statusDrop(task: DropTask, target: Extract<TaskDropTarget, { kind: "status" }>, ctx: TaskDropContext): TaskDropPlan {
  const sourceLane = statusLaneForTaskState(task.state);
  const sameLane = sourceLane === target.lane;
  const notice = target.placement ? sortOrderNotice(ctx.sort) : null;

  if (target.lane === "done" && !sameLane) {
    const check = taskCompletionCheck(task, ctx);
    if (!check.ok) return { ok: false, reason: check.reason, rule: check.rule, ...(check.action ? { action: check.action } : {}) };
    if (check.via === "occurrence") {
      const lane = sourceLane ? statusLaneLabel(sourceLane) : "its lane";
      return {
        ok: true,
        write: { kind: "resolveOccurrence", occurrenceId: check.occurrence.id, expectedVersion: check.occurrence.version, state: "completed" },
        announcement: `Done today. It repeats, so it stays in ${lane}.`,
      };
    }
  }

  const statePatch: TaskDropPatch = sameLane ? {} : { state: stateForStatusLane(target.lane) };
  if (ctx.sort !== "manual" || !target.placement) {
    if (sameLane) return notice ? { ok: true, write: { kind: "none" }, announcement: notice } : { ok: true, write: { kind: "none" } };
    return { ok: true, write: { kind: "update", patch: statePatch }, ...(notice ? { announcement: notice } : {}) };
  }

  const move = planSortOrderMove(target.placement.laneTasks, task.id, target.placement.index);
  if (move.kind === "refused") {
    // Changing lane still works; only the position is refused.
    if (!sameLane) return { ok: true, write: { kind: "update", patch: statePatch }, announcement: move.reason };
    return { ok: false, reason: move.reason, rule: "long_lane" };
  }
  if (move.kind === "unchanged") return sameLane ? { ok: true, write: { kind: "none" } } : { ok: true, write: { kind: "update", patch: statePatch } };
  if (move.kind === "single") return { ok: true, write: { kind: "update", patch: { ...statePatch, sortOrder: move.sortOrder } } };
  return {
    ok: true,
    write: { kind: "rebalance", writes: move.writes.filter(write => write.id !== task.id), patch: { ...statePatch, sortOrder: move.sortOrder } },
  };
}

function reservationRefusal(task: DropTask, ctx: TaskDropContext, allowedDay: string | null) {
  const reserved = reservedLocalDate(task, ctx.timezone);
  if (!reserved || reserved === allowedDay) return null;
  const time = task.plannedStartAt ? localTimeLabel(task.plannedStartAt, ctx.timezone) : null;
  return {
    ok: false as const,
    rule: "reserved" as const,
    reason: `Reserved ${weekdayDayMonthLabel(reserved)}${time ? ` ${time}` : ""}. Move it in Calendar.`,
    action: "open_calendar" as const,
  };
}

const RECURRING_SCHEDULE_REFUSAL: TaskDropRefusal = {
  ok: false,
  rule: "recurring_schedule",
  reason: "Repeating tasks follow their schedule. Edit the repeat in details.",
  action: "open_detail",
};

function planForToday(task: DropTask, ctx: TaskDropContext): TaskDropPlan {
  if (hasRecurrence(task)) return RECURRING_SCHEDULE_REFUSAL;
  const reserved = reservationRefusal(task, ctx, ctx.today);
  if (reserved) return reserved;
  if (task.scheduledLocalDate === ctx.today) return { ok: true, write: { kind: "none" } };
  const stillOverdue = Boolean(task.dueLocalDate && task.dueLocalDate < ctx.today);
  return {
    ok: true,
    write: { kind: "update", patch: { scheduledLocalDate: ctx.today } },
    ...(stillOverdue ? { announcement: "Planned for today. Its deadline has passed, so it stays in Past due." } : {}),
  };
}

function withDeadline(write: { kind: "needsDate"; min: string; max: string | null }, task: DropTask): Extract<TaskDropWrite, { kind: "needsDate" }> {
  return task.dueLocalDate ? { ...write, deadline: task.dueLocalDate } : write;
}

/** "Mon" within a week of today, "Today", else "16 Oct". */
function shortDayLabel(localDate: string, today: string) {
  if (localDate === today) return "Today";
  return Math.abs(localDaysBetween(today, localDate)) < 7 ? weekdayLabel(localDate) : dayMonthLabel(localDate);
}

/** The `confirmLate` write for planning `day` after `deadline`. */
export function lateDropConfirm(day: string, deadline: string, today: string): TaskLateDropConfirm {
  const deadlineLabel = deadline === today ? "today's" : `the ${shortDayLabel(deadline, today)}`;
  return {
    kind: "confirmLate",
    day,
    deadline,
    prompt: `${shortDayLabel(day, today)} is after ${deadlineLabel} deadline`,
    planAnyway: { scheduledLocalDate: day },
    moveDeadline: { scheduledLocalDate: day, dueLocalDate: day },
  };
}

/** Resolves the late-drop prompt: "plan_anyway" keeps the deadline, "move_deadline" moves it to the day. */
export function taskLateDropChoice(write: TaskLateDropConfirm, choice: "plan_anyway" | "move_deadline"): TaskDropPlan {
  if (choice === "move_deadline") {
    return { ok: true, write: { kind: "update", patch: write.moveDeadline }, announcement: `Planned and deadline moved to ${weekdayDayMonthLabel(write.day)}.` };
  }
  return { ok: true, write: { kind: "update", patch: write.planAnyway }, announcement: `Planned for ${weekdayDayMonthLabel(write.day)}, after the deadline.` };
}

const ARCHIVED_REFUSAL: TaskDropRefusal = { ok: false, rule: "archived", reason: "Archived. Restore it first.", action: "open_detail" };

/**
 * Week board day column (Q3): Plan for = the column's day; Unscheduled clears it. Hard refusals are kept
 * only for moves that can't happen: archived work, a recurring series (its schedule decides), a reservation
 * on another day (Calendar owns it) and a day already past. A day after the deadline asks once (Q4).
 */
function dayDrop(task: DropTask, date: string | null, ctx: TaskDropContext): TaskDropPlan {
  if (task.state === "archived") return ARCHIVED_REFUSAL;
  if (hasRecurrence(task)) return RECURRING_SCHEDULE_REFUSAL;

  if (date === null) {
    if (!task.scheduledLocalDate && !task.plannedStartAt) return { ok: true, write: { kind: "none" } };
    const reserved = reservationRefusal(task, ctx, null);
    if (reserved) return reserved;
    const backInInbox = isInboxTask({ ...task, scheduledLocalDate: null });
    return {
      ok: true,
      write: { kind: "update", patch: { scheduledLocalDate: null } },
      announcement: backInInbox ? "Moved to Unscheduled. It is back in Inbox." : "Moved to Unscheduled.",
    };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, rule: "past", reason: "Choose a day." };
  if (date < ctx.today) return { ok: false, rule: "past", reason: "You can't plan into the past." };
  const reserved = reservationRefusal(task, ctx, date);
  if (reserved) return reserved;
  if (task.scheduledLocalDate === date) return { ok: true, write: { kind: "none" } };
  if (task.dueLocalDate && date > task.dueLocalDate) return { ok: true, write: lateDropConfirm(date, task.dueLocalDate, ctx.today) };
  return { ok: true, write: { kind: "update", patch: { scheduledLocalDate: date } } };
}

function whenDrop(task: DropTask, bucket: TaskWhenBucket, ctx: TaskDropContext): TaskDropPlan {
  const source = taskWhenPlacement(task, ctx).bucket;
  if (source === bucket) return { ok: true, write: { kind: "none" } };
  if (bucket === "past_due") return { ok: false, rule: "past", reason: "You can't plan into the past." };
  if (bucket === "today") return planForToday(task, ctx);
  if (hasRecurrence(task)) return RECURRING_SCHEDULE_REFUSAL;
  const reserved = reservationRefusal(task, ctx, null);
  if (reserved) return reserved;

  // Q4: a deadline never refuses a date. The popover offers the whole range; a day after the deadline is
  // confirmed once (`taskDropDateChoice` returns `confirmLate`) and then allowed.
  if (bucket === "next_7_days") {
    return { ok: true, write: withDeadline({ kind: "needsDate", min: shiftLocalDate(ctx.today, 1), max: shiftLocalDate(ctx.today, 7) }, task) };
  }

  if (bucket === "later") {
    return { ok: true, write: withDeadline({ kind: "needsDate", min: shiftLocalDate(ctx.today, 8), max: null }, task) };
  }

  // No date
  if (task.dueLocalDate) {
    return { ok: false, rule: "deadline", reason: `Has a deadline (${dayMonthLabel(task.dueLocalDate)}). Clear it in details.`, action: "open_detail" };
  }
  const backInInbox = isInboxTask({ ...task, scheduledLocalDate: null });
  return {
    ok: true,
    write: { kind: "update", patch: { scheduledLocalDate: null } },
    announcement: backInInbox ? "Moved to No date. It is back in Inbox." : "Moved to No date.",
  };
}

function dockDrop(task: DropTask, action: "plan_today" | "archive", ctx: TaskDropContext): TaskDropPlan {
  if (action === "plan_today") return planForToday(task, ctx);
  if (task.state === "archived") return { ok: true, write: { kind: "none" } };
  const check = taskArchiveCheck(task, ctx);
  if (!check.ok) return { ok: false, reason: check.reason, rule: check.rule, ...(check.action ? { action: check.action } : {}) };
  return { ok: true, write: { kind: "update", patch: { state: "archived" } } };
}

/**
 * Maps one drop (board lane, List section header, drop dock or More-menu "Move to") to a single existing
 * write, or a refusal with the reason the lane shows while the card hovers. Never fails silently.
 */
export function planTaskDrop(task: DropTask, target: TaskDropTarget, ctx: TaskDropContext): TaskDropPlan {
  if (ctx.pendingTaskIds?.has(task.id)) return { ok: false, rule: "saving", reason: "The last move is still saving." };
  if (target.kind === "status") return statusDrop(task, target, ctx);
  if (target.kind === "day") return dayDrop(task, target.date, ctx);
  if (target.kind === "when") return whenDrop(task, target.bucket, ctx);
  return dockDrop(task, target.action, ctx);
}

/**
 * Resolves a `needsDate` popover choice into the `task.update` patch, rejecting days outside the range.
 * A day after `write.deadline` returns `confirmLate` (Q4); pass `today` so its prompt can say "Mon".
 */
export function taskDropDateChoice(write: Extract<TaskDropWrite, { kind: "needsDate" }>, localDate: string, today?: string): TaskDropPlan {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || localDate < write.min || (write.max !== null && localDate > write.max)) {
    return { ok: false, rule: "deadline", reason: write.max ? `Choose a day from ${dayMonthLabel(write.min)} to ${dayMonthLabel(write.max)}.` : `Choose a day from ${dayMonthLabel(write.min)}.` };
  }
  if (write.deadline && localDate > write.deadline) return { ok: true, write: lateDropConfirm(localDate, write.deadline, today ?? write.min) };
  return { ok: true, write: { kind: "update", patch: { scheduledLocalDate: localDate } } };
}

/** bulkSetState can't resolve occurrences, so a recurring series is always excluded from bulk Done (R1). */
function recurringBulkRefusal(task: DropTask) {
  const repeats = isRecurrenceRule(task.recurrenceRule) ? repeatsPhrase(task.recurrenceRule) : "Repeats";
  return refusal("R1", `${repeats}. Mark today's occurrence done from its own row.`, repeats, "open_detail");
}

/** `planner.task.bulkSetState` accepts at most 100 ids per call. */
export const BULK_STATE_LIMIT = 100;

export type BulkStatePlan<TTask extends DropTask> = {
  eligible: TTask[];
  excluded: Array<{ task: TTask; reason: string; shortReason: string; rule: TaskDropRule }>;
  /** Eligible ids in calls of at most 100. */
  batches: string[][];
  /** "2 can't be completed here: Repeats daily; Committed in today's plan", or null when nothing is excluded. */
  summary: string | null;
};

/**
 * Pre-checks a Select-mode bulk state change so the server never rejects the whole batch: R1 and R3 are
 * excluded per task for Done/Archive, and R2 is resolved to a fixed point where selected prerequisites that
 * will also be completed count as completed (the same candidate rule `bulkSetTaskState` uses).
 */
export function planBulkStateChange<TTask extends DropTask>(
  tasks: readonly TTask[],
  state: NonNullable<TaskDropPatch["state"]>,
  ctx: TaskDropContext,
): BulkStatePlan<TTask> {
  const excluded: BulkStatePlan<TTask>["excluded"] = [];
  let eligible = [...tasks];
  if (state === "completed" || state === "archived") {
    eligible = eligible.filter(task => {
      const check = hasRecurrence(task)
        ? (state === "archived" ? taskArchiveCheck(task, ctx) : recurringBulkRefusal(task))
        : commitmentRefusal(task, ctx);
      if (check && !check.ok) {
        excluded.push({ task, reason: check.reason, shortReason: check.shortReason, rule: check.rule });
        return false;
      }
      return true;
    });
  }
  if (state === "completed") {
    let changed = true;
    while (changed) {
      changed = false;
      const completing = new Set(eligible.map(task => task.id));
      const stillEligible: TTask[] = [];
      for (const task of eligible) {
        const blocked = prerequisiteRefusal(task, ctx, completing);
        if (blocked) {
          excluded.push({ task, reason: blocked.reason, shortReason: blocked.shortReason, rule: blocked.rule });
          changed = true;
        } else {
          stillEligible.push(task);
        }
      }
      eligible = stillEligible;
    }
  }
  const ids = eligible.map(task => task.id);
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += BULK_STATE_LIMIT) batches.push(ids.slice(index, index + BULK_STATE_LIMIT));
  const verb = state === "completed" ? "completed" : state === "archived" ? "archived" : "moved";
  const reasons = Array.from(new Set(excluded.map(item => item.shortReason)));
  const summary = excluded.length ? `${excluded.length} can't be ${verb} here: ${reasons.join("; ")}` : null;
  return { eligible, excluded, batches, summary };
}
