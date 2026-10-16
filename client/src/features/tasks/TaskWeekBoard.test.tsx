import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CanonicalTask } from "@shared/canonicalTask";
import { rowPills } from "@shared/taskRowPills";
import { createTaskCardContext, taskCardModel } from "./taskCardModel";
import {
  boardMenuActions,
  boardUndoPatch,
  boardWriteMessage,
  buildBoardColumns,
  LatePrompt,
  planMenuDays,
  statusColumnZone,
  TaskWeekBoard,
  weekRangeLabel,
  type BoardLens,
  type TaskWeekBoardProps,
} from "./TaskWeekBoard";
import { TaskDndEngine } from "./useTaskDnd";

// 2026-10-14 is a Wednesday; the week runs Mon 12 … Sun 18.
const today = "2026-10-14";
const timezone = "Pacific/Auckland";

function task(overrides: Partial<CanonicalTask>): CanonicalTask {
  return {
    id: "t1", workspaceId: "w1", title: "Task", state: "not_started", priority: "medium", horizon: "weekly",
    dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, estimateMinutes: null, sortOrder: 0,
    categoryId: null, projectId: "p1", goalId: null, parentTaskId: null, recurrenceRule: null, completedAt: null, version: 1,
    ...overrides,
  };
}

const planned = task({ id: "planned", title: "Draft the case study", scheduledLocalDate: "2026-10-16", estimateMinutes: 90 });
const deadlineOnly = task({ id: "due", title: "RSVP to drinks", dueLocalDate: "2026-10-17", estimateMinutes: 5 });
const doing = task({ id: "doing", title: "Review budget", state: "in_progress", scheduledLocalDate: today, estimateMinutes: 45 });
const waiting = task({ id: "waiting", title: "Send the form", state: "blocked", scheduledLocalDate: today });
const doneToday = task({ id: "done", title: "Email the landlord", state: "completed", scheduledLocalDate: today, completedAt: "2026-10-13T22:00:00.000Z" });
const later = task({ id: "later", title: "Plan the trip", scheduledLocalDate: "2026-11-20" });
const inbox = task({ id: "inbox", title: "Idea", projectId: null, horizon: "weekly" });
const all = [planned, deadlineOnly, doing, waiting, doneToday, later, inbox];

const cardCtx = createTaskCardContext({ today, timezone, tasks: all, categories: [], projects: [{ id: "p1", title: "Portfolio" }], goals: [] });
const projects = new Map([["p1", { id: "p1", name: "Portfolio" }]]);
const view = (lens: BoardLens) => (item: CanonicalTask) => ({
  task: item,
  model: taskCardModel(item, cardCtx),
  pills: rowPills(item, today, { timezone, variant: "board", boardLens: lens, projects }),
});

function props(overrides: Partial<TaskWeekBoardProps> = {}): TaskWeekBoardProps {
  return {
    lens: "week", onLensChange: () => undefined, tasks: all, allTasks: all, today, timezone,
    dropContext: { sort: "manual" },
    modelFor: item => taskCardModel(item, cardCtx),
    pillsFor: (item, lens) => rowPills(item, today, { timezone, variant: "board", boardLens: lens, projects }),
    onUpdate: async () => ({ record: {}, queued: false }) as never,
    onOpen: () => undefined, onToggle: () => undefined, onBlockedCheck: () => undefined,
    ...overrides,
  };
}

