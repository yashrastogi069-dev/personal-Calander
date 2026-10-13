// Premium D1 navigation model: grouped sidebar, Home view tabs and badge counts.
// Spec: docs/superpowers/specs/2026-10-13-premium-redesign-d1-shell.md
import type { PlannerLocationTarget } from "@shared/phase4Navigation";

export type NavBadgeKey = "todayLeft" | "inbox" | "overdue" | "habitsDue";
export type NavBadgeCounts = Partial<Record<NavBadgeKey, number>>;

export type PremiumNavItem = {
  id: string;
  label: string;
  target: PlannerLocationTarget;
  badge?: NavBadgeKey;
  /** Extra words the command palette matches on. */
  keywords?: string;
};

export type PremiumNavGroup = { id: "main" | "plan" | "grow" | "reflect"; label: string | null; items: PremiumNavItem[] };

export const premiumNavGroups: readonly PremiumNavGroup[] = [
  {
    id: "main",
    label: null,
    items: [
      { id: "dashboard", label: "Dashboard", target: { destination: "home", view: "overview" }, keywords: "home overview" },
      { id: "today", label: "Today", target: { destination: "home", view: "today" }, badge: "todayLeft" },
      { id: "inbox", label: "Inbox", target: { destination: "tasks", view: "inbox" }, badge: "inbox", keywords: "triage capture" },
    ],
  },
  {
    id: "plan",
    label: "Plan",
    items: [
      { id: "tasks", label: "Tasks", target: { destination: "tasks", view: "list" }, badge: "overdue", keywords: "todo board" },
      { id: "plan", label: "Plan", target: { destination: "plan", view: "daily" }, keywords: "week studio weekly" },
      { id: "calendar", label: "Calendar", target: { destination: "plan", view: "calendar" }, keywords: "schedule events" },
      { id: "roadmap", label: "Roadmap", target: { destination: "plan", view: "roadmap" }, keywords: "timeline milestones" },
    ],
  },
  {
    id: "grow",
    label: "Grow",
    items: [
      { id: "projects", label: "Goals & Projects", target: { destination: "intentions", view: "projects" }, keywords: "outcomes directions" },
      { id: "habits", label: "Habits", target: { destination: "habits", view: "due" }, badge: "habitsDue", keywords: "routines streak" },
      { id: "focus", label: "Focus", target: { destination: "home", view: "focus", action: "focus" }, keywords: "timer session deep work" },
    ],
  },
  {
    id: "reflect",
    label: "Reflect",
    items: [
      { id: "review", label: "Review", target: { destination: "review", view: "rituals" }, keywords: "weekly review rituals" },
      { id: "analytics", label: "Analytics", target: { destination: "review", view: "insights" }, keywords: "insights stats trends" },
    ],
  },
];

/** Settings-area shortcuts kept in the rail's small "More" list so no destination is lost. */
export const premiumRailMoreItems: readonly PremiumNavItem[] = [
  { id: "goals", label: "Goals", target: { destination: "intentions", view: "outcomes" } },
  { id: "connections", label: "Connections", target: { destination: "settings", view: "connections" }, keywords: "google calendar feed" },
  { id: "categories", label: "Categories & Recycle Bin", target: { destination: "settings", view: "categories" }, keywords: "trash deleted" },
];

export const allPremiumNavItems: readonly PremiumNavItem[] = [...premiumNavGroups.flatMap(group => group.items), ...premiumRailMoreItems];

function sameTarget(a: PlannerLocationTarget, b: PlannerLocationTarget) {
  return a.destination === b.destination && a.view === b.view;
}

/** Exact item for the location, else the first item of the same destination (parent highlight). */
export function activeNavState(location: PlannerLocationTarget): { exactId: string | null; parentId: string | null } {
  const exact = allPremiumNavItems.find(item => sameTarget(item.target, location));
  if (exact) return { exactId: exact.id, parentId: null };
  const parent = premiumNavGroups.flatMap(group => group.items).find(item => item.target.destination === location.destination);
  return { exactId: null, parentId: parent?.id ?? null };
}

export type HomeTabId = "dashboard" | "today" | "calendar";
export const homeTabs: ReadonlyArray<{ value: HomeTabId; label: string; target: PlannerLocationTarget }> = [
  { value: "dashboard", label: "Dashboard", target: { destination: "home", view: "overview" } },
  { value: "today", label: "Today", target: { destination: "home", view: "today" } },
  { value: "calendar", label: "Calendar", target: { destination: "plan", view: "calendar" } },
];

/** The Home tabs show on Dashboard, Today and Calendar, so the three views switch in one click. */
export function homeTabForLocation(location: PlannerLocationTarget): HomeTabId | null {
  return homeTabs.find(tab => sameTarget(tab.target, location))?.value ?? null;
}

type BadgeTask = { state: string; dueLocalDate?: string | null; scheduledLocalDate?: string | null; plannedStartAt?: unknown; plannedEndAt?: unknown };

export function navBadgeCounts(input: {
  today: string;
  tasks: readonly BadgeTask[];
  todayTaskCount: number | null;
  dueHabitCount: number | null;
}): NavBadgeCounts {
  const open = input.tasks.filter(task => task.state !== "completed" && task.state !== "archived");
  return {
    inbox: open.filter(task => !task.scheduledLocalDate && !task.plannedStartAt && !task.plannedEndAt).length,
    overdue: open.filter(task => task.dueLocalDate != null && task.dueLocalDate < input.today).length,
    todayLeft: input.todayTaskCount ?? undefined,
    habitsDue: input.dueHabitCount ?? undefined,
  };
}

export function badgeText(key: NavBadgeKey, count: number | undefined): string | null {
  if (!count) return null;
  if (key === "todayLeft") return `${count} left`;
  if (key === "overdue") return `${count} overdue`;
  if (key === "habitsDue") return `${count} due`;
  return String(count);
}
