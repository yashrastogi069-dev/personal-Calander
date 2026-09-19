import {
  Command,
  Plus,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { GlobalPlannerAction } from "@shared/phase4Navigation";

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
}: {
  onAction: (action: GlobalPlannerAction) => void;
  disabled?: boolean;
}) {
  return (
    <nav className="phase4-global-actions" aria-label="Global planner actions">
      {actions.map(action => {
        const Icon = action.icon;
        return (
          <button
            key={action.id}
            type="button"
            disabled={disabled}
            className={action.id === "capture" ? "is-primary" : undefined}
            onClick={() => onAction(action.id)}
          >
            <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
            <span>{action.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
