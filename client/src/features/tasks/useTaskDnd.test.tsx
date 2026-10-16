import { tasksByStatusLane, taskStatusLanes } from "@shared/taskBoard";
import { groupTasksByWhen, taskWhenBuckets } from "@shared/taskBuckets";
import { weekBoardColumns } from "@shared/taskWeekBoard";
import type { TaskDropContext } from "@shared/taskDrop";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { TaskCardModel } from "./taskCardModel";
import type { TaskBoardLaneView } from "./taskDndTypes";
import {
  CONFLICT_REASON,
  TASK_DND_INSTRUCTIONS,
  TASK_POINTER_ACTIVATION,
  TASK_TOUCH_ACTIVATION,
  TaskDndEngine,
  TaskKeyboardSensor,
  TaskPointerSensor,
  TaskTouchSensor,
  WEEK_LENS_REORDER_REASON,
  WHEN_LENS_REORDER_REASON,
  canStartTaskDrag,
  dropTargetForZone,
  isTaskDropZoneId,
  zoneForTask,
  zoneLabel,
  createTaskCollisionDetection,
  createTaskKeyboardCoordinates,
  taskDndContextHandlers,
  taskReorderDisabledReason,
  useTaskDnd,
  type TaskDndOptions,
  type TaskDndTask,
  type UseTaskDndResult,
} from "./useTaskDnd";

// 2026-10-14 is a Wednesday; Auckland is UTC+13 in October.
const today = "2026-10-14";

type Task = TaskDndTask & { version: number };

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: `Task ${id.toUpperCase()}`,
    state: "not_started",
    horizon: "weekly",
    dueLocalDate: null,
    scheduledLocalDate: null,
    plannedStartAt: null,
    plannedEndAt: null,
    recurrenceRule: null,
    sortOrder: 0,
    version: 1,
    ...overrides,
  };
}

const model = (id: string) => ({ id }) as TaskCardModel;
const byManual = (left: Task, right: Task) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.id.localeCompare(right.id);

/** The four Status lanes as the Board renders them; `visible` mimics search/filters hiding cards. */
function statusLanes(tasks: readonly Task[], visible: (task: Task) => boolean = () => true): TaskBoardLaneView[] {
  const lanes = tasksByStatusLane([...tasks].sort(byManual));
  return taskStatusLanes.map(lane => {
    const shown = lanes[lane.id].filter(visible);
    return { zone: `lane:${lane.id}` as const, label: lane.label, count: lanes[lane.id].length, models: shown.map(item => model(item.id)), hiddenCount: 0, showAll: false };
  });
}

function whenLanes(tasks: readonly Task[]): TaskBoardLaneView[] {
  const groups = groupTasksByWhen(tasks, { today, timezone: "Pacific/Auckland", occurrences: [] });
  const inBucket = (id: string) => groups.find(group => group.bucket === id)?.tasks ?? [];
  return taskWhenBuckets.map(bucket => ({
    zone: `bucket:${bucket.id}` as const,
    label: bucket.label,
    count: inBucket(bucket.id).length,
    models: inBucket(bucket.id).map(item => model(item.id)),
    hiddenCount: 0,
    showAll: false,
  }));
}

/** The Week board (Q3) as the container renders it: Unscheduled · Mon 12 … Sun 18. */
function weekLanes(tasks: readonly Task[]): TaskBoardLaneView[] {
  return weekBoardColumns(tasks, { today, timezone: "Pacific/Auckland", weekStart: "2026-10-12" }).map(column => ({
    zone: `day:${column.id}` as const,
    label: column.label,
    count: column.count,
    models: column.tasks.map(item => model(item.id)),
    hiddenCount: 0,
    showAll: false,
  }));
}

