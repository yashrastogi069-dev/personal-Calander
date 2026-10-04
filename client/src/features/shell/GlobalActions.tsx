import {
  Command,
  Plus,
  Search,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import type { GlobalPlannerAction } from "@shared/phase4Navigation";
import type { ReactNode } from "react";

const actions: readonly {
  id: GlobalPlannerAction;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "capture", label: "Capture", icon: Plus },
  { id: "search", label: "Search", icon: Search },
  { id: "focus", label: "Focus", icon: Command },
];

export function GlobalActions({
  onAction,
  disabled = false,
  secondaryControls,
}: {
  onAction: (action: GlobalPlannerAction) => void;
  disabled?: boolean;
  secondaryControls?: ReactNode;
}) {
  return (
    <nav className="phase4-global-actions" aria-label="Global planner actions">
      {actions.filter(action => action.id !== "focus").map(action => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            className={action.id === "capture" ? "is-primary" : "is-search"}
            onClick={() => onAction(action.id)}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
            <span>{action.label}</span>
          </button>
        );
      })}
      <details className="planner-header-tools">
        <summary aria-label="More planner controls" title="Focus, quick entry and planner controls"><MoreHorizontal aria-hidden="true" size={19} /><span>More controls</span></summary>
        <div className="planner-header-tools-content">
          <button type="button" disabled={disabled} onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); onAction("focus"); }}><Command aria-hidden="true" size={18} /><span>Focus</span></button>
          {secondaryControls}
        </div>
      </details>
    </nav>
  );
}
