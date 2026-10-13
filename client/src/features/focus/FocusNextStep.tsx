// Finish step 2, "Saved. What next?" (D2.5). Replaces the old "Finish → Next step" card. Uses the
// existing setFollowUp handoff only; without the follow-up migration it falls back to links.
import { useEffect, useId, useReducer, useRef, useState } from "react";
import { CalendarDays, Coffee, Play, RotateCcw } from "lucide-react";
import { ChoiceTiles } from "@/components/premium/ChoiceTiles";
import { TimeChip } from "@/components/premium/Pills";
import { easeOutQuart, prefersReducedMotion } from "@/design/motion";
import { cn } from "@/lib/utils";
import { groupFocusTasks } from "./focusDisplay";

export type NextStepAction = "task" | "plan" | "none";
export type Handoff = {
  id?: string;
  version?: number;
  taskId?: string | null;
  taskTitle: string;
  outcome: string | null;
  note: string | null;
  nextStepAction?: NextStepAction | null;
  nextStepTaskId?: string | null;
  activeSeconds?: number;
  targetMinutes?: number | null;
};
type FollowUpDraft = { sessionId: string | null; baseVersion: number | null; action: NextStepAction; taskId: string; edited: boolean };

export function focusFollowUpDraft(handoff?: Handoff | null): FollowUpDraft {
  return { sessionId: handoff?.id ?? null, baseVersion: handoff?.version ?? null, action: handoff?.nextStepAction ?? "none", taskId: handoff?.nextStepTaskId ?? "", edited: false };
}

export function focusFollowUpDraftReducer(
  draft: FollowUpDraft,
  update: { type: "session"; handoff?: Handoff | null } | { type: "adopt"; handoff?: Handoff | null } | { type: "action"; action: NextStepAction } | { type: "task"; taskId: string },
): FollowUpDraft {
  if (update.type === "session" || update.type === "adopt") {
    if (update.type === "adopt" || draft.sessionId !== (update.handoff?.id ?? null) || !draft.edited) return focusFollowUpDraft(update.handoff);
    const saved = focusFollowUpDraft(update.handoff);
    return draft.action === saved.action && draft.taskId === saved.taskId ? saved : draft;
  }
  if (update.type === "action") return { ...draft, action: update.action, edited: true };
  return { ...draft, taskId: update.taskId, edited: true };
}

/** "14m 32s" for the saved summary. */
export function savedDurationLabel(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  return `${minutes >= 60 ? `${Math.floor(minutes / 60)}h ` : ""}${minutes % 60}m ${whole % 60}s`;
}

