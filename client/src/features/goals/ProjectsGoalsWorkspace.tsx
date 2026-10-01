import { intentionPresentation, type GoalIntentionRecord } from "@shared/goalIntentions";
import { ArrowRight, Compass, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { IntentionDetail } from "./IntentionDetail";
import "./intention.css";

type Goal = GoalIntentionRecord & { id: string; state?: string; horizon?: string; color?: string | null; categoryId?: string | null };

export function ProjectsGoalsWorkspace({ goals, projects, onOpenProject }: { goals: Goal[]; projects: any[]; onOpenProject?: (project: any) => void }) {
  const [tab, setTab] = useState<"projects" | "outcomes" | "directions">("outcomes");
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const activeGoals = useMemo(() => goals.filter(goal => goal.state !== "archived"), [goals]);
  const outcomes = activeGoals.filter(goal => goal.intentionKind === "outcome" || !goal.intentionKind);
  const directions = activeGoals.filter(goal => goal.intentionKind === "direction");
  const records = tab === "projects" ? projects.filter(project => project.state !== "archived") : tab === "directions" ? directions : outcomes;
  const selectedGoal = activeGoals.find(goal => goal.id === selectedGoalId);

  return <section className="intentions-workspace" aria-labelledby="intentions-heading">
    <header className="intentions-header"><div><span className="eyebrow">Projects &amp; Goals</span><h2 id="intentions-heading">Give long work the right shape.</h2><p>Outcomes describe what should become true. Directions keep a durable standard without forcing every season into a score.</p></div><Compass size={28} aria-hidden="true" /></header>
    <nav className="intentions-tabs" aria-label="Projects and goals views" role="tablist">
      {([['projects', 'Projects'], ['outcomes', 'Outcome goals'], ['directions', 'Directions']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={tab === value} className={cn(tab === value && "is-active")} onClick={() => setTab(value)}>{label}<small>{value === "projects" ? projects.filter(project => project.state !== "archived").length : value === "directions" ? directions.length : outcomes.length}</small></button>)}
    </nav>
    <div className="intentions-list">
      {records.length ? records.slice(0, 12).map(record => tab === "projects" ? <button type="button" className="intention-card project-card" key={record.id} onClick={() => onOpenProject?.(record)}><span className="intention-card-icon"><ArrowRight size={16} /></span><span><strong>{record.title}</strong><small>{record.horizon ?? "project"}{record.dueLocalDate ? ` · due ${record.dueLocalDate}` : " · no deadline"}</small></span><ArrowRight size={16} /></button> : <button type="button" className={cn("intention-card", selectedGoalId === record.id && "is-selected")} key={record.id} onClick={() => setSelectedGoalId(record.id)}><span className="intention-card-icon">{record.intentionKind === "direction" ? <Compass size={16} /> : <Target size={16} />}</span><span><strong>{record.title}</strong><small>{intentionPresentation(record).summary}</small>{intentionPresentation(record).details.map(detail => <span className="intention-detail-line" key={detail.label}><b>{detail.label}:</b> {detail.value}</span>)}</span><span className="intention-kind">{intentionPresentation(record).label}</span></button>) : <p className="intentions-empty">Nothing here yet. Existing records remain available through the full Goals and Projects tools below.</p>}
    </div>
    {tab !== "projects" && selectedGoal ? <IntentionDetail goal={selectedGoal} /> : null}
  </section>;
}
