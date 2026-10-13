import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { resolveCategoryTone, toneClassName, type CategoryLike, type ToneOrNeutral } from "@/design/categoryTone";
import { formatMinutes, timeChipState } from "@/design/timeFormat";

export function Pill({ tone, className, children }: { tone?: ToneOrNeutral; className?: string; children: ReactNode }) {
  return <span className={cn("pc-pill", tone && "pc-pill-tinted", tone && toneClassName(tone), className)}>{children}</span>;
}

export type PlanStatus = "on" | "risk" | "off";

const STATUS_LABELS: Record<PlanStatus, string> = { on: "On track", risk: "At risk", off: "Off track" };

export function StatusPill({ status, label, className }: { status: PlanStatus; label?: string; className?: string }) {
  return (
    <span className={cn("pc-status", `pc-status-${status}`, className)} data-status={status}>
      {label ?? STATUS_LABELS[status]}
    </span>
  );
}

export function TimeChip({
  plannedMinutes,
  actualMinutes,
  className,
}: {
  plannedMinutes?: number | null;
  actualMinutes?: number | null;
  className?: string;
}) {
  const state = timeChipState(plannedMinutes, actualMinutes);
  if (!state) return null;
  const planned = plannedMinutes ? formatMinutes(plannedMinutes) : null;
  const actual = actualMinutes ? formatMinutes(actualMinutes) : null;
  let text: ReactNode;
  let label: string;
  if (state === "planned") {
    text = <><b>{planned}</b> planned</>;
    label = `${planned} planned`;
  } else if (state === "tracked") {
    text = <><b>{actual}</b> tracked</>;
    label = `${actual} tracked`;
  } else if (state === "on-estimate") {
    text = <>{planned} / <b>{actual}</b></>;
    label = `${planned} planned, ${actual} actual`;
  } else {
    const over = formatMinutes((actualMinutes ?? 0) - (plannedMinutes ?? 0));
    text = <>{planned} / <b>{actual}</b> · +{over} over</>;
    label = `${planned} planned, ${actual} actual, ${over} over estimate`;
  }
  return (
    <span className={cn("pc-time", `pc-time-${state}`, className)} aria-label={label} title={label}>
      {text}
    </span>
  );
}

/** Pass `tone` from resolveCategoryTones() when the whole workspace is known, so slots don't collide. */
export function CategoryChip({ category, tone, className }: { category: CategoryLike; tone?: ToneOrNeutral; className?: string }) {
  if (!category) return null;
  return (
    <span className={cn("pc-pill pc-pill-tinted", toneClassName(tone ?? resolveCategoryTone(category)), className)}>
      <span className="pc-dot" aria-hidden="true" />
      {category.name}
    </span>
  );
}
