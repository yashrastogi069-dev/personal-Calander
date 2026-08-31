import { Client } from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) throw new Error("SUPABASE_DB_URL is missing");

for (const ssl of [false, { rejectUnauthorized: false }]) {
  const client = new Client({
    connectionString,
    ssl,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
    query_timeout: 5000,
  });
  const started = Date.now();
  try {
    await client.connect();
    const result = await client.query("select 1 as ok");
    console.log(JSON.stringify({ ssl: Boolean(ssl), status: "query-ok", rows: result.rowCount, elapsedMs: Date.now() - started }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.log(JSON.stringify({ ssl: Boolean(ssl), status: "failed", message, elapsedMs: Date.now() - started }));
  } finally {
    await client.end().catch(() => undefined);
  }
}
