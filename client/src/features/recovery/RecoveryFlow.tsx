import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { WorkspaceScope } from "@/lib/workspace";
import { ArrowRight, Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  recoveryDecisionInput,
  recoveryScopeLabel,
  type RecoveryEntry,
  type RecoveryForm,
} from "./recoveryModel";
import "./recovery.css";

const choices: Array<{
  action: RecoveryForm["action"];
  title: string;
  detail: string;
}> = [
  { action: "done", title: "Done", detail: "Confirm this exact commitment." },
  {
    action: "reschedule",
    title: "Reschedule",
    detail: "Choose another planned day.",
  },
  {
    action: "reduce",
    title: "Reduce",
    detail: "Keep a smaller, clear next step.",
  },
  {
    action: "pause",
    title: "Pause",
    detail: "Choose when to review it again.",
  },
  {
    action: "abandon",
    title: "Abandon",
    detail: "Record that this work will not be done.",
  },
];

function readDraft(key: string): {
  selectedKey?: string;
  forms?: Record<string, RecoveryForm>;
  operationIds?: Record<string, string>;
} {
  try {
    return JSON.parse(sessionStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

export function RecoveryDecisionFields({
  entry,
  action,
  form,
  onChange,
}: {
  entry: RecoveryEntry;
  action: RecoveryForm["action"];
  form: Partial<RecoveryForm>;
  onChange: (patch: Partial<RecoveryForm>) => void;
}) {
  if (action === "done")
    return (
      <p className="recovery-choice-guidance">
        This confirms only the commitment shown above
        {entry.occurrenceId ? " and its dated occurrence" : ""}. Other
        references remain separate.
      </p>
    );
  if (action === "reschedule")
    return (
      <div className="recovery-fields">
        <label>
          Plan for
          <input
            type="date"
            required
            value={form.resolvedToLocalDate ?? ""}
            onChange={event =>
              onChange({ resolvedToLocalDate: event.target.value })
            }
          />
        </label>
        {entry.deadline ? (
          <p className="recovery-deadline">
            Deadline {entry.deadline} · unchanged here
          </p>
        ) : (
          <p className="recovery-deadline">
            This changes the planned day, not a deadline.
          </p>
        )}
      </div>
    );
  if (action === "reduce")
    return (
      <div className="recovery-fields">
        <label>
          Revised scope
          <input
            required
            maxLength={280}
            value={form.revisedScope ?? ""}
            onChange={event => onChange({ revisedScope: event.target.value })}
            placeholder="Name a smaller next step"
          />
        </label>
        <label>
          Plan for
          <input
            type="date"
            required
            value={form.resolvedToLocalDate ?? ""}
            onChange={event =>
              onChange({ resolvedToLocalDate: event.target.value })
            }
          />
        </label>
        {entry.deadline ? (
          <p className="recovery-deadline">
            Deadline {entry.deadline} · unchanged here
          </p>
        ) : null}
      </div>
    );
  if (action === "pause")
    return (
      <div className="recovery-fields">
        <label>
          Return / review date
          <input
            type="date"
            required
            value={form.returnLocalDate ?? ""}
            onChange={event =>
              onChange({ returnLocalDate: event.target.value })
            }
          />
        </label>
        <label>
          Note (optional)
          <textarea
            rows={2}
            maxLength={10000}
            value={form.decisionNote ?? ""}
            onChange={event => onChange({ decisionNote: event.target.value })}
            placeholder="What should you remember then?"
          />
        </label>
      </div>
    );
  return (
    <div className="recovery-fields">
      <p className="recovery-choice-guidance">
        This records deliberate noncompletion for this commitment. Its history
        stays visible.
      </p>
      <label className="recovery-confirm">
        <input
          type="checkbox"
          checked={Boolean(
            (form as Partial<RecoveryForm> & { confirmed?: boolean }).confirmed
          )}
          onChange={event =>
            onChange({
              confirmed: event.target.checked,
            } as Partial<RecoveryForm>)
          }
        />
        I want to record this as not done.
      </label>
    </div>
  );
}

export function RecoveryFlow({
  open,
  onOpenChange,
  entries,
  scope,
  online,
  onResolved,
  onReviewTask,
  returnFocusRef,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: RecoveryEntry[];
  scope: WorkspaceScope;
  online: boolean;
  onResolved?: () => void;
  onReviewTask?: () => void;
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}) {
  const storageKey = `recovery-draft:${scope.workspaceId}`;
  const [draft] = useState(() => readDraft(storageKey));
  const [selectedKey, setSelectedKey] = useState(
    () => draft.selectedKey ?? entries[0]?.key ?? ""
  );
  const [forms, setForms] = useState<Record<string, RecoveryForm>>(
    () => draft.forms ?? {}
  );
  const [operationIds, setOperationIds] = useState<Record<string, string>>(
    () => draft.operationIds ?? {}
  );
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();
  const mutation = trpc.planner.recovery.resolve.useMutation();
  const entry = entries.find(row => row.key === selectedKey) ?? entries[0];
  const currentIndex = entry
    ? entries.findIndex(row => row.key === entry.key)
    : 0;
  const form = entry
    ? (forms[entry.key] ?? { action: "done" })
    : { action: "done" as const };
  const nextStep = useMemo(
    () =>
      ({
        done: "Mark this commitment done",
        reschedule: "Carry it to the chosen day",
        reduce: "Carry the smaller scope",
        pause: "Review on the return date",
        abandon: "Keep a record of noncompletion",
      })[form.action],
    [form.action]
  );

  useEffect(() => {
    if (!entries.some(row => row.key === selectedKey))
      setSelectedKey(entries[0]?.key ?? "");
  }, [entries, selectedKey]);
  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ selectedKey, forms, operationIds })
      );
    } catch {
      /* Private browsing may refuse storage; in-memory draft still works. */
    }
  }, [storageKey, selectedKey, forms, operationIds]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => headingRef.current?.focus());
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      returnFocusRef?.current?.focus();
    };
  }, [open, returnFocusRef]);
  if (!open || typeof document === "undefined") return null;

  const changeForm = (patch: Partial<RecoveryForm>) => {
    if (!entry) return;
    setForms(current => ({ ...current, [entry.key]: { ...form, ...patch } }));
    setOperationIds(current => {
      const next = { ...current };
      delete next[entry.key];
      return next;
    });
    setError(null);
  };
  const selectEntry = (key: string) => {
    setSelectedKey(key);
    setError(null);
    headingRef.current?.focus();
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!entry || mutation.isPending) return;
    if (!online) {
      setError(
        "Reconnect to record this decision. Your entered choices are kept on this device."
      );
      return;
    }
    if (!entry.canResolve) {
      setError("This reference needs reconciliation. No outcome was changed.");
      return;
    }
    if (
      form.action === "abandon" &&
      !(form as RecoveryForm & { confirmed?: boolean }).confirmed
    ) {
      setError("Confirm deliberate noncompletion before recording it.");
      return;
    }
    const operationId = operationIds[entry.key] ?? crypto.randomUUID();
    setOperationIds(current => ({ ...current, [entry.key]: operationId }));
    try {
      const decision = recoveryDecisionInput(entry, form, operationId);
      await mutation.mutateAsync({ ...scope, online: true, decision });
      await Promise.all([
        utils.planner.workspace.snapshot.invalidate(),
        utils.planner.dashboard.invalidate(),
      ]);
      setError(null);
      toast.success("Decision recorded.");
      onResolved?.();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Decision was not confirmed. Your choices are kept; retry after checking your connection."
      );
    }
  };
  const onDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && !mutation.isPending) {
      onOpenChange(false);
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusables = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
      )
    );
    if (!focusables.length) return;
    const first = focusables[0],
      last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="recovery-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget && !mutation.isPending)
          onOpenChange(false);
      }}
    >
      <div
        ref={dialogRef}
        className="recovery-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
        onKeyDown={onDialogKeyDown}
      >
        <header className="recovery-sheet-header">
          <div>
            <span className="recovery-eyebrow">Recovery / decision desk</span>
            <h2 id="recovery-title" ref={headingRef} tabIndex={-1}>
              Choose what happens next.
            </h2>
            <p>
              One commitment at a time. You can close this and return without
              losing your choices.
            </p>
          </div>
          <button
            className="recovery-close"
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            aria-label="Close recovery"
          >
            <X size={20} />
          </button>
        </header>
        {!entry ? (
          <div className="recovery-empty">
            <Check size={24} />
            <h3>All decisions are up to date.</h3>
            <p>New commitments will appear here when they need your review.</p>
            <Button type="button" onClick={() => onOpenChange(false)}>
              Return to Plan
            </Button>
          </div>
        ) : (
          <>
            <div className="recovery-sheet-body">
              <aside
                className="recovery-source-list"
                aria-label="Open commitments"
              >
                <span className="recovery-eyebrow">
                  Open / {String(entries.length).padStart(2, "0")}
                </span>
                {entries.map((row, index) => (
                  <button
                    type="button"
                    key={row.key}
                    className={row.key === entry.key ? "is-selected" : ""}
                    onClick={() => selectEntry(row.key)}
                    aria-current={row.key === entry.key ? "step" : undefined}
                  >
                    <span>
                      {String(index + 1).padStart(2, "0")}{" "}
                      <small>
                        {row.sourceCarryId ? "Carried" : "Original"} ·{" "}
                        {row.sourceLocalDate}
                      </small>
                    </span>
                    <strong>{row.originalScope}</strong>
                  </button>
                ))}
              </aside>
              <form className="recovery-decision" onSubmit={submit}>
                <div className="recovery-source">
                  <span className="recovery-eyebrow">
                    Reference {currentIndex + 1} of {entries.length}
                  </span>
                  <h3>{entry.originalScope}</h3>
                  <p>
                    {entry.sourceCarryId
                      ? entry.returnLocalDate ? "Paused carry" : "Carried commitment"
                      : entry.occurrenceId
                        ? "Dated occurrence"
                        : entry.returnLocalDate ? "Paused commitment returns" : "Daily commitment"}{" "}
                    · source {entry.sourceLocalDate}
                    {entry.returnLocalDate ? ` · return ${entry.returnLocalDate}` : ""}
                  </p>
                  <small>
                    Task {entry.taskId} ·{" "}
                    {entry.sourceCarryId
                      ? `carry ${entry.sourceCarryId}`
                      : `item ${entry.dailyPlanItemId}`}
                    {entry.occurrenceId
                      ? ` · occurrence ${entry.occurrenceId}`
                      : ""}
                  </small>
                </div>
                <div className="recovery-trail" aria-label="Commitment trail">
                  <div>
                    <span>{recoveryScopeLabel(entry)}</span>
                    <strong>{entry.originalScope}</strong>
                  </div>
                  <ArrowRight size={16} aria-hidden="true" />
                  <div>
                    <span>Current decision</span>
                    <strong>
                      {entry.reason === "returning_pause" ? "Return to review" : choices.find(choice => choice.action === form.action)?.title}
                    </strong>
                  </div>
                  <ArrowRight size={16} aria-hidden="true" />
                  <div>
                    <span>Next step</span>
                    <strong>{entry.reason === "returning_pause" ? "Review task and make a new plan" : nextStep}</strong>
                  </div>
                </div>
                {entry.canResolve ? (
                  <>
                    <fieldset className="recovery-choices">
                      <legend>Choose a decision</legend>
                      {choices.map(choice => (
                        <label
                          key={choice.action}
                          className={
                            form.action === choice.action ? "is-selected" : ""
                          }
                        >
                          <input
                            type="radio"
                            name="recovery-action"
                            value={choice.action}
                            checked={form.action === choice.action}
                            onChange={() =>
                              changeForm({ action: choice.action })
                            }
                          />
                          <span>
                            <strong>{choice.title}</strong>
                            <small>{choice.detail}</small>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <RecoveryDecisionFields
                      entry={entry}
                      action={form.action}
                      form={form}
                      onChange={changeForm}
                    />
                  </>
                ) : (
                  <div className="recovery-reconcile" role="status">
                    <strong>{entry.reason === "returning_pause" ? "Ready to revisit" : "Needs reconciliation"}</strong>
                    <p>
                      {entry.reason === "returning_pause"
                        ? "The return date has arrived. This original commitment remains paused. Review the task and add a new plan if it still belongs in your day; no second outcome is recorded here."
                        : entry.reason === "missing_task"
                        ? "The linked task is missing. This saved commitment stays open; no outcome can be recorded here."
                        : entry.reason === "missing_occurrence"
                          ? "This recurring commitment has no pending occurrence for its source date. Its series and history are unchanged."
                          : "The linked task already has a final outcome. This reference stays open for review; no new task outcome can be recorded."}
                    </p>
                  </div>
                )}
                {error ? (
                  <p className="recovery-error" role="alert">
                    {error}
                  </p>
                ) : null}
                {!online ? (
                  <p className="recovery-offline" role="status">
                    Offline · decisions need a server confirmation. Your choices
                    stay here until you reconnect.
                  </p>
                ) : null}
                <footer className="recovery-actions">
                  <div className="recovery-stepper">
                    <button
                      type="button"
                      disabled={currentIndex === 0}
                      onClick={() => selectEntry(entries[currentIndex - 1].key)}
                      aria-label="Previous commitment"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span>
                      {currentIndex + 1} / {entries.length}
                    </span>
                    <button
                      type="button"
                      disabled={currentIndex >= entries.length - 1}
                      onClick={() => selectEntry(entries[currentIndex + 1].key)}
                      aria-label="Next commitment"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  {entry.reason === "returning_pause" ? <Button type="button" onClick={() => { onOpenChange(false); onReviewTask?.(); }}>Review task</Button> :
                    <Button type="submit" disabled={!entry.canResolve || !online || mutation.isPending}>
                      {mutation.isPending ? "Recording…" : `Record ${form.action === "abandon" ? "noncompletion" : form.action}`}
                    </Button>}
                </footer>
              </form>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
