import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

// PostgreSQL text-backed enums preserve the existing TypeScript contracts while
// keeping this first migration additive. Runtime validation remains in the
// planner procedures; database CHECK constraints can be added after the
// generated schema has passed the full regression suite.
const enumText = <const T extends readonly string[]>(name: string, values: T) => text(name).$type<T[number]>();

export const lifecycleStates = ["not_started", "in_progress", "blocked", "completed", "archived"] as const;
export const priorities = ["none", "low", "medium", "high", "critical"] as const;
export const horizons = ["daily", "weekly", "monthly", "quarterly", "yearly", "someday"] as const;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: enumText("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const workspaces = pgTable("workspaces", {
  id: varchar("id", { length: 64 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull().default("My planning workspace"),
  timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
  weekStartsOn: integer("weekStartsOn").notNull().default(1),
  dailyCapacityMinutes: integer("dailyCapacityMinutes").notNull().default(360),
  planningDayStartsAt: varchar("planningDayStartsAt", { length: 5 }).notNull().default("06:00"),
  workdayStartsAt: varchar("workdayStartsAt", { length: 5 }).notNull().default("09:00"),
  workdayEndsAt: varchar("workdayEndsAt", { length: 5 }).notNull().default("17:00"),
  defaultBreakMinutes: integer("defaultBreakMinutes").notNull().default(30),
  preferredShutdownAt: varchar("preferredShutdownAt", { length: 5 }).notNull().default("17:30"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  version: integer("version").notNull().default(1),
});

export const categories = pgTable(
  "categories",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    color: varchar("color", { length: 16 }).notNull(),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("categories_workspace_idx").on(table.workspaceId),
    uniqueIndex("categories_workspace_name_unique").on(table.workspaceId, table.name),
  ]
);

export const goals = pgTable(
  "goals",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    categoryId: varchar("categoryId", { length: 64 }),
    parentGoalId: varchar("parentGoalId", { length: 64 }),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description"),
    state: enumText("state", lifecycleStates).notNull().default("not_started"),
    priority: enumText("priority", priorities).notNull().default("medium"),
    horizon: enumText("horizon", horizons).notNull().default("yearly"),
    color: varchar("color", { length: 16 }),
    progressMode: enumText("progressMode", ["manual", "task", "measure", "habit"]).notNull().default("task"),
    progressValue: integer("progressValue").notNull().default(0),
    targetValue: integer("targetValue").notNull().default(100),
    startLocalDate: varchar("startLocalDate", { length: 10 }),
    dueLocalDate: varchar("dueLocalDate", { length: 10 }),
    completedAt: timestamp("completedAt"),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("goals_workspace_state_idx").on(table.workspaceId, table.state),
    index("goals_workspace_horizon_idx").on(table.workspaceId, table.horizon),
    index("goals_parent_idx").on(table.parentGoalId),
  ]
);

export const goalMilestones = pgTable(
  "goalMilestones",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    goalId: varchar("goalId", { length: 64 }).notNull(),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description"),
    state: enumText("state", lifecycleStates).notNull().default("not_started"),
    horizon: enumText("horizon", ["monthly", "quarterly"]).notNull(),
    progressValue: integer("progressValue").notNull().default(0),
    targetValue: integer("targetValue").notNull().default(100),
    startLocalDate: varchar("startLocalDate", { length: 10 }),
    dueLocalDate: varchar("dueLocalDate", { length: 10 }),
    cue: varchar("cue", { length: 280 }),
    response: varchar("response", { length: 500 }),
    completedAt: timestamp("completedAt"),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("goal_milestones_workspace_goal_idx").on(table.workspaceId, table.goalId),
    index("goal_milestones_workspace_due_idx").on(table.workspaceId, table.dueLocalDate),
  ]
);

export const projects = pgTable(
  "projects",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    goalId: varchar("goalId", { length: 64 }),
    categoryId: varchar("categoryId", { length: 64 }),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description"),
    state: enumText("state", lifecycleStates).notNull().default("not_started"),
    priority: enumText("priority", priorities).notNull().default("medium"),
    horizon: enumText("horizon", horizons).notNull().default("quarterly"),
    startLocalDate: varchar("startLocalDate", { length: 10 }),
    dueLocalDate: varchar("dueLocalDate", { length: 10 }),
    completedAt: timestamp("completedAt"),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("projects_workspace_state_idx").on(table.workspaceId, table.state),
    index("projects_goal_idx").on(table.goalId),
  ]
);

