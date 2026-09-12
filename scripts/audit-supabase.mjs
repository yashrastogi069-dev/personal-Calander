import { Client } from "pg";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

export const expectedPlannerTables = ["aiDrafts", "calendarFeeds", "categories", "dailyCheckIns", "dailyPlanItems", "dailyPlans", "externalEvents", "focusSessions", "goalMilestones", "goals", "habitCheckIns", "habits", "integrationConnections", "planningAvailabilityExceptions", "planningTemplates", "projects", "pushDeliveries", "pushSubscriptions", "reminderRules", "reminderSchedulers", "reviewSessions", "savedViews", "scheduleProposals", "syncConflicts", "syncOperationReceipts", "taskDependencies", "taskOccurrences", "taskReservationRollovers", "tasks", "users", "weeklyObjectives", "workspaces"];
const mimeTypes = ["application/pdf", "text/plain", "application/json", "image/jpeg", "image/png", "image/webp"];
const typeNames = new Set(["integer", "bigint", "smallint", "text", "character varying", "uuid", "jsonb", "json", "boolean", "timestamp without time zone", "timestamp with time zone", "date", "time without time zone", "numeric", "double precision", "real", "ARRAY", "USER-DEFINED"]);
const identifier = value => typeof value === "string" && /^[a-zA-Z_][a-zA-Z0-9_]{0,62}$/.test(value) && !/^(sb_secret_|sb_publishable_|eyJ)/.test(value) ? value : "redacted_identifier";
const count = value => value != null && value !== "" && Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const flag = value => value === true;

export function configurationSummary(env) {
  let publicUrl = false, databaseUrl = false;
  try { const url = new URL(env.VITE_SUPABASE_URL); publicUrl = url.protocol === "https:" && url.hostname.endsWith(".supabase.co") && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash; } catch {}
  try { const url = new URL(env.SUPABASE_DB_URL); databaseUrl = ["postgres:", "postgresql:"].includes(url.protocol) && Boolean(url.hostname && url.username && url.password) && !env.SUPABASE_DB_URL.includes("[YOUR-PASSWORD]"); } catch {}
  return { publicConfigured: publicUrl && Boolean(env.VITE_SUPABASE_ANON_KEY?.trim()), serverConfigured: publicUrl && Boolean(env.SUPABASE_SERVICE_ROLE_KEY?.trim()), databaseConfigured: databaseUrl };
}

export async function probeCredentials(env, fetcher = fetch) {
  const configured = configurationSummary(env);
  async function probe(path, key, method) {
    try {
      const headers = { apikey: key };
      if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
      const response = await fetcher(`${env.VITE_SUPABASE_URL.replace(/\/$/, "")}${path}`, { method, headers, signal: AbortSignal.timeout(10_000) });
      // Deliberately never read response bodies or any planner record.
      return { ok: response.ok === true, status: count(response.status) };
    } catch { return { ok: false, status: null }; }
  }
  const [auth, rest] = await Promise.all([
    configured.publicConfigured ? probe("/auth/v1/settings", env.VITE_SUPABASE_ANON_KEY, "GET") : { ok: false, status: null },
    configured.serverConfigured ? probe("/rest/v1/users?select=id&limit=0", env.SUPABASE_SERVICE_ROLE_KEY, "HEAD") : { ok: false, status: null },
  ]);
  return { authOk: auth.ok, restOk: rest.ok, authStatus: auth.status, restStatus: rest.status };
}

