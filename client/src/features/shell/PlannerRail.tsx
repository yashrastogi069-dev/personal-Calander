import {
  Flag,
  Grid2X2,
  Inbox,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sparkles,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import {
  phase4Destinations,
  type Phase4DestinationId,
  type PlannerLocationTarget,
} from "@shared/phase4Navigation";

const icons: Record<Phase4DestinationId, LucideIcon> = {
  home: Grid2X2,
  tasks: Inbox,
  plan: ListChecks,
  intentions: Flag,
  habits: TimerReset,
  review: Sparkles,
};

const defaultView: Record<Phase4DestinationId, PlannerLocationTarget["view"]> = {
  home: "today",
  tasks: "list",
  plan: "daily",
  intentions: "projects",
  habits: "due",
  review: "rituals",
};

export function targetForDestination(
  destination: Phase4DestinationId
): PlannerLocationTarget {
  return { destination, view: defaultView[destination] };
}
export function labelForPlannerTarget(target: PlannerLocationTarget) {
  if (target.destination === "settings") return "Settings";
  return (
    phase4Destinations.find(item => item.id === target.destination)?.label ??
    "Planner"
  );
}

export function PlannerRail({
  location,
  collapsed,
  timezone,
  onNavigate,
  onToggleCollapsed,
}: {
  location: PlannerLocationTarget;
  collapsed: boolean;
  timezone: string;
  onNavigate: (target: PlannerLocationTarget) => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <aside className="planner-rail phase4-planner-rail" data-scroll-owner="rail">
      <div className="planner-rail-heading">
        <div className="brand-lockup" aria-label="Personal Calendar">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>
            Personal
            <br />
            <b>Calendar</b>
          </span>
        </div>
        <button
          type="button"
          className="rail-collapse-button"
          aria-label={
            collapsed ? "Expand planning sidebar" : "Collapse planning sidebar"
          }
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden="true" size={18} />
          ) : (
            <PanelLeftClose aria-hidden="true" size={18} />
          )}
        </button>
      </div>

      <nav aria-label="Planning destinations" className="planner-nav">
        {phase4Destinations.map(item => {
          const Icon = icons[item.id];
          const active = location.destination === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "is-active" : undefined}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              onClick={() => onNavigate(targetForDestination(item.id))}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="rail-footer">
        <button
          type="button"
          className={`workspace-pill${
            location.destination === "settings" ? " is-active" : ""
          }`}
          aria-label="Open account settings"
          title={collapsed ? "Personal space settings" : undefined}
          onClick={() =>
            onNavigate({ destination: "settings", view: "account" })
          }
        >
          <span className="workspace-avatar">P</span>
          <div>
            <strong>Personal space</strong>
            <small>{timezone.replaceAll("_", " ")}</small>
          </div>
          <Settings2
            aria-hidden="true"
            className="workspace-settings-icon"
            size={16}
          />
        </button>
      </div>
    </aside>
  );
}
