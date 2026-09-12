import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("adds synchronization receipts and conflicts without changing planner records", async () => {
  const db = new PGlite();
  try {
    const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
    const syncMigration = readFileSync(new URL("../supabase/migrations/0003_good_lady_deathstrike.sql", import.meta.url), "utf8");
    await db.exec(baseline);
    await db.exec(`INSERT INTO workspaces (id) VALUES ('workspace-preserved');
      INSERT INTO tasks (id, "workspaceId", title) VALUES ('task-preserved', 'workspace-preserved', 'Keep this task');`);
    await db.exec(syncMigration);

    expect((await db.query('SELECT id, title FROM tasks')).rows).toEqual([{ id: "task-preserved", title: "Keep this task" }]);
    expect((await db.query(`SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('syncConflicts', 'syncOperationReceipts') ORDER BY table_name`)).rows)
      .toEqual([{ table_name: "syncConflicts" }, { table_name: "syncOperationReceipts" }]);
    expect((await db.query(`SELECT relname, relrowsecurity FROM pg_class
      WHERE relname IN ('syncConflicts', 'syncOperationReceipts') ORDER BY relname`)).rows)
      .toEqual([{ relname: "syncConflicts", relrowsecurity: true }, { relname: "syncOperationReceipts", relrowsecurity: true }]);
    await db.exec(`INSERT INTO "syncOperationReceipts" (id, "workspaceId", "operationId", entity, "entityId", kind, outcome, result)
      VALUES ('receipt-1', 'workspace-preserved', 'operation-1', 'task', 'task-preserved', 'update', 'applied', '{}')`);
    await expect(db.exec(`INSERT INTO "syncOperationReceipts" (id, "workspaceId", "operationId", entity, "entityId", kind, outcome, result)
      VALUES ('receipt-2', 'workspace-preserved', 'operation-1', 'task', 'task-preserved', 'update', 'applied', '{}')`)).rejects.toThrow(/unique/i);
  } finally {
    await db.close();
  }
}, 30_000);
