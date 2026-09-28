import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { finishFocusSession } from "./focus";

const scope = { workspaceId: "focus-safety-test", timezone: "UTC" };
const selection = (row: unknown) => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([row]) })) })) });
const collection = (rows: unknown[]) => ({ from: vi.fn(() => ({ where: vi.fn().mockResolvedValue(rows) })) });

describe("focus completion history safety", () => {
  beforeEach(() => vi.resetAllMocks());

  it("does not complete the parent task or focus session when an older plan commitment is unresolved", async () => {
    const session = { id: "focus-1", workspaceId: scope.workspaceId, taskId: "task-1", state: "active", version: 1, activeSeconds: 0, lastResumedAt: new Date("2026-09-20T09:00:00.000Z") };
    const task = { id: "task-1", workspaceId: scope.workspaceId, state: "not_started", version: 2, recurrenceRule: null };
    const select = vi.fn().mockReturnValueOnce(selection(session)).mockReturnValueOnce(selection(task))
      .mockReturnValueOnce(collection([{ dailyPlanId: "old-plan" }]))
      .mockReturnValueOnce(collection([{ id: "old-plan" }]));
    const transaction = vi.fn();
    mockedGetDb.mockResolvedValue({ select, transaction } as never);
    await expect(finishFocusSession(scope, { id: session.id, expectedVersion: 1, taskExpectedVersion: 2, outcome: "done" })).rejects.toThrow("unresolved daily commitment");
    expect(transaction).not.toHaveBeenCalled();
  });
});

const mockedGetDb = vi.mocked(getDb);
