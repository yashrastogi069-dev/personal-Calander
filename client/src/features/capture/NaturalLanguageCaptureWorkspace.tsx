import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { interpretationChips } from "@/features/tasks/CaptureSheet";
import { trpc } from "@/lib/trpc";
import type { WorkspaceScope } from "@/lib/workspace";
import type { PlannerSyncScope } from "@/lib/offlineSync";
import { captureDraftStorageKey, clearCaptureDraft, clearCaptureDraftIfUnchanged, newCaptureRequestId, readCaptureDraft, writeCaptureDraft } from "./captureDraftStorage";
import { captureCanUseResult, fingerprintCapturePayload, prepareCaptureSubmission, type CaptureSubmissionIdentity } from "./captureSubmission";
import { zonedDateTimeToUtc } from "@shared/planningAvailability";
import { parseNaturalLanguageTask, type NaturalLanguageTaskDraft } from "@shared/naturalLanguageTask";
import { CalendarClock, CircleAlert, PenLine, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import "./capture-workspace.css";

type NaturalLanguageCaptureWorkspaceProps = {
  scope: WorkspaceScope;
  today: string;
  snapshot: any;
  plannerSyncScope?: PlannerSyncScope;
  onCreateTask: (patch: Record<string, unknown>, requestId?: string) => Promise<{ queued?: boolean }>;
  thought: string;
  onThoughtChange: (thought: string) => void;
};

export function captureDraftAfterThoughtChange<TDraft>(previousThought: string, nextThought: string, draft: TDraft | null) {
  return previousThought === nextThought ? draft : null;
}

export function titleOnlyCapturePatch(thought: string, planForToday: boolean, today: string) {
  return { title: thought.trim(), scheduledLocalDate: planForToday ? today : null, state: "not_started", priority: "medium", horizon: "daily", sortOrder: 0 };
}

export function restoreNaturalLanguageDraft(value: unknown, today: string): NaturalLanguageTaskDraft | null {
  if (!value || typeof value !== "object" || typeof (value as { title?: unknown }).title !== "string") return null;
  const saved = value as Record<string, unknown>;
  const base = parseNaturalLanguageTask("", today);
  const stringOrNull = (field: string) => typeof saved[field] === "string" ? saved[field] as string : null;
  const recurrence = saved.recurrenceRule;
  const safeRecurrence = recurrence && typeof recurrence === "object" &&
    ["daily", "weekly", "monthly"].includes((recurrence as { frequency?: string }).frequency ?? "") &&
    Number.isInteger((recurrence as { interval?: number }).interval) && (recurrence as { interval: number }).interval > 0
    ? recurrence as NaturalLanguageTaskDraft["recurrenceRule"] : null;
  return {
    ...base,
    title: saved.title as string,
    priority: ["none", "low", "medium", "high", "critical"].includes(String(saved.priority)) ? saved.priority as NaturalLanguageTaskDraft["priority"] : base.priority,
    dueLocalDate: stringOrNull("dueLocalDate"),
    scheduledLocalDate: stringOrNull("scheduledLocalDate"),
    reserveTime: stringOrNull("reserveTime"),
    estimateMinutes: typeof saved.estimateMinutes === "number" && Number.isInteger(saved.estimateMinutes) && saved.estimateMinutes >= 5 && saved.estimateMinutes <= 1440 ? saved.estimateMinutes : null,
    recurrenceRule: safeRecurrence,
    notes: Array.isArray(saved.notes) ? saved.notes.filter((note): note is string => typeof note === "string") : [],
  };
}

function addMinutes(localDate: string, time: string, minutes: number, timezone: string) {
  const [hours, minutesValue] = time.split(":").map(Number);
  const startMinutes = hours * 60 + minutesValue;
  return {
    plannedStartAt: zonedDateTimeToUtc(localDate, startMinutes, timezone),
    plannedEndAt: zonedDateTimeToUtc(localDate, startMinutes + minutes, timezone),
  };
}
export function NaturalLanguageCaptureWorkspace({
  scope,
  today,
  snapshot,
  plannerSyncScope,
  onCreateTask,
  thought,
  onThoughtChange,
}: NaturalLanguageCaptureWorkspaceProps) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<NaturalLanguageTaskDraft | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [planForToday, setPlanForToday] = useState(false);
  const [submissionIdentity, setSubmissionIdentity] = useState<CaptureSubmissionIdentity>(() => ({ requestId: newCaptureRequestId(), lastSubmittedFingerprint: null, confirmedChangedFingerprint: null }));
  const [hydratedScope, setHydratedScope] = useState<string | null>(null);
  const hydratedScopeRef = useRef<string | null>(null);
  const restoredThoughtRef = useRef<string | null>(null);
  const scopeKey = plannerSyncScope ? captureDraftStorageKey(plannerSyncScope, "natural") : null;
  const currentDraftMarker = JSON.stringify({ scopeKey, thought, draft, planForToday, templateName });
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
  useEffect(() => { activeSubmissionRef.current = null; setCreating(false); setError(null); }, [scopeKey]);
  const previousThoughtRef = useRef(thought);
  useEffect(() => {
    if (!scopeKey || hydratedScopeRef.current === scopeKey) return;
    const accountChanged = hydratedScopeRef.current !== null;
    const saved = readCaptureDraft<{ thought?: string; draft?: NaturalLanguageTaskDraft | null; planForToday?: boolean; submissionIdentity?: CaptureSubmissionIdentity; templateName?: string }>(plannerSyncScope, "natural");
    const restoreSaved = Boolean(typeof saved?.thought === "string" && saved.thought && (accountChanged || !thought || saved.thought === thought));
    if (accountChanged && !restoreSaved) onThoughtChange("");
    if (restoreSaved && saved?.thought && (accountChanged || !thought)) {
      restoredThoughtRef.current = saved.thought;
      onThoughtChange(saved.thought);
    }
    const safeDraft = restoreNaturalLanguageDraft(saved?.draft, today);
    setDraft(restoreSaved ? safeDraft : null);
    setPlanForToday(restoreSaved ? saved?.planForToday === true : false);
    setTemplateName(restoreSaved && typeof saved?.templateName === "string" ? saved.templateName : "");
    setSubmissionIdentity(restoreSaved && saved?.submissionIdentity && typeof saved.submissionIdentity.requestId === "string" &&
      (saved.submissionIdentity.lastSubmittedFingerprint === null || typeof saved.submissionIdentity.lastSubmittedFingerprint === "string")
      ? saved.submissionIdentity : { requestId: newCaptureRequestId(), lastSubmittedFingerprint: null, confirmedChangedFingerprint: null });
    hydratedScopeRef.current = scopeKey;
    setHydratedScope(scopeKey);
  }, [scopeKey, plannerSyncScope, onThoughtChange, thought, today]);
  useEffect(() => {
    const previousThought = previousThoughtRef.current;
    if (restoredThoughtRef.current === thought) restoredThoughtRef.current = null;
    else if (previousThought !== thought) setDraft(current => captureDraftAfterThoughtChange(previousThought, thought, current));
    if (previousThought !== thought) setError(null);
    previousThoughtRef.current = thought;
  }, [thought]);
  useEffect(() => {
    if (!scopeKey || hydratedScope !== scopeKey) return;
    if (thought || draft || templateName || planForToday) writeCaptureDraft(plannerSyncScope, "natural", { thought, draft, templateName, planForToday, submissionIdentity });
    else clearCaptureDraft(plannerSyncScope, "natural");
  }, [scopeKey, hydratedScope, plannerSyncScope, thought, draft, templateName, planForToday, submissionIdentity]);
  const clearDraft = () => {
    clearCaptureDraft(plannerSyncScope, "natural");
    onThoughtChange("");
    setDraft(null);
    setTemplateName("");
    setPlanForToday(false);
    setSubmissionIdentity({ requestId: newCaptureRequestId(), lastSubmittedFingerprint: null, confirmedChangedFingerprint: null });
    setError(null);
  };
  const saveTemplate = trpc.planner.planningTemplate.create.useMutation({
    onSuccess: () => {
      setTemplateName("");
      setError(null);
      utils.planner.workspace.snapshot.invalidate();
      toast.success("Task starting point saved. It has not created work.");
    },
    onError: mutationError => setError(mutationError.message || "The task starting point could not be saved."),
  });
  const archiveTemplate = trpc.planner.planningTemplate.archive.useMutation({
    onSuccess: () => {
      setError(null);
      utils.planner.workspace.snapshot.invalidate();
      toast.success("Task starting point archived.");
    },
    onError: mutationError => setError(mutationError.message || "The task starting point could not be archived."),
  });
  const parse = () => {
    if (!thought.trim()) {
      setError("Write a task thought first; parsing does not create work on its own.");
      return;
    }
    setError(null);
    setDraft(parseNaturalLanguageTask(thought, today));
  };
  const createTask = async () => {
    if (!draft || creating) return;
    if (!draft.title.trim()) {
      setError("Give the reviewed task a clear title before creating it.");
      return;
    }
    const canReserve = draft.scheduledLocalDate && draft.reserveTime && draft.estimateMinutes;
    const reservation: { plannedStartAt?: Date; plannedEndAt?: Date } = canReserve
      ? addMinutes(draft.scheduledLocalDate!, draft.reserveTime!, draft.estimateMinutes!, scope.timezone)
      : {};
    const payload = {
        title: draft.title.trim(),
        priority: draft.priority,
        horizon: "weekly",
        dueLocalDate: draft.dueLocalDate,
        scheduledLocalDate: draft.scheduledLocalDate,
        estimateMinutes: draft.estimateMinutes,
        plannedStartAt: reservation.plannedStartAt ?? null,
        plannedEndAt: reservation.plannedEndAt ?? null,
        recurrenceRule: draft.recurrenceRule,
        recurrenceAnchor: draft.recurrenceRule ? "scheduled" : null,
      };
    const prepared = prepareCaptureSubmission(submissionIdentity, fingerprintCapturePayload("reviewed-task", payload));
    setSubmissionIdentity(prepared.identity);
    if (prepared.needsConfirmation) {
      setError("The earlier save may have completed. These changes would create a separate task. Check your tasks, then choose Create task again to confirm.");
      return;
    }
    const submittedMarker = currentDraftMarkerRef.current;
    const submittedScopeKey = scopeKey;
    const submittedToken = ++nextSubmissionTokenRef.current;
    activeSubmissionRef.current = submittedToken;
    setCreating(true);
    setError(null);
    try {
      const result = await onCreateTask(payload, prepared.identity.requestId);
      if (!captureCanUseResult(mountedRef.current, activeSubmissionRef.current, submittedToken, currentScopeKeyRef.current, submittedScopeKey)) return;
      if (clearCaptureDraftIfUnchanged(plannerSyncScope, "natural", submittedMarker, currentDraftMarkerRef.current)) {
        clearDraft();
        toast.success(result.queued ? "Saved on this device." : "Task created from your reviewed capture.");
      } else toast.success("The submitted task was saved. Your newer draft is still here.");
    } catch (caught) {
      if (captureCanUseResult(mountedRef.current, activeSubmissionRef.current, submittedToken, currentScopeKeyRef.current, submittedScopeKey) && currentDraftMarkerRef.current === submittedMarker)
        setError(caught instanceof Error ? caught.message : "The reviewed task could not be created.");
    } finally {
      if (captureCanUseResult(mountedRef.current, activeSubmissionRef.current, submittedToken, currentScopeKeyRef.current, submittedScopeKey)) {
        setCreating(false);
        activeSubmissionRef.current = null;
      }
    }
  };
  const createTitleOnly = async () => {
    const title = thought.trim();
    if (!title || creating) { if (!title) setError("Name the task before saving it."); return; }
    const payload = titleOnlyCapturePatch(title, planForToday, today);
    const prepared = prepareCaptureSubmission(submissionIdentity, fingerprintCapturePayload("title-only-task", payload));
    setSubmissionIdentity(prepared.identity);
    if (prepared.needsConfirmation) {
      setError("The earlier save may have completed. These changes would create a separate task. Check your tasks, then choose Save again to confirm.");
      return;
    }
    const submittedMarker = currentDraftMarkerRef.current;
    const submittedScopeKey = scopeKey;
    const submittedToken = ++nextSubmissionTokenRef.current;
    activeSubmissionRef.current = submittedToken;
    setCreating(true);
    setError(null);
    try {
      const result = await onCreateTask(payload, prepared.identity.requestId);
      if (!captureCanUseResult(mountedRef.current, activeSubmissionRef.current, submittedToken, currentScopeKeyRef.current, submittedScopeKey)) return;
      if (clearCaptureDraftIfUnchanged(plannerSyncScope, "natural", submittedMarker, currentDraftMarkerRef.current)) {
        clearDraft();
        toast.success(result.queued ? "Saved on this device · waiting to sync." : planForToday ? "Added to Today." : "Saved to Inbox.");
      } else toast.success("The submitted task was saved. Your newer draft is still here.");
    } catch (caught) {
      if (captureCanUseResult(mountedRef.current, activeSubmissionRef.current, submittedToken, currentScopeKeyRef.current, submittedScopeKey) && currentDraftMarkerRef.current === submittedMarker)
        setError(caught instanceof Error ? caught.message : "The task could not be saved. Your draft is still here.");
    } finally {
      if (captureCanUseResult(mountedRef.current, activeSubmissionRef.current, submittedToken, currentScopeKeyRef.current, submittedScopeKey)) {
        setCreating(false);
        activeSubmissionRef.current = null;
      }
    }
  };
  const taskTemplates = (snapshot.planningTemplates ?? [])
    .filter((template: any) => template.kind === "task" && !template.archivedAt)
    .slice(0, 12);
  const otherStartingPoints = (snapshot.planningTemplates ?? [])
    .filter((template: any) => (template.kind === "project" || template.kind === "daily_plan") && !template.archivedAt)
    .slice(0, 12);
  const useTemplate = (template: any) => {
    const payload = template.payload ?? {};
    setDraft({
      ...parseNaturalLanguageTask("", today),
      title: typeof payload.title === "string" ? payload.title : "",
      priority: ["none", "low", "medium", "high", "critical"].includes(payload.priority) ? payload.priority : "medium",
      dueLocalDate: typeof payload.dueLocalDate === "string" ? payload.dueLocalDate : null,
      scheduledLocalDate: typeof payload.scheduledLocalDate === "string" ? payload.scheduledLocalDate : null,
      reserveTime: typeof payload.reserveTime === "string" ? payload.reserveTime : null,
      estimateMinutes: typeof payload.estimateMinutes === "number" ? payload.estimateMinutes : null,
      recurrenceRule: payload.recurrenceRule && typeof payload.recurrenceRule === "object" ? payload.recurrenceRule : null,
      notes: ["Starting point loaded. Review and edit it before creating a task."],
    });
  };
  const chips = draft ? interpretationChips(draft) : [];

  if (scopeKey && hydratedScope !== scopeKey) return null;

  return (
    <section className="capture-workspace" aria-labelledby="capture-workspace-heading">
      <header><div><h2 id="capture-workspace-heading">Capture the thought. Review the plan.</h2><p>Type naturally. Deadline, Plan for, Reserved time, estimate, recurrence, and ambiguity stay separate. Nothing saves until you review and choose Create task.</p></div><Sparkles size={28} aria-hidden="true" /></header>
      {error ? <div className="capture-error" role="alert"><CircleAlert size={16} /><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss capture message">×</button></div> : null}
      <section className="capture-input-panel"><Label htmlFor="natural-task">What needs your attention?</Label><textarea id="natural-task" value={thought} onChange={event => onThoughtChange?.(event.target.value)} maxLength={1000} placeholder="Finish report tomorrow at 2pm for 45 minutes high priority" /><div><p>Examples: “Pay invoice by Friday”, “Review metrics every Monday and Wednesday”, or “Send proposal tomorrow for 30 min”.</p><Button type="button" onClick={parse}><PenLine size={15} /> Parse for review</Button></div></section>
      <section className="capture-title-only" aria-label="Save a task without interpreting the text">
        <div><strong>Save just the title</strong><p>Keep the text exactly as written, with no inferred deadline or reserved time.</p></div>
        <label><input type="checkbox" checked={planForToday} onChange={event => setPlanForToday(event.target.checked)} /> Plan for today</label>
        <Button type="button" onClick={() => void createTitleOnly()} disabled={creating || !thought.trim()}>{creating ? "Saving…" : planForToday ? "Add to Today" : "Save to Inbox"}</Button>
        {thought || draft || templateName ? <Button type="button" variant="ghost" onClick={clearDraft} disabled={creating}>Discard draft</Button> : null}
      </section>
      {taskTemplates.length ? <section className="capture-template-shelf" aria-labelledby="task-starting-points-heading"><div><h3 id="task-starting-points-heading">Task starting points</h3><p>Load defaults into the review form. A starting point cannot create a task by itself.</p></div><div>{taskTemplates.map((template: any) => <article key={template.id}><span><strong>{template.name}</strong><small>{template.description || "Review before use"}</small></span><button type="button" onClick={() => useTemplate(template)}>Use</button><button type="button" onClick={() => archiveTemplate.mutate({ ...scope, id: template.id, expectedVersion: template.version })} disabled={archiveTemplate.isPending} aria-label={`Archive ${template.name}`}>Archive</button></article>)}</div></section> : null}
      {otherStartingPoints.length ? <section className="capture-template-shelf" aria-labelledby="other-starting-points-heading"><div><h3 id="other-starting-points-heading">Project and daily-plan starting points</h3><p>These remain available from their owning Project and Plan workflows; Capture does not apply them as tasks.</p></div><div>{otherStartingPoints.map((template: any) => <article key={template.id}><span><strong>{template.name}</strong><small>{template.kind === "daily_plan" ? "Open from Plan" : "Open from Projects"}</small></span></article>)}</div></section> : null}
      {draft ? <section className="capture-draft-panel" aria-labelledby="capture-draft-heading"><div className="capture-draft-heading"><div><h3 id="capture-draft-heading">Review parsed details</h3><p>Edit anything before it becomes a task. A blank field stays blank; nothing is guessed.</p></div><CalendarClock size={21} aria-hidden="true" /></div>{chips.length ? <div className="capture-interpretation-chips" aria-label="Interpreted task details">{chips.map(chip => <span key={chip.kind} className={`capture-interpretation-chip is-${chip.kind}`}><strong>{chip.label}</strong><span>{chip.value}</span></span>)}</div> : null}<div className="capture-draft-fields"><label>Task title<Input value={draft.title} onChange={event => setDraft(current => current ? { ...current, title: event.target.value } : current)} /></label><label>Priority<select value={draft.priority} onChange={event => setDraft(current => current ? { ...current, priority: event.target.value as NaturalLanguageTaskDraft["priority"] } : current)}><option value="none">No priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label>Deadline<Input value={draft.dueLocalDate ?? ""} type="date" onChange={event => setDraft(current => current ? { ...current, dueLocalDate: event.target.value || null } : current)} /></label><label>Plan for<Input value={draft.scheduledLocalDate ?? ""} type="date" onChange={event => setDraft(current => current ? { ...current, scheduledLocalDate: event.target.value || null } : current)} /></label><label>Reserved time<Input value={draft.reserveTime ?? ""} type="time" onChange={event => setDraft(current => current ? { ...current, reserveTime: event.target.value || null } : current)} /></label><label>Estimate<Input value={draft.estimateMinutes ? String(draft.estimateMinutes) : ""} type="number" min="5" max="1440" onChange={event => { const value = Number(event.target.value); setDraft(current => current ? { ...current, estimateMinutes: event.target.value && Number.isInteger(value) && value >= 5 && value <= 1440 ? value : null } : current); }} placeholder="Minutes" /></label><label>Recurrence<select value={draft.recurrenceRule?.frequency ?? "none"} onChange={event => setDraft(current => current ? { ...current, recurrenceRule: event.target.value === "none" ? null : { frequency: event.target.value as "daily" | "weekly" | "monthly", interval: 1, ...(event.target.value === "weekly" ? { weekdays: [1] } : {}) } } : current)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label></div>{draft.notes.length ? <ul className="capture-notes">{draft.notes.map(note => <li key={note}>{note}</li>)}</ul> : null}<div className="capture-reservation-note">{draft.scheduledLocalDate && draft.reserveTime && draft.estimateMinutes ? `Creating this task will reserve ${draft.estimateMinutes} minutes on ${draft.scheduledLocalDate} at ${draft.reserveTime} (${scope.timezone}).` : "A reservation is created only when Plan for, Reserved time, and Estimate are all supplied."}</div><div className="capture-template-save"><Label htmlFor="capture-template-name">Save these defaults as a starting point</Label><div><Input id="capture-template-name" value={templateName} onChange={event => setTemplateName(event.target.value)} maxLength={120} placeholder="Example: Admin follow-up" /><Button type="button" variant="ghost" onClick={() => { if (!templateName.trim()) { setError("Name the starting point before saving it."); return; } saveTemplate.mutate({ ...scope, kind: "task", name: templateName.trim(), description: "Reviewed task defaults; does not create work.", payload: { title: draft.title, priority: draft.priority, estimateMinutes: draft.estimateMinutes, recurrenceRule: draft.recurrenceRule } }); }} disabled={saveTemplate.isPending}>{saveTemplate.isPending ? "Saving…" : "Save starting point"}</Button></div></div><div className="capture-draft-actions"><Button type="button" variant="ghost" onClick={clearDraft}>Discard draft</Button><Button type="button" className="primary-action" onClick={() => void createTask()} disabled={creating}>{creating ? "Creating…" : "Create task"}</Button></div></section> : null}
      {plannerSyncScope ? <p className="capture-offline-note">This draft stays in this browser tab for this account and workspace until you save or discard it. Avoid putting passwords in a task.</p> : null}
      <p className="capture-offline-note"><strong>AI-assisted capture stays review-first.</strong> A proposal can be discarded or edited and never saves until you explicitly confirm it.</p>
    </section>
  );
}
