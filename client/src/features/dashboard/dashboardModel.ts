import type { PlanStatus } from "@/components/premium/Pills";
import { resolveCategoryTones, type ToneOrNeutral } from "@/design/categoryTone";
import { shiftLocalDate } from "@/lib/workspace";
import type { PlanBoard } from "@/features/planning/planBoard";
import { confirmedActiveSeconds } from "@shared/focusClock";
import { habitPeriodConsistency } from "@shared/habitConsistency";
import { isHabitScheduledOnLocalDate, type CalendarHabit } from "@shared/habitSchedule";
import type { RoadmapItem } from "@shared/roadmap";
import type { TodayProjection } from "@shared/todayProjection";
import type {
  DashboardCommitments,
  DashboardFocusWeek,
  DashboardHabit,
  DashboardHabitConsistency,
  DashboardMilestone,
  DashboardModel,
  DashboardProject,
  DashboardSchedule,
  DashboardScheduleItem,
  DashboardUpNext,
  DashboardWeekDay,
} from "./dashboardTypes";

type DateValue = Date | string;

export type DashboardTask = {
  id: string;
  title: string;
  state: string;
  categoryId?: string | null;
  projectId?: string | null;
  dueLocalDate?: string | null;
  estimateMinutes?: number | null;
  plannedStartAt?: DateValue | null;
  plannedEndAt?: DateValue | null;
  completedAt?: DateValue | null;
  archivedAt?: DateValue | null;
  outcome?: string | null;
};
export type DashboardCategory = { id: string; name: string; color?: string | null; sortOrder?: number | null };
export type DashboardProjectRecord = { id: string; title: string; state: string; categoryId?: string | null; dueLocalDate?: string | null };
export type DashboardMilestoneRecord = { id: string; title: string; state: string; dueLocalDate?: string | null };
export type DashboardHabitRecord = CalendarHabit & { id: string; name: string; categoryId?: string | null; archivedAt?: DateValue | null };
export type DashboardCheckIn = { habitId: string; localDate: string; state: string };
export type DashboardFocusSession = {
  taskId?: string | null;
  state: string;
  startedAt: DateValue;
  lastResumedAt: DateValue | null;
  activeSeconds: number;
};
export type DashboardDailyPlan = { localDate: string; state: string; intention?: string | null };
export type DashboardExternalEvent = { id: string; isAllDay?: boolean | number | null };

export type DashboardInput = {
  localDate: string;
  now: Date;
  timezone: string;
  /** "HH:MM" workday bounds; they widen the Day lens window. */
  workdayStartsAt?: string | null;
  workdayEndsAt?: string | null;
  tasks: readonly DashboardTask[];
  categories: readonly DashboardCategory[];
  projects: readonly DashboardProjectRecord[];
  milestones: readonly DashboardMilestoneRecord[];
  habits: readonly DashboardHabitRecord[];
  habitCheckIns: readonly DashboardCheckIn[];
  focusSessions: readonly DashboardFocusSession[];
  dailyPlans: readonly DashboardDailyPlan[];
  today: TodayProjection;
  week: PlanBoard;
  /** Project items from roadmapProjection() for the same workspace and date; null when that projection failed. */
  roadmapItems: readonly RoadmapItem[] | null;
  /** Used only to keep all-day appointments out of the hourly Day window. */
  externalEvents?: readonly DashboardExternalEvent[];
};

const isOpen = (task: DashboardTask) => task.state !== "completed" && task.state !== "archived" && !task.archivedAt;

function isoString(value: DateValue): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function validDate(value: DateValue | null | undefined): Date | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Local calendar date and minute-of-day for an instant in the workspace timezone. */
export function localParts(value: DateValue, timezone: string): { localDate: string; minute: number } | null {
  const date = validDate(value);
  if (!date) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map(part => [part.type, part.value])
  );
  return { localDate: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}

