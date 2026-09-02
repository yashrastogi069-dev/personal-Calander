import { Client } from "pg";

const rawConnectionString = process.env.SUPABASE_DB_URL;
if (!rawConnectionString) throw new Error("SUPABASE_DB_URL is missing");
const parsed = new URL(rawConnectionString);
parsed.searchParams.delete("sslmode");
parsed.searchParams.delete("uselibpqcompat");
const connectionString = parsed.toString();

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10_000,
  statement_timeout: 5_000,
  query_timeout: 5_000,
});
const started = Date.now();
try {
  await client.connect();
  const result = await client.query("select 1 as ok");
  console.log(JSON.stringify({ transport: "tls", status: "query-ok", rows: result.rowCount, elapsedMs: Date.now() - started }));
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown error";
  console.log(JSON.stringify({ transport: "tls", status: "failed", message, elapsedMs: Date.now() - started }));
  process.exitCode = 1;
} finally {
  await client.end().catch(() => undefined);
}
