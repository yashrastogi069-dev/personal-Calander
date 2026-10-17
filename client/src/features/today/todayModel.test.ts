import { describe, expect, it } from "vitest";
import {
  applyMoveAll, buildTodayItems, capacityTime, carryCount, completeTodayItem, decisionAllowed, freeSlots, habitChipAction,
  habitChipRow, habitChipState, meetingJoinUrl, nextUp, pickTray, shutdownState, shutdownWrite, STRICT_CARRY_MIN, todayCapacity,
  type ShutdownItem, type TodayFacts, type TodayItem,
} from "./todayModel";

const localDate = "2026-10-14";
const timezone = "Pacific/Auckland";

function facts(overrides: Partial<TodayFacts> = {}): TodayFacts {
  return {
    localDate, timezone,
    tasks: [
      { id: "t-plain", title: "Plain", state: "not_started", version: 3 },
      { id: "t-plan", title: "Planned", state: "not_started", version: 4 },
      { id: "t-repeat", title: "Repeat", state: "not_started", version: 2, recurrenceRule: { freq: "daily" } },
      { id: "t-carry", title: "Carried", state: "not_started", version: 6 },
      { id: "t-blocked", title: "Blocked", state: "blocked", version: 1 },
    ],
    plans: [{ id: "p-today", localDate, state: "active", version: 2 }, { id: "p-mon", localDate: "2026-10-12", state: "closed", version: 5 }],
    items: [
      { id: "i-plan", dailyPlanId: "p-today", taskId: "t-plan", state: "committed", version: 7 },
      { id: "i-root", dailyPlanId: "p-mon", taskId: "t-carry", state: "rescheduled", version: 3 },
    ],
    occurrences: [{ id: "o-repeat", taskId: "t-repeat", localDate, state: "pending", version: 9 }],
    carries: [{ id: "c-1", taskId: "t-carry", rootDailyPlanItemId: "i-root", targetLocalDate: localDate, scope: "Carried", state: "open", version: 1 }],
    ...overrides,
  };
}

const item = (patch: Partial<TodayItem> & Pick<TodayItem, "taskId" | "source">): TodayItem => ({
  key: patch.taskId, title: patch.taskId, projectionSource: "planned_no_time", startsAt: null, endsAt: null, estimateMinutes: null, categoryId: null, ...patch,
});

describe("completeTodayItem dispatch (one check per row, one write per tick)", () => {
  it("routes each source to its existing procedure", () => {
    const f = facts();
    expect(completeTodayItem(item({ taskId: "t-plain", source: "task" }), f, "op")).toEqual({ kind: "write", write: { procedure: "planner.task.update", taskId: "t-plain", patch: { state: "completed" } } });
    const occurrence = completeTodayItem(item({ taskId: "t-repeat", source: "occurrence", occurrenceId: "o-repeat" }), f, "op");
    expect(occurrence).toEqual({ kind: "write", write: { procedure: "planner.occurrence.resolve", input: { id: "o-repeat", expectedVersion: 9, state: "completed" } } });
    const commitment = completeTodayItem(item({ taskId: "t-plan", source: "daily_commitment", dailyPlanItemId: "i-plan" }), f, "op");
    expect(commitment.kind === "write" && commitment.write.procedure).toBe("planner.recovery.resolve");
    expect(commitment.kind === "write" && commitment.write.procedure === "planner.recovery.resolve" && commitment.write.decision).toMatchObject({ action: "done", dailyPlanItemId: "i-plan", taskExpectedVersion: 4, itemExpectedVersion: 7 });
    const carry = completeTodayItem(item({ key: "carry:c-1", taskId: "t-carry", source: "carried_commitment", carryId: "c-1" }), f, "op");
    expect(carry.kind === "write" && carry.write.procedure === "planner.recovery.resolve" && carry.write.decision).toMatchObject({ action: "done", sourceCarryId: "c-1", carryExpectedVersion: 1, dailyPlanItemId: "i-root" });
  });

  it("refuses blocked, offline, closed and occurrence-less recurring rows without a write", () => {
    const f = facts({ tasks: [...facts().tasks, { id: "offline:x", title: "Captured", state: "not_started", version: 1 }, { id: "t-done", title: "Done", state: "completed", version: 1 }] });
    for (const row of [item({ taskId: "t-blocked", source: "task" }), item({ taskId: "offline:x", source: "task" }), item({ taskId: "t-done", source: "task" }), item({ taskId: "t-repeat", source: "task" }), item({ taskId: "missing", source: "task" })])
      expect(completeTodayItem(row, f, "op").kind).toBe("refuse");
  });

  it("buildTodayItems prefers the open commitment and today's occurrence", () => {
    const rows = buildTodayItems({ timeline: [], flexible: [
      { kind: "task", recordId: "t-plan", title: "Planned", source: "daily_commitment" } as never,
      { kind: "task", recordId: "t-repeat", title: "Repeat", source: "occurrence" } as never,
      { kind: "task", recordId: "t-carry", title: "Carried", source: "carried_commitment", carryId: "c-1", rootDailyPlanItemId: "i-root" } as never,
      { kind: "task", recordId: "t-plain", title: "Plain", source: "planned_no_time" } as never,
    ] }, facts());
    expect(rows.map(row => [row.key, row.source])).toEqual([["t-plan", "daily_commitment"], ["t-repeat", "occurrence"], ["carry:c-1", "carried_commitment"], ["t-plain", "task"]]);
  });
});

