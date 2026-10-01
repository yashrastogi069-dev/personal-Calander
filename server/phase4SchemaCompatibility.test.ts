import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));

import { createGoal, getSearchRecord, getWorkspaceSnapshot, resolveDailyPlanItem, searchWorkspace, updateDailyPlanItem, updateGoal } from "./planning";
import { getAccountWorkspace } from "./workspaceOwnership";

const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
const ownership = readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8");
const phase4ProductModel = readFileSync(new URL("../supabase/migrations/0004_phase4_product_model.sql", import.meta.url), "utf8");

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
        .resolves.toMatchObject({ workspace: { id: "legacy-workspace" }, goalIntentionAvailable: false, goals: [], projects: [], commitmentResolutions: [] });
    } finally {
      await database.close();
    }
  }, 30_000);

  it("keeps legacy goal create/edit working but rejects metadata writes before 0004 without changing rows", async () => {
    const database = await legacyDatabase();
    const scope = { workspaceId: "legacy-workspace", timezone: "UTC" };
    try {
      await database.exec(`INSERT INTO goals (id, "workspaceId", title, state, priority, horizon, "progressMode", "progressValue", "targetValue", "dueLocalDate", version)
        VALUES ('legacy-goal', 'legacy-workspace', 'Keep my goal', 'in_progress', 'high', 'yearly', 'measure', 40, 80, '2026-12-31', 4);`);
      const snapshot = await getWorkspaceSnapshot(scope, { start: "2026-09-20", end: "2026-09-21" });
      expect(snapshot.goalIntentionAvailable).toBe(false);
      expect(snapshot.goals[0]).toMatchObject({ id: "legacy-goal", title: "Keep my goal", progressValue: 40 });
      await expect(searchWorkspace(scope, { query: "Keep my", limit: 10 })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: "legacy-goal", entity: "goal" })]));
      await expect(getSearchRecord(scope, { entity: "goal", id: "legacy-goal" })).resolves.toMatchObject({ id: "legacy-goal", title: "Keep my goal" });
      await expect(createGoal(scope, { title: "Not written", intentionKind: "direction", successCriteria: null, standards: "Keep learning", reviewCadence: "monthly", nextReviewLocalDate: null, categoryId: null, parentGoalId: null, description: null, state: "not_started", priority: "medium", horizon: "yearly", color: null, progressMode: "task", progressValue: 0, targetValue: 100, startLocalDate: null, dueLocalDate: null })).rejects.toThrow("No goal was created");
      await expect(updateGoal(scope, { id: "legacy-goal", expectedVersion: 4, patch: { intentionKind: "direction", standards: "Keep learning" } })).rejects.toThrow("No goal was changed");
      await database.exec(`WITH foreign_owner AS (INSERT INTO users ("legacyExternalId", email) VALUES ('foreign-owner', 'foreign@example.test') RETURNING id)
        INSERT INTO workspaces (id, "ownerUserId", timezone) SELECT 'foreign-workspace', id, 'UTC' FROM foreign_owner;
        INSERT INTO goals (id, "workspaceId", title) VALUES ('foreign-goal', 'foreign-workspace', 'Private parent');`);
      await expect(createGoal(scope, { title: "Wrong parent", description: null, categoryId: null, parentGoalId: "foreign-goal", state: "not_started", priority: "medium", horizon: "yearly", color: null, progressMode: "task", progressValue: 0, targetValue: 100, startLocalDate: null, dueLocalDate: null })).rejects.toThrow("Select a goal from this workspace");
      await expect(createGoal(scope, { title: "Legacy create", categoryId: null, parentGoalId: null, description: null, state: "not_started", priority: "medium", horizon: "yearly", color: null, progressMode: "task", progressValue: 0, targetValue: 100, startLocalDate: null, dueLocalDate: null })).resolves.toMatchObject({ title: "Legacy create", version: 1 });
      expect((await database.query(`SELECT id, title, "progressValue", "dueLocalDate", version FROM goals WHERE id = 'legacy-goal'`)).rows).toEqual([{ id: "legacy-goal", title: "Keep my goal", progressValue: 40, dueLocalDate: "2026-12-31", version: 4 }]);
    } finally { await database.close(); }
  }, 30_000);

  it("reads, creates, and version-guards intentions after 0004 while preserving established facts", async () => {
    const database = await legacyDatabase();
    const scope = { workspaceId: "legacy-workspace", timezone: "UTC" };
    try {
      await database.exec(`INSERT INTO goals (id, "workspaceId", title, description, state, priority, horizon, "progressMode", "progressValue", "targetValue", "startLocalDate", "dueLocalDate", "createdAt", "updatedAt", version)
        VALUES ('legacy-goal', 'legacy-workspace', 'Keep my goal', 'Original description', 'in_progress', 'high', 'yearly', 'measure', 40, 80, '2026-01-01', '2026-12-31', TIMESTAMP '2026-01-02 03:04:05', TIMESTAMP '2026-02-03 04:05:06', 4);`);
      await database.exec(phase4ProductModel);
      const updated = await updateGoal(scope, { id: "legacy-goal", expectedVersion: 4, patch: { intentionKind: "outcome", successCriteria: "Publish the guide", reviewCadence: "quarterly", nextReviewLocalDate: "2026-10-01" } });
      expect(updated).toMatchObject({ id: "legacy-goal", intentionKind: "outcome", successCriteria: "Publish the guide", reviewCadence: "quarterly", nextReviewLocalDate: "2026-10-01", progressMode: "measure", progressValue: 40, targetValue: 80, startLocalDate: "2026-01-01", dueLocalDate: "2026-12-31", version: 5 });
      await expect(updateGoal(scope, { id: "legacy-goal", expectedVersion: 4, patch: { intentionKind: "direction" } })).rejects.toMatchObject({ current: expect.objectContaining({ version: 5 }) });
      const direction = await createGoal(scope, { title: "Keep learning", description: null, categoryId: null, parentGoalId: null, state: "not_started", priority: "medium", horizon: "yearly", color: null, progressMode: "task", progressValue: 0, targetValue: 100, startLocalDate: null, dueLocalDate: null, intentionKind: "direction", successCriteria: null, standards: "Make room to read", reviewCadence: "monthly", nextReviewLocalDate: "2026-11-01" });
      expect(direction).toMatchObject({ intentionKind: "direction", standards: "Make room to read", reviewCadence: "monthly", nextReviewLocalDate: "2026-11-01" });
      const snapshot = await getWorkspaceSnapshot(scope, { start: "2026-09-20", end: "2026-11-21" });
      expect(snapshot.goalIntentionAvailable).toBe(true);
      expect(snapshot.projectRiskAvailable).toBe(true);
      expect(snapshot.projectDependenciesAvailable).toBe(true);
      expect(snapshot.goals.find(goal => goal.id === "legacy-goal")).toMatchObject({ intentionKind: "outcome", successCriteria: "Publish the guide", version: 5 });
      await expect(searchWorkspace(scope, { query: "Keep my", limit: 10 })).resolves.toEqual(expect.arrayContaining([expect.objectContaining({ id: "legacy-goal", entity: "goal", intentionKind: "outcome" })]));
      await expect(updateGoal(scope, { id: "legacy-goal", expectedVersion: 5, patch: { parentGoalId: "legacy-goal" } })).rejects.toThrow("cannot be its own parent");
      const child = await createGoal(scope, { title: "Child goal", description: null, categoryId: null, parentGoalId: "legacy-goal", state: "not_started", priority: "medium", horizon: "quarterly", color: null, progressMode: "task", progressValue: 0, targetValue: 100, startLocalDate: null, dueLocalDate: null });
      await expect(updateGoal(scope, { id: "legacy-goal", expectedVersion: 5, patch: { parentGoalId: child.id } })).rejects.toThrow("hierarchy cycle");
    } finally { await database.close(); }
  }, 30_000);

  it("keeps the established daily-plan outcome path usable before the optional ledger exists", async () => {
    const database = await legacyDatabase();
    const scope = { workspaceId: "legacy-workspace", timezone: "UTC" };
    try {
      await database.exec(`INSERT INTO tasks (id, "workspaceId", title, version) VALUES ('legacy-task', 'legacy-workspace', 'Keep this task', 3);
        INSERT INTO "dailyPlans" (id, "workspaceId", "localDate", state) VALUES ('legacy-plan', 'legacy-workspace', '2026-09-20', 'active');
        INSERT INTO "dailyPlanItems" (id, "workspaceId", "dailyPlanId", "taskId", version) VALUES ('legacy-item', 'legacy-workspace', 'legacy-plan', 'legacy-task', 2);`);
      await expect(updateDailyPlanItem(scope, { id: "legacy-item", expectedVersion: 2, note: "Still important" })).resolves.toMatchObject({ state: "committed", version: 3 });
      await expect(resolveDailyPlanItem(scope, { id: "legacy-item", expectedVersion: 3, taskExpectedVersion: 3, state: "done" })).resolves.toMatchObject({ state: "done", version: 4 });
      expect((await database.query(`SELECT state, version FROM tasks WHERE id = 'legacy-task'`)).rows).toEqual([{ state: "completed", version: 4 }]);
    } finally {
      await database.close();
    }
  }, 30_000);
});
