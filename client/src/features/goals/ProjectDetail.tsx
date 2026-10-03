import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { WorkspaceScope } from "@/lib/workspace";
import { ProjectExecutionWorkspace } from "@/features/projects/ProjectExecutionWorkspace";
import { RoadmapWorkspace } from "./RoadmapWorkspace";
import "./project-detail.css";

type Project = {
  id: string;
  title: string;
  description?: string | null;
  goalId?: string | null;
  state: string;
  archivedAt?: string | null;
  horizon?: string | null;
  startLocalDate?: string | null;
  dueLocalDate?: string | null;
  riskLevel?: string | null;
  riskNote?: string | null;
  nextReviewLocalDate?: string | null;
};

type ProjectTask = {
  id: string;
  projectId?: string | null;
  title: string;
  state: string;
  outcome?: string | null;
  scheduledLocalDate?: string | null;
  dueLocalDate?: string | null;
  estimateMinutes?: number | null;
};

export type ProjectDetailProps = {
  projectId: string;
  scope: WorkspaceScope;
  snapshot: any;
  todayLocalDate: string;
  isOnline: boolean;
  onBack: () => void;
  onOpenTasks: () => void;
  onOpenTask?: (id: string) => void;
  onBreakDown: (project: Project) => void;
  onSelectProject?: (id: string) => void;
  onOpenGoal?: (goalId: string) => void;
  onApplyMove?: (input: { id: string; expectedVersion: number; patch: { startLocalDate?: string | null; dueLocalDate?: string | null } }) => Promise<unknown>;
};

type DetailTab = "overview" | "list" | "board" | "timeline";

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "list", label: "List" },
  { id: "board", label: "Board" },
  { id: "timeline", label: "Timeline" },
];

function dateText(value: string | null | undefined) {
  return value || "Not set";
}

function stateText(value: string) {
  return value.replaceAll("_", " ");
}

export function ArchivedProjectReturn({ onBack }: { onBack: () => void }) {
  return <button type="button" className="project-detail-back" onClick={onBack}><ArrowLeft size={16} aria-hidden="true" /> All projects</button>;
}

