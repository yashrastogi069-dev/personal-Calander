import type { CanonicalTask } from "@shared/canonicalTask";
import type { TaskDropContext } from "@shared/taskDrop";
import { describe, expect, it } from "vitest";
import { swipeCompleteRefusal, swipeReschedule } from "./taskSwipeModel";
import { taskCheckDispatch } from "./TaskWorkspace";

const today = "2026-10-14";

function task(overrides: Partial<CanonicalTask> = {}): CanonicalTask {
  return { id: "t1", title: "Tailor CV", state: "not_started", horizon: "weekly", dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, recurrenceRule: null, sortOrder: 0, ...overrides } as unknown as CanonicalTask;
}

function ctx(overrides: Partial<TaskDropContext> = {}): TaskDropContext {
  return { today, timezone: "Pacific/Auckland", sort: "manual", occurrences: [], dependencies: [], tasks: [], committedTasks: new Map(), ...overrides };
}

describe("G1 swipe right: complete", () => {
  it("commits a plain completion and a recurring occurrence resolve (never a task update for the series)", () => {
    expect(swipeCompleteRefusal({ pending: false, state: "not_started", dispatch: "complete" })).toBeNull();
    expect(swipeCompleteRefusal({ pending: false, state: "not_started", dispatch: "resolve_occurrence" })).toBeNull();
    // The dispatch kind comes from the card model, the same as the check button.
    const recurring = taskCheckDispatch({ check: { checked: false, action: { kind: "resolve_occurrence", occurrenceId: "o1", expectedVersion: 3 } }, completionBlock: null } as never);
    expect(recurring).toEqual({ kind: "resolve_occurrence", occurrence: { id: "o1", expectedVersion: 3 } });
  });

  it("refuses with the reason: saving, archived, guarded, already done", () => {
    expect(swipeCompleteRefusal({ pending: true, state: "not_started", dispatch: "complete" })).toBe("The last change is still saving.");
    expect(swipeCompleteRefusal({ pending: false, state: "archived", dispatch: "complete" })).toBe("Archived. Restore it first.");
    expect(swipeCompleteRefusal({ pending: false, state: "not_started", dispatch: "refuse", refuseReason: "Finish Draft first." })).toBe("Finish Draft first.");
    expect(swipeCompleteRefusal({ pending: false, state: "completed", dispatch: "reopen" })).toMatch(/Already done/);
    expect(swipeCompleteRefusal({ pending: false, state: "not_started", dispatch: "none" })).toBeTruthy();
  });
});

describe("G2/G3 swipe left: tomorrow", () => {
  it("plans an unplanned task for tomorrow with an Undo patch back to no day", () => {
    expect(swipeReschedule(task(), ctx())).toEqual({ ok: true, patch: { scheduledLocalDate: "2026-10-15" }, undo: { scheduledLocalDate: null }, late: false, message: "Planned for tomorrow." });
  });

  it("keeps the old day for Undo", () => {
    const result = swipeReschedule(task({ scheduledLocalDate: "2026-10-12" }), ctx());
    expect(result).toMatchObject({ ok: true, undo: { scheduledLocalDate: "2026-10-12" } });
  });

  it("plans past the deadline anyway and says so", () => {
    const result = swipeReschedule(task({ dueLocalDate: "2026-10-14" }), ctx());
    expect(result).toMatchObject({ ok: true, late: true, patch: { scheduledLocalDate: "2026-10-15" } });
  });

  it("refuses a recurring series with the board's reason and writes nothing", () => {
    const result = swipeReschedule(task({ recurrenceRule: { frequency: "daily" } as never }), ctx());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
  });

  it("says when it is already planned for tomorrow", () => {
    expect(swipeReschedule(task({ scheduledLocalDate: "2026-10-15" }), ctx())).toEqual({ ok: false, reason: "Already planned for tomorrow." });
  });
});
