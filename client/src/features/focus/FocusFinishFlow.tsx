// Finish, step 1 "How did it go?" and the switch to step 2 "Saved. What next?" (D2.5 Surface E).
// One component serves the Focus stage (desktop, inline) and the shared sheet (pill, Dashboard,
// phone). It only calls the existing finish and setFollowUp mutations through the session context.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, Check, CircleDot, Hourglass, Minus, Plus, Save } from "lucide-react";
import { ChoiceTiles } from "@/components/premium/ChoiceTiles";
import { cn } from "@/lib/utils";
import { FocusDial, FocusDigits } from "./FocusDial";
import { FocusNextStep } from "./FocusNextStep";
import { useFocusSession, type FocusHandoff, type FocusOutcome } from "./FocusSessionContext";
import { useFocusElapsedSeconds } from "./FocusTimeDial";
import { FOCUS_MAX_TARGET, FOCUS_MIN_TARGET, formatFocusClock, formatFocusMinutes } from "./focusDisplay";

type ChoiceOutcome = Exclude<FocusOutcome, "stopped">;

/** Suggested new estimate: the old one plus 15 minutes (or recorded time plus 15), in 5-minute steps. */
export function suggestedEstimate(estimateMinutes: number | null | undefined, elapsedSeconds: number): number {
  const base = estimateMinutes && estimateMinutes > 0 ? estimateMinutes : Math.ceil(elapsedSeconds / 60);
  return Math.min(FOCUS_MAX_TARGET * 4, Math.max(FOCUS_MIN_TARGET, Math.ceil((base + 15) / 5) * 5));
}

export function FocusFinishFlow({
  surface,
  onBack,
  onClose,
  handoff: handoffOverride,
}: {
  surface: "sheet" | "stage";
  /** Back to focus (step 1). */
  onBack: () => void;
  /** Leave the flow after step 2. */
  onClose: () => void;
  /** Step 2 target when the caller already knows it (the Focus screen's recent handoff). */
  handoff?: FocusHandoff | null;
}) {
  const focus = useFocusSession();
  if (!focus) return null;
  const step2 = handoffOverride ?? (focus.session ? null : focus.lastSaved);
  if (focus.session) return <FinishStepOne surface={surface} onBack={onBack} />;
  if (!step2) return null;
  const tasks: any[] = focus.snapshot?.tasks ?? [];
  const linked = step2.taskId ? tasks.find(task => task.id === step2.taskId) : null;
  const tracked = step2.taskId
    ? Math.round(focus.sessions.filter(item => item.taskId === step2.taskId && (item.state === "completed" || item.state === "abandoned")).reduce((sum, item) => sum + Math.max(0, Number(item.activeSeconds) || 0), 0) / 60)
    : null;
  const leave = () => { focus.dismissHandoff(step2.id); onClose(); };
  return (
    <div key={`step2-${step2.id}`} className="pc-focus-flow pc-blur-in" data-surface={surface}>
      <FocusNextStep
        handoff={step2}
        tasks={tasks}
        today={focus.today}
        estimateMinutes={linked?.estimateMinutes ?? null}
        trackedMinutes={tracked}
        durableAvailable={focus.durableFollowUp}
        isOnline={focus.online}
        isSaving={focus.followUpPending}
        error={focus.followUpError}
        celebrate={focus.celebrateId === step2.id && step2.outcome === "done"}
        onClearError={focus.clearFollowUpError}
        onSave={focus.saveFollowUp}
        onOpenTask={focus.onOpenTask}
        onOpenPlan={focus.onOpenPlan}
        onDone={leave}
        onStartAnother={() => { focus.dismissHandoff(step2.id); onClose(); focus.onStartAnother(); }}
      />
    </div>
  );
}

