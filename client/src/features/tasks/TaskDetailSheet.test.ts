import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isTaskInspectorDraftStale,
  persistTaskInspectorDraft,
  readStoredTaskInspectorDraft,
  resolveTaskInspectorDraft,
  seedTaskInspectorDraft,
  shouldCloseTaskInspectorAfterSave,
  taskInspectorDraftKey,
  taskInspectorHasLocalInput,
  taskInspectorRecurrenceSummary,
} from "./TaskDetailSheet";

const task = (id: string, version = 1, title = id, workspaceId = "workspace-a") => ({
  id,
  version,
  title,
  workspaceId,
  state: "not_started",
  recurrenceRule: null,
});

function mockStorage() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  vi.stubGlobal("window", { sessionStorage: storage });
  return values;
}

afterEach(() => vi.unstubAllGlobals());

describe("canonical task inspector drafts", () => {
  it("separates account/workspace and task identities", () => {
    expect(taskInspectorDraftKey(task("one"), "account-a:workspace-a"))
      .not.toBe(taskInspectorDraftKey(task("one"), "account-b:workspace-a"));
    expect(taskInspectorDraftKey(task("one"), "account-a:workspace-a"))
      .not.toBe(taskInspectorDraftKey(task("two"), "account-a:workspace-a"));
    expect(taskInspectorDraftKey(task("one"))).not.toBe(taskInspectorDraftKey(task("one", 1, "one", "workspace-b")));
  });

  it("retains A's dirty draft across B and back, including a version refresh", () => {
    const a = task("a");
    const b = task("b");
    const aDraft = { ...seedTaskInspectorDraft(a), changed: true, fields: { ...seedTaskInspectorDraft(a).fields, title: "Edited A" } };
    const editors = new Map([[taskInspectorDraftKey(a), aDraft]]);

    expect(resolveTaskInspectorDraft(editors.get(taskInspectorDraftKey(b)), b).fields.title).toBe("b");
    expect(resolveTaskInspectorDraft(editors.get(taskInspectorDraftKey(a)), a).fields.title).toBe("Edited A");
    expect(resolveTaskInspectorDraft(editors.get(taskInspectorDraftKey(a)), task("a", 2, "Remote A"))).toBe(aDraft);
    expect(aDraft.sourceKey).toBe("a:1");
    expect(isTaskInspectorDraftStale(aDraft, task("a", 2, "Remote A"))).toBe(true);
    expect(isTaskInspectorDraftStale(aDraft, a)).toBe(false);
  });

  it("rebases untouched fields on a new version but keeps pending subtask input", () => {
    const original = seedTaskInspectorDraft(task("a"));
    const withInput = { ...original, subtaskTitle: "Write outline" };
    const next = resolveTaskInspectorDraft(withInput, task("a", 2, "Updated remotely"));
    expect(next.fields.title).toBe("Updated remotely");
    expect(next.sourceKey).toBe("a:2");
    expect(next.subtaskTitle).toBe("Write outline");
  });

  it("keeps a dirty draft across close, unmount, and same-tab reload", () => {
    mockStorage();
    const record = task("a");
    const key = taskInspectorDraftKey(record, "account-a:workspace-a");
    const draft = { ...seedTaskInspectorDraft(record), changed: true, fields: { ...seedTaskInspectorDraft(record).fields, description: "Unsubmitted note" } };
    expect(persistTaskInspectorDraft(key, draft)).toBe(true);
    expect(readStoredTaskInspectorDraft(key)?.fields.description).toBe("Unsubmitted note");
    expect(resolveTaskInspectorDraft(readStoredTaskInspectorDraft(key), record).fields.description).toBe("Unsubmitted note");
    expect(taskInspectorHasLocalInput(draft)).toBe(true);
  });

  it("keeps secondary input while clean entries do not occupy storage", () => {
    const values = mockStorage();
    const record = task("a");
    const key = taskInspectorDraftKey(record);
    const seed = seedTaskInspectorDraft(record);
    expect(persistTaskInspectorDraft(key, seed)).toBe(true);
    expect(values.has(key)).toBe(false);
    expect(persistTaskInspectorDraft(key, { ...seed, subtaskTitle: "A subtask" })).toBe(true);
    expect(readStoredTaskInspectorDraft(key)?.subtaskTitle).toBe("A subtask");
  });

  it("continues in memory when browser storage fails", () => {
    vi.stubGlobal("window", { sessionStorage: { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } } });
    const draft = seedTaskInspectorDraft(task("a"));
    expect(readStoredTaskInspectorDraft("a")).toBeNull();
    expect(persistTaskInspectorDraft("a", { ...draft, changed: true })).toBe(false);
  });

  it("does not close another task when an earlier task save resolves late", () => {
    const a = taskInspectorDraftKey(task("a"));
    const b = taskInspectorDraftKey(task("b"));
    expect(shouldCloseTaskInspectorAfterSave(a, b)).toBe(false);
    expect(shouldCloseTaskInspectorAfterSave(a, null)).toBe(false);
    expect(shouldCloseTaskInspectorAfterSave(a, a)).toBe(true);
  });

  it("exposes recurrence consequences in the closed advanced summary", () => {
    expect(taskInspectorRecurrenceSummary({ recurrenceFrequency: "none" })).toBe("No repeat");
    expect(taskInspectorRecurrenceSummary({ recurrenceFrequency: "weekly", recurrenceInterval: "2", recurrenceWeekdays: [1, 3], recurrenceUntilLocalDate: "2026-12-31" }))
      .toBe("Every 2 weeks on Mon, Wed until 2026-12-31");
  });
});
