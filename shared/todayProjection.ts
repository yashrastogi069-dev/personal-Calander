import { isHabitScheduledOnLocalDate, type CalendarHabit } from "./habitSchedule";
import { planningAvailability } from "./planningAvailability";

type DateValue = Date | string;

export type TodayTask = {
  id: string;
  workspaceId: string;
  title: string;
  state: string;
  priority?: string | null;
  dueLocalDate?: string | null;
  scheduledLocalDate?: string | null;
  plannedStartAt?: DateValue | null;
  plannedEndAt?: DateValue | null;
  estimateMinutes?: number | null;
  completedAt?: DateValue | null;
  archivedAt?: DateValue | null;
  recurrenceRule?: unknown;
  [field: string]: unknown;
};

export type TodayDailyPlan = { id: string; localDate: string; state: string };
export type TodayDailyPlanItem = { id: string; dailyPlanId: string; taskId: string; position: number; state: string };
export type TodayTaskOccurrence = {
  id: string;
  taskId: string;
  localDate: string;
  state: string;
  plannedStartAt?: DateValue | null;
  plannedEndAt?: DateValue | null;
  completedAt?: DateValue | null;
};
export type TodayHabit = CalendarHabit & { id: string; workspaceId: string; name: string; archivedAt?: DateValue | null };
export type TodayHabitCheckIn = { id: string; habitId: string; localDate: string; state: string; completedAt?: DateValue | null };
export type TodayExternalEvent = { id: string; title: string; startsAt: DateValue; endsAt: DateValue; status: string };
export type TodayAvailabilityException = {
  id: string;
  localDate: string;
  isUnavailable: number;
  workdayStartsAt?: string | null;
  workdayEndsAt?: string | null;
  breakMinutes?: number | null;
};
export type TodayCommitmentResolution = { id: string; dailyPlanItemId: string; taskId: string; action: string };

export type TodayProjectionInput = {
  localDate: string;
  workspace: {
    id: string;
    timezone: string;
    dailyCapacityMinutes: number;
    workdayStartsAt: string;
    workdayEndsAt: string;
    defaultBreakMinutes: number;
  };
  tasks: TodayTask[];
  dailyPlans: TodayDailyPlan[];
  dailyPlanItems: TodayDailyPlanItem[];
  taskOccurrences: TodayTaskOccurrence[];
  habits: TodayHabit[];
  habitCheckIns: TodayHabitCheckIn[];
  externalEvents: TodayExternalEvent[];
  planningAvailabilityExceptions: TodayAvailabilityException[];
  commitmentResolutions: TodayCommitmentResolution[];
};

export type TodayTaskRow = {
  kind: "task";
  recordId: string;
  title: string;
  source: "reservation" | "planned_no_time" | "daily_commitment" | "occurrence";
  readOnly: false;
  startsAt: DateValue | null;
  endsAt: DateValue | null;
};

export type TodayAppointmentRow = {
  kind: "appointment";
  recordId: string;
  title: string;
  source: "external_calendar";
  readOnly: true;
  startsAt: DateValue;
  endsAt: DateValue;
};

export type TodayAttentionRow = {
  kind: "task";
  recordId: string;
  title: string;
  reason: "due_today_unplanned" | "overdue_unplanned";
};

export type TodayRecoveryRow = {
  kind: "task";
  recordId: string;
  title: string;
  dailyPlanItemId: string;
  fromLocalDate: string;
};

export type TodayHabitRow = {
  kind: "habit";
  recordId: string;
  title: string;
  checkInId: string | null;
  state: "due" | string;
};

export type TodayCompletionEvidence = {
  kind: "task" | "task_occurrence" | "habit";
  recordId: string;
  evidenceId: string;
  title: string;
  completedAt: DateValue | null;
};

export type TodayProjection = {
  localDate: string;
  timeline: Array<TodayTaskRow | TodayAppointmentRow>;
  flexible: TodayTaskRow[];
  attention: TodayAttentionRow[];
  recovery: TodayRecoveryRow[];
  habits: TodayHabitRow[];
  completionEvidence: TodayCompletionEvidence[];
  capacity: {
    dailyCapacityMinutes: number;
    workdayMinutes: number;
    breakMinutes: number;
    busyMinutes: number;
    availableMinutes: number;
    freeMinutes: number;
    knownDemandMinutes: number;
    unestimatedTaskCount: number;
    isCompleteEstimate: boolean;
  };
};

function dateValue(value: DateValue) {
  return value instanceof Date ? value : new Date(value);
}

