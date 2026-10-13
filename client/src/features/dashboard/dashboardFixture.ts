// Synthetic Dashboard model for tests and local previews. Not real planner data.
// Workspace timezone Pacific/Auckland (NZDT, UTC+13 on 2026-10-13); "now" is 10:45 local.
import type { DashboardActions, DashboardModel, DashboardScheduleItem } from "./dashboardTypes";

export const FIXTURE_TIMEZONE = "Pacific/Auckland";

/** UTC instant for a local NZDT clock time on 2026-10-13. */
function nz(hour: number, minute = 0): string {
  return new Date(Date.UTC(2026, 9, 13, hour - 13, minute)).toISOString();
}

const scheduleItems: DashboardScheduleItem[] = [
  { id: "task-t-plan-9", kind: "task", title: "Plan the day", startsAt: nz(9), endsAt: nz(9, 30), done: true, tone: "work", categoryName: "Work", taskId: "t-plan" },
  { id: "event-e-sync", kind: "appointment", title: "Team sync", startsAt: nz(10), endsAt: nz(10, 30), done: false, tone: "neutral", categoryName: null, taskId: null },
  { id: "task-t-draft-11", kind: "task", title: "Draft portfolio case study", startsAt: nz(11), endsAt: nz(12), done: false, tone: "work", categoryName: "Work", taskId: "t-draft" },
  { id: "event-e-lunch", kind: "appointment", title: "Lunch with Priya", startsAt: nz(12), endsAt: nz(13), done: false, tone: "neutral", categoryName: null, taskId: null },
  { id: "task-t-sql-13", kind: "task", title: "SQL course: lesson 4", startsAt: nz(13), endsAt: nz(13, 30), done: false, tone: "learning", categoryName: "Learning", taskId: "t-sql" },
  { id: "task-t-apply-14", kind: "task", title: "Apply to 2 graduate roles", startsAt: nz(14), endsAt: nz(15), done: false, tone: "work", categoryName: "Work", taskId: "t-apply" },
  { id: "task-t-budget-1430", kind: "task", title: "Review October budget", startsAt: nz(14, 30), endsAt: nz(15), done: false, tone: "personal", categoryName: "Personal", taskId: "t-budget" },
  { id: "task-t-walk-1830", kind: "task", title: "Evening walk", startsAt: nz(18, 30), endsAt: nz(19), done: false, tone: "health", categoryName: "Health", taskId: "t-walk" },
];

