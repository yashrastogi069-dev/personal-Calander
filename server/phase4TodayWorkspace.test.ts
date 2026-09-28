import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  TodayWorkspace,
  contextualTodayAction,
  isExecutableTodayTask,
  todaySuggestions,
} from "../client/src/features/today/TodayWorkspace";
import type { CanonicalTask } from "../shared/canonicalTask";
import type { TodayProjection } from "../shared/todayProjection";

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
      projects: [{ id: "project-book", title: "Write the book" }],
      goals: [],
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

describe("Phase 4 Today workspace", () => {
  it("renders the daily briefing in the canonical product order", () => {
    const html = renderToday();
    const sections = [
      "summary",
      "recovery",
      "timeline",
      "flexible",
      "habits",
      "suggestions",
      "completed",
    ];

    for (const [index, section] of sections.entries()) {
      const position = html.indexOf(`data-today-section=\"${section}\"`);
      expect(position, `${section} should render`).toBeGreaterThan(-1);
      if (index > 0) {
        const previous = html.indexOf(`data-today-section=\"${sections[index - 1]}\"`);
        expect(position, `${section} should follow ${sections[index - 1]}`).toBeGreaterThan(previous);
      }
    }
    expect(html).toContain("<details class=\"today-completed-evidence\"");
    expect(html).not.toContain("<details class=\"today-completed-evidence\" open");
  });

  it("presents a reserved task once and labels external calendar context as read-only", () => {
    const html = renderToday();

    expect(html.match(/data-task-record-id=\"task-reserved\"/g)).toHaveLength(1);
    expect(html).toContain("External calendar");
    expect(html).toContain("Read-only context");
    expect(html).not.toContain("Apple appointment");
  });

  it("shows an explicit truthful boundary when no incoming appointment data exists", () => {
    const html = renderToday({
      projection: { ...projection, timeline: projection.timeline.filter(item => item.kind !== "appointment") },
    });

    expect(html).toContain("No incoming calendar appointments");
    expect(html).toContain("Apple Calendar subscription is outgoing only");
    expect(html).not.toContain("Dentist appointment");
  });

  it("chooses exactly one contextual header action in recovery, planning, then focus priority", () => {
    expect(contextualTodayAction({ recoveryCount: 2, hasActivePlan: false, selectedTaskId: "task-1" })).toEqual({
      id: "resolve_recovery",
      label: "Resolve remaining work",
    });
    expect(contextualTodayAction({ recoveryCount: 0, hasActivePlan: false, selectedTaskId: "task-1" })).toEqual({
      id: "plan_today",
      label: "Plan today",
    });
    expect(contextualTodayAction({ recoveryCount: 0, hasActivePlan: true, selectedTaskId: "task-1" })).toEqual({
      id: "start_focus",
      label: "Start focus",
    });
    expect(contextualTodayAction({ recoveryCount: 0, hasActivePlan: true, selectedTaskId: null })).toBeNull();
  });

  it("keeps blocked work out of the focus choice and offers detail review", () => {
    expect(isExecutableTodayTask(waiting)).toBe(false);
    expect(isExecutableTodayTask(flexible)).toBe(true);
    const html = renderToday({
      projection: {
        ...projection,
        recovery: [],
        timeline: [],
        flexible: [{ ...projection.flexible[0], recordId: waiting.id, title: waiting.title }],
        attention: [],
      },
    });
    expect(html).toContain("Review blockers");
    expect(html).not.toContain("<button type=\"button\" class=\"today-primary-action\"");
  });

  it("labels unavailable time separately from merged scheduled demand", () => {
    const html = renderToday({ isUnavailableToday: true });
    expect(html).toContain("Scheduled demand");
    expect(html).toContain("1h 45m");
    expect(html).toContain("Unavailable");
    expect(html).toContain("All day");
    expect(html).toContain("Estimate gaps");
    expect(html).toContain("Not counted as zero");
  });

  it("derives suggestions from record facts with an explicit source and next action", () => {
    expect(todaySuggestions({
      projection,
      tasks: [reserved, flexible, waiting, completed],
      habits: [{ id: "habit-walk", name: "Evening walk" }],
      projects: [{ id: "project-book", title: "Write the book" }],
    })).toEqual([
      {
        id: "task:task-waiting",
        kind: "task",
        recordId: "task-waiting",
        title: "Follow up with the editor",
        source: "Blocked task",
        detail: "Overdue · not planned",
        actionLabel: "Review task",
      },
      {
        id: "project-task:task-flexible",
        kind: "task",
        recordId: "task-flexible",
        title: "Review the chapter notes",
        source: "From Write the book",
        detail: "Planned today · project next action",
        actionLabel: "Review task",
      },
      {
        id: "habit:habit-walk",
        kind: "habit",
        recordId: "habit-walk",
        title: "Evening walk",
        source: "Due habit",
        detail: "Scheduled for today",
        actionLabel: "Open habits",
      },
    ]);
  });

  it("keeps unsupported Today writes confirmed-only while offline", () => {
    const html = renderToday({ isOnline: false });

    expect(html).toContain("Offline · task changes remain available");
    expect(html).toContain("Reconnect to check in habits, start focus, or resolve earlier commitments");
    expect(html).toContain("Last confirmed state");
  });
});
