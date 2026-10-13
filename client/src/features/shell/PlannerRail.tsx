import {
  BarChart3,
  CalendarDays,
  CalendarRange,
  CircleDot,
  Flag,
  Grid2X2,
  Inbox,
  LayoutDashboard,
  Link2,
  ListChecks,
  Milestone,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Sparkles,
  Sun,
  Target,
  Timer,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import { GLIDE, RADIUS } from "@/design/motion";
import {
  activeNavState,
  badgeText,
  premiumNavGroups,
  premiumRailMoreItems,
  type NavBadgeCounts,
  type PremiumNavItem,
} from "./premiumNavigation";
import {
  plannerViewLabel,
  type Phase4DestinationId,
  type PlannerLocationTarget,
} from "@shared/phase4Navigation";

export const shellSecondaryTargets = [
  { label: "Calendar", destination: "plan", view: "calendar" },
  { label: "Roadmap", destination: "plan", view: "roadmap" },
  { label: "Goals", destination: "intentions", view: "outcomes" },
  { label: "Connections", destination: "settings", view: "connections" },
  { label: "Analytics", destination: "review", view: "insights" },
  {
    label: "Categories & Recycle Bin",
    destination: "settings",
    view: "categories",
  },
] as const satisfies readonly ({ label: string } & PlannerLocationTarget)[];

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
  return plannerViewLabel(target);
}

export const premiumNavIcons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  today: Sun,
  inbox: Inbox,
  tasks: ListChecks,
  plan: CalendarRange,
  calendar: CalendarDays,
  roadmap: Milestone,
  projects: Flag,
  habits: TimerReset,
  focus: Timer,
  review: Sparkles,
  analytics: BarChart3,
  goals: Target,
  connections: Link2,
  categories: CircleDot,
};

function RailItem({
  item,
  exact,
  parent,
  collapsed,
  badges,
  onNavigate,
}: {
  item: PremiumNavItem;
  exact: boolean;
  parent: boolean;
  collapsed: boolean;
  badges?: NavBadgeCounts;
  onNavigate: (target: PlannerLocationTarget) => void;
}) {
  const Icon = premiumNavIcons[item.id] ?? Grid2X2;
  const badge = item.badge ? badgeText(item.badge, badges?.[item.badge]) : null;
  return (
    <button
      type="button"
      className={exact ? "is-active" : parent ? "is-active-parent" : undefined}
      aria-current={exact ? "page" : undefined}
      aria-label={badge ? `${item.label}, ${badge}` : item.label}
      title={collapsed ? item.label : undefined}
      onClick={() => onNavigate(item.target)}
    >
      {exact ? (
        // One shared highlight glides between destinations; reduced motion comes from <MotionConfig reducedMotion="user">.
        <motion.span
          layoutId="pc-rail-active"
          layoutDependency={item.id}
          className="pc-rail-indicator"
          aria-hidden="true"
          style={{ borderRadius: RADIUS.control }}
          transition={GLIDE}
        />
      ) : null}
      <Icon aria-hidden="true" size={18} strokeWidth={1.75} className={exact ? "pc-icon-pop" : undefined} />
      <span>{item.label}</span>
      {badge ? (
        <span className={`pc-rail-badge${item.badge === "overdue" ? " is-alert" : ""}`}>{badge}</span>
      ) : null}
    </button>
  );
}

export function PlannerRail({
  location,
  collapsed,
  timezone,
  badges,
  onNavigate,
  onToggleCollapsed,
  onOpenCommand,
}: {
  location: PlannerLocationTarget;
  collapsed: boolean;
  timezone: string;
  badges?: NavBadgeCounts;
  onNavigate: (target: PlannerLocationTarget) => void;
  onToggleCollapsed: () => void;
  /** Opens the ⌘K command palette; falls back to the Search page when absent. */
  onOpenCommand?: () => void;
}) {
  const { exactId, parentId } = activeNavState(location);
  const searchActive = location.destination === "home" && location.view === "search";
  return (
    <aside className="planner-rail phase4-planner-rail pc-rail" data-scroll-owner="rail">
      <div className="planner-rail-heading">
        <div className="brand-lockup" aria-label="Personal Calendar">
          <span className="brand-mark pc-brand-mark" aria-hidden="true">
            <CalendarDays size={16} strokeWidth={2.2} />
          </span>
          <span>Personal Calendar</span>
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

      <button
        type="button"
        className={`pc-rail-search${searchActive ? " is-active" : ""}`}
        aria-label="Search or jump (Control or Command K)"
        aria-keyshortcuts="Control+K Meta+K"
        title={collapsed ? "Search or jump" : undefined}
        onClick={() => (onOpenCommand ? onOpenCommand() : onNavigate({ destination: "home", view: "search", action: "search" }))}
      >
        <Search aria-hidden="true" size={17} strokeWidth={1.8} />
        <span>Search or jump</span>
        <kbd aria-hidden="true">⌘K</kbd>
      </button>

      <motion.nav layoutScroll aria-label="Planning destinations" className="planner-nav pc-rail-nav">
        {premiumNavGroups.map(group => (
          <div key={group.id} className="pc-rail-group" role="group" aria-label={group.label ?? "Home"}>
            {group.label ? <span className="planner-nav-section-label pc-rail-heading">{group.label}</span> : null}
            {group.items.map(item => (
              <RailItem
                key={item.id}
                item={item}
                exact={exactId === item.id}
                parent={parentId === item.id}
                collapsed={collapsed}
                badges={badges}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ))}
        <details className="pc-rail-more" open={premiumRailMoreItems.some(item => item.id === exactId) || undefined}>
          <summary aria-label="More destinations">
            <CircleDot aria-hidden="true" size={17} strokeWidth={1.75} />
            <span>More</span>
          </summary>
          <div className="pc-rail-group" role="group" aria-label="More destinations">
            {premiumRailMoreItems.map(item => (
              <RailItem
                key={item.id}
                item={item}
                exact={exactId === item.id}
                parent={false}
                collapsed={collapsed}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </details>
      </motion.nav>

      <div className="rail-footer">
        <button
          type="button"
          className={`workspace-pill${
            location.destination === "settings" ? " is-active" : ""
          }`}
          aria-label="Open account settings"
          aria-current={location.destination === "settings" && location.view === "account" ? "page" : undefined}
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
