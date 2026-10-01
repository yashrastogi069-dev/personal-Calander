/** A read-only portfolio view over existing project and goal-milestone records. */
export type RoadmapResolution = "month" | "quarter" | "year";
export type RoadmapDateShape = "range" | "partial" | "undated";

export type RoadmapProject = {
  id: string;
  workspaceId: string;
  goalId?: string | null;
  title: string;
  state: string;
  version: number;
  startLocalDate?: string | null;
  dueLocalDate?: string | null;
  riskLevel?: "none" | "watch" | "at_risk" | "blocked" | null;
  riskNote?: string | null;
  nextReviewLocalDate?: string | null;
};

export type RoadmapMilestone = {
  id: string;
  workspaceId: string;
  goalId: string;
  title: string;
  state: string;
  startLocalDate?: string | null;
  dueLocalDate?: string | null;
};

export type RoadmapTask = {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  state: string;
  scheduledLocalDate?: string | null;
};

export type RoadmapProjectDependency = {
  id?: string;
  workspaceId: string;
  projectId: string;
  dependsOnProjectId: string;
  dependencyType: "hard" | "soft";
};

export type RoadmapCapabilities = { projectRisk: boolean; projectDependencies: boolean };
export type RoadmapProjectionInput = {
  workspaceId: string;
  todayLocalDate: string;
  /** Centers the bounded period viewport; defaults to todayLocalDate. */
  anchorLocalDate?: string;
  resolution: RoadmapResolution;
  projects: readonly RoadmapProject[];
  milestones: readonly RoadmapMilestone[];
  tasks?: readonly RoadmapTask[];
  projectDependencies?: readonly RoadmapProjectDependency[];
  capabilities?: Partial<RoadmapCapabilities>;
};

export type RoadmapItem = {
  kind: "project" | "milestone";
  id: string;
  workspaceId: string;
  title: string;
  state: string;
  goalId: string | null;
  projectIds: string[];
  startLocalDate: string | null;
  dueLocalDate: string | null;
  dateShape: RoadmapDateShape;
  /** Only actual start-and-due ranges have bars. */
  bar: { startLocalDate: string; endLocalDate: string } | null;
  overlapProjectIds: string[];
  dependencyIds: string[];
  blockedByProjectIds: string[];
  attention: Array<"explicit_risk" | "blocked" | "review_due" | "deadline_overdue" | "execution_gap">;
  explicitRisk: { level: NonNullable<RoadmapProject["riskLevel"]>; note: string | null } | null;
};

export type RoadmapPeriod = { key: string; startLocalDate: string; endLocalDate: string; items: RoadmapItem[] };
export type RoadmapProjection = {
  resolution: RoadmapResolution;
  periods: RoadmapPeriod[];
  windowStartLocalDate: string;
  windowEndLocalDate: string;
  /** Current and completed records; archived records are held separately. */
  items: RoadmapItem[];
  undated: RoadmapItem[];
  archived: RoadmapItem[];
  capabilities: RoadmapCapabilities;
};

export type RoadmapMovePreview = {
  projectId: string;
  expectedVersion: number;
  changes: Array<{ field: "startLocalDate" | "dueLocalDate"; before: string | null; after: string | null }>;
  unchanged: { goal: { id: string | null; fields: readonly ["startLocalDate", "dueLocalDate"] }; linkedTaskIds: string[]; linkedTaskFields: readonly ["scheduledLocalDate", "dueLocalDate", "plannedStartAt", "plannedEndAt"]; milestoneIds: string[]; milestoneFields: readonly ["startLocalDate", "dueLocalDate"] };
  dependencyConflicts: Array<{ projectId: string; dependsOnProjectId: string; reason: "prerequisite_finishes_after_start" }>;
  existingDependencyConflicts: Array<{ projectId: string; dependsOnProjectId: string; reason: "prerequisite_finishes_after_start" }>;
  milestoneEffects: Array<{ milestoneId: string; reason: "outside_proposed_project_dates" }>;
  errors: string[];
  apply: { id: string; expectedVersion: number; patch: Partial<Pick<RoadmapProject, "startLocalDate" | "dueLocalDate">> } | null;
};

