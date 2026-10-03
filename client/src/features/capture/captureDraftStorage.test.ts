import { afterEach, describe, expect, it, vi } from "vitest";
import { captureDraftStorageKey, clearCaptureDraft, clearCaptureDraftIfUnchanged, newCaptureRequestId, readCaptureDraft, writeCaptureDraft } from "./captureDraftStorage";
import type { PlannerSyncScope } from "@/lib/offlineSync";

const accountA: PlannerSyncScope = { accountId: "account-a", workspaceId: "workspace-1" };
const accountB: PlannerSyncScope = { accountId: "account-b", workspaceId: "workspace-1" };
const workspaceB: PlannerSyncScope = { accountId: "account-a", workspaceId: "workspace-2" };

function installStorage() {
  const values = new Map<string, string>();
  vi.stubGlobal("window", { sessionStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });
  return values;
}

afterEach(() => vi.unstubAllGlobals());

describe("capture drafts", () => {
  it("isolates account, workspace, and capture surface", () => {
    installStorage();
    const draft = { thought: "Call the dentist", requestId: "retry-1" };
    writeCaptureDraft(accountA, "sheet", draft);
    expect(readCaptureDraft(accountA, "sheet")).toEqual(draft);
    expect(readCaptureDraft(accountB, "sheet")).toBeNull();
    expect(readCaptureDraft(workspaceB, "sheet")).toBeNull();
    expect(readCaptureDraft(accountA, "natural")).toBeNull();
    clearCaptureDraft(accountA, "sheet");
    expect(readCaptureDraft(accountA, "sheet")).toBeNull();
  });

  it("never persists an unscoped draft", () => {
    const values = installStorage();
    writeCaptureDraft(undefined, "sheet", { thought: "private" });
    expect(values.size).toBe(0);
    expect(readCaptureDraft(undefined, "sheet")).toBeNull();
  });

  it("survives unavailable or malformed browser storage without breaking capture", () => {
    const values = installStorage();
    values.set(captureDraftStorageKey(accountA, "natural"), "{");
    expect(readCaptureDraft(accountA, "natural")).toBeNull();
    vi.stubGlobal("window", { sessionStorage: {
      getItem: () => { throw new Error("disabled"); },
      setItem: () => { throw new Error("disabled"); },
      removeItem: () => { throw new Error("disabled"); },
    } });
    expect(() => writeCaptureDraft(accountA, "sheet", { thought: "still usable" })).not.toThrow();
    expect(() => clearCaptureDraft(accountA, "sheet")).not.toThrow();
    expect(readCaptureDraft(accountA, "sheet")).toBeNull();
  });

  it("generates a request identifier for a draft's retry lifecycle", () => {
    expect(newCaptureRequestId()).toEqual(expect.any(String));
    expect(newCaptureRequestId()).not.toBe(newCaptureRequestId());
  });

  it("does not let a late success erase a newer draft or a different scope", () => {
    installStorage();
    writeCaptureDraft(accountA, "sheet", { thought: "newer edit" });
    writeCaptureDraft(accountB, "sheet", { thought: "other account" });
    expect(clearCaptureDraftIfUnchanged(accountA, "sheet", "account-a:old", "account-a:new")).toBe(false);
    expect(readCaptureDraft(accountA, "sheet")).toEqual({ thought: "newer edit" });
    expect(clearCaptureDraftIfUnchanged(accountA, "sheet", "account-a:old", "account-b:old")).toBe(false);
    expect(readCaptureDraft(accountB, "sheet")).toEqual({ thought: "other account" });
    expect(clearCaptureDraftIfUnchanged(accountA, "sheet", "account-a:new", "account-a:new")).toBe(true);
    expect(readCaptureDraft(accountA, "sheet")).toBeNull();
  });
});
