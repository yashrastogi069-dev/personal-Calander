import { afterEach, describe, expect, it, vi } from "vitest";
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); });
describe("Supabase client bootstrap configuration", () => {
  it("allows the application to render recovery when public settings are missing", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
    const { supabase } = await import("../client/src/lib/supabase");
    expect(supabase).toBeNull();
  });
  it("does not throw before React mounts when the configured URL is malformed", async () => {
    vi.stubEnv("VITE_SUPABASE_URL", "invalid-url");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-key");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { supabase } = await import("../client/src/lib/supabase");
    expect(supabase).toBeNull();
  });
});
