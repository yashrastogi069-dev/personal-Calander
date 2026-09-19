import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REVIEWED_MIGRATION_SHA256 =
  "a685febea7ea56aaedc5e179dcbb7d47566da9a7be00a2339c820677496bb12b";
export const APPLY_CONFIRMATION = "APPLY_PHASE4_PRODUCT_MIGRATION";
export const PRESERVED_TABLES = Object.freeze([
  "users",
  "workspaces",
  "tasks",
  "goals",
  "projects",
  "habits",
  "dailyPlans",
  "dailyPlanItems",
  "taskOccurrences",
]);

const MAX_PREFLIGHT_AGE_MS = 15 * 60 * 1000;
const MAX_BACKUP_EVIDENCE_AGE_MS = 24 * 60 * 60 * 1000;
const MIGRATION_LOCK_SQL =
  "SELECT pg_advisory_xact_lock(hashtext('phase4-product-model-0004'))";
const PRESERVATION_LOCK_SQL = `LOCK TABLE ${PRESERVED_TABLES.map(
  (table) => `"${table}"`
).join(", ")} IN SHARE MODE`;

const PHASE4_COLUMNS = Object.freeze({
  workspaces: {
    accountabilityLevel: { type: "text", nullable: false, defaulted: true },
  },
  goals: {
    intentionKind: { type: "text", nullable: true },
    successCriteria: { type: "text", nullable: true },
    standards: { type: "text", nullable: true },
    reviewCadence: { type: "text", nullable: true },
    nextReviewLocalDate: {
      type: "character varying",
      nullable: true,
    },
  },
  projects: {
    riskLevel: { type: "text", nullable: false, defaulted: true },
    riskNote: { type: "text", nullable: true },
    nextReviewLocalDate: {
      type: "character varying",
      nullable: true,
    },
  },
  commitmentResolutions: {
    id: { type: "character varying", nullable: false },
    workspaceId: { type: "character varying", nullable: false },
    operationId: { type: "character varying", nullable: false },
    dailyPlanItemId: { type: "character varying", nullable: false },
    taskId: { type: "character varying", nullable: false },
    occurrenceId: { type: "character varying", nullable: true },
    action: { type: "text", nullable: false },
    originalScope: { type: "text", nullable: false },
    revisedScope: { type: "text", nullable: true },
    resolvedToLocalDate: { type: "character varying", nullable: true },
    returnLocalDate: { type: "character varying", nullable: true },
    decisionNote: { type: "text", nullable: true },
    timezone: { type: "character varying", nullable: false },
    createdAt: { type: "timestamp without time zone", nullable: false },
    updatedAt: { type: "timestamp without time zone", nullable: false },
    version: { type: "integer", nullable: false },
  },
  projectDependencies: {
    id: { type: "character varying", nullable: false },
    workspaceId: { type: "character varying", nullable: false },
    projectId: { type: "character varying", nullable: false },
    dependsOnProjectId: { type: "character varying", nullable: false },
    dependencyType: { type: "text", nullable: false },
    createdAt: { type: "timestamp without time zone", nullable: false },
    updatedAt: { type: "timestamp without time zone", nullable: false },
    version: { type: "integer", nullable: false },
  },
});

const REQUIRED_UNIQUE_INDEXES = Object.freeze([
  "commitment_resolutions_workspace_operation_unique",
  "project_dependency_unique",
]);

export class MigrationGuardError extends Error {
  constructor(code) {
    super(code);
    this.name = "MigrationGuardError";
    this.code = code;
  }
}