export function summarizeAudit(raw, options = {}) {
  // Explicit projection, never JSON-stringify query results or arbitrary errors.
  const tables = (raw.tables ?? []).map(table => ({ name: identifier(table.name), rowCount: count(table.rowCount), rlsEnabled: flag(table.rlsEnabled), columns: (table.columns ?? []).map(column => ({ name: identifier(column.name), type: typeNames.has(column.type) ? column.type : "other" })) }));
  const ownership = { workspaceCount: count(raw.ownership?.workspaceCount), ownedCount: count(raw.ownership?.ownedCount), targetCount: count(raw.ownership?.targetCount), conflictingCount: count(raw.ownership?.conflictingCount), accountCount: count(raw.ownership?.accountCount) };
  const columns = tables.find(table => table.name === "users")?.columns ?? [];
  const workspaceColumns = tables.find(table => table.name === "workspaces")?.columns ?? [];
  const legacy = columns.filter(column => ["openId", "supabaseUserId", "legacyExternalId"].includes(column.name));
  const auth = columns.find(column => column.name === "authUserId");
  const owner = workspaceColumns.find(column => column.name === "ownerUserId");
  const missingTables = expectedPlannerTables.filter(name => !tables.some(table => table.name === name));
  const identitySupported = legacy.length === 1 && ["text", "character varying"].includes(legacy[0].type) && (!auth || auth.type === "uuid") && (!owner || owner.type === "integer") && !workspaceColumns.some(column => column.name === "ownerSupabaseUserId");
  const issues = [];
  if (missingTables.length) issues.push("missing-planner-tables");
  if (!identitySupported) issues.push("unsupported-identity-shape");
  if (ownership.workspaceCount === 0) issues.push("no-existing-workspace");
  if (ownership.workspaceCount > 1 && !options.targetProvided) issues.push("multiple-workspaces-require-target");
  if (options.targetProvided && ownership.targetCount !== 1) issues.push("target-workspace-not-unique-or-missing");
  if (ownership.ownedCount > 0 && !options.accountProvided) issues.push("owned-workspace-requires-explicit-account");
  if (options.accountProvided && ownership.accountCount !== 1) issues.push("target-account-not-unique-or-missing");
  if (ownership.conflictingCount > 0) issues.push("conflicting-workspace-ownership");
  return {
    supported: issues.length === 0, issues, missingTables, tables,
    identity: { supported: identitySupported, legacyColumnCount: legacy.length, authUserIdPresent: Boolean(auth), ownerUserIdPresent: Boolean(owner) },
    ownership,
    policies: (raw.policies ?? []).map(policy => ({ schema: identifier(policy.schema), table: identifier(policy.table), name: identifier(policy.name) })),
    bucket: raw.bucket ? { present: true, private: raw.bucket.public === false, sizeLimitBytes: count(raw.bucket.file_size_limit), allowedMimeTypes: (raw.bucket.allowed_mime_types ?? []).filter(value => mimeTypes.includes(value)), unsupportedMimeTypeCount: (raw.bucket.allowed_mime_types ?? []).filter(value => !mimeTypes.includes(value)).length } : { present: false },
    extensions: (raw.extensions ?? []).filter(name => ["pg_cron", "pg_net", "supabase_vault"].includes(name)),
    cron: { catalogPresent: flag(raw.cron?.catalogPresent), namedJobCount: count(raw.cron?.namedJobCount) },
    journals: (raw.journals ?? []).map(journal => ({ schema: identifier(journal.schema), table: identifier(journal.table), present: flag(journal.present), rowCount: count(journal.rowCount) })),
  };
}