export const tasks = pgTable(
  "tasks",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    parentTaskId: varchar("parentTaskId", { length: 64 }),
    goalId: varchar("goalId", { length: 64 }),
    projectId: varchar("projectId", { length: 64 }),
    categoryId: varchar("categoryId", { length: 64 }),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description"),
    state: enumText("state", lifecycleStates).notNull().default("not_started"),
    priority: enumText("priority", priorities).notNull().default("medium"),
    horizon: enumText("horizon", horizons).notNull().default("weekly"),
    dueLocalDate: varchar("dueLocalDate", { length: 10 }),
    scheduledLocalDate: varchar("scheduledLocalDate", { length: 10 }),
    plannedStartAt: timestamp("plannedStartAt"),
    plannedEndAt: timestamp("plannedEndAt"),
    estimateMinutes: integer("estimateMinutes"),
    sortOrder: integer("sortOrder").notNull().default(0),
    scheduleMode: enumText("scheduleMode", ["manual", "flexible", "pinned"]).notNull().default("manual"),
    outcome: enumText("outcome", ["none", "wont_do"]).notNull().default("none"),
    outcomeAt: timestamp("outcomeAt"),
    recurrenceRule: jsonb("recurrenceRule"),
    recurrenceAnchor: enumText("recurrenceAnchor", ["scheduled", "completion"]),
    recurrenceUntilLocalDate: varchar("recurrenceUntilLocalDate", { length: 10 }),
    rescheduleCount: integer("rescheduleCount").notNull().default(0),
    clientRequestId: varchar("clientRequestId", { length: 64 }),
    completedAt: timestamp("completedAt"),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("tasks_workspace_state_idx").on(table.workspaceId, table.state),
    index("tasks_workspace_due_idx").on(table.workspaceId, table.dueLocalDate),
    index("tasks_workspace_schedule_idx").on(table.workspaceId, table.scheduledLocalDate),
    index("tasks_workspace_reschedule_idx").on(table.workspaceId, table.rescheduleCount),
    index("tasks_parent_idx").on(table.parentTaskId),
    index("tasks_project_idx").on(table.projectId),
    index("tasks_goal_idx").on(table.goalId),
    uniqueIndex("tasks_workspace_client_request_unique").on(table.workspaceId, table.clientRequestId),
  ]
);

/** Immutable per-task evidence that a completed planning day was manually rolled over. */
export const taskReservationRollovers = pgTable(
  "taskReservationRollovers",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    taskId: varchar("taskId", { length: 64 }).notNull(),
    fromLocalDate: varchar("fromLocalDate", { length: 10 }).notNull(),
    priorPlannedStartAt: timestamp("priorPlannedStartAt").notNull(),
    priorPlannedEndAt: timestamp("priorPlannedEndAt").notNull(),
    appliedAt: timestamp("appliedAt").defaultNow().notNull(),
  },
  table => [
    index("task_rollovers_workspace_date_idx").on(table.workspaceId, table.fromLocalDate),
    uniqueIndex("task_rollover_task_date_unique").on(table.taskId, table.fromLocalDate),
  ]
);

export const taskDependencies = pgTable(
  "taskDependencies",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    taskId: varchar("taskId", { length: 64 }).notNull(),
    dependsOnTaskId: varchar("dependsOnTaskId", { length: 64 }).notNull(),
    dependencyType: enumText("dependencyType", ["hard", "soft"]).notNull().default("hard"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("task_dependencies_workspace_task_idx").on(table.workspaceId, table.taskId),
    uniqueIndex("task_dependency_unique").on(table.taskId, table.dependsOnTaskId),
  ]
);

export const taskOccurrences = pgTable(
  "taskOccurrences",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    taskId: varchar("taskId", { length: 64 }).notNull(),
    localDate: varchar("localDate", { length: 10 }).notNull(),
    state: enumText("state", ["pending", "completed", "skipped", "missed", "rescheduled"]).notNull().default("pending"),
    plannedStartAt: timestamp("plannedStartAt"),
    plannedEndAt: timestamp("plannedEndAt"),
    rescheduledToLocalDate: varchar("rescheduledToLocalDate", { length: 10 }),
    completedAt: timestamp("completedAt"),
    resolvedAt: timestamp("resolvedAt"),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("occurrences_workspace_date_idx").on(table.workspaceId, table.localDate),
    uniqueIndex("occurrences_task_date_unique").on(table.taskId, table.localDate),
  ]
);

