import { describe, expect, it } from "vitest";
import { reorderCommittedDailyPlanItems } from "../shared/dailyPlanOrdering";

describe("daily commitment ordering", () => {
  const items = [
    { id: "a", position: 0, state: "committed" },
    { id: "b", position: 1, state: "committed" },
    { id: "resolved", position: 2, state: "done" },
    { id: "c", position: 3, state: "committed" },
  ];

  it("moves an unresolved commitment while preserving a dense, deterministic order", () => {
    expect(reorderCommittedDailyPlanItems(items, "c", -1)).toEqual([{ id: "a", position: 0 }, { id: "c", position: 1 }, { id: "b", position: 2 }]);
  });

  it("does not reorder a resolved item or move beyond the available committed boundary", () => {
    expect(reorderCommittedDailyPlanItems(items, "resolved", -1)).toBeNull();
    expect(reorderCommittedDailyPlanItems(items, "a", -1)).toBeNull();
  });
});