export const dashboardFixture: DashboardModel = {
  localDate: "2026-10-13",
  greeting: "Good morning",
  intention: "Ship the portfolio case study draft",
  commitments: {
    total: 5,
    done: 3,
    left: 2,
    segments: ["done", "done", "done", "open", "open"],
    dueToday: 2,
    overdue: 1,
    openPlannedMinutes: 130,
  },
  habitConsistency: {
    percent: 82,
    completed: 23,
    scheduled: 28,
    windowDays: 28,
    days: [
      { localDate: "2026-09-30", level: "full" },
      { localDate: "2026-10-01", level: "full" },
      { localDate: "2026-10-02", level: "partial" },
      { localDate: "2026-10-03", level: "full" },
      { localDate: "2026-10-04", level: "none" },
      { localDate: "2026-10-05", level: "full" },
      { localDate: "2026-10-06", level: "missed" },
      { localDate: "2026-10-07", level: "full" },
      { localDate: "2026-10-08", level: "full" },
      { localDate: "2026-10-09", level: "partial" },
      { localDate: "2026-10-10", level: "full" },
      { localDate: "2026-10-11", level: "none" },
      { localDate: "2026-10-12", level: "full" },
      { localDate: "2026-10-13", level: "today" },
    ],
  },
  focusWeek: {
    actualMinutes: 390,
    plannedMinutes: 600,
    byTone: [
      { tone: "work", label: "Work", minutes: 240 },
      { tone: "learning", label: "Learning", minutes: 90 },
      { tone: "health", label: "Health", minutes: 60 },
    ],
  },
  upNext: {
    taskId: "t-draft",
    title: "Draft portfolio case study",
    timing: "next",
    startsAt: nz(11),
    endsAt: nz(12),
    minutesUntil: 15,
    tone: "work",
    categoryName: "Work",
    projectTitle: "Launch portfolio site",
    plannedMinutes: 60,
    actualMinutes: null,
  },
  laterToday: [scheduleItems[3], scheduleItems[4], scheduleItems[5], scheduleItems[6]],
  schedule: {
    items: scheduleItems,
    startHour: 9,
    endHour: 19,
    nowMinute: 10 * 60 + 45,
    plannedMinutes: 195,
    freeMinutes: 270,
    unscheduledCount: 2,
    allDay: [{ id: "event-synthetic-holiday", title: "Synthetic public holiday" }],
  },
  week: [
    { localDate: "2026-10-12", label: "Mon", committed: 5, done: 4, isToday: false, isFuture: false, events: 2 },
    { localDate: "2026-10-13", label: "Tue", committed: 5, done: 3, isToday: true, isFuture: false, events: 2 },
    { localDate: "2026-10-14", label: "Wed", committed: 4, done: 0, isToday: false, isFuture: true, events: 1 },
    { localDate: "2026-10-15", label: "Thu", committed: 6, done: 0, isToday: false, isFuture: true, events: 3 },
    { localDate: "2026-10-16", label: "Fri", committed: 3, done: 0, isToday: false, isFuture: true, events: 0 },
    { localDate: "2026-10-17", label: "Sat", committed: 1, done: 0, isToday: false, isFuture: true, events: 1 },
    { localDate: "2026-10-18", label: "Sun", committed: 0, done: 0, isToday: false, isFuture: true, events: 0 },
  ],
  projects: [
    { id: "p-portfolio", title: "Launch portfolio site", done: 6, total: 10, dueLocalDate: "2026-11-30", status: "risk", statusLabel: "At risk", tone: "work" },
    { id: "p-10k", title: "Run a 10K", done: 7, total: 20, dueLocalDate: null, status: "on", statusLabel: "On track", tone: "health" },
    { id: "p-sql", title: "Finish SQL course", done: 4, total: 12, dueLocalDate: "2026-11-06", status: "on", statusLabel: "On track", tone: "learning" },
  ],
  milestones: [
    { id: "m-v1", title: "Portfolio v1", dueLocalDate: "2026-10-18", offsetPercent: 17 },
    { id: "m-10k", title: "10K race", dueLocalDate: "2026-10-26", offsetPercent: 43 },
    { id: "m-cert", title: "SQL cert", dueLocalDate: "2026-11-06", offsetPercent: 80 },
  ],
  habitsToday: [
    { id: "h-walk", title: "Walk 20 min", state: "completed", streak: 12, weekProgress: null, trace: ["completed", "completed", "completed", "completed", "completed", "completed", "completed"], tone: "health" },
    { id: "h-read", title: "Read 20 pages", state: "due", streak: 6, weekProgress: null, trace: ["completed", "completed", "completed", "completed", "completed", "completed", "unrecorded"], tone: "personal" },
    { id: "h-water", title: "Drink 2L water", state: "weekly_opportunity", streak: 0, weekProgress: { completed: 3, target: 5 }, trace: ["completed", "missed", "completed", "completed", "skipped", "completed", "unrecorded"], tone: "work" },
    { id: "h-meditate", title: "Meditate 10 min", state: "due", streak: 0, weekProgress: null, trace: ["missed", "completed", "completed", "missed", "completed", "completed", "unrecorded"], tone: "learning" },
  ],
};

/** A workspace with no records yet: every card should show its empty state. */
export const emptyDashboardFixture: DashboardModel = {
  localDate: "2026-10-13",
  greeting: "Good morning",
  intention: null,
  commitments: { total: 0, done: 0, left: 0, segments: [], dueToday: 0, overdue: 0, openPlannedMinutes: null },
  habitConsistency: { percent: null, completed: 0, scheduled: 0, windowDays: 28, days: dashboardFixture.habitConsistency.days.map(day => ({ localDate: day.localDate, level: "none" as const })) },
  focusWeek: { actualMinutes: 0, plannedMinutes: null, byTone: [] },
  upNext: null,
  laterToday: [],
  schedule: { items: [], startHour: 9, endHour: 17, nowMinute: 10 * 60 + 45, plannedMinutes: null, freeMinutes: 480, unscheduledCount: 0, allDay: [] },
  week: dashboardFixture.week.map(day => ({ ...day, committed: 0, done: 0, events: 0 })),
  projects: [],
  milestones: [],
  habitsToday: [],
};

export function noopDashboardActions(overrides: Partial<DashboardActions> = {}): DashboardActions {
  const noop = () => undefined;
  return {
    openToday: noop,
    openCalendar: noop,
    openPlanDay: noop,
    openTasks: noop,
    openHabits: noop,
    openFocus: noop,
    openRoadmap: noop,
    openWeeklyPlan: noop,
    openReviewHistory: noop,
    openGoals: noop,
    openProject: noop,
    openTask: noop,
    startFocus: noop,
    checkInHabit: noop,
    ...overrides,
  };
}
