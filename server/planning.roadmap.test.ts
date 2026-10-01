import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./workspaceOwnership", () => ({ requireWorkspaceOwner: vi.fn().mockResolvedValue(undefined), getAccountWorkspace: vi.fn() }));

import { addProjectDependency, getWorkspaceSnapshot, PlannerConflictError, removeProjectDependency, updateProject } from "./planning";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
const ownership = readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8");
const product = readFileSync(new URL("../supabase/migrations/0004_phase4_product_model.sql", import.meta.url), "utf8");
const scope = { workspaceId: "roadmap-owned", timezone: "UTC" };

function caller() {
  const now = new Date("2026-10-01T00:00:00.000Z");
  return appRouter.createCaller({
    user: { id: 1, supabaseUserId: "roadmap-user", name: "Roadmap User", email: "roadmap@example.test", loginMethod: "supabase_email", role: "user", createdAt: now, updatedAt: now, lastSignedIn: now },
    req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"],
  });
}

async function fixture(migrated: boolean) {
  const database = new PGlite();
  await database.exec(baseline);
  await database.exec("create schema auth; create table auth.users (id uuid primary key);");
  await database.exec(ownership);
  if (migrated) await database.exec(product);
  await database.exec(`
    INSERT INTO workspaces (id, timezone) VALUES ('roadmap-owned', 'UTC'), ('roadmap-other', 'UTC');
    INSERT INTO goals (id, "workspaceId", title) VALUES ('owned-goal', 'roadmap-owned', 'Owned goal'), ('other-goal', 'roadmap-other', 'Other goal');
    INSERT INTO projects (id, "workspaceId", title, "goalId", "startLocalDate", "dueLocalDate", version)
      VALUES ('alpha', 'roadmap-owned', 'Alpha', 'owned-goal', '2026-10-01', '2026-10-31', 3),
             ('beta', 'roadmap-owned', 'Beta', NULL, NULL, NULL, 1),
             ('gamma', 'roadmap-owned', 'Gamma', NULL, NULL, NULL, 1),
             ('foreign', 'roadmap-other', 'Foreign', 'other-goal', NULL, NULL, 1);
    INSERT INTO tasks (id, "workspaceId", title, "projectId", "dueLocalDate", version)
      VALUES ('linked-task', 'roadmap-owned', 'Keep task date', 'alpha', '2026-10-15', 7);
  `);
  mocks.getDb.mockResolvedValue(drizzle(database));
  return database;
}

