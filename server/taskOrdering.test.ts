import { describe, expect, it } from "vitest";
import { LONG_LANE_REORDER_REASON, MAX_REBALANCE_TASKS, nextTaskSortOrder, planSortOrderMove, SORT_ORDER_STEP, sortOrderBetween } from "../shared/taskOrdering";

describe("task lane ordering", () => {
  it("moves only within the visible lane boundary", () => {
    const tasks = [{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 10 }, { id: "c", sortOrder: 20 }];
    expect(nextTaskSortOrder(tasks, "a", -1)).toBeNull();
    expect(nextTaskSortOrder(tasks, "c", 1)).toBeNull();
    expect(nextTaskSortOrder(tasks, "b", -1)).toBe(-1);
    expect(nextTaskSortOrder(tasks, "b", 1)).toBe(21);
  });

  it("uses the available integer gap and handles equal legacy sort keys", () => {
    expect(nextTaskSortOrder([{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 50 }, { id: "c", sortOrder: 100 }], "c", -1)).toBe(25);
    expect(nextTaskSortOrder([{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 0 }, { id: "c", sortOrder: 0 }], "b", 1)).toBe(1);
  });
});

describe("drag re-order maths", () => {
  it("returns the integer midpoint, a 1024 step at lane edges, and null with no gap", () => {
    expect(sortOrderBetween(0, 1024)).toBe(512);
    expect(sortOrderBetween(10, 13)).toBe(11);
    expect(sortOrderBetween(-5, 5)).toBe(0);
    expect(sortOrderBetween(null, 100)).toBe(100 - SORT_ORDER_STEP);
    expect(sortOrderBetween(100, null)).toBe(100 + SORT_ORDER_STEP);
    expect(sortOrderBetween(null, null)).toBe(0);
    expect(sortOrderBetween(4, 5)).toBeNull();
    expect(sortOrderBetween(5, 5)).toBeNull();
    expect(sortOrderBetween(6, 5)).toBeNull();
  });

  const lane = [{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 1024 }, { id: "c", sortOrder: 2048 }];

  it("moves within a lane with one write when there is a gap", () => {
    expect(planSortOrderMove(lane, "c", 0)).toEqual({ kind: "single", sortOrder: -1024 });
    expect(planSortOrderMove(lane, "a", 1)).toEqual({ kind: "single", sortOrder: 1536 });
    expect(planSortOrderMove(lane, "a", 2)).toEqual({ kind: "single", sortOrder: 3072 });
  });

  it("reports an unchanged position as no write", () => {
    expect(planSortOrderMove(lane, "b", 1)).toEqual({ kind: "unchanged" });
  });

  it("places a card arriving from another lane", () => {
    expect(planSortOrderMove(lane, "x", 1)).toEqual({ kind: "single", sortOrder: 512 });
    expect(planSortOrderMove([], "x", 0)).toEqual({ kind: "single", sortOrder: 0 });
  });

  it("renumbers a lane with no gap, writing only changed siblings and the moved card last", () => {
    const tight = [{ id: "a", sortOrder: 0 }, { id: "b", sortOrder: 0 }, { id: "c", sortOrder: 0 }];
    expect(planSortOrderMove(tight, "c", 1)).toEqual({
      kind: "rebalance",
      writes: [{ id: "a", sortOrder: 1024 }, { id: "b", sortOrder: 3072 }, { id: "c", sortOrder: 2048 }],
      sortOrder: 2048,
    });
    const partlySpaced = [{ id: "a", sortOrder: 1024 }, { id: "b", sortOrder: 1025 }];
    expect(planSortOrderMove(partlySpaced, "x", 1)).toEqual({
      kind: "rebalance",
      writes: [{ id: "b", sortOrder: 3072 }, { id: "x", sortOrder: 2048 }],
      sortOrder: 2048,
    });
  });

  it("refuses to renumber lanes over 24 tasks", () => {
    const full = Array.from({ length: MAX_REBALANCE_TASKS }, (_, index) => ({ id: `t${index}`, sortOrder: 0 }));
    expect(planSortOrderMove(full, "t3", 10).kind).toBe("rebalance");
    expect(planSortOrderMove(full, "new", 10)).toEqual({ kind: "refused", reason: LONG_LANE_REORDER_REASON });
    expect(LONG_LANE_REORDER_REASON).toBe("Use Move up and down for long lanes.");
  });
});
