import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlannerSheet } from "@/features/shell/PlannerSheet";
import { plannerObjectDefinitions } from "@shared/planningLanguage";
import type { NaturalLanguageTaskDraft } from "@shared/naturalLanguageTask";
import { Inbox, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

export type CaptureKind = "task" | "goal" | "project" | "habit";
const captureKinds: CaptureKind[] = ["task", "project", "goal", "habit"];

export function captureInterpretationHandoff(thought: string) {
  return thought;
}

export function capturePersistenceMessage(result: { queued?: boolean } | void) {
  return result?.queued ? "Saved on this device · waiting to sync." : "Saved.";
}

export function nextCaptureKindForKey(current: CaptureKind, key: string): CaptureKind {
  if (key === "Home") return captureKinds[0];
  if (key === "End") return captureKinds[captureKinds.length - 1];
  const direction = key === "ArrowRight" || key === "ArrowDown" ? 1 : key === "ArrowLeft" || key === "ArrowUp" ? -1 : 0;
  if (!direction) return current;
  const currentIndex = captureKinds.indexOf(current);
  return captureKinds[(currentIndex + direction + captureKinds.length) % captureKinds.length];
}

export function captureTaskPatch(title: string, planForToday: boolean, today: string) {
  return {
    title: title.trim(),
    scheduledLocalDate: planForToday ? today : null,
  };
}
export type InterpretationChip = {
  kind: "deadline" | "plan_for" | "reserved_time" | "estimate" | "recurrence" | "ambiguity";
  label: string;
  value: string;
};

export function interpretationChips(
  draft: Pick<NaturalLanguageTaskDraft, "dueLocalDate" | "scheduledLocalDate" | "reserveTime" | "estimateMinutes" | "recurrenceRule" | "notes">,
): InterpretationChip[] {
  const chips: InterpretationChip[] = [];
  if (draft.dueLocalDate) chips.push({ kind: "deadline", label: "Deadline", value: draft.dueLocalDate });
  if (draft.scheduledLocalDate) chips.push({ kind: "plan_for", label: "Plan for", value: draft.scheduledLocalDate });
  if (draft.reserveTime) chips.push({ kind: "reserved_time", label: "Reserved time", value: draft.reserveTime });
  if (draft.estimateMinutes) chips.push({ kind: "estimate", label: "Estimate", value: `${draft.estimateMinutes} min` });
  if (draft.recurrenceRule?.frequency) {
    const frequency = draft.recurrenceRule.frequency;
    chips.push({ kind: "recurrence", label: "Recurrence", value: `${frequency.charAt(0).toUpperCase()}${frequency.slice(1)}` });
  }
  const ambiguity = draft.notes.find(note => /ambiguous|review|could mean|unclear/i.test(note));
  if (ambiguity) chips.push({ kind: "ambiguity", label: "Needs review", value: ambiguity });
  return chips;
}

export type CaptureSheetProps = {
  open: boolean;
  kind: CaptureKind;
  today: string;
  goals: any[];
  isOnline: boolean;
  thought: string;
  onThoughtChange: (thought: string) => void;
  onOpenChange: (open: boolean) => void;
  onKindChange: (kind: CaptureKind) => void;
  onCreate: (kind: CaptureKind, values: Record<string, unknown>) => Promise<{ queued?: boolean } | void>;
  onOpenNaturalCapture: (thought: string) => void;
};

export function CaptureSheet({
  open,
  kind,
  today,
  goals,
  isOnline,
  thought,
  onThoughtChange,
  onOpenChange,
  onKindChange,
  onCreate,
  onOpenNaturalCapture,
}: CaptureSheetProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [dueLocalDate, setDueLocalDate] = useState("");
  const [estimateMinutes, setEstimateMinutes] = useState("");
  const [goalId, setGoalId] = useState("none");
  const [planForToday, setPlanForToday] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement;
  }, [open]);

  const reset = () => {
    onThoughtChange("");
    setDueLocalDate("");
    setEstimateMinutes("");
    setGoalId("none");
    setPlanForToday(false);
    setError(null);
  };
  const close = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const name = thought.trim();
    if (!name) {
      setError(`Name this ${plannerObjectDefinitions[kind].label.toLowerCase()} before creating it.`);
      return;
    }
    if (!isOnline && kind !== "task") {
      setError(`Reconnect to create a ${plannerObjectDefinitions[kind].label.toLowerCase()}. This draft is still here and has not been saved.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const values = kind === "task"
        ? {
            ...captureTaskPatch(name, planForToday, today),
            estimateMinutes: estimateMinutes ? Number(estimateMinutes) : null,
          }
        : {
            title: name,
            dueLocalDate: kind === "habit" ? null : dueLocalDate || null,
            goalId: kind === "project" && goalId !== "none" ? goalId : null,
          };
      const result = await onCreate(kind, values);
      toast.success(capturePersistenceMessage(result));
      reset();
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The capture could not be saved. Your draft is still here.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlannerSheet
      open={open}
      onOpenChange={close}
      returnFocusRef={returnFocusRef}
      title="Capture"
      description={kind === "task" ? "Save the thought to Inbox first. Planning is optional and explicit." : `Start a ${plannerObjectDefinitions[kind].label.toLowerCase()} without losing the draft.`}
      footer={
        <div className="capture-sheet-footer">
          <Button type="button" variant="ghost" onClick={() => close(false)}>Cancel</Button>
          <Button type="submit" form="capture-sheet-form" disabled={saving}>
            {saving ? "Saving…" : kind === "task" ? (planForToday ? "Save and plan today" : "Save to Inbox") : `Create ${plannerObjectDefinitions[kind].label}`}
          </Button>
        </div>
      }
    >
      <form id="capture-sheet-form" className="capture-sheet-form" onSubmit={submit} noValidate>
        <div className="capture-kind-tabs" role="tablist" aria-label="Capture type">
          {captureKinds.map(value => (
            <button key={value} id={`capture-tab-${value}`} type="button" role="tab" aria-selected={kind === value} aria-controls="capture-kind-panel" tabIndex={kind === value ? 0 : -1} onClick={() => { onKindChange(value); setError(null); }} onKeyDown={event => { const next = nextCaptureKindForKey(kind, event.key); if (next === kind) return; event.preventDefault(); onKindChange(next); setError(null); window.setTimeout(() => document.getElementById(`capture-tab-${next}`)?.focus(), 0); }}>
              {plannerObjectDefinitions[value].label}
            </button>
          ))}
        </div>
        <div id="capture-kind-panel" role="tabpanel" aria-labelledby={`capture-tab-${kind}`} className="capture-kind-panel">
        <label>
          <Label htmlFor="capture-sheet-title">Name</Label>
          <Input id="capture-sheet-title" autoFocus value={thought} onChange={event => { onThoughtChange(event.target.value); setError(null); }} placeholder={kind === "task" ? "What needs attention?" : plannerObjectDefinitions[kind].short} />
        </label>

        {kind === "task" ? (
          <>
            <div className="capture-inbox-choice">
              <Inbox aria-hidden="true" size={20} />
              <div><strong>Inbox by default</strong><span>No deadline, plan, reservation, project, or goal is required.</span></div>
            </div>
            <label className="capture-plan-today">
              <input type="checkbox" checked={planForToday} onChange={event => setPlanForToday(event.target.checked)} />
              <span><strong>Plan for today</strong><small>Explicitly sets Plan for to {today}; it does not create a deadline or reservation.</small></span>
            </label>
            <label>
              <Label htmlFor="capture-sheet-estimate">Estimate (optional)</Label>
              <Input id="capture-sheet-estimate" type="number" min="0" max="1440" value={estimateMinutes} onChange={event => setEstimateMinutes(event.target.value)} placeholder="Minutes" />
            </label>
            <button type="button" className="capture-review-link" onClick={() => { onOpenChange(false); onOpenNaturalCapture(captureInterpretationHandoff(thought)); }}>
              <Sparkles aria-hidden="true" size={17} /> Interpret dates, reserved time, recurrence, or use a starting point
            </button>
          </>
        ) : null}

        {kind === "goal" || kind === "project" ? (
          <label>
            <Label htmlFor="capture-sheet-deadline">Deadline (optional)</Label>
            <Input id="capture-sheet-deadline" type="date" value={dueLocalDate} onChange={event => setDueLocalDate(event.target.value)} />
          </label>
        ) : null}
        {kind === "project" ? (
          <label>
            <Label htmlFor="capture-sheet-goal">Goal this project advances</Label>
            <select id="capture-sheet-goal" value={goalId} onChange={event => setGoalId(event.target.value)}>
              <option value="none">No linked goal yet</option>
              {goals.filter(goal => goal.state !== "archived").map(goal => <option key={goal.id} value={goal.id}>{goal.title}</option>)}
            </select>
          </label>
        ) : null}
        {kind === "habit" ? <p className="capture-offline-note">This starts as a daily habit. Cadence and reminders remain editable in Habits.</p> : null}
        {!isOnline && kind !== "task" ? <p className="capture-offline-note" role="status">Reconnect to save this {kind}. Your draft will remain in this sheet.</p> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      </form>
    </PlannerSheet>
  );
}
