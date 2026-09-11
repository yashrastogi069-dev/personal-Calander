import { describe, expect, it } from "vitest";
import { auditDatabase, summarizeAudit, expectedPlannerTables, runLiveAudit } from "../scripts/audit-supabase.mjs";

const base = () => ({
  tables: expectedPlannerTables.map((name: string) => ({ name, rowCount: 0, rlsEnabled: true, columns: name === "users" ? [{ name: "legacyExternalId", type: "character varying" }, { name: "authUserId", type: "uuid" }] : name === "workspaces" ? [{ name: "ownerUserId", type: "integer" }] : [] })),
  policies: [], ownership: { workspaceCount: 1, ownedCount: 0, targetCount: 1, conflictingCount: 0, accountCount: 0 },
  extensions: [], bucket: null, journals: [],
});

describe("read-only audit safety", () => {
  it("projects only structural metadata and counts, never row content or credentials", () => {
    const raw = { ...base(), databaseUrl: "postgres://secret@host/db", apiKey: "sb_secret_sensitive", bearer: "Bearer sensitive", email: "owner@example.test", title: "private title", notes: "private notes", objectPath: "owner/private-file.pdf", endpoint: "https://push.example/private" };
    raw.tables[0] = { ...raw.tables[0], title: raw.title, rows: [raw] } as never;
    const encoded = JSON.stringify(summarizeAudit(raw));
    for (const value of [raw.databaseUrl, raw.apiKey, raw.bearer, raw.email, raw.title, raw.notes, raw.objectPath, raw.endpoint]) expect(encoded).not.toContain(value);
    expect(JSON.parse(encoded)).toMatchObject({ supported: true, ownership: { workspaceCount: 1 } });
  });
  it("refuses missing tables, ambiguous identity and unresolved/conflicting ownership", () => {
    const missing = base(); missing.tables = missing.tables.filter((table: any) => table.name !== "tasks");
    expect(summarizeAudit(missing).issues).toContain("missing-planner-tables");
    const ambiguous = base(); ambiguous.tables.find((table: any) => table.name === "users")!.columns.push({ name: "openId", type: "text" });
    expect(summarizeAudit(ambiguous).issues).toContain("unsupported-identity-shape");
    const multiple = base(); multiple.ownership.workspaceCount = 2;
    expect(summarizeAudit(multiple).issues).toContain("multiple-workspaces-require-target");
    const empty = base(); empty.ownership.workspaceCount = 0;
    expect(summarizeAudit(empty).issues).toContain("no-existing-workspace");
    const conflict = base(); conflict.ownership.conflictingCount = 1;
    expect(summarizeAudit(conflict, { targetProvided: true, accountProvided: true }).issues).toContain("conflicting-workspace-ownership");
  });
  it("masks unsafe metadata strings and ignores unexpected fields", () => {
    const raw = base(); raw.policies = [{ schema: "public", table: "tasks", name: "sb_secret_sensitive", definition: "owner@example.test" }] as never;
    const encoded = JSON.stringify(summarizeAudit(raw));
    expect(encoded).not.toContain("sb_secret_sensitive"); expect(encoded).not.toContain("owner@example.test");
    raw.tables[0].rowCount = null as never;
    expect(summarizeAudit(raw).tables[0].rowCount).toBeNull();
  });
  it("begins read-only, sets the timeout, and rolls back failures without returning raw errors", async () => {
    const queries: string[] = [];
    const client = { query: async (query: string) => { queries.push(query); if (query.startsWith("SELECT")) throw new Error("postgres://secret@host/db owner@example.test"); return { rows: [] }; } };
    await expect(auditDatabase(client)).rejects.toThrow("Read-only audit failed.");
    expect(queries[0]).toBe("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(queries[1]).toBe("SET LOCAL statement_timeout = '10s'");
    expect(queries.at(-1)).toBe("ROLLBACK");
  });
});

describe.runIf(process.env.RUN_SUPABASE_SERVICE_TESTS === "1")("live read-only database connection", () => {
  it("can collect a redacted structural report", async () => {
    const result = await runLiveAudit(process.env);
    expect(result.connected, "Database connection/read-only audit failed; no credential details are logged").toBe(true);
  });
});
