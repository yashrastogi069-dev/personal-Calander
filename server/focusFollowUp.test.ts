import { describe, expect, it } from "vitest";
import { buildFocusSessionTrail, buildHabitCompanion, buildMeetingHorizon, buildRoutineConductor } from "../shared/focusFollowUp";

describe("Focus follow-up projections", () => {
  it("orders the recent session trail and keeps unlinked sessions honest", () => {
    const trail = buildFocusSessionTrail([
      { id: "old", state: "completed", startedAt: "2026-10-01T08:00:00Z", endedAt: "2026-10-01T08:20:00Z", activeSeconds: 1200, taskId: "task-1" },
      { id: "new", state: "abandoned", startedAt: "2026-10-02T08:00:00Z", endedAt: "2026-10-02T08:45:00Z", activeSeconds: 2700, taskId: null },
      { id: "open", state: "active", startedAt: "2026-10-02T09:00:00Z", activeSeconds: 20 },
    ], [{ id: "task-1", title: "Read brief" }]);
    expect(trail.map(item => item.id)).toEqual(["new", "old"]);
    expect(trail[0].taskTitle).toBe("Unlinked focus");
    expect(trail[1].durationLabel).toBe("20m");
  });

  it("shows only active events in the next meeting horizon", () => {
    const meetings = buildMeetingHorizon([
      { id: "past", title: "Ended", startsAt: "2026-10-02T07:00:00Z", endsAt: "2026-10-02T07:30:00Z", status: "active" },
      { id: "now", title: "Stand-up", startsAt: "2026-10-02T11:50:00Z", endsAt: "2026-10-02T12:15:00Z", status: "active" },
      { id: "cancelled", title: "Cancelled", startsAt: "2026-10-02T12:20:00Z", endsAt: "2026-10-02T12:40:00Z", status: "cancelled" },
    ], new Date("2026-10-02T12:00:00Z"));
    expect(meetings.map(item => item.id)).toEqual(["now"]);
    expect(meetings[0].phase).toBe("in_progress");
  });

  it("distinguishes habit check-ins from untracked duration", () => {
    const habits = buildHabitCompanion([
      { id: "habit-1", name: "Stretch", frequency: "daily", schedule: {}, createdAt: "2026-09-01" },
    ], [], "2026-10-02");
    expect(habits.due).toBe(1);
    expect(habits.items[0].state).toBe("unrecorded");
    expect(habits.durationTracked).toBe(false);
  });

  it("prioritizes the current Focus session in the routine conductor", () => {
    const result = buildRoutineConductor({
      activeSession: { taskId: "task-1", state: "active" },
      tasks: [{ id: "task-1", title: "Draft plan", state: "in_progress" }],
      meetings: [],
      habits: { due: 0, completed: 0, skipped: 0, items: [], durationTracked: false },
    });
    expect(result.key).toBe("focus");
    expect(result.targetId).toBe("task-1");
    expect(result.title).toContain("Draft plan");
  });

  it("keeps a paused focus session as the next action", () => {
    const result = buildRoutineConductor({
      activeSession: { taskId: "task-2", state: "paused" },
      tasks: [{ id: "task-2", title: "Review notes", state: "in_progress" }],
      meetings: [],
      habits: { due: 0, completed: 0, skipped: 0, items: [], durationTracked: false },
    });
    expect(result.key).toBe("focus");
    expect(result.targetId).toBe("task-2");
    expect(result.title).toContain("Resume");
  });

  it("returns actionable targets for the next meeting, habit, and task", () => {
    const meetings = buildMeetingHorizon([
      { id: "meeting-1", title: "Planning", startsAt: "2026-10-02T12:30:00Z", endsAt: "2026-10-02T13:00:00Z" },
    ], new Date("2026-10-02T12:00:00Z"));
    const base = { activeSession: null, tasks: [{ id: "task-3", title: "Write brief", state: "queued" }], meetings: [], habits: { due: 0, completed: 0, skipped: 0, items: [], durationTracked: false } };
    expect(buildRoutineConductor({ ...base, meetings }).targetId).toBe("meeting-1");
    expect(buildRoutineConductor({ ...base, habits: { ...base.habits, due: 1, items: [{ id: "habit-2", name: "Walk", state: "unrecorded" }] } }).targetId).toBe("habit-2");
    expect(buildRoutineConductor(base).targetId).toBe("task-3");
  });
});
