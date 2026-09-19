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
import "./planner-shell.css";

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
  children,
}: PlannerShellProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div
      className={`planner-shell phase4-planner-shell${
        preferences.railCollapsed ? " is-rail-collapsed" : ""
      }${preferences.density === "compact" ? " mobile-density-compact" : ""}`}
    >
      <PlannerRail
        location={location}
        collapsed={preferences.railCollapsed}
        timezone={timezone}
        onNavigate={onNavigate}
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
        {syncStatus}
        <header className="planner-topbar">
          <div>
            <p className="top-date">{dateLabel}</p>
            <h1>{title}</h1>
          </div>
          {quickCapture}
          <div className="top-actions phase4-top-actions">
            {utilityActions}
            <GlobalActions
              onAction={onGlobalAction}
              disabled={globalActionsDisabled}
            />
          </div>
        </header>
        {children}
      </main>
      <PhoneNavigation
        location={location}
        preferences={preferences}
        moreOpen={moreOpen}
        onMoreOpenChange={setMoreOpen}
        onNavigate={onNavigate}
      />
    </div>
  );
}
