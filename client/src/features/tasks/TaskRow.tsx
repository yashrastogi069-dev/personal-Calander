// D3 TaskRow: one List row (Tasks surface only; CanonicalTaskRow still serves Today and Calendar until D3.5).
// Left to right: check, title, meta pills, then Focus and More on hover or focus, and the drag handle slot.
// Narrow lists (a container query, so it also covers the phone) stack the pills under the title.
// The calm List (Tasks T2a, Q6) passes `meta` (at most 2 smart pills plus the reason chip) and `estimate`;
// its Focus and More float in over the row end and reserve no width.
// T2b-2: the row is a static host (the swipe underlay) around the moving face `.tk-row`, a gutter select box
// for bulk select, and the phone gestures from TaskSwipe.tsx.
// Presentation only: it takes a TaskCardModel and callbacks, never snapshot data.
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, MoreHorizontal, Play, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { toneClassName } from "@/design/categoryTone";
import { formatMinutes } from "@/design/timeFormat";
import { cn } from "@/lib/utils";
import { CheckButton } from "./CheckButton";
import type { TaskCardModel } from "./taskCardModel";
import { TaskMetaPills } from "./TaskMetaPills";
import { TaskSwipeFrame, type TaskSwipeConfig } from "./TaskSwipe";
import "./tasks-premium.css";

export type TaskRowAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  disabled?: boolean;
  /** Visible under the label when disabled, so a refusal is never silent. */
  reason?: string;
  danger?: boolean;
};

export type TaskRowProps = {
  model: TaskCardModel;
  /** Position in its section: drives the entrance stagger (capped at 8). */
  index?: number;
  /** Play the entrance rise. Only the first mount of a route should pass true. */
  enter?: boolean;
  onOpen: (model: TaskCardModel, trigger: HTMLElement) => void;
  onToggle: (model: TaskCardModel) => void;
  /** Called when a guarded check is pressed, so the caller can open Plan or the detail sheet. */
  onBlockedCheck?: (model: TaskCardModel) => void;
  /** Shows the hover/focus Focus button on open tasks. */
  onStartFocus?: (model: TaskCardModel) => void;
  /** More menu items (Open details, Move to, Archive, ...). The menu is hidden when empty. */
  actions?: ReadonlyArray<TaskRowAction>;
  /** Drag handle (Manual sort only). D3b supplies the dnd-kit handle button. */
  dragHandle?: ReactNode;
  /** Calm row (Q6): replaces the full TaskMetaPills set with the caller's smart pills. */
  meta?: ReactNode;
  /** Calm row: the time estimate on the right. Null or 0 keeps the column empty. */
  estimate?: number | null;
  /** Bulk select (T2b-2). Omit to hide the select box. */
  selection?: TaskRowSelection;
  /** Phone row gestures G1-G3 (T2b-2). Omit or disable on desktop. */
  swipe?: TaskSwipeConfig;
  /** The detail pane shows this task. */
  isOpen?: boolean;
  className?: string;
};

