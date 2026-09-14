import { describe, expect, it } from "vitest";
import {
  createPrototypeState,
  phase4PrototypeFixture,
  phase4PrototypeVariants,
  reducePrototypeState,
  type PrototypeAction,
  type PrototypeState,
} from "@shared/phase4Prototype";

describe("Phase 4 prototype parity", () => {
  it("uses identical mixed-life records in all three variants", () => {
    expect(phase4PrototypeVariants.map(item => item.id)).toEqual(["a", "b", "c"]);
    expect(phase4PrototypeFixture.tasks.map(task => task.id)).toEqual([
      "reply-samira",
      "read-lease",
      "buy-groceries",
      "prepare-dinner",
      "goal-next-action",
    ]);
    expect(phase4PrototypeFixture.appointments).toHaveLength(2);
    expect(phase4PrototypeFixture.directions[0].progressValue).toBeUndefined();
  });

  it("represents the required recovery, planning, sync, and stress scenarios", () => {
    expect(phase4PrototypeFixture.interruptedAfternoon).toMatchObject({
      overrunAppointmentId: "appointment-dentist",
      pinnedCommitmentId: "commitment-reply",
      displacedTaskIds: ["read-lease"],
    });
    expect(phase4PrototypeFixture.capacity).toMatchObject({ level: "low", unknownEffortTaskId: "read-lease" });
    expect(phase4PrototypeFixture.tenDayReturn.generatedHabitChoreCount).toBe(0);
    expect(phase4PrototypeFixture.waitingFor).toMatchObject({ taskId: "reply-samira", status: "waiting" });
    expect(phase4PrototypeFixture.goals.find(goal => goal.id === "goal-home")?.nextActionTaskId).toBeNull();
    expect(phase4PrototypeFixture.roadmap.dependencies).toContainEqual({
      fromProjectId: "project-quarterly",
      toProjectId: "project-home",
    });
    expect(phase4PrototypeFixture.recurrence).toMatchObject({
      scheduled: { skipScope: "occurrence" },
      completionAnchored: { pauseScope: "series" },
    });
    expect(phase4PrototypeFixture.offline).toMatchObject({ taskWrite: "supported", goalWrite: "unsupported", habitWrite: "unsupported" });
    expect(phase4PrototypeFixture.stress.longTitle.length).toBeGreaterThan(100);
    expect(phase4PrototypeFixture.archived.linkStatus).toBe("unresolved");
    expect(phase4PrototypeFixture.conflict.status).toBe("review-required");
  });

  it("creates a fresh, deeply frozen initial state", () => {
    const first = createPrototypeState();
    const second = createPrototypeState();

    expect(first).not.toBe(second);
    expect(first).toEqual({
      view: "today",
      completedTaskIds: [],
      recoveryCommitmentId: null,
      sheet: null,
      roadmapPreview: null,
      selectedTaskId: null,
    });
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.completedTaskIds)).toBe(true);
  });

  it("completes and reopens a known task without mutating prior states", () => {
    const initial = createPrototypeState();
    const completed = reducePrototypeState(initial, { type: "complete-task", taskId: "read-lease" });
    const unchanged = reducePrototypeState(completed, { type: "complete-task", taskId: "read-lease" });
    const reopened = reducePrototypeState(completed, { type: "reopen-task", taskId: "read-lease" });

    expect(completed.completedTaskIds).toEqual(["read-lease"]);
    expect(initial.completedTaskIds).toEqual([]);
    expect(unchanged).toBe(completed);
    expect(reopened.completedTaskIds).toEqual([]);
    expect(completed.completedTaskIds).toEqual(["read-lease"]);
  });

  it("moves between views and opens and closes sheets", () => {
    const initial = createPrototypeState();
    const tasks = reducePrototypeState(initial, { type: "set-view", view: "tasks" });
    const capture = reducePrototypeState(tasks, { type: "open-sheet", sheet: "capture" });
    const closed = reducePrototypeState(capture, { type: "close-sheet" });

    expect(tasks.view).toBe("tasks");
    expect(capture.sheet).toBe("capture");
    expect(closed.sheet).toBeNull();
    expect(initial).toEqual(createPrototypeState());
  });

  it("does not freeze nested references owned by a mutable caller", () => {
    const completedTaskIds = ["read-lease"];
    const unchangedFields = ["goal.dueLocalDate"];
    const roadmapPreview = {
      projectId: "project-quarterly",
      startLocalDate: "2026-10-01",
      dueLocalDate: "2026-12-15",
      unchangedFields,
    };
    const mutableState: PrototypeState = {
      view: "today",
      completedTaskIds,
      recoveryCommitmentId: "commitment-reply",
      sheet: "task",
      roadmapPreview,
    };

    const next = reducePrototypeState(mutableState, { type: "set-view", view: "tasks" });

    expect(next).toEqual({ ...mutableState, view: "tasks" });
    expect(next.completedTaskIds).not.toBe(completedTaskIds);
    expect(next.roadmapPreview).not.toBe(roadmapPreview);
    expect(next.roadmapPreview?.unchangedFields).not.toBe(unchangedFields);
    expect(Object.isFrozen(next.completedTaskIds)).toBe(true);
    expect(Object.isFrozen(next.roadmapPreview)).toBe(true);
    expect(Object.isFrozen(next.roadmapPreview?.unchangedFields)).toBe(true);
    expect(Object.isFrozen(completedTaskIds)).toBe(false);
    expect(Object.isFrozen(roadmapPreview)).toBe(false);
    expect(Object.isFrozen(unchangedFields)).toBe(false);
    expect(mutableState).toEqual({
      view: "today",
      completedTaskIds: ["read-lease"],
      recoveryCommitmentId: "commitment-reply",
      sheet: "task",
      roadmapPreview: {
        projectId: "project-quarterly",
        startLocalDate: "2026-10-01",
        dueLocalDate: "2026-12-15",
        unchangedFields: ["goal.dueLocalDate"],
      },
    });
  });

  it("previews recovery and roadmap changes without mutating fixture records", () => {
    const initial = createPrototypeState();
    const recovering = reducePrototypeState(initial, { type: "open-recovery", commitmentId: "commitment-reply" });
    const preview = reducePrototypeState(recovering, {
      type: "preview-roadmap-move",
      projectId: "project-quarterly",
      startLocalDate: "2026-10-01",
      dueLocalDate: "2026-12-15",
    });

    expect(recovering.recoveryCommitmentId).toBe("commitment-reply");
    expect(preview.roadmapPreview).toEqual({
      projectId: "project-quarterly",
      startLocalDate: "2026-10-01",
      dueLocalDate: "2026-12-15",
      unchangedFields: ["goal.dueLocalDate"],
    });
    expect(Object.isFrozen(preview.roadmapPreview)).toBe(true);
    expect(Object.isFrozen(preview.roadmapPreview?.unchangedFields)).toBe(true);
    expect(initial.roadmapPreview).toBeNull();
    expect(phase4PrototypeFixture.projects.find(project => project.id === "project-quarterly")?.dueLocalDate).toBe("2026-11-30");
  });

  it("cancels a roadmap preview without changing other interaction state", () => {
    const recovering = reducePrototypeState(createPrototypeState(), {
      type: "open-recovery",
      commitmentId: "commitment-reply",
    });
    const preview = reducePrototypeState(recovering, {
      type: "preview-roadmap-move",
      projectId: "project-quarterly",
      startLocalDate: "2026-10-01",
      dueLocalDate: "2026-12-15",
    });
    const cancelled = reducePrototypeState(preview, { type: "cancel-roadmap-preview" });

    expect(cancelled.roadmapPreview).toBeNull();
    expect(cancelled.recoveryCommitmentId).toBe("commitment-reply");
  });

  it("returns the same state for unknown fixture IDs", () => {
    const initial = createPrototypeState();

    expect(reducePrototypeState(initial, { type: "complete-task", taskId: "missing" })).toBe(initial);
    expect(reducePrototypeState(initial, { type: "reopen-task", taskId: "missing" })).toBe(initial);
    expect(reducePrototypeState(initial, { type: "open-recovery", commitmentId: "missing" })).toBe(initial);
    expect(
      reducePrototypeState(initial, {
        type: "preview-roadmap-move",
        projectId: "missing",
        startLocalDate: "2026-10-01",
        dueLocalDate: "2026-12-15",
      }),
    ).toBe(initial);
  });

  it("opens the clicked fixture task and clears its identity when detail closes", () => {
    const initial = createPrototypeState();
    const opened = reducePrototypeState(initial, {
      type: "open-task-detail",
      taskId: "buy-groceries",
    } as PrototypeAction);

    expect(opened).toMatchObject({ sheet: "task", selectedTaskId: "buy-groceries" });
    expect(reducePrototypeState(opened, { type: "close-sheet" })).toMatchObject({
      sheet: null,
      selectedTaskId: null,
    });
    expect(
      reducePrototypeState(initial, {
        type: "open-task-detail",
        taskId: "missing",
      } as PrototypeAction),
    ).toBe(initial);
  });

  it("deeply freezes fixture data", () => {
    expect(Object.isFrozen(phase4PrototypeFixture)).toBe(true);
    expect(Object.isFrozen(phase4PrototypeFixture.tasks)).toBe(true);
    expect(Object.isFrozen(phase4PrototypeFixture.tasks[0])).toBe(true);
    expect(Object.isFrozen(phase4PrototypeFixture.roadmap.dependencies)).toBe(true);
    expect(Object.isFrozen(phase4PrototypeFixture.roadmap.dependencies[0])).toBe(true);
  });
});
