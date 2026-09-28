import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
const ownership = readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8");
const phase4 = readFileSync(new URL("../supabase/migrations/0004_phase4_product_model.sql", import.meta.url), "utf8");
const carryMigrationUrl = new URL("../supabase/migrations/0005_carried_commitments.sql", import.meta.url);
const priorSnapshot = JSON.parse(readFileSync(new URL("../supabase/migrations/meta/0004_snapshot.json", import.meta.url), "utf8"));
const carrySnapshot = JSON.parse(readFileSync(new URL("../supabase/migrations/meta/0005_snapshot.json", import.meta.url), "utf8"));
const journal = JSON.parse(readFileSync(new URL("../supabase/migrations/meta/_journal.json", import.meta.url), "utf8"));

describe("additive carried-commitment migration", () => {
  it("pins 0005 metadata to 0004 and describes the same new identity and links", () => {
    expect(carrySnapshot.prevId).toBe(priorSnapshot.id);
    expect(journal.entries.at(-1)).toMatchObject({ idx: 5, tag: "0005_carried_commitments" });
    expect(carrySnapshot.tables["public.carriedCommitments"].columns).toHaveProperty("createdByResolutionId");
    expect(carrySnapshot.tables["public.carriedCommitments"].foreignKeys).toHaveProperty("carried_commitments_resolution_fk");
    expect(carrySnapshot.tables["public.commitmentResolutions"].columns).toHaveProperty("sourceCarryId");
    expect(carrySnapshot.tables["public.commitmentResolutions"].columns).toHaveProperty("requestFingerprint");
  });
  it("adds distinct carry identity without changing existing planner or resolution records", async () => {
    expect(existsSync(fileURLToPath(carryMigrationUrl))).toBe(true);
    const database = new PGlite();
    try {
      await database.exec(baseline);
      await database.exec(ownership);
      await database.exec(phase4);
      await database.exec(`INSERT INTO workspaces (id) VALUES ('owned');
        INSERT INTO tasks (id, "workspaceId", title) VALUES ('task-1', 'owned', 'Keep this task');
        INSERT INTO "dailyPlans" (id, "workspaceId", "localDate") VALUES ('plan-1', 'owned', '2026-09-27');
        INSERT INTO "dailyPlanItems" (id, "workspaceId", "dailyPlanId", "taskId") VALUES ('item-1', 'owned', 'plan-1', 'task-1');
        INSERT INTO "commitmentResolutions" (id, "workspaceId", "operationId", "dailyPlanItemId", "taskId", action, "originalScope", timezone)
          VALUES ('resolution-1', 'owned', 'operation-1', 'item-1', 'task-1', 'reschedule', 'Keep this task', 'UTC');`);
      await database.exec(readFileSync(carryMigrationUrl, "utf8"));
      const foreignKeys = (await database.query(`SELECT conname FROM pg_constraint WHERE contype = 'f' AND conrelid IN ('"carriedCommitments"'::regclass, '"commitmentResolutions"'::regclass) ORDER BY conname`)).rows;
      expect(foreignKeys).toEqual([
        { conname: "carried_commitments_resolution_fk" },
        { conname: "carried_commitments_root_item_fk" },
        { conname: "carried_commitments_task_fk" },
        { conname: "commitment_resolutions_source_carry_fk" },
      ]);
      expect((await database.query(`SELECT id, "sourceCarryId", "requestFingerprint" FROM "commitmentResolutions"`)).rows)
        .toEqual([{ id: "resolution-1", sourceCarryId: null, requestFingerprint: null }]);
      expect((await database.query(`SELECT id, title FROM tasks`)).rows).toEqual([{ id: "task-1", title: "Keep this task" }]);
      await database.exec(`INSERT INTO "carriedCommitments" (id, "workspaceId", "taskId", "rootDailyPlanItemId", "createdByResolutionId", "targetLocalDate", scope)
        VALUES ('carry-1', 'owned', 'task-1', 'item-1', 'resolution-1', '2026-09-30', 'Keep this task');`);
      expect((await database.query(`SELECT id, state, version FROM "carriedCommitments"`)).rows).toEqual([{ id: "carry-1", state: "pending", version: 1 }]);
      await expect(database.exec(`INSERT INTO "carriedCommitments" (id, "workspaceId", "taskId", "rootDailyPlanItemId", "createdByResolutionId", "targetLocalDate", scope)
        VALUES ('carry-2', 'owned', 'task-1', 'item-1', 'resolution-1', '2026-09-30', 'Keep this task');`)).rejects.toThrow();
    } finally {
      await database.close();
    }
  }, 30_000);
});
