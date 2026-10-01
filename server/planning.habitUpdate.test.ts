import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./workspaceOwnership", () => ({ requireWorkspaceOwner: vi.fn().mockResolvedValue(undefined), getAccountWorkspace: vi.fn() }));

import { PlannerConflictError, clearHabitCheckIn, getHabitPracticeEvidence, updateHabit, upsertHabitCheckIn } from "./planning";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
const ownership = readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8");
const scope = { workspaceId: "habit-owned-1", timezone: "UTC" };

function caller() {
  const now = new Date("2026-10-01T00:00:00.000Z");
  return appRouter.createCaller({
    user: { id: 1, supabaseUserId: "habit-user", name: "Habit User", email: "habit@example.test", loginMethod: "supabase_email", role: "user", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"],
  });
}

describe.sequential("versioned habit updates on the established schema", () => {
  let database: PGlite;
  beforeAll(async () => {
    database = new PGlite();
    await database.exec(baseline);
    await database.exec("create schema auth; create table auth.users (id uuid primary key);");
    await database.exec(ownership);
    await database.exec(`
      INSERT INTO workspaces (id, timezone) VALUES ('habit-owned-1', 'UTC'), ('habit-other', 'UTC');
      INSERT INTO goals (id, "workspaceId", title) VALUES ('goal-owned', 'habit-owned-1', 'Owned'), ('goal-other', 'habit-other', 'Other');
      INSERT INTO categories (id, "workspaceId", name, color) VALUES ('category-owned', 'habit-owned-1', 'Owned', '#123456'), ('category-other', 'habit-other', 'Other', '#123456');
      INSERT INTO habits (id, "workspaceId", "goalId", "categoryId", name, color, frequency, schedule, version)
        VALUES ('habit-1', 'habit-owned-1', 'goal-owned', 'category-owned', 'Read', '#123456', 'daily', '{"cadence":"daily","legacyNote":"retain"}', 3),
               ('habit-other', 'habit-other', 'goal-other', 'category-other', 'Private', '#654321', 'daily', '{}', 1),
               ('habit-archived', 'habit-owned-1', NULL, NULL, 'Old', '#123456', 'daily', '{}', 1);
      UPDATE habits SET "archivedAt" = now() WHERE id = 'habit-archived';
      INSERT INTO "habitCheckIns" (id, "workspaceId", "habitId", "localDate", "timezoneAtCheckIn", state, note)
        VALUES ('check-1', 'habit-owned-1', 'habit-1', '2026-09-30', 'UTC', 'completed', 'Original history');
    `);
    mocks.getDb.mockResolvedValue(drizzle(database));
  }, 30_000);
  afterAll(async () => { await database.close(); });

  it("updates established fields atomically while retaining the ID and check-in", async () => {
    const original = (await database.query(`SELECT "createdAt", "updatedAt" FROM habits WHERE id = 'habit-1'`)).rows[0];
    const updated = await updateHabit(scope, { id: "habit-1", expectedVersion: 3, patch: {
      name: "  Evening reading  ", description: "A little each day", color: "#abcdef", reminderTime: "21:30",
      goalId: "goal-owned", categoryId: "category-owned", schedule: { pauseStartedLocalDate: "2026-10-01", pauseUntilLocalDate: "2026-10-07" },
    } });
    expect(updated).toMatchObject({ id: "habit-1", workspaceId: scope.workspaceId, name: "Evening reading", description: "A little each day", color: "#abcdef", reminderTime: "21:30", version: 4 });
    expect(updated.schedule).toMatchObject({ cadence: "daily", legacyNote: "retain", pauseStartedLocalDate: "2026-10-01", pauseUntilLocalDate: "2026-10-07" });
    const storedTimes = (await database.query(`SELECT "createdAt", "updatedAt" FROM habits WHERE id = 'habit-1'`)).rows[0];
    expect(storedTimes.createdAt).toEqual(original.createdAt);
    expect((storedTimes.updatedAt as Date).getTime()).toBeGreaterThanOrEqual((original.updatedAt as Date).getTime());
    expect((await database.query(`SELECT id, "habitId", "localDate", state, note FROM "habitCheckIns"`)).rows)
      .toEqual([{ id: "check-1", habitId: "habit-1", localDate: "2026-09-30", state: "completed", note: "Original history" }]);
  });

  it("rejects stale versions, foreign records and links, and archived edits", async () => {
    await expect(updateHabit(scope, { id: "habit-1", expectedVersion: 3, patch: { name: "Stale" } })).rejects.toBeInstanceOf(PlannerConflictError);
    await expect(updateHabit(scope, { id: "habit-other", expectedVersion: 1, patch: { name: "Foreign" } })).rejects.toThrow("not found");
    await expect(updateHabit(scope, { id: "habit-1", expectedVersion: 4, patch: { goalId: "goal-other" } })).rejects.toThrow("this workspace");
    await expect(updateHabit(scope, { id: "habit-1", expectedVersion: 4, patch: { categoryId: "category-other" } })).rejects.toThrow("this workspace");
    await expect(updateHabit(scope, { id: "habit-archived", expectedVersion: 1, patch: { name: "Edited" } })).rejects.toThrow("Restore");
    expect((await database.query(`SELECT name, version FROM habits WHERE id = 'habit-1'`)).rows).toEqual([{ name: "Evening reading", version: 4 }]);
  });

  it("validates each supported cadence and real pause dates", async () => {
    const invalid = [
      { frequency: "days_of_week" as const, schedule: { weekdays: [] } },
      { frequency: "days_of_week" as const, schedule: { weekdays: [1, 1] } },
      { frequency: "times_per_week" as const, schedule: { timesPerWeek: 0 } },
      { frequency: "interval" as const, schedule: { startLocalDate: "2026-02-30", intervalDays: 2 } },
      { frequency: "interval" as const, schedule: { startLocalDate: "2026-10-01", intervalDays: 1.5 } },
      { schedule: { pauseUntilLocalDate: "2026-02-30" } },
      { schedule: { pauseStartedLocalDate: "2026-10-07", pauseUntilLocalDate: "2026-10-07" } },
    ];
    for (const patch of invalid) await expect(updateHabit(scope, { id: "habit-1", expectedVersion: 4, patch })).rejects.toThrow();
    await expect(updateHabit(scope, { id: "habit-1", expectedVersion: 4, patch: { frequency: "days_of_week", schedule: { weekdays: [1, 3] } } })).resolves.toMatchObject({ frequency: "days_of_week", version: 5 });
    await expect(updateHabit(scope, { id: "habit-1", expectedVersion: 5, patch: { frequency: "times_per_week", schedule: { timesPerWeek: 3 } } })).resolves.toMatchObject({ frequency: "times_per_week", version: 6 });
    await expect(updateHabit(scope, { id: "habit-1", expectedVersion: 6, patch: { frequency: "interval", schedule: { startLocalDate: "2026-10-01", intervalDays: 3 } } })).resolves.toMatchObject({ frequency: "interval", version: 7 });
    await expect(updateHabit(scope, { id: "habit-1", expectedVersion: 7, patch: { frequency: "daily", schedule: {} } })).resolves.toMatchObject({ frequency: "daily", version: 8 });
  });

  it("records resume acknowledgement without creating a check-in and clears a pause", async () => {
    const updated = await updateHabit(scope, { id: "habit-1", expectedVersion: 8, patch: { schedule: {
      pauseUntilLocalDate: null, pauseStartedLocalDate: null, returnAcknowledgedAtLocalDate: "2026-10-08",
    } } });
    expect(updated.schedule).toMatchObject({ legacyNote: "retain", returnAcknowledgedAtLocalDate: "2026-10-08" });
    expect(updated.schedule).not.toHaveProperty("pauseUntilLocalDate");
    expect(updated.schedule).not.toHaveProperty("pauseStartedLocalDate");
    expect(updated.version).toBe(9);
    expect((await database.query(`SELECT count(*)::int AS count FROM "habitCheckIns"`)).rows).toEqual([{ count: 1 }]);
  });

  it("maps router conflicts and bad schedules while accepting the pre-0004 schema", async () => {
    await expect(caller().planner.habit.update({ ...scope, id: "habit-1", expectedVersion: 8, patch: { name: "Stale" } })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller().planner.habit.update({ ...scope, id: "habit-1", expectedVersion: 9, patch: { schedule: { pauseUntilLocalDate: "2026-02-30" } } })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().planner.habit.update({ ...scope, id: "habit-1", expectedVersion: 9, patch: { reminderTime: "08:45" } })).resolves.toMatchObject({ id: "habit-1", reminderTime: "08:45", version: 10 });
  });

  it("rejects future, invalid, archived and foreign check-in changes without touching history", async () => {
    const before = (await database.query(`SELECT id, state, note FROM "habitCheckIns" WHERE id = 'check-1'`)).rows;
    await expect(upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: "2999-01-01", state: "completed" })).rejects.toThrow("no later than today");
    await expect(clearHabitCheckIn(scope, { habitId: "habit-1", localDate: "2026-02-30" })).rejects.toThrow("real local date");
    await expect(upsertHabitCheckIn(scope, { habitId: "habit-archived", localDate: "2026-09-30", state: "completed" })).rejects.toThrow("Restore");
    await expect(clearHabitCheckIn(scope, { habitId: "habit-archived", localDate: "2026-09-30" })).rejects.toThrow("Restore");
    await expect(upsertHabitCheckIn(scope, { habitId: "habit-other", localDate: "2026-09-30", state: "completed" })).rejects.toThrow("not found");
    await expect(clearHabitCheckIn(scope, { habitId: "habit-other", localDate: "2026-09-30" })).rejects.toThrow("not found");
    expect((await database.query(`SELECT id, state, note FROM "habitCheckIns" WHERE id = 'check-1'`)).rows).toEqual(before);
  });

  it("fetches archived history in an older bounded window without changing its record", async () => {
    await database.exec(`INSERT INTO "habitCheckIns" (id, "workspaceId", "habitId", "localDate", "timezoneAtCheckIn", state, note)
      VALUES ('old-archived-check', 'habit-owned-1', 'habit-archived', '2024-03-15', 'UTC', 'completed', 'Kept from an earlier year');`);
    const history = await getHabitPracticeEvidence(scope, { endLocalDate: "2024-03-31" });
    expect(history.checkIns).toEqual(expect.arrayContaining([expect.objectContaining({ id: "old-archived-check", habitId: "habit-archived", note: "Kept from an earlier year" })]));
    expect(history.habits).toEqual(expect.arrayContaining([expect.objectContaining({ id: "habit-archived", archivedAt: expect.any(Date) })]));
    expect((await database.query(`SELECT count(*)::int AS count FROM "habitCheckIns" WHERE id = 'old-archived-check'`)).rows).toEqual([{ count: 1 }]);
  });
});
