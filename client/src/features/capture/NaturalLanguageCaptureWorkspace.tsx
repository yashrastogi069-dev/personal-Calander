import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { interpretationChips } from "@/features/tasks/CaptureSheet";
import { trpc } from "@/lib/trpc";
import type { WorkspaceScope } from "@/lib/workspace";
import { zonedDateTimeToUtc } from "@shared/planningAvailability";
import { parseNaturalLanguageTask, type NaturalLanguageTaskDraft } from "@shared/naturalLanguageTask";
import { CalendarClock, CircleAlert, PenLine, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type NaturalLanguageCaptureWorkspaceProps = {
  scope: WorkspaceScope;
  today: string;
  snapshot: any;
  onCreateTask: (patch: Record<string, unknown>) => Promise<{ queued?: boolean }>;
  thought: string;
  onThoughtChange: (thought: string) => void;
};

export function captureDraftAfterThoughtChange<TDraft>(previousThought: string, nextThought: string, draft: TDraft | null) {
  return previousThought === nextThought ? draft : null;
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
  onCreateTask,
  thought,
  onThoughtChange,
}: NaturalLanguageCaptureWorkspaceProps) {
  const utils = trpc.useUtils();
  const [draft, setDraft] = useState<NaturalLanguageTaskDraft | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const previousThoughtRef = useRef(thought);
  useEffect(() => {
    const previousThought = previousThoughtRef.current;
    setDraft(current => captureDraftAfterThoughtChange(previousThought, thought, current));
    if (previousThought !== thought) setError(null);
    previousThoughtRef.current = thought;
  }, [thought]);
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
    if (!draft) return;
    if (!draft.title.trim()) {
      setError("Give the reviewed task a clear title before creating it.");
      return;
    }
    const canReserve = draft.scheduledLocalDate && draft.reserveTime && draft.estimateMinutes;
    const reservation: { plannedStartAt?: Date; plannedEndAt?: Date } = canReserve
      ? addMinutes(draft.scheduledLocalDate!, draft.reserveTime!, draft.estimateMinutes!, scope.timezone)
      : {};
    setCreating(true);
    setError(null);
    try {
      const result = await onCreateTask({
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
      });
      onThoughtChange?.("");
      setDraft(null);
      toast.success(result.queued ? "Saved on this device." : "Task created from your reviewed capture.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reviewed task could not be created.");
    } finally {
      setCreating(false);
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

  return (
    <section className="capture-workspace" aria-labelledby="capture-workspace-heading">
      <header><div><h2 id="capture-workspace-heading">Capture the thought. Review the plan.</h2><p>Type naturally. Deadline, Plan for, Reserved time, estimate, recurrence, and ambiguity stay separate. Nothing saves until you review and choose Create task.</p></div><Sparkles size={28} aria-hidden="true" /></header>
      {error ? <div className="capture-error" role="alert"><CircleAlert size={16} /><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss capture message">×</button></div> : null}
      <section className="capture-input-panel"><Label htmlFor="natural-task">What needs your attention?</Label><textarea id="natural-task" value={thought} onChange={event => onThoughtChange?.(event.target.value)} maxLength={1000} placeholder="Finish report tomorrow at 2pm for 45 minutes high priority" /><div><p>Examples: “Pay invoice by Friday”, “Review metrics every Monday and Wednesday”, or “Send proposal tomorrow for 30 min”.</p><Button type="button" onClick={parse}><PenLine size={15} /> Parse for review</Button></div></section>
      {taskTemplates.length ? <section className="capture-template-shelf" aria-labelledby="task-starting-points-heading"><div><h3 id="task-starting-points-heading">Task starting points</h3><p>Load defaults into the review form. A starting point cannot create a task by itself.</p></div><div>{taskTemplates.map((template: any) => <article key={template.id}><span><strong>{template.name}</strong><small>{template.description || "Review before use"}</small></span><button type="button" onClick={() => useTemplate(template)}>Use</button><button type="button" onClick={() => archiveTemplate.mutate({ ...scope, id: template.id, expectedVersion: template.version })} disabled={archiveTemplate.isPending} aria-label={`Archive ${template.name}`}>Archive</button></article>)}</div></section> : null}
      {otherStartingPoints.length ? <section className="capture-template-shelf" aria-labelledby="other-starting-points-heading"><div><h3 id="other-starting-points-heading">Project and daily-plan starting points</h3><p>These remain available from their owning Project and Plan workflows; Capture does not apply them as tasks.</p></div><div>{otherStartingPoints.map((template: any) => <article key={template.id}><span><strong>{template.name}</strong><small>{template.kind === "daily_plan" ? "Open from Plan" : "Open from Projects"}</small></span></article>)}</div></section> : null}
      {draft ? <section className="capture-draft-panel" aria-labelledby="capture-draft-heading"><div className="capture-draft-heading"><div><h3 id="capture-draft-heading">Review parsed details</h3><p>Edit anything before it becomes a task. A blank field stays blank; nothing is guessed.</p></div><CalendarClock size={21} aria-hidden="true" /></div>{chips.length ? <div className="capture-interpretation-chips" aria-label="Interpreted task details">{chips.map(chip => <span key={chip.kind} className={`capture-interpretation-chip is-${chip.kind}`}><strong>{chip.label}</strong><span>{chip.value}</span></span>)}</div> : null}<div className="capture-draft-fields"><label>Task title<Input value={draft.title} onChange={event => setDraft(current => current ? { ...current, title: event.target.value } : current)} /></label><label>Priority<select value={draft.priority} onChange={event => setDraft(current => current ? { ...current, priority: event.target.value as NaturalLanguageTaskDraft["priority"] } : current)}><option value="none">No priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></label><label>Deadline<Input value={draft.dueLocalDate ?? ""} type="date" onChange={event => setDraft(current => current ? { ...current, dueLocalDate: event.target.value || null } : current)} /></label><label>Plan for<Input value={draft.scheduledLocalDate ?? ""} type="date" onChange={event => setDraft(current => current ? { ...current, scheduledLocalDate: event.target.value || null } : current)} /></label><label>Reserved time<Input value={draft.reserveTime ?? ""} type="time" onChange={event => setDraft(current => current ? { ...current, reserveTime: event.target.value || null } : current)} /></label><label>Estimate<Input value={draft.estimateMinutes ? String(draft.estimateMinutes) : ""} type="number" min="5" max="1440" onChange={event => { const value = Number(event.target.value); setDraft(current => current ? { ...current, estimateMinutes: event.target.value && Number.isInteger(value) && value >= 5 && value <= 1440 ? value : null } : current); }} placeholder="Minutes" /></label><label>Recurrence<select value={draft.recurrenceRule?.frequency ?? "none"} onChange={event => setDraft(current => current ? { ...current, recurrenceRule: event.target.value === "none" ? null : { frequency: event.target.value as "daily" | "weekly" | "monthly", interval: 1, ...(event.target.value === "weekly" ? { weekdays: [1] } : {}) } } : current)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label></div>{draft.notes.length ? <ul className="capture-notes">{draft.notes.map(note => <li key={note}>{note}</li>)}</ul> : null}<div className="capture-reservation-note">{draft.scheduledLocalDate && draft.reserveTime && draft.estimateMinutes ? `Creating this task will reserve ${draft.estimateMinutes} minutes on ${draft.scheduledLocalDate} at ${draft.reserveTime} (${scope.timezone}).` : "A reservation is created only when Plan for, Reserved time, and Estimate are all supplied."}</div><div className="capture-template-save"><Label htmlFor="capture-template-name">Save these defaults as a starting point</Label><div><Input id="capture-template-name" value={templateName} onChange={event => setTemplateName(event.target.value)} maxLength={120} placeholder="Example: Admin follow-up" /><Button type="button" variant="ghost" onClick={() => { if (!templateName.trim()) { setError("Name the starting point before saving it."); return; } saveTemplate.mutate({ ...scope, kind: "task", name: templateName.trim(), description: "Reviewed task defaults; does not create work.", payload: { title: draft.title, priority: draft.priority, estimateMinutes: draft.estimateMinutes, recurrenceRule: draft.recurrenceRule } }); }} disabled={saveTemplate.isPending}>{saveTemplate.isPending ? "Saving…" : "Save starting point"}</Button></div></div><div className="capture-draft-actions"><Button type="button" variant="ghost" onClick={() => setDraft(null)}>Discard draft</Button><Button type="button" className="primary-action" onClick={() => void createTask()} disabled={creating}>{creating ? "Creating…" : "Create task"}</Button></div></section> : null}
      <p className="capture-offline-note"><strong>AI-assisted capture stays review-first.</strong> A proposal can be discarded or edited and never saves until you explicitly confirm it.</p>
    </section>
  );
}
