CREATE TABLE "aiDrafts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"type" text NOT NULL,
	"sourceText" text NOT NULL,
	"draft" jsonb NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"expiresAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendarFeeds" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"token" varchar(128) NOT NULL,
	"name" varchar(120) DEFAULT 'Personal Calander' NOT NULL,
	"isEnabled" integer DEFAULT 1 NOT NULL,
	"includeCompleted" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"revokedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(16) NOT NULL,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dailyCheckIns" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"localDate" varchar(10) NOT NULL,
	"intention" text,
	"reflection" text,
	"energy" integer,
	"mood" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dailyPlanItems" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"dailyPlanId" varchar(64) NOT NULL,
	"taskId" varchar(64) NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"state" text DEFAULT 'committed' NOT NULL,
	"resolvedToLocalDate" varchar(10),
	"note" text,
	"resolvedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dailyPlans" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"localDate" varchar(10) NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"intention" text,
	"reflection" text,
	"startedAt" timestamp,
	"closedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "externalEvents" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"connectionId" varchar(64) NOT NULL,
	"externalId" varchar(255) NOT NULL,
	"title" varchar(280) NOT NULL,
	"startsAt" timestamp NOT NULL,
	"endsAt" timestamp NOT NULL,
	"isAllDay" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"payload" jsonb,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "focusSessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"taskId" varchar(64),
	"state" text DEFAULT 'active' NOT NULL,
	"startedAt" timestamp NOT NULL,
	"lastResumedAt" timestamp NOT NULL,
	"pausedAt" timestamp,
	"endedAt" timestamp,
	"targetMinutes" integer DEFAULT 25 NOT NULL,
	"activeSeconds" integer DEFAULT 0 NOT NULL,
	"note" text,
	"outcome" text DEFAULT 'continue' NOT NULL,
	"adjustedEstimateMinutes" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goalMilestones" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"goalId" varchar(64) NOT NULL,
	"title" varchar(280) NOT NULL,
	"description" text,
	"state" text DEFAULT 'not_started' NOT NULL,
	"horizon" text NOT NULL,
	"progressValue" integer DEFAULT 0 NOT NULL,
	"targetValue" integer DEFAULT 100 NOT NULL,
	"startLocalDate" varchar(10),
	"dueLocalDate" varchar(10),
	"cue" varchar(280),
	"response" varchar(500),
	"completedAt" timestamp,
	"archivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"categoryId" varchar(64),
	"parentGoalId" varchar(64),
	"title" varchar(280) NOT NULL,
	"description" text,
	"state" text DEFAULT 'not_started' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"horizon" text DEFAULT 'yearly' NOT NULL,
	"color" varchar(16),
	"progressMode" text DEFAULT 'task' NOT NULL,
	"progressValue" integer DEFAULT 0 NOT NULL,
	"targetValue" integer DEFAULT 100 NOT NULL,
	"startLocalDate" varchar(10),
	"dueLocalDate" varchar(10),
	"completedAt" timestamp,
	"archivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habitCheckIns" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"habitId" varchar(64) NOT NULL,
	"localDate" varchar(10) NOT NULL,
	"timezoneAtCheckIn" varchar(64) NOT NULL,
	"state" text NOT NULL,
	"completedAt" timestamp,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"goalId" varchar(64),
	"categoryId" varchar(64),
	"name" varchar(160) NOT NULL,
	"description" text,
	"color" varchar(16) NOT NULL,
	"frequency" text DEFAULT 'daily' NOT NULL,
	"schedule" jsonb NOT NULL,
	"reminderTime" varchar(5),
	"archivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrationConnections" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"provider" text NOT NULL,
	"displayName" varchar(160) NOT NULL,
	"sourceOfTruth" text DEFAULT 'read_only' NOT NULL,
	"syncCursor" text,
	"status" text DEFAULT 'disconnected' NOT NULL,
	"lastSyncedAt" timestamp,
	"lastError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planningAvailabilityExceptions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"localDate" varchar(10) NOT NULL,
	"isUnavailable" integer DEFAULT 0 NOT NULL,
	"workdayStartsAt" varchar(5),
	"workdayEndsAt" varchar(5),
	"breakMinutes" integer,
	"note" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planningTemplates" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"kind" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" text,
	"payload" jsonb NOT NULL,
	"archivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"goalId" varchar(64),
	"categoryId" varchar(64),
	"title" varchar(280) NOT NULL,
	"description" text,
	"state" text DEFAULT 'not_started' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"horizon" text DEFAULT 'quarterly' NOT NULL,
	"startLocalDate" varchar(10),
	"dueLocalDate" varchar(10),
	"completedAt" timestamp,
	"archivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pushDeliveries" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"subscriptionId" varchar(64) NOT NULL,
	"reminderRuleId" varchar(64),
	"idempotencyKey" varchar(255),
	"kind" text NOT NULL,
	"title" varchar(160) NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"providerStatusCode" integer,
	"failureReason" text,
	"sentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pushSubscriptions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"endpoint" varchar(512) NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"deviceLabel" varchar(120),
	"userAgent" varchar(512),
	"status" text DEFAULT 'active' NOT NULL,
	"failureReason" text,
	"lastSeenAt" timestamp,
	"lastTestedAt" timestamp,
	"lastSentAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminderRules" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"targetType" text NOT NULL,
	"targetId" varchar(64),
	"type" text NOT NULL,
	"cronExpression" varchar(80),
	"timezone" varchar(64) NOT NULL,
	"isEnabled" integer DEFAULT 0 NOT NULL,
	"snoozedUntil" timestamp,
	"scheduleCronTaskUid" varchar(65),
	"lastTriggeredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminderSchedulers" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"scheduleCronTaskUid" varchar(65) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reminderSchedulers_scheduleCronTaskUid_unique" UNIQUE("scheduleCronTaskUid")
);
--> statement-breakpoint
CREATE TABLE "reviewSessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"kind" text NOT NULL,
	"periodStartLocalDate" varchar(10) NOT NULL,
	"periodEndLocalDate" varchar(10) NOT NULL,
	"state" text DEFAULT 'not_started' NOT NULL,
	"reflection" text,
	"snapshot" jsonb,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savedViews" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"viewType" text DEFAULT 'tasks' NOT NULL,
	"configuration" jsonb NOT NULL,
	"isPinned" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduleProposals" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"taskId" varchar(64) NOT NULL,
	"localDate" varchar(10) NOT NULL,
	"state" text DEFAULT 'proposed' NOT NULL,
	"proposedStartAt" timestamp NOT NULL,
	"proposedEndAt" timestamp NOT NULL,
	"previousScheduledLocalDate" varchar(10),
	"previousStartAt" timestamp,
	"previousEndAt" timestamp,
	"reason" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskDependencies" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"taskId" varchar(64) NOT NULL,
	"dependsOnTaskId" varchar(64) NOT NULL,
	"dependencyType" text DEFAULT 'hard' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskOccurrences" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"taskId" varchar(64) NOT NULL,
	"localDate" varchar(10) NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"plannedStartAt" timestamp,
	"plannedEndAt" timestamp,
	"rescheduledToLocalDate" varchar(10),
	"completedAt" timestamp,
	"resolvedAt" timestamp,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taskReservationRollovers" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"taskId" varchar(64) NOT NULL,
	"fromLocalDate" varchar(10) NOT NULL,
	"priorPlannedStartAt" timestamp NOT NULL,
	"priorPlannedEndAt" timestamp NOT NULL,
	"appliedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"parentTaskId" varchar(64),
	"goalId" varchar(64),
	"projectId" varchar(64),
	"categoryId" varchar(64),
	"title" varchar(280) NOT NULL,
	"description" text,
	"state" text DEFAULT 'not_started' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"horizon" text DEFAULT 'weekly' NOT NULL,
	"dueLocalDate" varchar(10),
	"scheduledLocalDate" varchar(10),
	"plannedStartAt" timestamp,
	"plannedEndAt" timestamp,
	"estimateMinutes" integer,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"scheduleMode" text DEFAULT 'manual' NOT NULL,
	"outcome" text DEFAULT 'none' NOT NULL,
	"outcomeAt" timestamp,
	"recurrenceRule" jsonb,
	"recurrenceAnchor" text,
	"recurrenceUntilLocalDate" varchar(10),
	"rescheduleCount" integer DEFAULT 0 NOT NULL,
	"clientRequestId" varchar(64),
	"completedAt" timestamp,
	"archivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" text DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