function setup(input: {
  tasks: Task[];
  lanes?: TaskBoardLaneView[];
  lens?: "status" | "when" | "week";
  sort?: TaskDropContext["sort"];
  ctx?: Partial<TaskDropContext>;
  onUpdate?: TaskDndOptions<Task>["onUpdate"];
  onResolveOccurrence?: TaskDndOptions<Task>["onResolveOccurrence"];
}) {
  const lens = input.lens ?? "status";
  const onUpdate = vi.fn(input.onUpdate ?? (async (record: Task, patch: object) => ({ record: { ...record, ...patch }, queued: false })));
  const onResolveOccurrence = vi.fn(input.onResolveOccurrence ?? (async () => ({})));
  const onConflict = vi.fn();
  const options: TaskDndOptions<Task> = {
    lens,
    tasks: input.tasks,
    lanes: input.lanes ?? (lens === "status" ? statusLanes(input.tasks) : lens === "week" ? weekLanes(input.tasks) : whenLanes(input.tasks)),
    ctx: { today, timezone: "Pacific/Auckland", sort: input.sort ?? "manual", occurrences: [], dependencies: [], committedTasks: new Map(), ...input.ctx },
    onUpdate,
    onResolveOccurrence,
    onConflict,
  };
  const engine = new TaskDndEngine<Task>(options);
  return { engine, onUpdate, onResolveOccurrence, onConflict, options };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("refusals while hovering", () => {
  it("sets the lock reason on a refused lane and writes nothing on drop (R3)", async () => {
    const { engine, onUpdate } = setup({ tasks: [task("a"), task("b", { state: "in_progress" })], ctx: { committedTasks: new Map([["a", today]]) } });
    engine.dragStart("a");
    expect(engine.dragOver("a", "lane:done")).toBe("Done is not available. Committed in today's plan. Resolve it in Plan.");
    expect(engine.getSnapshot().preview).toEqual({
      activeId: "a",
      overZone: "lane:done",
      refusal: { reason: "Committed in today's plan. Resolve it in Plan.", rule: "R3", action: "open_plan" },
    });
    const outcome = engine.dragEnd("a", "lane:done");
    await outcome.done;
    expect(outcome.message).toBe("Could not move. Committed in today's plan. Resolve it in Plan. Task A is back in To do.");
    expect(onUpdate).not.toHaveBeenCalled();
    expect(engine.getSnapshot().preview).toBeNull();
    expect(engine.getSnapshot().pendingIds.size).toBe(0);
  });

  it("refuses Done for a recurring series with no occurrence today (R1) and clears the refusal on a valid lane", () => {
    const weekly = { frequency: "weekly", weekdays: [5] };
    const { engine } = setup({ tasks: [task("a", { recurrenceRule: weekly, scheduledLocalDate: "2026-09-25" })] });
    engine.dragStart("a");
    engine.dragOver("a", "lane:done");
    expect(engine.getSnapshot().preview?.refusal).toMatchObject({ rule: "R1", reason: "Repeats weekly. Next one is Fri 16 Oct." });
    engine.dragOver("a", "lane:in_progress");
    expect(engine.getSnapshot().preview).toEqual({ activeId: "a", overZone: "lane:in_progress", refusal: null });
  });

  it("refuses the Past due bucket in the When lens", () => {
    const { engine } = setup({ lens: "when", tasks: [task("a", { scheduledLocalDate: today })] });
    engine.dragStart("a");
    expect(engine.dragOver("a", "bucket:past_due")).toBe("Past due is not available. You can't plan into the past.");
  });

  it("over nothing clears the zone without an announcement", () => {
    const { engine } = setup({ tasks: [task("a")] });
    engine.dragStart("a");
    expect(engine.dragOver("a", null)).toBeUndefined();
    expect(engine.getSnapshot().preview).toEqual({ activeId: "a", overZone: null, refusal: null });
  });
});

describe("drop → write, optimistic placement and rollback", () => {
  it("moves a card to another lane in ONE write, optimistically, then announces Saved.", async () => {
    let release!: () => void;
    const { engine, onUpdate } = setup({
      tasks: [task("a", { sortOrder: 1024 }), task("b", { state: "in_progress", sortOrder: 1024 })],
      onUpdate: (record, patch) => new Promise(resolve => { release = () => resolve({ record: { ...record, ...patch }, queued: false }); }),
    });
    engine.dragStart("a");
    const outcome = engine.dragEnd("a", "b");
    expect(outcome.message).toBe("Task A moved to In progress, position 1.");
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ id: "a", version: 1 });
    expect(onUpdate.mock.calls[0][1]).toEqual({ state: "in_progress", sortOrder: 0 });
    const pending = engine.getSnapshot();
    expect(Array.from(pending.pendingIds)).toEqual(["a"]);
    expect(pending.optimisticZone.get("a")).toBe("lane:in_progress");
    expect(pending.optimisticPatches.get("a")).toEqual({ state: "in_progress", sortOrder: 0 });
    release();
    await outcome.done;
    const settled = engine.getSnapshot();
    expect(settled.pendingIds.size).toBe(0);
    expect(settled.optimisticZone.size).toBe(0);
    expect(settled.optimisticPatches.size).toBe(0);
    expect(settled.announcement?.text).toBe("Saved.");
  });

  it("says Saved on this device. when the write was queued offline", async () => {
    const { engine } = setup({ tasks: [task("a")], sort: "due", onUpdate: async record => ({ record, queued: true }) });
    engine.dragStart("a");
    await engine.dragEnd("a", "lane:blocked").done;
    expect(engine.getSnapshot().announcement?.text).toBe("Saved on this device.");
  });

  it("rolls back a failed write and shows the server text under the card for 6s", async () => {
    vi.useFakeTimers();
    const { engine, onConflict } = setup({ tasks: [task("a")], sort: "due", onUpdate: async () => { throw new Error("Finish the prerequisite first."); } });
    engine.dragStart("a");
    await engine.dragEnd("a", "lane:done").done;
    const failed = engine.getSnapshot();
    expect(failed.pendingIds.size).toBe(0);
    expect(failed.optimisticZone.size).toBe(0);
    expect(failed.optimisticPatches.size).toBe(0);
    expect(failed.inlineErrors.get("a")).toBe("Finish the prerequisite first.");
    expect(failed.announcement?.text).toBe("Could not move. Finish the prerequisite first. Task A is back in To do.");
    expect(onConflict).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5999);
    expect(engine.getSnapshot().inlineErrors.has("a")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(engine.getSnapshot().inlineErrors.has("a")).toBe(false);
  });

  it("rolls back a version conflict, says Changed elsewhere and asks the container to refetch", async () => {
    const conflict = Object.assign(new Error("Version mismatch"), { data: { code: "CONFLICT" } });
    const { engine, onConflict } = setup({ tasks: [task("a")], sort: "due", onUpdate: async () => { throw conflict; } });
    engine.dragStart("a");
    await engine.dragEnd("a", "lane:in_progress").done;
    expect(engine.getSnapshot().inlineErrors.get("a")).toBe(CONFLICT_REASON);
    expect(engine.getSnapshot().optimisticZone.size).toBe(0);
    expect(engine.getSnapshot().announcement?.text).toBe("Could not move. Changed elsewhere. Task A is back in To do.");
    expect(onConflict).toHaveBeenCalledWith("a");
  });

  it("resolves today's occurrence for a recurring card dropped on Done; it stays in its lane", async () => {
    const daily = { frequency: "daily" };
    const { engine, onUpdate, onResolveOccurrence } = setup({
      tasks: [task("a", { recurrenceRule: daily, scheduledLocalDate: "2026-09-24" })],
      ctx: { occurrences: [{ id: "occ-7", taskId: "a", localDate: today, state: "pending", version: 3 }] },
    });
    engine.dragStart("a");
    const outcome = engine.dragEnd("a", "lane:done");
    expect(outcome.message).toBe("Done today. It repeats, so it stays in To do.");
    expect(engine.getSnapshot().optimisticZone.has("a")).toBe(false);
    expect(engine.getSnapshot().pendingIds.has("a")).toBe(true);
    await outcome.done;
    expect(onResolveOccurrence).toHaveBeenCalledWith(expect.objectContaining({ id: "a" }), { id: "occ-7", expectedVersion: 3 });
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("archives from the dock: the card leaves the board optimistically", () => {
    const { engine, onUpdate } = setup({ tasks: [task("a")] });
    engine.dragStart("a");
    expect(engine.dragEnd("a", "dock:archive").message).toBe("Task A moved to Archive.");
    expect(onUpdate.mock.calls[0][1]).toEqual({ state: "archived" });
    expect(engine.getSnapshot().optimisticZone.get("a")).toBe("dock:archive");
  });

  it("ignores a second move of a card whose first write is still saving", async () => {
    let release!: () => void;
    const { engine, onUpdate } = setup({
      tasks: [task("a")],
      sort: "due",
      onUpdate: record => new Promise(resolve => { release = () => resolve({ record, queued: false }); }),
    });
    engine.dragStart("a");
    const first = engine.dragEnd("a", "lane:in_progress");
    engine.dragStart("a");
    expect(engine.dragEnd("a", "lane:blocked").message).toBe("Could not move. The last move is still saving. Task A is back in In progress.");
    expect(onUpdate).toHaveBeenCalledTimes(1);
    release();
    await first.done;
  });

  it("drop on its own slot or cancel writes nothing", () => {
    const { engine, onUpdate } = setup({ tasks: [task("a", { sortOrder: 1 }), task("b", { sortOrder: 2 })] });
    engine.dragStart("a");
    expect(engine.dragEnd("a", "a").message).toBe("Task A moved to To do, position 1.");
    engine.dragStart("a");
    expect(engine.dragCancel("a")).toBe("Move cancelled. Task A is back in To do.");
    engine.dragStart("a");
    expect(engine.dragEnd("a", null).message).toBe("Move cancelled. Task A is back in To do.");
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("When lens date requests", () => {
  const tasks = () => [task("a", { scheduledLocalDate: today }), task("b", { scheduledLocalDate: "2026-10-30" })];

  it("opens a date request limited to the bucket, then writes the chosen day", async () => {
    const { engine, onUpdate } = setup({ lens: "when", tasks: tasks() });
    engine.dragStart("a");
    expect(engine.dragEnd("a", "bucket:next_7_days").message).toBe("Task A moved to Next 7 days.");
    const request = engine.getSnapshot().dateRequest!;
    expect(request).toMatchObject({ taskId: "a", min: "2026-10-15", max: "2026-10-21", zone: "bucket:next_7_days", error: null });
    expect(engine.getSnapshot().optimisticZone.get("a")).toBe("bucket:next_7_days");
    expect(onUpdate).not.toHaveBeenCalled();

    request.resolve("2026-10-30");
    expect(onUpdate).not.toHaveBeenCalled();
    expect(engine.getSnapshot().dateRequest?.error).toBe("Choose a day from 15 Oct to 21 Oct.");

    engine.getSnapshot().dateRequest!.resolve("2026-10-16");
    expect(engine.getSnapshot().dateRequest).toBeNull();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][1]).toEqual({ scheduledLocalDate: "2026-10-16" });
    expect(engine.getSnapshot().optimisticZone.get("a")).toBe("bucket:next_7_days");
    await engine.idle();
    expect(engine.getSnapshot().announcement?.text).toBe("Saved.");
    expect(engine.getSnapshot().optimisticZone.size).toBe(0);
  });

  it("cancel rolls the card back with no write", () => {
    const { engine, onUpdate } = setup({ lens: "when", tasks: tasks() });
    engine.dragStart("a");
    engine.dragEnd("a", "bucket:later");
    const request = engine.getSnapshot().dateRequest!;
    expect(request).toMatchObject({ min: "2026-10-22", max: null });
    request.cancel();
    expect(engine.getSnapshot().dateRequest).toBeNull();
    expect(engine.getSnapshot().optimisticZone.size).toBe(0);
    expect(engine.getSnapshot().announcement?.text).toBe("Move cancelled. Task A is back in Today.");
    request.resolve("2026-10-30"); // a stale popover can't write after cancel
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("a new drag cancels an open date request", () => {
    const { engine } = setup({ lens: "when", tasks: tasks() });
    engine.dragStart("a");
    engine.dragEnd("a", "bucket:later");
    engine.dragStart("b");
    expect(engine.getSnapshot().dateRequest).toBeNull();
    expect(engine.getSnapshot().optimisticZone.size).toBe(0);
  });
});

describe("review #9: re-order uses the FULL lane", () => {
  it("places between the visible neighbours without colliding with a hidden task's key", () => {
    const tasks = [task("a", { sortOrder: 1024 }), task("h", { sortOrder: 2048 }), task("b", { sortOrder: 3072 }), task("c", { sortOrder: 4096 })];
    const lanes = statusLanes(tasks, item => item.id !== "h"); // search hides h
    const { engine, onUpdate } = setup({ tasks, lanes });
    engine.dragStart("c");
    engine.dragOver("c", "b");
    engine.dragEnd("c", "b"); // lands between a and b on screen
    // Visible-only maths would give 2048, the hidden task's key. The full lane puts it between h and b.
    expect(onUpdate.mock.calls).toHaveLength(1);
    expect(onUpdate.mock.calls[0][1]).toEqual({ sortOrder: 2560 });
  });

  it("renumbers hidden tasks too when there is no integer gap, moved card last", async () => {
    const tasks = [task("a", { sortOrder: 1 }), task("h", { sortOrder: 2 }), task("b", { sortOrder: 3 }), task("c", { sortOrder: 4 })];
    const lanes = statusLanes(tasks, item => item.id !== "h");
    const { engine, onUpdate } = setup({ tasks, lanes });
    engine.dragStart("c");
    engine.dragEnd("c", "b");
    await engine.idle();
    expect(onUpdate.mock.calls.map(([record, patch]) => [record.id, patch])).toEqual([
      ["a", { sortOrder: 1024 }],
      ["h", { sortOrder: 2048 }],
      ["b", { sortOrder: 4096 }],
      ["c", { sortOrder: 3072 }],
    ]);
  });

  it("marks every rebalanced sibling pending and patched until the run settles", () => {
    const tasks = [task("a", { sortOrder: 1 }), task("h", { sortOrder: 2 }), task("b", { sortOrder: 3 }), task("c", { sortOrder: 4 })];
    const { engine } = setup({ tasks, lanes: statusLanes(tasks, item => item.id !== "h"), onUpdate: () => new Promise(() => {}) });
    engine.dragStart("c");
    engine.dragEnd("c", "b");
    const snapshot = engine.getSnapshot();
    expect(Array.from(snapshot.pendingIds).sort()).toEqual(["a", "b", "c", "h"]);
    expect(snapshot.optimisticPatches.get("h")).toEqual({ sortOrder: 2048 });
    expect(snapshot.optimisticPatches.get("c")).toEqual({ sortOrder: 3072 });
  });

  it("maps a drop past the preview limit onto the full lane (cards beyond Show all count)", () => {
    const tasks = [task("a", { sortOrder: 1024 }), task("b", { sortOrder: 2048 }), task("x", { sortOrder: 3072 }), task("m", { state: "in_progress", sortOrder: 0 })];
    const lanes = statusLanes(tasks).map(lane => (lane.zone === "lane:todo" ? { ...lane, models: lane.models.slice(0, 2), hiddenCount: 1 } : lane));
    const { engine, onUpdate } = setup({ tasks, lanes });
    engine.dragStart("m");
    engine.dragEnd("m", "lane:todo"); // end of the visible cards = between b and the hidden x
    expect(onUpdate.mock.calls[0][1]).toEqual({ state: "not_started", sortOrder: 2560 });
  });

  it("refuses an in-lane re-order of a long full lane with no gap", () => {
    const tasks = Array.from({ length: 25 }, (_, index) => task(`t${index}`, { sortOrder: index }));
    const { engine, onUpdate } = setup({ tasks, lanes: statusLanes(tasks, item => Number(item.id.slice(1)) < 5) });
    engine.dragStart("t4");
    expect(engine.dragOver("t4", "t1")).toBe("To do is not available. Use Move up and down for long lanes.");
    engine.dragEnd("t4", "t1");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("reports why in-lane re-ordering is off", () => {
    expect(taskReorderDisabledReason("status", "manual")).toBeNull();
    expect(taskReorderDisabledReason("status", "due")).toBe("Sorted by due date, so the order follows the sort.");
    expect(taskReorderDisabledReason("when", "manual")).toBe(WHEN_LENS_REORDER_REASON);
  });
});

describe("non-Manual sort writes no sortOrder", () => {
  const tasks = () => [task("a", { sortOrder: 1, dueLocalDate: "2026-10-20" }), task("b", { sortOrder: 2, dueLocalDate: "2026-10-18" }), task("c", { state: "in_progress", sortOrder: 5 })];

  it("same lane: nothing written, the sort notice is announced", () => {
    const { engine, onUpdate } = setup({ tasks: tasks(), sort: "due" });
    engine.dragStart("a");
    expect(engine.dragEnd("a", "b").message).toBe("Task A moved to To do, position 2. Sorted by due date, so the order follows the sort.");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("other lane: state only, and the card lands where the sort puts it", () => {
    const { engine, onUpdate } = setup({ tasks: tasks(), sort: "priority" });
    engine.dragStart("a");
    const outcome = engine.dragEnd("a", "c");
    expect(onUpdate.mock.calls[0][1]).toEqual({ state: "in_progress" });
    expect(outcome.message).toBe("Task A moved to In progress, position 1. Sorted by priority, so the order follows the sort.");
  });
});

describe("announcements (spec §12)", () => {
  const tasks = () => [task("a", { sortOrder: 1 }), task("b", { sortOrder: 2 }), task("c", { sortOrder: 3 }), task("d", { state: "in_progress", sortOrder: 1 })];

  it("start, over, end and cancel use the exact strings", () => {
    const { engine } = setup({ tasks: tasks() });
    expect(engine.dragStart("b")).toBe("Picked up Task B. In To do, position 2 of 3.");
    expect(engine.dragOver("b", "a")).toBe("Task B is over To do, position 1 of 3.");
    expect(engine.dragOver("b", "d")).toBe("Task B is over In progress, position 1 of 2.");
    expect(engine.dragOver("b", "lane:in_progress")).toBe("Task B is over In progress, position 2 of 2.");
    expect(engine.dragEnd("b", "lane:in_progress").message).toBe("Task B moved to In progress, position 2.");
    expect(engine.dragStart("c")).toBe("Picked up Task C. In To do, position 3 of 3.");
    expect(engine.dragCancel("c")).toBe("Move cancelled. Task C is back in To do.");
  });

  it("feeds dnd-kit's announcer from the handler that just ran", () => {
    const { engine } = setup({ tasks: tasks() });
    const handlers = taskDndContextHandlers(engine);
    const { announcements, screenReaderInstructions } = handlers.accessibility;
    const active = { id: "a" } as never;
    handlers.onDragStart({ active } as never);
    expect(announcements.onDragStart({ active })).toBe("Picked up Task A. In To do, position 1 of 3.");
    handlers.onDragOver({ active, over: { id: "lane:blocked" } } as never);
    expect(announcements.onDragOver({ active, over: null })).toBe("Task A is over Blocked, position 1 of 1.");
    handlers.onDragEnd({ active, over: { id: "lane:blocked" } } as never);
    expect(announcements.onDragEnd({ active, over: null })).toBe("Task A moved to Blocked, position 1.");
    expect(screenReaderInstructions.draggable).toBe(TASK_DND_INSTRUCTIONS);
  });

  it("keyboard pick-up, → and drop calls onUpdate once with the lane state; Escape writes nothing", async () => {
    const { engine, onUpdate, options } = setup({ tasks: [task("a"), task("b")], sort: "due" });
    const handlers = taskDndContextHandlers(engine);
    const getter = createTaskKeyboardCoordinates(() => options.lanes, id => { engine.keyboardTarget = id; });
    const rects = new Map<string, { left: number; top: number }>([
      ["a", { left: 0, top: 0 }], ["b", { left: 0, top: 100 }],
      ["lane:in_progress", { left: 300, top: 0 }], ["lane:blocked", { left: 600, top: 0 }], ["lane:done", { left: 900, top: 0 }],
    ]);
    const key = (code: string) => ({ code, preventDefault() {} }) as KeyboardEvent;
    const active = { id: "a" } as never;

    handlers.onDragStart({ active } as never); // Space
    const moved = getter(key("ArrowRight"), { active: "a", currentCoordinates: { x: 0, y: 0 }, context: { over: { id: "a" }, droppableRects: rects } as never });
    expect(moved).toEqual({ x: 300, y: 0 });
    expect(engine.keyboardTarget).toBe("lane:in_progress");
    handlers.onDragOver({ active, over: { id: engine.keyboardTarget } } as never);
    handlers.onDragEnd({ active, over: { id: engine.keyboardTarget } } as never); // Space
    await engine.idle();
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate.mock.calls[0][1]).toEqual({ state: "in_progress" });

    handlers.onDragStart({ active: { id: "b" } } as never);
    handlers.onDragCancel({ active: { id: "b" }, over: null } as never); // Escape
    expect(handlers.accessibility.announcements.onDragCancel({ active: { id: "b" } as never, over: null })).toBe("Move cancelled. Task B is back in To do.");
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});

describe("moveTo (Move to menu) shares the drop path", () => {
  it("writes the same patch as a drop on that lane", async () => {
    const tasks = () => [task("a", { sortOrder: 1 }), task("d", { state: "in_progress", sortOrder: 5 })];
    const dropped = setup({ tasks: tasks() });
    dropped.engine.dragStart("a");
    dropped.engine.dragEnd("a", "lane:in_progress");
    const menu = setup({ tasks: tasks() });
    const outcome = menu.engine.moveTo("a", "lane:in_progress");
    expect(menu.onUpdate.mock.calls[0][1]).toEqual(dropped.onUpdate.mock.calls[0][1]);
    expect(menu.onUpdate.mock.calls[0][1]).toEqual({ state: "in_progress", sortOrder: 1029 });
    expect(menu.engine.getSnapshot().announcement?.text).toBe("Task A moved to In progress, position 2.");
    expect(menu.engine.getSnapshot().optimisticZone.get("a")).toBe("lane:in_progress");
    await outcome.done;
    expect(menu.engine.getSnapshot().announcement?.text).toBe("Saved.");
  });

  it("refuses with the same reason and shows it inline", () => {
    const { engine, onUpdate } = setup({ tasks: [task("a")], ctx: { committedTasks: new Map([["a", today]]) } });
    engine.moveTo("a", "dock:archive");
    expect(onUpdate).not.toHaveBeenCalled();
    expect(engine.getSnapshot().inlineErrors.get("a")).toBe("Committed in today's plan. Resolve it in Plan.");
    expect(engine.getSnapshot().announcement?.text).toBe("Could not move. Committed in today's plan. Resolve it in Plan. Task A is back in To do.");
  });

  it("works without rendered lanes (List view): state only", () => {
    const { engine, onUpdate } = setup({ tasks: [task("a")], lanes: [] });
    engine.moveTo("a", "lane:blocked");
    expect(onUpdate.mock.calls[0][1]).toEqual({ state: "blocked" });
    expect(engine.getSnapshot().announcement?.text).toBe("Task A moved to Blocked.");
  });

  it("plans for today in the When lens and says when the deadline keeps it in Past due", () => {
    const { engine, onUpdate } = setup({ lens: "when", tasks: [task("a", { dueLocalDate: "2026-10-10" })] });
    engine.moveTo("a", "bucket:today");
    expect(onUpdate.mock.calls[0][1]).toEqual({ scheduledLocalDate: today });
    expect(engine.getSnapshot().optimisticZone.get("a")).toBe("bucket:past_due");
    expect(engine.getSnapshot().announcement?.text).toBe("Task A moved to Today. Planned for today. Its deadline has passed, so it stays in Past due.");
  });
});

describe("sensors, keyboard getter and collisions", () => {
  const element = (matches: Record<string, unknown>) => ({
    closest: (selector: string) => (selector.includes("data-task-drag-handle") ? matches.handle ?? null : matches.interactive ?? null),
  });

  it("starts drags from the card body or handle, never from a button inside the card", () => {
    const card = {};
    expect(canStartTaskDrag(element({}), card)).toBe(true);
    expect(canStartTaskDrag(element({ handle: {} }), card)).toBe(true);
    expect(canStartTaskDrag(element({ interactive: {} }), card)).toBe(false);
    expect(canStartTaskDrag(element({ interactive: card }), card)).toBe(true);
    expect(canStartTaskDrag(null, card)).toBe(true);
  });

  it("pointer ignores touch (the long-press sensor owns it); touch waits 250ms", () => {
    const onActivation = vi.fn();
    const pointer = TaskPointerSensor.activators[0].handler;
    const base = { isPrimary: true, button: 0, target: element({}) };
    expect(pointer({ nativeEvent: { ...base, pointerType: "touch" }, currentTarget: {} } as never, { onActivation })).toBe(false);
    expect(pointer({ nativeEvent: { ...base, pointerType: "mouse" }, currentTarget: {} } as never, { onActivation })).toBe(true);
    expect(pointer({ nativeEvent: { ...base, pointerType: "mouse", target: element({ interactive: {} }) }, currentTarget: {} } as never, { onActivation })).toBe(false);
    const touch = TaskTouchSensor.activators[0].handler;
    expect(touch({ nativeEvent: { touches: [{}], target: element({}) }, currentTarget: {} } as never, { onActivation })).toBe(true);
    expect(touch({ nativeEvent: { touches: [{}, {}], target: element({}) }, currentTarget: {} } as never, { onActivation })).toBe(false);
    expect(TASK_TOUCH_ACTIVATION).toEqual({ delay: 250, tolerance: 8 });
    expect(TASK_POINTER_ACTIVATION).toEqual({ distance: 6 });
    const keyboard = TaskKeyboardSensor.activators[0].handler;
    const keyEvent = { nativeEvent: { code: "Space" }, target: element({ interactive: {} }), currentTarget: {}, preventDefault() {} };
    expect(keyboard(keyEvent as never, {}, { active: { activatorNode: { current: null } } } as never)).toBe(false);
  });

  it("↑/↓ walk the lane, ←/→ jump to the top of the adjacent lane (or its empty well)", () => {
    const tasks = [task("a", { sortOrder: 1 }), task("b", { sortOrder: 2 }), task("d", { state: "in_progress" })];
    const lanes = statusLanes(tasks);
    let target: string | null = null;
    const getter = createTaskKeyboardCoordinates(() => lanes, id => { target = id; });
    const rects = new Map<string, { left: number; top: number }>([
      ["a", { left: 0, top: 0 }], ["b", { left: 0, top: 100 }], ["d", { left: 300, top: 0 }],
      ["lane:todo", { left: 0, top: 0 }], ["lane:in_progress", { left: 300, top: 0 }], ["lane:blocked", { left: 600, top: 0 }], ["lane:done", { left: 900, top: 0 }],
    ]);
    const move = (code: string, over: string) =>
      getter({ code, preventDefault() {} } as KeyboardEvent, { active: "a", currentCoordinates: { x: 0, y: 0 }, context: { over: { id: over }, droppableRects: rects } as never });
    expect(move("ArrowDown", "a")).toEqual({ x: 0, y: 100 });
    expect(target).toBe("b");
    expect(move("ArrowUp", "a")).toBeUndefined();
    expect(move("ArrowRight", "a")).toEqual({ x: 300, y: 0 });
    expect(target).toBe("d");
    expect(move("ArrowDown", "d")).toEqual({ x: 300, y: 0 });
    expect(target).toBe("lane:in_progress");
    expect(move("ArrowRight", "d")).toEqual({ x: 600, y: 0 });
    expect(target).toBe("lane:blocked");
    expect(move("ArrowLeft", "lane:blocked")).toEqual({ x: 300, y: 0 });
    expect(move("ArrowLeft", "a")).toBeUndefined();
    expect(move("KeyA", "a")).toBeUndefined();
  });

  it("collisions: keyboard returns the aimed droppable; pointer prefers dock, then card, then lane", () => {
    let aimed: string | null = "lane:blocked";
    const detect = createTaskCollisionDetection(() => aimed);
    const container = (id: string) => ({ id, disabled: false, node: { current: null }, rect: { current: null }, data: { current: {} }, key: id });
    const droppableContainers = ["a", "lane:todo", "lane:blocked", "dock:archive"].map(container);
    const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height });
    const droppableRects = new Map<string, ReturnType<typeof rect>>([
      ["a", rect(0, 0, 200, 80)], ["lane:todo", rect(0, 0, 240, 600)], ["lane:blocked", rect(300, 0, 240, 600)], ["dock:archive", rect(0, 40, 400, 60)],
    ]);
    const args = (pointer: { x: number; y: number } | null) => ({
      active: { id: "a" }, collisionRect: rect(0, 0, 200, 80), droppableRects, droppableContainers, pointerCoordinates: pointer,
    }) as never;
    expect(detect(args(null))[0].id).toBe("lane:blocked");
    expect(detect(args({ x: 10, y: 10 }))[0].id).toBe("a");
    expect(detect(args({ x: 10, y: 50 }))[0].id).toBe("dock:archive");
    expect(detect(args({ x: 10, y: 300 }))[0].id).toBe("lane:todo");
    aimed = null;
    expect(detect(args(null)).length).toBeGreaterThan(0);
  });
});

describe("useTaskDnd", () => {
  it("returns the controller with dnd-kit props and an idle state", () => {
    let result: UseTaskDndResult | null = null;
    function Probe() {
      result = useTaskDnd({
        lens: "status",
        tasks: [task("a")],
        lanes: statusLanes([task("a")]),
        ctx: { today, timezone: "Pacific/Auckland", sort: "due" },
        onUpdate: async () => ({}),
        reducedMotion: true,
      });
      return null;
    }
    renderToStaticMarkup(<Probe />);
    const controller = result as unknown as UseTaskDndResult;
    expect(controller.contextProps.sensors).toHaveLength(3);
    expect(controller.contextProps.accessibility?.screenReaderInstructions?.draggable).toBe(TASK_DND_INSTRUCTIONS);
    expect(typeof controller.contextProps.onDragEnd).toBe("function");
    expect(typeof controller.contextProps.collisionDetection).toBe("function");
    expect(controller.preview).toBeNull();
    expect(controller.pendingIds.size).toBe(0);
    expect(controller.dateRequest).toBeNull();
    expect(controller.reorderDisabledReason).toBe("Sorted by due date, so the order follows the sort.");
    expect(controller.reducedMotion).toBe(true);
    expect(typeof controller.moveTo).toBe("function");
  });
});

describe("Week board day-column lens (T1, Q3/Q4)", () => {
  const ctx = { today, timezone: "Pacific/Auckland" };

  it("maps day zones to drop targets, labels and task positions", () => {
    expect(isTaskDropZoneId("day:none")).toBe(true);
    expect(isTaskDropZoneId("day:2026-10-16")).toBe(true);
    expect(isTaskDropZoneId("day:friday")).toBe(false);
    expect(dropTargetForZone("day:2026-10-16")).toEqual({ kind: "day", date: "2026-10-16" });
    expect(dropTargetForZone("day:none")).toEqual({ kind: "day", date: null });
    expect(zoneLabel("day:none")).toBe("Unscheduled");
    expect(zoneLabel("day:2026-10-16")).toBe("Fri 16");
    expect(zoneForTask(task("a", { scheduledLocalDate: "2026-10-16" }), "week", ctx)).toBe("day:2026-10-16");
    expect(zoneForTask(task("a", { dueLocalDate: "2026-10-16" }), "week", ctx)).toBe("day:none");
    expect(zoneForTask(task("a", { plannedStartAt: "2026-10-15T20:15:00.000Z", plannedEndAt: "2026-10-15T21:00:00.000Z" }), "week", ctx)).toBe("day:2026-10-16");
    expect(taskReorderDisabledReason("week", "manual")).toBe(WEEK_LENS_REORDER_REASON);
  });

  it("dragging a card to a day sets Plan for to that day", async () => {
    const { engine, onUpdate } = setup({ lens: "week", tasks: [task("a", { projectId: "p1" }), task("b", { scheduledLocalDate: today })] });
    engine.dragStart("a");
    expect(engine.dragOver("a", "day:2026-10-16")).toBe("Task A is over Fri 16, position 1 of 1.");
    const outcome = engine.dragEnd("a", "day:2026-10-16");
    expect(outcome.message).toBe("Task A moved to Fri 16, position 1.");
    expect(onUpdate.mock.calls[0][1]).toEqual({ scheduledLocalDate: "2026-10-16" });
    expect(engine.getSnapshot().optimisticZone.get("a")).toBe("day:2026-10-16");
    await outcome.done;
    expect(engine.getSnapshot().announcement?.text).toBe("Saved.");
  });

  it("Unscheduled clears Plan for", () => {
    const { engine, onUpdate } = setup({ lens: "week", tasks: [task("b", { scheduledLocalDate: today, dueLocalDate: "2026-10-20" })] });
    engine.dragStart("b");
    expect(engine.dragEnd("b", "day:none").message).toBe("Task B moved to Unscheduled, position 1. Moved to Unscheduled.");
    expect(onUpdate.mock.calls[0][1]).toEqual({ scheduledLocalDate: null });
  });

  it("refuses a past day while hovering and on drop", () => {
    const { engine, onUpdate } = setup({ lens: "week", tasks: [task("a", { projectId: "p1" })] });
    engine.dragStart("a");
    engine.dragOver("a", "day:2026-10-13");
    expect(engine.getSnapshot().preview?.refusal).toMatchObject({ rule: "past" });
    expect(engine.dragEnd("a", "day:2026-10-13").message).toBe("Could not move. You can't plan into the past. Task A is back in Unscheduled.");
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it("a drop after the deadline asks once: Plan anyway writes the day only", async () => {
    const { engine, onUpdate } = setup({ lens: "week", tasks: [task("a", { dueLocalDate: "2026-10-16" })] });
    engine.dragStart("a");
    engine.dragOver("a", "day:2026-10-18");
    expect(engine.getSnapshot().preview).toMatchObject({ refusal: null, lateWarning: "Sun is after the Fri deadline" });
    const outcome = engine.dragEnd("a", "day:2026-10-18");
    expect(outcome.message).toBe("Task A moved to Sun 18. Sun is after the Fri deadline. Plan anyway, move the deadline, or cancel.");
    expect(onUpdate).not.toHaveBeenCalled();
    const late = engine.getSnapshot().lateDrop!;
    expect(late).toMatchObject({ taskId: "a", zone: "day:2026-10-18", day: "2026-10-18", deadline: "2026-10-16", prompt: "Sun is after the Fri deadline" });
    expect(engine.getSnapshot().optimisticZone.get("a")).toBe("day:2026-10-18");
    late.planAnyway();
    expect(engine.getSnapshot().lateDrop).toBeNull();
    expect(onUpdate.mock.calls[0][1]).toEqual({ scheduledLocalDate: "2026-10-18" });
    expect(engine.getSnapshot().announcement?.text).toBe("Planned for Sun 18 Oct, after the deadline.");
    await engine.idle();
    expect(engine.getSnapshot().announcement?.text).toBe("Saved.");
    late.moveDeadline(); // stale prompt: no second write
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("Move deadline writes both dates; Cancel rolls back with no write", () => {
    const first = setup({ lens: "week", tasks: [task("a", { dueLocalDate: "2026-10-16" })] });
    first.engine.dragStart("a");
    first.engine.dragEnd("a", "day:2026-10-18");
    first.engine.getSnapshot().lateDrop!.moveDeadline();
    expect(first.onUpdate.mock.calls[0][1]).toEqual({ scheduledLocalDate: "2026-10-18", dueLocalDate: "2026-10-18" });

    const second = setup({ lens: "week", tasks: [task("a", { dueLocalDate: "2026-10-16" })] });
    second.engine.dragStart("a");
    second.engine.dragEnd("a", "day:2026-10-18");
    second.engine.getSnapshot().lateDrop!.cancel();
    expect(second.engine.getSnapshot().lateDrop).toBeNull();
    expect(second.engine.getSnapshot().optimisticZone.size).toBe(0);
    expect(second.engine.getSnapshot().announcement?.text).toBe("Move cancelled. Task A is back in Unscheduled.");
    expect(second.onUpdate).not.toHaveBeenCalled();
  });

  it("a new drag dismisses a pending late prompt", () => {
    const { engine, onUpdate } = setup({ lens: "week", tasks: [task("a", { dueLocalDate: "2026-10-16" }), task("b", { projectId: "p1" })] });
    engine.dragStart("a");
    engine.dragEnd("a", "day:2026-10-18");
    engine.dragStart("b");
    expect(engine.getSnapshot().lateDrop).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});

describe("When lens late popover choice (Q4)", () => {
  it("turns a popover day after the deadline into the late prompt instead of refusing", () => {
    const { engine, onUpdate } = setup({ lens: "when", tasks: [task("a", { scheduledLocalDate: today, dueLocalDate: "2026-10-16" })] });
    engine.dragStart("a");
    engine.dragEnd("a", "bucket:next_7_days");
    expect(engine.getSnapshot().dateRequest).toMatchObject({ min: "2026-10-15", max: "2026-10-21" });
    engine.getSnapshot().dateRequest!.resolve("2026-10-19");
    expect(engine.getSnapshot().dateRequest).toBeNull();
    expect(engine.getSnapshot().lateDrop).toMatchObject({ day: "2026-10-19", prompt: "Mon is after the Fri deadline", zone: "bucket:next_7_days" });
    expect(engine.getSnapshot().announcement?.text).toBe("Mon is after the Fri deadline. Plan anyway, move the deadline, or cancel.");
    expect(onUpdate).not.toHaveBeenCalled();
    engine.getSnapshot().lateDrop!.planAnyway();
    expect(onUpdate.mock.calls[0][1]).toEqual({ scheduledLocalDate: "2026-10-19" });
  });
});
