// Small shared surfaces for D2.5 onwards: section headers, empty states and the review chip.
// Icons always sit beside words (owner rule: no icon-only meaning).
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import "./premium.css";

/** Section header inside a page. The page h1 belongs to the shell, so this renders h2 by default. */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  tone,
  level = 2,
  id,
  className,
}: {
  icon?: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Tone class for the icon tile, e.g. "pc-tone-work". */
  tone?: string;
  level?: 2 | 3;
  id?: string;
  className?: string;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <header className={cn("pc-page-header", className)}>
      {Icon ? (
        <span className={cn("pc-icon-tile", tone)} aria-hidden="true"><Icon size={16} strokeWidth={2} /></span>
      ) : null}
      <div className="pc-page-header-text">
        <Heading id={id} className="pc-page-header-title">{title}</Heading>
        {subtitle ? <p className="pc-page-header-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="pc-page-header-actions">{actions}</div> : null}
    </header>
  );
}

/** A composed empty state: what is missing and how to fill it. */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tone,
  className,
}: {
  icon: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  tone?: string;
  className?: string;
}) {
  return (
    <div className={cn("pc-empty", className)}>
      <span className={cn("pc-icon-tile is-large", tone ?? "pc-tone-neutral")} aria-hidden="true"><Icon size={20} strokeWidth={2} /></span>
      <p className="pc-empty-title">{title}</p>
      {body ? <p className="pc-empty-body">{body}</p> : null}
      {action ? <div className="pc-empty-action">{action}</div> : null}
    </div>
  );
}

/** Header chip for work that needs a decision ("3 to review"). Hidden at zero: no fake badges. */
export function ReviewChip({
  icon: Icon,
  count,
  label,
  onClick,
  className,
}: {
  icon: LucideIcon;
  count: number;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  if (!Number.isFinite(count) || count <= 0) return null;
  const content = (
    <>
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      <span className="pc-num"><b>{count}</b> {label}</span>
    </>
  );
  return onClick ? (
    <button type="button" className={cn("pc-review-chip pc-focusable", className)} onClick={onClick}>{content}</button>
  ) : (
    <span className={cn("pc-review-chip", className)}>{content}</span>
  );
}
