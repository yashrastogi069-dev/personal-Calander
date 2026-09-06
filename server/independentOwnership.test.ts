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
function context(userId: string): TrpcContext {
  return {
    user: { id: 1, supabaseUserId: userId, name: "Owner", email: null, loginMethod: "supabase_email",
      role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"],
  };
}
const scope = { workspaceId: "existing-workspace-a", timezone: "UTC" };

describe("independent PostgreSQL ownership migration", () => {
  beforeAll(async () => {
    await database.exec(baseline);
    await database.exec(`INSERT INTO users ("openId") VALUES ('owner-a'), ('owner-b');
      INSERT INTO workspaces (id) VALUES ('existing-workspace-a'), ('existing-workspace-b');
      INSERT INTO tasks (id, "workspaceId", title) VALUES ('existing-task', 'existing-workspace-a', 'Keep my planning data');`);
    await database.exec(upgrade);
    mocks.getDb.mockResolvedValue(drizzle(database));
  }, 30_000);
  afterAll(() => database.close());

  it("preserves existing records and does not claim a workspace", async () => {
    expect((await database.query('SELECT id, "ownerSupabaseUserId" FROM workspaces ORDER BY id')).rows)
      .toEqual([{ id: "existing-workspace-a", ownerSupabaseUserId: null }, { id: "existing-workspace-b", ownerSupabaseUserId: null }]);
    expect((await database.query('SELECT title FROM tasks')).rows).toEqual([{ title: "Keep my planning data" }]);
    expect(await appRouter.createCaller(context("owner-a")).auth.workspace()).toBeNull();
  });

  it("can be reapplied without removing records", async () => {
    await database.exec(upgrade);
    expect((await database.query('SELECT count(*)::int AS count FROM tasks')).rows).toEqual([{ count: 1 }]);
  });

  it("accepts a database where the previous identity rename was already applied", async () => {
    const existing = new PGlite();
    try {
      await existing.exec(baseline);
      await existing.exec(previousRename);
      await existing.exec(upgrade);
      expect((await existing.query('SELECT "supabaseUserId" FROM users')).rows).toEqual([]);
    } finally { await existing.close(); }
  }, 30_000);

  it("requires explicit ownership and enforces it on reads and writes", async () => {
    const owner = appRouter.createCaller(context("owner-a"));
    const other = appRouter.createCaller(context("owner-b"));
    const input = { ...scope, start: "2026-09-01", end: "2026-09-06" };
    await expect(owner.planner.workspace.snapshot(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await database.exec(`UPDATE workspaces SET "ownerSupabaseUserId" = 'owner-a' WHERE id = 'existing-workspace-a'`);
    expect(await owner.auth.workspace()).toMatchObject({ id: scope.workspaceId });
    expect(await owner.planner.workspace.ensure(scope)).toMatchObject({ id: scope.workspaceId });
    await expect(other.planner.workspace.snapshot(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(other.planner.task.create({ ...scope, title: "Unauthorized task" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(appRouter.createCaller({ ...context("owner-a"), user: null }).planner.workspace.ensure(scope))
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
