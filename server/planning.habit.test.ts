import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ getDb: vi.fn() }));

import { getDb } from "./db";
import { clearHabitCheckIn, upsertHabitCheckIn } from "./planning";

const mockedGetDb = vi.mocked(getDb);
const scope = { workspaceId: "habit-service-test", timezone: "Asia/Kolkata" };

describe("habit check-in persistence", () => {
  beforeEach(() => vi.resetAllMocks());

  it("persists a successful skipped check-in and returns its stored record", async () => {
    const stored = { id: "check-in-1", habitId: "habit-1", localDate: "2026-08-24", state: "skipped" };
    const firstQuery = { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ id: "habit-1" }]) })) })) };
    const finalQuery = { from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([stored]) })) })) };
    const onDuplicateKeyUpdate = vi.fn().mockResolvedValue({});
    const values = vi.fn(() => ({ onDuplicateKeyUpdate }));
    const insert = vi.fn(() => ({ values }));
    const select = vi.fn().mockReturnValueOnce(firstQuery).mockReturnValueOnce(finalQuery);
    mockedGetDb.mockResolvedValue({ select, insert } as never);

    await expect(upsertHabitCheckIn(scope, { habitId: "habit-1", localDate: "2026-08-24", state: "skipped" })).resolves.toEqual(stored);
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: scope.workspaceId, habitId: "habit-1", localDate: "2026-08-24", state: "skipped", timezoneAtCheckIn: scope.timezone, completedAt: null }));
    expect(onDuplicateKeyUpdate).toHaveBeenCalledWith(expect.objectContaining({ set: expect.objectContaining({ state: "skipped", completedAt: null }) }));
  });

  it("successfully clears only the scoped habit record and is safe to retry", async () => {
    const where = vi.fn().mockResolvedValue({ rowsAffected: 1 });
    const remove = vi.fn(() => ({ where }));
    mockedGetDb.mockResolvedValue({ delete: remove } as never);

    await expect(clearHabitCheckIn(scope, { habitId: "habit-1", localDate: "2026-08-24" })).resolves.toEqual({ habitId: "habit-1", localDate: "2026-08-24", cleared: true });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(where).toHaveBeenCalledTimes(1);
  });
});
