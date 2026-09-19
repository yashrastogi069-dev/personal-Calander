import {
  Flag,
  Grid2X2,
  Inbox,
  ListChecks,
  MoreHorizontal,
  Settings2,
  Sparkles,
  TimerReset,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef } from "react";
import {
  phase4Destinations,
  type Phase4DestinationId,
  type PlannerLocationTarget,
} from "@shared/phase4Navigation";
import type {
  Phase4Preferences,
  PlannerPreferenceShortcut,
} from "@shared/phase4Preferences";
import { PlannerSheet } from "./PlannerSheet";
import { labelForPlannerTarget, targetForDestination } from "./PlannerRail";

const icons: Record<Phase4DestinationId | "settings", LucideIcon> = {
  home: Grid2X2,
  tasks: Inbox,
  plan: ListChecks,
  intentions: Flag,
  habits: TimerReset,
  review: Sparkles,
  settings: Settings2,
};

function targetKey(target: Pick<PlannerLocationTarget, "destination" | "view">) {
  return `${target.destination}/${target.view}`;
}
function uniqueTargets(targets: readonly PlannerPreferenceShortcut[]) {
  const seen = new Set<string>();
  return targets.filter(target => {
    const key = targetKey(target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isActive(
  location: PlannerLocationTarget,
  target: PlannerLocationTarget
) {
  return (
    location.destination === target.destination && location.view === target.view
  );
}

function iconFor(target: PlannerLocationTarget) {
  return icons[target.destination];
}

function labelForShortcut(target: PlannerPreferenceShortcut) {
  if (target.legacyId === "today") return "Today";
  if (target.legacyId)
    return target.legacyId.charAt(0).toUpperCase() + target.legacyId.slice(1);
  return labelForPlannerTarget(target);
}

export function PhoneNavigation({
  location,
  preferences,
  moreOpen,
  onMoreOpenChange,
  onNavigate,
}: {
  location: PlannerLocationTarget;
  preferences: Phase4Preferences;
  moreOpen: boolean;
  onMoreOpenChange: (open: boolean) => void;
  onNavigate: (target: PlannerLocationTarget) => void;
}) {
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const primary = useMemo(
    () =>
      uniqueTargets([...preferences.primary, ...preferences.order]).slice(0, 4),
    [preferences.order, preferences.primary]
  );
  const moreTargets = useMemo(() => {
    const primaryKeys = new Set(primary.map(targetKey));
    const canonical = [
      ...phase4Destinations.map(destination => ({
        ...targetForDestination(destination.id),
      })),
      { destination: "settings", view: "account" } as const,
    ];
    return uniqueTargets([...preferences.order, ...canonical]).filter(
      target => !primaryKeys.has(targetKey(target))
    );
  }, [preferences.order, primary]);
  const moreIsActive = moreTargets.some(target => isActive(location, target));

  const navigate = (target: PlannerLocationTarget) => {
    onNavigate(target);
    onMoreOpenChange(false);
  };

  return (
    <>
      <nav aria-label="Phone planning destinations" className="mobile-planner-nav">
        {primary.map(target => {
          const Icon = iconFor(target);
          const label = labelForShortcut(target);
          const active = isActive(location, target);
          return (
            <button
              key={targetKey(target)}
              type="button"
              className={active ? "is-active" : undefined}
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(target)}
            >
              <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
              <span>{label}</span>
            </button>
          );
        })}
        <button
          ref={moreButtonRef}
          type="button"
          className={moreOpen || moreIsActive ? "is-active" : undefined}
          aria-controls="phase4-phone-more"
          aria-expanded={moreOpen}
          onClick={() => onMoreOpenChange(!moreOpen)}
        >
          <MoreHorizontal aria-hidden="true" size={21} strokeWidth={1.8} />
          <span>More</span>
        </button>
      </nav>

      <PlannerSheet
        open={moreOpen}
        title="More planning"
        description="Every destination stays within reach."
        onOpenChange={onMoreOpenChange}
        returnFocusRef={moreButtonRef}
      >
        <nav
          id="phase4-phone-more"
          className="phase4-phone-more-list"
          aria-label="More planning destinations"
        >
          {moreTargets.map(target => {
            const Icon = iconFor(target);
            const label = labelForShortcut(target);
            const active = isActive(location, target);
            return (
              <button
                key={targetKey(target)}
                type="button"
                className={active ? "is-active" : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => navigate(target)}
              >
                <Icon aria-hidden="true" size={20} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>
      </PlannerSheet>
    </>
  );
}