describe("shutdown decision model", () => {
  const items: ShutdownItem[] = [
    { key: "a", taskId: "t-plain", title: "A", source: "task", carryCount: 0 },
    { key: "b", taskId: "t-plan", title: "B", source: "daily_commitment", carryCount: STRICT_CARRY_MIN, dailyPlanItemId: "i-plan" },
  ];
  it("keeps Close day disabled until every item has an allowed decision", () => {
    expect(shutdownState(items, {}).canClose).toBe(false);
    expect(shutdownState(items, { a: { kind: "tomorrow" } }).undecidedKeys).toEqual(["b"]);
    expect(shutdownState(items, { a: { kind: "tomorrow" }, b: { kind: "tomorrow" } }).canClose).toBe(false);
    expect(shutdownState(items, { a: { kind: "tomorrow" }, b: { kind: "pick", localDate: "" } }).canClose).toBe(false);
    expect(shutdownState(items, { a: { kind: "let_go" }, b: { kind: "pick", localDate: "2026-10-20" } }).canClose).toBe(true);
    expect(shutdownState([], {}).canClose).toBe(true);
  });
  it("Move all skips items carried 3+ times", () => {
    expect(decisionAllowed(items[1], { kind: "tomorrow" })).toBe(false);
    const moved = applyMoveAll(items, {});
    expect(moved).toEqual({ a: { kind: "tomorrow" } });
    expect(shutdownState(items, moved).canClose).toBe(false);
  });
  it("counts carries from rescheduleCount, earlier moved plan items and extra carries", () => {
    const f = facts({ tasks: facts().tasks.map(task => task.id === "t-carry" ? { ...task, rescheduleCount: 1 } : task) });
    expect(carryCount("t-carry", f)).toBe(2);
    expect(carryCount("t-plain", f)).toBe(0);
  });
  it("maps each decision to an existing write", () => {
    const f = facts();
    expect(shutdownWrite(items[0], { kind: "tomorrow" }, f, "2026-10-15", "op")).toMatchObject({ write: { procedure: "planner.task.update", patch: { scheduledLocalDate: "2026-10-15" } } });
    expect(shutdownWrite(items[1], { kind: "let_go" }, f, "2026-10-15", "op")).toMatchObject({ write: { procedure: "planner.recovery.resolve", decision: { action: "abandon" } } });
    expect(shutdownWrite(items[1], { kind: "pick", localDate: "2026-10-20" }, f, "2026-10-15", "op")).toMatchObject({ write: { decision: { action: "reschedule", resolvedToLocalDate: "2026-10-20" } } });
    expect(shutdownWrite({ key: "o", taskId: "t-repeat", title: "R", source: "occurrence", carryCount: 0, occurrenceId: "o-repeat" }, { kind: "let_go" }, f, "2026-10-15", "op"))
      .toMatchObject({ write: { procedure: "planner.occurrence.resolve", input: { state: "skipped" } } });
  });
});