export function sha256Text(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function projectFingerprint(projectIdentity) {
  if (typeof projectIdentity !== "string" || projectIdentity.length === 0) {
    return "unavailable";
  }
  return sha256Text(`phase4-project:${projectIdentity}`).slice(0, 16);
}

function timestampIsFresh(value, now, maximumAgeMs) {
  const timestamp = Date.parse(value);
  const current = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return (
    Number.isFinite(timestamp) &&
    Number.isFinite(current) &&
    timestamp <= current &&
    current - timestamp <= maximumAgeMs
  );
}

function hasCompleteTableFacts(inventory) {
  return PRESERVED_TABLES.every((table) => {
    const facts = inventory?.tables?.[table];
    return (
      Number.isSafeInteger(facts?.count) &&
      facts.count >= 0 &&
      Array.isArray(facts.ids) &&
      facts.ids.length === facts.count &&
      facts.ids.every((id) => typeof id === "string") &&
      new Set(facts.ids).size === facts.ids.length
    );
  });
}

function schemaFlags(inventory) {
  return {
    baseTablesPresent:
      inventory?.schemaCompatibility?.baseTablesPresent === true,
    preMigrationCompatible:
      inventory?.schemaCompatibility?.preMigrationCompatible === true,
    targetShapeCompatible:
      inventory?.schemaCompatibility?.targetShapeCompatible === true,
  };
}

function backupIsVerified(value, now) {
  return (
    typeof value?.reference === "string" &&
    value.reference.trim().length > 0 &&
    timestampIsFresh(
      value.restoreTestedAt,
      now,
      MAX_BACKUP_EVIDENCE_AGE_MS
    )
  );
}

function stripNonExecutableSql(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\r\n]*/g, " ")
    .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, " ")
    .replace(/'(?:''|[^'])*'/g, " ");
}

function containsDestructiveSql(sql) {
  return /\b(?:drop|truncate|delete|update|merge)\b/i.test(
    stripNonExecutableSql(sql)
  );
}

function readinessFacts({
  sql,
  reviewedSha256,
  expectedProjectIdentity,
  preflightInventory,
  backup,
  now,
}) {
  const migrationHash = sha256Text(sql);
  const inventoryFresh = timestampIsFresh(
    preflightInventory?.capturedAt,
    now,
    MAX_PREFLIGHT_AGE_MS
  );
  const projectMatched =
    typeof expectedProjectIdentity === "string" &&
    expectedProjectIdentity.length > 0 &&
    preflightInventory?.projectIdentity === expectedProjectIdentity;
  const flags = schemaFlags(preflightInventory);
  const facts = {
    reviewedSql:
      /^[a-f0-9]{64}$/.test(reviewedSha256 ?? "") &&
      migrationHash === reviewedSha256,
    additiveSql: !containsDestructiveSql(sql),
    projectMatched,
    inventoryFresh,
    schemaCompatible:
      flags.baseTablesPresent && flags.preMigrationCompatible,
    countsAndIdsPresent: hasCompleteTableFacts(preflightInventory),
    backupVerified: backupIsVerified(backup, now),
  };
  return {
    migrationHash,
    flags,
    facts: {
      ...facts,
      readyForApply: Object.values(facts).every(Boolean),
    },
  };
}

export function buildReadOnlyReport(options) {
  const { migrationHash, flags, facts } = readinessFacts(options);
  const counts = Object.fromEntries(
    PRESERVED_TABLES.map((table) => [
      table,
      Number.isSafeInteger(options.preflightInventory?.tables?.[table]?.count)
        ? options.preflightInventory.tables[table].count
        : null,
    ])
  );
  return {
    projectFingerprint: projectFingerprint(options.expectedProjectIdentity),
    schemaCompatibility: flags,
    migrationHash,
    aggregateCounts: counts,
    readiness: facts,
  };
}

