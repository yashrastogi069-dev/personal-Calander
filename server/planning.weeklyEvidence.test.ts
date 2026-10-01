import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
import { updateWeeklyObjective } from "./planning";

const database = new PGlite();
const scope = { workspaceId: "owned", timezone: "UTC" };

async function objective() {
  return (await database.query('SELECT id, state, evidence, "completedAt", version FROM "weeklyObjectives" WHERE id = $1', ["objective-1"])).rows[0];
}

describe.sequential("weekly objective completion evidence", () => {
  beforeAll(async () => {
    await database.exec(readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8"));
    await database.exec(readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8"));
    await database.exec(readFileSync(new URL("../supabase/migrations/0004_phase4_product_model.sql", import.meta.url), "utf8"));
    mocks.getDb.mockResolvedValue(drizzle(database));
  }, 30_000);
  beforeEach(async () => {
    await database.exec(`TRUNCATE "weeklyObjectives", workspaces;
      INSERT INTO workspaces (id, timezone) VALUES ('owned', 'UTC');
      INSERT INTO "weeklyObjectives" (id, "workspaceId", "weekStartLocalDate", title, state, version)
        VALUES ('objective-1', 'owned', '2026-09-21', 'Ship the proposal', 'active', 3);`);
  });
  afterAll(() => database.close());

  it("refuses to mark an objective complete without recorded evidence", async () => {
    for (const evidence of [undefined, null, "   "]) {
      await expect(updateWeeklyObjective(scope, { id: "objective-1", expectedVersion: 3, patch: { state: "completed", evidence } }))
        .rejects.toThrow("evidence");
    }
    expect(await objective()).toMatchObject({ state: "active", evidence: null, completedAt: null, version: 3 });
  });

  it("records entered evidence and keeps it when a completed objective is edited", async () => {
    const completed = await updateWeeklyObjective(scope, { id: "objective-1", expectedVersion: 3, patch: { state: "completed", evidence: "  Proposal sent to client  " } });
    expect(completed).toMatchObject({ id: "objective-1", state: "completed", evidence: "Proposal sent to client", version: 4 });
    expect(completed.completedAt).toBeInstanceOf(Date);
    await expect(updateWeeklyObjective(scope, { id: "objective-1", expectedVersion: 4, patch: { evidence: null } })).rejects.toThrow("evidence");
    expect(await objective()).toMatchObject({ state: "completed", evidence: "Proposal sent to client", version: 4 });
  });
});
