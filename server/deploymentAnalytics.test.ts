import { expect, it } from "vitest";
import { sanitizeAnalyticsEvent } from "../client/src/lib/deploymentAnalytics";

it("keeps query text and OAuth fragments out of deployment analytics", () => {
  expect(sanitizeAnalyticsEvent({ type: "pageview", url: "https://planner.example/calendar?q=private-task&code=secret#access_token=secret" }))
    .toEqual({ type: "pageview", url: "https://planner.example/calendar" });
  expect(sanitizeAnalyticsEvent({ type: "pageview", url: "https://planner.example/private-title" }))
    .toEqual({ type: "pageview", url: "https://planner.example/404" });
  expect(sanitizeAnalyticsEvent({ type: "event", url: "https://planner.example/" })).toBeNull();
});