describe("capacity math", () => {
  it("subtracts break and merged, clipped meetings from the workday", () => {
    const capacity = todayCapacity({ workdayStartsAt: "08:30", workdayEndsAt: "17:30", breakMinutes: 30, meetings: [[600, 660], [630, 690], [1020, 1110]], plannedMinutes: 250 });
    expect(capacity.meetingMinutes).toBe(90 + 30);
    expect(capacity.freeMinutes).toBe(540 - 30 - 120);
    expect(capacity.label).toBe("planned 4h10 of 6h30 free");
    expect(capacity.state).toBe("ok");
  });
  it("flags tight and over, and handles an unavailable day", () => {
    expect(todayCapacity({ workdayStartsAt: "09:00", workdayEndsAt: "10:00", breakMinutes: 0, meetings: [], plannedMinutes: 55 }).state).toBe("tight");
    expect(todayCapacity({ workdayStartsAt: "09:00", workdayEndsAt: "10:00", breakMinutes: 0, meetings: [], plannedMinutes: 90 }).state).toBe("over");
    expect(todayCapacity({ workdayStartsAt: "09:00", workdayEndsAt: "17:00", breakMinutes: 30, meetings: [], plannedMinutes: 10, unavailable: true }).freeMinutes).toBe(0);
    expect([capacityTime(45), capacityTime(360), capacityTime(250)]).toEqual(["45m", "6h", "4h10"]);
  });
  it("offers free slots after now that avoid busy time", () => {
    const now = new Date("2026-10-13T21:00:00Z"); // 10:00 NZDT on the 14th
    const slots = freeSlots({ localDate, timezone, workdayStartsAt: "08:30", workdayEndsAt: "17:30", now, durationMinutes: 60,
      busy: [{ startsAt: "2026-10-13T21:00:00Z", endsAt: "2026-10-13T22:30:00Z" }] });
    expect(slots.map(slot => slot.startMinute)).toEqual([690, 750, 810]);
  });
});

describe("habit chips", () => {
  it("maps states and actions", () => {
    expect(habitChipState({ state: "completed" })).toBe("done");
    expect(habitChipState({ state: "weekly_opportunity" })).toBe("due");
    expect(habitChipAction("due", "tap")).toEqual({ kind: "check_in", state: "completed" });
    expect(habitChipAction("done", "tap")).toEqual({ kind: "clear" });
    expect(habitChipAction("due", "skip")).toEqual({ kind: "check_in", state: "skipped" });
    expect(habitChipAction("done", "skip")).toBeNull();
  });
  it("hides the row when nothing is due and counts done", () => {
    expect(habitChipRow([]).visible).toBe(false);
    const row = habitChipRow([{ recordId: "h1", title: "Run", state: "completed" }, { recordId: "h2", title: "Read", state: "due" }] as never);
    expect(row).toMatchObject({ visible: true, doneCount: 1, dueCount: 2, allSettled: false });
  });
});

describe("next-up hero and tray", () => {
  const now = new Date("2026-10-13T21:00:00Z");
  it("prefers a meeting inside the lead time, with a stored join link", () => {
    const event = { id: "e", title: "Standup", startsAt: "2026-10-13T21:12:00Z", endsAt: "2026-10-13T21:30:00Z", payload: { hangoutLink: "https://meet.google.com/x" } };
    const next = nextUp({ now, items: [item({ taskId: "t-plain", source: "task" })], events: [event] });
    expect(next).toMatchObject({ kind: "meeting", minutesUntil: 12, joinUrl: "https://meet.google.com/x" });
    expect(meetingJoinUrl({ ...event, payload: { url: "http://insecure" } })).toBeNull();
    expect(nextUp({ now, items: [item({ taskId: "t-plain", source: "task" })], events: [] })).toMatchObject({ kind: "task" });
  });
  it("groups the pick tray and leaves out recurring, blocked and listed tasks", () => {
    const groups = pickTray([
      { id: "a", title: "A", state: "not_started", version: 1, dueLocalDate: "2026-10-10" },
      { id: "b", title: "B", state: "not_started", version: 1, dueLocalDate: "2026-10-16" },
      { id: "c", title: "C", state: "not_started", version: 1, scheduledLocalDate: "2026-10-18" },
      { id: "d", title: "D", state: "blocked", version: 1, dueLocalDate: "2026-10-10" },
      { id: "e", title: "E", state: "not_started", version: 1, dueLocalDate: "2026-10-10", recurrenceRule: {} },
      { id: "f", title: "F", state: "not_started", version: 1, dueLocalDate: "2026-10-10" },
    ], { localDate, excludeTaskIds: new Set(["f"]) });
    expect(groups.map(group => [group.group, group.tasks.map(task => task.id)])).toEqual([["overdue", ["a"]], ["due_soon", ["b"]], ["this_week", ["c"]]]);
  });
});
