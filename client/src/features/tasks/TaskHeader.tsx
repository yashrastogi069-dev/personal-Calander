// D3 TaskHeader: title, a real summary line, Select, Capture, the overflow menu (Archived tasks) and the four
// view tabs. The page h1 belongs to the shell, so this renders an h2 through PageHeader. Numbers in the
// summary roll when they change. Tabs use manual activation because choosing one navigates.
import { Archive, ArrowLeft, Bookmark, CheckSquare, CloudOff, Inbox, LayoutGrid, List, ListChecks, Plus, RefreshCw } from "lucide-react";
import { RollingCount } from "@/components/premium/FilterChips";
import { SegmentedTabs, type SegmentedItem } from "@/components/premium/SegmentedTabs";
import { PageHeader, ReviewChip } from "@/components/premium/Surfaces";
import { cn } from "@/lib/utils";
import { TaskActionsMenu } from "./TaskRow";
import type { TaskHeaderSummary, TaskWorkspaceView } from "./taskWorkspaceModel";
import "./tasks-premium.css";

export type TaskTabView = Exclude<TaskWorkspaceView, "archive">;

export type TaskHeaderProps = {
  summary: TaskHeaderSummary;
  view: TaskWorkspaceView;
  onViewChange: (view: TaskTabView) => void;
  selectMode: boolean;
  onSelectModeChange: (next: boolean) => void;
  onCapture: () => void;
  onOpenArchive: () => void;
  /** Leave the archive view (the back button shows only while it is open). */
  onCloseArchive: () => void;
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
  selectMode,
  onSelectModeChange,
  onCapture,
  onOpenArchive,
  onCloseArchive,
  reviewCount = 0,
  onReview,
  offline = false,
  savedCopyLabel,
  className,
}: TaskHeaderProps) {
  const archived = view === "archive";
  const tabs: ReadonlyArray<SegmentedItem<TaskTabView>> = [
    { value: "inbox", label: <><Inbox size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />Inbox</>, badge: summary.inbox },
    { value: "list", label: <><List size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />List</> },
    { value: "board", label: <><LayoutGrid size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />Board</> },
    { value: "saved", label: <><Bookmark size={15} strokeWidth={2} aria-hidden="true" className="tk-tab-icon" />Views</> },
  ];
  const parts = taskSummaryParts(summary);
  return (
    <div className={cn("tk-header", className)}>
      <PageHeader
        icon={archived ? Archive : ListChecks}
        tone="pc-tone-accent"
        title={archived ? "Archived tasks" : "Tasks"}
        subtitle={
          archived ? "Restoring a task returns the same record to To do." : (
            <span className="tk-summary">
              {parts.map((part, index) => (
                <span key={part.key} className={cn("tk-summary-part", part.key === "overdue" && "is-off")}>
                  {index > 0 ? <span className="tk-summary-dot" aria-hidden="true"> · </span> : null}
                  <RollingCount value={part.count} /> {part.label}
                </span>
              ))}
            </span>
          )
        }
        actions={
          <div className="tk-header-actions">
            <ReviewChip icon={RefreshCw} count={reviewCount} label="to review" onClick={onReview} />
            {offline ? (
              <span className="tk-offline" role="status"><CloudOff size={14} strokeWidth={2} aria-hidden="true" />Offline · changes save on this device</span>
            ) : null}
            {archived ? (
              <button type="button" className="tk-btn is-ghost pc-focusable" onClick={onCloseArchive}><ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />Back to tasks</button>
            ) : (
              <>
                <button type="button" className={cn("tk-btn is-ghost pc-focusable", selectMode && "is-on")} aria-pressed={selectMode} onClick={() => onSelectModeChange(!selectMode)}>
                  <CheckSquare size={16} strokeWidth={2} aria-hidden="true" />Select
                </button>
                <button type="button" className="tk-btn is-accent pc-focusable" onClick={onCapture}><Plus size={16} strokeWidth={2.5} aria-hidden="true" />Capture</button>
                <TaskActionsMenu title="Tasks" label="More task options" actions={[{ id: "archive", label: "Archived tasks", icon: Archive, onSelect: onOpenArchive }]} />
              </>
            )}
          </div>
        }
      />
      {savedCopyLabel ? <p className="tk-saved-copy" role="status">{savedCopyLabel}</p> : null}
      {archived ? null : (
        <SegmentedTabs<TaskTabView> label="Task views" items={tabs} value={view as TaskTabView} onValueChange={onViewChange} activationMode="manual" className="tk-tabs" />
      )}
    </div>
  );
}
