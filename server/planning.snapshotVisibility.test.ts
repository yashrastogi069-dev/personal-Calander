import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { dailyPlanItems, dailyPlans, workspaces } from "../drizzle/schema";
import { getDb } from "./db";
import { getWorkspaceSnapshot } from "./planning";

const mockedGetDb = vi.mocked(getDb);

describe("workspace snapshot outstanding-plan visibility", () => {
  beforeEach(() => vi.resetAllMocks());

  it("adds only the older non-archived owner of a committed item to the bounded snapshot", async () => {
    const workspace = { id: "snapshot-visibility", timezone: "UTC" };
    const visible = { id: "today-plan", workspaceId: workspace.id, localDate: "2026-09-21", state: "active" };
    const older = { id: "older-plan", workspaceId: workspace.id, localDate: "2026-07-01", state: "closed" };
    const items = [{ id: "older-item", dailyPlanId: older.id, taskId: "task-1", state: "committed", position: 0 }];
    let planReads = 0;
    const select = vi.fn(() => ({
      from(table: unknown) {
        const rows = table === workspaces ? [workspace]
          : table === dailyPlanItems ? items
          : table === dailyPlans ? (++planReads === 1 ? [visible] : [older]) : [];
        const builder = {
          where: () => builder,
          orderBy: () => builder,
          limit: async (count: number) => rows.slice(0, count),
          then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
        };
        return builder;
      },
    }));
    mockedGetDb.mockResolvedValue({ select } as never);

    const snapshot = await getWorkspaceSnapshot(workspace, { start: "2026-08-25", end: "2026-10-19" });

    expect(snapshot.dailyPlans.map(plan => plan.id)).toEqual(["today-plan", "older-plan"]);
    expect(snapshot.dailyPlanItems.map(item => item.id)).toEqual(["older-item"]);
    expect(planReads).toBe(2);
  });
});