describe("Week board columns", () => {
  const columns = buildBoardColumns(all, { lens: "week", today, timezone, weekStart: "2026-10-12", weekStartsOn: 1, view: view("week") });

  it("is Unscheduled then Mon…Sun, with today and past days flagged", () => {
    expect(columns.map(column => column.zone)).toEqual(["day:none", "day:2026-10-12", "day:2026-10-13", "day:2026-10-14", "day:2026-10-15", "day:2026-10-16", "day:2026-10-17", "day:2026-10-18"]);
    expect(columns.find(column => column.isToday)?.zone).toBe("day:2026-10-14");
    expect(columns.filter(column => column.isPast).map(column => column.zone)).toEqual(["day:2026-10-12", "day:2026-10-13"]);
  });

  it("counts open cards and their estimate per column; done-today cards are shown but not counted", () => {
    const fri = columns.find(column => column.zone === "day:2026-10-16")!;
    expect(fri.cards.map(card => card.task.id)).toEqual(["planned"]);
    expect([fri.count, fri.estimateMinutes]).toEqual([1, 90]);
    const wed = columns.find(column => column.isToday)!;
    expect(wed.cards.map(card => card.task.id)).toEqual(["doing", "waiting", "done"]);
    expect(wed.count).toBe(2);
  });

  it("keeps Inbox work and later weeks off, and puts deadline-only work in Unscheduled", () => {
    const ids = columns.flatMap(column => column.cards.map(card => card.task.id));
    expect(ids).not.toContain("inbox");
    expect(ids).not.toContain("later");
    expect(columns[0].cards.map(card => card.task.id)).toEqual(["due"]);
  });

  it("shows only what the column doesn't: no Plan pill, and Due Sat without 'not planned'", () => {
    const fri = columns.find(column => column.zone === "day:2026-10-16")!;
    expect(fri.cards[0].pills.some(pill => pill.kind === "urgency")).toBe(false);
    const due = columns[0].cards[0].pills.find(pill => pill.kind === "urgency");
    expect(due && due.label).toBe("Due Sat");
  });

  it("holds a card waiting on the late-drop prompt in the day it was dropped on", () => {
    const moved = buildBoardColumns(all, {
      lens: "week", today, timezone, weekStart: "2026-10-12", weekStartsOn: 1, view: view("week"),
      optimisticZone: new Map([["due", "day:2026-10-18"]]),
    });
    expect(moved[0].cards).toHaveLength(0);
    expect(moved[0].count).toBe(0);
    const sun = moved.find(column => column.zone === "day:2026-10-18")!;
    expect(sun.cards.map(card => card.task.id)).toEqual(["due"]);
    expect([sun.count, sun.estimateMinutes]).toEqual([1, 5]);
  });

  it("labels the shown week", () => {
    expect(weekRangeLabel("2026-10-12", 0)).toBe("This week");
    expect(weekRangeLabel("2026-10-19", 1)).toBe("19 Oct – 25 Oct");
  });
});

describe("Status lens", () => {
  const columns = buildBoardColumns(all, { lens: "status", today, timezone, weekStart: "2026-10-12", weekStartsOn: 1, view: view("status") });

  it("is To do · Doing · Done for this week only; waiting work stays in To do; Done is today's finished work", () => {
    expect(columns.map(column => column.label)).toEqual(["To do", "Doing", "Done"]);
    expect(columns[0].cards.map(card => card.task.id).sort()).toEqual(["due", "planned", "waiting"]);
    expect(columns[1].cards.map(card => card.task.id)).toEqual(["doing"]);
    expect(columns[2].cards.map(card => card.task.id)).toEqual(["done"]);
    expect(statusColumnZone("blocked")).toBe("lane:todo");
    expect(statusColumnZone("archived")).toBeNull();
  });

  it("keeps the amber Waiting chip on a waiting card", () => {
    const card = columns[0].cards.find(item => item.task.id === "waiting")!;
    expect(card.pills.some(pill => pill.kind === "waiting")).toBe(true);
  });
});

describe("Card ⋯ menu (keyboard and touch alternative to drag)", () => {
  it("offers Plan today / tomorrow / the next weekdays, then Unschedule, then Open details", () => {
    const moveTo = vi.fn();
    const actions = boardMenuActions({ task: planned, column: { zone: "day:2026-10-16", date: "2026-10-16" }, lens: "week", today, moveTo, onOpen: () => undefined });
    expect(actions.map(action => action.label)).toEqual(["Plan today", "Plan tomorrow", "Plan Sat 17", "Plan Sun 18", "Plan Mon 19", "Plan Tue 20", "Unschedule", "Open details"]);
    actions[0].onSelect();
    actions.find(action => action.id === "unschedule")!.onSelect();
    expect(moveTo.mock.calls).toEqual([["planned", "day:2026-10-14"], ["planned", "day:none"]]);
  });

  it("never offers Unschedule from Unscheduled, plan days for a repeating task, or a Move to lane menu on the Week lens", () => {
    const fromNone = boardMenuActions({ task: deadlineOnly, column: { zone: "day:none", date: null }, lens: "week", today, moveTo: () => undefined, onOpen: () => undefined });
    expect(fromNone.map(action => action.id)).not.toContain("unschedule");
    expect(fromNone.some(action => action.label.startsWith("Move to"))).toBe(false);
    const repeating = boardMenuActions({ task: task({ id: "r", recurrenceRule: { frequency: "daily", interval: 1 } }), column: { zone: "day:2026-10-14", date: today }, lens: "week", today, moveTo: () => undefined, onOpen: () => undefined });
    expect(repeating[0]).toMatchObject({ disabled: true, reason: "It repeats, so its schedule sets the day." });
  });

  it("offers Move to the other columns on the Status lens", () => {
    const actions = boardMenuActions({ task: doing, column: { zone: "lane:in_progress", date: null }, lens: "status", today, moveTo: () => undefined, onOpen: () => undefined });
    expect(actions.map(action => action.label)).toEqual(["Move to To do", "Move to Done", "Open details"]);
  });

  it("lists seven days from today, never a past one", () => {
    expect(planMenuDays(today).map(day => day.date)).toEqual(["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"]);
  });
});

