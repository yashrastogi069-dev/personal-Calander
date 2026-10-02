import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
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
    mockedGetDb.mockResolvedValue({ select, execute: vi.fn().mockResolvedValue({ rows: [{ available: false }] }) } as never);

    const snapshot = await getWorkspaceSnapshot(workspace, { start: "2026-08-25", end: "2026-10-19" });

    expect(snapshot.dailyPlans.map(plan => plan.id)).toEqual(["today-plan", "older-plan"]);
    expect(snapshot.dailyPlanItems.map(item => item.id)).toEqual(["older-item"]);
    expect(planReads).toBe(2);
  });

  it("includes older open focus sessions but bounds completed history and isolates workspaces", async () => {
    const database = new PGlite();
    try {
      await database.exec(readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8"));
      await database.exec(readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8"));
      await database.exec(`
        INSERT INTO workspaces (id, timezone) VALUES ('snapshot-visibility', 'UTC'), ('other-workspace', 'UTC');
        INSERT INTO "focusSessions" (id, "workspaceId", state, "startedAt", "lastResumedAt", "activeSeconds") VALUES
          ('old-active', 'snapshot-visibility', 'active', '2026-08-01 09:00:00', '2026-08-01 09:00:00', 120),
          ('old-paused', 'snapshot-visibility', 'paused', '2026-08-02 09:00:00', '2026-08-02 09:00:00', 240),
          ('old-completed', 'snapshot-visibility', 'completed', '2026-08-03 09:00:00', '2026-08-03 09:00:00', 300),
          ('recent-completed', 'snapshot-visibility', 'completed', '2026-10-02 09:00:00', '2026-10-02 09:00:00', 360),
          ('foreign-active', 'other-workspace', 'active', '2026-08-01 09:00:00', '2026-08-01 09:00:00', 420);
      `);
      mockedGetDb.mockResolvedValue(drizzle(database) as never);

      const snapshot = await getWorkspaceSnapshot(
        { workspaceId: "snapshot-visibility", timezone: "UTC" },
        { start: "2026-10-01", end: "2026-10-03" },
      );

      expect(snapshot.focusSessions.map(session => session.id)).toEqual([
        "recent-completed", "old-paused", "old-active",
      ]);
    } finally {
      await database.close();
    }
  }, 30_000);
});
