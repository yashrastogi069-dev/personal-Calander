import { describe, expect, it } from "vitest";
import type { PlanBoard } from "@/features/planning/planBoard";
import type { TodayProjection } from "@shared/todayProjection";
import { greetingFor, habitStreak, localParts, projectDashboard, projectStatus, type DashboardInput } from "./dashboardModel";

const TZ = "Pacific/Auckland";
const TODAY = "2026-10-13"; // Tuesday
// 10:45 local (NZDT, UTC+13).
const NOW = new Date("2026-10-12T21:45:00.000Z");
const at = (hhmm: string) => new Date(`2026-10-13T${hhmm}:00+13:00`).toISOString();

function projection(overrides: Partial<TodayProjection> = {}): TodayProjection {
  return {
    localDate: TODAY,
    timeline: [],
    flexible: [],
    attention: [],
    recovery: [],
    habits: [],
    completionEvidence: [],
    capacity: { dailyCapacityMinutes: 480, workdayMinutes: 480, breakMinutes: 30, busyMinutes: 60, availableMinutes: 390, freeMinutes: 270, knownDemandMinutes: 120, unestimatedTaskCount: 0, isCompleteEstimate: true },
    ...overrides,
  };
}

function week(days: PlanBoard["days"] = []): PlanBoard {
  const base = Array.from({ length: 7 }, (_, index) => ({ localDate: `2026-10-${String(12 + index).padStart(2, "0")}`, covered: true, cards: [], events: [] }));
  for (const day of days) base[base.findIndex(item => item.localDate === day.localDate)] = day;
  return { weekStart: "2026-10-12", complete: true, days: base, unplanned: [] };
}

function input(overrides: Partial<DashboardInput> = {}): DashboardInput {
  return {
    localDate: TODAY,
    now: NOW,
    timezone: TZ,
    workdayStartsAt: "09:00",
    workdayEndsAt: "17:00",
    tasks: [],
    categories: [],
    projects: [],
    milestones: [],
    habits: [],
    habitCheckIns: [],
    focusSessions: [],
    dailyPlans: [],
    today: projection(),
    week: week(),
    roadmapItems: [],
    ...overrides,
  };
}

const task = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: `Task ${id}`, state: "not_started", ...extra });
const taskRow = (id: string, startsAt: string | null = null, endsAt: string | null = null) => ({ kind: "task" as const, recordId: id, title: `Task ${id}`, source: startsAt ? "reservation" as const : "planned_no_time" as const, readOnly: false, startsAt, endsAt });

