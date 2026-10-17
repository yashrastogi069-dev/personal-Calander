import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  TodayWorkspace,
  contextualTodayAction,
  isExecutableTodayTask,
  todayLinkedResolution,
  todaySuggestions,
} from "../client/src/features/today/TodayWorkspace";
import type { CanonicalTask } from "../shared/canonicalTask";
import type { TodayProjection } from "../shared/todayProjection";
import { nextTodayMilestone, todayHabitTrace } from "../client/src/features/today/todayContext";

const localDate = "2026-09-21";

function task(overrides: Partial<CanonicalTask>): CanonicalTask {
  return {
    id: "task-default",
    workspaceId: "workspace-1",
    title: "Default task",
    state: "not_started",
    priority: "medium",
    dueLocalDate: null,
    scheduledLocalDate: null,
    plannedStartAt: null,
    plannedEndAt: null,
    estimateMinutes: null,
    sortOrder: 0,
    version: 1,
    ...overrides,
  };
}

const reserved = task({
  id: "task-reserved",
  title: "Protected writing block",
  projectId: "project-book",
  scheduledLocalDate: localDate,
  plannedStartAt: "2026-09-21T09:00:00.000Z",
  plannedEndAt: "2026-09-21T10:00:00.000Z",
  estimateMinutes: 60,
});
const flexible = task({
  id: "task-flexible",
  title: "Review the chapter notes",
  projectId: "project-book",
  scheduledLocalDate: localDate,
  estimateMinutes: 35,
  sortOrder: 1,
});
const waiting = task({
  id: "task-waiting",
  title: "Follow up with the editor",
  state: "blocked",
  dueLocalDate: "2026-09-20",
  estimateMinutes: null,
  sortOrder: 2,
});
const completed = task({
  id: "task-completed",
  title: "Send the outline",
  state: "completed",
  completedAt: "2026-09-21T07:00:00.000Z",
  estimateMinutes: 20,
});

const projection: TodayProjection = {
  localDate,
  timeline: [
    {
      kind: "task",
      recordId: reserved.id,
      title: reserved.title,
      source: "reservation",
      readOnly: false,
      startsAt: reserved.plannedStartAt ?? null,
      endsAt: reserved.plannedEndAt ?? null,
    },
    {
      kind: "appointment",
      recordId: "event-dentist",
      title: "Dentist appointment",
      source: "external_calendar",
      readOnly: true,
      startsAt: "2026-09-21T11:00:00.000Z",
      endsAt: "2026-09-21T11:45:00.000Z",
    },
  ],
  flexible: [
    {
      kind: "task",
      recordId: flexible.id,
      title: flexible.title,
      source: "planned_no_time",
      readOnly: false,
      startsAt: null,
      endsAt: null,
    },
  ],
  attention: [
    {
      kind: "task",
      recordId: waiting.id,
      title: waiting.title,
      reason: "overdue_unplanned",
    },
  ],
  recovery: [
    {
      kind: "task",
      recordId: "task-recovery",
      title: "Return the library books",
      dailyPlanItemId: "item-yesterday",
      fromLocalDate: "2026-09-20",
    },
  ],
  habits: [
    {
      kind: "habit",
      recordId: "habit-walk",
      title: "Evening walk",
      checkInId: null,
      state: "due",
    },
  ],
  completionEvidence: [
    {
      kind: "task",
      recordId: completed.id,
      evidenceId: completed.id,
      title: completed.title,
      completedAt: completed.completedAt ?? null,
    },
  ],
  capacity: {
    dailyCapacityMinutes: 360,
    workdayMinutes: 480,
    breakMinutes: 30,
    busyMinutes: 105,
    availableMinutes: 405,
    freeMinutes: 345,
    knownDemandMinutes: 115,
    unestimatedTaskCount: 2,
    isCompleteEstimate: false,
  },
};

const callbacks = {
  onPlanToday: vi.fn(),
  onStartFocus: vi.fn(),
  onResolveRecovery: vi.fn(),
  onOpenHabits: vi.fn(),
  onUpdateTask: vi.fn(async (record: CanonicalTask) => ({ record, queued: false })),
  onCreateSubtask: vi.fn(async (record: CanonicalTask) => ({ record, queued: false })),
  onHabitCheckIn: vi.fn(),
  onClearHabitCheckIn: vi.fn(),
  onSelectedRecordChange: vi.fn(),
};