export const habits = pgTable(
  "habits",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    goalId: varchar("goalId", { length: 64 }),
    categoryId: varchar("categoryId", { length: 64 }),
    name: varchar("name", { length: 160 }).notNull(),
    description: text("description"),
    color: varchar("color", { length: 16 }).notNull(),
    frequency: enumText("frequency", ["daily", "days_of_week", "times_per_week", "interval"]).notNull().default("daily"),
    schedule: jsonb("schedule").notNull(),
    reminderTime: varchar("reminderTime", { length: 5 }),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("habits_workspace_active_idx").on(table.workspaceId, table.archivedAt),
    index("habits_goal_idx").on(table.goalId),
  ]
);

export const habitCheckIns = pgTable(
  "habitCheckIns",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    habitId: varchar("habitId", { length: 64 }).notNull(),
    localDate: varchar("localDate", { length: 10 }).notNull(),
    timezoneAtCheckIn: varchar("timezoneAtCheckIn", { length: 64 }).notNull(),
    state: enumText("state", ["completed", "skipped", "missed"]).notNull(),
    completedAt: timestamp("completedAt"),
    note: text("note"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("habit_checkins_workspace_date_idx").on(table.workspaceId, table.localDate),
    uniqueIndex("habit_checkin_unique").on(table.habitId, table.localDate),
  ]
);

export const dailyCheckIns = pgTable(
  "dailyCheckIns",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    localDate: varchar("localDate", { length: 10 }).notNull(),
    intention: text("intention"),
    reflection: text("reflection"),
    energy: integer("energy"),
    mood: integer("mood"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [uniqueIndex("daily_checkin_unique").on(table.workspaceId, table.localDate)]
);

/** A deliberate, reopenable daily commitment list; opening this record never moves a task. */
export const dailyPlans = pgTable(
  "dailyPlans",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    localDate: varchar("localDate", { length: 10 }).notNull(),
    state: enumText("state", ["draft", "active", "closed", "archived"]).notNull().default("draft"),
    intention: text("intention"),
    reflection: text("reflection"),
    startedAt: timestamp("startedAt"),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    uniqueIndex("daily_plans_workspace_date_unique").on(table.workspaceId, table.localDate),
    index("daily_plans_workspace_state_idx").on(table.workspaceId, table.state),
  ]
);

/** Each committed task has an explicit daily outcome without replacing task lifecycle history. */
export const dailyPlanItems = pgTable(
  "dailyPlanItems",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    dailyPlanId: varchar("dailyPlanId", { length: 64 }).notNull(),
    taskId: varchar("taskId", { length: 64 }).notNull(),
    position: integer("position").notNull().default(0),
    state: enumText("state", ["committed", "done", "rescheduled", "deferred", "wont_do", "archived"]).notNull().default("committed"),
    resolvedToLocalDate: varchar("resolvedToLocalDate", { length: 10 }),
    note: text("note"),
    resolvedAt: timestamp("resolvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    uniqueIndex("daily_plan_item_unique").on(table.dailyPlanId, table.taskId),
    index("daily_plan_items_workspace_plan_idx").on(table.workspaceId, table.dailyPlanId),
  ]
);

/** Outcome-level weekly intent is distinct from the daily commitment list. */
export const weeklyObjectives = pgTable(
  "weeklyObjectives",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    weekStartLocalDate: varchar("weekStartLocalDate", { length: 10 }).notNull(),
    goalId: varchar("goalId", { length: 64 }),
    projectId: varchar("projectId", { length: 64 }),
    title: varchar("title", { length: 280 }).notNull(),
    description: text("description"),
    state: enumText("state", ["active", "completed", "continued", "adjusted", "archived"]).notNull().default("active"),
    evidence: text("evidence"),
    carriedForwardFromId: varchar("carriedForwardFromId", { length: 64 }),
    completedAt: timestamp("completedAt"),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("weekly_objectives_workspace_week_idx").on(table.workspaceId, table.weekStartLocalDate),
    index("weekly_objectives_goal_idx").on(table.goalId),
    index("weekly_objectives_project_idx").on(table.projectId),
  ]
);