describe("dashboard model", () => {
  it("reads local time in the workspace timezone", () => {
    expect(localParts(NOW, TZ)).toEqual({ localDate: TODAY, minute: 10 * 60 + 45 });
    expect(greetingFor(10 * 60)).toBe("Good morning");
    expect(greetingFor(13 * 60)).toBe("Good afternoon");
    expect(greetingFor(19 * 60)).toBe("Good evening");
  });

  it("counts commitments from today's list plus today's completions, without double counting", () => {
    const model = projectDashboard(input({
      tasks: [
        task("a", { estimateMinutes: 60 }),
        task("b", { estimateMinutes: 30 }),
        task("c", { state: "completed", completedAt: at("08:00") }),
        task("d", { dueLocalDate: TODAY }),
        task("e", { dueLocalDate: "2026-10-01" }),
      ],
      today: projection({
        timeline: [taskRow("a", at("11:00"), at("12:00"))],
        flexible: [taskRow("b"), taskRow("b")],
        completionEvidence: [{ kind: "task", recordId: "c", evidenceId: "c", title: "Task c", completedAt: at("08:00") }],
      }),
    }));
    expect(model.commitments).toMatchObject({ total: 3, done: 1, left: 2, segments: ["done", "open", "open"], dueToday: 1, overdue: 1, openPlannedMinutes: 90 });
  });

  it("treats today's completed occurrence of a recurring task as done everywhere, not only in the count", () => {
    // projectToday keeps a committed recurring task in its lists even after today's occurrence is completed.
    const model = projectDashboard(input({
      tasks: [task("r"), task("f")],
      today: projection({
        timeline: [taskRow("r", at("11:00"), at("12:00"))],
        flexible: [taskRow("f")],
        completionEvidence: [
          { kind: "task_occurrence", recordId: "r", evidenceId: "occ-r", title: "Task r", completedAt: at("09:00") },
          { kind: "task_occurrence", recordId: "f", evidenceId: "occ-f", title: "Task f", completedAt: at("09:10") },
        ],
      }),
    }));
    expect(model.commitments).toMatchObject({ total: 2, done: 2, left: 0 });
    expect(model.schedule.items.find(item => item.taskId === "r")?.done).toBe(true);
    expect(model.schedule.unscheduledCount).toBe(0);
    expect(model.upNext).toBeNull();
    expect(model.laterToday).toEqual([]);
  });

  it("keeps an ended but open slot available as up next", () => {
    const model = projectDashboard(input({ tasks: [task("m")], today: projection({ timeline: [taskRow("m", at("08:00"), at("09:00"))] }) }));
    expect(model.upNext).toMatchObject({ taskId: "m", timing: "anytime", startsAt: null });
  });

  it("keeps all-day and multi-day appointments out of the hourly window", () => {
    const appointment = (id: string, startsAt: string, endsAt: string) => ({ kind: "appointment" as const, recordId: id, title: `Event ${id}`, source: "external_calendar" as const, readOnly: true as const, startsAt, endsAt });
    const model = projectDashboard(input({
      externalEvents: [{ id: "holiday", isAllDay: 1 }],
      today: projection({
        timeline: [
          appointment("holiday", "2026-10-12T11:00:00.000Z", "2026-10-13T11:00:00.000Z"),
          appointment("trip", "2026-10-11T11:00:00.000Z", "2026-10-15T11:00:00.000Z"),
          appointment("sync", at("10:00"), at("10:30")),
        ],
      }),
    }));
    expect(model.schedule.allDay.map(item => item.title)).toEqual(["Event holiday", "Event trip"]);
    expect(model.schedule.items.map(item => item.title)).toEqual(["Event sync"]);
    expect(model.schedule).toMatchObject({ startHour: 9, endHour: 17 });
  });

  it("reports planned time as unknown when nothing carries an estimate", () => {
    const capacity = { ...projection().capacity, knownDemandMinutes: 0, unestimatedTaskCount: 2, isCompleteEstimate: false };
    expect(projectDashboard(input({ today: projection({ capacity }) })).schedule.plannedMinutes).toBeNull();
    const empty = { ...capacity, unestimatedTaskCount: 0, isCompleteEstimate: true };
    expect(projectDashboard(input({ today: projection({ capacity: empty }) })).schedule.plannedMinutes).toBe(0);
  });

  it("treats a skipped habit day as excused in the 14-day strip", () => {
    const habits = [{ id: "h1", name: "Walk", frequency: "daily" as const, schedule: {}, createdAt: "2026-01-01" }];
    const model = projectDashboard(input({ habits, habitCheckIns: [{ habitId: "h1", localDate: "2026-10-12", state: "skipped" }] }));
    expect(model.habitConsistency.days.at(-2)).toEqual({ localDate: "2026-10-12", level: "none" });
    expect(model.habitConsistency.days.at(-3)).toEqual({ localDate: "2026-10-11", level: "missed" });
  });

  it("picks the running or next timed task as up next and lists the rest later today", () => {
    const model = projectDashboard(input({
      categories: [{ id: "cat-work", name: "Work", color: "#2f6fe4" }],
      projects: [{ id: "p1", title: "Launch portfolio site", state: "in_progress" }],
      tasks: [
        task("past", { state: "completed", completedAt: at("09:30") }),
        task("next", { categoryId: "cat-work", projectId: "p1", estimateMinutes: 60 }),
        task("later"),
      ],
      today: projection({
        timeline: [
          taskRow("past", at("09:00"), at("09:30")),
          { kind: "appointment", recordId: "ev1", title: "Team sync", source: "external_calendar", readOnly: true, startsAt: at("10:00"), endsAt: at("10:30") },
          taskRow("next", at("11:00"), at("12:00")),
          taskRow("later", at("14:00"), at("15:00")),
        ],
      }),
    }));
    expect(model.upNext).toMatchObject({ taskId: "next", timing: "next", minutesUntil: 15, tone: "work", categoryName: "Work", projectTitle: "Launch portfolio site", plannedMinutes: 60 });
    expect(model.laterToday.map(item => item.title)).toEqual(["Task later"]);
    expect(model.schedule.items.find(item => item.taskId === "past")?.done).toBe(true);
    expect(model.schedule.nowMinute).toBe(645);
    expect(model.schedule).toMatchObject({ startHour: 9, endHour: 17, plannedMinutes: 120, freeMinutes: 270 });
  });

  it("marks a running reservation as now and falls back to flexible work as anytime", () => {
    const running = projectDashboard(input({ tasks: [task("a")], today: projection({ timeline: [taskRow("a", at("10:30"), at("11:30"))] }) }));
    expect(running.upNext).toMatchObject({ taskId: "a", timing: "now", minutesUntil: null, plannedMinutes: 60 });
    const flexible = projectDashboard(input({ tasks: [task("b")], today: projection({ flexible: [taskRow("b")] }) }));
    expect(flexible.upNext).toMatchObject({ taskId: "b", timing: "anytime", startsAt: null });
    expect(projectDashboard(input()).upNext).toBeNull();
  });

  it("widens the day window to fit early or late items and hides the now-line outside it", () => {
    const model = projectDashboard(input({
      now: new Date("2026-10-12T19:00:00.000Z"), // 08:00 local
      workdayStartsAt: "09:00",
      tasks: [task("late")],
      today: projection({ timeline: [taskRow("late", at("19:00"), at("20:30"))] }),
    }));
    expect(model.schedule.startHour).toBe(9);
    expect(model.schedule.endHour).toBe(21);
    expect(model.schedule.nowMinute).toBeNull();
  });

  it("measures habit consistency over 28 days, leaving an open today pending", () => {
    const habits = [{ id: "h1", name: "Walk", frequency: "daily" as const, schedule: {}, createdAt: "2026-01-01" }];
    const checkIns = Array.from({ length: 27 }, (_, index) => ({ habitId: "h1", localDate: `2026-${index < 15 ? "09" : "10"}-${String(index < 15 ? 16 + index : index - 14).padStart(2, "0")}`, state: index % 9 === 0 ? "missed" : "completed" }));
    const model = projectDashboard(input({ habits, habitCheckIns: checkIns }));
    expect(model.habitConsistency.scheduled).toBe(27);
    expect(model.habitConsistency.completed).toBe(24);
    expect(model.habitConsistency.percent).toBe(89);
    expect(model.habitConsistency.days).toHaveLength(14);
    expect(model.habitConsistency.days.at(-1)).toEqual({ localDate: TODAY, level: "today" });
    expect(projectDashboard(input()).habitConsistency.percent).toBeNull();
  });

  it("counts a streak through skipped days and stops at a missed one", () => {
    const habit = { id: "h1", name: "Walk", frequency: "daily" as const, schedule: {}, createdAt: "2026-01-01" };
    const checkIns = [
      { habitId: "h1", localDate: "2026-10-12", state: "completed" },
      { habitId: "h1", localDate: "2026-10-11", state: "skipped" },
      { habitId: "h1", localDate: "2026-10-10", state: "completed" },
      { habitId: "h1", localDate: "2026-10-09", state: "missed" },
      { habitId: "h1", localDate: "2026-10-08", state: "completed" },
    ];
    expect(habitStreak(habit, checkIns, TODAY, "2026-09-16")).toBe(2);
    expect(habitStreak(habit, [...checkIns, { habitId: "h1", localDate: TODAY, state: "completed" }], TODAY, "2026-09-16")).toBe(3);
  });

  it("sums this week's focus by category and plans from estimated week cards", () => {
    const model = projectDashboard(input({
      categories: [{ id: "w", name: "Work", color: "#2f6fe4" }, { id: "l", name: "Learning", color: "#c27612" }],
      tasks: [task("a", { categoryId: "w", estimateMinutes: 120 }), task("b", { categoryId: "l", estimateMinutes: 60 }), task("c")],
      focusSessions: [
        { taskId: "a", state: "completed", startedAt: at("08:00"), lastResumedAt: at("08:00"), activeSeconds: 3600 },
        { taskId: "b", state: "completed", startedAt: "2026-10-11T20:00:00.000Z", lastResumedAt: null, activeSeconds: 1800 },
        { taskId: "a", state: "completed", startedAt: "2026-10-05T20:00:00.000Z", lastResumedAt: null, activeSeconds: 9999 },
        { taskId: "a", state: "abandoned", startedAt: at("07:00"), lastResumedAt: null, activeSeconds: 600 },
      ],
      week: week([
        { localDate: "2026-10-13", covered: true, events: [], cards: [
          { taskId: "a", title: "a", localDate: TODAY, missingTask: false, estimateMinutes: 120, dueLocalDate: null, reservation: null, sources: [] },
          { taskId: "c", title: "c", localDate: TODAY, missingTask: false, estimateMinutes: null, dueLocalDate: null, reservation: null, sources: [] },
        ] },
        { localDate: "2026-10-14", covered: true, events: [], cards: [
          { taskId: "b", title: "b", localDate: "2026-10-14", missingTask: false, estimateMinutes: 60, dueLocalDate: null, reservation: null, sources: [] },
        ] },
      ]),
    }));
    expect(model.focusWeek.actualMinutes).toBe(90);
    expect(model.focusWeek.plannedMinutes).toBe(180);
    expect(model.focusWeek.byTone).toEqual([{ tone: "work", label: "Work", minutes: 60 }, { tone: "learning", label: "Learning", minutes: 30 }]);
  });

  it("builds week rhythm from plan cards with done from task state or saved evidence", () => {
    const model = projectDashboard(input({
      tasks: [task("a", { state: "completed" }), task("b"), task("c"), task("x", { state: "archived" })],
      week: week([
        { localDate: "2026-10-12", covered: true, events: [], cards: [
          { taskId: "a", title: "a", localDate: "2026-10-12", missingTask: false, estimateMinutes: null, dueLocalDate: null, reservation: null, sources: [] },
          { taskId: "b", title: "b", localDate: "2026-10-12", missingTask: false, estimateMinutes: null, dueLocalDate: null, reservation: null, sources: [{ kind: "commitment", id: "i1", state: "done" }] },
          { taskId: "x", title: "x", localDate: "2026-10-12", missingTask: false, estimateMinutes: null, dueLocalDate: null, reservation: null, sources: [] },
        ] },
        { localDate: "2026-10-15", covered: true, events: [{ id: "e", title: "e", startsAt: "", endsAt: "", isAllDay: false, source: "Google" }], cards: [
          { taskId: "c", title: "c", localDate: "2026-10-15", missingTask: false, estimateMinutes: null, dueLocalDate: null, reservation: null, sources: [] },
        ] },
      ]),
    }));
    expect(model.week.map(day => [day.label, day.committed, day.done, day.isToday, day.isFuture, day.events])).toEqual([
      ["Mon", 2, 2, false, false, 0],
      ["Tue", 0, 0, true, false, 0],
      ["Wed", 0, 0, false, true, 0],
      ["Thu", 1, 0, false, true, 1],
      ["Fri", 0, 0, false, true, 0],
      ["Sat", 0, 0, false, true, 0],
      ["Sun", 0, 0, false, true, 0],
    ]);
  });

  it("maps roadmap attention onto status pills and orders projects by need", () => {
    // No roadmap evidence is unknown, never "On track".
    expect(projectStatus(undefined)).toEqual({ status: null, label: null });
    expect(projectStatus({ attention: [], explicitRisk: null })).toEqual({ status: "on", label: "On track" });
    expect(projectStatus({ attention: ["blocked"], explicitRisk: null })).toEqual({ status: "off", label: "Blocked" });
    expect(projectStatus({ attention: ["deadline_overdue", "execution_gap"], explicitRisk: null })).toEqual({ status: "off", label: "Overdue" });
    expect(projectStatus({ attention: ["explicit_risk"], explicitRisk: { level: "watch", note: null } })).toEqual({ status: "risk", label: "Watch" });
    expect(projectStatus({ attention: ["execution_gap"], explicitRisk: null })).toEqual({ status: "risk", label: "No next step" });

    const model = projectDashboard(input({
      projects: [
        { id: "p1", title: "Calm", state: "in_progress", dueLocalDate: "2026-12-01" },
        { id: "p2", title: "Late", state: "in_progress", dueLocalDate: "2026-10-01" },
        { id: "p3", title: "Finished", state: "completed" },
      ],
      tasks: [task("t1", { projectId: "p1", state: "completed" }), task("t2", { projectId: "p1" }), task("t3", { projectId: "p1", outcome: "wont_do" })],
      roadmapItems: [{ kind: "project", id: "p2", attention: ["deadline_overdue"], explicitRisk: null } as never],
    }));
    expect(model.projects.map(project => [project.title, project.status, project.done, project.total])).toEqual([
      ["Late", "off", 0, 0],
      ["Calm", null, 1, 2],
    ]);
    // The roadmap projection failed: every status is unknown rather than defaulting to on track.
    const failed = projectDashboard(input({ projects: [{ id: "p1", title: "Calm", state: "in_progress" }], roadmapItems: null }));
    expect(failed.projects[0]).toMatchObject({ status: null, statusLabel: null });
  });

  it("places open milestones due in the next 30 days on the strip", () => {
    const model = projectDashboard(input({
      milestones: [
        { id: "m1", title: "Portfolio v1", state: "not_started", dueLocalDate: "2026-10-18" },
        { id: "m2", title: "Old", state: "not_started", dueLocalDate: "2026-10-01" },
        { id: "m3", title: "Far", state: "not_started", dueLocalDate: "2026-12-30" },
        { id: "m4", title: "Done", state: "completed", dueLocalDate: "2026-10-20" },
        { id: "m5", title: "Edge", state: "in_progress", dueLocalDate: "2026-11-12" },
      ],
    }));
    expect(model.milestones).toEqual([
      { id: "m1", title: "Portfolio v1", dueLocalDate: "2026-10-18", offsetPercent: 17 },
      { id: "m5", title: "Edge", dueLocalDate: "2026-11-12", offsetPercent: 100 },
    ]);
  });

  it("reads today's intention from the active daily plan only", () => {
    expect(projectDashboard(input({ dailyPlans: [{ localDate: TODAY, state: "active", intention: "  ship the draft " }] })).intention).toBe("ship the draft");
    expect(projectDashboard(input({ dailyPlans: [{ localDate: TODAY, state: "archived", intention: "old" }] })).intention).toBeNull();
  });
});
