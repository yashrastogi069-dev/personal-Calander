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
import {
  labelForPlannerTarget,
  shellSecondaryTargets,
  targetForDestination,
} from "./PlannerRail";

const icons: Record<Phase4DestinationId | "settings", LucideIcon> = {
  home: Grid2X2,
  tasks: Inbox,
  plan: ListChecks,
  intentions: Flag,
  habits: TimerReset,
  review: Sparkles,
  settings: Settings2,
};

export function plannerShortcutKey(
  target: Pick<PlannerLocationTarget, "destination" | "view">
) {
  return `${target.destination}/${target.view}`;
}
function uniqueTargets(targets: readonly PlannerPreferenceShortcut[]) {
  const seen = new Set<string>();
  return targets.filter(target => {
    const key = plannerShortcutKey(target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function movePlannerShortcut(
  preferences: Phase4Preferences,
  key: string,
  direction: -1 | 1
): Phase4Preferences {
  const index = preferences.order.findIndex(
    shortcut => plannerShortcutKey(shortcut) === key
  );
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= preferences.order.length)
    return preferences;
  const order = [...preferences.order];
  [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
  return { ...preferences, order };
}

export function togglePlannerPrimaryShortcut(
  preferences: Phase4Preferences,
  shortcut: PlannerPreferenceShortcut,
  maximum = 4
): Phase4Preferences {
  const key = plannerShortcutKey(shortcut);
  const pinned = preferences.primary.some(
    candidate => plannerShortcutKey(candidate) === key
  );
  if (pinned) {
    if (preferences.primary.length === 1) return preferences;
    return {
      ...preferences,
      primary: preferences.primary.filter(
        candidate => plannerShortcutKey(candidate) !== key
      ),
    };
  }
  const primary =
    preferences.primary.length >= maximum
      ? [...preferences.primary.slice(0, maximum - 1), shortcut]
      : [...preferences.primary, shortcut];
  return { ...preferences, primary };
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
    const primaryKeys = new Set(primary.map(plannerShortcutKey));
    const canonical = [
      ...phase4Destinations.map(destination => ({
        ...targetForDestination(destination.id),
      })),
      ...shellSecondaryTargets.map(({ label: _label, ...target }) => target),
      { destination: "settings", view: "account" } as const,
    ];
    return uniqueTargets([...preferences.order, ...canonical]).filter(
      target => !primaryKeys.has(plannerShortcutKey(target))
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
              key={plannerShortcutKey(target)}
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
                key={plannerShortcutKey(target)}
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
