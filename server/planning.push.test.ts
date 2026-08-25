import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./vapidConfig", () => ({
  getVapidConfigurationFromEnvironment: () => ({ publicKey: "public-key", privateKey: "private-key", subject: "mailto:planner@example.test" }),
  validateVapidConfiguration: () => ({ valid: true }),
}));
vi.mock("web-push", () => ({ default: { sendNotification: mocks.sendNotification, setVapidDetails: mocks.setVapidDetails } }));

import { sendTestPush } from "./planning";

function makeDatabase(subscription = { id: "device-1", endpoint: "https://push.example.test/abc", p256dh: "public-key", auth: "auth-key" }) {
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  const tx = { update };
  const db = {
    select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [subscription] }) }) })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) => callback(tx)),
  };
  return { db, tx, update, set, where };
}

describe("test push delivery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a visible, bounded test payload and records a successful delivery", async () => {
    const fake = makeDatabase();
    mocks.getDb.mockResolvedValue(fake.db);
    mocks.sendNotification.mockResolvedValue({ statusCode: 201 });

    await expect(sendTestPush({ workspaceId: "workspace-1", timezone: "UTC" }, { subscriptionId: "device-1", origin: "https://personal-calander.example.test" })).resolves.toMatchObject({ status: "sent" });
    expect(mocks.setVapidDetails).toHaveBeenCalledWith("mailto:planner@example.test", "public-key", "private-key");
    expect(mocks.sendNotification).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "https://push.example.test/abc" }), expect.stringContaining("visible test notification"), expect.objectContaining({ TTL: 300, urgency: "normal" }));
    expect(fake.update).toHaveBeenCalledTimes(2);
  });

  it("marks a terminal 410 provider response as expired and asks the person to re-enable the device", async () => {
    const fake = makeDatabase();
    mocks.getDb.mockResolvedValue(fake.db);
    mocks.sendNotification.mockRejectedValue({ statusCode: 410, body: "Subscription expired" });

    await expect(sendTestPush({ workspaceId: "workspace-1", timezone: "UTC" }, { subscriptionId: "device-1", origin: "https://personal-calander.example.test" })).rejects.toThrow("subscription expired");
    expect(fake.update).toHaveBeenCalledTimes(2);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
  });
});