describe("Writes, Undo and the late-drop prompt", () => {
  it("says what changed and undoes exactly that", () => {
    expect(boardWriteMessage({ scheduledLocalDate: "2026-10-16" })).toBe("Planned for Fri 16");
    expect(boardWriteMessage({ scheduledLocalDate: "2026-10-18", dueLocalDate: "2026-10-18" })).toBe("Planned for Sun 18 · deadline moved");
    expect(boardWriteMessage({ scheduledLocalDate: null })).toBe("Moved to Unscheduled");
    expect(boardWriteMessage({ state: "in_progress" })).toBe("Moved to Doing");
    expect(boardWriteMessage({ sortOrder: 3 })).toBeNull();
    expect(boardUndoPatch(deadlineOnly, { scheduledLocalDate: "2026-10-18", dueLocalDate: "2026-10-18" })).toEqual({ scheduledLocalDate: null, dueLocalDate: "2026-10-17" });
    expect(boardUndoPatch(waiting, { state: "in_progress" })).toEqual({ state: "blocked" });
  });

  it("asks once on a drop past the deadline: Plan anyway, Move deadline or Cancel", async () => {
    const onUpdate = vi.fn(async () => ({ queued: false }));
    const engine = new TaskDndEngine({ lens: "week", tasks: all, lanes: [], ctx: { today, timezone, sort: "manual" }, onUpdate });
    engine.moveTo("due", "day:2026-10-18");
    const request = engine.getSnapshot().lateDrop!;
    expect(request.prompt).toBe("Sun is after the Sat deadline");
    expect(onUpdate).not.toHaveBeenCalled();

    const html = renderToStaticMarkup(<LatePrompt request={request} />);
    expect(html).toContain("Sun is after the Sat deadline");
    for (const label of ["Plan anyway", "Move deadline", "Cancel"]) expect(html).toContain(label);

    request.moveDeadline();
    await engine.idle();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(deadlineOnly, { scheduledLocalDate: "2026-10-18", dueLocalDate: "2026-10-18" });
    expect(engine.getSnapshot().lateDrop).toBeNull();

    engine.moveTo("due", "day:2026-10-18");
    engine.getSnapshot().lateDrop!.cancel();
    await engine.idle();
    expect(onUpdate).toHaveBeenCalledTimes(1);

    engine.moveTo("due", "day:2026-10-18");
    engine.getSnapshot().lateDrop!.planAnyway();
    await engine.idle();
    expect(onUpdate).toHaveBeenLastCalledWith(deadlineOnly, { scheduledLocalDate: "2026-10-18" });
  });
});

describe("TaskWeekBoard render", () => {
  it("draws the lens switch, week pager, column facts and cards with a drag grip and a plan menu", () => {
    const html = renderToStaticMarkup(<TaskWeekBoard {...props()} />);
    expect(html).toContain('aria-label="Board lens"');
    expect(html).toContain("This week");
    expect(html).toContain('aria-label="Previous week"');
    expect(html).toContain('aria-label="Next week"');
    expect(html).toContain("Unscheduled");
    expect(html).toContain("1h 30m");
    expect(html).toContain('aria-label="Drag Draft the case study"');
    expect(html).toContain('aria-label="Plan Draft the case study for a day"');
    expect(html).not.toContain("Plan Fri");
  });

  it("draws the Status lens columns", () => {
    const html = renderToStaticMarkup(<TaskWeekBoard {...props({ lens: "status" })} />);
    expect(html).toContain('data-zone="lane:todo"');
    expect(html).toContain('data-zone="lane:in_progress"');
    expect(html).toContain('data-zone="lane:done"');
    expect(html).not.toContain('aria-label="Previous week"');
    expect(html).toContain('aria-label="Move Review budget"');
  });
});
