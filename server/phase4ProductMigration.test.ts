import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { getTableColumns } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as plannerSchema from "../drizzle/schema";

const baseline = readFileSync(
  new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url),
  "utf8"
);
const migrationUrl = new URL(
  "../supabase/migrations/0004_phase4_product_model.sql",
  import.meta.url
);
const migrationPath = fileURLToPath(migrationUrl);
const migration = existsSync(migrationPath)
  ? readFileSync(migrationUrl, "utf8")
  : "";
const database = new PGlite();

async function count(tableName: string) {
  const result = await database.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM "${tableName}"`
  );
  return result.rows[0]?.count;
}

describe.sequential("Phase 4 additive product-model migration", () => {
  beforeAll(async () => {
    await database.exec(baseline);
    await database.exec(`
      INSERT INTO workspaces (
        id, name, timezone, "weekStartsOn", "dailyCapacityMinutes",
        "planningDayStartsAt", "workdayStartsAt", "workdayEndsAt",
        "defaultBreakMinutes", "preferredShutdownAt", "createdAt", "updatedAt", version
      ) VALUES (
        'workspace-preserved', 'Preserved workspace', 'Asia/Calcutta', 1, 420,
        '05:30', '08:45', '17:15', 25, '18:00',
        TIMESTAMP '2026-09-01 08:15:30', TIMESTAMP '2026-09-02 09:16:31', 7
      );

      INSERT INTO goals (
        id, "workspaceId", title, description, state, priority, horizon,
        "progressMode", "progressValue", "targetValue", "startLocalDate",
        "dueLocalDate", "createdAt", "updatedAt", version
      ) VALUES (
        'goal-preserved', 'workspace-preserved', 'Preserve this goal', 'Original goal details',
        'in_progress', 'high', 'yearly', 'measure', 42, 84, '2026-01-01', '2026-12-31',
        TIMESTAMP '2026-09-03 10:17:32', TIMESTAMP '2026-09-04 11:18:33', 5
      );

      INSERT INTO projects (
        id, "workspaceId", "goalId", title, description, state, priority, horizon,
        "startLocalDate", "dueLocalDate", "createdAt", "updatedAt", version
      ) VALUES (
        'project-preserved', 'workspace-preserved', 'goal-preserved', 'Preserve this project',
        'Original project details', 'in_progress', 'critical', 'quarterly',
        '2026-09-01', '2026-11-30',
        TIMESTAMP '2026-09-05 12:19:34', TIMESTAMP '2026-09-06 13:20:35', 4
      );

      INSERT INTO tasks (
        id, "workspaceId", "goalId", "projectId", title, description, state,
        priority, horizon, "dueLocalDate", "scheduledLocalDate", "estimateMinutes",
        "sortOrder", "scheduleMode", outcome, "rescheduleCount", "createdAt", "updatedAt", version
      ) VALUES (
        'task-preserved', 'workspace-preserved', 'goal-preserved', 'project-preserved',
        'Preserve this task', 'Original task details', 'in_progress', 'high', 'weekly',
        '2026-09-20', '2026-09-14', 75, 3, 'flexible', 'none', 2,
        TIMESTAMP '2026-09-07 14:21:36', TIMESTAMP '2026-09-08 15:22:37', 9
      );

      INSERT INTO "taskOccurrences" (
        id, "workspaceId", "taskId", "localDate", state, note, "createdAt", "updatedAt", version
      ) VALUES (
        'occurrence-preserved', 'workspace-preserved', 'task-preserved', '2026-09-14',
        'pending', 'Original occurrence',
        TIMESTAMP '2026-09-09 16:23:38', TIMESTAMP '2026-09-10 17:24:39', 3
      );

      INSERT INTO "dailyPlans" (
        id, "workspaceId", "localDate", state, intention, reflection,
        "startedAt", "createdAt", "updatedAt", version
      ) VALUES (
        'daily-plan-preserved', 'workspace-preserved', '2026-09-14', 'active',
        'Protect the plan', 'Still in progress', TIMESTAMP '2026-09-14 06:00:00',
        TIMESTAMP '2026-09-11 18:25:40', TIMESTAMP '2026-09-12 19:26:41', 6
      );

      INSERT INTO "dailyPlanItems" (
        id, "workspaceId", "dailyPlanId", "taskId", position, state, note,
        "createdAt", "updatedAt", version
      ) VALUES (
        'daily-plan-item-preserved', 'workspace-preserved', 'daily-plan-preserved',
        'task-preserved', 2, 'committed', 'Original commitment',
        TIMESTAMP '2026-09-13 20:27:42', TIMESTAMP '2026-09-14 21:28:43', 8
      );
    `);

    if (migration) {
      await database.exec(migration);
    }
  }, 30_000);

  afterAll(async () => {
    await database.close();
  });

  it("preserves every seeded planner identity, value, version, and timestamp", async () => {
    const existingWorkspace = (
      await database.query(`
      SELECT id, name, timezone, "weekStartsOn", "dailyCapacityMinutes",
        "planningDayStartsAt", "workdayStartsAt", "workdayEndsAt",
        "defaultBreakMinutes", "preferredShutdownAt",
        "createdAt"::text AS "createdAt", "updatedAt"::text AS "updatedAt", version,
        "accountabilityLevel"
      FROM workspaces WHERE id = 'workspace-preserved'
    `)
    ).rows[0];
    expect(existingWorkspace).toEqual({
      id: "workspace-preserved",
      name: "Preserved workspace",
      timezone: "Asia/Calcutta",
      weekStartsOn: 1,
      dailyCapacityMinutes: 420,
      planningDayStartsAt: "05:30",
      workdayStartsAt: "08:45",
      workdayEndsAt: "17:15",
      defaultBreakMinutes: 25,
      preferredShutdownAt: "18:00",
      createdAt: "2026-09-01 08:15:30",
      updatedAt: "2026-09-02 09:16:31",
      version: 7,
      accountabilityLevel: "structured",
    });

    const existingGoal = (
      await database.query(`
      SELECT id, "workspaceId", title, description, state, priority, horizon,
        "progressMode", "progressValue", "targetValue", "startLocalDate", "dueLocalDate",
        "createdAt"::text AS "createdAt", "updatedAt"::text AS "updatedAt", version,
        "intentionKind", "successCriteria", standards, "reviewCadence", "nextReviewLocalDate"
      FROM goals WHERE id = 'goal-preserved'
    `)
    ).rows[0];
    expect(existingGoal).toEqual({
      id: "goal-preserved",
      workspaceId: "workspace-preserved",
      title: "Preserve this goal",
      description: "Original goal details",
      state: "in_progress",
      priority: "high",
      horizon: "yearly",
      progressMode: "measure",
      progressValue: 42,
      targetValue: 84,
      startLocalDate: "2026-01-01",
      dueLocalDate: "2026-12-31",
      createdAt: "2026-09-03 10:17:32",
      updatedAt: "2026-09-04 11:18:33",
      version: 5,
      intentionKind: null,
      successCriteria: null,
      standards: null,
      reviewCadence: null,
      nextReviewLocalDate: null,
    });

    const existingProject = (
      await database.query(`
      SELECT id, "workspaceId", "goalId", title, description, state, priority, horizon,
        "startLocalDate", "dueLocalDate", "createdAt"::text AS "createdAt",
        "updatedAt"::text AS "updatedAt", version, "riskLevel", "riskNote", "nextReviewLocalDate"
      FROM projects WHERE id = 'project-preserved'
    `)
    ).rows[0];
    expect(existingProject).toEqual({
      id: "project-preserved",
      workspaceId: "workspace-preserved",
      goalId: "goal-preserved",
      title: "Preserve this project",
      description: "Original project details",
      state: "in_progress",
      priority: "critical",
      horizon: "quarterly",
      startLocalDate: "2026-09-01",
      dueLocalDate: "2026-11-30",
      createdAt: "2026-09-05 12:19:34",
      updatedAt: "2026-09-06 13:20:35",
      version: 4,
      riskLevel: "none",
      riskNote: null,
      nextReviewLocalDate: null,
    });

    expect(
      (
        await database.query(`
      SELECT id, "workspaceId", "goalId", "projectId", title, description, state,
        priority, horizon, "dueLocalDate", "scheduledLocalDate", "estimateMinutes",
        "sortOrder", "scheduleMode", outcome, "rescheduleCount",
        "createdAt"::text AS "createdAt", "updatedAt"::text AS "updatedAt", version
      FROM tasks WHERE id = 'task-preserved'
    `)
      ).rows
    ).toEqual([
      {
        id: "task-preserved",
        workspaceId: "workspace-preserved",
        goalId: "goal-preserved",
        projectId: "project-preserved",
        title: "Preserve this task",
        description: "Original task details",
        state: "in_progress",
        priority: "high",
        horizon: "weekly",
        dueLocalDate: "2026-09-20",
        scheduledLocalDate: "2026-09-14",
        estimateMinutes: 75,
        sortOrder: 3,
        scheduleMode: "flexible",
        outcome: "none",
        rescheduleCount: 2,
        createdAt: "2026-09-07 14:21:36",
        updatedAt: "2026-09-08 15:22:37",
        version: 9,
      },
    ]);

    expect(
      (
        await database.query(`
      SELECT id, "workspaceId", "taskId", "localDate", state, note,
        "createdAt"::text AS "createdAt", "updatedAt"::text AS "updatedAt", version
      FROM "taskOccurrences" WHERE id = 'occurrence-preserved'
    `)
      ).rows
    ).toEqual([
      {
        id: "occurrence-preserved",
        workspaceId: "workspace-preserved",
        taskId: "task-preserved",
        localDate: "2026-09-14",
        state: "pending",
        note: "Original occurrence",
        createdAt: "2026-09-09 16:23:38",
        updatedAt: "2026-09-10 17:24:39",
        version: 3,
      },
    ]);

    expect(
      (
        await database.query(`
      SELECT id, "workspaceId", "localDate", state, intention, reflection,
        "startedAt"::text AS "startedAt", "createdAt"::text AS "createdAt",
        "updatedAt"::text AS "updatedAt", version
      FROM "dailyPlans" WHERE id = 'daily-plan-preserved'
    `)
      ).rows
    ).toEqual([
      {
        id: "daily-plan-preserved",
        workspaceId: "workspace-preserved",
        localDate: "2026-09-14",
        state: "active",
        intention: "Protect the plan",
        reflection: "Still in progress",
        startedAt: "2026-09-14 06:00:00",
        createdAt: "2026-09-11 18:25:40",
        updatedAt: "2026-09-12 19:26:41",
        version: 6,
      },
    ]);

    expect(
      (
        await database.query(`
      SELECT id, "workspaceId", "dailyPlanId", "taskId", position, state, note,
        "createdAt"::text AS "createdAt", "updatedAt"::text AS "updatedAt", version
      FROM "dailyPlanItems" WHERE id = 'daily-plan-item-preserved'
    `)
      ).rows
    ).toEqual([
      {
        id: "daily-plan-item-preserved",
        workspaceId: "workspace-preserved",
        dailyPlanId: "daily-plan-preserved",
        taskId: "task-preserved",
        position: 2,
        state: "committed",
        note: "Original commitment",
        createdAt: "2026-09-13 20:27:42",
        updatedAt: "2026-09-14 21:28:43",
        version: 8,
      },
    ]);
  });

  it("leaves all new intention and risk metadata nullable for legacy-compatible inserts", async () => {
    await database.exec(`
      INSERT INTO goals (id, "workspaceId", title)
      VALUES ('goal-legacy-compatible', 'workspace-preserved', 'Old-client goal');
      INSERT INTO projects (id, "workspaceId", title)
      VALUES ('project-legacy-compatible', 'workspace-preserved', 'Old-client project');
    `);

    expect(
      (
        await database.query(`
      SELECT "intentionKind", "successCriteria", standards, "reviewCadence", "nextReviewLocalDate"
      FROM goals WHERE id = 'goal-legacy-compatible'
    `)
      ).rows
    ).toEqual([
      {
        intentionKind: null,
        successCriteria: null,
        standards: null,
        reviewCadence: null,
        nextReviewLocalDate: null,
      },
    ]);
    expect(
      (
        await database.query(`
      SELECT "riskLevel", "riskNote", "nextReviewLocalDate"
      FROM projects WHERE id = 'project-legacy-compatible'
    `)
      ).rows
    ).toEqual([
      {
        riskLevel: "none",
        riskNote: null,
        nextReviewLocalDate: null,
      },
    ]);
  });

  it("creates empty RLS-protected commitment resolution and project dependency tables", async () => {
    expect(await count("commitmentResolutions")).toBe(0);
    expect(await count("projectDependencies")).toBe(0);
    expect(
      (
        await database.query(`
      SELECT relname, relrowsecurity FROM pg_class
      WHERE relname IN ('commitmentResolutions', 'projectDependencies')
      ORDER BY relname
    `)
      ).rows
    ).toEqual([
      { relname: "commitmentResolutions", relrowsecurity: true },
      { relname: "projectDependencies", relrowsecurity: true },
    ]);
  });

  it("enforces resolution operation and project-edge uniqueness", async () => {
    await database.exec(`
      INSERT INTO projects (id, "workspaceId", title)
      VALUES ('project-dependency', 'workspace-preserved', 'Dependency project');
      INSERT INTO "commitmentResolutions" (
        id, "workspaceId", "operationId", "dailyPlanItemId", "taskId", "occurrenceId",
        action, "originalScope", timezone
      ) VALUES (
        'resolution-1', 'workspace-preserved', 'operation-1', 'daily-plan-item-preserved',
        'task-preserved', NULL, 'pause', 'Preserve this task', 'Asia/Calcutta'
      );
      INSERT INTO "projectDependencies" (
        id, "workspaceId", "projectId", "dependsOnProjectId", "dependencyType"
      ) VALUES (
        'project-edge-1', 'workspace-preserved', 'project-preserved', 'project-dependency', 'hard'
      );
    `);

    await expect(
      database.exec(`
      INSERT INTO "commitmentResolutions" (
        id, "workspaceId", "operationId", "dailyPlanItemId", "taskId",
        action, "originalScope", timezone
      ) VALUES (
        'resolution-2', 'workspace-preserved', 'operation-1', 'daily-plan-item-preserved',
        'task-preserved', 'done', 'Preserve this task', 'Asia/Calcutta'
      )
    `)
    ).rejects.toThrow(/unique/i);

    await expect(
      database.exec(`
      INSERT INTO "projectDependencies" (
        id, "workspaceId", "projectId", "dependsOnProjectId", "dependencyType"
      ) VALUES (
        'project-edge-2', 'workspace-preserved', 'project-preserved', 'project-dependency', 'soft'
      )
    `)
    ).rejects.toThrow(/unique/i);
  });

  it("contains no destructive or data-rewriting statements", () => {
    expect(migration).not.toBe("");
    expect(migration).not.toMatch(/\b(?:drop|truncate|delete|update)\b/i);
  });

  it("exports the Phase 4 schema contract used by application code", () => {
    const schemaExports = plannerSchema as unknown as Record<string, unknown>;
    expect(getTableColumns(plannerSchema.workspaces)).toHaveProperty(
      "accountabilityLevel"
    );
    expect(getTableColumns(plannerSchema.goals)).toMatchObject({
      intentionKind: expect.anything(),
      successCriteria: expect.anything(),
      standards: expect.anything(),
      reviewCadence: expect.anything(),
      nextReviewLocalDate: expect.anything(),
    });
    expect(getTableColumns(plannerSchema.projects)).toMatchObject({
      riskLevel: expect.anything(),
      riskNote: expect.anything(),
      nextReviewLocalDate: expect.anything(),
    });
    expect(schemaExports.commitmentResolutions).toBeDefined();
    expect(schemaExports.projectDependencies).toBeDefined();
  });
});