describe.sequential("project roadmap service before optional 0004 schema", () => {
  let database: PGlite;
  beforeAll(async () => { database = await fixture(false); }, 30_000);
  afterAll(async () => { await database.close(); });

  it("updates established dates with a version guard and never changes linked work", async () => {
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 3, patch: { startLocalDate: "2026-10-05", dueLocalDate: "2026-11-08", priority: "high" } }))
      .resolves.toMatchObject({ id: "alpha", startLocalDate: "2026-10-05", dueLocalDate: "2026-11-08", priority: "high", version: 4 });
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 3, patch: { dueLocalDate: "2026-12-01" } }))
      .rejects.toBeInstanceOf(PlannerConflictError);
    expect((await database.query(`SELECT "dueLocalDate", version FROM tasks WHERE id = 'linked-task'`)).rows)
      .toEqual([{ dueLocalDate: "2026-10-15", version: 7 }]);
  });

  it("rejects invalid dates, foreign links, and optional writes without changing rows", async () => {
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 4, patch: { dueLocalDate: "2026-10-01" } })).rejects.toThrow("start date");
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 4, patch: { dueLocalDate: "2026-02-30" } })).rejects.toThrow("real calendar dates");
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 4, patch: { goalId: "other-goal" } })).rejects.toThrow("this workspace");
    await expect(updateProject(scope, { id: "foreign", expectedVersion: 1, patch: { title: "Changed" } })).rejects.toThrow("not found");
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 4, patch: { riskLevel: "watch" } })).rejects.toThrow("No project was changed");
    await expect(addProjectDependency(scope, { projectId: "alpha", dependsOnProjectId: "beta", dependencyType: "hard", expectedVersion: 4 })).rejects.toThrow("No dependency was changed");
    await expect(removeProjectDependency(scope, { id: "absent", expectedVersion: 1, projectExpectedVersion: 4 })).rejects.toThrow("No dependency was changed");
    expect((await database.query(`SELECT "goalId", "dueLocalDate", version FROM projects WHERE id = 'alpha'`)).rows)
      .toEqual([{ goalId: "owned-goal", dueLocalDate: "2026-11-08", version: 4 }]);
    const snapshot = await getWorkspaceSnapshot(scope, { start: "2026-10-01", end: "2026-11-30" });
    expect(snapshot).toMatchObject({ projectRiskAvailable: false, projectDependenciesAvailable: false, projectDependencies: [] });
  });

  it("maps capability and stale-version failures through the guarded router", async () => {
    await expect(caller().planner.project.update({ ...scope, id: "alpha", expectedVersion: 4, patch: { riskLevel: "watch" } }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller().planner.project.update({ ...scope, id: "alpha", expectedVersion: 3, patch: { title: "Stale" } }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await expect(caller().planner.project.addDependency({ ...scope, projectId: "alpha", dependsOnProjectId: "beta", dependencyType: "hard", expectedVersion: 4 }))
      .rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    await expect(caller().planner.project.update({ ...scope, id: "alpha", expectedVersion: 4, patch: { dueLocalDate: "2026-99-99" } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe.sequential("project roadmap service with optional 0004 schema", () => {
  let database: PGlite;
  beforeAll(async () => { database = await fixture(true); }, 30_000);
  afterAll(async () => { await database.close(); });

  it("persists risk and review metadata with a version guard", async () => {
    const updated = await updateProject(scope, { id: "alpha", expectedVersion: 3, patch: { riskLevel: "watch", riskNote: "Awaiting approval", nextReviewLocalDate: "2026-10-12" } });
    expect(updated).toMatchObject({ id: "alpha", riskLevel: "watch", riskNote: "Awaiting approval", nextReviewLocalDate: "2026-10-12", version: 4 });
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 3, patch: { riskLevel: "blocked" } })).rejects.toBeInstanceOf(PlannerConflictError);
  });

  it("guards both dependency endpoints and rejects duplicate, self, and cyclic links", async () => {
    await expect(addProjectDependency(scope, { projectId: "alpha", dependsOnProjectId: "foreign", dependencyType: "hard", expectedVersion: 4 })).rejects.toThrow("this workspace");
    await expect(addProjectDependency(scope, { projectId: "alpha", dependsOnProjectId: "alpha", dependencyType: "hard", expectedVersion: 4 })).rejects.toThrow("cycle");
    const first = await addProjectDependency(scope, { projectId: "alpha", dependsOnProjectId: "beta", dependencyType: "hard", expectedVersion: 4 });
    expect(first).toMatchObject({ projectId: "alpha", dependsOnProjectId: "beta", version: 1 });
    await expect(addProjectDependency(scope, { projectId: "alpha", dependsOnProjectId: "beta", dependencyType: "hard", expectedVersion: 5 })).rejects.toThrow("already exists");
    await expect(addProjectDependency(scope, { projectId: "beta", dependsOnProjectId: "alpha", dependencyType: "soft", expectedVersion: 1 })).rejects.toThrow("cycle");
    await expect(addProjectDependency(scope, { projectId: "beta", dependsOnProjectId: "foreign", dependencyType: "soft", expectedVersion: 1 })).rejects.toThrow("this workspace");
    const second = await addProjectDependency(scope, { projectId: "beta", dependsOnProjectId: "gamma", dependencyType: "soft", expectedVersion: 1 });
    expect(second.dependencyType).toBe("soft");
    await expect(addProjectDependency(scope, { projectId: "gamma", dependsOnProjectId: "alpha", dependencyType: "hard", expectedVersion: 1 })).rejects.toThrow("cycle");
    await expect(removeProjectDependency(scope, { id: first.id, expectedVersion: 2, projectExpectedVersion: 5 })).rejects.toBeInstanceOf(PlannerConflictError);
    await expect(removeProjectDependency(scope, { id: first.id, expectedVersion: 1, projectExpectedVersion: 4 })).rejects.toBeInstanceOf(PlannerConflictError);
    await expect(removeProjectDependency({ workspaceId: "roadmap-other", timezone: "UTC" }, { id: first.id, expectedVersion: 1, projectExpectedVersion: 5 })).rejects.toThrow("not found");
    await expect(removeProjectDependency(scope, { id: first.id, expectedVersion: 1, projectExpectedVersion: 5 })).resolves.toMatchObject({ removed: true, projectVersion: 6 });
    const snapshot = await getWorkspaceSnapshot(scope, { start: "2026-10-01", end: "2026-11-30" });
    expect(snapshot.projectDependenciesAvailable).toBe(true);
    expect(snapshot.projectDependencies).toEqual([expect.objectContaining({ id: second.id, projectId: "beta", dependsOnProjectId: "gamma" })]);
    expect(snapshot.projects.find(project => project.id === "alpha")).toMatchObject({ version: 6, riskLevel: "watch" });
  });
});

describe.sequential("project date edits with hard dependencies", () => {
  let database: PGlite;
  beforeAll(async () => {
    database = await fixture(true);
    await database.exec(`UPDATE projects SET "dueLocalDate" = '2026-09-30' WHERE id = 'beta';
      UPDATE projects SET "startLocalDate" = '2026-11-01' WHERE id = 'gamma';`);
    await addProjectDependency(scope, { projectId: "alpha", dependsOnProjectId: "beta", dependencyType: "hard", expectedVersion: 3 });
    await addProjectDependency(scope, { projectId: "gamma", dependsOnProjectId: "alpha", dependencyType: "hard", expectedVersion: 1 });
  }, 30_000);
  afterAll(async () => { await database.close(); });

  it("rejects a dependent start before its prerequisite due date without changing the row", async () => {
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 4, patch: { startLocalDate: "2026-09-29" } }))
      .rejects.toThrow("hard dependency");
    expect((await database.query(`SELECT "startLocalDate", version FROM projects WHERE id = 'alpha'`)).rows)
      .toEqual([{ startLocalDate: "2026-10-01", version: 4 }]);
  });

  it("rejects a prerequisite due date after its dependent start", async () => {
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 4, patch: { dueLocalDate: "2026-11-02" } }))
      .rejects.toThrow("hard dependency");
    expect((await database.query(`SELECT "dueLocalDate", version FROM projects WHERE id = 'alpha'`)).rows)
      .toEqual([{ dueLocalDate: "2026-10-31", version: 4 }]);
  });

  it("keeps the optimistic version guard and allows an unrelated edit", async () => {
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 3, patch: { startLocalDate: "2026-09-29" } }))
      .rejects.toBeInstanceOf(PlannerConflictError);
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 4, patch: { title: "Renamed Alpha" } }))
      .resolves.toMatchObject({ title: "Renamed Alpha", version: 5 });
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 5, patch: { dueLocalDate: "2026-11-01" } }))
      .resolves.toMatchObject({ dueLocalDate: "2026-11-01", version: 6 });
  });

  it("does not block unrelated fields when an older hard edge is already inconsistent", async () => {
    await database.exec(`UPDATE projects SET "dueLocalDate" = '2026-10-02' WHERE id = 'beta'`);
    await expect(updateProject(scope, { id: "alpha", expectedVersion: 6, patch: { priority: "high" } }))
      .resolves.toMatchObject({ priority: "high", version: 7 });
  });
});

