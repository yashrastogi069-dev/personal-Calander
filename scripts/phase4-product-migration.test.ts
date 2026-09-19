import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import {
  APPLY_CONFIRMATION,
  PRESERVED_TABLES,
  REVIEWED_MIGRATION_SHA256,
  buildVerifiedPgClientConfig,
  buildReadOnlyReport,
  extractSupabaseProjectIdentity,
  runMigrationController,
  sha256Text,
} from "./apply-phase4-product-migration.mjs";

const NOW = new Date("2026-09-20T12:00:00.000Z");
const PROJECT = "planner-production";
const SQL = `CREATE TABLE "commitmentResolutions" ("id" varchar(64) PRIMARY KEY);
ALTER TABLE "goals" ADD COLUMN "intentionKind" text;`;

function tableFacts(suffix = "before") {
  return Object.fromEntries(
    PRESERVED_TABLES.map((table, index) => [
      table,
      {
        count: index + 1,
        ids: Array.from(
          { length: index + 1 },
          (_, idIndex) => `${table}-${suffix}-${idIndex + 1}`
        ),
      },
    ])
  );
}

function inventory(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    capturedAt: "2026-09-20T11:55:00.000Z",
    projectIdentity: PROJECT,
    schemaCompatibility: {
      baseTablesPresent: true,
      preMigrationCompatible: true,
      targetShapeCompatible: false,
    },
    tables: tableFacts(),
    ...overrides,
  };
}

function backup(overrides: Record<string, unknown> = {}) {
  return {
    reference: "backup://phase4/verified-2026-09-20",
    restoreTestedAt: "2026-09-20T11:30:00.000Z",
    ...overrides,
  };
}

class RecordingClient {
  events: string[] = [];

  async connect() {
    this.events.push("connect");
  }

  async query(sql: string) {
    this.events.push(sql);
    return { rows: [] };
  }

  async end() {
    this.events.push("end");
  }
}

function applyOptions(overrides: Record<string, unknown> = {}) {
  const client = new RecordingClient();
  const before = inventory();
  const after = inventory({
    capturedAt: NOW.toISOString(),
    schemaCompatibility: {
      baseTablesPresent: true,
      preMigrationCompatible: false,
      targetShapeCompatible: true,
    },
  });
  return {
    mode: "apply" as const,
    sql: SQL,
    reviewedSha256: sha256Text(SQL),
    expectedProjectIdentity: PROJECT,
    databaseProjectIdentity: PROJECT,
    preflightInventory: before,
    backup: backup(),
    confirmation: APPLY_CONFIRMATION,
    client,
    now: NOW,
    inspectDatabase: vi
      .fn()
      .mockResolvedValueOnce(before)
      .mockResolvedValueOnce(after),
    ...overrides,
  };
}