export function validRoadmapLocalDate(value: string | null | undefined): boolean {
  if (value == null) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function assertDates(row: { startLocalDate?: string | null; dueLocalDate?: string | null }) {
  if (!validRoadmapLocalDate(row.startLocalDate) || !validRoadmapLocalDate(row.dueLocalDate)) throw new Error("Invalid roadmap date.");
  if (row.startLocalDate && row.dueLocalDate && row.startLocalDate > row.dueLocalDate) throw new Error("Roadmap start cannot follow due date.");
}

function assertWorkspace(workspaceId: string, rows: readonly { workspaceId: string }[]) {
  if (rows.some(row => row.workspaceId !== workspaceId)) throw new Error("Roadmap records must belong to one workspace.");
}

function periodFor(localDate: string, resolution: RoadmapResolution) {
  const year = Number(localDate.slice(0, 4));
  const paddedYear = String(year).padStart(4, "0");
  const month = Number(localDate.slice(5, 7));
  const firstMonth = resolution === "year" ? 1 : resolution === "quarter" ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  const endMonth = resolution === "year" ? 12 : resolution === "quarter" ? firstMonth + 2 : firstMonth;
  const startLocalDate = `${paddedYear}-${String(firstMonth).padStart(2, "0")}-01`;
  const endDate = new Date(`${paddedYear}-${String(endMonth).padStart(2, "0")}-01T00:00:00.000Z`);
  endDate.setUTCMonth(endMonth);
  endDate.setUTCDate(0);
  const endLocalDate = endDate.toISOString().slice(0, 10);
  const key = resolution === "year" ? paddedYear : resolution === "quarter" ? `${paddedYear}-Q${Math.floor((month - 1) / 3) + 1}` : `${paddedYear}-${String(month).padStart(2, "0")}`;
  return { key, startLocalDate, endLocalDate };
}

const ROADMAP_WINDOW_PERIODS: Record<RoadmapResolution, number> = { month: 12, quarter: 12, year: 8 };

function periodIndex(localDate: string, resolution: RoadmapResolution): number {
  const year = Number(localDate.slice(0, 4));
  const month = Number(localDate.slice(5, 7));
  return resolution === "year" ? year - 1 : resolution === "quarter" ? (year - 1) * 4 + Math.floor((month - 1) / 3) : (year - 1) * 12 + month - 1;
}

function periodAtIndex(index: number, resolution: RoadmapResolution) {
  const periodsPerYear = resolution === "year" ? 1 : resolution === "quarter" ? 4 : 12;
  const year = Math.floor(index / periodsPerYear) + 1;
  const month = resolution === "year" ? 1 : resolution === "quarter" ? (index % 4) * 3 + 1 : index % 12 + 1;
  return periodFor(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`, resolution);
}

function dateShape(row: { startLocalDate?: string | null; dueLocalDate?: string | null }): RoadmapDateShape {
  return row.startLocalDate && row.dueLocalDate ? "range" : row.startLocalDate || row.dueLocalDate ? "partial" : "undated";
}

/** Rejects missing, cross-workspace, self, and cyclic project dependencies. */
export function validateProjectDependency(input: { workspaceId: string; projectId: string; dependsOnProjectId: string; projects: readonly RoadmapProject[]; dependencies: readonly RoadmapProjectDependency[] }): string[] {
  const { workspaceId, projectId, dependsOnProjectId, projects, dependencies } = input;
  const errors: string[] = [];
  const source = projects.find(project => project.id === projectId);
  const target = projects.find(project => project.id === dependsOnProjectId);
  if (!source || !target) errors.push("Both projects must exist.");
  if (source?.workspaceId !== workspaceId || target?.workspaceId !== workspaceId) errors.push("Projects must belong to the same workspace.");
  if (projectId === dependsOnProjectId) errors.push("A project cannot depend on itself.");
  if (dependencies.some(edge => edge.workspaceId === workspaceId && edge.projectId === projectId && edge.dependsOnProjectId === dependsOnProjectId)) errors.push("Project dependency already exists.");
  if (dependencies.some(edge => edge.workspaceId !== workspaceId)) errors.push("Dependencies must belong to the same workspace.");
  const seen = new Set<string>();
  const visit = (id: string): boolean => {
    if (id === projectId) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return dependencies.some(edge => edge.workspaceId === workspaceId && edge.projectId === id && visit(edge.dependsOnProjectId));
  };
  if (visit(dependsOnProjectId)) errors.push("Project dependencies cannot form a cycle.");
  return Array.from(new Set(errors));
}

/** Creates a bounded, contiguous viewport without modifying or inventing planner records. */
export function roadmapProjection(input: RoadmapProjectionInput): RoadmapProjection {
  const { workspaceId, projects, milestones, tasks, projectDependencies, resolution, todayLocalDate } = input;
  if (!validRoadmapLocalDate(todayLocalDate) || !todayLocalDate) throw new Error("Invalid roadmap date.");
  const anchorLocalDate = input.anchorLocalDate ?? todayLocalDate;
  if (!validRoadmapLocalDate(anchorLocalDate) || !anchorLocalDate) throw new Error("Invalid roadmap date.");
  assertWorkspace(workspaceId, [...projects, ...milestones, ...(tasks ?? []), ...(projectDependencies ?? [])]);
  [...projects, ...milestones].forEach(assertDates);
  const capabilities = { projectRisk: input.capabilities?.projectRisk ?? false, projectDependencies: input.capabilities?.projectDependencies ?? false };
  const dependencies = capabilities.projectDependencies ? projectDependencies ?? [] : [];
  const activeTasks = tasks?.filter(task => task.state !== "completed" && task.state !== "archived") ?? [];
  const items: RoadmapItem[] = [];
  for (const project of projects) {
    const start = project.startLocalDate ?? null;
    const due = project.dueLocalDate ?? null;
    const active = project.state !== "completed" && project.state !== "archived";
    const overlaps = projects.filter(other => other.id !== project.id && start && due && other.startLocalDate && other.dueLocalDate && start <= other.dueLocalDate && due >= other.startLocalDate).map(other => other.id);
    const blockedBy = dependencies.filter(edge => edge.projectId === project.id && edge.dependencyType === "hard" && projects.find(item => item.id === edge.dependsOnProjectId)?.state !== "completed").map(edge => edge.dependsOnProjectId);
    const attention: RoadmapItem["attention"] = [];
    const explicitRisk = capabilities.projectRisk && project.riskLevel && project.riskLevel !== "none" ? { level: project.riskLevel, note: project.riskNote ?? null } : null;
    if (explicitRisk) attention.push("explicit_risk");
    if (project.state === "blocked" || blockedBy.length) attention.push("blocked");
    if (active && capabilities.projectRisk && project.nextReviewLocalDate && project.nextReviewLocalDate <= todayLocalDate) attention.push("review_due");
    if (active && due && due < todayLocalDate) attention.push("deadline_overdue");
    if (active && tasks && !activeTasks.some(task => task.projectId === project.id && task.scheduledLocalDate)) attention.push("execution_gap");
    items.push({ kind: "project", id: project.id, workspaceId, title: project.title, state: project.state, goalId: project.goalId ?? null, projectIds: [project.id], startLocalDate: start, dueLocalDate: due, dateShape: dateShape(project), bar: start && due ? { startLocalDate: start, endLocalDate: due } : null, overlapProjectIds: overlaps, dependencyIds: dependencies.filter(edge => edge.projectId === project.id).map(edge => edge.dependsOnProjectId), blockedByProjectIds: blockedBy, attention, explicitRisk });
  }
  for (const milestone of milestones) {
    const start = milestone.startLocalDate ?? null;
    const due = milestone.dueLocalDate ?? null;
    const active = milestone.state !== "completed" && milestone.state !== "archived";
    items.push({ kind: "milestone", id: milestone.id, workspaceId, title: milestone.title, state: milestone.state, goalId: milestone.goalId, projectIds: projects.filter(project => project.goalId === milestone.goalId).map(project => project.id), startLocalDate: start, dueLocalDate: due, dateShape: dateShape(milestone), bar: start && due ? { startLocalDate: start, endLocalDate: due } : null, overlapProjectIds: [], dependencyIds: [], blockedByProjectIds: [], attention: active && due && due < todayLocalDate ? ["deadline_overdue"] : [], explicitRisk: null });
  }
  const activeItems = items.filter(item => item.state !== "archived");
  const archived = items.filter(item => item.state === "archived");
  const periodCount = ROADMAP_WINDOW_PERIODS[resolution];
  const periodsPerYear = resolution === "year" ? 1 : resolution === "quarter" ? 4 : 12;
  const lastWindowStart = 9999 * periodsPerYear - periodCount;
  const windowStartIndex = Math.min(Math.max(periodIndex(anchorLocalDate, resolution) - Math.floor((periodCount - 1) / 2), 0), lastWindowStart);
  const periods: RoadmapPeriod[] = Array.from({ length: periodCount }, (_, offset) => ({ ...periodAtIndex(windowStartIndex + offset, resolution), items: [] }));
  for (const item of activeItems) {
    const first = item.startLocalDate ?? item.dueLocalDate;
    const last = item.dueLocalDate ?? item.startLocalDate;
    if (!first || !last) continue;
    for (const period of periods) {
      if (first <= period.endLocalDate && last >= period.startLocalDate) period.items.push(item);
    }
  }
  return { resolution, periods, windowStartLocalDate: periods[0].startLocalDate, windowEndLocalDate: periods[periods.length - 1].endLocalDate, items: activeItems, undated: activeItems.filter(item => item.dateShape === "undated"), archived, capabilities };
}

/** Reviews a project date move. Related records are named, never included in the patch. */
export function previewRoadmapMove(input: { workspaceId: string; project: RoadmapProject; projects: readonly RoadmapProject[]; milestones?: readonly RoadmapMilestone[]; tasks?: readonly RoadmapTask[]; projectDependencies?: readonly RoadmapProjectDependency[]; expectedVersion: number; startLocalDate: string | null; dueLocalDate: string | null }): RoadmapMovePreview {
  const { workspaceId, project, projects, expectedVersion } = input;
  const start = input.startLocalDate;
  const due = input.dueLocalDate;
  const errors: string[] = [];
  if (project.workspaceId !== workspaceId || projects.some(row => row.workspaceId !== workspaceId) || (input.milestones ?? []).some(row => row.workspaceId !== workspaceId) || (input.tasks ?? []).some(row => row.workspaceId !== workspaceId)) errors.push("Roadmap records must belong to one workspace.");
  const snapshotProject = projects.find(row => row.id === project.id);
  if (!snapshotProject) errors.push("Project must be present in the workspace snapshot.");
  else if (snapshotProject.version !== project.version) errors.push("The project changed since this preview. Review it again.");
  if (project.version !== expectedVersion) errors.push("The project changed since this preview. Review it again.");
  if (!validRoadmapLocalDate(start) || !validRoadmapLocalDate(due)) errors.push("Choose valid calendar dates.");
  if (start && due && start > due) errors.push("Project start cannot follow due date.");
  const dependencies = input.projectDependencies ?? [];
  for (const edge of dependencies) {
    if (edge.workspaceId !== workspaceId) errors.push("Dependencies must belong to the same workspace.");
    if (edge.projectId === edge.dependsOnProjectId) errors.push("A project cannot depend on itself.");
    if (!projects.some(row => row.id === edge.projectId) || !projects.some(row => row.id === edge.dependsOnProjectId)) errors.push("Both dependency projects must exist.");
  }
  const projectEdges = dependencies.filter(edge => edge.projectId === project.id);
  for (const edge of projectEdges) errors.push(...validateProjectDependency({ workspaceId, projectId: edge.projectId, dependsOnProjectId: edge.dependsOnProjectId, projects, dependencies: dependencies.filter(candidate => candidate !== edge) }).filter(message => message.includes("cycle")));
  const changes: RoadmapMovePreview["changes"] = [];
  if ((project.startLocalDate ?? null) !== start) changes.push({ field: "startLocalDate", before: project.startLocalDate ?? null, after: start });
  if ((project.dueLocalDate ?? null) !== due) changes.push({ field: "dueLocalDate", before: project.dueLocalDate ?? null, after: due });
  const dependencyConflicts: RoadmapMovePreview["dependencyConflicts"] = [];
  const existingDependencyConflicts: RoadmapMovePreview["existingDependencyConflicts"] = [];
  for (const edge of dependencies.filter(edge => edge.dependencyType === "hard")) {
    const dependent = projects.find(row => row.id === edge.projectId);
    const prerequisite = projects.find(row => row.id === edge.dependsOnProjectId);
    if (!dependent || !prerequisite || (dependent.id !== project.id && prerequisite.id !== project.id)) continue;
    const dependentStart = dependent.id === project.id ? start : dependent.startLocalDate;
    const prerequisiteDue = prerequisite.id === project.id ? due : prerequisite.dueLocalDate;
    const previousConflict = Boolean(dependent.startLocalDate && prerequisite.dueLocalDate && prerequisite.dueLocalDate > dependent.startLocalDate);
    if (dependentStart && prerequisiteDue && prerequisiteDue > dependentStart) {
      const conflict = { projectId: dependent.id, dependsOnProjectId: prerequisite.id, reason: "prerequisite_finishes_after_start" as const };
      (previousConflict ? existingDependencyConflicts : dependencyConflicts).push(conflict);
    }
  }
  const linkedMilestones = (input.milestones ?? []).filter(row => project.goalId && row.goalId === project.goalId);
  const milestoneEffects: RoadmapMovePreview["milestoneEffects"] = linkedMilestones.filter(row => [row.startLocalDate, row.dueLocalDate].some(date => date && ((start && date < start) || (due && date > due)))).map(row => ({ milestoneId: row.id, reason: "outside_proposed_project_dates" }));
  const patch: NonNullable<RoadmapMovePreview["apply"]>["patch"] = {};
  for (const change of changes) patch[change.field] = change.after;
  return { projectId: project.id, expectedVersion, changes, unchanged: { goal: { id: project.goalId ?? null, fields: ["startLocalDate", "dueLocalDate"] }, linkedTaskIds: (input.tasks ?? []).filter(task => task.projectId === project.id).map(task => task.id), linkedTaskFields: ["scheduledLocalDate", "dueLocalDate", "plannedStartAt", "plannedEndAt"], milestoneIds: linkedMilestones.map(row => row.id), milestoneFields: ["startLocalDate", "dueLocalDate"] }, dependencyConflicts, existingDependencyConflicts, milestoneEffects, errors: Array.from(new Set(errors)), apply: errors.length || !changes.length ? null : { id: project.id, expectedVersion, patch } };
}
