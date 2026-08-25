import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), sendNotification: vi.fn(), setVapidDetails: vi.fn() }));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./vapidConfig", () => ({
  getVapidConfigurationFromEnvironment: () => ({ publicKey: "public-key", privateKey: "private-key", subject: "mailto:planner@example.test" }),
  validateVapidConfiguration: () => ({ valid: true }),
}));
vi.mock("web-push", () => ({ default: { sendNotification: mocks.sendNotification, setVapidDetails: mocks.setVapidDetails } }));

import { dispatchScheduledReminder } from "./planning";

const rule = { id: "rule-daily", workspaceId: "workspace-1", type: "daily_plan", scheduleCronTaskUid: "task-uid-1", isEnabled: 1, cronExpression: "daily@11:00", timezone: "Pacific/Auckland", snoozedUntil: null };
const subscription = { id: "device-1", workspaceId: "workspace-1", endpoint: "https://push.example.test/abc", p256dh: "public-key", auth: "auth-key", status: "active" };

function queryResult(value: unknown) {
  const promise = Promise.resolve(value);
  return Object.assign(promise, { limit: async () => value });
}

function makeDatabase({ duplicate = false, ruleRow = rule }: { duplicate?: boolean; ruleRow?: typeof rule } = {}) {
  const set = vi.fn(() => ({ where: vi.fn(async () => undefined) }));
  const update = vi.fn(() => ({ set }));
  const values = vi.fn(async () => { if (duplicate) throw { code: "ER_DUP_ENTRY" }; });
  let selection = 0;
  const db = {
    select: vi.fn(() => ({ from: () => ({ where: () => queryResult(selection++ === 0 ? [ruleRow] : [subscription]) }) })),
    insert: vi.fn(() => ({ values })),
    update,
    transaction: vi.fn(async (callback: (transaction: { update: typeof update }) => Promise<void>) => callback({ update })),
  };
  return { db, values, update };
}

describe("scheduled reminder delivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends the due Auckland daily reminder once after reserving its delivery", async () => {
    const fake = makeDatabase();
    mocks.getDb.mockResolvedValue(fake.db);
    mocks.sendNotification.mockResolvedValue({ statusCode: 201 });

    await expect(dispatchScheduledReminder("task-uid-1", "https://personal-calander.example.test", new Date("2026-01-04T22:00:00.000Z"))).resolves.toMatchObject({ sent: 1, localDate: "2026-01-05", localTime: "11:00" });
    expect(fake.values).toHaveBeenCalledWith(expect.objectContaining({ reminderRuleId: "rule-daily", idempotencyKey: "rule-daily:device-1:2026-01-05:11:00", kind: "daily_plan", status: "queued" }));
    expect(mocks.sendNotification).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining("A calm planning moment"), expect.objectContaining({ TTL: 1800 }));
  });

  it("does nothing outside the scheduled local minute", async () => {
    const fake = makeDatabase();
    mocks.getDb.mockResolvedValue(fake.db);

    await expect(dispatchScheduledReminder("task-uid-1", "https://personal-calander.example.test", new Date("2026-01-04T21:00:00.000Z"))).resolves.toMatchObject({ skipped: "not_due", sent: 0 });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
    expect(fake.values).not.toHaveBeenCalled();
  });

  it("does nothing when a reminder rule is paused", async () => {
    const fake = makeDatabase({ ruleRow: { ...rule, isEnabled: 0 } });
    mocks.getDb.mockResolvedValue(fake.db);

    await expect(dispatchScheduledReminder("task-uid-1", "https://personal-calander.example.test", new Date("2026-01-04T22:00:00.000Z"))).resolves.toMatchObject({ skipped: "disabled_or_snoozed", sent: 0 });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("treats a duplicate delivery reservation as a safe no-op", async () => {
    const fake = makeDatabase({ duplicate: true });
    mocks.getDb.mockResolvedValue(fake.db);

    await expect(dispatchScheduledReminder("task-uid-1", "https://personal-calander.example.test", new Date("2026-01-04T22:00:00.000Z"))).resolves.toMatchObject({ sent: 0, localDate: "2026-01-05" });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("marks only the rejected scheduled device expired after a terminal provider response", async () => {
    const fake = makeDatabase();
    mocks.getDb.mockResolvedValue(fake.db);
    mocks.sendNotification.mockRejectedValue({ statusCode: 410, body: "Subscription expired" });

    await expect(dispatchScheduledReminder("task-uid-1", "https://personal-calander.example.test", new Date("2026-01-04T22:00:00.000Z"))).resolves.toMatchObject({ sent: 0, localDate: "2026-01-05" });
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(fake.update).toHaveBeenCalledTimes(3);
  });
});