/** Actual focus time is attributed to a task rather than inferred from a reservation. */
export const focusSessions = pgTable(
  "focusSessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    taskId: varchar("taskId", { length: 64 }),
    state: enumText("state", ["active", "paused", "completed", "abandoned"]).notNull().default("active"),
    startedAt: timestamp("startedAt").notNull(),
    lastResumedAt: timestamp("lastResumedAt").notNull(),
    pausedAt: timestamp("pausedAt"),
    endedAt: timestamp("endedAt"),
    targetMinutes: integer("targetMinutes").notNull().default(25),
    activeSeconds: integer("activeSeconds").notNull().default(0),
    note: text("note"),
    outcome: enumText("outcome", ["done", "continue", "adjust_estimate", "stopped"]).notNull().default("continue"),
    adjustedEstimateMinutes: integer("adjustedEstimateMinutes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("focus_sessions_workspace_started_idx").on(table.workspaceId, table.startedAt),
    index("focus_sessions_task_idx").on(table.taskId),
  ]
);

/** Review-first reusable personal configurations; applying one is a separate explicit action. */
export const planningTemplates = pgTable(
  "planningTemplates",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    kind: enumText("kind", ["task", "project", "daily_plan"]).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    description: text("description"),
    payload: jsonb("payload").notNull(),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [index("planning_templates_workspace_kind_idx").on(table.workspaceId, table.kind)]
);

/** Suggestions change a task reservation only after explicit user approval and remain undoable. */
export const scheduleProposals = pgTable(
  "scheduleProposals",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    taskId: varchar("taskId", { length: 64 }).notNull(),
    localDate: varchar("localDate", { length: 10 }).notNull(),
    state: enumText("state", ["proposed", "approved", "dismissed", "undone"]).notNull().default("proposed"),
    proposedStartAt: timestamp("proposedStartAt").notNull(),
    proposedEndAt: timestamp("proposedEndAt").notNull(),
    previousScheduledLocalDate: varchar("previousScheduledLocalDate", { length: 10 }),
    previousStartAt: timestamp("previousStartAt"),
    previousEndAt: timestamp("previousEndAt"),
    reason: text("reason").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("schedule_proposals_workspace_date_idx").on(table.workspaceId, table.localDate),
    index("schedule_proposals_task_idx").on(table.taskId),
  ]
);

