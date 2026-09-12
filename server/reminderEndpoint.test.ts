import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), cleanup: vi.fn() }));
vi.mock("./planning", () => ({ dispatchAllScheduledReminders: mocks.dispatch }));
vi.mock("./storage", () => ({ reconcileCancelledStorageUploads: mocks.cleanup }));
import { handleReminderRequest } from "./reminderEndpoint";

function response() {
  const res = { status: vi.fn(), json: vi.fn(), setHeader: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}
const request = { method: "POST", headers: { authorization: "Bearer test-cron-secret", host: "evil.example", "x-forwarded-host": "evil.example" } };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("REMINDER_CRON_SECRET", "test-cron-secret"); vi.stubEnv("APP_ORIGIN", "https://planner.example");
  mocks.dispatch.mockResolvedValue({ sent: 1, inspected: 2 }); mocks.cleanup.mockResolvedValue({ removed: 1, failed: 0 });
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("authenticated scheduled worker", () => {
  it.each(["REMINDER_CRON_SECRET", "APP_ORIGIN"])("requires %s before doing work", async key => {
    vi.stubEnv(key, ""); const res = response();
    await handleReminderRequest(request, res);
    expect(res.status).toHaveBeenCalledWith(503); expect(mocks.dispatch).not.toHaveBeenCalled(); expect(mocks.cleanup).not.toHaveBeenCalled();
  });
  it.each([undefined, "Bearer wrong", "Bearer test-cron-secreX", ["Bearer test-cron-secret"]])("rejects invalid authorization %j", async authorization => {
    const res = response(); await handleReminderRequest({ ...request, headers: { authorization } }, res);
    expect(res.status).toHaveBeenCalledWith(401); expect(mocks.dispatch).not.toHaveBeenCalled(); expect(mocks.cleanup).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
  });
  it.each(["POST", "GET"])("runs both jobs once for authenticated %s using configured origin", async method => {
    const res = response(); await handleReminderRequest({ ...request, method }, res);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.dispatch).toHaveBeenCalledWith("https://planner.example");
    expect(mocks.cleanup).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ reminders: { sent: 1, inspected: 2 }, storageCleanup: { removed: 1, failed: 0 } });
  });
  it("rejects unsupported methods and malformed origin", async () => {
    const res = response(); await handleReminderRequest({ ...request, method: "DELETE" }, res);
    expect(res.status).toHaveBeenCalledWith(405); expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET, POST");
    vi.stubEnv("APP_ORIGIN", "https://planner.example/unsafe/path");
    await handleReminderRequest(request, res); expect(res.status).toHaveBeenLastCalledWith(503);
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it("still cleans cancelled uploads when notifications fail and retries on later sweeps", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.dispatch.mockRejectedValueOnce(new Error("private failure"));
    mocks.cleanup.mockResolvedValueOnce({ removed: 0, failed: 1 });
    const res = response(); await handleReminderRequest(request, res);
    expect(mocks.cleanup).toHaveBeenCalledTimes(1); expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Scheduled worker failed. Please retry." }); expect(log).toHaveBeenCalled();
    await handleReminderRequest(request, res);
    expect(mocks.cleanup).toHaveBeenCalledTimes(2); expect(mocks.dispatch).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenLastCalledWith(200);
  });
  it("still dispatches reminders when cleanup throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.cleanup.mockRejectedValueOnce(new Error("unavailable")); const res = response();
    await handleReminderRequest(request, res);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1); expect(res.status).toHaveBeenCalledWith(500);
  });
  it("keeps reminders operational while the separately deferred private-storage schema is absent", async () => {
    const missingRelation = Object.assign(new Error("relation does not exist"), { code: "42P01" });
    mocks.cleanup.mockRejectedValueOnce(new Error("query failed", { cause: missingRelation }));
    const res = response();
    await handleReminderRequest(request, res);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      reminders: { sent: 1, inspected: 2 },
      storageCleanup: { removed: 0, failed: 0, status: "not_configured" },
    });
  });
});
