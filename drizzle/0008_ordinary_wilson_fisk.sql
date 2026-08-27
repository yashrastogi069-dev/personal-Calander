CREATE TABLE `dailyPlanItems` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`dailyPlanId` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`state` enum('committed','done','rescheduled','deferred','wont_do','archived') NOT NULL DEFAULT 'committed',
	`resolvedToLocalDate` varchar(10),
	`note` text,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `dailyPlanItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_plan_item_unique` UNIQUE(`dailyPlanId`,`taskId`)
);
--> statement-breakpoint
CREATE TABLE `dailyPlans` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`localDate` varchar(10) NOT NULL,
	`state` enum('draft','active','closed','archived') NOT NULL DEFAULT 'draft',
	`intention` text,
	`reflection` text,
	`startedAt` timestamp,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `dailyPlans_id` PRIMARY KEY(`id`),
	CONSTRAINT `daily_plans_workspace_date_unique` UNIQUE(`workspaceId`,`localDate`)
);
--> statement-breakpoint
CREATE TABLE `focusSessions` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`taskId` varchar(64),
	`state` enum('active','paused','completed','abandoned') NOT NULL DEFAULT 'active',
	`startedAt` timestamp NOT NULL,
	`pausedAt` timestamp,
	`endedAt` timestamp,
	`targetMinutes` int NOT NULL DEFAULT 25,
	`activeSeconds` int NOT NULL DEFAULT 0,
	`note` text,
	`outcome` enum('done','continue','adjust_estimate','stopped') NOT NULL DEFAULT 'continue',
	`adjustedEstimateMinutes` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `focusSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `planningTemplates` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`kind` enum('task','project','daily_plan') NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`payload` json NOT NULL,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `planningTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduleProposals` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`localDate` varchar(10) NOT NULL,
	`state` enum('proposed','approved','dismissed','undone') NOT NULL DEFAULT 'proposed',
	`proposedStartAt` timestamp NOT NULL,
	`proposedEndAt` timestamp NOT NULL,
	`previousStartAt` timestamp,
	`previousEndAt` timestamp,
	`reason` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `scheduleProposals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weeklyObjectives` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`weekStartLocalDate` varchar(10) NOT NULL,
	`goalId` varchar(64),
	`projectId` varchar(64),
	`title` varchar(280) NOT NULL,
	`description` text,
	`state` enum('active','completed','continued','adjusted','archived') NOT NULL DEFAULT 'active',
	`evidence` text,
	`carriedForwardFromId` varchar(64),
	`completedAt` timestamp,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `weeklyObjectives_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `scheduleMode` enum('manual','flexible','pinned') DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `outcome` enum('none','wont_do') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `outcomeAt` timestamp;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `workdayStartsAt` varchar(5) DEFAULT '09:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `workdayEndsAt` varchar(5) DEFAULT '17:00' NOT NULL;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `defaultBreakMinutes` int DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `workspaces` ADD `preferredShutdownAt` varchar(5) DEFAULT '17:30' NOT NULL;--> statement-breakpoint
CREATE INDEX `daily_plan_items_workspace_plan_idx` ON `dailyPlanItems` (`workspaceId`,`dailyPlanId`);--> statement-breakpoint
CREATE INDEX `daily_plans_workspace_state_idx` ON `dailyPlans` (`workspaceId`,`state`);--> statement-breakpoint
CREATE INDEX `focus_sessions_workspace_started_idx` ON `focusSessions` (`workspaceId`,`startedAt`);--> statement-breakpoint
CREATE INDEX `focus_sessions_task_idx` ON `focusSessions` (`taskId`);--> statement-breakpoint
CREATE INDEX `planning_templates_workspace_kind_idx` ON `planningTemplates` (`workspaceId`,`kind`);--> statement-breakpoint
CREATE INDEX `schedule_proposals_workspace_date_idx` ON `scheduleProposals` (`workspaceId`,`localDate`);--> statement-breakpoint
CREATE INDEX `schedule_proposals_task_idx` ON `scheduleProposals` (`taskId`);--> statement-breakpoint
CREATE INDEX `weekly_objectives_workspace_week_idx` ON `weeklyObjectives` (`workspaceId`,`weekStartLocalDate`);--> statement-breakpoint
CREATE INDEX `weekly_objectives_goal_idx` ON `weeklyObjectives` (`goalId`);--> statement-breakpoint
CREATE INDEX `weekly_objectives_project_idx` ON `weeklyObjectives` (`projectId`);