function renderToday(overrides: Partial<Parameters<typeof TodayWorkspace>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(TodayWorkspace, {
      projection,
      tasks: [reserved, flexible, waiting, completed],
      habits: [{ id: "habit-walk", name: "Evening walk", color: "#2f8b6c" }],
      projects: [{ id: "project-book", title: "Write the book", goalId: "goal-book" }],
      goals: [{ id: "goal-book", title: "Publish the book" }],
      categories: [],
      dependencies: [],
      timezone: "UTC",
      hasActivePlan: true,
      commitmentCount: 2,
      selectedRecordId: null,
      pendingTaskIds: new Set([flexible.id]),
      conflictCountByTask: new Map([[waiting.id, 1]]),
      isOnline: true,
      habitPending: false,
      habitError: null,
      ...callbacks,
      ...overrides,
    }),
  );
}

// Fixed clock: 08:00 UTC on the fixture day (the timeline and hero read it).
const now = new Date("2026-09-21T08:00:00.000Z");
const dentist = { id: "event-dentist", title: "Dentist appointment", startsAt: "2026-09-21T11:00:00.000Z", endsAt: "2026-09-21T11:45:00.000Z", status: "active", isAllDay: 0, payload: null };

describe("Phase 4 Today workspace (layout pass)", () => {
  it("renders the summary, hero, one list, habit chips and a compact timeline in order", () => {
    const html = renderToday({ now, externalEvents: [dentist] });
    const order = ["summary", "list", "habits", "timeline"].map(section => html.indexOf(`data-today-section="${section}"`));
    for (const position of order) expect(position).toBeGreaterThan(-1);
    expect([...order].sort((left, right) => left - right)).toEqual(order);
    expect(html.indexOf("data-hero=")).toBeLessThan(order[1]);
    expect(html).not.toContain('data-today-section="suggestions"');
    expect(html).not.toContain("Recorded practice for Evening walk");
  });

  it("shows one check per row and never routes a tick through Plan or Recovery copy", () => {
    const html = renderToday({
      now,
      dailyPlans: [{ id: "plan-today", localDate, state: "active" }],
      dailyPlanItems: [{ id: "item-flexible", dailyPlanId: "plan-today", taskId: flexible.id, state: "committed", position: 0 }],
    });
    const rows = html.match(/<li class="td-row /g) ?? [];
    expect(rows.length).toBe(2);
    expect((html.match(/<button[^>]*class="tk-check[ "]/g) ?? []).length).toBe(rows.length);
    expect(html).toContain('data-source="daily_commitment"');
    expect(html).not.toMatch(/Resolve .* in Plan|Resolve earlier commitment|Open Review/);
  });

  it("presents a reserved task once in the list and styles calendar events as external context", () => {
    const html = renderToday({ now, externalEvents: [dentist] });
    expect(html.match(/data-task-record-id="task-reserved"/g)).toHaveLength(1);
    expect(html).toContain('data-timeline-kind="meeting"');
    expect(html).toMatch(/class="td-tl-entry is-external/);
    expect(html).toContain("Dentist appointment");
    expect(html).toContain("data-now-line");
  });

  it("shows a meeting hero with Join only when the stored event carries a link", () => {
    const soon = { ...dentist, id: "event-standup", title: "Standup", startsAt: "2026-09-21T08:12:00.000Z", endsAt: "2026-09-21T08:27:00.000Z", payload: { hangoutLink: "https://meet.google.com/demo" } };
    const html = renderToday({ now, externalEvents: [soon] });
    expect(html).toContain('data-hero="meeting"');
    expect(html).toContain("Standup in 12 min");
    expect(html).toContain('href="https://meet.google.com/demo"');
    const plain = renderToday({ now, externalEvents: [{ ...soon, payload: null }] });
    expect(plain).toContain('data-hero="meeting"');
    expect(plain).not.toContain("meet.google.com");
  });

  it("renders due habits as chips and hides the row when nothing is due", () => {
    const html = renderToday({ now });
    expect(html).toContain('data-habit-state="due"');
    expect(html).toContain("Mark Evening walk done");
    const none = renderToday({ now, projection: { ...projection, habits: [] } });
    expect(none).not.toContain('data-today-section="habits"');
  });

  it("offers the morning card before a plan exists and the shutdown card after preferredShutdownAt", () => {
    expect(renderToday({ now, dailyPlans: [] })).toContain('data-today-card="morning"');
    const evening = renderToday({ now: new Date("2026-09-21T19:00:00.000Z"), dailyPlans: [{ id: "plan-today", localDate, state: "active" }], workspace: { preferredShutdownAt: "18:00" } });
    expect(evening).toContain('data-today-card="evening"');
    const closed = renderToday({ now, dailyPlans: [{ id: "plan-today", localDate, state: "closed", version: 3, reflection: "Good day" } as never] });
    expect(closed).toContain('data-today-card="closed"');
    expect(closed).toContain("Reopen day");
  });

  it("keeps the seven-day habit trace model for Habits without converting blank days into misses", () => {
    const trace = todayHabitTrace("habit-walk", localDate, [
      { habitId: "habit-walk", localDate: "2026-09-16", state: "completed" },
      { habitId: "habit-walk", localDate: "2026-09-18", state: "missed" },
      { habitId: "habit-walk", localDate: "2026-09-20", state: "skipped" },
    ], "due");
    expect(trace.map(day => day.state)).toEqual(["unrecorded", "completed", "unrecorded", "missed", "unrecorded", "skipped", "unrecorded"]);
  });

  it("uses only explicit task-goal/project-goal links for upcoming milestone context", () => {
    const candidates = [
      { id: "linked", goalId: "goal-book", title: "Finish chapter", dueLocalDate: "2026-09-28", state: "active" },
      { id: "unrelated", goalId: "goal-other", title: "Unrelated", dueLocalDate: "2026-09-22", state: "active" },
      { id: "past", goalId: "goal-book", title: "Past", dueLocalDate: "2026-09-20", state: "active" },
    ];
    expect(nextTodayMilestone({ localDate, visibleTaskIds: [flexible.id], tasks: [flexible], projects: [{ id: "project-book", goalId: "goal-book" }], milestones: candidates })?.id).toBe("linked");
    expect(nextTodayMilestone({ localDate, visibleTaskIds: [], tasks: [flexible], projects: [{ id: "project-book", goalId: "goal-book" }], milestones: candidates })).toBeNull();
  });

  it("chooses exactly one contextual header action in recovery, planning, then focus priority", () => {
    expect(contextualTodayAction({ recoveryCount: 2, hasActivePlan: false, selectedTaskId: "task-1" })).toEqual({ id: "resolve_recovery", label: "Resolve remaining work" });
    expect(contextualTodayAction({ recoveryCount: 0, hasActivePlan: false, selectedTaskId: "task-1" })).toEqual({ id: "plan_today", label: "Plan today" });
    expect(contextualTodayAction({ recoveryCount: 0, hasActivePlan: true, selectedTaskId: "task-1" })).toEqual({ id: "start_focus", label: "Start focus" });
    expect(contextualTodayAction({ recoveryCount: 0, hasActivePlan: true, selectedTaskId: null })).toBeNull();
  });

  it("keeps blocked and offline work out of focus and marks the blocked check", () => {
    expect(isExecutableTodayTask(waiting)).toBe(false);
    expect(isExecutableTodayTask(flexible)).toBe(true);
    expect(isExecutableTodayTask(task({ id: "offline:pending-capture" }))).toBe(false);
    const html = renderToday({ now, projection: { ...projection, timeline: [], flexible: [{ ...projection.flexible[0], recordId: waiting.id, title: waiting.title }], attention: [] } });
    expect(html).toContain("is-blocked");
  });

  it("routes dated occurrence and plan commitments by underlying references", () => {
    const plans = [{ id: "plan-today", localDate, state: "active" }];
    const items = [{ id: "item-1", dailyPlanId: "plan-today", taskId: reserved.id, state: "committed", position: 0 }];
    const occurrences = [{ id: "occ-1", taskId: reserved.id, localDate, state: "pending" }];
    expect(todayLinkedResolution(reserved.id, localDate, plans, items, occurrences)).toBe("both");
    expect(todayLinkedResolution(reserved.id, localDate, plans, items, [])).toBe("plan");
    expect(todayLinkedResolution(reserved.id, localDate, plans, [], occurrences)).toBe("review");
    expect(todayLinkedResolution(reserved.id, localDate, plans, [], [{ ...occurrences[0], state: "completed" }])).toBeNull();
    expect(todayLinkedResolution(flexible.id, localDate, plans, items, occurrences)).toBeNull();
    expect(todayLinkedResolution(reserved.id, localDate, [], [], [], true)).toBe("reconcile");
  });

  it("derives suggestions from record facts with an explicit source and next action", () => {
    expect(todaySuggestions({
      projection,
      tasks: [reserved, flexible, waiting, completed],
      habits: [{ id: "habit-walk", name: "Evening walk" }],
      projects: [{ id: "project-book", title: "Write the book" }],
    }).map(suggestion => [suggestion.id, suggestion.source, suggestion.actionLabel])).toEqual([
      ["task:task-waiting", "Blocked task", "Review task"],
      ["project-task:task-flexible", "From Write the book", "Review task"],
      ["habit:habit-walk", "Due habit", "Open habits"],
    ]);
  });

  it("explains what stays available while offline", () => {
    const html = renderToday({ now, isOnline: false });
    expect(html).toContain("Task ticks still save");
    expect(html).toContain("Reconnect to check in habits, start focus or change today");
  });

  it("lists earlier completion evidence in a collapsed Done today group", () => {
    const html = renderToday({ now });
    expect(html).toContain('<details class="td-done"');
    expect(html).toContain("Done today · 1");
    expect(html).toContain("Send the outline");
  });
});