/** A day-specific exception overrides normal availability without modifying the workspace default. */
export const planningAvailabilityExceptions = pgTable(
  "planningAvailabilityExceptions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    localDate: varchar("localDate", { length: 10 }).notNull(),
    isUnavailable: integer("isUnavailable").notNull().default(0),
    workdayStartsAt: varchar("workdayStartsAt", { length: 5 }),
    workdayEndsAt: varchar("workdayEndsAt", { length: 5 }),
    breakMinutes: integer("breakMinutes"),
    note: varchar("note", { length: 500 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [uniqueIndex("planning_availability_exception_workspace_date_unique").on(table.workspaceId, table.localDate)]
);

export const savedViews = pgTable(
  "savedViews",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    viewType: enumText("viewType", ["tasks", "goals", "projects", "calendar", "habits"]).notNull().default("tasks"),
    configuration: jsonb("configuration").notNull(),
    isPinned: integer("isPinned").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [index("saved_views_workspace_type_idx").on(table.workspaceId, table.viewType)]
);

export const reviewSessions = pgTable(
  "reviewSessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    kind: enumText("kind", ["daily", "weekly", "monthly", "quarterly", "yearly"]).notNull(),
    periodStartLocalDate: varchar("periodStartLocalDate", { length: 10 }).notNull(),
    periodEndLocalDate: varchar("periodEndLocalDate", { length: 10 }).notNull(),
    state: enumText("state", ["not_started", "in_progress", "completed", "archived"]).notNull().default("not_started"),
    reflection: text("reflection"),
    snapshot: jsonb("snapshot"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [index("reviews_workspace_period_idx").on(table.workspaceId, table.periodStartLocalDate)]
);

export const reminderRules = pgTable(
  "reminderRules",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    targetType: enumText("targetType", ["task", "goal", "review", "daily_plan"]).notNull(),
    targetId: varchar("targetId", { length: 64 }),
    type: enumText("type", ["due", "daily_plan", "weekly_review", "at_risk"]).notNull(),
    cronExpression: varchar("cronExpression", { length: 80 }),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    isEnabled: integer("isEnabled").notNull().default(0),
    snoozedUntil: timestamp("snoozedUntil"),
    scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
    lastTriggeredAt: timestamp("lastTriggeredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [
    index("reminders_workspace_enabled_idx").on(table.workspaceId, table.isEnabled),
    uniqueIndex("reminders_schedule_task_unique").on(table.scheduleCronTaskUid),
  ]
);

/** A single project-owned Heartbeat task drives due enabled rules. */
export const reminderSchedulers = pgTable("reminderSchedulers", {
  id: varchar("id", { length: 64 }).primaryKey(),
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const integrationConnections = pgTable(
  "integrationConnections",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    provider: enumText("provider", ["google_calendar", "microsoft_outlook", "custom"]).notNull(),
    displayName: varchar("displayName", { length: 160 }).notNull(),
    sourceOfTruth: enumText("sourceOfTruth", ["read_only", "explicit_export"]).notNull().default("read_only"),
    syncCursor: text("syncCursor"),
    status: enumText("status", ["disconnected", "connected", "syncing", "error", "paused"]).notNull().default("disconnected"),
    lastSyncedAt: timestamp("lastSyncedAt"),
    lastError: text("lastError"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [index("integrations_workspace_idx").on(table.workspaceId)]
);

export const externalEvents = pgTable(
  "externalEvents",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    connectionId: varchar("connectionId", { length: 64 }).notNull(),
    externalId: varchar("externalId", { length: 255 }).notNull(),
    title: varchar("title", { length: 280 }).notNull(),
    startsAt: timestamp("startsAt").notNull(),
    endsAt: timestamp("endsAt").notNull(),
    isAllDay: integer("isAllDay").notNull().default(0),
    status: enumText("status", ["active", "cancelled"]).notNull().default("active"),
    payload: jsonb("payload"),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => [
    index("external_events_workspace_time_idx").on(table.workspaceId, table.startsAt),
    uniqueIndex("external_events_connection_external_unique").on(table.connectionId, table.externalId),
  ]
);

export const calendarFeeds = pgTable(
  "calendarFeeds",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    token: varchar("token", { length: 128 }).notNull(),
    name: varchar("name", { length: 120 }).notNull().default("Personal Calander"),
    isEnabled: integer("isEnabled").notNull().default(1),
    includeCompleted: integer("includeCompleted").notNull().default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
  },
  table => [index("calendar_feeds_workspace_idx").on(table.workspaceId), uniqueIndex("calendar_feeds_token_unique").on(table.token)]
);

export const pushSubscriptions = pgTable(
  "pushSubscriptions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    endpoint: varchar("endpoint", { length: 512 }).notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    deviceLabel: varchar("deviceLabel", { length: 120 }),
    userAgent: varchar("userAgent", { length: 512 }),
    status: enumText("status", ["active", "disabled", "expired"]).notNull().default("active"),
    failureReason: text("failureReason"),
    lastSeenAt: timestamp("lastSeenAt"),
    lastTestedAt: timestamp("lastTestedAt"),
    lastSentAt: timestamp("lastSentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => [index("push_subscriptions_workspace_status_idx").on(table.workspaceId, table.status), uniqueIndex("push_subscriptions_endpoint_unique").on(table.endpoint)]
);

export const pushDeliveries = pgTable(
  "pushDeliveries",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    subscriptionId: varchar("subscriptionId", { length: 64 }).notNull(),
    reminderRuleId: varchar("reminderRuleId", { length: 64 }),
    idempotencyKey: varchar("idempotencyKey", { length: 255 }),
    kind: enumText("kind", ["test", "daily_plan", "weekly_review", "at_risk"]).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    status: enumText("status", ["queued", "sent", "failed", "expired"]).notNull().default("queued"),
    providerStatusCode: integer("providerStatusCode"),
    failureReason: text("failureReason"),
    sentAt: timestamp("sentAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  table => [
    index("push_deliveries_workspace_created_idx").on(table.workspaceId, table.createdAt),
    index("push_deliveries_subscription_idx").on(table.subscriptionId),
    uniqueIndex("push_deliveries_idempotency_unique").on(table.idempotencyKey),
  ]
);

export const aiDrafts = pgTable(
  "aiDrafts",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    workspaceId: varchar("workspaceId", { length: 64 }).notNull(),
    type: enumText("type", ["task", "goal", "review"]).notNull(),
    sourceText: text("sourceText").notNull(),
    draft: jsonb("draft").notNull(),
    state: enumText("state", ["proposed", "accepted", "dismissed", "expired"]).notNull().default("proposed"),
    expiresAt: timestamp("expiresAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    version: integer("version").notNull().default(1),
  },
  table => [index("ai_drafts_workspace_state_idx").on(table.workspaceId, table.state)]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalMilestone = typeof goalMilestones.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskOccurrence = typeof taskOccurrences.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitCheckIn = typeof habitCheckIns.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type PushDelivery = typeof pushDeliveries.$inferSelect;
