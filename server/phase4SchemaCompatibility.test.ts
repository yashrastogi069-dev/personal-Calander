import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { getWorkspaceSnapshot } from "./planning";
import { getAccountWorkspace } from "./workspaceOwnership";

const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
const ownership = readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8");

async function legacyDatabase() {
  const database = new PGlite();
  await database.exec(baseline);
  await database.exec("create schema auth; create table auth.users (id uuid primary key);");
  await database.exec(ownership);
  await database.exec(`
    INSERT INTO users ("legacyExternalId", email) VALUES ('legacy-owner', 'owner@example.test');
    INSERT INTO workspaces (id, "ownerUserId", timezone) VALUES ('legacy-workspace', 1, 'UTC');
  `);
  mocks.getDb.mockResolvedValue(drizzle(database));
  return database;
}

afterEach(() => vi.clearAllMocks());

describe("pre-Phase-4 schema compatibility", () => {
  it("loads an owned workspace and its snapshot before the optional Phase 4 migration is applied", async () => {
    const database = await legacyDatabase();
    try {
      await expect(getAccountWorkspace(1)).resolves.toMatchObject({ id: "legacy-workspace", timezone: "UTC" });
      await expect(getWorkspaceSnapshot({ workspaceId: "legacy-workspace", timezone: "UTC" }, { start: "2026-09-20", end: "2026-09-21" }))
        .resolves.toMatchObject({ workspace: { id: "legacy-workspace" }, goals: [], projects: [] });
    } finally {
      await database.close();
    }
  }, 30_000);
});
