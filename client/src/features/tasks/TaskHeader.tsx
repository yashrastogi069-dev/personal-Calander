// TaskHeader: the summary line and the tabs Inbox · List · Board, then the quiet Archive (owner decisions Q8,
// Q9; Tasks T2a). T2b-1 "one header, not two": the shell bar owns the page title ("Tasks", the h1) and the one
// Capture button (shortcut C), so this no longer repeats either. Numbers in the summary roll when they change.
// Tabs use manual activation because choosing one navigates.
import { Archive, CloudOff, Inbox, LayoutGrid, List, RefreshCw } from "lucide-react";
import { RollingCount } from "@/components/premium/FilterChips";
import { SegmentedTabs, type SegmentedItem } from "@/components/premium/SegmentedTabs";
import { ReviewChip } from "@/components/premium/Surfaces";
import { cn } from "@/lib/utils";
import type { TaskHeaderSummary, TaskWorkspaceView } from "./taskWorkspaceModel";
import "./tasks-premium.css";

export type TaskTabView = TaskWorkspaceView;

export type TaskHeaderProps = {
  summary: TaskHeaderSummary;
  view: TaskWorkspaceView;
  onViewChange: (view: TaskTabView) => void;
  /** Tasks with kept field conflicts. Hidden at zero. */
  reviewCount?: number;
  onReview?: () => void;
  offline?: boolean;
  /** "Showing saved copy from 10:42" when the snapshot could not load but a saved copy exists. */
  savedCopyLabel?: string | null;
  className?: string;
};

/** The summary line as plain text for assistive tech and tests ("36 open · 3 overdue · 13 for today"). */
export function taskSummaryParts(summary: TaskHeaderSummary): Array<{ key: string; count: number; label: string }> {
  const parts = [{ key: "open", count: summary.open, label: "open" }];
  if (summary.overdue) parts.push({ key: "overdue", count: summary.overdue, label: "overdue" });
  if (summary.forToday) parts.push({ key: "today", count: summary.forToday, label: "for today" });
  return parts;
}

export function TaskHeader({
  summary,
  view,
  onViewChange,
  reviewCount = 0,
  onReview,
  offline = false,
  savedCopyLabel,
  className,
}: TaskHeaderProps) {
  const tabs: ReadonlyArray<SegmentedItem<TaskTabView>> = [
    { value: "inbox", label: <><Inbox size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />Inbox</>, badge: summary.inbox },
    { value: "list", label: <><List size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />List</> },
    { value: "board", label: <><LayoutGrid size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />Board</> },
    // Quiet last tab (styled by position in tasks-premium.css).
    { value: "archive", label: <><Archive size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />Archive</> },
  ];
  const parts = taskSummaryParts(summary);
  return (
    <div className={cn("tk-header", className)}>
      <div className="tk-header-row">
        <p className="tk-summary-line">
          <span className="pc-sr-only">Tasks: </span>
          <span className="tk-summary">
            {parts.map((part, index) => (
              <span key={part.key} className={cn("tk-summary-part", part.key === "overdue" && "is-off")}>
                {index > 0 ? <span className="tk-summary-dot" aria-hidden="true"> · </span> : null}
                <RollingCount value={part.count} /> {part.label}
              </span>
            ))}
          </span>
        </p>
        <div className="tk-header-actions">
          <ReviewChip icon={RefreshCw} count={reviewCount} label="to review" onClick={onReview} />
          {offline ? (
            <span className="tk-offline" role="status"><CloudOff size={14} strokeWidth={2} aria-hidden="true" />Offline · changes save on this device</span>
          ) : null}
        </div>
      </div>
      {savedCopyLabel ? <p className="tk-saved-copy" role="status">{savedCopyLabel}</p> : null}
      <SegmentedTabs<TaskTabView> label="Task views" items={tabs} value={view} onValueChange={onViewChange} activationMode="manual" className="tk-tabs" />
    </div>
  );
}
