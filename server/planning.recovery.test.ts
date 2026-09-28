import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
import { getWorkspaceSnapshot, materializeTaskOccurrences, resolveCommitment, resolveDailyPlanItem, updateDailyPlanItem } from "./planning";
import { recoveryProjection } from "../shared/recovery";

const database = new PGlite();
const scope = { workspaceId: "owned", timezone: "Asia/Calcutta" };
const base = { operationId: "operation-1", dailyPlanItemId: "item-1", taskId: "task-1", itemExpectedVersion: 2, taskExpectedVersion: 4 };

async function rows(table: string, id: string) {
  return (await database.query(`SELECT * FROM "${table}" WHERE id = $1`, [id])).rows;
}

async function seed(options: { recurring?: boolean } = {}) {
  await database.query(`INSERT INTO workspaces (id, timezone) VALUES ('owned', 'Asia/Calcutta'), ('other', 'UTC')`);
  await database.query(`INSERT INTO tasks (id, "workspaceId", title, state, "dueLocalDate", "scheduledLocalDate", "plannedStartAt", "plannedEndAt", "recurrenceRule", version)
    VALUES ('task-1', 'owned', 'Write proposal', 'in_progress', '2026-10-03', '2026-09-27', '2026-09-27 09:00', '2026-09-27 10:00', $1, 4),
           ('foreign-task', 'other', 'Private task', 'not_started', null, null, null, null, null, 1)`, [options.recurring ? JSON.stringify({ frequency: "weekly", interval: 1, weekdays: [0] }) : null]);
  await database.query(`INSERT INTO "dailyPlans" (id, "workspaceId", "localDate", state) VALUES ('plan-1', 'owned', '2026-09-27', 'active'), ('foreign-plan', 'other', '2026-09-27', 'active')`);
  await database.query(`INSERT INTO "dailyPlanItems" (id, "workspaceId", "dailyPlanId", "taskId", state, version)
    VALUES ('item-1', 'owned', 'plan-1', 'task-1', 'committed', 2), ('foreign-item', 'other', 'foreign-plan', 'foreign-task', 'committed', 1)`);
  if (options.recurring) await database.query(`INSERT INTO "taskOccurrences" (id, "workspaceId", "taskId", "localDate", state, version)
    VALUES ('occ-1', 'owned', 'task-1', '2026-09-27', 'pending', 3), ('occ-2', 'owned', 'task-1', '2026-09-28', 'pending', 1)`);
}

