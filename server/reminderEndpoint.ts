import { timingSafeEqual } from "node:crypto";
import { dispatchAllScheduledReminders } from "./planning";
import { reconcileCancelledStorageUploads } from "./storage";

type SchedulerRequest = { method?: string; headers: { authorization?: string | string[] } };
type SchedulerResponse = {
  setHeader(name: string, value: string): unknown;
  status(code: number): { json(body: unknown): unknown };
};

function configuredOrigin() {
  try {
    const url = new URL(process.env.APP_ORIGIN ?? "");
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) return null;
    return url.origin;
  } catch { return null; }
}

export async function handleReminderRequest(req: SchedulerRequest, res: SchedulerResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const secret = process.env.REMINDER_CRON_SECRET;
  const origin = configuredOrigin();
  if (!secret?.trim() || !origin) return res.status(503).json({ error: "Scheduled worker is not configured." });
  const supplied = req.headers.authorization;
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  const received = Buffer.from(typeof supplied === "string" ? supplied : "", "utf8");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  // Schedule both jobs even if either throws; upload cleanup must not depend on push availability.
  const [reminders, storageCleanup] = await Promise.allSettled([
    Promise.resolve().then(() => dispatchAllScheduledReminders(origin)),
    Promise.resolve().then(() => reconcileCancelledStorageUploads()),
  ]);
  if (reminders.status === "rejected" || storageCleanup.status === "rejected" || storageCleanup.value.failed > 0) {
    // Do not log request headers, storage paths, subscription URLs, or credentials.
    console.error("[Scheduled worker] Job failure", {
      remindersFailed: reminders.status === "rejected",
      storageCleanupFailed: storageCleanup.status === "rejected" || storageCleanup.value.failed > 0,
    });
    return res.status(500).json({ error: "Scheduled worker failed. Please retry." });
  }
  return res.status(200).json({ reminders: reminders.value, storageCleanup: storageCleanup.value });
}