function FinishStepOne({ surface, onBack }: { surface: "sheet" | "stage"; onBack: () => void }) {
  const focus = useFocusSession()!;
  const session = focus.session!;
  const task = focus.task;
  const elapsed = useFocusElapsedSeconds(session);
  const headingId = useId();
  const noteId = useId();
  const estimateId = useId();
  const linked = Boolean(task);
  const available = Boolean(task?.available);
  const [outcome, setOutcome] = useState<ChoiceOutcome>("continue");
  const [note, setNote] = useState("");
  const [estimate, setEstimate] = useState(() => suggestedEstimate(task?.estimateMinutes, elapsed));
  const heading = useRef<HTMLHeadingElement | null>(null);
  useEffect(() => {
    if (surface === "stage") heading.current?.focus({ preventScroll: true });
  }, [surface]);
  useEffect(() => {
    if (!available && outcome !== "continue") setOutcome("continue");
  }, [available, outcome]);

  const saving = focus.finishing;
  const estimateValid = Number.isInteger(estimate) && estimate >= FOCUS_MIN_TARGET;
  const canSave = focus.online && !saving && (outcome !== "adjust_estimate" || estimateValid);
  const save = (chosen: FocusOutcome) => focus.finish({ outcome: chosen, note, adjustedEstimateMinutes: chosen === "adjust_estimate" ? estimate : null });
  const errorFor = (value: ChoiceOutcome) => (focus.finishError && outcome === value && value !== "continue" ? (
    <span className="pc-focus-tile-error">
      {focus.finishError}
      {task ? <button type="button" className="pc-focus-link pc-focusable" onClick={event => { event.stopPropagation(); focus.onOpenTask(task.id); }}>Open task</button> : null}
    </span>
  ) : null);
  const unavailableReason = linked ? "This task is no longer open." : "Link a task to use this.";
  const stepEstimate = (delta: number) => setEstimate(value => Math.max(FOCUS_MIN_TARGET, Math.min(FOCUS_MAX_TARGET * 4, (Number.isFinite(value) ? value : FOCUS_MIN_TARGET) + delta)));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (surface === "stage" && event.key === "Escape") { event.stopPropagation(); onBack(); }
  };

  return (
    <div className="pc-focus-flow pc-focus-finish" data-surface={surface} role="group" aria-labelledby={headingId} onKeyDown={onKeyDown}>
      <div className="pc-focus-recap">
        {surface === "sheet" ? <FocusDial size="sm" state={session.state === "paused" ? "paused" : "running"} elapsedSeconds={elapsed} targetMinutes={session.targetMinutes} offline={!focus.online} sessionKey={session.id} className="pc-focus-recap-dial" /> : null}
        <div className="pc-focus-recap-text">
          <p className="pc-focus-recap-time">
            <FocusDigits text={formatFocusClock(elapsed)} prefix={focus.online ? undefined : "≈"} />
            <span className="pc-sr-only">{Math.floor(elapsed / 60)} minutes</span>
            <span className="pc-focus-recap-on"> on {focus.title}</span>
          </p>
          <p className="pc-focus-hint pc-num">
            target {formatFocusMinutes(session.targetMinutes)}
            {task?.estimateMinutes ? ` · est ${formatFocusMinutes(task.estimateMinutes)}` : ""}
            {session.state === "paused" ? " · paused" : " · still running"}
          </p>
        </div>
      </div>

      <h2 id={headingId} ref={heading} tabIndex={-1} data-focus-finish-heading="" className="pc-focus-panel-title">How did it go?</h2>
      {linked ? (
        <ChoiceTiles<ChoiceOutcome>
          labelledBy={headingId}
          value={outcome}
          onChange={value => { setOutcome(value); focus.clearFinishError(); }}
          options={[
            { value: "done", title: "Done. Complete the task", icon: Check, disabled: !available, disabledReason: unavailableReason, error: errorFor("done") },
            { value: "continue", title: "Keep the task open", description: "Save the time and come back to it", icon: CircleDot },
            {
              value: "adjust_estimate",
              title: "Needs more time",
              description: "Save the time and raise the estimate",
              icon: Hourglass,
              disabled: !available,
              disabledReason: unavailableReason,
              error: errorFor("adjust_estimate"),
              reveal: (
                <div className="pc-focus-stepper">
                  <label htmlFor={estimateId}>New estimate</label>
                  <div className="pc-focus-stepper-row">
                    <button type="button" className="pc-focus-step pc-focusable" aria-label="5 minutes less" onClick={() => stepEstimate(-5)} disabled={estimate <= FOCUS_MIN_TARGET}>
                      <Minus size={15} aria-hidden="true" />
                    </button>
                    <input
                      id={estimateId}
                      type="number"
                      inputMode="numeric"
                      min={FOCUS_MIN_TARGET}
                      step={5}
                      value={Number.isFinite(estimate) ? estimate : ""}
                      aria-invalid={!estimateValid}
                      onChange={event => { setEstimate(Number.parseInt(event.target.value, 10)); focus.clearFinishError(); }}
                    />
                    <span aria-hidden="true">min</span>
                    <button type="button" className="pc-focus-step pc-focusable" aria-label="5 minutes more" onClick={() => stepEstimate(5)}>
                      <Plus size={15} aria-hidden="true" />
                    </button>
                  </div>
                  {!estimateValid ? <p className="pc-focus-hint" role="alert">Enter at least {FOCUS_MIN_TARGET} minutes.</p> : null}
                </div>
              ),
            },
          ]}
        />
      ) : (
        <ChoiceTiles<ChoiceOutcome>
          labelledBy={headingId}
          value="continue"
          onChange={() => focus.clearFinishError()}
          options={[{ value: "continue", title: "Save the time", description: "Unlinked focus is recorded as time only", icon: Save }]}
        />
      )}

      <div className="pc-focus-field">
        <label htmlFor={noteId}>Note <span className="pc-focus-optional">(optional)</span></label>
        <textarea id={noteId} rows={2} maxLength={2000} placeholder="What changed?" value={note} onChange={event => setNote(event.target.value)} />
      </div>

      {!focus.online ? <p className="pc-focus-hint" role="status">Reconnect to save. Your choice stays here.</p> : null}
      {focus.finishError && (outcome === "continue" || !linked) ? (
        <div className="pc-focus-alert" role="alert">
          <p>{focus.finishError}</p>
          {task ? <button type="button" className="pc-focus-link pc-focusable" onClick={() => focus.onOpenTask(task.id)}>Open task</button> : null}
        </div>
      ) : null}

      <div className="pc-focus-panel-actions">
        <button type="button" className={cn("pc-focus-btn is-primary pc-focusable", saving && "is-busy")} disabled={!canSave} onClick={() => save(linked ? outcome : "continue")}>
          <Save size={16} aria-hidden="true" /> {saving ? "Saving…" : "Save session"}
        </button>
        <button type="button" className="pc-focus-btn is-text pc-focusable" disabled={!focus.online || saving} onClick={() => save("stopped")}>
          End without outcome
        </button>
      </div>
      <button type="button" className="pc-focus-btn is-text is-back pc-focusable" onClick={onBack}>
        <ArrowLeft size={15} aria-hidden="true" /> Back to focus
      </button>
    </div>
  );
}
