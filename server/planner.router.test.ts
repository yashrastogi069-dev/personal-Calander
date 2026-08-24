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
});