function assertApplyGuards(options) {
  if (!options.preflightInventory) {
    throw new MigrationGuardError("PREFLIGHT_INVENTORY_REQUIRED");
  }
  const { migrationHash, flags, facts } = readinessFacts(options);
  if (migrationHash !== options.reviewedSha256) {
    throw new MigrationGuardError("SQL_HASH_MISMATCH");
  }
  if (containsDestructiveSql(options.sql)) {
    throw new MigrationGuardError("DESTRUCTIVE_SQL");
  }
  if (!facts.inventoryFresh) {
    throw new MigrationGuardError("PREFLIGHT_INVENTORY_STALE");
  }
  if (
    options.preflightInventory.projectIdentity !==
      options.expectedProjectIdentity ||
    options.databaseProjectIdentity !== options.expectedProjectIdentity
  ) {
    throw new MigrationGuardError("PROJECT_MISMATCH");
  }
  if (!flags.baseTablesPresent || !flags.preMigrationCompatible) {
    throw new MigrationGuardError("INCOMPATIBLE_SCHEMA");
  }
  if (!facts.countsAndIdsPresent) {
    throw new MigrationGuardError("INVENTORY_INCOMPLETE");
  }
  if (options.confirmation !== APPLY_CONFIRMATION) {
    throw new MigrationGuardError("EXPLICIT_CONFIRMATION_REQUIRED");
  }
  if (!facts.backupVerified) {
    throw new MigrationGuardError("VERIFIED_BACKUP_REQUIRED");
  }
  if (!options.client || typeof options.inspectDatabase !== "function") {
    throw new MigrationGuardError("DATABASE_ADAPTER_REQUIRED");
  }
}

function samePreservedRecords(left, right) {
  return PRESERVED_TABLES.every((table) => {
    const leftFacts = left?.tables?.[table];
    const rightFacts = right?.tables?.[table];
    return (
      leftFacts?.count === rightFacts?.count &&
      Array.isArray(leftFacts?.ids) &&
      Array.isArray(rightFacts?.ids) &&
      leftFacts.ids.length === rightFacts.ids.length &&
      leftFacts.ids.every((id, index) => id === rightFacts.ids[index])
    );
  });
}

export async function runMigrationController(options) {
  const normalized = {
    ...options,
    now: options.now ?? new Date(),
    mode: options.mode ?? "preflight",
  };
  const report = buildReadOnlyReport(normalized);
  if (normalized.mode !== "apply") {
    return { applied: false, report };
  }

  assertApplyGuards(normalized);
  const { client } = normalized;
  let transactionStarted = false;
  try {
    await client.connect();
    await client.query("BEGIN");
    transactionStarted = true;
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query(MIGRATION_LOCK_SQL);
    await client.query(PRESERVATION_LOCK_SQL);

    const lockedBefore = await normalized.inspectDatabase(client);
    const lockedFlags = schemaFlags(lockedBefore);
    if (
      lockedBefore?.projectIdentity !== normalized.expectedProjectIdentity ||
      !lockedFlags.baseTablesPresent ||
      !lockedFlags.preMigrationCompatible ||
      !hasCompleteTableFacts(lockedBefore)
    ) {
      throw new MigrationGuardError("INCOMPATIBLE_LOCKED_PREFLIGHT");
    }
    if (!samePreservedRecords(normalized.preflightInventory, lockedBefore)) {
      throw new MigrationGuardError("PREFLIGHT_CHANGED");
    }

    await client.query(normalized.sql);
    const lockedAfter = await normalized.inspectDatabase(client);
    const afterFlags = schemaFlags(lockedAfter);
    if (
      lockedAfter?.projectIdentity !== normalized.expectedProjectIdentity ||
      !afterFlags.baseTablesPresent ||
      !afterFlags.targetShapeCompatible ||
      !hasCompleteTableFacts(lockedAfter) ||
      !samePreservedRecords(lockedBefore, lockedAfter)
    ) {
      throw new MigrationGuardError("PRESERVATION_MISMATCH");
    }

    await client.query("COMMIT");
    transactionStarted = false;
    return { applied: true, report: buildReadOnlyReport(normalized) };
  } catch (error) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(() => undefined);
    }
    if (error instanceof MigrationGuardError) throw error;
    throw new MigrationGuardError("MIGRATION_TRANSACTION_FAILED");
  } finally {
    await client.end().catch(() => undefined);
  }
}

function exactColumnShape(columns, tableName, expected) {
  return Object.entries(expected).every(([columnName, shape]) => {
    const actual = columns.find(
      (column) =>
        column.table_name === tableName && column.column_name === columnName
    );
    return (
      actual?.data_type === shape.type &&
      (actual.is_nullable === "YES") === shape.nullable &&
      (!shape.defaulted || actual.column_default != null)
    );
  });
}

