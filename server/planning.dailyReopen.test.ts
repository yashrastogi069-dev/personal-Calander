import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
import { upsertDailyPlan } from "./planning";

const database = new PGlite();
const scope = { workspaceId: "owned", timezone: "UTC" };

async function seedClosedPlan() {
  await database.exec(`INSERT INTO workspaces (id, timezone) VALUES ('owned', 'UTC'), ('other', 'UTC');
    INSERT INTO tasks (id, "workspaceId", title) VALUES ('task-1', 'owned', 'Keep the promise');
    INSERT INTO "dailyPlans" (id, "workspaceId", "localDate", state, intention, reflection, "startedAt", "closedAt", version)
      VALUES ('plan-1', 'owned', '2026-09-27', 'closed', 'Finish the proposal', 'Sent a draft',
        '2026-09-27 08:00:00', '2026-09-27 19:00:00', 3),
        ('foreign-plan', 'other', '2026-09-27', 'closed', 'Private intention', 'Private reflection',
        '2026-09-27 08:00:00', '2026-09-27 19:00:00', 1);
    INSERT INTO "dailyPlanItems" (id, "workspaceId", "dailyPlanId", "taskId", state, note, position, version)
      VALUES ('item-1', 'owned', 'plan-1', 'task-1', 'done', 'Draft sent', 2, 5);`);
}

async function planRows() {
  return (await database.query('SELECT id, state, intention, reflection, "startedAt", "closedAt", version FROM "dailyPlans" WHERE "workspaceId" = $1 ORDER BY id', [scope.workspaceId])).rows;
}

describe.sequential("daily plan reopening", () => {
  beforeAll(async () => {
    await database.exec(readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8"));
    await database.exec(readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8"));
    await database.exec(readFileSync(new URL("../supabase/migrations/0004_phase4_product_model.sql", import.meta.url), "utf8"));
    await database.exec(readFileSync(new URL("../supabase/migrations/0005_carried_commitments.sql", import.meta.url), "utf8"));
    mocks.getDb.mockResolvedValue(drizzle(database));
  }, 30_000);
  beforeEach(async () => {
    await database.exec('TRUNCATE "carriedCommitments", "commitmentResolutions", "dailyPlanItems", "dailyPlans", tasks, workspaces;');
    await seedClosedPlan();
  });
  afterAll(() => database.close());

  it("reopens the same plan with an explicit version while preserving its reflection and resolved items", async () => {
    const reopened = await upsertDailyPlan(scope, { localDate: "2026-09-27", state: "active", expectedVersion: 3 });
    expect(reopened).toMatchObject({ id: "plan-1", state: "active", version: 4, intention: "Finish the proposal", reflection: "Sent a draft" });
    expect(reopened.closedAt).toEqual(new Date("2026-09-27T19:00:00.000Z"));
    expect((await database.query('SELECT id, "dailyPlanId", state, note, position, version FROM "dailyPlanItems" WHERE id = $1', ["item-1"])).rows)
      .toEqual([{ id: "item-1", dailyPlanId: "plan-1", state: "done", note: "Draft sent", position: 2, version: 5 }]);
    expect((await planRows())).toHaveLength(1);
  });

  it("requires a current version before a closed plan can reopen", async () => {
    await expect(upsertDailyPlan(scope, { localDate: "2026-09-27", state: "active" })).rejects.toThrow();
    await expect(upsertDailyPlan(scope, { localDate: "2026-09-27", state: "active", expectedVersion: 2 })).rejects.toThrow("changed elsewhere");
    expect((await planRows())[0]).toMatchObject({ state: "closed", version: 3 });
  });

  it("does not reopen a closed plan through a draft or archived state", async () => {
    await expect(upsertDailyPlan(scope, { localDate: "2026-09-27", state: "draft", expectedVersion: 3 })).rejects.toThrow();
    await expect(upsertDailyPlan(scope, { localDate: "2026-09-27", state: "archived", expectedVersion: 3 })).rejects.toThrow();
    expect((await planRows())[0]).toMatchObject({ state: "closed", version: 3 });
  });
});
