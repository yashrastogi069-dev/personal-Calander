import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { pushSubscriptions } from "../drizzle/schema";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), sendNotification: vi.fn(), setVapidDetails: vi.fn() }));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./vapidConfig", () => ({
  getVapidConfigurationFromEnvironment: () => ({ publicKey: "public-key", privateKey: "private-key", subject: "mailto:planner@example.test" }),
  validateVapidConfiguration: () => ({ valid: true }),
}));
vi.mock("web-push", () => ({ default: { sendNotification: mocks.sendNotification, setVapidDetails: mocks.setVapidDetails } }));

import { dispatchAllScheduledReminders, dispatchScheduledReminder } from "./planning";

const rule = { id: "rule-daily", workspaceId: "workspace-1", type: "daily_plan", scheduleCronTaskUid: "task-uid-1", isEnabled: 1, cronExpression: "daily@11:00", timezone: "Pacific/Auckland", snoozedUntil: null };
const subscription = { id: "device-1", workspaceId: "workspace-1", endpoint: "https://push.example.test/abc", p256dh: "public-key", auth: "auth-key", status: "active" };

function queryResult(value: unknown) {
  const promise = Promise.resolve(value);
  return Object.assign(promise, { limit: async () => value });
}

function makeDatabase({ duplicate = false, ruleRow = rule, projectSchedulerTaskUid, allRules = false, devices = [subscription] }: { duplicate?: boolean; ruleRow?: typeof rule; projectSchedulerTaskUid?: string; allRules?: boolean; devices?: typeof subscription[] } = {}) {
  const writes: Array<{ table: unknown; patch: Record<string, unknown>; params: unknown[] }> = [];
  const update = vi.fn((table: unknown) => ({ set: (patch: Record<string, unknown>) => ({ where: async (condition: Parameters<PgDialect["sqlToQuery"]>[0]) => { writes.push({ table, patch, params: new PgDialect().sqlToQuery(condition).params }); } }) }));
  const values = vi.fn(async () => { if (duplicate) throw { code: "23505" }; });
  const selections = allRules ? [[ruleRow], devices] : projectSchedulerTaskUid
    ? [[{ id: "project-reminder-sweep", scheduleCronTaskUid: projectSchedulerTaskUid }], [ruleRow], devices]
    : [[], [ruleRow], devices];
  let selection = 0;
  const db = {
    select: vi.fn(() => ({ from: () => ({ where: () => queryResult(selections[selection++] ?? []) }) })),
    insert: vi.fn(() => ({ values })),
    update,
    transaction: vi.fn(async (callback: (transaction: { update: typeof update }) => Promise<void>) => callback({ update })),
  };
  return { db, values, update, writes };
}

describe("scheduled reminder delivery", () => {
  beforeEach(() => vi.resetAllMocks());

  it("sweeps due rules without a legacy scheduler identity", async () => {
    const fake = makeDatabase({ allRules: true }); mocks.getDb.mockResolvedValue(fake.db); mocks.sendNotification.mockResolvedValue({ statusCode: 201 });
    await expect(dispatchAllScheduledReminders("https://planner.example", new Date("2026-01-04T22:00:00Z"))).resolves.toMatchObject({ scheduler: "project", inspected: 1, sent: 1 });
    expect(mocks.getDb).toHaveBeenCalledTimes(1);
  });

  it("suppresses duplicate reservations through the all-rules entry point", async () => {
    const fake = makeDatabase({ allRules: true, duplicate: true }); mocks.getDb.mockResolvedValue(fake.db);
    await expect(dispatchAllScheduledReminders("https://planner.example", new Date("2026-01-04T22:00:00Z"))).resolves.toMatchObject({ sent: 0 });
    expect(mocks.sendNotification).not.toHaveBeenCalled();
  });

  it("expires only the rejected device while a second device still receives its reminder", async () => {
    const fake = makeDatabase({ allRules: true, devices: [subscription, { ...subscription, id: "device-2", endpoint: "https://push.example.test/second" }] });
    mocks.getDb.mockResolvedValue(fake.db); mocks.sendNotification.mockRejectedValueOnce({ statusCode: 410 }).mockResolvedValueOnce({ statusCode: 201 });
    await expect(dispatchAllScheduledReminders("https://planner.example", new Date("2026-01-04T22:00:00Z"))).resolves.toMatchObject({ sent: 1 });
    const deviceWrites = fake.writes.filter(write => write.table === pushSubscriptions);
    expect(deviceWrites).toEqual([
      { table: pushSubscriptions, patch: expect.objectContaining({ status: "expired" }), params: ["device-1"] },
      { table: pushSubscriptions, patch: expect.objectContaining({ lastSentAt: expect.any(Date) }), params: ["device-2"] },
    ]);
  });

  it("sends the due Auckland daily reminder once after reserving its delivery", async () => {
    const fake = makeDatabase();
    mocks.getDb.mockResolvedValue(fake.db);
    mocks.sendNotification.mockResolvedValue({ statusCode: 201 });

    await expect(dispatchScheduledReminder("task-uid-1", "https://personal-calander.example.test", new Date("2026-01-04T22:00:00.000Z"))).resolves.toMatchObject({ sent: 1, localDate: "2026-01-05", localTime: "11:00" });
    expect(fake.values).toHaveBeenCalledWith(expect.objectContaining({ reminderRuleId: "rule-daily", idempotencyKey: "rule-daily:device-1:2026-01-05:11:00", kind: "daily_plan", status: "queued" }));
    expect(mocks.sendNotification).toHaveBeenCalledWith(expect.any(Object), expect.stringContaining("A calm planning moment"), expect.objectContaining({ TTL: 1800 }));
  });

  it("lets only the persisted project scheduler sweep enabled due rules", async () => {
    const fake = makeDatabase({ projectSchedulerTaskUid: "project-hourly-task" });
    mocks.getDb.mockResolvedValue(fake.db);
    mocks.sendNotification.mockResolvedValue({ statusCode: 201 });

    await expect(dispatchScheduledReminder("project-hourly-task", "https://personal-calander.example.test", new Date("2026-01-04T22:00:00.000Z"))).resolves.toMatchObject({
      scheduler: "project",
      inspected: 1,
      sent: 1,
    });
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