function clockMinutes(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function greetingFor(minute: number): DashboardModel["greeting"] {
  if (minute < 12 * 60) return "Good morning";
  if (minute < 17 * 60) return "Good afternoon";
  return "Good evening";
}

function weekdayLabel(localDate: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(new Date(`${localDate}T12:00:00Z`));
}

type ToneLookup = (categoryId: string | null | undefined) => { tone: ToneOrNeutral; name: string | null };

/** Task ids with completion evidence today: the task itself or today's occurrence of a recurring task. */
function doneTodayIds(input: DashboardInput): Set<string> {
  return new Set(
    input.today.completionEvidence.filter(item => item.kind === "task" || item.kind === "task_occurrence").map(item => item.recordId)
  );
}

function commitmentsFor(input: DashboardInput, taskById: Map<string, DashboardTask>, done: ReadonlySet<string>): DashboardCommitments {
  const committed = new Set<string>();
  for (const row of [...input.today.timeline, ...input.today.flexible]) if (row.kind === "task") committed.add(row.recordId);
  // A completion that is still pending sync must arrive here as evidence (Home stamps completedAt), not be inferred.
  const openIds = Array.from(committed).filter(id => !done.has(id) && (taskById.get(id) ? isOpen(taskById.get(id)!) : false));
  const total = openIds.length + done.size;
  const estimates = openIds.map(id => taskById.get(id)?.estimateMinutes ?? null).filter((value): value is number => value != null && value > 0);
  const open = input.tasks.filter(isOpen).filter(task => task.outcome !== "wont_do");
  return {
    total,
    done: done.size,
    left: openIds.length,
    segments: [...Array<"done">(done.size).fill("done"), ...Array<"open">(openIds.length).fill("open")],
    dueToday: open.filter(task => task.dueLocalDate === input.localDate).length,
    overdue: open.filter(task => task.dueLocalDate != null && task.dueLocalDate < input.localDate).length,
    openPlannedMinutes: estimates.length ? estimates.reduce((sum, value) => sum + value, 0) : null,
  };
}

function habitConsistencyFor(input: DashboardInput, habits: readonly DashboardHabitRecord[]): DashboardHabitConsistency {
  const windowDays = 28;
  const start = shiftLocalDate(input.localDate, -(windowDays - 1));
  const checkIns = input.habitCheckIns.filter(
    (item): item is DashboardCheckIn & { state: "completed" | "skipped" | "missed" } =>
      item.state === "completed" || item.state === "skipped" || item.state === "missed"
  );
  let completed = 0;
  let scheduled = 0;
  for (const habit of habits) {
    if (habit.frequency === "times_per_week") continue;
    // Includes today only once it is recorded; an open today is pending, not missed.
    const result = habitPeriodConsistency(habit, checkIns, start, input.localDate, input.localDate);
    completed += result.completed;
    scheduled += result.scheduled;
  }
  const completedByDay = new Map<string, Set<string>>();
  const skippedByDay = new Map<string, Set<string>>();
  for (const item of checkIns) {
    if (item.state === "missed") continue;
    const byDay = item.state === "completed" ? completedByDay : skippedByDay;
    const set = byDay.get(item.localDate) ?? new Set<string>();
    set.add(item.habitId);
    byDay.set(item.localDate, set);
  }
  const days = Array.from({ length: 14 }, (_, index) => {
    const localDate = shiftLocalDate(input.localDate, index - 13);
    // A skipped day is excused: neither due nor missed (matches the streak rule).
    const due = habits.filter(habit => isHabitScheduledOnLocalDate(habit, localDate) && !skippedByDay.get(localDate)?.has(habit.id));
    const doneCount = due.filter(habit => completedByDay.get(localDate)?.has(habit.id)).length;
    let level: DashboardHabitConsistency["days"][number]["level"];
    if (!due.length) level = "none";
    else if (doneCount >= due.length) level = "full";
    else if (localDate === input.localDate) level = "today";
    else if (doneCount > 0) level = "partial";
    else level = "missed";
    return { localDate, level };
  });
  return { percent: scheduled ? Math.round((completed / scheduled) * 100) : null, completed, scheduled, windowDays, days };
}

function focusWeekFor(input: DashboardInput, taskById: Map<string, DashboardTask>, toneFor: ToneLookup): DashboardFocusWeek {
  const weekEnd = shiftLocalDate(input.week.weekStart, 6);
  const byTone = new Map<string, { tone: ToneOrNeutral; label: string; minutes: number }>();
  let actualSeconds = 0;
  for (const session of input.focusSessions) {
    // Stopped sessions (state "abandoned") still count: the stop prompt promises their time is saved (owner, 2026-10-13).
    const started = localParts(session.startedAt, input.timezone);
    if (!started || started.localDate < input.week.weekStart || started.localDate > weekEnd) continue;
    const seconds = confirmedActiveSeconds(
      session,
      input.now
    );
    actualSeconds += seconds;
    const task = session.taskId ? taskById.get(session.taskId) : undefined;
    const { tone, name } = toneFor(task?.categoryId);
    const label = name ?? "Uncategorised";
    const key = `${tone}\u0000${label}`;
    const entry = byTone.get(key) ?? { tone, label, minutes: 0 };
    entry.minutes += seconds / 60;
    byTone.set(key, entry);
  }
  const plannedTaskIds = new Set(input.week.days.flatMap(day => day.cards.map(card => card.taskId)));
  const estimates = Array.from(plannedTaskIds).map(id => taskById.get(id)?.estimateMinutes ?? null).filter((value): value is number => value != null && value > 0);
  return {
    actualMinutes: Math.round(actualSeconds / 60),
    plannedMinutes: estimates.length ? estimates.reduce((sum, value) => sum + value, 0) : null,
    byTone: Array.from(byTone.values())
      .map(entry => ({ ...entry, minutes: Math.round(entry.minutes) }))
      .filter(entry => entry.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes || a.label.localeCompare(b.label)),
  };
}

function scheduleFor(input: DashboardInput, taskById: Map<string, DashboardTask>, toneFor: ToneLookup, nowMinute: number, doneToday: ReadonlySet<string>): DashboardSchedule {
  const items: DashboardScheduleItem[] = [];
  const allDay: DashboardSchedule["allDay"] = [];
  const allDayEventIds = new Set((input.externalEvents ?? []).filter(event => Boolean(event.isAllDay)).map(event => event.id));
  const seen = new Set<string>();
  for (const row of input.today.timeline) {
    if (!row.startsAt || !row.endsAt) continue;
    const key = `${row.kind}\u0000${row.recordId}\u0000${isoString(row.startsAt)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (row.kind === "appointment") {
      const spanMs = new Date(row.endsAt).getTime() - new Date(row.startsAt).getTime();
      if (allDayEventIds.has(row.recordId) || spanMs >= 23 * 3_600_000) {
        allDay.push({ id: `event-${row.recordId}`, title: row.title });
        continue;
      }
      items.push({ id: `event-${row.recordId}`, kind: "appointment", title: row.title, startsAt: isoString(row.startsAt), endsAt: isoString(row.endsAt), done: false, tone: "neutral", categoryName: null, taskId: null });
      continue;
    }
    const task = taskById.get(row.recordId);
    const { tone, name } = toneFor(task?.categoryId);
    items.push({ id: `task-${row.recordId}-${isoString(row.startsAt)}`, kind: "task", title: task?.title ?? row.title, startsAt: isoString(row.startsAt), endsAt: isoString(row.endsAt), done: task ? !isOpen(task) || doneToday.has(row.recordId) : false, tone, categoryName: name, taskId: row.recordId });
  }
  items.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.title.localeCompare(b.title));
  const minutes = items.flatMap(item => {
    const start = localParts(item.startsAt, input.timezone);
    const end = localParts(item.endsAt, input.timezone);
    if (!start || !end) return [];
    return [start.localDate === input.localDate ? start.minute : 0, end.localDate === input.localDate ? end.minute : 24 * 60];
  });
  const workStart = clockMinutes(input.workdayStartsAt) ?? 9 * 60;
  const workEnd = clockMinutes(input.workdayEndsAt) ?? 17 * 60;
  let startHour = Math.floor(Math.min(workStart, ...minutes) / 60);
  let endHour = Math.ceil(Math.max(workEnd, ...minutes) / 60);
  startHour = Math.max(0, Math.min(startHour, 23));
  endHour = Math.min(24, Math.max(endHour, startHour + 1));
  const capacity = input.today.capacity;
  return {
    items,
    startHour,
    endHour,
    nowMinute: nowMinute >= startHour * 60 && nowMinute <= endHour * 60 ? nowMinute : null,
    // No estimate at all is unknown, not "0m planned".
    plannedMinutes: capacity.knownDemandMinutes === 0 && !capacity.isCompleteEstimate ? null : capacity.knownDemandMinutes,
    freeMinutes: capacity.freeMinutes,
    allDay,
    unscheduledCount: new Set(input.today.flexible.filter(row => { const task = taskById.get(row.recordId); return task ? isOpen(task) && !doneToday.has(row.recordId) : false; }).map(row => row.recordId)).size,
  };
}

function upNextFor(input: DashboardInput, schedule: DashboardSchedule, taskById: Map<string, DashboardTask>, toneFor: ToneLookup, projectTitle: (id: string | null | undefined) => string | null, doneToday: ReadonlySet<string>): { upNext: DashboardUpNext | null; laterToday: DashboardScheduleItem[] } {
  const nowMs = input.now.getTime();
  const timedOpen = schedule.items.filter(item => item.kind === "task" && !item.done && new Date(item.endsAt).getTime() > nowMs);
  const focusToday = new Map<string, number>();
  for (const session of input.focusSessions) {
    if (!session.taskId) continue;
    if (localParts(session.startedAt, input.timezone)?.localDate !== input.localDate) continue;
    const seconds = confirmedActiveSeconds(session, input.now);
    focusToday.set(session.taskId, (focusToday.get(session.taskId) ?? 0) + seconds / 60);
  }
  const build = (taskId: string, timing: DashboardUpNext["timing"], startsAt: string | null, endsAt: string | null): DashboardUpNext | null => {
    const task = taskById.get(taskId);
    if (!task) return null;
    const { tone, name } = toneFor(task.categoryId);
    const reserved = startsAt && endsAt ? Math.round((new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 60000) : null;
    const actual = focusToday.get(taskId);
    return {
      taskId,
      title: task.title,
      timing,
      startsAt,
      endsAt,
      minutesUntil: timing === "next" && startsAt ? Math.max(0, Math.round((new Date(startsAt).getTime() - nowMs) / 60000)) : null,
      tone,
      categoryName: name,
      projectTitle: projectTitle(task.projectId),
      plannedMinutes: task.estimateMinutes && task.estimateMinutes > 0 ? task.estimateMinutes : reserved && reserved > 0 ? reserved : null,
      actualMinutes: actual && actual >= 1 ? Math.round(actual) : null,
    };
  };
  let upNext: DashboardUpNext | null = null;
  const firstTimed = timedOpen[0];
  if (firstTimed?.taskId) {
    const running = new Date(firstTimed.startsAt).getTime() <= nowMs;
    upNext = build(firstTimed.taskId, running ? "now" : "next", firstTimed.startsAt, firstTimed.endsAt);
  }
  if (!upNext) {
    const flexible = input.today.flexible.find(row => {
      const task = taskById.get(row.recordId);
      return task ? isOpen(task) && !doneToday.has(row.recordId) : false;
    });
    if (flexible) upNext = build(flexible.recordId, "anytime", null, null);
  }
  if (!upNext) {
    // A slot that has already ended but is still open stays doable today.
    const missed = schedule.items.find(item => item.kind === "task" && !item.done && item.taskId);
    if (missed?.taskId) upNext = build(missed.taskId, "anytime", null, null);
  }
  const laterToday = schedule.items
    .filter(item => !item.done && new Date(item.startsAt).getTime() > nowMs && !(upNext && item.taskId === upNext.taskId && item.startsAt === upNext.startsAt))
    .slice(0, 4);
  return { upNext, laterToday };
}

function weekFor(input: DashboardInput, taskById: Map<string, DashboardTask>): DashboardWeekDay[] {
  return input.week.days.map(day => {
    const committed = day.cards.filter(card => {
      const task = taskById.get(card.taskId);
      return task ? task.state !== "archived" && task.outcome !== "wont_do" : false;
    });
    const done = committed.filter(card => {
      const task = taskById.get(card.taskId);
      return task?.state === "completed" || card.sources.some(source => (source.kind === "commitment" && source.state === "done") || (source.kind === "occurrence" && source.state === "completed"));
    });
    return {
      localDate: day.localDate,
      label: weekdayLabel(day.localDate),
      committed: committed.length,
      done: done.length,
      isToday: day.localDate === input.localDate,
      isFuture: day.localDate > input.localDate,
      events: day.events.length,
    };
  });
}

/** Explicit risk and review → at risk; blocked or overdue → off track; no scheduled work → at risk ("No next step"). No roadmap item → no status. */
export function projectStatus(item: Pick<RoadmapItem, "attention" | "explicitRisk"> | undefined): { status: PlanStatus | null; label: string | null } {
  if (!item) return { status: null, label: null };
  const attention = item.attention;
  if (attention.includes("blocked")) return { status: "off", label: "Blocked" };
  if (attention.includes("deadline_overdue")) return { status: "off", label: "Overdue" };
  if (attention.includes("explicit_risk")) return { status: "risk", label: item.explicitRisk?.level === "watch" ? "Watch" : "At risk" };
  if (attention.includes("review_due")) return { status: "risk", label: "Review due" };
  if (attention.includes("execution_gap")) return { status: "risk", label: "No next step" };
  return { status: "on", label: "On track" };
}

const STATUS_RANK: Record<PlanStatus | "unknown", number> = { off: 0, risk: 1, on: 2, unknown: 3 };

function projectsFor(input: DashboardInput, toneFor: ToneLookup): DashboardProject[] {
  const roadmap = new Map((input.roadmapItems ?? []).filter(item => item.kind === "project").map(item => [item.id, item]));
  return input.projects
    .filter(project => project.state !== "completed" && project.state !== "archived")
    .map(project => {
      const tasks = input.tasks.filter(task => task.projectId === project.id && task.state !== "archived" && task.outcome !== "wont_do");
      const { status, label } = projectStatus(roadmap.get(project.id));
      return {
        id: project.id,
        title: project.title,
        done: tasks.filter(task => task.state === "completed").length,
        total: tasks.length,
        dueLocalDate: project.dueLocalDate ?? null,
        status,
        statusLabel: label,
        tone: toneFor(project.categoryId).tone,
      };
    })
    .sort((a, b) => STATUS_RANK[a.status ?? "unknown"] - STATUS_RANK[b.status ?? "unknown"] || (a.dueLocalDate ?? "9999").localeCompare(b.dueLocalDate ?? "9999") || a.title.localeCompare(b.title))
    .slice(0, 3);
}

function milestonesFor(input: DashboardInput): DashboardMilestone[] {
  const end = shiftLocalDate(input.localDate, 30);
  const startMs = new Date(`${input.localDate}T12:00:00Z`).getTime();
  return input.milestones
    .filter(item => item.dueLocalDate && item.dueLocalDate >= input.localDate && item.dueLocalDate <= end && item.state !== "completed" && item.state !== "archived")
    .sort((a, b) => a.dueLocalDate!.localeCompare(b.dueLocalDate!) || a.title.localeCompare(b.title))
    .slice(0, 4)
    .map(item => ({
      id: item.id,
      title: item.title,
      dueLocalDate: item.dueLocalDate!,
      offsetPercent: Math.round(((new Date(`${item.dueLocalDate}T12:00:00Z`).getTime() - startMs) / (30 * 86_400_000)) * 100),
    }));
}

/** Consecutive completed days ending today, or yesterday while today is still open. Skipped days neither break nor extend it. */
export function habitStreak(habit: DashboardHabitRecord, checkIns: readonly DashboardCheckIn[], localDate: string, earliest: string): number {
  const states = new Map(checkIns.filter(item => item.habitId === habit.id).map(item => [item.localDate, item.state]));
  let day = states.get(localDate) === "completed" ? localDate : shiftLocalDate(localDate, -1);
  let streak = 0;
  while (day >= earliest) {
    const state = states.get(day);
    if (state === "completed") streak += 1;
    else if (state === "skipped" || !isHabitScheduledOnLocalDate(habit, day)) {
      // Not a due day: carry on without counting.
    } else break;
    day = shiftLocalDate(day, -1);
  }
  return streak;
}

function habitsTodayFor(input: DashboardInput, habitById: Map<string, DashboardHabitRecord>, toneFor: ToneLookup): DashboardHabit[] {
  const earliest = shiftLocalDate(input.localDate, -27);
  return input.today.habits.map(row => {
    const habit = habitById.get(row.recordId);
    const states = new Map(input.habitCheckIns.filter(item => item.habitId === row.recordId).map(item => [item.localDate, item.state]));
    const trace = Array.from({ length: 7 }, (_, index) => {
      const state = states.get(shiftLocalDate(input.localDate, index - 6));
      return state === "completed" || state === "missed" || state === "skipped" ? state : "unrecorded";
    }) as DashboardHabit["trace"];
    return {
      id: row.recordId,
      title: habit?.name ?? row.title,
      state: row.state,
      streak: habit && habit.frequency !== "times_per_week" ? habitStreak(habit, input.habitCheckIns, input.localDate, earliest) : 0,
      weekProgress: row.weekProgress ?? null,
      trace,
      tone: toneFor(habit?.categoryId).tone,
    };
  });
}

export function projectDashboard(input: DashboardInput): DashboardModel {
  const taskById = new Map(input.tasks.map(task => [task.id, task]));
  const habits = input.habits.filter(habit => !habit.archivedAt);
  const habitById = new Map(habits.map(habit => [habit.id, habit]));
  const tones = resolveCategoryTones(input.categories);
  const categoryById = new Map(input.categories.map(category => [category.id, category]));
  const toneFor: ToneLookup = categoryId => {
    const category = categoryId ? categoryById.get(categoryId) : undefined;
    return category ? { tone: tones.get(category.id) ?? "neutral", name: category.name } : { tone: "neutral", name: null };
  };
  const projectTitles = new Map(input.projects.map(project => [project.id, project.title]));
  const nowMinute = localParts(input.now, input.timezone)?.minute ?? 0;
  const doneToday = doneTodayIds(input);
  const schedule = scheduleFor(input, taskById, toneFor, nowMinute, doneToday);
  const { upNext, laterToday } = upNextFor(input, schedule, taskById, toneFor, id => (id ? projectTitles.get(id) ?? null : null), doneToday);
  const plan = input.dailyPlans.find(item => item.localDate === input.localDate && item.state !== "archived");
  return {
    localDate: input.localDate,
    greeting: greetingFor(nowMinute),
    intention: plan?.intention?.trim() || null,
    commitments: commitmentsFor(input, taskById, doneToday),
    habitConsistency: habitConsistencyFor(input, habits),
    focusWeek: focusWeekFor(input, taskById, toneFor),
    upNext,
    laterToday,
    schedule,
    week: weekFor(input, taskById),
    projects: projectsFor(input, toneFor),
    milestones: milestonesFor(input),
    habitsToday: habitsTodayFor(input, habitById, toneFor),
  };
}
