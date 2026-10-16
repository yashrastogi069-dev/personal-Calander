// Tasks T2a: the calm row's pills (owner decision Q6). At most 2 smart pills from shared `rowPills` (urgency,
// then project or category dot, or the Waiting chip), a quiet repeat icon, then the D4 reason chip last
// (spec D4 §5.1: not a button, 24ch max, `title` carries the full sentence). Colour always comes with a word.
import {
  AlarmClock,
  Calendar,
  CalendarClock,
  CalendarRange,
  CalendarX2,
  ClipboardCheck,
  Crosshair,
  Flag,
  Flame,
  FolderKanban,
  History,
  Hourglass,
  Lock,
  LockOpen,
  Milestone,
  Repeat,
  Sun,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { toneClassName, type ToneOrNeutral } from "@/design/categoryTone";
import { cn } from "@/lib/utils";
import type { RowPill, RowPillTone } from "@shared/taskRowPills";
import type { WhyIcon, WhyReason } from "@shared/whyItMatters";
import type { PillTone } from "./TaskMetaPills";
import "./tasks-premium.css";

const URGENCY_ICONS: Record<Extract<RowPill, { kind: "urgency" }>["icon"], LucideIcon> = {
  "alarm-clock": AlarmClock,
  flag: Flag,
  calendar: Calendar,
  sun: Sun,
  "calendar-range": CalendarRange,
};

const URGENCY_TONES: Record<RowPillTone, PillTone> = { overdue: "off", risk: "risk", plan: "neutral", today: "accent", week: "accent" };

export const WHY_ICONS: Record<WhyIcon, LucideIcon> = {
  CalendarX2,
  CalendarClock,
  LockOpen,
  ClipboardCheck,
  Milestone,
  FolderKanban,
  Target,
  TriangleAlert,
  Crosshair,
  History,
  Repeat,
  Flame,
  CalendarRange,
  Hourglass,
};

export type TaskRowPillsProps = {
  pills: readonly RowPill[];
  why?: WhyReason | null;
  /** "Weekly", "Every 2 weeks"...: drawn as an icon beside the pills, not as a pill (Q6). */
  repeat?: string | null;
  /** Category id → palette tone, so the category dot matches the rest of the app. */
  categoryTones?: ReadonlyMap<string, ToneOrNeutral>;
  className?: string;
};

export function TaskRowPills({ pills, why, repeat, categoryTones, className }: TaskRowPillsProps) {
  if (!pills.length && !why && !repeat) return null;
  return (
    <ul className={cn("tk-pills", className)} aria-label="Task details">
      {pills.map(pill => {
        if (pill.kind === "urgency") {
          const Icon = URGENCY_ICONS[pill.icon];
          return (
            <li key="urgency" className={cn("tk-pill", `is-${URGENCY_TONES[pill.tone]}`)} data-pill="urgency">
              <Icon size={13} strokeWidth={2.25} aria-hidden="true" />
              <span className="tk-pill-text">{pill.label}</span>
            </li>
          );
        }
        if (pill.kind === "project") {
          return (
            <li key="project" className="tk-pill is-neutral" data-pill="project">
              <FolderKanban size={13} strokeWidth={2.25} aria-hidden="true" />
              <span className="tk-pill-text" aria-hidden="true">{pill.label}</span>
              <span className="pc-sr-only">{`Project ${pill.label}`}</span>
            </li>
          );
        }
        if (pill.kind === "category") {
          const tone = categoryTones?.get(pill.recordId) ?? "neutral";
          return (
            <li key="category" className={cn("tk-pill is-cat", toneClassName(tone))} data-pill="category">
              <span className="pc-dot" aria-hidden="true" />
              <span className="tk-pill-text" aria-hidden="true">{pill.label}</span>
              <span className="pc-sr-only">{`Category ${pill.label}`}</span>
            </li>
          );
        }
        return (
          <li key="waiting" className="tk-pill is-risk" data-pill="waiting">
            <Lock size={13} strokeWidth={2.25} aria-hidden="true" />
            <span className="tk-pill-text">{pill.label}</span>
          </li>
        );
      })}
      {repeat ? (
        <li className="tk-pill is-icon" data-pill="repeat" title={`Repeats ${repeat.toLocaleLowerCase()}`}>
          <Repeat size={13} strokeWidth={2.25} aria-hidden="true" />
          <span className="pc-sr-only">{`Repeats ${repeat.toLocaleLowerCase()}`}</span>
        </li>
      ) : null}
      {why ? <WhyChip reason={why} /> : null}
    </ul>
  );
}

/** The D4 inline reason chip. Reasons use status tones only, never category colours. */
export function WhyChip({ reason }: { reason: WhyReason }) {
  const Icon = WHY_ICONS[reason.icon] ?? Target;
  return (
    <li className={cn("tk-pill tk-why", `is-${reason.tone}`)} data-pill="why" data-why={reason.kind} title={reason.accessible}>
      <Icon size={12} strokeWidth={2} aria-hidden="true" />
      <span className="tk-pill-text" aria-hidden="true">{reason.short}</span>
      <span className="pc-sr-only">{reason.accessible}</span>
    </li>
  );
}
