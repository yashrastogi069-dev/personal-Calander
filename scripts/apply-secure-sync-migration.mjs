import "dotenv/config";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Client } from "pg";

const expectedProjectRef = "dwiudauuuxzstbavkkqa";
const expectedHash = "76317d677c18ebda2a14ac59e710e8230a63988a8babd87c0a38ee354ce50ea0";
const raw = process.env.SUPABASE_DB_URL;
if (!raw) throw new Error("SUPABASE_DB_URL is missing.");
const parsed = new URL(raw);
if (!`${parsed.hostname} ${parsed.username}`.includes(expectedProjectRef)) throw new Error("Refusing to migrate an unexpected Supabase project.");
parsed.searchParams.delete("sslmode");
parsed.searchParams.delete("uselibpqcompat");

const sql = await readFile(new URL("../supabase/migrations/0003_good_lady_deathstrike.sql", import.meta.url), "utf8");
const hash = createHash("sha256").update(sql).digest("hex");
if (hash !== expectedHash) throw new Error("Migration file changed after verification; inspect it again before applying.");
if (/\b(drop|truncate)\b/i.test(sql)) throw new Error("Destructive SQL is forbidden in the secure-sync migration.");

const client = new Client({
  connectionString: parsed.toString(),
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  statement_timeout: 15_000,
  query_timeout: 15_000,
});

try {
  await client.connect();
  await client.query("begin");
  await client.query("set local lock_timeout = '5s'");
  const before = (await client.query(`select
    to_regclass('public."syncOperationReceipts"') is not null as receipts_exists,
    to_regclass('public."syncConflicts"') is not null as conflicts_exists,
    (select count(*)::int from public.workspaces) as workspace_count,
    (select count(*)::int from public.tasks) as task_count`)).rows[0];
  if (before.receipts_exists || before.conflicts_exists) throw new Error("Secure-sync tables already exist; refusing a partial or duplicate apply.");
  await client.query(sql);
  const after = (await client.query(`select
    to_regclass('public."syncOperationReceipts"') is not null as receipts_exists,
    to_regclass('public."syncConflicts"') is not null as conflicts_exists,
    (select count(*)::int from public.workspaces) as workspace_count,
    (select count(*)::int from public.tasks) as task_count`)).rows[0];
  if (!after.receipts_exists || !after.conflicts_exists || before.workspace_count !== after.workspace_count || before.task_count !== after.task_count) {
    throw new Error("Post-migration preservation check failed.");
  }
  await client.query("commit");
  console.log(JSON.stringify({ applied: true, preserved: { workspaces: after.workspace_count, tasks: after.task_count }, created: ["syncConflicts", "syncOperationReceipts"] }));
} catch (error) {
  await client.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await client.end().catch(() => undefined);
}
