import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type { WorkspaceScope } from "@/lib/workspace";
import { dependencyExecutionState } from "@shared/dependencyPolicy";
import { CircleAlert, CircleCheck, GitBranch, Link2, ListTodo, LockKeyhole, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ProjectExecutionWorkspaceProps = { scope: WorkspaceScope; snapshot: any; onOpenTasks: () => void };

function meta(task: any) {
  return [task.estimateMinutes ? `${task.estimateMinutes}m` : null, task.scheduledLocalDate ? `Plan for ${task.scheduledLocalDate}` : null, task.dueLocalDate ? `Deadline ${task.dueLocalDate}` : null].filter(Boolean).join(" · ") || "No date or effort set";
}

export function ProjectExecutionWorkspace({ scope, snapshot, onOpenTasks }: ProjectExecutionWorkspaceProps) {
  const utils = trpc.useUtils();
  const activeProjects = (snapshot.projects ?? []).filter((project: any) => project.state !== "archived" && !project.archivedAt);
  const allTasks = (snapshot.tasks ?? []).filter((task: any) => task.state !== "archived" && task.outcome !== "wont_do");
  const edges = snapshot.taskDependencies ?? [];
  const [projectId, setProjectId] = useState(activeProjects[0]?.id ?? "none");
  const [taskId, setTaskId] = useState("none");
  const [prerequisiteId, setPrerequisiteId] = useState("none");
  const [type, setType] = useState<"hard" | "soft">("hard");
  const [error, setError] = useState<string | null>(null);
  const project = activeProjects.find((item: any) => item.id === projectId) ?? activeProjects[0];
  const projectTasks = useMemo(() => allTasks.filter((task: any) => task.projectId === project?.id), [allTasks, project?.id]);
  const taskById = useMemo(() => new Map(allTasks.map((task: any) => [task.id, task])), [allTasks]);
  const states = useMemo(() => new Map<string, ReturnType<typeof dependencyExecutionState>>(projectTasks.map((task: any) => [task.id, dependencyExecutionState(task.id, edges, allTasks)])), [projectTasks, edges, allTasks]);
  const ready = projectTasks.filter((task: any) => task.state !== "completed" && !states.get(task.id)?.isBlocked && task.state !== "blocked");
  const waiting = projectTasks.filter((task: any) => task.state !== "completed" && (states.get(task.id)?.isBlocked || task.state === "blocked"));
  const done = projectTasks.filter((task: any) => task.state === "completed");
  const refresh = () => { utils.planner.workspace.snapshot.invalidate(); utils.planner.dashboard.invalidate(); };
  const add = trpc.planner.task.addDependency.useMutation({ onSuccess: () => { setError(null); refresh(); toast.success("Dependency linked."); }, onError: mutationError => setError(mutationError.message || "Dependency could not be linked.") });
  const remove = trpc.planner.task.removeDependency.useMutation({ onSuccess: () => { setError(null); refresh(); toast.success("Dependency removed."); }, onError: mutationError => setError(mutationError.message || "Dependency could not be removed.") });
  useEffect(() => { if (!projectTasks.some((task: any) => task.id === taskId)) setTaskId(projectTasks[0]?.id ?? "none"); }, [projectTasks, taskId]);
  useEffect(() => { if (prerequisiteId === taskId || !allTasks.some((task: any) => task.id === prerequisiteId)) setPrerequisiteId(allTasks.find((task: any) => task.id !== taskId)?.id ?? "none"); }, [allTasks, prerequisiteId, taskId]);
  const createLink = () => { if (taskId === "none" || prerequisiteId === "none") { setError("Choose both the dependent task and its prerequisite."); return; } setError(null); add.mutate({ ...scope, taskId, dependsOnTaskId: prerequisiteId, dependencyType: type }); };
  return <section className="project-execution" aria-labelledby="project-execution-heading"><header className="project-execution-header"><div><h2 id="project-execution-heading">Project execution</h2><p>A project is finite work that advances a goal. Keep the next action clear, and make real sequencing visible before it becomes a blocker.</p></div><GitBranch size={29} aria-hidden="true" /></header>{!activeProjects.length ? <div className="project-execution-empty"><p>Create a project to group a finite body of work, then link its tasks here.</p><Button type="button" onClick={onOpenTasks}>Open task workbench</Button></div> : <><div className="project-execution-controls"><label htmlFor="execution-project">Project<select id="execution-project" value={project?.id ?? "none"} onChange={event => setProjectId(event.target.value)}>{activeProjects.map((item: any) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><div><span>Project state</span><strong>{project?.state.replace("_", " ")}</strong></div><div><span>Task completion</span><strong>{done.length} of {projectTasks.length}</strong></div><Button type="button" variant="ghost" onClick={onOpenTasks}><ListTodo size={15} /> Task workbench</Button></div>{error ? <div className="project-execution-error" role="alert"><CircleAlert size={16} /><span>{error}</span><button type="button" onClick={() => setError(null)} aria-label="Dismiss dependency message">×</button></div> : null}<div className="execution-lanes"><ExecutionLane title="Ready next" detail="No unfinished hard prerequisite" icon={<CircleCheck size={16} />} tasks={ready} taskById={taskById} stateByTaskId={states} edges={edges} onRemove={(edge: any) => remove.mutate({ ...scope, id: edge.id })} pending={remove.isPending} /><ExecutionLane title="Waiting" detail="Blocked or depends on work not finished" icon={<LockKeyhole size={16} />} tasks={waiting} taskById={taskById} stateByTaskId={states} edges={edges} onRemove={(edge: any) => remove.mutate({ ...scope, id: edge.id })} pending={remove.isPending} /><ExecutionLane title="Completed" detail="Finished project work" icon={<CircleCheck size={16} />} tasks={done} taskById={taskById} stateByTaskId={states} edges={edges} onRemove={(edge: any) => remove.mutate({ ...scope, id: edge.id })} pending={remove.isPending} /></div><section className="dependency-linker" aria-labelledby="dependency-linker-heading"><div><h3 id="dependency-linker-heading">Make a sequence explicit</h3><p><b>Hard</b> links prevent completion until the prerequisite is done. <b>Soft</b> links are visible context only.</p></div><div className="dependency-linker-fields"><label>Task<select value={taskId} onChange={event => setTaskId(event.target.value)}><option value="none">Choose a project task</option>{projectTasks.filter((task: any) => task.state !== "completed").map((task: any) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label>Depends on<select value={prerequisiteId} onChange={event => setPrerequisiteId(event.target.value)}><option value="none">Choose prerequisite</option>{allTasks.filter((task: any) => task.id !== taskId).slice(0, 100).map((task: any) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label>Link type<select value={type} onChange={event => setType(event.target.value as "hard" | "soft")}><option value="hard">Hard prerequisite</option><option value="soft">Soft context</option></select></label><Button type="button" onClick={createLink} disabled={add.isPending}><Link2 size={15} /> {add.isPending ? "Linking…" : "Add link"}</Button></div></section></>}</section>;
}

function ExecutionLane({ title, detail, icon, tasks, taskById, stateByTaskId, edges, onRemove, pending }: any) {
  return <section className={cn("execution-lane", title === "Waiting" && "is-waiting", title === "Completed" && "is-completed")}><header><div>{icon}<div><h3>{title}</h3><p>{detail}</p></div></div><span>{tasks.length}</span></header>{tasks.length ? <div className="execution-task-list">{tasks.map((task: any) => { const state = stateByTaskId.get(task.id); const inbound = edges.filter((edge: any) => edge.taskId === task.id); return <article key={task.id}><div><strong>{task.title}</strong><small>{meta(task)}</small>{state?.blockedByIds.length ? <p><LockKeyhole size={12} /> Waiting for {state.blockedByIds.map((id: string) => taskById.get(id)?.title ?? "missing task").join(", ")}</p> : null}</div>{inbound.length ? <div className="execution-links">{inbound.map((edge: any) => <button type="button" key={edge.id} onClick={() => onRemove(edge)} disabled={pending} title={`Remove ${edge.dependencyType} link to ${taskById.get(edge.dependsOnTaskId)?.title ?? "prerequisite"}`}><span>{edge.dependencyType === "hard" ? "Hard" : "Soft"}: {taskById.get(edge.dependsOnTaskId)?.title ?? "Missing task"}</span><Trash2 size={12} /></button>)}</div> : null}</article>; })}</div> : <p className="execution-lane-empty">No project tasks in this state.</p>}</section>;
}
