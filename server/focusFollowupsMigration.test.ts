import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/0006_focus_session_followups.sql", import.meta.url), "utf8");
const previousSnapshot = JSON.parse(readFileSync(new URL("../supabase/migrations/meta/0005_snapshot.json", import.meta.url), "utf8"));
const snapshot = JSON.parse(readFileSync(new URL("../supabase/migrations/meta/0006_snapshot.json", import.meta.url), "utf8"));
const journal = JSON.parse(readFileSync(new URL("../supabase/migrations/meta/_journal.json", import.meta.url), "utf8"));

const originalColumns = `id, "workspaceId", "taskId", state, "startedAt", "lastResumedAt", "pausedAt", "endedAt", "targetMinutes", "activeSeconds", note, outcome, "adjustedEstimateMinutes", "createdAt", "updatedAt", version`;

describe("additive Focus follow-up migration", () => {
  it("contains only three nullable column additions, one table, and two indexes", () => {
    const statements = migration.split(/;\s*(?:--> statement-breakpoint)?/).map(part => part.trim()).filter(Boolean);
    expect(statements).toHaveLength(6);
    expect(statements.filter(statement => /^ALTER TABLE "focusSessions" ADD COLUMN "(?:habitId|nextStepAction|nextStepTaskId)" (?:varchar\(64\)|text)$/i.test(statement))).toHaveLength(3);
    expect(statements.filter(statement => /^CREATE TABLE "focusSessionSegments" \(/i.test(statement))).toHaveLength(1);
    expect(statements.filter(statement => /^CREATE INDEX "focus_segments_workspace_(?:session_time|date)_idx" ON "focusSessionSegments"/i.test(statement))).toHaveLength(2);
    expect(migration).not.toMatch(/\b(?:UPDATE|DELETE|DROP|TRUNCATE|RENAME|INSERT|BACKFILL)\b/i);
    expect(migration).not.toMatch(/ALTER TABLE[^;]*ADD COLUMN[^;]*(?:NOT NULL|DEFAULT|REFERENCES)/i);
    expect(snapshot.prevId).toBe(previousSnapshot.id);
    expect(journal.entries.at(-1)).toMatchObject({ idx: 6, tag: "0006_focus_session_followups" });
    expect(snapshot.tables["public.focusSessions"].columns).toHaveProperty("habitId");
    expect(snapshot.tables["public.focusSessions"].columns).toHaveProperty("nextStepAction");
    expect(snapshot.tables["public.focusSessions"].columns).toHaveProperty("nextStepTaskId");
    expect(snapshot.tables["public.focusSessionSegments"].indexes).toHaveProperty("focus_segments_workspace_session_time_idx");
    expect(snapshot.tables["public.focusSessionSegments"].indexes).toHaveProperty("focus_segments_workspace_date_idx");
  });

  it("preserves active and completed sessions and does not backfill segments", async () => {
    const database = new PGlite();
    try {
      await database.exec(baseline);
      await database.exec(`
        INSERT INTO workspaces (id) VALUES ('focus-workspace');
        INSERT INTO tasks (id, "workspaceId", title) VALUES
          ('task-active', 'focus-workspace', 'Active linked task'),
          ('task-completed', 'focus-workspace', 'Completed linked task');
        INSERT INTO "focusSessions" (id, "workspaceId", "taskId", state, "startedAt", "lastResumedAt", "pausedAt", "endedAt", "targetMinutes", "activeSeconds", note, outcome, "adjustedEstimateMinutes", "createdAt", "updatedAt", version) VALUES
          ('focus-active-preserved', 'focus-workspace', 'task-active', 'active', TIMESTAMP '2026-09-30 08:00:00', TIMESTAMP '2026-09-30 08:05:00', NULL, NULL, 45, 1307, 'Active note stays', 'continue', NULL, TIMESTAMP '2026-09-30 07:59:00', TIMESTAMP '2026-09-30 08:05:00', 8),
          ('focus-completed-preserved', 'focus-workspace', 'task-completed', 'completed', TIMESTAMP '2026-09-29 10:00:00', TIMESTAMP '2026-09-29 10:10:00', TIMESTAMP '2026-09-29 10:05:00', TIMESTAMP '2026-09-29 10:42:00', 35, 2211, 'Completed note stays', 'adjust_estimate', 50, TIMESTAMP '2026-09-29 09:59:00', TIMESTAMP '2026-09-29 10:42:00', 12);
      `);
      const before = (await database.query(`SELECT ${originalColumns} FROM "focusSessions" ORDER BY id`)).rows;
      expect(before).toMatchObject([
        { id: "focus-active-preserved", taskId: "task-active", state: "active", activeSeconds: 1307, note: "Active note stays", outcome: "continue", version: 8 },
        { id: "focus-completed-preserved", taskId: "task-completed", state: "completed", activeSeconds: 2211, note: "Completed note stays", outcome: "adjust_estimate", version: 12 },
      ]);

      await database.exec(migration);

      expect((await database.query(`SELECT ${originalColumns} FROM "focusSessions" ORDER BY id`)).rows).toEqual(before);
      expect((await database.query(`SELECT id, "habitId", "nextStepAction", "nextStepTaskId" FROM "focusSessions" ORDER BY id`)).rows).toEqual([
        { id: "focus-active-preserved", habitId: null, nextStepAction: null, nextStepTaskId: null },
        { id: "focus-completed-preserved", habitId: null, nextStepAction: null, nextStepTaskId: null },
      ]);
      expect((await database.query(`SELECT count(*)::int AS count FROM "focusSessionSegments"`)).rows).toEqual([{ count: 0 }]);
    } finally {
      await database.close();
    }
  }, 30_000);
});