describe.sequential("transactional Strict recovery", () => {
  beforeAll(async () => {
    await database.exec(readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8"));
    await database.exec(readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8"));
    await database.exec(readFileSync(new URL("../supabase/migrations/0004_phase4_product_model.sql", import.meta.url), "utf8"));
    await database.exec(readFileSync(new URL("../supabase/migrations/0005_carried_commitments.sql", import.meta.url), "utf8"));
    mocks.getDb.mockResolvedValue(drizzle(database));
  }, 30_000);
  beforeEach(async () => {
    await database.exec(`DROP TRIGGER IF EXISTS reject_resolution ON "commitmentResolutions";
      DROP FUNCTION IF EXISTS reject_resolution_insert();
      DROP TRIGGER IF EXISTS reject_successor ON "carriedCommitments";
      DROP FUNCTION IF EXISTS reject_successor_insert();
      TRUNCATE "carriedCommitments", "commitmentResolutions", "taskDependencies", "taskOccurrences", "dailyPlanItems", "dailyPlans", tasks, workspaces;`);
  });
  afterAll(() => database.close());

  it.each([
    ["done", {}, "done", "completed", "2026-09-27"],
    ["reschedule", { resolvedToLocalDate: "2026-09-30" }, "rescheduled", "in_progress", "2026-09-30"],
    ["reduce", { revisedScope: "Write outline", resolvedToLocalDate: "2026-09-30" }, "deferred", "in_progress", "2026-09-30"],
    ["pause", { returnLocalDate: "2026-10-01" }, "deferred", "in_progress", null],
    ["abandon", {}, "wont_do", "archived", "2026-09-27"],
  ] as const)("commits %s as one historical decision", async (action, detail, itemState, taskState, plannedDay) => {
    await seed();
    const resolution = await resolveCommitment(scope, { ...base, action, ...detail });
    expect(resolution).toMatchObject({ workspaceId: "owned", operationId: "operation-1", dailyPlanItemId: "item-1", taskId: "task-1", action, originalScope: "Write proposal", timezone: "Asia/Calcutta" });
    const item = (await rows("dailyPlanItems", "item-1"))[0] as Record<string, unknown>;
    const task = (await rows("tasks", "task-1"))[0] as Record<string, unknown>;
    expect(item).toMatchObject({ state: itemState, version: 3 });
    expect(task).toMatchObject({ state: taskState, version: 5, dueLocalDate: "2026-10-03", scheduledLocalDate: plannedDay });
    expect((await rows("commitmentResolutions", resolution.id))).toHaveLength(1);
    if (action === "reduce") expect(task.title).toBe("Write outline");
    if (action === "pause") expect(resolution.returnLocalDate).toBe("2026-10-01");
    if (action === "abandon") expect(task).toMatchObject({ outcome: "wont_do", completedAt: null });
  });

  it("returns the existing resolution on an operation retry without another write", async () => {
    await seed();
    const first = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-30" });
    const retried = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-30" });
    expect(retried).toEqual(first);
    expect((await rows("tasks", "task-1"))[0]).toMatchObject({ version: 5 });
    expect((await rows("dailyPlanItems", "item-1"))[0]).toMatchObject({ version: 3 });
    expect((await database.query('SELECT count(*)::int AS count FROM "commitmentResolutions"')).rows[0]).toEqual({ count: 1 });
  });

  it("rejects reuse of an operation ID for a different decision", async () => {
    await seed();
    await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-30" });
    await expect(resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-10-01" })).rejects.toThrow("operation ID");
    await expect(resolveCommitment(scope, { ...base, action: "abandon" })).rejects.toThrow("operation ID");
    await expect(resolveCommitment(scope, { ...base, itemExpectedVersion: 3, action: "reschedule", resolvedToLocalDate: "2026-09-30" })).rejects.toThrow("operation ID");
    expect((await rows("tasks", "task-1"))[0]).toMatchObject({ scheduledLocalDate: "2026-09-30", state: "in_progress", version: 5 });
  });

  it("rejects owned-reference mismatches and stale versions without writing history", async () => {
    await seed();
    for (const input of [
      { ...base, dailyPlanItemId: "foreign-item", action: "done" as const },
      { ...base, taskId: "foreign-task", action: "done" as const },
      { ...base, itemExpectedVersion: 1, action: "done" as const },
      { ...base, taskExpectedVersion: 3, action: "done" as const },
    ]) await expect(resolveCommitment(scope, input)).rejects.toThrow();
    expect((await rows("tasks", "task-1"))[0]).toMatchObject({ version: 4 });
    expect((await rows("dailyPlanItems", "item-1"))[0]).toMatchObject({ version: 2, state: "committed" });
    expect((await database.query('SELECT count(*)::int AS count FROM "commitmentResolutions"')).rows[0]).toEqual({ count: 0 });
  });

  it("reschedules only the named recurring occurrence and preserves the parent series", async () => {
    await seed({ recurring: true });
    const resolution = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-30", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    expect(resolution.occurrenceId).toBe("occ-1");
    expect((await rows("taskOccurrences", "occ-1"))[0]).toMatchObject({ state: "rescheduled", rescheduledToLocalDate: "2026-09-30", version: 4 });
    expect((await rows("taskOccurrences", "occ-2"))[0]).toMatchObject({ state: "pending", version: 1 });
    expect((await rows("tasks", "task-1"))[0]).toMatchObject({ title: "Write proposal", scheduledLocalDate: "2026-09-27", version: 4 });
    expect((await database.query(`SELECT * FROM "taskOccurrences" WHERE "taskId" = 'task-1' AND "localDate" = '2026-09-30'`)).rows).toEqual([]);
    expect((await database.query(`SELECT * FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [resolution.id])).rows)
      .toMatchObject([{ taskId: "task-1", rootDailyPlanItemId: "item-1", targetLocalDate: "2026-09-30", scope: "Write proposal", state: "pending" }]);
  });

  it("keeps a carried obligation distinct from a natural occurrence on the same day", async () => {
    await seed({ recurring: true });
    await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "taskOccurrences" WHERE "taskId" = 'task-1' AND "localDate" = '2026-09-28'`)).rows[0]).toEqual({ count: 1 });
    expect((await rows("taskOccurrences", "occ-2"))[0]).toMatchObject({ state: "pending", version: 1 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "carriedCommitments" WHERE "taskId" = 'task-1' AND "targetLocalDate" = '2026-09-28'`)).rows[0]).toEqual({ count: 1 });
  });

  it("allows a carry on an unmaterialized natural recurrence date", async () => {
    await seed({ recurring: true });
    await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-10-04", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "taskOccurrences" WHERE "taskId" = 'task-1' AND "localDate" = '2026-10-04'`)).rows[0]).toEqual({ count: 0 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "carriedCommitments" WHERE "taskId" = 'task-1' AND "targetLocalDate" = '2026-10-04'`)).rows[0]).toEqual({ count: 1 });
  });

  it("keeps two carried obligations for the same task and target date distinct", async () => {
    await seed({ recurring: true });
    await database.exec(`INSERT INTO "dailyPlans" (id, "workspaceId", "localDate", state) VALUES ('plan-2', 'owned', '2026-09-28', 'active');
      INSERT INTO "dailyPlanItems" (id, "workspaceId", "dailyPlanId", "taskId", state, version) VALUES ('item-2', 'owned', 'plan-2', 'task-1', 'committed', 1);`);
    await resolveCommitment(scope, { ...base, action: "reduce", revisedScope: "Write outline", resolvedToLocalDate: "2026-09-30", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    await resolveCommitment(scope, { operationId: "operation-2", dailyPlanItemId: "item-2", taskId: "task-1", itemExpectedVersion: 1, taskExpectedVersion: 4,
      action: "reduce", revisedScope: "Write summary", resolvedToLocalDate: "2026-09-30", occurrenceId: "occ-2", occurrenceExpectedVersion: 1 });
    expect((await database.query(`SELECT "scope" FROM "carriedCommitments" WHERE "targetLocalDate" = '2026-09-30' ORDER BY "scope"`)).rows)
      .toEqual([{ scope: "Write outline" }, { scope: "Write summary" }]);
  });

  it("can reschedule a daily recurring occurrence onto the next natural day", async () => {
    await seed({ recurring: true });
    await database.query(`UPDATE tasks SET "recurrenceRule" = $1 WHERE id = 'task-1'`, [JSON.stringify({ frequency: "daily", interval: 1 })]);
    await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    expect((await rows("taskOccurrences", "occ-2"))[0]).toMatchObject({ state: "pending" });
    expect((await database.query(`SELECT "targetLocalDate", state FROM "carriedCommitments"`)).rows)
      .toEqual([{ targetLocalDate: "2026-09-28", state: "pending" }]);
  });

  it("resolves one carry and creates a reduced successor without touching its root or series", async () => {
    await seed({ recurring: true });
    const first = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    const carry = (await database.query(`SELECT * FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [first.id])).rows[0] as { id: string };
    const input = { operationId: "operation-2", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: carry.id, carryExpectedVersion: 1, taskExpectedVersion: 4,
      action: "reduce" as const, revisedScope: "Write outline", resolvedToLocalDate: "2026-09-29" };
    const second = await resolveCommitment(scope, input);
    expect(second).toMatchObject({ sourceCarryId: carry.id, occurrenceId: null, originalScope: "Write proposal", revisedScope: "Write outline" });
    expect(await resolveCommitment(scope, input)).toEqual(second);
    expect((await rows("carriedCommitments", carry.id))[0]).toMatchObject({ state: "reduced", version: 2 });
    expect((await database.query(`SELECT * FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [second.id])).rows)
      .toMatchObject([{ rootDailyPlanItemId: "item-1", targetLocalDate: "2026-09-29", scope: "Write outline", state: "pending" }]);
    expect((await rows("taskOccurrences", "occ-2"))[0]).toMatchObject({ state: "pending", version: 1 });
    expect((await rows("dailyPlanItems", "item-1"))[0]).toMatchObject({ state: "rescheduled", version: 3 });
    expect((await rows("tasks", "task-1"))[0]).toMatchObject({ title: "Write proposal", version: 4 });
    await expect(resolveCommitment(scope, { ...input, revisedScope: "Another scope" })).rejects.toThrow("operation ID");
    await expect(resolveCommitment(scope, { ...input, carryExpectedVersion: 2 })).rejects.toThrow("operation ID");
  });

  it.each([
    ["done", {}, "done", false],
    ["reschedule", { resolvedToLocalDate: "2026-09-29" }, "rescheduled", true],
    ["reduce", { resolvedToLocalDate: "2026-09-29", revisedScope: "Smaller draft" }, "reduced", true],
    ["pause", { returnLocalDate: "2026-10-01" }, "paused", false],
    ["abandon", {}, "abandoned", false],
  ] as const)("applies %s to only its carried identity", async (action, detail, state, successor) => {
    await seed({ recurring: true });
    const first = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    const carry = (await database.query(`SELECT id FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [first.id])).rows[0] as { id: string };
    const resolution = await resolveCommitment(scope, { operationId: "operation-2", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: carry.id,
      carryExpectedVersion: 1, taskExpectedVersion: 4, action, ...detail });
    expect(resolution).toMatchObject({ sourceCarryId: carry.id, action });
    expect((await rows("carriedCommitments", carry.id))[0]).toMatchObject({ state, version: 2 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [resolution.id])).rows[0])
      .toEqual({ count: successor ? 1 : 0 });
    expect((await rows("tasks", "task-1"))[0]).toMatchObject({ title: "Write proposal", state: "in_progress", version: 4 });
    expect((await rows("taskOccurrences", "occ-1"))[0]).toMatchObject({ state: "rescheduled", version: 4 });
    expect((await rows("taskOccurrences", "occ-2"))[0]).toMatchObject({ state: "pending", version: 1 });
    expect((await rows("dailyPlanItems", "item-1"))[0]).toMatchObject({ state: "rescheduled", version: 3 });
  });

  it("rejects stale or mismatched carry references without mutating source history", async () => {
    await seed({ recurring: true });
    const first = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    const carry = (await database.query(`SELECT id FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [first.id])).rows[0] as { id: string };
    for (const input of [
      { sourceCarryId: carry.id, carryExpectedVersion: 2, dailyPlanItemId: "item-1", taskId: "task-1", taskExpectedVersion: 4 },
      { sourceCarryId: carry.id, carryExpectedVersion: 1, dailyPlanItemId: "foreign-item", taskId: "task-1", taskExpectedVersion: 4 },
      { sourceCarryId: carry.id, carryExpectedVersion: 1, dailyPlanItemId: "item-1", taskId: "foreign-task", taskExpectedVersion: 1 },
    ]) await expect(resolveCommitment(scope, { operationId: "operation-2", action: "done", ...input })).rejects.toThrow();
    expect((await rows("carriedCommitments", carry.id))[0]).toMatchObject({ state: "pending", version: 1 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "commitmentResolutions"`)).rows[0]).toEqual({ count: 1 });
  });

  it.each(["completed", "archived"] as const)("rejects carry Done against a %s parent task before writing history", async state => {
    await seed({ recurring: true });
    const first = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    const carry = (await database.query(`SELECT id FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [first.id])).rows[0] as { id: string };
    await database.query(`UPDATE tasks SET state = $1, version = 5 WHERE id = 'task-1'`, [state]);
    await expect(resolveCommitment(scope, { operationId: "operation-2", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: carry.id,
      carryExpectedVersion: 1, taskExpectedVersion: 5, action: "done" })).rejects.toThrow("final outcome");
    expect((await rows("carriedCommitments", carry.id))[0]).toMatchObject({ state: "pending", version: 1 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "commitmentResolutions"`)).rows[0]).toEqual({ count: 1 });
  });

  it("rejects carry Done while a hard prerequisite remains incomplete", async () => {
    await seed({ recurring: true });
    const first = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    const carry = (await database.query(`SELECT id FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [first.id])).rows[0] as { id: string };
    await database.exec(`INSERT INTO tasks (id, "workspaceId", title, state) VALUES ('prereq', 'owned', 'Do first', 'not_started');
      INSERT INTO "taskDependencies" (id, "workspaceId", "taskId", "dependsOnTaskId", "dependencyType") VALUES ('edge-1', 'owned', 'task-1', 'prereq', 'hard');`);
    await expect(resolveCommitment(scope, { operationId: "operation-2", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: carry.id,
      carryExpectedVersion: 1, taskExpectedVersion: 4, action: "done" })).rejects.toThrow("hard prerequisite");
    expect((await rows("carriedCommitments", carry.id))[0]).toMatchObject({ state: "pending", version: 1 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "commitmentResolutions"`)).rows[0]).toEqual({ count: 1 });
  });

  it("lets a paused carry be decided manually before its return date without reopening root history", async () => {
    await seed({ recurring: true });
    const first = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    const carry = (await database.query(`SELECT id FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [first.id])).rows[0] as { id: string };
    const paused = await resolveCommitment(scope, { operationId: "operation-2", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: carry.id,
      carryExpectedVersion: 1, taskExpectedVersion: 4, action: "pause", returnLocalDate: "2099-01-01" });
    expect(paused).toMatchObject({ sourceCarryVersion: 1 });
    const decided = await resolveCommitment(scope, { operationId: "operation-3", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: carry.id,
      carryExpectedVersion: 2, taskExpectedVersion: 4, action: "done" });
    expect(decided).toMatchObject({ sourceCarryVersion: 2, action: "done" });
    expect((await rows("carriedCommitments", carry.id))[0]).toMatchObject({ state: "done", version: 3 });
    expect((await rows("taskOccurrences", "occ-1"))[0]).toMatchObject({ state: "rescheduled", version: 4 });
    expect((await rows("dailyPlanItems", "item-1"))[0]).toMatchObject({ state: "rescheduled", version: 3 });
    expect((await rows("tasks", "task-1"))[0]).toMatchObject({ version: 4, state: "in_progress" });
  });

  it("retains repeat Pause history while the newest carry version controls resurfacing", async () => {
    await seed({ recurring: true });
    const first = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    const carry = (await database.query(`SELECT id FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [first.id])).rows[0] as { id: string };
    const pause1 = await resolveCommitment(scope, { operationId: "operation-2", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: carry.id,
      carryExpectedVersion: 1, taskExpectedVersion: 4, action: "pause", returnLocalDate: "2026-10-01" });
    const pause2 = await resolveCommitment(scope, { operationId: "operation-3", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: carry.id,
      carryExpectedVersion: 2, taskExpectedVersion: 4, action: "pause", returnLocalDate: "2026-11-01" });
    expect([pause1.sourceCarryVersion, pause2.sourceCarryVersion]).toEqual([1, 2]);
    const snapshot = await getWorkspaceSnapshot(scope, { start: "2026-10-02", end: "2026-10-02" });
    const input = { plans: snapshot.dailyPlans, items: snapshot.dailyPlanItems, resolutions: snapshot.commitmentResolutions,
      carries: snapshot.carriedCommitments, tasks: snapshot.tasks };
    expect(recoveryProjection({ ...input, todayLocalDate: "2026-10-02" }).returning).toEqual([]);
    expect(recoveryProjection({ ...input, todayLocalDate: "2026-11-01" }).returning).toEqual([
      { resolutionId: pause2.id, carryId: carry.id, itemId: "item-1", taskId: "task-1", returnLocalDate: "2026-11-01" },
    ]);
    expect((await rows("carriedCommitments", carry.id))[0]).toMatchObject({ state: "paused", version: 3 });
  });

  it("rolls back carry state and resolution when successor insertion fails", async () => {
    await seed({ recurring: true });
    const first = await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    const carry = (await database.query(`SELECT id FROM "carriedCommitments" WHERE "createdByResolutionId" = $1`, [first.id])).rows[0] as { id: string };
    await database.exec(`CREATE FUNCTION reject_successor_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced successor failure'; END $$;
      CREATE TRIGGER reject_successor BEFORE INSERT ON "carriedCommitments" FOR EACH ROW EXECUTE FUNCTION reject_successor_insert();`);
    await expect(resolveCommitment(scope, { operationId: "operation-2", dailyPlanItemId: "item-1", taskId: "task-1", sourceCarryId: carry.id,
      carryExpectedVersion: 1, taskExpectedVersion: 4, action: "reduce", revisedScope: "Smaller draft", resolvedToLocalDate: "2026-09-29" })).rejects.toThrow('Failed query: insert into "carriedCommitments"');
    expect((await rows("carriedCommitments", carry.id))[0]).toMatchObject({ state: "pending", version: 1 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "commitmentResolutions"`)).rows[0]).toEqual({ count: 1 });
    await database.exec(`DROP TRIGGER reject_successor ON "carriedCommitments"; DROP FUNCTION reject_successor_insert();`);
  });

  it("does not erase a resolved natural occurrence when carrying to its date", async () => {
    await seed({ recurring: true });
    await database.query(`UPDATE "taskOccurrences" SET state = 'completed', version = 2 WHERE id = 'occ-2'`);
    await resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-28", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    expect((await rows("taskOccurrences", "occ-2"))[0]).toMatchObject({ state: "completed", version: 2 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "carriedCommitments" WHERE "targetLocalDate" = '2026-09-28'`)).rows[0]).toEqual({ count: 1 });
  });

  it("rejects rescheduling a recurring occurrence back onto its original day", async () => {
    await seed({ recurring: true });
    await expect(resolveCommitment(scope, { ...base, action: "reschedule", resolvedToLocalDate: "2026-09-27", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 })).rejects.toThrow("different Plan for date");
    expect((await rows("taskOccurrences", "occ-1"))[0]).toMatchObject({ state: "pending", version: 3 });
  });

  it("keeps a reduced off-cadence occurrence visible with its revised scope in the snapshot", async () => {
    await seed({ recurring: true });
    await resolveCommitment(scope, { ...base, action: "reduce", revisedScope: "Write outline", resolvedToLocalDate: "2026-09-30", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    const occurrences = await materializeTaskOccurrences(scope, { start: "2026-09-30", end: "2026-09-30" });
    expect(occurrences).toEqual([]);
    const snapshot = await getWorkspaceSnapshot(scope, { start: "2026-09-30", end: "2026-09-30" });
    expect(snapshot.commitmentResolutions).toMatchObject([{ taskId: "task-1", action: "reduce", revisedScope: "Write outline", resolvedToLocalDate: "2026-09-30" }]);
    expect(recoveryProjection({ todayLocalDate: "2026-09-30", plans: snapshot.dailyPlans, items: snapshot.dailyPlanItems, occurrences: snapshot.taskOccurrences, resolutions: snapshot.commitmentResolutions, carries: snapshot.carriedCommitments }).nextCommitments)
      .toMatchObject([{ taskId: "task-1", localDate: "2026-09-30", scope: "Write outline" }]);
  });

  it("records supported legacy outcomes as immutable recovery history after migration", async () => {
    await seed();
    await resolveDailyPlanItem(scope, { id: "item-1", expectedVersion: 2, taskExpectedVersion: 4, state: "done" });
    expect((await database.query(`SELECT action, "dailyPlanItemId", "taskId" FROM "commitmentResolutions"`)).rows).toEqual([{ action: "done", dailyPlanItemId: "item-1", taskId: "task-1" }]);
  });

  it("blocks legacy deferral and updateItem outcome shortcuts after migration", async () => {
    await seed();
    await expect(resolveDailyPlanItem(scope, { id: "item-1", expectedVersion: 2, taskExpectedVersion: 4, state: "deferred" })).rejects.toThrow("Recovery");
    await expect(updateDailyPlanItem(scope, { id: "item-1", expectedVersion: 2, state: "done" })).rejects.toThrow("Recovery");
    await expect(updateDailyPlanItem(scope, { id: "item-1", expectedVersion: 2, resolvedToLocalDate: "2026-09-30" })).rejects.toThrow("Recovery");
    expect((await rows("dailyPlanItems", "item-1"))[0]).toMatchObject({ state: "committed", version: 2 });
    expect((await database.query('SELECT count(*)::int AS count FROM "commitmentResolutions"')).rows[0]).toEqual({ count: 0 });
  });

  it.each([
    ["done", {}, "completed", null, "done"],
    ["reduce", { revisedScope: "Write outline", resolvedToLocalDate: "2026-09-30" }, "rescheduled", "2026-09-30", "deferred"],
    ["pause", { returnLocalDate: "2026-10-01" }, "rescheduled", "2026-10-01", "deferred"],
    ["abandon", {}, "skipped", null, "wont_do"],
  ] as const)("resolves %s for one occurrence without completing or archiving the series", async (action, detail, occurrenceState, nextDate, itemState) => {
    await seed({ recurring: true });
    const resolution = await resolveCommitment(scope, { ...base, action, ...detail, occurrenceId: "occ-1", occurrenceExpectedVersion: 3 });
    expect(resolution).toMatchObject({ action, occurrenceId: "occ-1", originalScope: "Write proposal" });
    expect((await rows("taskOccurrences", "occ-1"))[0]).toMatchObject({ state: occurrenceState, rescheduledToLocalDate: nextDate, version: 4 });
    expect((await rows("taskOccurrences", "occ-2"))[0]).toMatchObject({ state: "pending", version: 1 });
    expect((await rows("tasks", "task-1"))[0]).toMatchObject({ title: "Write proposal", state: "in_progress", dueLocalDate: "2026-10-03", version: 4 });
    expect((await rows("dailyPlanItems", "item-1"))[0]).toMatchObject({ state: itemState, version: 3 });
  });

  it("rejects a stale or wrong-day occurrence without changing the series", async () => {
    await seed({ recurring: true });
    for (const input of [
      { ...base, action: "done" as const },
      { ...base, action: "done" as const, occurrenceId: "occ-1", occurrenceExpectedVersion: 2 },
      { ...base, action: "done" as const, occurrenceId: "occ-2", occurrenceExpectedVersion: 1 },
    ]) await expect(resolveCommitment(scope, input)).rejects.toThrow();
    expect((await rows("taskOccurrences", "occ-1"))[0]).toMatchObject({ state: "pending", version: 3 });
    expect((await rows("dailyPlanItems", "item-1"))[0]).toMatchObject({ state: "committed", version: 2 });
  });

  it("rolls back the task and item when the immutable resolution insert fails", async () => {
    await seed();
    await database.exec(`CREATE FUNCTION reject_resolution_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced resolution failure'; END $$;
      CREATE TRIGGER reject_resolution BEFORE INSERT ON "commitmentResolutions" FOR EACH ROW EXECUTE FUNCTION reject_resolution_insert();`);
    await expect(resolveCommitment(scope, { ...base, action: "reduce", revisedScope: "Write outline", resolvedToLocalDate: "2026-09-30" })).rejects.toThrow('Failed query: insert into "commitmentResolutions"');
    expect((await rows("tasks", "task-1"))[0]).toMatchObject({ title: "Write proposal", scheduledLocalDate: "2026-09-27", version: 4 });
    expect((await rows("dailyPlanItems", "item-1"))[0]).toMatchObject({ state: "committed", version: 2 });
  });

  it("rolls back source and target occurrences when the resolution insert fails", async () => {
    await seed({ recurring: true });
    await database.exec(`CREATE FUNCTION reject_resolution_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced resolution failure'; END $$;
      CREATE TRIGGER reject_resolution BEFORE INSERT ON "commitmentResolutions" FOR EACH ROW EXECUTE FUNCTION reject_resolution_insert();`);
    await expect(resolveCommitment(scope, { ...base, action: "reduce", revisedScope: "Write outline", resolvedToLocalDate: "2026-09-30", occurrenceId: "occ-1", occurrenceExpectedVersion: 3 }))
      .rejects.toThrow('Failed query: insert into "commitmentResolutions"');
    expect((await rows("taskOccurrences", "occ-1"))[0]).toMatchObject({ state: "pending", version: 3 });
    expect((await database.query(`SELECT count(*)::int AS count FROM "taskOccurrences" WHERE "taskId" = 'task-1' AND "localDate" = '2026-09-30'`)).rows[0]).toEqual({ count: 0 });
    expect((await rows("dailyPlanItems", "item-1"))[0]).toMatchObject({ state: "committed", version: 2 });
  });
});
