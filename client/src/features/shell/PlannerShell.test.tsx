import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { phase4DefaultPreferences } from "@shared/phase4Preferences";
import { PlannerRail } from "./PlannerRail";
import { PlannerShell } from "./PlannerShell";

describe("shared planner shell", () => {
  it("highlights a child view's parent while announcing only the exact location", () => {
    const markup = renderToStaticMarkup(<PlannerRail location={{ destination: "plan", view: "calendar" }} collapsed={false} timezone="UTC" onNavigate={vi.fn()} onToggleCollapsed={vi.fn()} />);
    expect(markup).toMatch(/class="is-active-parent"[^>]*>[\s\S]*?<span>Plan<\/span>/);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-current="page"[^>]*>[\s\S]*?<span>Calendar<\/span>/);
  });

  it("announces account settings only when that exact view is selected", () => {
    const markup = renderToStaticMarkup(<PlannerRail location={{ destination: "settings", view: "account" }} collapsed={true} timezone="UTC" onNavigate={vi.fn()} onToggleCollapsed={vi.fn()} />);
    expect(markup).toContain('aria-label="Open account settings" aria-current="page"');
    expect(markup).toContain('aria-label="Expand planning sidebar"');
  });

  it("keeps quick entry, global capture, search, Focus and compact preferences available", () => {
    const markup = renderToStaticMarkup(<PlannerShell location={{ destination: "home", view: "today" }} preferences={{ ...phase4DefaultPreferences, density: "compact", railCollapsed: true }} timezone="UTC" title="Today" dateLabel="Thursday, October 8" onNavigate={vi.fn()} onPreferencesChange={vi.fn()} onGlobalAction={vi.fn()} quickCapture={<form aria-label="Quick capture"><input defaultValue="Preserved draft" /></form>} syncStatus={<div>Offline changes awaiting sync</div>} focusControl={<div>One existing Focus session</div>}><section>Work</section></PlannerShell>);
    expect(markup).toContain("is-rail-collapsed mobile-density-compact has-focus-control");
    expect(markup).toContain('<summary>Quick entry</summary>');
    expect(markup).toContain('value="Preserved draft"');
    expect(markup).toContain("Global planner actions");
    expect(markup).toContain("Capture</span>");
    expect(markup).toContain("Search</span>");
    expect(markup).toContain("Focus</span>");
    expect(markup.indexOf('class="planner-topbar"')).toBeLessThan(markup.indexOf("Offline changes awaiting sync"));
    expect(markup.match(/One existing Focus session/g)).toHaveLength(1);
    expect(markup).toContain('data-scroll-owner="rail"');
    expect(markup).toContain('data-scroll-owner="destination"');
  });
});
