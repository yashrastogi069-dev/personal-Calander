// View model for the D2 Dashboard (home/overview). Built only from saved planner records;
// a missing record is shown as unknown, never as progress.
import type { PlanStatus } from "@/components/premium/Pills";
import type { ToneOrNeutral } from "@/design/categoryTone";

export type DashboardCommitments = {
  /** Unique task records committed to today (open + done today). */
  total: number;
  done: number;
  left: number;
  /** One entry per committed record, done first, for the segmented bar. */
  segments: Array<"done" | "open">;
  dueToday: number;
  overdue: number;
  /** Known estimate minutes of the open commitments; null when none are estimated. */
  openPlannedMinutes: number | null;
};

export type DashboardHabitConsistency = {
  /** null when no scheduled habit day exists in the window. */
  percent: number | null;
  completed: number;
  scheduled: number;
  windowDays: number;
  /** Last 14 days, oldest first. "none" = nothing scheduled or recorded that day. */
  days: Array<{ localDate: string; level: "full" | "partial" | "missed" | "none" | "today" }>;
};

export type DashboardFocusWeek = {
  actualMinutes: number;
  /** Sum of estimates of work planned this week; null when nothing planned is estimated. */
  plannedMinutes: number | null;
  /** Actual minutes by category tone, largest first. */
  byTone: Array<{ tone: ToneOrNeutral; label: string; minutes: number }>;
};

export type DashboardUpNext = {
  taskId: string;
  title: string;
  /** "now" while its reserved slot is running, "next" for a later slot, "anytime" for flexible work. */
  timing: "now" | "next" | "anytime";
  startsAt: string | null;
  endsAt: string | null;
  minutesUntil: number | null;
  tone: ToneOrNeutral;
  categoryName: string | null;
  projectTitle: string | null;
  plannedMinutes: number | null;
  /** Focus minutes already logged on this task today. */
  actualMinutes: number | null;
};

export type DashboardScheduleItem = {
  id: string;
  kind: "task" | "appointment";
  title: string;
  startsAt: string;
  endsAt: string;
  done: boolean;
  tone: ToneOrNeutral;
  categoryName: string | null;
  /** Task id for opening; null for external appointments. */
  taskId: string | null;
};

export type DashboardSchedule = {
  items: DashboardScheduleItem[];
  /** Whole-hour window shown in the Day lens (local hours, 0–24). */
  startHour: number;
  endHour: number;
  /** Minutes since local midnight, or null when "now" is outside the window. */
  nowMinute: number | null;
  /** Estimated demand; null when nothing today carries an estimate. */
  plannedMinutes: number | null;
  freeMinutes: number;
  /** All-day and multi-day appointments, kept out of the hourly window. */
  allDay: { id: string; title: string }[];
  /** Flexible work with no time, shown under the timeline. */
  unscheduledCount: number;
};

export type DashboardWeekDay = {
  localDate: string;
  label: string;
  committed: number;
  done: number;
  isToday: boolean;
  isFuture: boolean;
  events: number;
};

export type DashboardProject = {
  id: string;
  title: string;
  done: number;
  total: number;
  dueLocalDate: string | null;
  /** Null when there is no roadmap evidence for this project: no status is shown rather than "On track". */
  status: PlanStatus | null;
  statusLabel: string | null;
  tone: ToneOrNeutral;
};

export type DashboardMilestone = {
  id: string;
  title: string;
  dueLocalDate: string;
  /** 0–100 position along the next-30-days strip. */
  offsetPercent: number;
};

export type DashboardHabit = {
  id: string;
  title: string;
  state: "due" | "completed" | "skipped" | "missed" | "weekly_opportunity" | string;
  /** Consecutive completed days up to today (yesterday when today is still open). */
  streak: number;
  weekProgress: { completed: number; target: number } | null;
  /** Last 7 days, oldest first. */
  trace: Array<"completed" | "missed" | "skipped" | "unrecorded">;
  tone: ToneOrNeutral;
};

export type DashboardModel = {
  localDate: string;
  greeting: "Good morning" | "Good afternoon" | "Good evening";
  intention: string | null;
  commitments: DashboardCommitments;
  habitConsistency: DashboardHabitConsistency;
  focusWeek: DashboardFocusWeek;
  upNext: DashboardUpNext | null;
  laterToday: DashboardScheduleItem[];
  schedule: DashboardSchedule;
  week: DashboardWeekDay[];
  projects: DashboardProject[];
  milestones: DashboardMilestone[];
  habitsToday: DashboardHabit[];
};

export type DashboardActions = {
  openToday: () => void;
  openCalendar: () => void;
  openPlanDay: () => void;
  openTasks: (filter?: "today" | "overdue") => void;
  openHabits: () => void;
  openFocus: () => void;
  openRoadmap: () => void;
  /** Carried over from the legacy overview so its routes stay one click away. */
  openWeeklyPlan: () => void;
  openReviewHistory: () => void;
  openGoals: () => void;
  openProject: (projectId: string) => void;
  openTask: (taskId: string, trigger: HTMLElement) => void;
  startFocus: (taskId: string) => void;
  /** Toggles a habit check-in for today; omitted while offline or cached. */
  checkInHabit?: (habitId: string) => void;
};