export function ProjectDetail({ projectId, scope, snapshot, todayLocalDate, isOnline, onBack, onOpenTasks, onOpenTask, onBreakDown, onSelectProject, onOpenGoal, onApplyMove }: ProjectDetailProps) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const project = (snapshot.projects as Project[] | undefined)?.find(item => item.id === projectId);
  const tasks = useMemo(() => ((snapshot.tasks ?? []) as ProjectTask[]).filter(item => item.projectId === projectId), [snapshot.tasks, projectId]);
  const visibleTasks = tasks.filter(item => item.state !== "archived" && item.outcome !== "wont_do");
  const openTasks = visibleTasks.filter(item => item.state !== "completed");
  const completedTasks = visibleTasks.filter(item => item.state === "completed");
  const goal = project?.goalId ? (snapshot.goals ?? []).find((item: { id: string }) => item.id === project.goalId) : null;
  const dependencies = (snapshot.projectDependencies ?? []).filter((edge: { projectId: string }) => edge.projectId === projectId);
  const projectName = (id: string) => (snapshot.projects ?? []).find((item: Project) => item.id === id)?.title ?? "Unavailable project";

  if (!project) return <section className="project-detail" aria-label="Project detail"><p className="project-detail-empty">This project is unavailable in the current workspace snapshot.</p><button type="button" className="project-detail-button" onClick={onBack}>All projects</button></section>;

  const isArchived = project.state === "archived" || Boolean(project.archivedAt);

  return <section className="project-detail" aria-labelledby="project-detail-heading">
    <header className="project-detail-header">
      <div className="project-detail-heading">
        {isArchived ? <ArchivedProjectReturn onBack={onBack} /> : null}
        <h2 id="project-detail-heading">{project.title}</h2>
        {project.description ? <p>{project.description}</p> : null}
        <div className="project-detail-summary" aria-label="Project summary">
          <span>State: {stateText(project.state)}</span>
          <span>{openTasks.length} active task{openTasks.length === 1 ? "" : "s"}</span>
          {project.dueLocalDate ? <span>Due {project.dueLocalDate}</span> : null}
          {project.nextReviewLocalDate ? <span>Review {project.nextReviewLocalDate}</span> : null}
        </div>
      </div>
      <button type="button" className="project-detail-button is-primary" onClick={() => onBreakDown(project)}>Break down project</button>
    </header>

    <nav className="project-detail-tabs" aria-label={`${project.title} views`}>
      {tabs.map(item => <button key={item.id} type="button" className={tab === item.id ? "is-active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => setTab(item.id)}>{item.label}</button>)}
    </nav>

    {tab === "overview" ? <div className="project-detail-overview">
      <section className="project-detail-panel" aria-labelledby="project-detail-facts-heading">
        <h3 id="project-detail-facts-heading">At a glance</h3>
        <dl className="project-detail-facts">
          <div><dt>Status</dt><dd>{stateText(project.state)}</dd></div>
          <div><dt>Start</dt><dd>{dateText(project.startLocalDate)}</dd></div>
          <div><dt>Due</dt><dd>{dateText(project.dueLocalDate)}</dd></div>
          <div><dt>Task progress</dt><dd>{completedTasks.length} of {visibleTasks.length} completed</dd></div>
          {project.horizon ? <div><dt>Horizon</dt><dd>{project.horizon}</dd></div> : null}
          {project.nextReviewLocalDate ? <div><dt>Next review</dt><dd>{project.nextReviewLocalDate}</dd></div> : null}
        </dl>
      </section>
      <section className="project-detail-panel" aria-labelledby="project-detail-linked-heading">
        <h3 id="project-detail-linked-heading">Linked work</h3>
        {goal ? <p>Goal: {onOpenGoal ? <button type="button" className="project-detail-link" onClick={() => onOpenGoal(goal.id)}>{goal.title}</button> : <strong>{goal.title}</strong>}</p> : <p>No linked goal.</p>}
        <p>{openTasks.length} active task{openTasks.length === 1 ? "" : "s"} in this project.</p>
        {openTasks.length ? <ul>{openTasks.slice(0, 4).map(item => <li key={item.id}>{item.title}</li>)}</ul> : null}
        <button type="button" className="project-detail-button" onClick={() => setTab("list")}>See project tasks</button>
      </section>
      {(project.riskLevel && project.riskLevel !== "none") || dependencies.length ? <section className="project-detail-panel" aria-labelledby="project-detail-risks-heading">
        <h3 id="project-detail-risks-heading">Risks and dependencies</h3>
        {project.riskLevel && project.riskLevel !== "none" ? <p><strong>{stateText(project.riskLevel)}</strong>{project.riskNote ? ` · ${project.riskNote}` : ""}</p> : null}
        {dependencies.length ? <ul>{dependencies.map((edge: { id?: string; dependsOnProjectId: string; dependencyType: string }, index: number) => <li key={edge.id ?? `${edge.dependsOnProjectId}:${index}`}>{edge.dependencyType === "hard" ? "Waiting for" : "Related to"} {projectName(edge.dependsOnProjectId)}</li>)}</ul> : null}
      </section> : null}
    </div> : null}

    {tab === "list" ? <section className="project-detail-panel" aria-labelledby="project-detail-list-heading">
      <div className="project-detail-section-heading"><div><h3 id="project-detail-list-heading">Project tasks</h3><p>These are the existing tasks linked to this project.</p></div><button type="button" className="project-detail-button" onClick={onOpenTasks}>Open task workbench</button></div>
      {tasks.length ? <ul className="project-detail-task-list">{tasks.map(item => <li key={item.id}>{onOpenTask ? <button type="button" className="project-detail-task" onClick={() => onOpenTask(item.id)}><span><strong>{item.title}</strong><small>{item.scheduledLocalDate ? `Plan for ${item.scheduledLocalDate}` : "Not scheduled"}{item.dueLocalDate ? ` · Due ${item.dueLocalDate}` : ""}</small></span><span className="project-detail-task-state">{stateText(item.state)}</span></button> : <div className="project-detail-task"><span><strong>{item.title}</strong><small>{item.scheduledLocalDate ? `Plan for ${item.scheduledLocalDate}` : "Not scheduled"}{item.dueLocalDate ? ` · Due ${item.dueLocalDate}` : ""}</small></span><span className="project-detail-task-state">{stateText(item.state)}</span></div>}</li>)}</ul> : <p className="project-detail-empty">No tasks are linked to this project yet. Use the task workbench to add or link work.</p>}
    </section> : null}

    {tab === "board" ? isArchived ? <section className="project-detail-panel" aria-labelledby="project-detail-archived-board-heading">
      <h3 id="project-detail-archived-board-heading">Archived project board</h3>
      <p>This project is archived, so its execution board is read-only. Its tasks and dates remain available here; restore the project from Settings → Recycle Bin to manage its board again.</p>
      <p>{tasks.length} linked task{tasks.length === 1 ? "" : "s"} remain in this project.</p>
      <button type="button" className="project-detail-button" onClick={() => setTab("list")}>View this project's tasks</button>
    </section> : <ProjectExecutionWorkspace scope={scope} snapshot={snapshot} selectedProjectId={project.id} onProjectSelect={onSelectProject} onOpenTasks={onOpenTasks} /> : null}

    {tab === "timeline" ? <RoadmapWorkspace snapshot={snapshot} workspaceId={scope.workspaceId} todayLocalDate={todayLocalDate} selectedProjectId={project.id} isOnline={isOnline} onOpenTask={onOpenTask} onApplyMove={onApplyMove} /> : null}
  </section>;
}
