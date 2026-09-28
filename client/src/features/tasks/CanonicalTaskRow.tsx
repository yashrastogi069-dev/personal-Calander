import { cn } from "@/lib/utils";
import {
  canonicalTaskPresentation,
  type CanonicalTask,
  type CanonicalTaskContext,
} from "@shared/canonicalTask";
import { resolveMobileTaskGesture } from "@shared/mobileTaskGesture";
import { ArrowRight, Check, MoreHorizontal } from "lucide-react";
import { useRef, useState, type PointerEvent } from "react";

export type CanonicalTaskRowProps = {
  task: CanonicalTask;
  context: CanonicalTaskContext;
  parentTitle?: string | null;
  childCount?: number;
  pending?: boolean;
  contextualActionLabel?: string;
  detailActionLabel?: string;
  completionGuard?: { label: string; onOpen: () => void };
  onToggle: (task: CanonicalTask) => void | Promise<unknown>;
  onArchive?: (task: CanonicalTask) => void | Promise<unknown>;
  onPrimaryAction?: (task: CanonicalTask, actionId: string, trigger: HTMLElement) => void | Promise<unknown>;
  onOpenDetail: (task: CanonicalTask, trigger: HTMLElement) => void;
};

export function fallbackTaskPrimaryAction(actionId: string): "toggle" | "detail" {
  return actionId === "complete" ? "toggle" : "detail";
}

export function CanonicalTaskRow({
  task,
  context,
  parentTitle,
  childCount = 0,
  pending = false,
  contextualActionLabel,
  detailActionLabel,
  completionGuard,
  onToggle,
  onArchive,
  onPrimaryAction,
  onOpenDetail,
}: CanonicalTaskRowProps) {
  const presentation = canonicalTaskPresentation(task, context);
  const [archiveRevealed, setArchiveRevealed] = useState(false);
  const pointerStart = useRef<{ x: number; y: number; pointerType: string } | null>(null);

  const startPointer = (event: PointerEvent<HTMLElement>) => {
    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      pointerType: event.pointerType,
    };
  };
  const endPointer = (event: PointerEvent<HTMLElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start) return;
    const gesture = resolveMobileTaskGesture({
      pointerType: start.pointerType,
      startX: start.x,
      startY: start.y,
      endX: event.clientX,
      endY: event.clientY,
      completed: presentation.completion.isComplete,
    });
    if (gesture === "complete" && !completionGuard) void onToggle(task);
    if (gesture === "reveal_archive" && onArchive) setArchiveRevealed(true);
  };
  const runPrimary = (trigger: HTMLElement) => {
    if (onPrimaryAction) {
      void onPrimaryAction(task, presentation.primaryAction.id, trigger);
      return;
    }
    if (fallbackTaskPrimaryAction(presentation.primaryAction.id) === "toggle") void onToggle(task);
    else onOpenDetail(task, trigger);
  };

  return (
    <article
      className={cn(
        "canonical-task-row",
        presentation.completion.isComplete && "is-complete",
        completionGuard && "is-resolution-guarded",
        archiveRevealed && "has-archive-reveal",
      )}
      data-task-record-id={presentation.identity.recordId}
      data-task-version={presentation.identity.version}
      onPointerDown={startPointer}
      onPointerUp={endPointer}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
    >
      {archiveRevealed ? (
        <div className="canonical-task-row-reveal" role="status">
          <span>Archive this task?</span>
          <button type="button" onClick={() => void onArchive?.(task)}>Archive</button>
          <button type="button" onClick={() => setArchiveRevealed(false)}>Cancel</button>
        </div>
      ) : null}
      {completionGuard ? <span className="canonical-task-resolution" aria-hidden="true"><ArrowRight size={17} /></span> : <button
        type="button"
        className={cn("canonical-task-check", presentation.completion.isComplete && "is-checked")}
        aria-label={`${presentation.completion.isComplete ? "Reopen" : "Complete"} ${presentation.title}`}
        onClick={() => void onToggle(task)}
      >
        <Check aria-hidden="true" size={15} strokeWidth={3} />
      </button>}
      <div className="canonical-task-copy">
        <strong>{presentation.title}</strong>
        <div className="canonical-task-keyline">
          {presentation.keyTime ? <span>{presentation.keyTime.label}</span> : <span>Inbox · no date yet</span>}
          {parentTitle ? <span>Subtask of {parentTitle}</span> : null}
          {childCount ? <span>{childCount} {childCount === 1 ? "subtask" : "subtasks"}</span> : null}
          {presentation.metadata.map(metadata => (
            <span key={`${metadata.kind}-${metadata.label}`}>{metadata.label}</span>
          ))}
          {task.state === "blocked" ? <span>Blocked</span> : null}
          {pending ? <span className="is-pending">Saved on this device</span> : null}
        </div>
      </div>
      <button
        type="button"
        className="canonical-task-context-action"
        aria-label={completionGuard?.label}
        onClick={event => completionGuard ? completionGuard.onOpen() : runPrimary(event.currentTarget)}
      >
        {contextualActionLabel ?? presentation.primaryAction.label}
      </button>
      {!completionGuard ? <button
        type="button"
        className="canonical-task-detail-action"
        aria-label={detailActionLabel ?? `Open details for ${presentation.title}`}
        onClick={event => onOpenDetail(task, event.currentTarget)}
      >
        <MoreHorizontal aria-hidden="true" size={20} />
      </button> : null}
    </article>
  );
}
