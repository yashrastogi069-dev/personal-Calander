import { describe, expect, it } from "vitest";
import { nextTaskSortOrder } from "../shared/taskOrdering";

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
