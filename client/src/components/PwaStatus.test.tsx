import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PwaStatusView } from "./PwaStatus";
import type { PwaActions, PwaState } from "@/lib/pwaLifecycle";

const actions: PwaActions = {
  install: vi.fn(async () => undefined),
  dismissInstall: vi.fn(),
  retryConnection: vi.fn(async () => undefined),
  activateUpdate: vi.fn(async () => undefined),
};

const baseState: PwaState = {
  support: "supported",
  display: "browser",
  update: "idle",
  connectivity: "online",
  install: "unavailable",
  installExperience: "none",
  message: null,
};

function render(patch: Partial<PwaState>) {
  return renderToStaticMarkup(
    <PwaStatusView state={{ ...baseState, ...patch }} actions={actions} />,
  );
}

describe("PWA status presentation", () => {
  it("stays out of the way while the browser is healthy and idle", () => {
    expect(render({})).toBe("");
  });

  it("shows an actionable but non-alarming offline status", () => {
    const html = render({ connectivity: "offline", message: "The secure service is unavailable." });
    expect(html).toContain('role="status"');
    expect(html).toContain("You’re offline");
    expect(html).toContain("Quick captures stay on this device");
    expect(html).toContain("Try again");
    expect(html).not.toContain('role="alert"');
  });

  it("announces reconnection politely without demanding action", () => {
    const html = render({ connectivity: "reconnected" });
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("Back online");
    expect(html).not.toContain("Try again");
  });

  it("offers an explicit update instead of reloading automatically", () => {
    const html = render({ update: "ready" });
    expect(html).toContain("Update ready");
    expect(html).toContain("Update now");
  });

  it("uses platform-appropriate installation guidance", () => {
    const native = render({ install: "available", installExperience: "native-prompt" });
    const ios = render({ install: "available", installExperience: "ios-guidance" });
    const standalone = render({ display: "standalone", install: "unavailable", installExperience: "none" });
    expect(native).toContain("Install app");
    expect(ios).toContain("Share, then Add to Home Screen");
    expect(standalone).toBe("");
  });

  it("defines touch-safe controls and reduced motion", () => {
    const css = readFileSync(resolve(process.cwd(), "client", "src", "index.css"), "utf8");
    expect(css).toMatch(/\.pwa-status-actions button\s*\{[^}]*min-height:\s*44px[\s\S]*?\}/);
    expect(css).toMatch(/prefers-reduced-motion:[^)]+\)[^{]*\{[\s\S]*?\.pwa-status-card/);
    expect(css).toMatch(/body:has\(\.auth-gate\) \.pwa-status-layer\s*\{[^}]*position:\s*relative/);
  });
});