export async function auditDatabase(client, options = {}) {
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const tableRows = (await client.query("SELECT c.relname AS name, c.relrowsecurity AS \"rlsEnabled\" FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r','p') ORDER BY c.relname")).rows;
    const columnRows = (await client.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position")).rows;
    const tables = tableRows.map(table => ({ name: table.name, rlsEnabled: table.rlsEnabled, columns: columnRows.filter(column => column.table_name === table.name).map(column => ({ name: column.column_name, type: column.data_type })) }));
    const plannerNames = [...expectedPlannerTables, "plannerFiles"].filter(name => tables.some(table => table.name === name));
    if (plannerNames.length) {
      const counts = (await client.query(plannerNames.map(name => `SELECT '${name}' AS name, count(*)::text AS count FROM public."${name}"`).join(" UNION ALL "))).rows;
      for (const table of tables) table.rowCount = counts.find(row => row.name === table.name)?.count ?? null;
    }
    const policies = (await client.query('SELECT schemaname AS "schema", tablename AS "table", policyname AS "name" FROM pg_policies WHERE schemaname IN (\'public\',\'storage\') ORDER BY schemaname, tablename, policyname')).rows;
    const extensions = (await client.query("SELECT extname FROM pg_extension WHERE extname IN ('pg_cron','pg_net','supabase_vault') ORDER BY extname")).rows.map(row => row.extname);
    const hasTable = async name => (await client.query("SELECT to_regclass($1) IS NOT NULL AS present", [name])).rows[0]?.present === true;
    let bucket = null;
    if (await hasTable("storage.buckets")) bucket = (await client.query("SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'planner-files'")).rows[0] ?? null;
    const cron = { catalogPresent: await hasTable("cron.job"), namedJobCount: 0 };
    if (cron.catalogPresent) cron.namedJobCount = (await client.query("SELECT count(*)::text AS count FROM cron.job WHERE jobname = 'personal-calendar-reminder-sweep'")).rows[0].count;
    const journals = [];
    for (const [schema, table] of [["drizzle", "__drizzle_migrations"], ["supabase_migrations", "schema_migrations"]]) {
      const present = await hasTable(`${schema}.${table}`);
      const rowCount = present ? (await client.query(`SELECT count(*)::text AS count FROM "${schema}"."${table}"`)).rows[0].count : 0;
      journals.push({ schema, table, present, rowCount });
    }
    const workspace = tables.find(table => table.name === "workspaces");
    const owns = workspace?.columns.some(column => column.name === "ownerUserId");
    const ownership = { workspaceCount: workspace?.rowCount ?? 0, ownedCount: 0, targetCount: 0, conflictingCount: 0, accountCount: 0 };
    if (workspace) {
      const targetWhere = options.workspaceId ? " WHERE id = $1" : "";
      const values = options.workspaceId ? [options.workspaceId] : [];
      ownership.targetCount = (await client.query(`SELECT count(*)::text AS count FROM public.workspaces${targetWhere}`, values)).rows[0].count;
      if (owns) {
        ownership.ownedCount = (await client.query(`SELECT count(*)::text AS count FROM public.workspaces WHERE "ownerUserId" IS NOT NULL${options.workspaceId ? " AND id = $1" : ""}`, values)).rows[0].count;
        if (options.ownerUserId != null) ownership.conflictingCount = (await client.query(`SELECT count(*)::text AS count FROM public.workspaces WHERE "ownerUserId" IS NOT NULL AND "ownerUserId" <> $1${options.workspaceId ? " AND id = $2" : ""}`, options.workspaceId ? [options.ownerUserId, options.workspaceId] : [options.ownerUserId])).rows[0].count;
      }
    }
    if (options.ownerUserId != null && tables.some(table => table.name === "users")) ownership.accountCount = (await client.query("SELECT count(*)::text AS count FROM public.users WHERE id = $1", [options.ownerUserId])).rows[0].count;
    const report = summarizeAudit({ tables, policies, extensions, bucket, cron, journals, ownership }, { targetProvided: Boolean(options.workspaceId), accountProvided: options.ownerUserId != null });
    await client.query("COMMIT");
    return report;
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    throw new Error("Read-only audit failed.");
  }
}

export async function runLiveAudit(env) {
  if (!configurationSummary(env).databaseConfigured) return { connected: false, supported: false, issues: ["database-configuration-missing-or-invalid"] };
  const ownerUserId = env.AUDIT_OWNER_USER_ID ? Number(env.AUDIT_OWNER_USER_ID) : undefined;
  if (ownerUserId !== undefined && (!Number.isSafeInteger(ownerUserId) || ownerUserId < 1)) return { connected: false, supported: false, issues: ["invalid-explicit-account-id"] };
  let client;
  try {
    const url = new URL(env.SUPABASE_DB_URL);
    url.searchParams.delete("sslmode"); url.searchParams.delete("uselibpqcompat");
    client = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 10_000, query_timeout: 12_000, options: "-c default_transaction_read_only=on" });
    await client.connect();
    return { connected: true, ...await auditDatabase(client, { workspaceId: env.AUDIT_WORKSPACE_ID || undefined, ownerUserId }) };
  } catch { return { connected: false, supported: false, issues: ["connection-or-read-only-query-failed"] }; }
  finally { await client?.end().catch(() => undefined); }
}

async function main() {
  // Only CLI invocation loads local secrets; importing for offline tests does not.
  await import("dotenv/config");
  const report = await runLiveAudit(process.env);
  const output = JSON.stringify(report, null, 2);
  const outputArg = process.argv.indexOf("--output");
  if (outputArg !== -1) {
    const target = process.argv[outputArg + 1];
    if (!target) throw new Error("Output path required.");
    await writeFile(target, output + "\n", { encoding: "utf8", flag: "wx" });
  }
  console.log(output);
  if (!report.connected || !report.supported) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(() => { console.error(JSON.stringify({ connected: false, supported: false, issues: ["audit-output-failed"] })); process.exitCode = 1; });
}
