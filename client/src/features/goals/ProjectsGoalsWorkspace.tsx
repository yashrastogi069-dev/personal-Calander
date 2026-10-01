import { intentionPresentation, type GoalIntentionRecord, type IntentionKind } from "@shared/goalIntentions";
import { ArrowRight, Compass, Plus, Target } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { IntentionDetail } from "./IntentionDetail";
import "./intention.css";

type Goal = GoalIntentionRecord & { id: string; state?: string; version: number; horizon?: string; color?: string | null; categoryId?: string | null; description?: string | null; parentGoalId?: string | null };
type Project = { id: string; title: string; state?: string; goalId?: string | null; horizon?: string; dueLocalDate?: string | null; riskLevel?: string; riskNote?: string | null; nextReviewLocalDate?: string | null };
type RelatedRecord = { id: string; title?: string; name?: string; goalId?: string | null; projectId?: string | null; taskId?: string | null; state?: string; dueLocalDate?: string | null; progressValue?: number; targetValue?: number; description?: string | null; evidence?: string | null };

export function ProjectsGoalsWorkspace({ goals, projects, milestones = [], tasks = [], habits = [], projectDependencies = [], goalIntentionAvailable = false, projectRiskAvailable = false, projectDependenciesAvailable = false, selectedRecordId, initialTab, onSelectGoal, onTabChange, onCreateGoal, onCreateProject, onUpdateGoal, onOpenRelated, onOpenProject, onCloseProject }: {
  goals: Goal[]; projects: Project[]; milestones?: RelatedRecord[]; tasks?: RelatedRecord[]; habits?: RelatedRecord[]; projectDependencies?: Array<{ projectId: string; dependsOnProjectId: string; dependencyType: string }>; goalIntentionAvailable?: boolean; projectRiskAvailable?: boolean; projectDependenciesAvailable?: boolean; selectedRecordId?: string | null; initialTab?: "projects" | "outcomes" | "directions";
  onSelectGoal?: (id: string) => void; onTabChange?: (tab: "projects" | "outcomes" | "directions", selectedRecordId?: string) => void; onCreateGoal?: (input: Record<string, unknown>) => Promise<unknown>; onCreateProject?: () => void; onUpdateGoal?: (input: { id: string; expectedVersion: number; patch: Record<string, unknown> }) => Promise<unknown>; onOpenRelated?: (entity: string, id: string) => void; onOpenProject?: (project: Project) => void; onCloseProject?: () => void;
}) {
  const [tab, setTab] = useState<"projects" | "outcomes" | "directions">(initialTab ?? "outcomes");
  const [createKind, setCreateKind] = useState<IntentionKind | null>(null);
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState("");
  const [standards, setStandards] = useState("");
  const [reviewCadence, setReviewCadence] = useState("monthly");
  const [reviewDate, setReviewDate] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  const activeGoals = useMemo(() => goals.filter(goal => goal.state !== "archived"), [goals]);
  const outcomes = activeGoals.filter(goal => goal.intentionKind === "outcome" || !goal.intentionKind);
  const directions = activeGoals.filter(goal => goal.intentionKind === "direction");
  const records = tab === "projects" ? projects.filter(project => project.state !== "archived") : tab === "directions" ? directions : outcomes;
  const selectedGoal = goals.find(goal => goal.id === selectedRecordId);
  const selectedProjects = selectedGoal ? projects.filter(item => item.goalId === selectedGoal.id) : [];
  const selectedProjectIds = new Set(selectedProjects.map(item => item.id));
  const selectedTasks = selectedGoal ? tasks.filter(item => item.goalId === selectedGoal.id || (item.projectId && selectedProjectIds.has(item.projectId))) : [];
  const submit = async () => {
    if (!createKind || !title.trim() || !onCreateGoal) return;
    setPending(true); setError(null);
    try {
      await onCreateGoal({ title: title.trim(), intentionKind: createKind, successCriteria: createKind === "outcome" ? criteria.trim() || null : null, standards: createKind === "direction" ? standards.trim() || null : null, reviewCadence, nextReviewLocalDate: reviewDate || null, dueLocalDate: createKind === "outcome" ? targetDate || null : null, state: "not_started", priority: "medium", horizon: createKind === "direction" ? "yearly" : "quarterly", progressMode: "task", progressValue: 0, targetValue: 100 });
      setCreateKind(null); setTitle(""); setCriteria(""); setStandards(""); setReviewDate(""); setTargetDate("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The goal could not be saved."); }
    finally { setPending(false); }
  };

  return <section className={cn("intentions-workspace", tab === "projects" && selectedRecordId && "is-project-detail")} aria-labelledby="intentions-heading">
    {tab === "projects" && selectedRecordId ? <button type="button" className="project-return" onClick={onCloseProject}>← All projects</button> : null}
    <header className="intentions-header"><div><span className="eyebrow">Long-term work</span><h2 id="intentions-heading">{tab === "projects" ? "Move projects forward" : tab === "directions" ? "Keep your direction" : "Make progress visible"}</h2><p>{tab === "projects" ? "Choose a project to see its work, blockers, and progress." : tab === "directions" ? "Keep a lasting standard and return to it at each review." : "Set a result you can recognize, then connect the work that gets you there."}</p></div>{tab === "projects" && onCreateProject ? <button type="button" className="intentions-primary-action" onClick={onCreateProject}><Plus size={16} /> New project</button> : <Compass size={28} aria-hidden="true" />}</header>
    <nav className="intentions-tabs" aria-label="Projects and goals views" role="tablist">
      {([['projects', 'Projects'], ['outcomes', 'Outcome goals'], ['directions', 'Directions']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={cn(tab === value && "is-active")} onClick={() => { setTab(value); onTabChange?.(value); }}>{label}<small>{value === "projects" ? projects.filter(project => project.state !== "archived").length : value === "directions" ? directions.length : outcomes.length}</small></button>)}
    </nav>
    {tab !== "projects" ? <div className="intentions-create-actions"><button type="button" className="text-button" onClick={() => { setCreateKind(tab === "directions" ? "direction" : "outcome"); setError(null); }}><Plus size={15} /> New {tab === "directions" ? "direction" : "outcome"}</button>{!goalIntentionAvailable ? <span role="status">New intention types are read-only until the approved schema update is available. Existing goals remain usable.</span> : null}</div> : null}
    {createKind ? <form className="intention-create-form" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <h3>New {createKind === "outcome" ? "outcome" : "direction"}</h3>
      <label>Title<input value={title} onChange={event => setTitle(event.target.value)} maxLength={280} required autoFocus /></label>
      {createKind === "outcome" ? <label>How will you know it worked?<textarea value={criteria} onChange={event => setCriteria(event.target.value)} maxLength={5000} rows={3} /></label> : <label>What standard or direction should guide choices?<textarea value={standards} onChange={event => setStandards(event.target.value)} maxLength={5000} rows={3} /></label>}
      {createKind === "outcome" ? <label>Target date (optional)<input type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} /></label> : null}
      <label>Review rhythm<select value={reviewCadence} onChange={event => setReviewCadence(event.target.value)}><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="yearly">Yearly</option></select></label>
      <label>Next review date (optional)<input type="date" value={reviewDate} onChange={event => setReviewDate(event.target.value)} /></label>
      {error ? <p role="alert">{error}</p> : null}<div><button type="button" className="text-button" onClick={() => setCreateKind(null)}>Cancel</button><button type="submit" disabled={pending || !title.trim() || !goalIntentionAvailable}>{pending ? "Saving…" : "Create"}</button></div>
    </form> : null}
    <div className="intentions-list">
      {records.length ? records.map(record => {
        if (tab === "projects") {
          const project = record as Project;
          return <button type="button" className={cn("intention-card", "project-card", selectedRecordId === project.id && "is-selected")} key={project.id} onClick={() => onOpenProject?.(project)}><span className="intention-card-icon"><ArrowRight size={16} /></span><span><strong>{project.title}</strong><small>{project.horizon ?? "project"}{project.dueLocalDate ? ` · due ${project.dueLocalDate}` : " · no deadline"}</small>{project.riskLevel && project.riskLevel !== "none" ? <span className="intention-detail-line">Risk: {project.riskLevel}{project.riskNote ? ` — ${project.riskNote}` : ""}</span> : null}</span><ArrowRight size={16} /></button>;
        }
        const goal = record as Goal;
        return <button type="button" className={cn("intention-card", selectedRecordId === goal.id && "is-selected")} key={goal.id} onClick={() => onSelectGoal?.(goal.id)}><span className="intention-card-icon">{goal.intentionKind === "direction" ? <Compass size={16} /> : <Target size={16} />}</span><span><strong>{goal.title}</strong><small>{intentionPresentation(goal).summary}</small>{intentionPresentation(goal).details.map(detail => <span className="intention-detail-line" key={detail.label}><b>{detail.label}:</b> {detail.value}</span>)}</span><span className="intention-kind">{intentionPresentation(goal).label}</span></button>;
      }) : <p className="intentions-empty">{tab === "projects" ? "No projects yet. Create one to connect tasks and track its next steps." : tab === "directions" ? "No directions yet. Add a lasting standard to review over time." : "No outcome goals yet. Add a result you want to work toward."}</p>}
    </div>
    {tab !== "projects" && selectedGoal ? <IntentionDetail key={selectedGoal.id} goal={selectedGoal} goalIntentionAvailable={goalIntentionAvailable} projectRiskAvailable={projectRiskAvailable} projectDependenciesAvailable={projectDependenciesAvailable} milestones={milestones.filter(item => item.goalId === selectedGoal.id)} linkedTasks={selectedTasks} linkedProjects={selectedProjects} allProjects={projects} linkedHabits={habits.filter(item => item.goalId === selectedGoal.id)} projectDependencies={projectDependencies} nextAction={selectedTasks.find(item => item.state !== "completed" && item.state !== "archived")} onConvert={async kind => { await onUpdateGoal?.({ id: selectedGoal.id, expectedVersion: selectedGoal.version, patch: { intentionKind: kind } }); const nextTab = kind === "direction" ? "directions" : "outcomes"; setTab(nextTab); onTabChange?.(nextTab, selectedGoal.id); }} onUpdate={onUpdateGoal} onOpenRelated={onOpenRelated} /> : null}
  </section>;
}
