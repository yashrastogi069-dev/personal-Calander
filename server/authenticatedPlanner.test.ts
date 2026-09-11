import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ auth: {} as any, workspace: {} as any }));
vi.mock("../client/src/_core/hooks/useAuth", () => ({ useAuth: () => state.auth }));
vi.mock("../client/src/lib/trpc", () => ({ trpc: { auth: { workspace: { useQuery: () => state.workspace } } } }));
vi.mock("../client/src/components/SupabaseAuthGate", () => ({ SupabaseAuthGate: () => "SIGN_IN" }));
import { AuthenticatedPlanner } from "../client/src/components/AuthenticatedPlanner";
const render = () => renderToStaticMarkup(createElement(AuthenticatedPlanner, { children: "PRIVATE_PLANNER" }));
beforeEach(() => {
  state.auth = { loading: false, error: null, isAuthenticated: false, user: null, refresh: vi.fn(), logout: vi.fn() };
  state.workspace = { data: null, error: null, isLoading: false, refetch: vi.fn() };
});
describe("active planner authentication boundary", () => {
  it("shows sign-in without mounting private planner content", () => {
    expect(render()).toContain("SIGN_IN");
    expect(render()).not.toContain("PRIVATE_PLANNER");
  });
  it("exposes account failure instead of a permanent loading screen", () => {
    state.auth.error = new Error("Database unavailable");
    expect(render()).toContain("Your account could not load");
    expect(render()).not.toContain("PRIVATE_PLANNER");
  });
  it("does not invent a workspace for an authenticated but unlinked account", () => {
    state.auth = { ...state.auth, isAuthenticated: true, user: { id: 41, authUserId: "11111111-1111-4111-8111-111111111111" } };
    expect(render()).toContain("waiting to be connected");
    expect(render()).not.toContain("PRIVATE_PLANNER");
  });
  it("mounts the planner only after the server resolves the owned workspace", () => {
    state.auth = { ...state.auth, isAuthenticated: true, user: { id: 41, authUserId: "11111111-1111-4111-8111-111111111111" } };
    state.workspace.data = { id: "existing-workspace-a", timezone: "UTC" };
    expect(render()).toContain("PRIVATE_PLANNER");
  });
});
