import { goals, projects, workspaces } from "../drizzle/schema";

// Phase 4 product fields are additive and deliberately await a separately
// approved migration. Reads must remain safe for an established workspace
// while that migration has not been applied.
export const establishedWorkspaceColumns = {
  id: workspaces.id,
  ownerUserId: workspaces.ownerUserId,
  name: workspaces.name,
  timezone: workspaces.timezone,
  weekStartsOn: workspaces.weekStartsOn,
  dailyCapacityMinutes: workspaces.dailyCapacityMinutes,
  planningDayStartsAt: workspaces.planningDayStartsAt,
  workdayStartsAt: workspaces.workdayStartsAt,
  workdayEndsAt: workspaces.workdayEndsAt,
  defaultBreakMinutes: workspaces.defaultBreakMinutes,
  preferredShutdownAt: workspaces.preferredShutdownAt,
  createdAt: workspaces.createdAt,
  updatedAt: workspaces.updatedAt,
  version: workspaces.version,
} as const;

export const establishedGoalColumns = {
  id: goals.id,
  workspaceId: goals.workspaceId,
  categoryId: goals.categoryId,
  parentGoalId: goals.parentGoalId,
  title: goals.title,
  description: goals.description,
  state: goals.state,
  priority: goals.priority,
  horizon: goals.horizon,
  color: goals.color,
  progressMode: goals.progressMode,
  progressValue: goals.progressValue,
  targetValue: goals.targetValue,
  startLocalDate: goals.startLocalDate,
  dueLocalDate: goals.dueLocalDate,
  completedAt: goals.completedAt,
  archivedAt: goals.archivedAt,
  createdAt: goals.createdAt,
  updatedAt: goals.updatedAt,
  version: goals.version,
} as const;

export const establishedProjectColumns = {
  id: projects.id,
  workspaceId: projects.workspaceId,
  goalId: projects.goalId,
  categoryId: projects.categoryId,
  title: projects.title,
  description: projects.description,
  state: projects.state,
  priority: projects.priority,
  horizon: projects.horizon,
  startLocalDate: projects.startLocalDate,
  dueLocalDate: projects.dueLocalDate,
  completedAt: projects.completedAt,
  archivedAt: projects.archivedAt,
  createdAt: projects.createdAt,
  updatedAt: projects.updatedAt,
  version: projects.version,
} as const;