describe.sequential("hard project dependency creation respects recorded dates", () => {
  let database: PGlite;
  beforeAll(async () => {
    database = await fixture(true);
    await database.exec(`UPDATE projects SET "dueLocalDate" = '2026-10-02' WHERE id = 'beta';
      UPDATE projects SET "startLocalDate" = '2026-10-02' WHERE id = 'gamma';`);
  }, 30_000);
  afterAll(async () => { await database.close(); });

  it("rejects a conflicting hard edge without inserting it or bumping the source version", async () => {
    await expect(addProjectDependency(scope, { projectId: "alpha", dependsOnProjectId: "beta", dependencyType: "hard", expectedVersion: 3 }))
      .rejects.toThrow("hard dependency conflicts with project dates");
    expect((await database.query(`SELECT version FROM projects WHERE id = 'alpha'`)).rows).toEqual([{ version: 3 }]);
    expect((await database.query(`SELECT id FROM "projectDependencies" WHERE "projectId" = 'alpha'`)).rows).toEqual([]);
  });

  it("allows a soft edge with the same dates, a hard edge on the boundary, and one with a missing due date", async () => {
    await expect(addProjectDependency(scope, { projectId: "alpha", dependsOnProjectId: "beta", dependencyType: "soft", expectedVersion: 3 }))
      .resolves.toMatchObject({ dependencyType: "soft" });
    await expect(addProjectDependency(scope, { projectId: "gamma", dependsOnProjectId: "beta", dependencyType: "hard", expectedVersion: 1 }))
      .resolves.toMatchObject({ dependencyType: "hard" });
    await expect(addProjectDependency(scope, { projectId: "alpha", dependsOnProjectId: "gamma", dependencyType: "hard", expectedVersion: 4 }))
      .resolves.toMatchObject({ dependencyType: "hard" });
    expect((await database.query(`SELECT version FROM projects WHERE id = 'alpha'`)).rows).toEqual([{ version: 5 }]);
  });
});
