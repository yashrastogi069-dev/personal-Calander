import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  upsertAuthenticatedUser: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));
vi.mock("./db", () => ({
  upsertAuthenticatedUser: mocks.upsertAuthenticatedUser,
}));

import { SupabaseAuthGate, startGoogleOAuth } from "../client/src/components/SupabaseAuthGate";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { authenticateSupabaseBearer } from "./supabaseAuth";

const persistedUser = {
  id: 41,
  authUserId: "11111111-1111-4111-8111-111111111111",
  legacyExternalId: null,
  name: "Calendar Owner",
  email: "owner@example.test",
  avatarUrl: "https://images.example.test/avatar.png",
  loginMethod: "google",
  role: "user" as const,
  createdAt: new Date("2026-09-06T08:00:00.000Z"),
  updatedAt: new Date("2026-09-06T09:00:00.000Z"),
  lastSignedIn: new Date("2026-09-06T09:00:00.000Z"),
};

beforeEach(() => {
  vi.stubEnv("VITE_SUPABASE_URL", "https://calendar-owner.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");
  mocks.getUser.mockReset();
  mocks.upsertAuthenticatedUser.mockReset();
  mocks.createClient.mockImplementation(() => ({ auth: { getUser: mocks.getUser } }));
});

afterEach(() => vi.unstubAllEnvs());

describe("Supabase identity boundary", () => {
  it("fails clearly when server credentials are absent", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(() => getSupabaseAdmin()).toThrow("Supabase server authentication is not configured.");
  });

  it("maps a validated Google account and returns its persisted internal user", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: {
        id: persistedUser.authUserId,
        email: persistedUser.email,
        app_metadata: { provider: "google", providers: ["google"] },
        user_metadata: { full_name: persistedUser.name, avatar_url: persistedUser.avatarUrl },
        last_sign_in_at: "2026-09-06T09:00:00.000Z",
      } },
      error: null,
    });
    mocks.upsertAuthenticatedUser.mockResolvedValue(persistedUser);

    await expect(authenticateSupabaseBearer("validated-access-token")).resolves.toEqual(persistedUser);
    expect(mocks.upsertAuthenticatedUser).toHaveBeenCalledWith({
      authUserId: persistedUser.authUserId,
      name: persistedUser.name,
      email: persistedUser.email,
      avatarUrl: persistedUser.avatarUrl,
      loginMethod: "google",
      lastSignedIn: new Date("2026-09-06T09:00:00.000Z"),
    });
  });

  it("uses the email identity fallback and rejects an invalid bearer without persistence", async () => {
    mocks.getUser.mockResolvedValueOnce({
      data: { user: {
        id: persistedUser.authUserId,
        email: persistedUser.email,
        app_metadata: {},
        user_metadata: {},
        last_sign_in_at: "2026-09-06T09:00:00.000Z",
      } },
      error: null,
    });
    mocks.upsertAuthenticatedUser.mockResolvedValueOnce({ ...persistedUser, name: null, avatarUrl: null, loginMethod: "supabase_email" });
    await authenticateSupabaseBearer("email-access-token");
    expect(mocks.upsertAuthenticatedUser).toHaveBeenCalledWith(expect.objectContaining({
      authUserId: persistedUser.authUserId,
      name: null,
      avatarUrl: null,
      loginMethod: "supabase_email",
    }));

    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new Error("invalid token") });
    mocks.upsertAuthenticatedUser.mockClear();
    await expect(authenticateSupabaseBearer("invalid-access-token")).resolves.toBeNull();
    expect(mocks.upsertAuthenticatedUser).not.toHaveBeenCalled();
  });
});

describe("Google OAuth entry point", () => {
  it("starts Google OAuth at the current application origin", async () => {
    const signInWithOAuth = vi.fn().mockResolvedValue({ data: { provider: "google", url: "https://accounts.google.test" }, error: null });
    await expect(startGoogleOAuth({ auth: { signInWithOAuth } }, "https://calendar.example.test"))
      .resolves.toMatchObject({ error: null });
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://calendar.example.test" },
    });
  });

  it("keeps Google and email/password sign-in visible together", () => {
    const html = renderToStaticMarkup(createElement(SupabaseAuthGate));
    expect(html).toContain("Continue with Google");
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
  });
});
