import { describe, expect, it } from "vitest";

const projectUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.SUPABASE_DB_URL;

describe("Supabase project configuration", () => {
  it("has a complete user-owned project configuration", () => {
    expect(projectUrl, "VITE_SUPABASE_URL is required").toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i);
    expect(anonKey, "VITE_SUPABASE_ANON_KEY is required").toMatch(/^.+$/);
    expect(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required").toMatch(/^.+$/);
    expect(databaseUrl, "SUPABASE_DB_URL is required").toMatch(/^postgres(?:ql)?:\/\//i);
    expect(databaseUrl).not.toContain("[YOUR-PASSWORD]");
  });

  it("authenticates the browser-safe key against Supabase Auth", async () => {
    const response = await fetch(`${projectUrl!.replace(/\/$/, "")}/auth/v1/settings`, {
      headers: { apikey: anonKey! },
    });
    expect(response.ok, `Supabase Auth settings returned ${response.status}`).toBe(true);
  });

  it("authenticates the server-only key against the Supabase REST gateway", async () => {
    const response = await fetch(`${projectUrl!.replace(/\/$/, "")}/rest/v1/`, {
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey!}`,
      },
    });
    expect(response.ok, `Supabase REST gateway returned ${response.status}`).toBe(true);
  });

});