function useCountUpSeconds(target: number) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame !== "function") { setValue(target); return; }
    let frame = 0;
    const started = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / 600);
      setValue(target * easeOutQuart(progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

export function FocusNextStep({
  handoff,
  tasks,
  today,
  estimateMinutes,
  trackedMinutes,
  durableAvailable,
  isOnline,
  isSaving = false,
  error = null,
  celebrate = false,
  onClearError,
  onSave,
  onOpenTask,
  onOpenPlan,
  onDone,
  onStartAnother,
}: {
  handoff: Handoff;
  tasks: any[];
  today: string;
  /** Linked task estimate, for the planned/actual chip. */
  estimateMinutes?: number | null;
  /** All recorded minutes on the linked task. */
  trackedMinutes?: number | null;
  durableAvailable: boolean;
  isOnline: boolean;
  isSaving?: boolean;
  error?: string | null;
  /** Only a real completion (outcome done, saved on this device) celebrates. */
  celebrate?: boolean;
  onClearError?: () => void;
  onSave?: (sessionId: string, expectedVersion: number, action: NextStepAction, taskId: string | null, onSaved?: () => void) => void;
  onOpenTask: (id: string) => void;
  onOpenPlan: () => void;
  /** Leave step 2 (close the sheet or return to setup). */
  onDone: () => void;
  onStartAnother: () => void;
}) {
  const headingId = useId();
  const nextId = useId();
  const taskSelectId = useId();
  const [draft, updateDraft] = useReducer(focusFollowUpDraftReducer, handoff, focusFollowUpDraft);
  useEffect(() => {
    updateDraft({ type: "session", handoff });
  }, [handoff.id, handoff.version, handoff.nextStepAction, handoff.nextStepTaskId]);
  const heading = useRef<HTMLHeadingElement | null>(null);

  const actionable = tasks.filter((task: any) => task.state !== "completed" && task.state !== "archived" && task.outcome !== "wont_do");
  const grouped = groupFocusTasks(actionable.filter((task: any) => task.id !== handoff.taskId), today);
  const suggestion: string | null = grouped.today[0]?.id ?? grouped.other[0]?.id ?? null;
  // Unsaved and untouched: preselect the next task the conductor would pick.
  const shown: FollowUpDraft = !draft.edited && handoff.nextStepAction == null && suggestion ? { ...draft, action: "task", taskId: suggestion } : draft;

  const draftTaskAvailable = actionable.some((task: any) => task.id === shown.taskId);
  const savedTask = tasks.find((task: any) => task.id === handoff.nextStepTaskId);
  const draftMatchesSaved = handoff.nextStepAction === shown.action && (shown.action !== "task" || handoff.nextStepTaskId === shown.taskId);
  const remoteChangedDuringEdit = draft.edited && handoff.version !== draft.baseVersion && !draftMatchesSaved;
  const canSave = durableAvailable && isOnline && !isSaving && !remoteChangedDuringEdit && !!onSave && !!handoff.id && typeof handoff.version === "number" && draft.sessionId === handoff.id && (shown.action !== "task" || draftTaskAvailable);

  const go = (action: NextStepAction, taskId: string | null) => {
    if (action === "task" && taskId) onOpenTask(taskId);
    else if (action === "plan") onOpenPlan();
    onDone();
  };
  const primary = () => {
    if (draftMatchesSaved) { go(shown.action, shown.taskId || null); return; }
    if (!canSave || !handoff.id || handoff.version === undefined) return;
    const taskId = shown.action === "task" ? shown.taskId : null;
    onSave?.(handoff.id, handoff.version, shown.action, taskId, () => go(shown.action, taskId));
  };
  const primaryLabel = isSaving
    ? "Saving…"
    : draftMatchesSaved
      ? shown.action === "task" ? "Open task" : shown.action === "plan" ? "Open daily plan" : "Done"
      : error ? "Retry save" : "Save and go";

  const seconds = useCountUpSeconds(handoff.activeSeconds ?? 0);
  const minutes = Math.round((handoff.activeSeconds ?? 0) / 60);
  const statusText = handoff.nextStepAction === null || handoff.nextStepAction === undefined
    ? "Next action not saved."
    : `Saved next action: ${handoff.nextStepAction === "task" ? savedTask?.title ?? "Task unavailable" : handoff.nextStepAction === "plan" ? "Daily plan" : "No next action"}.`;

  return (
    <div className={cn("pc-focus-next pc-rise", celebrate && "is-celebrating")} aria-labelledby={headingId} role="group">
      <div className="pc-focus-next-head">
        <span className="pc-focus-next-check" aria-hidden="true">
          <span className="pc-focus-next-burst" />
          <svg viewBox="0 0 24 24" width="26" height="26" focusable="false">
            <circle cx="12" cy="12" r="11" className="pc-focus-next-disc" />
            <path d="M7 12.5l3.2 3.2L17 9" className="pc-focus-next-mark" />
          </svg>
        </span>
        <div>
          <h2 id={headingId} ref={heading} tabIndex={-1} data-focus-finish-heading="" className="pc-focus-panel-title">Saved. What next?</h2>
          <p className="pc-focus-next-summary pc-num">
            <span aria-hidden="true">{savedDurationLabel(seconds)}</span>
            <span className="pc-sr-only">{savedDurationLabel(handoff.activeSeconds ?? 0)}</span>
            {handoff.targetMinutes ? <span> · target {handoff.targetMinutes}m</span> : null}
            <span> · {handoff.taskTitle}</span>
          </p>
        </div>
        {estimateMinutes || trackedMinutes ? <TimeChip plannedMinutes={estimateMinutes ?? null} actualMinutes={trackedMinutes ?? minutes} className="pc-focus-next-chip" /> : null}
      </div>
      {handoff.note ? <p className="pc-focus-next-note">“{handoff.note}”</p> : null}

      {durableAvailable ? (
        <div className="pc-focus-next-editor" aria-busy={isSaving}>
          <h3 id={nextId} className="pc-focus-subtitle">What next?</h3>
          <p className="pc-focus-hint" role="status" aria-live="polite">
            {statusText}
            {!draftMatchesSaved && handoff.nextStepAction ? " Your changes are not saved." : ""}
          </p>
          {remoteChangedDuringEdit ? (
            <div className="pc-focus-alert" role="alert">
              <p>The saved next action changed elsewhere while you were editing. Your draft is retained. Review the latest saved action before changing it again.</p>
              <button type="button" className="pc-focus-btn is-ghost pc-focusable" onClick={() => updateDraft({ type: "adopt", handoff })}>
                <RotateCcw size={15} aria-hidden="true" /> Use latest saved action
              </button>
            </div>
          ) : null}
          <ChoiceTiles<NextStepAction>
            labelledBy={nextId}
            value={shown.action}
            onChange={action => {
              if (shown !== draft && action !== "task") updateDraft({ type: "task", taskId: shown.taskId });
              updateDraft({ type: "action", action });
              onClearError?.();
            }}
            options={[
              {
                value: "task",
                title: "Next task",
                icon: Play,
                description: shown.action === "task" ? undefined : grouped.today[0]?.title ?? grouped.other[0]?.title,
                reveal: (
                  <div className="pc-focus-field">
                    <label htmlFor={taskSelectId}>Task</label>
                    <select
                      id={taskSelectId}
                      value={shown.taskId}
                      disabled={!isOnline || isSaving}
                      onChange={event => {
                        updateDraft({ type: "task", taskId: event.target.value });
                        if (draft.action !== "task") updateDraft({ type: "action", action: "task" });
                        onClearError?.();
                      }}
                    >
                      <option value="">Choose a task</option>
                      {shown.taskId && !draftTaskAvailable ? <option value={shown.taskId}>Selected task unavailable</option> : null}
                      {grouped.today.length ? (
                        <optgroup label="Today's commitments">
                          {grouped.today.map((task: any) => <option key={task.id} value={task.id}>{task.title}</option>)}
                        </optgroup>
                      ) : null}
                      <optgroup label="Other open tasks">
                        {grouped.other.map((task: any) => <option key={task.id} value={task.id}>{task.title}</option>)}
                      </optgroup>
                    </select>
                    {!draftTaskAvailable ? <p className="pc-focus-hint">Choose an available task before saving.</p> : null}
                  </div>
                ),
              },
              { value: "plan", title: "Daily plan", description: "Open today's plan", icon: CalendarDays },
              { value: "none", title: "Nothing for now", description: "Take a break", icon: Coffee },
            ]}
          />
          {!isOnline ? <p className="pc-focus-hint" role="status">Reconnect to save. Your choice stays here.</p> : null}
          {error ? (
            <div className="pc-focus-alert" role="alert">
              <p>{error}</p>
              <p>Your draft is retained. Review the saved action above before retrying.</p>
              {onClearError ? <button type="button" className="pc-focus-btn is-ghost pc-focusable" onClick={onClearError}>Dismiss message</button> : null}
            </div>
          ) : null}
          {handoff.nextStepAction === "task" && !savedTask ? <p className="pc-focus-hint">The saved task is unavailable; choose another next action.</p> : null}
          <div className="pc-focus-panel-actions">
            <button type="button" className="pc-focus-btn is-primary pc-focusable" disabled={draftMatchesSaved ? false : !canSave} onClick={primary}>
              {primaryLabel}
            </button>
            <button type="button" className="pc-focus-btn is-text pc-focusable" onClick={onStartAnother}>
              <Play size={15} aria-hidden="true" /> Start another focus
            </button>
          </div>
        </div>
      ) : (
        <div className="pc-focus-next-editor">
          <p className="pc-focus-hint">Saved next actions are unavailable. You can still open your work.</p>
          <div className="pc-focus-panel-actions">
            {handoff.taskId && tasks.some((task: any) => task.id === handoff.taskId) ? (
              <button type="button" className="pc-focus-btn is-ghost pc-focusable" onClick={() => go("task", handoff.taskId!)}>Open task</button>
            ) : null}
            <button type="button" className="pc-focus-btn is-ghost pc-focusable" onClick={() => go("plan", null)}>
              <CalendarDays size={15} aria-hidden="true" /> Plan next step
            </button>
            <button type="button" className="pc-focus-btn is-text pc-focusable" onClick={onStartAnother}>
              <Play size={15} aria-hidden="true" /> Start another focus
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
