CREATE TABLE `aiDrafts` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`type` enum('task','goal','review') NOT NULL,
	`sourceText` text NOT NULL,
	`draft` json NOT NULL,
	`state` enum('proposed','accepted','dismissed','expired') NOT NULL DEFAULT 'proposed',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `aiDrafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`name` varchar(80) NOT NULL,
	`color` varchar(16) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_workspace_name_unique` UNIQUE(`workspaceId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `dailyCheckIns` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`localDate` varchar(10) NOT NULL,
	`intention` text,
	`reflection` text,
	`energy` int,
	`mood` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `dailyCheckIns_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_checkin_unique` UNIQUE(`workspaceId`,`localDate`)
);
--> statement-breakpoint
CREATE TABLE `externalEvents` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`connectionId` varchar(64) NOT NULL,
	`externalId` varchar(255) NOT NULL,
	`title` varchar(280) NOT NULL,
	`startsAt` timestamp NOT NULL,
	`endsAt` timestamp NOT NULL,
	`isAllDay` int NOT NULL DEFAULT 0,
	`status` enum('active','cancelled') NOT NULL DEFAULT 'active',
	`payload` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `externalEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_events_connection_external_unique` UNIQUE(`connectionId`,`externalId`)
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`categoryId` varchar(64),
	`parentGoalId` varchar(64),
	`title` varchar(280) NOT NULL,
	`description` text,
	`state` enum('not_started','in_progress','blocked','completed','archived') NOT NULL DEFAULT 'not_started',
	`priority` enum('none','low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`horizon` enum('daily','weekly','monthly','quarterly','yearly','someday') NOT NULL DEFAULT 'yearly',
	`color` varchar(16),
	`progressMode` enum('manual','task','measure','habit') NOT NULL DEFAULT 'task',
	`progressValue` int NOT NULL DEFAULT 0,
	`targetValue` int NOT NULL DEFAULT 100,
	`startLocalDate` varchar(10),
	`dueLocalDate` varchar(10),
	`completedAt` timestamp,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `habitCheckIns` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`habitId` varchar(64) NOT NULL,
	`localDate` varchar(10) NOT NULL,
	`timezoneAtCheckIn` varchar(64) NOT NULL,
	`state` enum('completed','skipped','missed') NOT NULL,
	`completedAt` timestamp,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `habitCheckIns_id` PRIMARY KEY(`id`),
	CONSTRAINT `habit_checkin_unique` UNIQUE(`habitId`,`localDate`)
);
--> statement-breakpoint
CREATE TABLE `habits` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`goalId` varchar(64),
	`categoryId` varchar(64),
	`name` varchar(160) NOT NULL,
	`description` text,
	`color` varchar(16) NOT NULL,
	`frequency` enum('daily','days_of_week','times_per_week','interval') NOT NULL DEFAULT 'daily',
	`schedule` json NOT NULL,
	`reminderTime` varchar(5),
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `habits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integrationConnections` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`provider` enum('google_calendar','microsoft_outlook','custom') NOT NULL,
	`displayName` varchar(160) NOT NULL,
	`sourceOfTruth` enum('read_only','explicit_export') NOT NULL DEFAULT 'read_only',
	`syncCursor` text,
	`status` enum('disconnected','connected','syncing','error','paused') NOT NULL DEFAULT 'disconnected',
	`lastSyncedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `integrationConnections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`goalId` varchar(64),
	`categoryId` varchar(64),
	`title` varchar(280) NOT NULL,
	`description` text,
	`state` enum('not_started','in_progress','blocked','completed','archived') NOT NULL DEFAULT 'not_started',
	`priority` enum('none','low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`horizon` enum('daily','weekly','monthly','quarterly','yearly','someday') NOT NULL DEFAULT 'quarterly',
	`startLocalDate` varchar(10),
	`dueLocalDate` varchar(10),
	`completedAt` timestamp,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminderRules` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`targetType` enum('task','goal','review','daily_plan') NOT NULL,
	`targetId` varchar(64),
	`type` enum('due','daily_plan','weekly_review','at_risk') NOT NULL,
	`cronExpression` varchar(80),
	`timezone` varchar(64) NOT NULL,
	`isEnabled` int NOT NULL DEFAULT 0,
	`snoozedUntil` timestamp,
	`scheduleCronTaskUid` varchar(65),
	`lastTriggeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `reminderRules_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminders_schedule_task_unique` UNIQUE(`scheduleCronTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `reviewSessions` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`kind` enum('daily','weekly','monthly','quarterly','yearly') NOT NULL,
	`periodStartLocalDate` varchar(10) NOT NULL,
	`periodEndLocalDate` varchar(10) NOT NULL,
	`state` enum('not_started','in_progress','completed','archived') NOT NULL DEFAULT 'not_started',
	`reflection` text,
	`snapshot` json,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `reviewSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savedViews` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`viewType` enum('tasks','goals','projects','calendar','habits') NOT NULL DEFAULT 'tasks',
	`configuration` json NOT NULL,
	`isPinned` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `savedViews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskDependencies` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`dependsOnTaskId` varchar(64) NOT NULL,
	`dependencyType` enum('hard','soft') NOT NULL DEFAULT 'hard',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskDependencies_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_dependency_unique` UNIQUE(`taskId`,`dependsOnTaskId`)
);
--> statement-breakpoint
CREATE TABLE `taskOccurrences` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`localDate` varchar(10) NOT NULL,
	`state` enum('pending','completed','skipped','missed','rescheduled') NOT NULL DEFAULT 'pending',
	`plannedStartAt` timestamp,
	`plannedEndAt` timestamp,
	`rescheduledToLocalDate` varchar(10),
	`completedAt` timestamp,
	`resolvedAt` timestamp,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `taskOccurrences_id` PRIMARY KEY(`id`),
	CONSTRAINT `occurrences_task_date_unique` UNIQUE(`taskId`,`localDate`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`parentTaskId` varchar(64),
	`goalId` varchar(64),
	`projectId` varchar(64),
	`categoryId` varchar(64),
	`title` varchar(280) NOT NULL,
	`description` text,
	`state` enum('not_started','in_progress','blocked','completed','archived') NOT NULL DEFAULT 'not_started',
	`priority` enum('none','low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`horizon` enum('daily','weekly','monthly','quarterly','yearly','someday') NOT NULL DEFAULT 'weekly',
	`dueLocalDate` varchar(10),
	`scheduledLocalDate` varchar(10),
	`plannedStartAt` timestamp,
	`plannedEndAt` timestamp,
	`estimateMinutes` int,
	`sortOrder` int NOT NULL DEFAULT 0,
	`recurrenceRule` json,
	`recurrenceAnchor` enum('scheduled','completion'),
	`recurrenceUntilLocalDate` varchar(10),
	`completedAt` timestamp,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL DEFAULT 'My planning workspace',
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`weekStartsOn` int NOT NULL DEFAULT 1,
	`dailyCapacityMinutes` int NOT NULL DEFAULT 360,
	`planningDayStartsAt` varchar(5) NOT NULL DEFAULT '06:00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_drafts_workspace_state_idx` ON `aiDrafts` (`workspaceId`,`state`);--> statement-breakpoint
CREATE INDEX `categories_workspace_idx` ON `categories` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `external_events_workspace_time_idx` ON `externalEvents` (`workspaceId`,`startsAt`);--> statement-breakpoint
CREATE INDEX `goals_workspace_state_idx` ON `goals` (`workspaceId`,`state`);--> statement-breakpoint
CREATE INDEX `goals_workspace_horizon_idx` ON `goals` (`workspaceId`,`horizon`);--> statement-breakpoint
CREATE INDEX `goals_parent_idx` ON `goals` (`parentGoalId`);--> statement-breakpoint
CREATE INDEX `habit_checkins_workspace_date_idx` ON `habitCheckIns` (`workspaceId`,`localDate`);--> statement-breakpoint
CREATE INDEX `habits_workspace_active_idx` ON `habits` (`workspaceId`,`archivedAt`);--> statement-breakpoint
CREATE INDEX `habits_goal_idx` ON `habits` (`goalId`);--> statement-breakpoint
CREATE INDEX `integrations_workspace_idx` ON `integrationConnections` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `projects_workspace_state_idx` ON `projects` (`workspaceId`,`state`);--> statement-breakpoint
CREATE INDEX `projects_goal_idx` ON `projects` (`goalId`);--> statement-breakpoint
CREATE INDEX `reminders_workspace_enabled_idx` ON `reminderRules` (`workspaceId`,`isEnabled`);--> statement-breakpoint
CREATE INDEX `reviews_workspace_period_idx` ON `reviewSessions` (`workspaceId`,`periodStartLocalDate`);--> statement-breakpoint
CREATE INDEX `saved_views_workspace_type_idx` ON `savedViews` (`workspaceId`,`viewType`);--> statement-breakpoint
CREATE INDEX `task_dependencies_workspace_task_idx` ON `taskDependencies` (`workspaceId`,`taskId`);--> statement-breakpoint
CREATE INDEX `occurrences_workspace_date_idx` ON `taskOccurrences` (`workspaceId`,`localDate`);--> statement-breakpoint
CREATE INDEX `tasks_workspace_state_idx` ON `tasks` (`workspaceId`,`state`);--> statement-breakpoint
CREATE INDEX `tasks_workspace_due_idx` ON `tasks` (`workspaceId`,`dueLocalDate`);--> statement-breakpoint
CREATE INDEX `tasks_workspace_schedule_idx` ON `tasks` (`workspaceId`,`scheduledLocalDate`);--> statement-breakpoint
CREATE INDEX `tasks_parent_idx` ON `tasks` (`parentTaskId`);--> statement-breakpoint
CREATE INDEX `tasks_project_idx` ON `tasks` (`projectId`);--> statement-breakpoint
CREATE INDEX `tasks_goal_idx` ON `tasks` (`goalId`);