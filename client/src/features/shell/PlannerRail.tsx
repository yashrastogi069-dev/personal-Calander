import {
  BarChart3,
  CalendarDays,
  CircleDot,
  Flag,
  Grid2X2,
  Inbox,
  Link2,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  Sparkles,
  Target,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import {
  phase4Destinations,
  type Phase4DestinationId,
  type PlannerLocationTarget,
} from "@shared/phase4Navigation";

export const shellSecondaryTargets = [
  { label: "Calendar", destination: "plan", view: "calendar" },
  { label: "Goals", destination: "intentions", view: "outcomes" },
  { label: "Connections", destination: "settings", view: "connections" },
  { label: "Insights", destination: "review", view: "insights" },
  {
    label: "Categories & Recycle Bin",
    destination: "settings",
    view: "categories",
  },
] as const satisfies readonly ({ label: string } & PlannerLocationTarget)[];

const secondaryIcons: Record<
  (typeof shellSecondaryTargets)[number]["label"],
  LucideIcon
> = {
  Calendar: CalendarDays,
  Goals: Target,
  Connections: Link2,
  Insights: BarChart3,
  "Categories & Recycle Bin": CircleDot,
};

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
  const secondary = shellSecondaryTargets.find(
    item =>
      item.destination === target.destination && item.view === target.view
  );
  if (secondary) return secondary.label;
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
          const target = targetForDestination(item.id);
          const active =
            location.destination === target.destination &&
            location.view === target.view;
          return (
            <button
              key={item.id}
              type="button"
              className={active ? "is-active" : undefined}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? item.label : undefined}
              title={collapsed ? item.label : undefined}
              onClick={() => onNavigate(target)}
            >
              <Icon aria-hidden="true" size={18} strokeWidth={1.75} />
              <span>{item.label}</span>
            </button>
          );
        })}
        <div
          className="planner-nav-secondary"
          role="group"
          aria-label="Planning view shortcuts"
        >
          <span className="planner-nav-section-label">Views</span>
          {shellSecondaryTargets.map(item => {
            const Icon = secondaryIcons[item.label];
            const active =
              location.destination === item.destination &&
              location.view === item.view;
            return (
              <button
                key={`${item.destination}/${item.view}`}
                type="button"
                className={active ? "is-active" : undefined}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                onClick={() => onNavigate(item)}
              >
                <Icon aria-hidden="true" size={17} strokeWidth={1.75} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
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