function localDateForInstant(value: DateValue, timezone: string) {
  const date = dateValue(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function eventTouchesLocalDate(event: TodayExternalEvent, localDate: string, timezone: string) {
  const start = dateValue(event.startsAt).getTime();
  const end = dateValue(event.endsAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
  const lastIncludedInstant = new Date(end - 1);
  const firstDate = localDateForInstant(new Date(start), timezone);
  const lastDate = localDateForInstant(lastIncludedInstant, timezone);
  return Boolean(firstDate && lastDate && firstDate <= localDate && localDate <= lastDate);
}

function isOpenTask(task: TodayTask) {
  return task.state !== "completed" && task.state !== "archived" && !task.archivedAt;
}

function hasReservation(start: DateValue | null | undefined, end: DateValue | null | undefined) {
  if (!start || !end) return false;
  const startMs = dateValue(start).getTime();
  const endMs = dateValue(end).getTime();
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
}

function completionSortValue(value: DateValue | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const milliseconds = dateValue(value).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : Number.MAX_SAFE_INTEGER;
}

/** Builds a deterministic, read-only view of a planning day without creating or changing planner records. */
export function projectToday(input: TodayProjectionInput): TodayProjection {
  const { localDate, workspace } = input;
  const taskById = new Map(input.tasks.map(task => [task.id, task]));
  const occurrenceByTaskId = new Map(
    input.taskOccurrences.filter(occurrence => occurrence.localDate === localDate).map(occurrence => [occurrence.taskId, occurrence]),
  );
  const todayPlanIds = new Set(input.dailyPlans.filter(plan => plan.localDate === localDate && plan.state !== "archived").map(plan => plan.id));
  const todayCommitments = new Map(
    input.dailyPlanItems
      .filter(item => todayPlanIds.has(item.dailyPlanId) && item.state === "committed")
      .map(item => [item.taskId, item]),
  );

  const resolvedItemIds = new Set(input.commitmentResolutions.map(resolution => resolution.dailyPlanItemId));
  const earlierPlanDateById = new Map(
    input.dailyPlans.filter(plan => plan.localDate < localDate && plan.state !== "archived").map(plan => [plan.id, plan.localDate]),
  );
  const recovery: TodayRecoveryRow[] = input.dailyPlanItems.flatMap<TodayRecoveryRow>(item => {
    const fromLocalDate = earlierPlanDateById.get(item.dailyPlanId);
    const task = taskById.get(item.taskId);
    if (!fromLocalDate || item.state !== "committed" || resolvedItemIds.has(item.id) || !task || !isOpenTask(task)) return [];
    return [{ kind: "task", recordId: task.id, title: task.title, dailyPlanItemId: item.id, fromLocalDate }];
  }).sort((left, right) => right.fromLocalDate.localeCompare(left.fromLocalDate) || left.recordId.localeCompare(right.recordId));
  const recoveryTaskIds = new Set(recovery.map(item => item.recordId));

  const taskTimeline: TodayTaskRow[] = [];
  const flexible: TodayTaskRow[] = [];
  const attention: TodayAttentionRow[] = [];
  const projectedTaskIds = new Set<string>();

  for (const task of input.tasks) {
    if (!isOpenTask(task)) continue;
    const occurrence = occurrenceByTaskId.get(task.id);
    if (occurrence && ["completed", "skipped", "missed", "rescheduled"].includes(occurrence.state)) continue;

    const start = occurrence?.plannedStartAt ?? task.plannedStartAt ?? null;
    const end = occurrence?.plannedEndAt ?? task.plannedEndAt ?? null;
    const isReservedToday = hasReservation(start, end)
      && localDateForInstant(start as DateValue, workspace.timezone) === localDate;
    if (isReservedToday) {
      taskTimeline.push({ kind: "task", recordId: task.id, title: task.title, source: "reservation", readOnly: false, startsAt: start, endsAt: end });
      projectedTaskIds.add(task.id);
      continue;
    }

    if (recoveryTaskIds.has(task.id)) continue;

    const plannedForToday = task.scheduledLocalDate === localDate;
    const committedToday = todayCommitments.has(task.id);
    const pendingOccurrenceToday = occurrence?.state === "pending";
    if (plannedForToday || committedToday || pendingOccurrenceToday) {
      flexible.push({
        kind: "task",
        recordId: task.id,
        title: task.title,
        source: pendingOccurrenceToday ? "occurrence" : plannedForToday ? "planned_no_time" : "daily_commitment",
        readOnly: false,
        startsAt: null,
        endsAt: null,
      });
      projectedTaskIds.add(task.id);
      continue;
    }

    if (task.dueLocalDate && task.dueLocalDate <= localDate) {
      attention.push({
        kind: "task",
        recordId: task.id,
        title: task.title,
        reason: task.dueLocalDate === localDate ? "due_today_unplanned" : "overdue_unplanned",
      });
      projectedTaskIds.add(task.id);
    }
  }

  const activeEvents = input.externalEvents
    .filter(event => event.status === "active" && eventTouchesLocalDate(event, localDate, workspace.timezone));
  const appointmentTimeline: TodayAppointmentRow[] = activeEvents.map(event => ({
    kind: "appointment",
    recordId: event.id,
    title: event.title,
    source: "external_calendar",
    readOnly: true,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
  }));
  const timeline = [...taskTimeline, ...appointmentTimeline].sort((left, right) => {
    const timeDifference = dateValue(left.startsAt as DateValue).getTime() - dateValue(right.startsAt as DateValue).getTime();
    return timeDifference || left.recordId.localeCompare(right.recordId);
  });

  const checkInByHabitId = new Map(
    input.habitCheckIns.filter(checkIn => checkIn.localDate === localDate).map(checkIn => [checkIn.habitId, checkIn]),
  );
  const habits: TodayHabitRow[] = input.habits
    .filter(habit => !habit.archivedAt && isHabitScheduledOnLocalDate(habit, localDate))
    .map<TodayHabitRow>(habit => {
      const checkIn = checkInByHabitId.get(habit.id);
      return { kind: "habit", recordId: habit.id, title: habit.name, checkInId: checkIn?.id ?? null, state: checkIn?.state ?? "due" };
    })
    .sort((left, right) => left.title.localeCompare(right.title) || left.recordId.localeCompare(right.recordId));

  const completionEvidence: TodayCompletionEvidence[] = [];
  for (const task of input.tasks) {
    if (task.state === "completed" && task.completedAt && localDateForInstant(task.completedAt, workspace.timezone) === localDate) {
      completionEvidence.push({ kind: "task", recordId: task.id, evidenceId: task.id, title: task.title, completedAt: task.completedAt });
    }
  }
  for (const occurrence of input.taskOccurrences) {
    if (occurrence.localDate !== localDate || occurrence.state !== "completed") continue;
    const task = taskById.get(occurrence.taskId);
    if (!task) continue;
    completionEvidence.push({ kind: "task_occurrence", recordId: task.id, evidenceId: occurrence.id, title: task.title, completedAt: occurrence.completedAt ?? null });
  }
  for (const checkIn of input.habitCheckIns) {
    if (checkIn.localDate !== localDate || checkIn.state !== "completed") continue;
    const habit = input.habits.find(candidate => candidate.id === checkIn.habitId);
    if (!habit) continue;
    completionEvidence.push({ kind: "habit", recordId: habit.id, evidenceId: checkIn.id, title: habit.name, completedAt: checkIn.completedAt ?? null });
  }
  completionEvidence.sort((left, right) => completionSortValue(left.completedAt) - completionSortValue(right.completedAt) || left.evidenceId.localeCompare(right.evidenceId));

  const availabilityException = input.planningAvailabilityExceptions.find(exception => exception.localDate === localDate);
  const workdayStartsAt = availabilityException?.isUnavailable ? "00:00" : availabilityException?.workdayStartsAt ?? workspace.workdayStartsAt;
  const workdayEndsAt = availabilityException?.isUnavailable ? "00:00" : availabilityException?.workdayEndsAt ?? workspace.workdayEndsAt;
  const breakMinutes = availabilityException?.isUnavailable ? 0 : availabilityException?.breakMinutes ?? workspace.defaultBreakMinutes;
  const availability = planningAvailability({
    localDate,
    timezone: workspace.timezone,
    window: { workdayStartsAt, workdayEndsAt, defaultBreakMinutes: breakMinutes },
    reservedBlocks: taskTimeline.map(item => ({ startsAt: item.startsAt as DateValue, endsAt: item.endsAt as DateValue })),
    externalBusy: activeEvents.map(event => ({ startsAt: event.startsAt, endsAt: event.endsAt })),
  });

  const demandTasks = input.tasks.filter(task => projectedTaskIds.has(task.id) || recoveryTaskIds.has(task.id));
  const knownDemandMinutes = demandTasks.reduce((total, task) => total + (typeof task.estimateMinutes === "number" ? Math.max(0, task.estimateMinutes) : 0), 0);
  const unestimatedTaskCount = demandTasks.filter(task => task.estimateMinutes === null || task.estimateMinutes === undefined).length;

  return {
    localDate,
    timeline,
    flexible,
    attention,
    recovery,
    habits,
    completionEvidence,
    capacity: {
      dailyCapacityMinutes: workspace.dailyCapacityMinutes,
      workdayMinutes: availability.workdayMinutes,
      breakMinutes: availability.breakMinutes,
      busyMinutes: availability.mergedBusyMinutes,
      availableMinutes: availability.availableMinutes,
      freeMinutes: availability.freeMinutes,
      knownDemandMinutes,
      unestimatedTaskCount,
      isCompleteEstimate: unestimatedTaskCount === 0,
    },
  };
}
