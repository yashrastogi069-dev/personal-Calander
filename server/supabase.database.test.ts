import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getDb } from "./db";

describe("Supabase PostgreSQL database adapter", () => {
  it("reaches the user-owned database over TLS with a read-only query", async () => {
    const db = await getDb();
    expect(db, "SUPABASE_DB_URL must produce a database client").not.toBeNull();
    const result = await db!.execute(sql`select 1 as ok`);
    expect(result.rows[0]).toMatchObject({ ok: 1 });
  });
});