export async function inspectLiveDatabase(client, projectIdentity) {
  const relationResult = await client.query(`SELECT c.relname, c.relrowsecurity
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')`);
  const relations = new Map(
    relationResult.rows.map((row) => [row.relname, row.relrowsecurity === true])
  );
  const columnResult = await client.query(`SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'`);
  const indexResult = await client.query(`SELECT indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'`);
  const columns = columnResult.rows;
  const baseTablesPresent = PRESERVED_TABLES.every((table) =>
    relations.has(table)
  );
  const phase4ColumnNames = new Set(
    Object.entries(PHASE4_COLUMNS)
      .filter(([table]) => !["commitmentResolutions", "projectDependencies"].includes(table))
      .flatMap(([table, specs]) =>
        Object.keys(specs).map((column) => `${table}.${column}`)
      )
  );
  const hasAnyPhase4Column = columns.some((column) =>
    phase4ColumnNames.has(`${column.table_name}.${column.column_name}`)
  );
  const hasAnyPhase4Table = [
    "commitmentResolutions",
    "projectDependencies",
  ].some((table) => relations.has(table));
  const preMigrationCompatible =
    baseTablesPresent && !hasAnyPhase4Column && !hasAnyPhase4Table;
  const columnsCompatible = Object.entries(PHASE4_COLUMNS).every(
    ([table, expected]) => exactColumnShape(columns, table, expected)
  );
  const rlsCompatible = [
    "commitmentResolutions",
    "projectDependencies",
  ].every((table) => relations.get(table) === true);
  const uniqueIndexesCompatible = REQUIRED_UNIQUE_INDEXES.every((name) =>
    indexResult.rows.some(
      (index) =>
        index.indexname === name && /^CREATE UNIQUE INDEX\b/i.test(index.indexdef)
    )
  );

  const tables = {};
  for (const table of PRESERVED_TABLES) {
    const result = await client.query(
      `SELECT count(*)::int AS count, COALESCE(array_agg(id::text ORDER BY id::text), ARRAY[]::text[]) AS ids FROM "${table}"`
    );
    tables[table] = {
      count: Number(result.rows[0]?.count),
      ids: Array.isArray(result.rows[0]?.ids) ? result.rows[0].ids : [],
    };
  }
  return {
    version: 1,
    capturedAt: new Date().toISOString(),
    projectIdentity,
    schemaCompatibility: {
      baseTablesPresent,
      preMigrationCompatible,
      targetShapeCompatible:
        baseTablesPresent &&
        columnsCompatible &&
        rlsCompatible &&
        uniqueIndexesCompatible,
    },
    tables,
  };
}

export function extractSupabaseProjectIdentity(connectionString) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new MigrationGuardError("DATABASE_URL_INVALID");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new MigrationGuardError("DATABASE_URL_INVALID");
  }
  const direct = /^db\.([a-z0-9]{20})\.supabase\.co$/i.exec(
    url.hostname
  )?.[1];
  const documentedPoolerHost = /^(?:aws-\d+-)?[a-z]{2}(?:-[a-z0-9]+)+-\d+\.pooler\.supabase\.com$/i.test(
    url.hostname
  );
  let decodedUsername = "";
  try {
    decodedUsername = decodeURIComponent(url.username);
  } catch {
    throw new MigrationGuardError("DATABASE_URL_INVALID");
  }
  const pooled = documentedPoolerHost
    ? /^postgres\.([a-z0-9]{20})$/i.exec(decodedUsername)?.[1]
    : undefined;
  const identity = direct ?? pooled;
  if (!identity) throw new MigrationGuardError("PROJECT_IDENTITY_UNAVAILABLE");
  return identity;
}

