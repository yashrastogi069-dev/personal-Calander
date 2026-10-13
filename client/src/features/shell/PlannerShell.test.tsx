import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { phase4DefaultPreferences } from "@shared/phase4Preferences";
import { PlannerRail } from "./PlannerRail";
import { PlannerShell } from "./PlannerShell";

describe("shared planner shell", () => {
  it("announces only the exact rail item and highlights a parent for views without their own item", () => {
    const calendar = renderToStaticMarkup(<PlannerRail location={{ destination: "plan", view: "calendar" }} collapsed={false} timezone="UTC" onNavigate={vi.fn()} onToggleCollapsed={vi.fn()} />);
    expect(calendar.match(/aria-current="page"/g)).toHaveLength(1);
    expect(calendar).toMatch(/aria-current="page"[^>]*>[\s\S]*?<span>Calendar<\/span>/);
    expect(calendar).not.toContain("is-active-parent");
    const weekly = renderToStaticMarkup(<PlannerRail location={{ destination: "plan", view: "weekly" }} collapsed={false} timezone="UTC" onNavigate={vi.fn()} onToggleCollapsed={vi.fn()} />);
    expect(weekly).toMatch(/class="is-active-parent"[^>]*>[\s\S]*?<span>Plan<\/span>/);
    expect(weekly).not.toContain('aria-current="page"');
  });

  it("groups the rail into Plan, Grow and Reflect with live badges and a search entry", () => {
    const markup = renderToStaticMarkup(<PlannerRail location={{ destination: "home", view: "overview" }} collapsed={false} timezone="UTC" badges={{ inbox: 4, overdue: 1, todayLeft: 2, habitsDue: 0 }} onNavigate={vi.fn()} onToggleCollapsed={vi.fn()} onOpenCommand={vi.fn()} />);
    for (const label of ["Plan", "Grow", "Reflect"]) expect(markup).toContain(`aria-label="${label}"`);
    for (const label of ["Dashboard", "Today", "Inbox", "Tasks", "Calendar", "Roadmap", "Goals &amp; Projects", "Habits", "Focus", "Review", "Analytics", "Connections", "Categories &amp; Recycle Bin"]) expect(markup).toContain(`<span>${label}</span>`);
    expect(markup).toContain(">2 left<");
    expect(markup).toContain(">4<");
    expect(markup).toContain('pc-rail-badge is-alert">1 overdue<');
    expect(markup).not.toContain("0 due");
    expect(markup).toContain('aria-keyshortcuts="Control+K Meta+K"');
    expect(markup).toMatch(/aria-current="page"[^>]*>[\s\S]*?<span>Dashboard<\/span>/);
  });

  it("adds a centre Capture button to the phone bar and marks the Dashboard backdrop", () => {
    const markup = renderToStaticMarkup(<PlannerShell location={{ destination: "home", view: "overview" }} preferences={phase4DefaultPreferences} timezone="UTC" title="Dashboard" dateLabel="Tuesday, October 13" onNavigate={vi.fn()} onPreferencesChange={vi.fn()} onGlobalAction={vi.fn()}><section>Work</section></PlannerShell>);
    expect(markup).toContain('data-backdrop="page"');
    expect(markup).toContain('class="pc-phone-capture" aria-label="Capture a task"');
    const nav = markup.slice(markup.indexOf('aria-label="Phone planning destinations"'));
    const order = [...nav.matchAll(/<span>([^<]+)<\/span>|aria-label="Capture a task"/g)].slice(0, 6).map(match => match[1] ?? "+");
    expect(order).toEqual(["Today", "Tasks", "+", "Daily plan", "Projects", "More"]);
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
  it("places Home views directly below the header and before the watch", () => {
    const markup = renderToStaticMarkup(<PlannerShell location={{ destination: "home", view: "today" }} preferences={phase4DefaultPreferences} timezone="UTC" title="Today" dateLabel="Thursday, October 8" onNavigate={vi.fn()} onPreferencesChange={vi.fn()} onGlobalAction={vi.fn()} viewNavigation={<nav aria-label="Home views">Today / Overview</nav>} focusControl={<section data-home-watch="active">One real session</section>}><section>Your work</section></PlannerShell>);
    expect(markup.indexOf('class="planner-topbar"')).toBeLessThan(markup.indexOf('data-shell-region="view-navigation"'));
    expect(markup.indexOf('data-shell-region="view-navigation"')).toBeLessThan(markup.indexOf('data-home-watch="active"'));
    expect(markup.match(/data-home-watch="active"/g)).toHaveLength(1);
    expect(markup).toContain("More planner controls");
  });
});
