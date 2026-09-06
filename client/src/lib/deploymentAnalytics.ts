import type { BeforeSendEvent } from "@vercel/analytics";

export function sanitizeAnalyticsEvent(event: BeforeSendEvent): BeforeSendEvent | null {
  if (event.type !== "pageview") return null;
  try {
    const url = new URL(event.url);
    // Search terms, filters, OAuth codes and fragments may contain private data.
    const route = ["/", "/calendar", "/404"].includes(url.pathname) ? url.pathname : "/404";
    return { type: "pageview", url: `${url.origin}${route}` };
  } catch { return null; }
}
