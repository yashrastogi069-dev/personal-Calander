import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import * as focus from "./focus";
import { getWorkspaceSnapshot, PlannerConflictError } from "./planning";

const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/0006_focus_session_followups.sql", import.meta.url), "utf8");
const scope = { workspaceId: "focus-workspace", timezone: "UTC" };
const range = { start: "2026-10-02", end: "2026-10-04" };
let database: PGlite;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  database = new PGlite();
  await database.exec(baseline);
  await database.exec(`ALTER TABLE workspaces ADD COLUMN "ownerUserId" integer;`);
}, 30_000);
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T23:59:50Z"));
  await database.exec(`TRUNCATE "focusSessions", tasks, habits, "habitCheckIns", workspaces;
    INSERT INTO workspaces (id, timezone) VALUES ('focus-workspace', 'UTC'), ('other-workspace', 'UTC');
    INSERT INTO habits (id, "workspaceId", name, color, schedule) VALUES ('habit-1', 'focus-workspace', 'Practice', '#285D52', '{}'), ('habit-other', 'other-workspace', 'Other', '#285D52', '{}');
    INSERT INTO habits (id, "workspaceId", name, color, schedule, "archivedAt") VALUES ('habit-archived', 'focus-workspace', 'Archived', '#285D52', '{}', now());
    INSERT INTO tasks (id, "workspaceId", title) VALUES ('task-1', 'focus-workspace', 'Work'), ('task-other', 'other-workspace', 'Other');
    INSERT INTO tasks (id, "workspaceId", title, "archivedAt") VALUES ('task-archived', 'focus-workspace', 'Archived', now());`);
  db = drizzle(database);
  vi.mocked(getDb).mockResolvedValue(db as never);
});
afterEach(() => vi.useRealTimers());
afterAll(async () => database.close());

async function enable() {
  await database.exec(migration);
}
async function disable() {
  await database.exec(`DROP TABLE "focusSessionSegments"; ALTER TABLE "focusSessions" DROP COLUMN "habitId", DROP COLUMN "nextStepAction", DROP COLUMN "nextStepTaskId";`);
}
async function finish(id: string, expectedVersion = 1) {
  return focus.finishFocusSession(scope, { id, expectedVersion, outcome: "continue" });
}

