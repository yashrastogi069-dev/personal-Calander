import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import { phase4DefaultPreferences } from "@shared/phase4Preferences";
import {
  PlannerRail,
  shellSecondaryTargets,
} from "@/features/shell/PlannerRail";
import {
  movePlannerShortcut,
  PhoneNavigation,
  togglePlannerPrimaryShortcut,
} from "@/features/shell/PhoneNavigation";
import { GlobalActions } from "@/features/shell/GlobalActions";
import {
  DestinationBoundary,
  DestinationLoading,
} from "@/features/shell/DestinationBoundary";
import { PlannerShell } from "@/features/shell/PlannerShell";
import appSource from "../client/src/App.tsx?raw";
import homeSource from "../client/src/pages/Home.tsx?raw";
import calendarExecutionSource from "../client/src/pages/CalendarExecution.tsx?raw";

const today = { destination: "home", view: "today" } as const;

describe("Phase 4 stable planner shell", () => {
  it("keeps one authenticated planner boundary and defaults Home to Today", () => {
    expect(appSource.match(/<AuthenticatedPlanner\b/g)).toHaveLength(1);
    expect(homeSource).toContain("parsePlannerLocation");
    expect(homeSource).not.toContain("window.location.assign");
  });

  it("preserves the dedicated Calendar execution route and its safe actions", () => {
    expect(appSource).toContain(
      'import CalendarExecution from "./pages/CalendarExecution"'
    );
    expect(appSource).toContain(
      '<Route path={"/calendar"}><CalendarExecution /></Route>'
    );
    expect(calendarExecutionSource).toContain("rolloverPreview");
    expect(calendarExecutionSource).toContain(
      "patch: { plannedStartAt: null, plannedEndAt: null }"
    );
    expect(calendarExecutionSource).toContain("CalendarExecutionWorkspace");
    expect(calendarExecutionSource).not.toContain("window.location.assign");
  });

  it("keeps every legacy child view and Categories utility reachable", () => {
    expect(shellSecondaryTargets).toEqual([
      { label: "Calendar", destination: "plan", view: "calendar" },
      { label: "Goals", destination: "intentions", view: "outcomes" },
      {
        label: "Connections",
        destination: "settings",
        view: "connections",
      },
      { label: "Insights", destination: "review", view: "insights" },
      {
        label: "Categories & Recycle Bin",
        destination: "settings",
        view: "categories",
      },
    ]);
  });

  it("reorders and pins canonical shortcuts without flattening child views", () => {
    const preferences = {
      ...phase4DefaultPreferences,
      order: [
        { destination: "plan", view: "calendar" },
        { destination: "review", view: "history" },
        { destination: "home", view: "focus", action: "focus" },
      ],
      primary: [{ destination: "review", view: "history" }],
    } as const;

    const moved = movePlannerShortcut(preferences, "review/history", -1);
    expect(moved.order).toEqual([
      { destination: "review", view: "history" },
      { destination: "plan", view: "calendar" },
      { destination: "home", view: "focus", action: "focus" },
    ]);

    const pinned = togglePlannerPrimaryShortcut(
      moved,
      moved.order[2],
      4
    );
    expect(pinned.primary).toEqual([
      { destination: "review", view: "history" },
      { destination: "home", view: "focus", action: "focus" },
    ]);
  });

  it("renders six grouped desktop destinations in an independent scroll owner", () => {
    const html = renderToStaticMarkup(
      createElement(PlannerRail, {
        location: today,
        collapsed: false,
        timezone: "Asia/Calcutta",
        onNavigate: vi.fn(),
        onToggleCollapsed: vi.fn(),
      })
    );

    expect(html).toContain('data-scroll-owner="rail"');
    expect(html).toContain("Home");
    expect(html).toContain("Tasks");
    expect(html).toContain("Plan");
    expect(html).toContain("Projects &amp; Goals");
    expect(html).toContain("Habits");
    expect(html).toContain("Review");
    expect(html).toContain("Personal space");
  });

  it("keeps exactly five visible phone controls including More", () => {
    const html = renderToStaticMarkup(
      createElement(PhoneNavigation, {
        location: today,
        preferences: phase4DefaultPreferences,
        moreOpen: false,
        onMoreOpenChange: vi.fn(),
        onNavigate: vi.fn(),
      })
    );

    expect((html.match(/<button/g) ?? []).length).toBe(5);
    expect(html).toContain("More");
    expect(html).toContain('aria-controls="phase4-phone-more"');
  });

  it("presents Capture, Search, and Focus as global actions", () => {
    const html = renderToStaticMarkup(
      createElement(GlobalActions, {
        onAction: vi.fn(),
      })
    );

    expect(html).toContain("Capture");
    expect(html).toContain("Search");
    expect(html).toContain("Focus");
  });

  it("keeps global writes inert while the first confirmed snapshot is loading", () => {
    const html = renderToStaticMarkup(
      createElement(GlobalActions, {
        disabled: true,
        onAction: vi.fn(),
      })
    );

    expect((html.match(/ disabled=""/g) ?? []).length).toBe(3);
  });

  it("keeps confirmed destination content visible beside a scoped read error", () => {
    const html = renderToStaticMarkup(
      createElement(
        DestinationBoundary,
        {
          destinationLabel: "Tasks",
          readError: new Error("Could not refresh tasks"),
          onRetry: vi.fn(),
        },
        createElement("article", null, "Confirmed task snapshot")
      )
    );

    expect(html).toContain("Confirmed task snapshot");
    expect(html).toContain("Could not refresh Tasks");
    expect(html).toContain("Try again");
  });

  it("gives rail and destination content separate scroll ownership", () => {
    const html = renderToStaticMarkup(
      createElement(
        PlannerShell,
        {
          location: today,
          preferences: phase4DefaultPreferences,
          timezone: "Asia/Calcutta",
          title: "Today",
          dateLabel: "Sunday, September 20, 2026",
          onNavigate: vi.fn(),
          onPreferencesChange: vi.fn(),
          onGlobalAction: vi.fn(),
        },
        createElement("section", null, "Today destination")
      )
    );

    expect(html).toContain('data-scroll-owner="rail"');
    expect(html).toContain('data-scroll-owner="destination"');
    expect(html).toContain("Today destination");
  });

  it("renders a route-matched loading state with the requested label", () => {
    const html = renderToStaticMarkup(
      createElement(DestinationLoading, { label: "Roadmap" })
    );

    expect(html).toContain("Opening Roadmap");
    expect(html).toContain('aria-busy="true"');
  });

  it("exposes the incremental shell browser harness contract", () => {
    const result = spawnSync(
      "python",
      ["scripts/preview-phase4-product.py", "--help"],
      { cwd: process.cwd(), encoding: "utf8" }
    );

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--scenario");
    expect(result.stdout).toContain("--widths");
    expect(result.stdout).toContain("--url");
    expect(result.stdout).toContain("--output");
    expect(result.stdout).toContain("shell-navigation");
  });
});
