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
  /** Live counts for rail badges (D1). */
  badges?: NavBadgeCounts;
  /** Opens the ⌘K command palette. */
  onOpenCommand?: () => void;
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
  badges,
  onOpenCommand,
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
        <header className="planner-topbar">
          <div className="planner-title">
            <h1>{title}</h1>
            <p className="top-date">{dateLabel}</p>
          </div>
          <div className="top-actions phase4-top-actions">
            <GlobalActions
              onAction={onGlobalAction}
              disabled={globalActionsDisabled}
              secondaryControls={<>{utilityActions}{quickCapture ? <details className="planner-quick-entry"><summary>Quick entry</summary><div className="planner-quick-entry-form">{quickCapture}</div></details> : null}</>}
            />
          </div>
        </header>
        {viewNavigation ? <div className="planner-view-navigation" data-shell-region="view-navigation">{viewNavigation}</div> : null}
        {syncStatus ? <div className="planner-status-region">{syncStatus}</div> : null}
        {focusControl}
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
