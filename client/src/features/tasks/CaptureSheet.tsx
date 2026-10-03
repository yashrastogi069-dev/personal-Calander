import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlannerSheet } from "@/features/shell/PlannerSheet";
import { plannerObjectDefinitions } from "@shared/planningLanguage";
import type { NaturalLanguageTaskDraft } from "@shared/naturalLanguageTask";
import { Inbox, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import type { PlannerSyncScope } from "@/lib/offlineSync";
import { captureDraftStorageKey, clearCaptureDraft, clearCaptureDraftIfUnchanged, newCaptureRequestId, readCaptureDraft, writeCaptureDraft } from "@/features/capture/captureDraftStorage";
import { captureCanUseResult, fingerprintCapturePayload, prepareCaptureSubmission, type CaptureSubmissionIdentity } from "@/features/capture/captureSubmission";
import { parseNaturalLanguageTask } from "@shared/naturalLanguageTask";

export type CaptureKind = "task" | "goal" | "project" | "habit";
const captureKinds: CaptureKind[] = ["task", "project", "goal", "habit"];

export function restoredCaptureKind(savedKind: unknown, currentKind: CaptureKind): CaptureKind {
  return typeof savedKind === "string" && captureKinds.includes(savedKind as CaptureKind) ? savedKind as CaptureKind : currentKind;
}

export function captureSheetSurface(entryIntent: "task" | "neutral") {
  return entryIntent === "task" ? "sheet-task" as const : "sheet" as const;
}

export function captureKindHasUncertainOutcome(kind: CaptureKind, uncertainKinds: readonly CaptureKind[]) {
  return kind !== "task" && uncertainKinds.includes(kind);
}

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
export function captureInterpretationDraft(thought: string, today: string, explicit: { dueLocalDate: string; estimateMinutes: string; planForToday: boolean }): NaturalLanguageTaskDraft {
  const parsed = parseNaturalLanguageTask(thought, today);
  const estimate = Number(explicit.estimateMinutes);
  return {
    ...parsed,
    dueLocalDate: explicit.dueLocalDate || parsed.dueLocalDate,
    scheduledLocalDate: explicit.planForToday ? today : parsed.scheduledLocalDate,
    estimateMinutes: explicit.estimateMinutes && Number.isInteger(estimate) && estimate > 0 ? estimate : parsed.estimateMinutes,
    notes: [...parsed.notes, "Explicit sheet fields were carried over. Review before creating."],
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
  plannerSyncScope?: PlannerSyncScope;
  entryIntent?: "task" | "neutral";
  thought: string;
  onThoughtChange: (thought: string) => void;
  onOpenChange: (open: boolean) => void;
  onKindChange: (kind: CaptureKind) => void;
  onCreate: (kind: CaptureKind, values: Record<string, unknown>, requestId?: string) => Promise<{ queued?: boolean } | void>;
  onOpenNaturalCapture: (thought: string) => void;
};

export function CaptureSheet({
  open,
  kind,
  today,
  goals,
  isOnline,
  plannerSyncScope,
  entryIntent = "neutral",
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
  const [uncertainKinds, setUncertainKinds] = useState<CaptureKind[]>([]);
  const [acknowledgedKind, setAcknowledgedKind] = useState<CaptureKind | null>(null);
  const [retainedKind, setRetainedKind] = useState<CaptureKind | null>(null);
  const [submissionIdentities, setSubmissionIdentities] = useState<Partial<Record<CaptureKind, CaptureSubmissionIdentity>>>({});
  const [hydratedScope, setHydratedScope] = useState<string | null>(null);
  const hydratedScopeRef = useRef<string | null>(null);
  const activeDraftSurface = captureSheetSurface(entryIntent);
  const scopeKey = plannerSyncScope ? captureDraftStorageKey(plannerSyncScope, activeDraftSurface) : null;
  const currentDraftMarker = JSON.stringify({ scopeKey, open, kind, thought, dueLocalDate, estimateMinutes, goalId, planForToday });
  const draftRevisionRef = useRef({ marker: currentDraftMarker, revision: 0 });
  if (draftRevisionRef.current.marker !== currentDraftMarker) draftRevisionRef.current = { marker: currentDraftMarker, revision: draftRevisionRef.current.revision + 1 };
  const currentDraftMarkerRef = useRef("");
  currentDraftMarkerRef.current = JSON.stringify(draftRevisionRef.current);
  const currentScopeKeyRef = useRef(scopeKey);
  currentScopeKeyRef.current = scopeKey;
  const activeSubmissionRef = useRef<number | null>(null);
  const nextSubmissionTokenRef = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  useEffect(() => { activeSubmissionRef.current = null; setSaving(false); setError(null); setAcknowledgedKind(null); }, [scopeKey]);

  useEffect(() => {
    if (!open || !scopeKey || hydratedScopeRef.current === scopeKey) return;
    const accountChanged = hydratedScopeRef.current !== null;
    const saved = readCaptureDraft<{ thought?: string; kind?: CaptureKind; dueLocalDate?: string; estimateMinutes?: string; goalId?: string; planForToday?: boolean; submissionIdentity?: CaptureSubmissionIdentity; submissionIdentities?: Partial<Record<CaptureKind, CaptureSubmissionIdentity>>; uncertainKinds?: CaptureKind[]; nonTaskOutcomeUncertain?: boolean }>(plannerSyncScope, activeDraftSurface);
    const retained = entryIntent === "task" ? readCaptureDraft<{ thought?: string; kind?: CaptureKind }>(plannerSyncScope, "sheet") : null;
    setRetainedKind(retained?.thought && retained.kind && retained.kind !== "task" ? restoredCaptureKind(retained.kind, "task") : null);
    const restoreSaved = Boolean(typeof saved?.thought === "string" && saved.thought && (entryIntent === "task" || accountChanged || !thought || saved.thought === thought));
    if ((accountChanged || entryIntent === "task") && !restoreSaved) onThoughtChange("");
    if (restoreSaved && saved?.thought && (entryIntent === "task" || accountChanged || !thought)) onThoughtChange(saved.thought);
    if (entryIntent === "task") onKindChange("task");
    else if (restoreSaved) onKindChange(restoredCaptureKind(saved?.kind, kind));
    setDueLocalDate(restoreSaved && typeof saved?.dueLocalDate === "string" ? saved.dueLocalDate : "");
    setEstimateMinutes(restoreSaved && typeof saved?.estimateMinutes === "string" ? saved.estimateMinutes : "");
    setGoalId(restoreSaved && typeof saved?.goalId === "string" ? saved.goalId : "none");
    setPlanForToday(restoreSaved ? saved?.planForToday === true : false);
    setUncertainKinds(restoreSaved ? Array.isArray(saved?.uncertainKinds)
      ? saved.uncertainKinds.filter((value): value is CaptureKind => captureKinds.includes(value) && value !== "task")
      : saved?.nonTaskOutcomeUncertain && saved?.kind && saved.kind !== "task" ? [saved.kind] : [] : []);
    const restoredIdentities = restoreSaved && saved?.submissionIdentities && typeof saved.submissionIdentities === "object" ? saved.submissionIdentities :
      restoreSaved && saved?.kind && saved?.submissionIdentity && typeof saved.submissionIdentity.requestId === "string" ? { [saved.kind]: saved.submissionIdentity } : {};
    setSubmissionIdentities(Object.fromEntries(Object.entries(restoredIdentities).filter(([value, identity]) =>
      captureKinds.includes(value as CaptureKind) && identity && typeof identity.requestId === "string" &&
      (identity.lastSubmittedFingerprint === null || typeof identity.lastSubmittedFingerprint === "string"))) as Partial<Record<CaptureKind, CaptureSubmissionIdentity>>);
    hydratedScopeRef.current = scopeKey;
    setHydratedScope(scopeKey);
  }, [open, scopeKey, plannerSyncScope, activeDraftSurface, entryIntent, onThoughtChange, onKindChange, thought, kind]);

  useEffect(() => {
    if (!open || !scopeKey || hydratedScope !== scopeKey) return;
    if (thought || dueLocalDate || estimateMinutes || goalId !== "none" || planForToday) {
      writeCaptureDraft(plannerSyncScope, activeDraftSurface, { thought, kind, dueLocalDate, estimateMinutes, goalId, planForToday, submissionIdentities, uncertainKinds });
    } else clearCaptureDraft(plannerSyncScope, activeDraftSurface);
  }, [open, scopeKey, hydratedScope, plannerSyncScope, activeDraftSurface, thought, kind, dueLocalDate, estimateMinutes, goalId, planForToday, submissionIdentities, uncertainKinds]);

  useEffect(() => {
    if (open && document.activeElement instanceof HTMLElement) returnFocusRef.current = document.activeElement;
  }, [open]);

  const reset = () => {
    onThoughtChange("");
    setDueLocalDate("");
    setEstimateMinutes("");
    setGoalId("none");
    setPlanForToday(false);
    setUncertainKinds([]);
    setAcknowledgedKind(null);
    setSubmissionIdentities({});
    setError(null);
  };
  const close = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };
  const discard = () => {
    clearCaptureDraft(plannerSyncScope, activeDraftSurface);
    reset();
    onOpenChange(false);
  };
  const handoffToInterpretation = () => {
    const existing = readCaptureDraft<{ thought?: string }>(plannerSyncScope, "natural");
    if (typeof existing?.thought === "string" && existing.thought && existing.thought !== thought) {
      toast.info("Your earlier interpreted draft is still there. Finish or discard it first; this sheet draft remains available.");
      onOpenChange(false);
      onOpenNaturalCapture(existing.thought);
      return;
    }
    if (plannerSyncScope && thought.trim()) {
      writeCaptureDraft(plannerSyncScope, "natural", {
        thought,
        draft: captureInterpretationDraft(thought, today, { dueLocalDate, estimateMinutes, planForToday }),
        planForToday,
        templateName: "",
        submissionIdentity: { requestId: newCaptureRequestId(), lastSubmittedFingerprint: null, confirmedChangedFingerprint: null },
      });
    }
    onOpenChange(false);
    onOpenNaturalCapture(captureInterpretationHandoff(thought));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const name = thought.trim();
    if (!name) {
      setError(`Name this ${plannerObjectDefinitions[kind].label.toLowerCase()} before creating it.`);
      return;
    }
    if (!isOnline && kind !== "task") {
      setError(`Reconnect to create a ${plannerObjectDefinitions[kind].label.toLowerCase()}. This draft is still here and has not been saved.`);
      return;
    }
    if (captureKindHasUncertainOutcome(kind, uncertainKinds) && acknowledgedKind !== kind) {
      setError(`The earlier ${kind} save may have completed. Check your existing ${kind}s before retrying, then acknowledge below.`);
      return;
    }
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
    const identity = submissionIdentities[kind] ?? { requestId: newCaptureRequestId(), lastSubmittedFingerprint: null, confirmedChangedFingerprint: null };
    const prepared = prepareCaptureSubmission(identity, fingerprintCapturePayload(kind, values));
    setSubmissionIdentities(current => ({ ...current, [kind]: prepared.identity }));
    if (prepared.needsConfirmation) {
      setError("The earlier save may have completed. These changes would create a separate item. Check your tasks, then choose Create again to confirm.");
      return;
    }
    const submittedMarker = currentDraftMarkerRef.current;
    const submittedScopeKey = scopeKey;
    const submittedToken = ++nextSubmissionTokenRef.current;
    activeSubmissionRef.current = submittedToken;
    setSaving(true);
    setError(null);
    try {
      const result = await onCreate(kind, values, kind === "task" ? prepared.identity.requestId : undefined);
      if (!captureCanUseResult(mountedRef.current, activeSubmissionRef.current, submittedToken, currentScopeKeyRef.current, submittedScopeKey)) return;
      if (clearCaptureDraftIfUnchanged(plannerSyncScope, activeDraftSurface, submittedMarker, currentDraftMarkerRef.current)) {
        reset();
        onOpenChange(false);
        toast.success(capturePersistenceMessage(result));
      } else toast.success("The submitted item was saved. Your newer draft is still here.");
    } catch (caught) {
      if (captureCanUseResult(mountedRef.current, activeSubmissionRef.current, submittedToken, currentScopeKeyRef.current, submittedScopeKey)) {
        if (kind !== "task") { setUncertainKinds(current => current.includes(kind) ? current : [...current, kind]); setAcknowledgedKind(null); }
        if (currentDraftMarkerRef.current === submittedMarker) setError(caught instanceof Error ? caught.message : "The capture could not be saved. Your draft is still here.");
      }
    } finally {
      if (captureCanUseResult(mountedRef.current, activeSubmissionRef.current, submittedToken, currentScopeKeyRef.current, submittedScopeKey)) {
        setSaving(false);
        activeSubmissionRef.current = null;
      }
    }
  };

  if (open && scopeKey && hydratedScope !== scopeKey) return null;

  return (
    <PlannerSheet
      open={open}
      onOpenChange={close}
      returnFocusRef={returnFocusRef}
      title="Capture"
      description={kind === "task" ? "Save to Inbox or plan for today. Close to keep this draft in this browser tab." : `Start a ${plannerObjectDefinitions[kind].label.toLowerCase()} without losing the draft.`}
      footer={
        <div className="capture-sheet-footer">
          <Button type="button" variant="ghost" onClick={discard}>Discard draft</Button>
          <Button type="submit" form="capture-sheet-form" disabled={saving}>
            {saving ? "Saving…" : kind === "task" ? (planForToday ? "Save and plan today" : "Save to Inbox") : `Create ${plannerObjectDefinitions[kind].label}`}
          </Button>
        </div>
      }
    >
      <form id="capture-sheet-form" className="capture-sheet-form" onSubmit={submit} noValidate>
        <div className="capture-kind-tabs" role="tablist" aria-label="Capture type">
          {(entryIntent === "task" ? (["task"] as CaptureKind[]) : captureKinds).map(value => (
            <button key={value} id={`capture-tab-${value}`} type="button" role="tab" aria-selected={kind === value} aria-controls="capture-kind-panel" tabIndex={kind === value ? 0 : -1} onClick={() => { onKindChange(value); setError(null); }} onKeyDown={event => { if (entryIntent === "task") return; const next = nextCaptureKindForKey(kind, event.key); if (next === kind) return; event.preventDefault(); onKindChange(next); setError(null); window.setTimeout(() => document.getElementById(`capture-tab-${next}`)?.focus(), 0); }}>
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
            <button type="button" className="capture-review-link" onClick={handoffToInterpretation}>
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
        {plannerSyncScope ? <p className="capture-offline-note">Drafts in this browser tab are kept for this account and workspace until you discard or save them. Avoid putting passwords in a task.</p> : null}
        {entryIntent === "task" && retainedKind ? <p className="capture-offline-note" role="status">Your earlier {retainedKind} draft remains available in regular Capture. This shortcut starts a separate task.</p> : null}
        {captureKindHasUncertainOutcome(kind, uncertainKinds) ? <div className="capture-offline-note" role="status"><p>This {kind} save may have completed. Check existing {kind}s before another attempt; creating again can duplicate it.</p><Button type="button" variant="ghost" onClick={() => { setAcknowledgedKind(kind); setError(null); }}>I checked existing {kind}s; retry</Button></div> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      </form>
    </PlannerSheet>
  );
}
