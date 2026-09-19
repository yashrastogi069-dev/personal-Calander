import { describe, expect, it } from "vitest";
import { projectToday, type TodayProjectionInput } from "@shared/todayProjection";

const localDate = "2026-09-20";

function task(overrides: Partial<TodayProjectionInput["tasks"][number]> = {}): TodayProjectionInput["tasks"][number] {
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
    completedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

function baseInput(overrides: Partial<TodayProjectionInput> = {}): TodayProjectionInput {
  return {
    localDate,
    workspace: {
      id: "workspace-1",
      timezone: "UTC",
      dailyCapacityMinutes: 360,
      workdayStartsAt: "09:00",
      workdayEndsAt: "17:00",
      defaultBreakMinutes: 30,
    },
    tasks: [],
    dailyPlans: [],
    dailyPlanItems: [],
    taskOccurrences: [],
    habits: [],
    habitCheckIns: [],
    externalEvents: [],
    planningAvailabilityExceptions: [],
    commitmentResolutions: [],
    ...overrides,
  };
}

describe("projectToday", () => {
  it("places a reserved committed task exactly once in the timeline", () => {
    const input = baseInput({
      tasks: [task({
        id: "task-reserved",
        title: "Prepare proposal",
        scheduledLocalDate: localDate,
        plannedStartAt: "2026-09-20T09:00:00.000Z",
        plannedEndAt: "2026-09-20T10:00:00.000Z",
        estimateMinutes: 60,
      })],
      dailyPlans: [{ id: "plan-today", localDate, state: "active" }],
      dailyPlanItems: [{ id: "item-reserved", dailyPlanId: "plan-today", taskId: "task-reserved", position: 0, state: "committed" }],
    });

    const result = projectToday(input);

    expect(result.timeline.filter(item => item.recordId === "task-reserved")).toHaveLength(1);
    expect(result.timeline[0]).toMatchObject({ kind: "task", recordId: "task-reserved", source: "reservation", readOnly: false });
    expect(result.flexible.some(item => item.recordId === "task-reserved")).toBe(false);
  });

  it("separates due unplanned attention from planned work without duplicating records", () => {
    const input = baseInput({
      tasks: [
        task({ id: "task-due", title: "Submit expense report", dueLocalDate: localDate, estimateMinutes: 30 }),
        task({ id: "task-flexible", title: "Draft notes", scheduledLocalDate: localDate, estimateMinutes: 45 }),
      ],
    });

    const result = projectToday(input);

    expect(result.attention).toEqual([
      expect.objectContaining({ kind: "task", recordId: "task-due", reason: "due_today_unplanned" }),
    ]);
    expect(result.flexible).toEqual([
      expect.objectContaining({ kind: "task", recordId: "task-flexible", source: "planned_no_time" }),
    ]);
    expect(result.flexible.some(item => item.recordId === "task-due")).toBe(false);
  });

  it("projects only earlier unresolved commitments into recovery", () => {
    const input = baseInput({
      tasks: [
        task({ id: "task-unresolved", title: "Follow up with Alex", scheduledLocalDate: "2026-09-19" }),
        task({ id: "task-resolved", title: "Review budget", scheduledLocalDate: "2026-09-18" }),
      ],
      dailyPlans: [
        { id: "plan-yesterday", localDate: "2026-09-19", state: "closed" },
        { id: "plan-two-days", localDate: "2026-09-18", state: "closed" },
      ],
      dailyPlanItems: [
        { id: "item-unresolved", dailyPlanId: "plan-yesterday", taskId: "task-unresolved", position: 0, state: "committed" },
        { id: "item-resolved", dailyPlanId: "plan-two-days", taskId: "task-resolved", position: 0, state: "committed" },
      ],
      commitmentResolutions: [{ id: "resolution-1", dailyPlanItemId: "item-resolved", taskId: "task-resolved", action: "pause" }],
    });

    expect(projectToday(input).recovery).toEqual([
      expect.objectContaining({ recordId: "task-unresolved", dailyPlanItemId: "item-unresolved", fromLocalDate: "2026-09-19" }),
    ]);
  });

  it("shows scheduled habits as habit rows with their existing check-in state", () => {
    const input = baseInput({
      habits: [
        { id: "habit-due", workspaceId: "workspace-1", name: "Read", frequency: "daily", schedule: {}, archivedAt: null },
        { id: "habit-not-due", workspaceId: "workspace-1", name: "Swim", frequency: "days_of_week", schedule: { weekdays: [1] }, archivedAt: null },
      ],
      habitCheckIns: [{ id: "check-1", habitId: "habit-due", localDate, state: "completed", completedAt: "2026-09-20T07:00:00.000Z" }],
    });

    expect(projectToday(input).habits).toEqual([
      expect.objectContaining({ kind: "habit", recordId: "habit-due", checkInId: "check-1", state: "completed" }),
    ]);
  });

  it("keeps appointments as read-only source rows in chronological order", () => {
    const input = baseInput({
      externalEvents: [
        { id: "event-later", title: "Dentist", startsAt: "2026-09-20T14:00:00.000Z", endsAt: "2026-09-20T14:30:00.000Z", status: "active" },
        { id: "event-first", title: "Team sync", startsAt: "2026-09-20T08:30:00.000Z", endsAt: "2026-09-20T09:30:00.000Z", status: "active" },
        { id: "event-cancelled", title: "Cancelled", startsAt: "2026-09-20T11:00:00.000Z", endsAt: "2026-09-20T11:30:00.000Z", status: "cancelled" },
      ],
    });

    expect(projectToday(input).timeline).toEqual([
      expect.objectContaining({ kind: "appointment", recordId: "event-first", source: "external_calendar", readOnly: true }),
      expect.objectContaining({ kind: "appointment", recordId: "event-later", source: "external_calendar", readOnly: true }),
    ]);
  });

  it("collapses completed task, occurrence, and habit facts into completion evidence", () => {
    const input = baseInput({
      tasks: [
        task({ id: "task-complete", title: "Send invoice", state: "completed", completedAt: "2026-09-20T10:00:00.000Z" }),
        task({ id: "task-recurring", title: "Water plants", recurrenceRule: { frequency: "daily" } }),
      ],
      taskOccurrences: [{ id: "occurrence-complete", taskId: "task-recurring", localDate, state: "completed", completedAt: "2026-09-20T08:00:00.000Z", plannedStartAt: null, plannedEndAt: null }],
      habits: [{ id: "habit-complete", workspaceId: "workspace-1", name: "Stretch", frequency: "daily", schedule: {}, archivedAt: null }],
      habitCheckIns: [{ id: "check-complete", habitId: "habit-complete", localDate, state: "completed", completedAt: "2026-09-20T07:00:00.000Z" }],
    });

    const result = projectToday(input);

    expect(result.completionEvidence).toEqual([
      expect.objectContaining({ kind: "habit", recordId: "habit-complete", evidenceId: "check-complete" }),
      expect.objectContaining({ kind: "task_occurrence", recordId: "task-recurring", evidenceId: "occurrence-complete" }),
      expect.objectContaining({ kind: "task", recordId: "task-complete", evidenceId: "task-complete" }),
    ]);
    expect(result.timeline.some(item => item.recordId === "task-complete" || item.recordId === "task-recurring")).toBe(false);
    expect(result.flexible.some(item => item.recordId === "task-complete" || item.recordId === "task-recurring")).toBe(false);
  });

  it("counts overlapping task reservations and appointments once in capacity", () => {
    const input = baseInput({
      workspace: {
        id: "workspace-1",
        timezone: "UTC",
        dailyCapacityMinutes: 480,
        workdayStartsAt: "09:00",
        workdayEndsAt: "17:00",
        defaultBreakMinutes: 0,
      },
      tasks: [task({
        id: "task-reserved",
        scheduledLocalDate: localDate,
        plannedStartAt: "2026-09-20T09:00:00.000Z",
        plannedEndAt: "2026-09-20T10:00:00.000Z",
        estimateMinutes: 60,
      })],
      externalEvents: [{ id: "event-overlap", title: "Stand-up", startsAt: "2026-09-20T09:30:00.000Z", endsAt: "2026-09-20T10:30:00.000Z", status: "active" }],
    });

    expect(projectToday(input).capacity).toMatchObject({
      workdayMinutes: 480,
      busyMinutes: 90,
      freeMinutes: 390,
    });
  });

  it("reports known demand and unknown estimates without treating unknown work as zero", () => {
    const input = baseInput({
      tasks: [
        task({ id: "task-60", scheduledLocalDate: localDate, estimateMinutes: 60 }),
        task({ id: "task-90", dueLocalDate: localDate, estimateMinutes: 90 }),
        task({ id: "task-unknown-1", scheduledLocalDate: localDate, estimateMinutes: null }),
        task({ id: "task-unknown-2", dueLocalDate: localDate, estimateMinutes: null }),
      ],
    });

    expect(projectToday(input).capacity).toMatchObject({
      knownDemandMinutes: 150,
      unestimatedTaskCount: 2,
      isCompleteEstimate: false,
    });
  });

  it("uses a day-specific availability exception without mutating workspace defaults", () => {
    const input = baseInput({
      planningAvailabilityExceptions: [{
        id: "exception-1",
        localDate,
        isUnavailable: 0,
        workdayStartsAt: "10:00",
        workdayEndsAt: "15:00",
        breakMinutes: 45,
      }],
    });

    expect(projectToday(input).capacity).toMatchObject({ workdayMinutes: 300, breakMinutes: 45, availableMinutes: 255 });
    expect(input.workspace.workdayStartsAt).toBe("09:00");
  });
});