export function buildVerifiedPgClientConfig(
  connectionString,
  suppliedCaCertificate
) {
  let url;
  try {
    url = new URL(connectionString);
  } catch {
    throw new MigrationGuardError("DATABASE_URL_INVALID");
  }
  extractSupabaseProjectIdentity(connectionString);

  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  if (
    sslMode &&
    !["require", "verify-full"].includes(sslMode)
  ) {
    throw new MigrationGuardError("TLS_MODE_FORBIDDEN");
  }
  if (
    [...url.searchParams.keys()].some(
      (key) => key.toLowerCase().startsWith("ssl") && key !== "sslmode"
    )
  ) {
    throw new MigrationGuardError("TLS_MODE_FORBIDDEN");
  }

  const ca =
    typeof suppliedCaCertificate === "string"
      ? suppliedCaCertificate.replace(/\\n/g, "\n").trim()
      : "";
  if (sslMode === "require" && !ca) {
    throw new MigrationGuardError("TLS_CA_REQUIRED");
  }
  if (
    ca &&
    !/^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END CERTIFICATE-----$/.test(
      ca
    )
  ) {
    throw new MigrationGuardError("TLS_CA_INVALID");
  }

  let user;
  let password;
  let database;
  try {
    user = decodeURIComponent(url.username);
    password = decodeURIComponent(url.password);
    database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    throw new MigrationGuardError("DATABASE_URL_INVALID");
  }
  const port = url.port ? Number(url.port) : 5432;
  if (
    !url.hostname ||
    !user ||
    !password ||
    !database ||
    !Number.isSafeInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new MigrationGuardError("DATABASE_URL_INVALID");
  }

  return {
    host: url.hostname,
    port,
    user,
    password,
    database,
    ssl: {
      rejectUnauthorized: true,
      ...(ca ? { ca } : {}),
    },
  };
}

function parseArguments(argv) {
  const values = {};
  let apply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      apply = true;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new MigrationGuardError("ARGUMENT_INVALID");
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new MigrationGuardError("ARGUMENT_VALUE_REQUIRED");
    }
    values[argument.slice(2)] = value;
    index += 1;
  }
  return { apply, values };
}

async function readInventory(path) {
  if (!path) return undefined;
  try {
    return JSON.parse(await readFile(resolve(path), "utf8"));
  } catch {
    throw new MigrationGuardError("PREFLIGHT_INVENTORY_UNREADABLE");
  }
}

async function main() {
  const { apply, values } = parseArguments(process.argv.slice(2));
  const sql = await readFile(
    new URL("../supabase/migrations/0004_phase4_product_model.sql", import.meta.url),
    "utf8"
  );
  const preflightInventory = await readInventory(values.inventory);
  const now = new Date();
  const common = {
    mode: apply ? "apply" : "preflight",
    sql,
    reviewedSha256: values["expected-sha"] ?? REVIEWED_MIGRATION_SHA256,
    expectedProjectIdentity: values.project,
    preflightInventory,
    backup: values["backup-reference"]
      ? {
          reference: values["backup-reference"],
          restoreTestedAt: values["backup-restore-tested-at"],
        }
      : undefined,
    confirmation: values.confirm,
    now,
  };

  if (!apply) {
    console.log(JSON.stringify(buildReadOnlyReport(common), null, 2));
    return;
  }

  if (common.reviewedSha256 !== REVIEWED_MIGRATION_SHA256) {
    throw new MigrationGuardError("SQL_HASH_NOT_REPOSITORY_REVIEWED");
  }
  await import("dotenv/config");
  const databaseUrl = process.env.SUPABASE_DB_URL;
  if (!databaseUrl) throw new MigrationGuardError("DATABASE_URL_REQUIRED");
  const databaseProjectIdentity = extractSupabaseProjectIdentity(databaseUrl);
  const { Client } = await import("pg");
  const client = new Client({
    ...buildVerifiedPgClientConfig(
      databaseUrl,
      process.env.SUPABASE_DB_CA_CERT
    ),
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
    query_timeout: 30_000,
  });
  const result = await runMigrationController({
    ...common,
    databaseProjectIdentity,
    client,
    inspectDatabase: (activeClient) =>
      inspectLiveDatabase(activeClient, databaseProjectIdentity),
  });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    const code =
      error instanceof MigrationGuardError
        ? error.code
        : "MIGRATION_CONTROLLER_FAILED";
    console.error(JSON.stringify({ applied: false, code }));
    process.exitCode = 1;
  });
}
