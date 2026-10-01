import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./workspaceOwnership", () => ({ requireWorkspaceOwner: vi.fn().mockResolvedValue(undefined), getAccountWorkspace: vi.fn() }));

import { PlannerConflictError, clearHabitCheckIn, upsertHabitCheckIn } from "./planning";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
const ownership = readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8");
const scope = { workspaceId: "habit-owned-1", timezone: "UTC" };
const date = "2026-08-24";
const expected = { id: "check-original", version: 1 };

function caller() {
  const now = new Date("2026-10-01T00:00:00.000Z");
  return appRouter.createCaller({
    user: { id: 1, supabaseUserId: "habit-user", name: "Habit User", email: "habit@example.test", loginMethod: "supabase_email", role: "user", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"],
  });
}

describe.sequential("versioned habit check-in persistence", () => {
  let database: PGlite;
  beforeAll(async () => {
    database = new PGlite();
    await database.exec(baseline);
    await database.exec("create schema auth; create table auth.users (id uuid primary key);");
    await database.exec(ownership);
    await database.exec(`
      INSERT INTO workspaces (id, timezone) VALUES ('habit-owned-1', 'UTC'), ('habit-other', 'UTC');
      INSERT INTO habits (id, "workspaceId", name, color, frequency, schedule)
        VALUES ('habit-1', 'habit-owned-1', 'Read', '#123456', 'daily', '{}'),
               ('habit-other', 'habit-other', 'Private', '#123456', 'daily', '{}');
    `);
    mocks.getDb.mockResolvedValue(drizzle(database));
  }, 30_000);
  beforeEach(async () => {
    await database.exec(`
      DELETE FROM "habitCheckIns";
      INSERT INTO "habitCheckIns" (id, "workspaceId", "habitId", "localDate", "timezoneAtCheckIn", state, note)
        VALUES ('check-original', 'habit-owned-1', 'habit-1', '${date}', 'UTC', 'completed', 'Saved note');
    `);
  });
  afterAll(async () => { await database.close(); });

  it("changes a quick state with the expected ID and version while retaining its note and history ID", async () => {
    const changed = await upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: date, state: "skipped", expectedCheckIn: expected });
    expect(changed).toMatchObject({ id: expected.id, version: 2, state: "skipped", note: "Saved note", completedAt: null });
    await expect(upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: date, state: "completed", note: null, expectedCheckIn: { id: expected.id, version: 2 } }))
      .resolves.toMatchObject({ id: expected.id, version: 3, state: "completed", note: null });
  });

  it("rejects stale corrections and clears without changing a newer correction", async () => {
    await upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: date, state: "missed", expectedCheckIn: expected });
    await expect(upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: date, state: "completed", expectedCheckIn: expected })).rejects.toBeInstanceOf(PlannerConflictError);
    await expect(clearHabitCheckIn(scope, { habitId: "habit-1", localDate: date, expectedCheckIn: expected })).rejects.toBeInstanceOf(PlannerConflictError);
    expect((await database.query(`SELECT id, version, state, note FROM "habitCheckIns"`)).rows)
      .toEqual([{ id: expected.id, version: 2, state: "missed", note: "Saved note" }]);
  });

  it("clears only the matching row; a retry is safe and cannot clear its replacement", async () => {
    await expect(clearHabitCheckIn(scope, { habitId: "habit-1", localDate: date, expectedCheckIn: expected }))
      .resolves.toEqual({ habitId: "habit-1", localDate: date, cleared: true });
    await expect(clearHabitCheckIn(scope, { habitId: "habit-1", localDate: date, expectedCheckIn: expected }))
      .resolves.toMatchObject({ cleared: true });
    const replacement = await upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: date, state: "skipped", expectedCheckIn: null });
    expect(replacement.id).not.toBe(expected.id);
    await expect(clearHabitCheckIn(scope, { habitId: "habit-1", localDate: date, expectedCheckIn: expected })).rejects.toBeInstanceOf(PlannerConflictError);
    await expect(upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: date, state: "missed", expectedCheckIn: expected })).rejects.toBeInstanceOf(PlannerConflictError);
    expect((await database.query(`SELECT id, state FROM "habitCheckIns"`)).rows).toEqual([{ id: replacement.id, state: "skipped" }]);
  });

  it("does not let explicit create or an older unguarded client overwrite an existing row", async () => {
    await expect(upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: date, state: "missed", expectedCheckIn: null })).rejects.toBeInstanceOf(PlannerConflictError);
    await expect(upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: date, state: "missed" })).rejects.toBeInstanceOf(PlannerConflictError);
    await expect(clearHabitCheckIn(scope, { habitId: "habit-1", localDate: date })).rejects.toBeInstanceOf(PlannerConflictError);
    expect((await database.query(`SELECT id, version, state, note FROM "habitCheckIns"`)).rows)
      .toEqual([{ id: expected.id, version: 1, state: "completed", note: "Saved note" }]);
  });

  it("allows only one atomic create for an empty date", async () => {
    const newDate = "2026-08-25";
    const attempts = await Promise.allSettled([
      upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: newDate, state: "completed", expectedCheckIn: null }),
      upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: newDate, state: "skipped", expectedCheckIn: null }),
    ]);
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(result => result.status === "rejected")).toHaveLength(1);
    expect((await database.query(`SELECT count(*)::int AS count FROM "habitCheckIns" WHERE "localDate" = '${newDate}'`)).rows).toEqual([{ count: 1 }]);
  });

  it("maps conflicts to the router and keeps reads and writes workspace scoped", async () => {
    await expect(caller().planner.habit.checkIn({ ...scope, habitId: "habit-1", localDate: date, state: "skipped", expectedCheckIn: null })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller().planner.habit.clearCheckIn({ ...scope, habitId: "habit-1", localDate: date, expectedCheckIn: { id: expected.id, version: 2 } })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(upsertHabitCheckIn(scope, { habitId: "habit-other", localDate: date, state: "completed", expectedCheckIn: null })).rejects.toThrow("not found");
    await expect(clearHabitCheckIn(scope, { habitId: "habit-other", localDate: date, expectedCheckIn: expected })).rejects.toThrow("not found");
  });
});
