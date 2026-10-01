import { intentionPresentation, previewIntentionKindChange, type GoalIntentionRecord, type IntentionKind } from "@shared/goalIntentions";
import { useEffect, useState } from "react";

type RelatedRecord = { id: string; title?: string; name?: string; state?: string; dueLocalDate?: string | null; progressValue?: number; targetValue?: number; evidence?: string | null };

export function IntentionDetail({ goal, goalIntentionAvailable, projectRiskAvailable = false, projectDependenciesAvailable = false, milestones = [], linkedTasks = [], linkedProjects = [], allProjects = [], linkedHabits = [], projectDependencies = [], nextAction, onConvert, onUpdate, onOpenRelated }: {
  goal: GoalIntentionRecord & { version?: number; description?: string | null; progressMode?: string | null; progressValue?: number | null; targetValue?: number | null };
  goalIntentionAvailable?: boolean; projectRiskAvailable?: boolean; projectDependenciesAvailable?: boolean; milestones?: RelatedRecord[]; linkedTasks?: RelatedRecord[]; linkedProjects?: RelatedRecord[]; allProjects?: RelatedRecord[]; linkedHabits?: RelatedRecord[]; projectDependencies?: Array<{ projectId: string; dependsOnProjectId: string; dependencyType: string }>;
  nextAction?: RelatedRecord;
  onConvert?: (kind: IntentionKind) => Promise<unknown>; onUpdate?: (input: { id: string; expectedVersion: number; patch: Record<string, unknown> }) => Promise<unknown>; onOpenRelated?: (entity: string, id: string) => void;
}) {
  const presentation = intentionPresentation(goal);
  const [previewKind, setPreviewKind] = useState<IntentionKind | null>(null);
  const [editing, setEditing] = useState(false);
  const [criteria, setCriteria] = useState(goal.successCriteria ?? "");
  const [standards, setStandards] = useState(goal.standards ?? "");
  const [cadence, setCadence] = useState<"weekly" | "monthly" | "quarterly" | "yearly">(goal.reviewCadence ?? "monthly");
  const [reviewDate, setReviewDate] = useState(goal.nextReviewLocalDate ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (editing) return;
    setCriteria(goal.successCriteria ?? ""); setStandards(goal.standards ?? ""); setCadence(goal.reviewCadence ?? "monthly"); setReviewDate(goal.nextReviewLocalDate ?? "");
  }, [editing, goal.successCriteria, goal.standards, goal.reviewCadence, goal.nextReviewLocalDate, goal.version]);
  const preview = previewKind ? previewIntentionKindChange(goal, previewKind) : null;
  const showLinks = (label: string, entity: string, records: RelatedRecord[]) => <section><h4>{label} <span>{records.length}</span></h4>{records.length ? <ul>{records.map(item => <li key={item.id}>{entity !== "milestone" && onOpenRelated ? <button type="button" className="intention-related-link" onClick={() => onOpenRelated(entity, item.id)}>{item.title ?? item.name ?? "Untitled"}</button> : <strong>{item.title ?? item.name ?? "Untitled"}</strong>}<small>{item.state?.replace("_", " ")}{item.dueLocalDate ? ` · due ${item.dueLocalDate}` : ""}</small>{item.evidence ? <p>Evidence: {item.evidence}</p> : null}</li>)}</ul> : <p>Nothing linked yet.</p>}</section>;
  const saveDetails = async () => {
    if (!onUpdate || goal.version === undefined || !goal.id) return;
    setPending(true); setMessage(null);
    try { await onUpdate({ id: goal.id, expectedVersion: goal.version, patch: { successCriteria: criteria.trim() || null, standards: standards.trim() || null, reviewCadence: cadence || null, nextReviewLocalDate: reviewDate || null } }); setEditing(false); setMessage("Intention details saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save these details."); }
    finally { setPending(false); }
  };
  const confirmConversion = async () => {
    if (!previewKind || !onConvert) return;
    setPending(true); setMessage(null);
    try { await onConvert(previewKind); setMessage(`Saved as ${previewKind}. Existing dates, progress, links, and history were preserved.`); setPreviewKind(null); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this change."); }
    finally { setPending(false); }
  };

  return <aside className="intention-detail" aria-label={`${presentation.label} detail`}>
    <span>{presentation.label}</span><h3>{goal.title}</h3><p>{goal.description || presentation.summary}</p>
    {presentation.kind === "outcome" ? <section className="intention-progress"><h4>Progress &amp; evidence</h4><p>{goal.progressValue ?? 0} of {goal.targetValue ?? 100} · {goal.progressMode ?? "task"} based</p>{goal.startLocalDate || goal.dueLocalDate ? <p>{goal.startLocalDate ? `Starts ${goal.startLocalDate}` : ""}{goal.startLocalDate && goal.dueLocalDate ? " · " : ""}{goal.dueLocalDate ? `Target ${goal.dueLocalDate}` : ""}</p> : null}{goal.successCriteria ? <p><b>Success criteria:</b> {goal.successCriteria}</p> : null}<small>Progress is a planning signal; it does not complete this goal automatically.</small></section> : null}
    {presentation.kind === "direction" ? <section><h4>Guiding standard</h4><p>{goal.standards || "No standard recorded yet."}</p><details><summary>Stored progress and date settings</summary><p>{goal.progressValue ?? 0} of {goal.targetValue ?? 100} · {goal.progressMode ?? "task"} based</p><p>{goal.startLocalDate || "No start date"} → {goal.dueLocalDate || "No target date"}</p></details><small>Stored progress and dates remain intact but are not used to score this direction.</small></section> : null}
    {nextAction ? <section><h4>Next action</h4><p>{nextAction.title ?? "Untitled task"}</p><small>Suggested from an open task already linked to this goal or its projects.</small></section> : null}
    {goal.reviewCadence ? <section><h4>Next review</h4><p>{goal.reviewCadence}{goal.nextReviewLocalDate ? ` · ${goal.nextReviewLocalDate}` : " · date not set"}</p></section> : null}
    {goalIntentionAvailable && onUpdate ? <section><h4>Intention details</h4>{editing ? <><label>Success criteria<textarea value={criteria} onChange={event => setCriteria(event.target.value)} maxLength={5000} rows={2} /></label><label>Guiding standards<textarea value={standards} onChange={event => setStandards(event.target.value)} maxLength={5000} rows={2} /></label><label>Review rhythm<select value={cadence} onChange={event => setCadence(event.target.value as typeof cadence)}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label><label>Next review date<input type="date" value={reviewDate} onChange={event => setReviewDate(event.target.value)} /></label><div><button type="button" className="text-button" onClick={() => setEditing(false)}>Cancel</button><button type="button" onClick={() => void saveDetails()} disabled={pending}>{pending ? "Saving…" : "Save details"}</button></div></> : <button className="text-button" type="button" onClick={() => setEditing(true)}>Edit criteria and review</button>}</section> : null}
    {milestones.length ? showLinks("Milestones", "milestone", milestones) : null}
    {showLinks("Linked tasks", "task", linkedTasks)}{showLinks("Linked projects", "project", linkedProjects)}{showLinks("Linked habits", "habit", linkedHabits)}
    {linkedProjects.length ? <section><h4>Project risks &amp; dependencies</h4>{linkedProjects.map(project => { const deps = projectDependencies.filter(dep => dep.projectId === project.id); return <div key={project.id}><p>{project.title ?? "Project"}: {projectRiskAvailable ? (project as any).riskLevel && (project as any).riskLevel !== "none" ? `Risk ${(project as any).riskLevel}${(project as any).riskNote ? ` — ${(project as any).riskNote}` : ""}` : "No recorded project risk" : "Risk tracking is unavailable until the approved project schema update is applied."}</p>{deps.length ? <ul>{deps.map(dep => { const prerequisite = allProjects.find(item => item.id === dep.dependsOnProjectId); return <li key={`${dep.projectId}:${dep.dependsOnProjectId}`}><span>{dep.dependencyType} prerequisite: </span>{onOpenRelated ? <button type="button" className="intention-related-link" onClick={() => onOpenRelated("project", dep.dependsOnProjectId)}>{prerequisite?.title ?? dep.dependsOnProjectId}</button> : prerequisite?.title ?? dep.dependsOnProjectId}</li>; })}</ul> : <small>{projectDependenciesAvailable ? "No recorded project dependencies." : "Project dependency details are unavailable until the approved project schema update is applied."}</small>}</div>; })}<small>Risks and dependencies shown here belong to linked projects, not to the goal itself.</small></section> : null}
    {goalIntentionAvailable && onConvert ? <section className="intention-conversion"><h4>Intention type</h4><p>Changing type changes presentation only. It does not rewrite linked work or stored progress.</p><div>{(["outcome", "direction"] as const).filter(kind => kind !== presentation.kind).map(kind => <button className="text-button" type="button" key={kind} onClick={() => setPreviewKind(kind)}>Change to {kind}</button>)}</div></section> : null}
    {preview ? <section className="intention-conversion-preview" aria-label="Review intention change" aria-live="polite"><h4>Review this change</h4><p>{preview.from} → {preview.to}</p><ul>{preview.consequences.map(item => <li key={item}>{item}</li>)}</ul><button className="text-button" type="button" onClick={() => setPreviewKind(null)} disabled={pending}>Cancel</button><button type="button" onClick={() => void confirmConversion()} disabled={pending}>{pending ? "Saving…" : "Confirm change"}</button></section> : null}
    {message ? <p role="status">{message}</p> : null}
  </aside>;
}
