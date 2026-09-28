import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
import { getWorkspaceSnapshot, resolveCommitment } from "./planning";

const database = new PGlite();
const scope = { workspaceId: "owned", timezone: "UTC" };

describe.sequential("0004-only Recovery compatibility", () => {
  beforeAll(async () => {
    for (const name of ["0000_loving_madrox.sql", "0001_independent_ownership.sql", "0004_phase4_product_model.sql"])
      await database.exec(readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8"));
    mocks.getDb.mockResolvedValue(drizzle(database));
    await database.exec(`INSERT INTO workspaces (id, timezone) VALUES ('owned', 'UTC');
      INSERT INTO tasks (id, "workspaceId", title, state, "scheduledLocalDate", "recurrenceRule", version)
      VALUES ('ordinary', 'owned', 'Ordinary', 'not_started', '2026-09-27', null, 1),
             ('recurring', 'owned', 'Recurring', 'not_started', '2026-09-27', '{"frequency":"daily","interval":1}', 1);
      INSERT INTO "dailyPlans" (id, "workspaceId", "localDate", state) VALUES ('plan', 'owned', '2026-09-27', 'active');
      INSERT INTO "dailyPlanItems" (id, "workspaceId", "dailyPlanId", "taskId", state, version)
      VALUES ('ordinary-item', 'owned', 'plan', 'ordinary', 'committed', 1), ('recurring-item', 'owned', 'plan', 'recurring', 'committed', 1);
      INSERT INTO "taskOccurrences" (id, "workspaceId", "taskId", "localDate", state, version)
      VALUES ('occurrence', 'owned', 'recurring', '2026-09-27', 'pending', 1);`);
  }, 30_000);
  afterAll(() => database.close());

  it("reads and writes established 0004 resolutions without requiring 0005 columns", async () => {
    const resolution = await resolveCommitment(scope, { operationId: "ordinary-done", dailyPlanItemId: "ordinary-item", taskId: "ordinary",
      itemExpectedVersion: 1, taskExpectedVersion: 1, action: "done" });
    expect(resolution).toMatchObject({ action: "done", sourceCarryId: null, sourceCarryVersion: null, requestFingerprint: null });
    const snapshot = await getWorkspaceSnapshot(scope, { start: "2026-09-27", end: "2026-09-27" });
    expect(snapshot.commitmentResolutions).toHaveLength(1);
    expect(snapshot.carriedCommitments).toEqual([]);
  });

  it("rejects recurring carry creation before any 0004 history or source state changes", async () => {
    await expect(resolveCommitment(scope, { operationId: "recurring-reschedule", dailyPlanItemId: "recurring-item", taskId: "recurring",
      itemExpectedVersion: 1, taskExpectedVersion: 1, occurrenceId: "occurrence", occurrenceExpectedVersion: 1,
      action: "reschedule", resolvedToLocalDate: "2026-09-28" })).rejects.toThrow("0005");
    expect((await database.query(`SELECT state, version FROM "taskOccurrences" WHERE id = 'occurrence'`)).rows[0]).toEqual({ state: "pending", version: 1 });
    expect((await database.query(`SELECT state, version FROM "dailyPlanItems" WHERE id = 'recurring-item'`)).rows[0]).toEqual({ state: "committed", version: 1 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "commitmentResolutions"`)).rows[0]).toEqual({ count: 1 });
  });
});