export function TaskActionsMenu({ title, actions, label, className }: { title: string; actions: ReadonlyArray<TaskRowAction>; /** Accessible name of the trigger; defaults to "More actions for {title}". */ label?: string; className?: string }) {
  if (!actions.length) return null;
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>
        <button type="button" className={cn("tk-icon-btn pc-focusable", className)} aria-label={label ?? `More actions for ${title}`}>
          <MoreHorizontal size={18} strokeWidth={2} aria-hidden="true" />
        </button>
      </DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content className="tk-menu" align="end" sideOffset={6} collisionPadding={12}>
          {actions.map(action => {
            const Icon = action.icon;
            return (
              <DropdownMenuPrimitive.Item
                key={action.id}
                className={cn("tk-menu-item", action.danger && "is-danger")}
                disabled={action.disabled}
                onSelect={() => action.onSelect()}
              >
                {Icon ? <Icon size={15} strokeWidth={2} aria-hidden="true" /> : null}
                <span className="tk-menu-text">
                  <span>{action.label}</span>
                  {action.disabled && action.reason ? <small>{action.reason}</small> : null}
                </span>
              </DropdownMenuPrimitive.Item>
            );
          })}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

/** Bulk select (Q10): the gutter select box, plus select mode (any task selected: a tap toggles). */
export type TaskRowSelection = {
  selected: boolean;
  /** At least one task is selected: tapping the row toggles it instead of opening details. */
  selectMode: boolean;
  onSelect: (model: TaskCardModel, options: { range: boolean }) => void;
};

/** The gutter select box shared by rows, Inbox cards and Board cards. */
export function TaskSelectBox({ title, selected, onSelect, className }: { title: string; selected: boolean; onSelect: (options: { range: boolean }) => void; className?: string }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Select ${title}`}
      title="Select (Shift-click for a range, X on a focused task)"
      className={cn("tk-sel pc-focusable", selected && "is-on", className)}
      data-no-gesture=""
      onClick={event => { event.stopPropagation(); onSelect({ range: event.shiftKey }); }}
    >
      <Check size={12} strokeWidth={3.2} aria-hidden="true" />
    </button>
  );
}

export function TaskRow({ model, index = 0, enter = false, onOpen, onToggle, onBlockedCheck, onStartFocus, actions = [], dragHandle, meta, estimate, selection, swipe, isOpen = false, className }: TaskRowProps) {
  const calm = meta !== undefined;
  const open = !model.isComplete && model.state !== "archived";
  const guarded = model.completionBlock?.reason ?? null;
  const inert = model.check.action.kind === "none" && !guarded;
  const selected = Boolean(selection?.selected);
  return (
    <TaskSwipeFrame
      as="li"
      hostClassName={cn("tk-row-host", selected && "is-selected", selection?.selectMode && "is-select-mode")}
      faceClassName={cn("tk-row", calm && "is-calm", toneClassName(model.tone), model.isComplete && "is-complete", model.pending && "is-pending", selected && "is-sel", isOpen && "is-open", enter && "pc-rise", className)}
      faceProps={{
        style: enter ? ({ ["--pc-i" as string]: index } as CSSProperties) : undefined,
        "data-task-record-id": model.id,
        "data-task-version": model.version,
        "aria-busy": model.pending || undefined,
      }}
      swipe={swipe}
    >
      {selection ? <TaskSelectBox title={model.title} selected={selected} onSelect={options => selection.onSelect(model, options)} /> : null}
      <CheckButton
        title={model.title}
        checked={model.check.checked}
        tone={model.tone}
        blockedReason={guarded}
        inert={inert}
        onToggle={() => onToggle(model)}
        onBlockedPress={() => onBlockedCheck?.(model)}
      />
      <button
        type="button"
        className="tk-row-title pc-focusable"
        title={model.title}
        onClick={event => {
          if (selection && (selection.selectMode || event.shiftKey)) {
            selection.onSelect(model, { range: event.shiftKey });
            return;
          }
          onOpen(model, event.currentTarget);
        }}
      >
        {model.title}
      </button>
      {calm ? <div className="tk-row-pills tk-row-meta">{meta}</div> : <TaskMetaPills model={model} className="tk-row-pills" />}
      {calm ? (
        <span className="tk-row-est">
          {estimate ? <><span aria-hidden="true">{formatMinutes(estimate)}</span><span className="pc-sr-only">{`Estimate ${formatMinutes(estimate)}`}</span></> : null}
        </span>
      ) : null}
      <div className="tk-row-actions">
        {open && onStartFocus ? (
          <button type="button" className="tk-ghost-btn pc-focusable" onClick={() => onStartFocus(model)} aria-label={`Start focus on ${model.title}`}>
            <Play size={13} strokeWidth={2.5} aria-hidden="true" />
            <span>Focus</span>
          </button>
        ) : null}
        <TaskActionsMenu title={model.title} actions={actions} />
        {dragHandle}
      </div>
    </TaskSwipeFrame>
  );
}
