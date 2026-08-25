import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { sdk } from "./sdk";
import { buildCalendarFeed } from "../calendarFeed";
import { dispatchScheduledReminder } from "../planning";
import { appRouter } from "../routers";
import { createContext } from "./context";

/**
 * Shared HTTP application for local Express hosting and serverless hosts.
 * This module intentionally does not open a port or attach Vite/static files.
 */
export function createPlannerApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/calendar/:token.ics", async (req, res, next) => {
    try {
      const feed = await buildCalendarFeed(req.params.token);
      if (!feed) return res.status(404).type("text/plain").send("Calendar feed not found.");
      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", "inline; filename=personal-calander.ics");
      res.setHeader("Cache-Control", "no-store");
      return res.send(feed);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/scheduled/reminder", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const forwardedProtocol = req.headers["x-forwarded-proto"];
      const protocol = typeof forwardedProtocol === "string" ? forwardedProtocol.split(",")[0] : req.protocol;
      const host = req.get("host");
      if (!host) return res.status(500).json({ error: "missing-host" });
      const result = await dispatchScheduledReminder(user.taskUid, `${protocol}://${host}`);
      return res.json(result);
    } catch (error) {
      const details = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
      return res.status(500).json({ error: "scheduled-reminder-failed", details, timestamp: new Date().toISOString() });
    }
  });

  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