CREATE TABLE "weeklyObjectives" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"weekStartLocalDate" varchar(10) NOT NULL,
	"goalId" varchar(64),
	"projectId" varchar(64),
	"title" varchar(280) NOT NULL,
	"description" text,
	"state" text DEFAULT 'active' NOT NULL,
	"evidence" text,
	"carriedForwardFromId" varchar(64),
	"completedAt" timestamp,
	"archivedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(120) DEFAULT 'My planning workspace' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"weekStartsOn" integer DEFAULT 1 NOT NULL,
	"dailyCapacityMinutes" integer DEFAULT 360 NOT NULL,
	"planningDayStartsAt" varchar(5) DEFAULT '06:00' NOT NULL,
	"workdayStartsAt" varchar(5) DEFAULT '09:00' NOT NULL,
	"workdayEndsAt" varchar(5) DEFAULT '17:00' NOT NULL,
	"defaultBreakMinutes" integer DEFAULT 30 NOT NULL,
	"preferredShutdownAt" varchar(5) DEFAULT '17:30' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_drafts_workspace_state_idx" ON "aiDrafts" USING btree ("workspaceId","state");--> statement-breakpoint
CREATE INDEX "calendar_feeds_workspace_idx" ON "calendarFeeds" USING btree ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_feeds_token_unique" ON "calendarFeeds" USING btree ("token");--> statement-breakpoint
CREATE INDEX "categories_workspace_idx" ON "categories" USING btree ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_workspace_name_unique" ON "categories" USING btree ("workspaceId","name");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_checkin_unique" ON "dailyCheckIns" USING btree ("workspaceId","localDate");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_plan_item_unique" ON "dailyPlanItems" USING btree ("dailyPlanId","taskId");--> statement-breakpoint
CREATE INDEX "daily_plan_items_workspace_plan_idx" ON "dailyPlanItems" USING btree ("workspaceId","dailyPlanId");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_plans_workspace_date_unique" ON "dailyPlans" USING btree ("workspaceId","localDate");--> statement-breakpoint
CREATE INDEX "daily_plans_workspace_state_idx" ON "dailyPlans" USING btree ("workspaceId","state");--> statement-breakpoint
CREATE INDEX "external_events_workspace_time_idx" ON "externalEvents" USING btree ("workspaceId","startsAt");--> statement-breakpoint
CREATE UNIQUE INDEX "external_events_connection_external_unique" ON "externalEvents" USING btree ("connectionId","externalId");--> statement-breakpoint
CREATE INDEX "focus_sessions_workspace_started_idx" ON "focusSessions" USING btree ("workspaceId","startedAt");--> statement-breakpoint
CREATE INDEX "focus_sessions_task_idx" ON "focusSessions" USING btree ("taskId");--> statement-breakpoint
CREATE INDEX "goal_milestones_workspace_goal_idx" ON "goalMilestones" USING btree ("workspaceId","goalId");--> statement-breakpoint
CREATE INDEX "goal_milestones_workspace_due_idx" ON "goalMilestones" USING btree ("workspaceId","dueLocalDate");--> statement-breakpoint
CREATE INDEX "goals_workspace_state_idx" ON "goals" USING btree ("workspaceId","state");--> statement-breakpoint
CREATE INDEX "goals_workspace_horizon_idx" ON "goals" USING btree ("workspaceId","horizon");--> statement-breakpoint
CREATE INDEX "goals_parent_idx" ON "goals" USING btree ("parentGoalId");--> statement-breakpoint
CREATE INDEX "habit_checkins_workspace_date_idx" ON "habitCheckIns" USING btree ("workspaceId","localDate");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_checkin_unique" ON "habitCheckIns" USING btree ("habitId","localDate");--> statement-breakpoint
CREATE INDEX "habits_workspace_active_idx" ON "habits" USING btree ("workspaceId","archivedAt");--> statement-breakpoint
CREATE INDEX "habits_goal_idx" ON "habits" USING btree ("goalId");--> statement-breakpoint
CREATE INDEX "integrations_workspace_idx" ON "integrationConnections" USING btree ("workspaceId");--> statement-breakpoint
CREATE UNIQUE INDEX "planning_availability_exception_workspace_date_unique" ON "planningAvailabilityExceptions" USING btree ("workspaceId","localDate");--> statement-breakpoint
CREATE INDEX "planning_templates_workspace_kind_idx" ON "planningTemplates" USING btree ("workspaceId","kind");--> statement-breakpoint
CREATE INDEX "projects_workspace_state_idx" ON "projects" USING btree ("workspaceId","state");--> statement-breakpoint
CREATE INDEX "projects_goal_idx" ON "projects" USING btree ("goalId");--> statement-breakpoint
CREATE INDEX "push_deliveries_workspace_created_idx" ON "pushDeliveries" USING btree ("workspaceId","createdAt");--> statement-breakpoint
CREATE INDEX "push_deliveries_subscription_idx" ON "pushDeliveries" USING btree ("subscriptionId");--> statement-breakpoint
CREATE UNIQUE INDEX "push_deliveries_idempotency_unique" ON "pushDeliveries" USING btree ("idempotencyKey");--> statement-breakpoint
CREATE INDEX "push_subscriptions_workspace_status_idx" ON "pushSubscriptions" USING btree ("workspaceId","status");--> statement-breakpoint
CREATE UNIQUE INDEX "push_subscriptions_endpoint_unique" ON "pushSubscriptions" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX "reminders_workspace_enabled_idx" ON "reminderRules" USING btree ("workspaceId","isEnabled");--> statement-breakpoint
CREATE UNIQUE INDEX "reminders_schedule_task_unique" ON "reminderRules" USING btree ("scheduleCronTaskUid");--> statement-breakpoint
CREATE INDEX "reviews_workspace_period_idx" ON "reviewSessions" USING btree ("workspaceId","periodStartLocalDate");--> statement-breakpoint
CREATE INDEX "saved_views_workspace_type_idx" ON "savedViews" USING btree ("workspaceId","viewType");--> statement-breakpoint
CREATE INDEX "schedule_proposals_workspace_date_idx" ON "scheduleProposals" USING btree ("workspaceId","localDate");--> statement-breakpoint
CREATE INDEX "schedule_proposals_task_idx" ON "scheduleProposals" USING btree ("taskId");--> statement-breakpoint
CREATE INDEX "task_dependencies_workspace_task_idx" ON "taskDependencies" USING btree ("workspaceId","taskId");--> statement-breakpoint
CREATE UNIQUE INDEX "task_dependency_unique" ON "taskDependencies" USING btree ("taskId","dependsOnTaskId");--> statement-breakpoint
CREATE INDEX "occurrences_workspace_date_idx" ON "taskOccurrences" USING btree ("workspaceId","localDate");--> statement-breakpoint
CREATE UNIQUE INDEX "occurrences_task_date_unique" ON "taskOccurrences" USING btree ("taskId","localDate");--> statement-breakpoint
CREATE INDEX "task_rollovers_workspace_date_idx" ON "taskReservationRollovers" USING btree ("workspaceId","fromLocalDate");--> statement-breakpoint
CREATE UNIQUE INDEX "task_rollover_task_date_unique" ON "taskReservationRollovers" USING btree ("taskId","fromLocalDate");--> statement-breakpoint
CREATE INDEX "tasks_workspace_state_idx" ON "tasks" USING btree ("workspaceId","state");--> statement-breakpoint
CREATE INDEX "tasks_workspace_due_idx" ON "tasks" USING btree ("workspaceId","dueLocalDate");--> statement-breakpoint
CREATE INDEX "tasks_workspace_schedule_idx" ON "tasks" USING btree ("workspaceId","scheduledLocalDate");--> statement-breakpoint
CREATE INDEX "tasks_workspace_reschedule_idx" ON "tasks" USING btree ("workspaceId","rescheduleCount");--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parentTaskId");--> statement-breakpoint
CREATE INDEX "tasks_project_idx" ON "tasks" USING btree ("projectId");--> statement-breakpoint
CREATE INDEX "tasks_goal_idx" ON "tasks" USING btree ("goalId");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_workspace_client_request_unique" ON "tasks" USING btree ("workspaceId","clientRequestId");--> statement-breakpoint
CREATE INDEX "weekly_objectives_workspace_week_idx" ON "weeklyObjectives" USING btree ("workspaceId","weekStartLocalDate");--> statement-breakpoint
CREATE INDEX "weekly_objectives_goal_idx" ON "weeklyObjectives" USING btree ("goalId");--> statement-breakpoint
CREATE INDEX "weekly_objectives_project_idx" ON "weeklyObjectives" USING btree ("projectId");