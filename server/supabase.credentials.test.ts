import { describe, expect, it, vi } from "vitest";
import { configurationSummary, probeCredentials } from "../scripts/audit-supabase.mjs";

const config = { VITE_SUPABASE_URL: "https://preview-project.supabase.co", VITE_SUPABASE_ANON_KEY: "sb_publishable_fake", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fake", SUPABASE_DB_URL: "postgresql://fake:fake@localhost:5432/test" };
describe("redacted service checks", () => {
  it("returns configuration booleans without serializing actual values", () => {
    expect(configurationSummary(config)).toEqual({ publicConfigured: true, serverConfigured: true, databaseConfigured: true });
    expect(configurationSummary({ ...config, SUPABASE_DB_URL: "" }).databaseConfigured).toBe(false);
    for (const value of Object.values(config)) expect(JSON.stringify(configurationSummary(config))).not.toContain(value);
  });
  it("uses an Auth settings GET and a zero-row REST HEAD, without bearer misuse of modern keys", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    expect(await probeCredentials(config, fetcher)).toEqual({ authOk: true, restOk: true, authStatus: 200, restStatus: 200 });
    expect(fetcher.mock.calls[1][0]).toContain("?select=id&limit=0");
    expect(fetcher.mock.calls[1][1]).toMatchObject({ method: "HEAD", headers: { apikey: "sb_secret_fake" } });
    expect(fetcher.mock.calls[1][1].headers).not.toHaveProperty("Authorization");
  });
  it("redacts network errors instead of exposing URLs, keys or response bodies", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error(Object.values(config).join(" ")));
    const result = await probeCredentials(config, fetcher);
    expect(result).toEqual({ authOk: false, restOk: false, authStatus: null, restStatus: null });
  });
});

describe.runIf(process.env.RUN_SUPABASE_SERVICE_TESTS === "1")("live Supabase credentials", () => {
  it("validates configuration without printing secrets", () => {
    expect(configurationSummary(process.env)).toEqual({ publicConfigured: true, serverConfigured: true, databaseConfigured: true });
  });
  it("reaches Auth and REST without fetching planner records", async () => {
    const result = await probeCredentials(process.env);
    expect(result.authOk, "Auth settings check failed").toBe(true);
    expect(result.restOk, "Zero-row REST access check failed").toBe(true);
  });
});