describe("Phase 4 product migration controller", () => {
  it("keeps default mode read-only when --apply is missing", async () => {
    const client = new RecordingClient();
    const result = await runMigrationController({
      mode: "preflight",
      sql: SQL,
      reviewedSha256: sha256Text(SQL),
      expectedProjectIdentity: PROJECT,
      preflightInventory: inventory(),
      backup: backup(),
      client,
      now: NOW,
    });

    expect(result.applied).toBe(false);
    expect(result.report.readiness.readyForApply).toBe(true);
    expect(client.events).toEqual([]);
  });

  it("refuses an apply when the reviewed SQL hash is wrong", async () => {
    const options = applyOptions({ reviewedSha256: "0".repeat(64) });

    await expect(runMigrationController(options)).rejects.toMatchObject({
      code: "SQL_HASH_MISMATCH",
    });
    expect(options.client.events).toEqual([]);
  });

  it("refuses an apply to a different project", async () => {
    const options = applyOptions({ databaseProjectIdentity: "other-project" });

    await expect(runMigrationController(options)).rejects.toMatchObject({
      code: "PROJECT_MISMATCH",
    });
    expect(options.client.events).toEqual([]);
  });

  it("refuses an apply without a fresh preflight inventory", async () => {
    const missing = applyOptions({ preflightInventory: undefined });
    await expect(runMigrationController(missing)).rejects.toMatchObject({
      code: "PREFLIGHT_INVENTORY_REQUIRED",
    });

    const stale = applyOptions({
      preflightInventory: inventory({
        capturedAt: "2026-09-20T11:30:00.000Z",
      }),
    });
    await expect(runMigrationController(stale)).rejects.toMatchObject({
      code: "PREFLIGHT_INVENTORY_STALE",
    });
  });

  it("refuses SQL containing a destructive statement", async () => {
    const destructiveSql = `${SQL}\nDELETE FROM tasks;`;
    const options = applyOptions({
      sql: destructiveSql,
      reviewedSha256: sha256Text(destructiveSql),
    });

    await expect(runMigrationController(options)).rejects.toMatchObject({
      code: "DESTRUCTIVE_SQL",
    });
    expect(options.client.events).toEqual([]);
  });

  it("refuses an existing incompatible table or column shape", async () => {
    const options = applyOptions({
      preflightInventory: inventory({
        schemaCompatibility: {
          baseTablesPresent: true,
          preMigrationCompatible: false,
          targetShapeCompatible: false,
        },
      }),
    });

    await expect(runMigrationController(options)).rejects.toMatchObject({
      code: "INCOMPATIBLE_SCHEMA",
    });
    expect(options.client.events).toEqual([]);
  });

  it("requires exact confirmation and restore-tested backup evidence", async () => {
    await expect(
      runMigrationController(applyOptions({ confirmation: "yes" }))
    ).rejects.toMatchObject({ code: "EXPLICIT_CONFIRMATION_REQUIRED" });

    await expect(
      runMigrationController(
        applyOptions({ backup: backup({ restoreTestedAt: undefined }) })
      )
    ).rejects.toMatchObject({ code: "VERIFIED_BACKUP_REQUIRED" });
  });

  it("locks, rechecks, executes the exact SQL, verifies preservation, and commits", async () => {
    const options = applyOptions();

    const result = await runMigrationController(options);

    expect(result.applied).toBe(true);
    expect(options.inspectDatabase).toHaveBeenCalledTimes(2);
    expect(options.client.events).toEqual([
      "connect",
      "BEGIN",
      "SET LOCAL lock_timeout = '5s'",
      "SELECT pg_advisory_xact_lock(hashtext('phase4-product-model-0004'))",
      'LOCK TABLE "users", "workspaces", "tasks", "goals", "projects", "habits", "dailyPlans", "dailyPlanItems", "taskOccurrences" IN SHARE MODE',
      SQL,
      "COMMIT",
      "end",
    ]);
  });

  it("rolls back on any aggregate count delta", async () => {
    const changedTables = tableFacts();
    changedTables.tasks = {
      count: changedTables.tasks.count + 1,
      ids: [...changedTables.tasks.ids, "tasks-before-new"],
    };
    const options = applyOptions({
      inspectDatabase: vi
        .fn()
        .mockResolvedValueOnce(inventory())
        .mockResolvedValueOnce(
          inventory({
            schemaCompatibility: {
              baseTablesPresent: true,
              preMigrationCompatible: false,
              targetShapeCompatible: true,
            },
            tables: changedTables,
          })
        ),
    });

    await expect(runMigrationController(options)).rejects.toMatchObject({
      code: "PRESERVATION_MISMATCH",
    });
    expect(options.client.events).toContain("ROLLBACK");
    expect(options.client.events).not.toContain("COMMIT");
  });

  it("rolls back when IDs change even if aggregate counts match", async () => {
    const changedTables = tableFacts();
    changedTables.goals = {
      count: changedTables.goals.count,
      ids: changedTables.goals.ids.map((id, index) =>
        index === 0 ? "different-id" : id
      ),
    };
    const options = applyOptions({
      inspectDatabase: vi
        .fn()
        .mockResolvedValueOnce(inventory())
        .mockResolvedValueOnce(
          inventory({
            schemaCompatibility: {
              baseTablesPresent: true,
              preMigrationCompatible: false,
              targetShapeCompatible: true,
            },
            tables: changedTables,
          })
        ),
    });

    await expect(runMigrationController(options)).rejects.toMatchObject({
      code: "PRESERVATION_MISMATCH",
    });
    expect(options.client.events).toContain("ROLLBACK");
  });

  it("rolls back if the locked recheck differs from the supplied inventory", async () => {
    const changedTables = tableFacts();
    changedTables.projects = {
      count: changedTables.projects.count,
      ids: changedTables.projects.ids.map((id, index) =>
        index === 0 ? "project-created-after-audit" : id
      ),
    };
    const options = applyOptions({
      inspectDatabase: vi.fn().mockResolvedValueOnce(
        inventory({ tables: changedTables })
      ),
    });

    await expect(runMigrationController(options)).rejects.toMatchObject({
      code: "PREFLIGHT_CHANGED",
    });
    expect(options.client.events).toContain("ROLLBACK");
    expect(options.client.events).not.toContain(SQL);
  });

  it("projects only safe fields in reports and never serializes secrets or IDs", () => {
    const secret = "postgresql://admin:super-secret@example.invalid/planner";
    const report = buildReadOnlyReport({
      sql: SQL,
      reviewedSha256: sha256Text(SQL),
      expectedProjectIdentity: PROJECT,
      preflightInventory: inventory({
        connectionString: secret,
        serviceRoleKey: "sb_secret_never-print",
      }),
      backup: backup(),
      now: NOW,
    });
    const output = JSON.stringify(report);

    expect(Object.keys(report).sort()).toEqual([
      "aggregateCounts",
      "migrationHash",
      "projectFingerprint",
      "readiness",
      "schemaCompatibility",
    ]);
    expect(output).not.toContain("super-secret");
    expect(output).not.toContain("sb_secret");
    expect(output).not.toContain(PROJECT);
    expect(output).not.toContain("goals-before");
  });

  it("pins the repository migration to its reviewed SHA-256", () => {
    const repositoryMigration = readFileSync(
      new URL(
        "../supabase/migrations/0004_phase4_product_model.sql",
        import.meta.url
      ),
      "utf8"
    );
    expect(sha256Text(repositoryMigration)).toBe(REVIEWED_MIGRATION_SHA256);
  });

  it("cannot disable certificate or hostname verification for apply connections", () => {
    const base =
      "postgresql://postgres.abcdefghijklmnopqrst:synthetic-password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";

    expect(() =>
      buildVerifiedPgClientConfig(`${base}?sslmode=disable`)
    ).toThrow(expect.objectContaining({ code: "TLS_MODE_FORBIDDEN" }));
    expect(() =>
      buildVerifiedPgClientConfig(`${base}?sslmode=require`)
    ).toThrow(expect.objectContaining({ code: "TLS_CA_REQUIRED" }));

    const ca =
      "-----BEGIN CERTIFICATE-----\nZmFrZQ==\n-----END CERTIFICATE-----";
    const withCa = buildVerifiedPgClientConfig(
      `${base}?sslmode=require`,
      ca
    );
    expect(withCa).toMatchObject({
      host: "aws-0-ap-south-1.pooler.supabase.com",
      port: 5432,
      user: "postgres.abcdefghijklmnopqrst",
      database: "postgres",
      ssl: { rejectUnauthorized: true, ca },
    });
    expect(JSON.stringify(withCa)).not.toContain("rejectUnauthorized\":false");

    const systemTrust = buildVerifiedPgClientConfig(base);
    expect(systemTrust.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("binds project identity to a documented Supabase database host", () => {
    const project = "abcdefghijklmnopqrst";
    const direct = `postgresql://postgres:synthetic-password@db.${project}.supabase.co:5432/postgres`;
    const awsPooler = `postgresql://postgres.${project}:synthetic-password@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`;
    const regionalPooler = `postgresql://postgres.${project}:synthetic-password@ap-south-1.pooler.supabase.com:5432/postgres`;
    const forged = `postgresql://postgres.${project}:synthetic-password@evil.example:5432/postgres`;

    expect(extractSupabaseProjectIdentity(direct)).toBe(project);
    expect(extractSupabaseProjectIdentity(awsPooler)).toBe(project);
    expect(extractSupabaseProjectIdentity(regionalPooler)).toBe(project);
    expect(buildVerifiedPgClientConfig(direct).ssl).toEqual({
      rejectUnauthorized: true,
    });
    expect(() => extractSupabaseProjectIdentity(forged)).toThrow(
      expect.objectContaining({ code: "PROJECT_IDENTITY_UNAVAILABLE" })
    );
    expect(() => buildVerifiedPgClientConfig(forged)).toThrow(
      expect.objectContaining({ code: "PROJECT_IDENTITY_UNAVAILABLE" })
    );
  });
});
