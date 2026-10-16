import type { ReactNode } from "react";
import { useState } from "react";
import type {
  GlobalPlannerAction,
  PlannerLocationTarget,
} from "@shared/phase4Navigation";
import type { Phase4Preferences } from "@shared/phase4Preferences";
import { GlobalActions } from "./GlobalActions";
import { PhoneNavigation } from "./PhoneNavigation";
import { PlannerRail } from "./PlannerRail";
import type { NavBadgeCounts } from "./premiumNavigation";
import "./planner-shell.css";
import "./approved-workspace.css";
import "./premium-shell.css";

export type PlannerShellProps = {
  location: PlannerLocationTarget;
  preferences: Phase4Preferences;
  timezone: string;
  title: string;
  dateLabel: string;
  selectedRecord?: string | null;
  onNavigate: (target: PlannerLocationTarget) => void;
  onPreferencesChange: (preferences: Phase4Preferences) => void;
  onGlobalAction: (action: GlobalPlannerAction) => void;
  globalActionsDisabled?: boolean;
  syncStatus?: ReactNode;
  quickCapture?: ReactNode;
  utilityActions?: ReactNode;
  focusControl?: ReactNode;
  viewNavigation?: ReactNode;
  /** D2 hero header: small line above the title (replaces the date line). */
  eyebrow?: ReactNode;
  /** D2 hero header: line under the title, e.g. today's intention. */
  subtitle?: ReactNode;
  /** Screen-reader-only view name appended to the h1 when the visible title is a greeting. */
  titleContext?: string;
  /** Render viewNavigation inline in the title row, before the actions (v2.1 Main). */
  tabsInHeader?: boolean;
  /** Live counts for rail badges (D1). */
  badges?: NavBadgeCounts;
  /** Opens the ⌘K command palette. */
  onOpenCommand?: () => void;
  /** Page-level Capture key shown on the shell's Capture button (Tasks: "C"). */
  captureShortcut?: string;
  children: ReactNode;
};

export function PlannerShell({
  location,
  preferences,
  timezone,
  title,
  dateLabel,
  selectedRecord,
  onNavigate,
  onPreferencesChange,
  onGlobalAction,
  globalActionsDisabled = false,
  syncStatus,
  quickCapture,
  utilityActions,
  focusControl,
  viewNavigation,
  eyebrow,
  subtitle,
  titleContext,
  tabsInHeader = false,
  badges,
  onOpenCommand,
  captureShortcut,
  children,
}: PlannerShellProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div
      data-destination={location.destination}
      data-view={location.view}
      // The grey page backdrop is Dashboard-only (owner decision 2026-10-13, D1).
      data-backdrop={location.destination === "home" && location.view === "overview" ? "page" : undefined}
      className={`planner-shell phase4-planner-shell pc-shell${
        preferences.railCollapsed ? " is-rail-collapsed" : ""
      }${preferences.density === "compact" ? " mobile-density-compact" : ""}${focusControl ? " has-focus-control" : ""}`}
    >
      <PlannerRail
        location={location}
        collapsed={preferences.railCollapsed}
        timezone={timezone}
        badges={badges}
        onNavigate={onNavigate}
        onOpenCommand={onOpenCommand}
        onToggleCollapsed={() =>
          onPreferencesChange({
            ...preferences,
            railCollapsed: !preferences.railCollapsed,
          })
        }
      />
      <main
        className="planner-main"
        data-scroll-owner="destination"
        data-selected-record={selectedRecord ?? undefined}
      >
        <header className={`planner-topbar${tabsInHeader ? " pc-topbar-hero" : ""}`}>
          <div className="planner-title">
            {eyebrow ? <p className="pc-topbar-eyebrow">{eyebrow}</p> : null}
            <h1>{title}{titleContext ? <span className="sr-only">, {titleContext}</span> : null}</h1>
            {eyebrow ? null : <p className="top-date">{dateLabel}</p>}
            {subtitle ? <p className="pc-topbar-subtitle">{subtitle}</p> : null}
          </div>
          {tabsInHeader && viewNavigation ? <div className="pc-topbar-tabs" data-shell-region="view-navigation">{viewNavigation}</div> : null}
          <div className="top-actions phase4-top-actions">
            {/* D2.5: the Focus pill docks in the header's right cluster (fixed above the bar on phones). */}
            {focusControl ? <div className="pc-focus-dock" data-shell-region="focus">{focusControl}</div> : null}
            <GlobalActions
              onAction={onGlobalAction}
              disabled={globalActionsDisabled}
              captureShortcut={captureShortcut}
              secondaryControls={<>{utilityActions}{quickCapture ? <details className="planner-quick-entry"><summary>Quick entry</summary><div className="planner-quick-entry-form">{quickCapture}</div></details> : null}</>}
            />
          </div>
        </header>
        {viewNavigation && !tabsInHeader ? <div className="planner-view-navigation" data-shell-region="view-navigation">{viewNavigation}</div> : null}
        {syncStatus ? <div className="planner-status-region">{syncStatus}</div> : null}
        {children}
      </main>
      <PhoneNavigation
        location={location}
        preferences={preferences}
        moreOpen={moreOpen}
        onMoreOpenChange={setMoreOpen}
        onNavigate={onNavigate}
        onCapture={globalActionsDisabled ? undefined : () => onGlobalAction("capture")}
      />
    </div>
  );
}
