import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
import { appRouter } from "./routers";

const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
const upgrade = readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8");
const previousRename = readFileSync(new URL("../drizzle/0013_supabase_identity.sql", import.meta.url), "utf8");
const database = new PGlite();
function context(userId: number, authUserId: string): TrpcContext {
  return {
    user: { id: userId, authUserId, legacyExternalId: null, name: "Owner", email: null, avatarUrl: null,
      loginMethod: "supabase_email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}
const scope = { workspaceId: "existing-workspace-a", timezone: "UTC" };

describe("independent PostgreSQL ownership migration", () => {
  beforeAll(async () => {
    await database.exec(baseline);
    await database.exec("create schema auth; create table auth.users (id uuid primary key);");
    await database.exec(`INSERT INTO users ("openId", email) VALUES ('old-provider-user', 'owner@example.test'), ('other-provider-user', 'other@example.test');
      INSERT INTO workspaces (id) VALUES ('existing-workspace-a'), ('existing-workspace-b');
      INSERT INTO tasks (id, "workspaceId", title) VALUES ('existing-task', 'existing-workspace-a', 'Keep my planning data');`);
    await database.exec(upgrade);
    mocks.getDb.mockResolvedValue(drizzle(database));
  }, 30_000);
  afterAll(() => database.close());

  it("preserves existing records and does not claim a workspace", async () => {
    expect((await database.query('SELECT id, "ownerUserId" FROM workspaces ORDER BY id')).rows)
      .toEqual([{ id: "existing-workspace-a", ownerUserId: null }, { id: "existing-workspace-b", ownerUserId: null }]);
    expect((await database.query('SELECT title FROM tasks')).rows).toEqual([{ title: "Keep my planning data" }]);
    expect((await database.query(`SELECT "authUserId", "legacyExternalId" FROM users WHERE email = 'owner@example.test'`)).rows[0])
      .toEqual({ authUserId: null, legacyExternalId: "old-provider-user" });
    expect(await appRouter.createCaller(context(1, "11111111-1111-4111-8111-111111111111")).auth.workspace()).toBeNull();
  });

  it("matches the durable identity column types", async () => {
    expect((await database.query(`SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('authUserId', 'legacyExternalId')
      ORDER BY column_name`)).rows).toEqual([
        { column_name: "authUserId", data_type: "uuid", character_maximum_length: null },
        { column_name: "legacyExternalId", data_type: "character varying", character_maximum_length: 128 },
      ]);
  });

  it("can be reapplied without removing records", async () => {
    await database.exec(upgrade);
    expect((await database.query('SELECT count(*)::int AS count FROM tasks')).rows).toEqual([{ count: 1 }]);
  });

  it("accepts a database where the previous identity rename was already applied", async () => {
    const existing = new PGlite();
    try {
      await existing.exec(baseline);
      await existing.exec("create schema auth; create table auth.users (id uuid primary key);");
      await existing.exec(`INSERT INTO users ("openId", email) VALUES ('renamed-provider-user', 'renamed@example.test')`);
      await existing.exec(previousRename);
      await existing.exec(upgrade);
      expect((await existing.query('SELECT "authUserId", "legacyExternalId" FROM users')).rows)
        .toEqual([{ authUserId: null, legacyExternalId: "renamed-provider-user" }]);
    } finally { await existing.close(); }
  }, 30_000);

  it("refuses ambiguous identity columns before changing data", async () => {
    const ambiguous = new PGlite();
    try {
      await ambiguous.exec(baseline);
      await ambiguous.exec(`ALTER TABLE users ADD COLUMN "supabaseUserId" varchar(64);
        INSERT INTO users ("openId", "supabaseUserId", email) VALUES ('old-provider-user', 'premature-provider-user', 'ambiguous@example.test')`);
      await expect(ambiguous.exec(upgrade)).rejects.toThrow(/More than one legacy identity column exists/);
      expect((await ambiguous.query('SELECT "openId", "supabaseUserId", email FROM users')).rows)
        .toEqual([{ openId: "old-provider-user", supabaseUserId: "premature-provider-user", email: "ambiguous@example.test" }]);
      expect((await ambiguous.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'workspaces' AND column_name = 'ownerUserId'")).rows)
        .toEqual([]);
    } finally { await ambiguous.close(); }
  }, 30_000);

  it("requires explicit ownership and enforces it on reads and writes", async () => {
    const owner = appRouter.createCaller(context(1, "11111111-1111-4111-8111-111111111111"));
    const other = appRouter.createCaller(context(2, "22222222-2222-4222-8222-222222222222"));
    const input = { ...scope, start: "2026-09-01", end: "2026-09-06" };
    await expect(owner.planner.workspace.snapshot(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await database.exec(`UPDATE workspaces SET "ownerUserId" = 1 WHERE id = 'existing-workspace-a'`);
    expect(await owner.auth.workspace()).toMatchObject({ id: scope.workspaceId });
    expect(await owner.planner.workspace.ensure(scope)).toMatchObject({ id: scope.workspaceId });
    await expect(other.planner.workspace.snapshot(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(other.planner.task.create({ ...scope, title: "Unauthorized task" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller({ ...context(1, "11111111-1111-4111-8111-111111111111"), user: null }).planner.workspace.ensure(scope))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect((await database.query('SELECT count(*)::int AS count FROM tasks')).rows).toEqual([{ count: 1 }]);
  });

  it("does not let public API roles bypass server ownership checks", async () => {
    await database.exec('CREATE ROLE browser_test NOLOGIN; GRANT USAGE ON SCHEMA public TO browser_test; GRANT SELECT ON tasks TO browser_test;');
    await database.exec('SET ROLE browser_test');
    try { expect((await database.query('SELECT * FROM tasks')).rows).toEqual([]); }
    finally { await database.exec('RESET ROLE'); }
  });
});
