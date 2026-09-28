import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { buildRecoveryEntries, recoveryDecisionInput, recoveryScopeLabel } from "../client/src/features/recovery/recoveryModel";
import { RecoveryDecisionFields } from "../client/src/features/recovery/RecoveryFlow";
import { RecoveryIndicator } from "../client/src/features/recovery/RecoveryIndicator";

const mocks = vi.hoisted(() => ({ getDb: vi.fn() }));
vi.mock("./db", () => ({ getDb: mocks.getDb }));
import { getWorkspaceSnapshot, updateWorkspace } from "./planning";

const baseline = readFileSync(new URL("../supabase/migrations/0000_loving_madrox.sql", import.meta.url), "utf8");
const ownership = readFileSync(new URL("../supabase/migrations/0001_independent_ownership.sql", import.meta.url), "utf8");
const phase4 = readFileSync(new URL("../supabase/migrations/0004_phase4_product_model.sql", import.meta.url), "utf8");

async function workspaceDatabase(migrated: boolean) {
  const database = new PGlite();
  await database.exec(baseline);
  await database.exec("create schema auth; create table auth.users (id uuid primary key);");
  await database.exec(ownership);
  await database.exec("INSERT INTO users (\"legacyExternalId\", email) VALUES ('owner', 'owner@example.test'); INSERT INTO workspaces (id, \"ownerUserId\", timezone) VALUES ('workspace-recovery-ui', 1, 'UTC');");
  if (migrated) await database.exec(phase4);
  mocks.getDb.mockResolvedValue(drizzle(database));
  return database;
}

afterEach(() => vi.clearAllMocks());