describe.sequential("durable Focus backend", () => {
  it("serializes concurrent starts so a workspace has only one open session", async () => {
    await enable();
    try {
      const results = await Promise.allSettled([
        focus.startFocusSession(scope, { habitId: "habit-1", targetMinutes: 25 }),
        focus.startFocusSession(scope, { habitId: "habit-1", targetMinutes: 25 }),
      ]);
      expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
      expect((await database.query(`SELECT count(*)::integer AS count FROM "focusSessions" WHERE state IN ('active','paused')`)).rows[0]).toEqual({ count: 1 });
    } finally { await disable(); }
  });

  it("rejects a wont-do task for start, task completion, and saved handoff", async () => {
    await enable();
    try {
      await database.exec(`UPDATE tasks SET outcome = 'wont_do' WHERE id = 'task-1'`);
      await expect(focus.startFocusSession(scope, { taskId: "task-1", targetMinutes: 25 })).rejects.toThrow(/task/);
      await database.exec(`UPDATE tasks SET outcome = 'none' WHERE id = 'task-1'`);
      const session = await focus.startFocusSession(scope, { taskId: "task-1", targetMinutes: 25 });
      await database.exec(`UPDATE tasks SET outcome = 'wont_do' WHERE id = 'task-1'`);
      await expect(focus.finishFocusSession(scope, { id: session.id, expectedVersion: 1, outcome: "done", taskExpectedVersion: 1 })).rejects.toThrow(/active task/);
      await finish(session.id);
      await expect(focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 2, nextStepAction: "task", nextStepTaskId: "task-1" })).rejects.toThrow(/active task/);
    } finally { await disable(); }
  });

  it("uses the stored workspace timezone even when the client supplies a different timezone", async () => {
    await enable();
    try {
      await database.exec(`UPDATE workspaces SET timezone = 'Asia/Kolkata' WHERE id = 'focus-workspace'`);
      vi.setSystemTime(new Date("2026-10-02T18:29:50Z"));
      const session = await focus.startFocusSession(scope, { habitId: "habit-1", targetMinutes: 25 });
      vi.setSystemTime(new Date("2026-10-02T18:30:10Z"));
      await finish(session.id);
      expect((await database.query(`SELECT "localDate", timezone, "activeSeconds" FROM "focusSessionSegments" ORDER BY "startedAt"`)).rows).toEqual([
        { localDate: "2026-10-02", timezone: "Asia/Kolkata", activeSeconds: 10 },
        { localDate: "2026-10-03", timezone: "Asia/Kolkata", activeSeconds: 10 },
      ]);
    } finally { await disable(); }
  });

  it("finishes a paused habit session without counting pause time or duplicating segments", async () => {
    await enable();
    try {
      const session = await focus.startFocusSession(scope, { habitId: "habit-1", targetMinutes: 25 });
      vi.setSystemTime(new Date("2026-10-03T00:00:10Z"));
      await focus.pauseFocusSession(scope, { id: session.id, expectedVersion: 1 });
      vi.setSystemTime(new Date("2026-10-04T00:00:10Z"));
      const stopped = await focus.finishFocusSession(scope, { id: session.id, expectedVersion: 2, outcome: "stopped" });
      expect(stopped).toMatchObject({ state: "abandoned", activeSeconds: 20, nextStepAction: null });
      expect((await database.query(`SELECT count(*)::integer AS count, sum("activeSeconds")::integer AS seconds FROM "focusSessionSegments"`)).rows[0]).toEqual({ count: 2, seconds: 20 });
      vi.setSystemTime(new Date("2026-10-04T00:00:20Z"));
      const handoff = await focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 3, nextStepAction: "none" });
      expect(handoff.nextStepAction).toBe("none");
      // The established PostgreSQL trigger owns updatedAt; assert it advances without assuming JS clock encoding.
      expect(handoff.updatedAt.getTime()).toBeGreaterThan(stopped.updatedAt.getTime());
    } finally { await disable(); }
  });

  it("rolls back the session and task if a segment insert fails", async () => {
    await enable();
    try {
      const session = await focus.startFocusSession(scope, { habitId: "habit-1", taskId: "task-1", targetMinutes: 25 });
      await database.exec(`ALTER TABLE "focusSessionSegments" ADD CONSTRAINT reject_segments CHECK ("activeSeconds" < 0)`);
      vi.setSystemTime(new Date("2026-10-03T00:00:10Z"));
      await expect(focus.finishFocusSession(scope, { id: session.id, expectedVersion: 1, taskExpectedVersion: 1, outcome: "done" })).rejects.toThrow();
      expect((await database.query(`SELECT state, version FROM "focusSessions" WHERE id = '${session.id}'`)).rows[0]).toEqual({ state: "active", version: 1 });
      expect((await database.query(`SELECT state, version FROM tasks WHERE id = 'task-1'`)).rows[0]).toEqual({ state: "not_started", version: 1 });
      expect((await database.query(`SELECT * FROM "focusSessionSegments"`)).rows).toEqual([]);
    } finally { await disable(); }
  });

  it.each(["pause", "finish", "followUp", "taskRace"])("rolls back every side effect on a %s CAS race", async action => {
    await enable();
    try {
      const session = await focus.startFocusSession(scope, { habitId: "habit-1", taskId: "task-1", targetMinutes: 25 });
      if (action === "followUp") await finish(session.id);
      vi.setSystemTime(new Date("2026-10-03T00:00:10Z"));
      const originalTransaction = db.transaction.bind(db);
      vi.spyOn(db, "transaction").mockImplementation(async (callback, config) => {
        await database.exec(action === "taskRace" ? `UPDATE tasks SET version = version + 1 WHERE id = 'task-1'` : `UPDATE "focusSessions" SET version = version + 1 WHERE id = '${session.id}'`);
        return originalTransaction(callback, config);
      });
      const request = action === "pause" ? focus.pauseFocusSession(scope, { id: session.id, expectedVersion: 1 })
        : action === "followUp" ? focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 2, nextStepAction: "task", nextStepTaskId: "task-1" })
        : focus.finishFocusSession(scope, { id: session.id, expectedVersion: 1, taskExpectedVersion: 1, outcome: "done" });
      await expect(request).rejects.toBeInstanceOf(PlannerConflictError);
      expect((await database.query(`SELECT state FROM tasks WHERE id = 'task-1'`)).rows[0]).toEqual({ state: "not_started" });
      expect((await database.query(`SELECT state, "nextStepAction" FROM "focusSessions" WHERE id = '${session.id}'`)).rows[0]).toEqual({ state: action === "followUp" ? "completed" : "active", nextStepAction: null });
      expect((await database.query(`SELECT * FROM "focusSessionSegments"`)).rows).toEqual([]);
    } finally { await disable(); }
  });

  it("treats only undefined new Focus columns as unavailable", async () => {
    for (const failure of [
      { code: "08006", message: 'connection failed reading "habitId"' },
      { code: "42501", message: 'permission denied reading "habitId"' },
      { code: "42703", message: 'column "unrelated" does not exist' },
    ]) {
      const execute = vi.spyOn(db, "execute").mockRejectedValueOnce(failure);
      await expect(focus.hasFocusFollowupColumns(db as never)).rejects.toEqual(failure);
      execute.mockRestore();
    }
    await expect(focus.hasFocusFollowupColumns(db as never)).resolves.toBe(false);
  });

  it("keeps pre-0006 start/pause/resume/finish and snapshot working", async () => {
    const session = await focus.startFocusSession(scope, { targetMinutes: 25, taskId: "task-1" });
    vi.setSystemTime(new Date("2026-10-03T00:00:10Z"));
    expect(await focus.pauseFocusSession(scope, { id: session.id, expectedVersion: 1 })).toMatchObject({ state: "paused", activeSeconds: 20, version: 2 });
    vi.setSystemTime(new Date("2026-10-03T01:00:00Z"));
    await focus.resumeFocusSession(scope, { id: session.id, expectedVersion: 2 });
    vi.setSystemTime(new Date("2026-10-03T01:00:10Z"));
    expect(await finish(session.id, 3)).toMatchObject({ activeSeconds: 30, version: 4 });
    expect(await getWorkspaceSnapshot(scope, range)).toMatchObject({ focusHabitAttributionAvailable: false, focusHabitAttribution: [], focusSessions: [expect.objectContaining({ id: session.id })] });
    await expect(focus.startFocusSession(scope, { habitId: "habit-1", targetMinutes: 25 })).rejects.toThrow(/available after/);
    await expect(focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 4, nextStepAction: "none" })).rejects.toThrow(/available after/);
  });

  it("validates explicit habit ownership/archive status and never creates a check-in", async () => {
    await enable();
    try {
      for (const habitId of ["habit-other", "habit-archived", "missing"]) await expect(focus.startFocusSession(scope, { habitId, targetMinutes: 25 })).rejects.toThrow(/habit/);
      const session = await focus.startFocusSession(scope, { habitId: "habit-1", taskId: "task-1", targetMinutes: 25 });
      expect(session).toMatchObject({ habitId: "habit-1", taskId: "task-1", nextStepAction: null });
      expect((await database.query(`SELECT * FROM "habitCheckIns"`)).rows).toEqual([]);
      expect((await database.query(`SELECT * FROM "focusSessionSegments"`)).rows).toEqual([]);
    } finally { await disable(); }
  });

  it("persists split active intervals atomically, excludes paused time, and snapshots only saved scoped attribution", async () => {
    await enable();
    try {
      const session = await focus.startFocusSession(scope, { habitId: "habit-1", targetMinutes: 25 });
      vi.setSystemTime(new Date("2026-10-03T00:00:10Z"));
      await focus.pauseFocusSession(scope, { id: session.id, expectedVersion: 1 });
      vi.setSystemTime(new Date("2026-10-03T01:00:00Z"));
      await focus.resumeFocusSession(scope, { id: session.id, expectedVersion: 2 });
      vi.setSystemTime(new Date("2026-10-03T01:00:20Z"));
      expect(await finish(session.id, 3)).toMatchObject({ activeSeconds: 40 });
      expect((await database.query(`SELECT "localDate", timezone, "activeSeconds", "workspaceId", "focusSessionId" FROM "focusSessionSegments" ORDER BY "startedAt"`)).rows).toEqual([
        { localDate: "2026-10-02", timezone: "UTC", activeSeconds: 10, workspaceId: scope.workspaceId, focusSessionId: session.id },
        { localDate: "2026-10-03", timezone: "UTC", activeSeconds: 10, workspaceId: scope.workspaceId, focusSessionId: session.id },
        { localDate: "2026-10-03", timezone: "UTC", activeSeconds: 20, workspaceId: scope.workspaceId, focusSessionId: session.id },
      ]);
      const taskOnly = await focus.startFocusSession(scope, { taskId: "task-1", targetMinutes: 25 });
      vi.setSystemTime(new Date("2026-10-03T01:00:30Z"));
      await finish(taskOnly.id);
      const unlinked = await focus.startFocusSession(scope, { targetMinutes: 25 });
      await finish(unlinked.id);
      await database.exec(`INSERT INTO "focusSessionSegments" (id,"workspaceId","focusSessionId","startedAt","endedAt","localDate",timezone,"activeSeconds") VALUES
        ('bad-unlinked', 'focus-workspace', '${unlinked.id}', now(), now(), '2026-10-03', 'UTC', 999),
        ('bad-other', 'other-workspace', '${session.id}', now(), now(), '2026-10-03', 'UTC', 999);`);
      expect(await getWorkspaceSnapshot(scope, range)).toMatchObject({ focusHabitAttributionAvailable: true, focusHabitAttribution: [
        { habitId: "habit-1", localDate: "2026-10-02", timezone: "UTC", activeSeconds: 10 },
        { habitId: "habit-1", localDate: "2026-10-03", timezone: "UTC", activeSeconds: 30 },
      ] });
    } finally { await disable(); }
  });

  it("accepts only explicit finished-session handoffs and preserves none on reload", async () => {
    await enable();
    try {
      const session = await focus.startFocusSession(scope, { targetMinutes: 25 });
      await expect(focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 1, nextStepAction: "none" })).rejects.toThrow(/finished/);
      await finish(session.id);
      for (const nextStepTaskId of [undefined, "task-other", "task-archived", "missing"]) await expect(focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 2, nextStepAction: "task", nextStepTaskId })).rejects.toThrow(/task/);
      for (const nextStepAction of ["plan", "none"] as const) await expect(focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 2, nextStepAction, nextStepTaskId: "task-1" })).rejects.toThrow(/task/);
      await expect(focus.setFocusFollowUp({ ...scope, workspaceId: "other-workspace" }, { id: session.id, expectedVersion: 2, nextStepAction: "none" })).rejects.toThrow(/not found/);
      expect(await focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 2, nextStepAction: "task", nextStepTaskId: "task-1" })).toMatchObject({ version: 3, nextStepTaskId: "task-1" });
      await expect(focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 2, nextStepAction: "none" })).rejects.toBeInstanceOf(PlannerConflictError);
      expect(await focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 3, nextStepAction: "plan" })).toMatchObject({ version: 4, nextStepTaskId: null });
      await focus.setFocusFollowUp(scope, { id: session.id, expectedVersion: 4, nextStepAction: "none" });
      expect((await getWorkspaceSnapshot(scope, range)).focusSessions[0]).toMatchObject({ nextStepAction: "none", nextStepTaskId: null, version: 5 });
    } finally { await disable(); }
  });
});
