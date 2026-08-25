import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import * as planning from "./planning";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("planner task API", () => {
  it("rejects a timeblock whose end precedes its start before attempting persistence", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.planner.task.create({
      workspaceId: "workspace-api-check",
      timezone: "UTC",
      title: "Invalid timeblock",
      state: "not_started",
      priority: "medium",
      horizon: "weekly",
      sortOrder: 0,
      plannedStartAt: new Date("2026-08-24T11:00:00.000Z"),
      plannedEndAt: new Date("2026-08-24T10:00:00.000Z"),
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates the habit undo and skipped-state contracts before persistence", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    const scope = { workspaceId: "workspace-api-check", timezone: "UTC", habitId: "habit-api-check" };

    await expect(caller.planner.habit.clearCheckIn({ ...scope, localDate: "not-a-local-date" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller.planner.habit.checkIn({ ...scope, localDate: "2026-08-24", state: "not-a-state" as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("passes valid skipped and clear habit actions through the public router contract", async () => {
    const skip = vi.spyOn(planning, "upsertHabitCheckIn").mockResolvedValue({ id: "check-in-1", state: "skipped" } as never);
    const clear = vi.spyOn(planning, "clearHabitCheckIn").mockResolvedValue({ habitId: "habit-api-check", localDate: "2026-08-24", cleared: true });
    const caller = appRouter.createCaller(createPublicContext());
    const scope = { workspaceId: "workspace-api-check", timezone: "UTC", habitId: "habit-api-check", localDate: "2026-08-24" };

    await expect(caller.planner.habit.checkIn({ ...scope, state: "skipped" })).resolves.toMatchObject({ state: "skipped" });
    await expect(caller.planner.habit.clearCheckIn(scope)).resolves.toEqual({ habitId: scope.habitId, localDate: scope.localDate, cleared: true });
    expect(skip).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: scope.workspaceId, habitId: scope.habitId, localDate: scope.localDate, state: "skipped" }), expect.objectContaining({ workspaceId: scope.workspaceId, habitId: scope.habitId, localDate: scope.localDate, state: "skipped" }));
    expect(clear).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: scope.workspaceId, habitId: scope.habitId, localDate: scope.localDate }), expect.objectContaining({ workspaceId: scope.workspaceId, habitId: scope.habitId, localDate: scope.localDate }));
    skip.mockRestore();
    clear.mockRestore();
  });

  it("preserves explicit weekday and interval habit schedules through the creation contract", async () => {
    const create = vi.spyOn(planning, "createHabit").mockResolvedValue({ id: "habit-schedule-1", version: 1 } as never);
    const caller = appRouter.createCaller(createPublicContext());
    const scope = { workspaceId: "workspace-api-check", timezone: "UTC", color: "#285D52" };
    const weekdaySchedule = { weekdays: [1, 3, 5] };
    const intervalSchedule = { startLocalDate: "2026-08-24", intervalDays: 3 };

    await expect(caller.planner.habit.create({ ...scope, name: "Weekday reset", frequency: "days_of_week", schedule: weekdaySchedule })).resolves.toMatchObject({ id: "habit-schedule-1" });
    await expect(caller.planner.habit.create({ ...scope, name: "Interval reset", frequency: "interval", schedule: intervalSchedule })).resolves.toMatchObject({ id: "habit-schedule-1" });
    expect(create).toHaveBeenNthCalledWith(1, expect.objectContaining({ workspaceId: scope.workspaceId, timezone: scope.timezone }), expect.objectContaining({ name: "Weekday reset", frequency: "days_of_week", schedule: weekdaySchedule }));
    expect(create).toHaveBeenNthCalledWith(2, expect.objectContaining({ workspaceId: scope.workspaceId, timezone: scope.timezone }), expect.objectContaining({ name: "Interval reset", frequency: "interval", schedule: intervalSchedule }));
    create.mockRestore();
  });

  it("passes a saved-view configuration overwrite through the public router contract", async () => {
    const update = vi.spyOn(planning, "updateSavedView").mockResolvedValue({ id: "view-1", name: "Focus", configuration: { filter: "all", sort: "created" }, version: 2 } as never);
    const caller = appRouter.createCaller(createPublicContext());
    const input = { workspaceId: "workspace-api-check", timezone: "UTC", id: "view-1", expectedVersion: 1, configuration: { filter: "all", sort: "created" } };

    await expect(caller.planner.savedView.update(input)).resolves.toMatchObject({ id: "view-1", configuration: { filter: "all", sort: "created" }, version: 2 });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: input.workspaceId, timezone: input.timezone }), expect.objectContaining({ id: input.id, expectedVersion: input.expectedVersion, configuration: input.configuration }));
    update.mockRestore();
  });

  it("passes a version-safe recurrence configuration update through the public router contract", async () => {
    const update = vi.spyOn(planning, "updateTask").mockResolvedValue({ id: "task-1", version: 2, recurrenceRule: { frequency: "weekly", interval: 2 }, recurrenceAnchor: "scheduled", recurrenceUntilLocalDate: "2026-12-31" } as never);
    const caller = appRouter.createCaller(createPublicContext());
    const input = {
      workspaceId: "workspace-api-check",
      timezone: "UTC",
      id: "task-1",
      expectedVersion: 1,
      patch: { recurrenceRule: { frequency: "weekly", interval: 2 }, recurrenceAnchor: "scheduled" as const, recurrenceUntilLocalDate: "2026-12-31" },
    };

    await expect(caller.planner.task.update(input)).resolves.toMatchObject({ id: "task-1", version: 2, recurrenceRule: { frequency: "weekly", interval: 2 } });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: input.workspaceId, timezone: input.timezone }), expect.objectContaining({ id: input.id, expectedVersion: input.expectedVersion, patch: input.patch }));
    update.mockRestore();
  });

  it("passes category edits and safe detachment deletion through the public router contract", async () => {
    const update = vi.spyOn(planning, "updateCategory").mockResolvedValue({ id: "category-1", name: "Deep work", color: "#285D52", version: 2 } as never);
    const remove = vi.spyOn(planning, "deleteCategory").mockResolvedValue({ id: "category-1", detachedRecords: true, deleted: true });
    const caller = appRouter.createCaller(createPublicContext());
    const scope = { workspaceId: "workspace-api-check", timezone: "UTC", id: "category-1", expectedVersion: 1 };

    await expect(caller.planner.category.update({ ...scope, patch: { name: "Deep work", color: "#285D52" } })).resolves.toMatchObject({ id: "category-1", version: 2 });
    await expect(caller.planner.category.delete(scope)).resolves.toEqual({ id: "category-1", detachedRecords: true, deleted: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: scope.workspaceId }), expect.objectContaining({ id: scope.id, expectedVersion: scope.expectedVersion, patch: { name: "Deep work", color: "#285D52" } }));
    expect(remove).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: scope.workspaceId }), expect.objectContaining({ id: scope.id, expectedVersion: scope.expectedVersion }));
    update.mockRestore();
    remove.mockRestore();
  });

  it("routes goal, project, and habit archival through their version-safe service contracts", async () => {
    const goal = vi.spyOn(planning, "archiveGoal").mockResolvedValue({ id: "goal-1", state: "archived", version: 2 } as never);
    const project = vi.spyOn(planning, "archiveProject").mockResolvedValue({ id: "project-1", state: "archived", version: 2 } as never);
    const habit = vi.spyOn(planning, "archiveHabit").mockResolvedValue({ id: "habit-1", archivedAt: new Date(), version: 2 } as never);
    const caller = appRouter.createCaller(createPublicContext());
    const scope = { workspaceId: "workspace-api-check", timezone: "UTC", expectedVersion: 1 };

    await expect(caller.planner.goal.archive({ ...scope, id: "goal-1" })).resolves.toMatchObject({ state: "archived" });
    await expect(caller.planner.project.archive({ ...scope, id: "project-1" })).resolves.toMatchObject({ state: "archived" });
    await expect(caller.planner.habit.archive({ ...scope, id: "habit-1" })).resolves.toMatchObject({ id: "habit-1", version: 2 });
    expect(goal).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: scope.workspaceId }), expect.objectContaining({ id: "goal-1", expectedVersion: 1 }));
    expect(project).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: scope.workspaceId }), expect.objectContaining({ id: "project-1", expectedVersion: 1 }));
    expect(habit).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: scope.workspaceId }), expect.objectContaining({ id: "habit-1", expectedVersion: 1 }));
    goal.mockRestore();
    project.mockRestore();
    habit.mockRestore();
  });

  it("passes a dated monthly milestone through the public router contract", async () => {
    const create = vi.spyOn(planning, "createGoalMilestone").mockResolvedValue({ id: "milestone-1", goalId: "goal-1", version: 1 } as never);
    const caller = appRouter.createCaller(createPublicContext());
    const input = { workspaceId: "workspace-api-check", timezone: "UTC", goalId: "goal-1", title: "August evidence", horizon: "monthly" as const, progressValue: 20, targetValue: 100, dueLocalDate: "2026-08-31", cue: "If it is Friday", response: "Then review the evidence" };

    await expect(caller.planner.milestone.create(input)).resolves.toMatchObject({ id: "milestone-1", goalId: "goal-1" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: input.workspaceId, timezone: input.timezone }), expect.objectContaining({ goalId: input.goalId, title: input.title, horizon: "monthly", dueLocalDate: input.dueLocalDate, cue: input.cue, response: input.response }));
    create.mockRestore();
  });

  it("routes a browser subscription and device opt-out only through the workspace-scoped notification contract", async () => {
    const enable = vi.spyOn(planning, "upsertPushSubscription").mockResolvedValue({ id: "device-1", status: "active" } as never);
    const disable = vi.spyOn(planning, "disablePushSubscription").mockResolvedValue({ id: "device-1", status: "disabled" } as never);
    const caller = appRouter.createCaller(createPublicContext());
    const scope = { workspaceId: "workspace-api-check", timezone: "UTC" };
    const subscription = { endpoint: "https://push.example.test/subscription/abc", keys: { p256dh: "public-key", auth: "auth-key" }, deviceLabel: "iPhone home screen", userAgent: "Mozilla/5.0" };

    await expect(caller.planner.notification.enableDevice({ ...scope, subscription })).resolves.toMatchObject({ id: "device-1", status: "active" });
    await expect(caller.planner.notification.disableDevice({ ...scope, id: "device-1" })).resolves.toMatchObject({ status: "disabled" });
    expect(enable).toHaveBeenCalledWith(expect.objectContaining(scope), subscription);
    expect(disable).toHaveBeenCalledWith(expect.objectContaining(scope), expect.objectContaining({ id: "device-1" }));
    enable.mockRestore();
    disable.mockRestore();
  });

  it("resolves the current device by its exact browser endpoint rather than a list position", async () => {
    const current = vi.spyOn(planning, "getPushDeviceForEndpoint").mockResolvedValue({ id: "device-current", status: "active", deviceLabel: "This device" } as never);
    const caller = appRouter.createCaller(createPublicContext());
    const input = { workspaceId: "workspace-api-check", timezone: "UTC", endpoint: "https://push.example.test/subscription/current" };

    await expect(caller.planner.notification.currentDevice(input)).resolves.toMatchObject({ id: "device-current", status: "active" });
    expect(current).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: input.workspaceId, timezone: input.timezone }), expect.objectContaining({ endpoint: input.endpoint }));
    current.mockRestore();
  });

  it("rejects an unsafe test-notification origin before a push can be sent", async () => {
    const caller = appRouter.createCaller(createPublicContext());
    await expect(caller.planner.notification.testDevice({ workspaceId: "workspace-api-check", timezone: "UTC", subscriptionId: "device-1", origin: "http://example.test" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("activates the approved Auckland cadence without requiring an anonymous browser session to provision per-user cron jobs", async () => {
    const prepare = vi.spyOn(planning, "prepareReminderRule")
      .mockResolvedValueOnce({ id: "daily-rule", scheduleCronTaskUid: null } as never)
      .mockResolvedValueOnce({ id: "weekly-rule", scheduleCronTaskUid: null } as never);
    const activate = vi.spyOn(planning, "setReminderRuleActivation").mockResolvedValue({ id: "rule", isEnabled: 1 } as never);
    const list = vi.spyOn(planning, "getReminderRules").mockResolvedValue([] as never);
    const caller = appRouter.createCaller(createPublicContext());
    const scope = { workspaceId: "workspace-api-check", timezone: "Pacific/Auckland" };

    await expect(caller.planner.reminder.activateApproved(scope)).resolves.toEqual([]);
    expect(prepare).toHaveBeenNthCalledWith(1, scope, expect.objectContaining({ type: "daily_plan", timezone: "Pacific/Auckland", schedule: { kind: "daily", timeLocal: "11:00" } }));
    expect(prepare).toHaveBeenNthCalledWith(2, scope, expect.objectContaining({ type: "weekly_review", timezone: "Pacific/Auckland", schedule: { kind: "weekly", weekday: 0, timeLocal: "17:00" } }));
    expect(activate).toHaveBeenNthCalledWith(1, scope, { id: "daily-rule", enabled: true });
    expect(activate).toHaveBeenNthCalledWith(2, scope, { id: "weekly-rule", enabled: true });
    prepare.mockRestore(); activate.mockRestore(); list.mockRestore();
  });
});