describe("Recovery presentation", () => {
  it("shows one deliberate action and only the fields needed by the chosen decision", () => {
    const entry = { key: "item:item-1", dailyPlanItemId: "item-1", taskId: "task-1", taskVersion: 4,
      sourceLocalDate: "2026-10-01", originalScope: "Write chapter", canResolve: true, itemVersion: 2,
      deadline: "2026-10-08" };
    const fields = renderToStaticMarkup(createElement(RecoveryDecisionFields, { entry, action: "reduce", form: { revisedScope: "Edit opening", resolvedToLocalDate: "2026-10-04" }, onChange: () => undefined }));
    expect(fields).not.toContain("Original promise");
    expect(fields).toContain("Revised scope");
    expect(fields).toContain("Plan for");
    expect(fields).toContain("Deadline");
    expect(fields).not.toContain("Return / review date");
    const pause = renderToStaticMarkup(createElement(RecoveryDecisionFields, { entry, action: "pause", form: { returnLocalDate: "2026-10-07" }, onChange: () => undefined }));
    expect(pause).toContain("Return / review date");
    expect(pause).not.toContain("Revised scope");
  });

  it("keeps Strict attention visible while Gentle stays in Review", () => {
    const strict = renderToStaticMarkup(createElement(RecoveryIndicator, { count: 3, level: "strict", onOpen: () => undefined }));
    const gentle = renderToStaticMarkup(createElement(RecoveryIndicator, { count: 3, level: "gentle", onOpen: () => undefined }));
    expect(strict).toContain("3 open decisions");
    expect(strict).toContain("Review decisions");
    expect(gentle).toContain("Review when ready");
  });
  it("keeps separate references to one task and identifies a dated occurrence and a carried commitment", () => {
    const entries = buildRecoveryEntries({ todayLocalDate: "2026-10-03", plans: [
      { id: "plan-1", localDate: "2026-10-01", state: "active" },
      { id: "plan-2", localDate: "2026-10-02", state: "active" },
    ], items: [
      { id: "item-1", dailyPlanId: "plan-1", taskId: "task-1", state: "committed", version: 2 },
      { id: "item-2", dailyPlanId: "plan-2", taskId: "task-1", state: "committed", version: 3 },
    ], tasks: [{ id: "task-1", title: "Write chapter", version: 7, state: "not_started", recurrenceRule: "FREQ=DAILY" }],
      occurrences: [{ id: "occ-1", taskId: "task-1", localDate: "2026-10-01", state: "pending", version: 4 }],
      carries: [{ id: "carry-1", taskId: "task-1", rootDailyPlanItemId: "item-1", createdByResolutionId: "resolution-1", targetLocalDate: "2026-10-02", scope: "Edit introduction", state: "pending", version: 5 }],
    });
    expect(entries.map(entry => entry.key)).toEqual(["item:item-1", "item:item-2", "carry:carry-1"]);
    expect(entries[0]).toMatchObject({ sourceLocalDate: "2026-10-01", occurrenceId: "occ-1", canResolve: true });
    expect(entries[1]).toMatchObject({ sourceLocalDate: "2026-10-02", canResolve: false, reason: "missing_occurrence" });
    expect(entries[2]).toMatchObject({ sourceLocalDate: "2026-10-02", sourceCarryId: "carry-1", originalScope: "Edit introduction", canResolve: true });
  });

  it("builds an exact carried decision without borrowing the natural occurrence identity", () => {
    const decision = recoveryDecisionInput({ key: "carry:carry-1", dailyPlanItemId: "item-1", taskId: "task-1", taskVersion: 7,
      sourceCarryId: "carry-1", carryVersion: 5, sourceLocalDate: "2026-10-02", originalScope: "Edit introduction", canResolve: true },
      { action: "reduce", resolvedToLocalDate: "2026-10-04", revisedScope: "Edit opening paragraph", decisionNote: "Make room" }, "operation-1");
    expect(decision).toEqual({ operationId: "operation-1", dailyPlanItemId: "item-1", taskId: "task-1", taskExpectedVersion: 7,
      sourceCarryId: "carry-1", carryExpectedVersion: 5, action: "reduce", resolvedToLocalDate: "2026-10-04", revisedScope: "Edit opening paragraph", decisionNote: "Make room" });
  });

  it("returns a due paused original item to Review without offering an unsupported second resolution", () => {
    const source = { todayLocalDate: "2026-10-03", plans: [{ id: "plan-1", localDate: "2026-10-01", state: "active" }],
      items: [{ id: "item-1", dailyPlanId: "plan-1", taskId: "task-1", state: "deferred", version: 3 }],
      tasks: [{ id: "task-1", title: "Current title", version: 5, state: "in_progress" }],
      resolutions: [{ id: "pause-1", dailyPlanItemId: "item-1", taskId: "task-1", action: "pause", originalScope: "Original scope", returnLocalDate: "2026-10-03", sourceCarryId: null }],
    };
    expect(buildRecoveryEntries(source)).toMatchObject([{ key: "return:item:item-1", originalScope: "Original scope", returnLocalDate: "2026-10-03", canResolve: false, reason: "returning_pause" }]);
    expect(buildRecoveryEntries({ ...source, todayLocalDate: "2026-10-02" })).toEqual([]);
  });

  it("clears a due original pause only after an explicit later commitment for the same task", () => {
    const source = { todayLocalDate: "2026-10-04", plans: [
      { id: "paused-plan", localDate: "2026-10-01", state: "active" },
      { id: "earlier-plan", localDate: "2026-10-02", state: "active" },
      { id: "return-plan", localDate: "2026-10-03", state: "active" },
    ], items: [
      { id: "paused-item", dailyPlanId: "paused-plan", taskId: "task-1", state: "deferred", version: 3 },
      { id: "unrelated-item", dailyPlanId: "return-plan", taskId: "task-2", state: "committed", version: 1 },
    ], tasks: [
      { id: "task-1", title: "Original task", version: 5, state: "not_started" },
      { id: "task-2", title: "Another task", version: 1, state: "not_started" },
    ], resolutions: [{ id: "pause-1", dailyPlanItemId: "paused-item", taskId: "task-1", action: "pause", originalScope: "Original task", returnLocalDate: "2026-10-03", sourceCarryId: null, createdAt: "2026-10-02T09:00:00.000Z" }], };
    expect(buildRecoveryEntries(source).map(entry => entry.key)).toContain("return:item:paused-item");
    expect(buildRecoveryEntries({ ...source, items: [...source.items, { id: "before-return", dailyPlanId: "earlier-plan", taskId: "task-1", state: "committed", version: 1, createdAt: "2026-10-02T10:00:00.000Z" }] }).map(entry => entry.key)).toContain("return:item:paused-item");
    expect(buildRecoveryEntries({ ...source, items: [...source.items, { id: "preexisting-item", dailyPlanId: "return-plan", taskId: "task-1", state: "committed", version: 1, createdAt: "2026-10-02T08:00:00.000Z" }] }).map(entry => entry.key)).toContain("return:item:paused-item");
    const recommitted = { ...source, items: [...source.items, { id: "replanned-item", dailyPlanId: "return-plan", taskId: "task-1", state: "committed", version: 1, createdAt: "2026-10-02T10:00:00.000Z" }] };
    expect(buildRecoveryEntries(recommitted).map(entry => entry.key)).not.toContain("return:item:paused-item");
    expect(buildRecoveryEntries(recommitted).map(entry => entry.key)).toContain("item:replanned-item");
  });

  it("lets a due paused carry resume by its own version without reopening its root item", () => {
    const entries = buildRecoveryEntries({ todayLocalDate: "2026-10-03", plans: [{ id: "plan-1", localDate: "2026-10-01", state: "active" }],
      items: [{ id: "item-1", dailyPlanId: "plan-1", taskId: "task-1", state: "rescheduled", version: 3 }],
      tasks: [{ id: "task-1", title: "Current title", version: 5, state: "in_progress" }],
      carries: [{ id: "carry-1", taskId: "task-1", rootDailyPlanItemId: "item-1", createdByResolutionId: "earlier", targetLocalDate: "2026-10-02", scope: "Smaller scope", state: "paused", version: 4 }],
      resolutions: [{ id: "pause-carry", dailyPlanItemId: "item-1", taskId: "task-1", action: "pause", originalScope: "Smaller scope", returnLocalDate: "2026-10-03", sourceCarryId: "carry-1", sourceCarryVersion: 3 }],
    });
    expect(entries).toMatchObject([{ key: "return:carry:carry-1", sourceCarryId: "carry-1", carryVersion: 4, canResolve: true, originalScope: "Smaller scope" }]);
    expect(recoveryDecisionInput(entries[0], { action: "done" }, "operation-return")).toMatchObject({ sourceCarryId: "carry-1", carryExpectedVersion: 4, dailyPlanItemId: "item-1", action: "done" });
  });

  it("uses recorded source scope for a sibling instead of a later reduced task title", () => {
    const entries = buildRecoveryEntries({ todayLocalDate: "2026-10-03", plans: [{ id: "plan-1", localDate: "2026-10-01", state: "active" }],
      items: [{ id: "item-2", dailyPlanId: "plan-1", taskId: "task-1", state: "committed", version: 1 }],
      tasks: [{ id: "task-1", title: "Smaller current title", version: 5, state: "in_progress" }],
      resolutions: [
        { id: "reduce-2", dailyPlanItemId: "item-3", taskId: "task-1", action: "reduce", originalScope: "Later narrowed title", revisedScope: "Another small step", returnLocalDate: null, createdAt: "2026-10-02T10:00:00.000Z" },
        { id: "reduce-1", dailyPlanItemId: "item-1", taskId: "task-1", action: "reduce", originalScope: "Original task title", revisedScope: "Smaller current title", returnLocalDate: null, createdAt: "2026-10-01T10:00:00.000Z" },
      ],
    });
    expect(entries).toMatchObject([{ key: "item:item-2", originalScope: "Original task title", scopeSource: "recorded_history" }]);
    const fallback = buildRecoveryEntries({ todayLocalDate: "2026-10-03", plans: [{ id: "plan-1", localDate: "2026-10-01", state: "active" }],
      items: [{ id: "item-2", dailyPlanId: "plan-1", taskId: "task-1", state: "committed", version: 1 }],
      tasks: [{ id: "task-1", title: "Current title only", version: 5, state: "in_progress" }],
    });
    expect(fallback).toMatchObject([{ originalScope: "Current title only", scopeSource: "current_title" }]);
    expect(recoveryScopeLabel(entries[0])).toBe("Recorded scope");
    expect(recoveryScopeLabel(fallback[0])).toBe("Current task title");
  });

  it("reads Structured by default, then saves a versioned workspace level without changing task outcomes", async () => {
    const database = await workspaceDatabase(true);
    const scope = { workspaceId: "workspace-recovery-ui", timezone: "UTC" };
    try {
      await database.exec("INSERT INTO tasks (id, \"workspaceId\", title, state, version) VALUES ('task-1', 'workspace-recovery-ui', 'Keep outcome', 'not_started', 3);");
      const before = await getWorkspaceSnapshot(scope, { start: "2026-10-01", end: "2026-10-03" });
      expect(before.workspace.accountabilityLevel).toBe("structured");
      const updated = await updateWorkspace(scope, { expectedVersion: before.workspace.version, accountabilityLevel: "strict" });
      expect(updated).toMatchObject({ accountabilityLevel: "strict", version: before.workspace.version + 1 });
      await expect(updateWorkspace(scope, { expectedVersion: before.workspace.version, accountabilityLevel: "gentle" })).rejects.toThrow("changed elsewhere");
      expect((await database.query("SELECT state, version FROM tasks WHERE id = 'task-1'")).rows).toEqual([{ state: "not_started", version: 3 }]);
    } finally { await database.close(); }
  }, 30_000);

  it("keeps pre-migration snapshots readable and refuses preference writes clearly", async () => {
    const database = await workspaceDatabase(false);
    const scope = { workspaceId: "workspace-recovery-ui", timezone: "UTC" };
    try {
      const snapshot = await getWorkspaceSnapshot(scope, { start: "2026-10-01", end: "2026-10-03" });
      expect(snapshot.workspace.accountabilityLevel).toBe("structured");
      expect(snapshot.workspace.accountabilityAvailable).toBe(false);
      await expect(updateWorkspace(scope, { expectedVersion: snapshot.workspace.version, accountabilityLevel: "gentle" })).rejects.toThrow("available after the Phase 4 workspace migration");
    } finally { await database.close(); }
  }, 30_000);
});
