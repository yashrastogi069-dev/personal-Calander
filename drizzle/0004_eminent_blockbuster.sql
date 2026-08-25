CREATE TABLE `goalMilestones` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`goalId` varchar(64) NOT NULL,
	`title` varchar(280) NOT NULL,
	`description` text,
	`state` enum('not_started','in_progress','blocked','completed','archived') NOT NULL DEFAULT 'not_started',
	`horizon` enum('monthly','quarterly') NOT NULL,
	`progressValue` int NOT NULL DEFAULT 0,
	`targetValue` int NOT NULL DEFAULT 100,
	`startLocalDate` varchar(10),
	`dueLocalDate` varchar(10),
	`cue` varchar(280),
	`response` varchar(500),
	`completedAt` timestamp,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `goalMilestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pushDeliveries` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`subscriptionId` varchar(64) NOT NULL,
	`reminderRuleId` varchar(64),
	`kind` enum('test','daily_plan','weekly_review','at_risk') NOT NULL,
	`title` varchar(160) NOT NULL,
	`status` enum('queued','sent','failed','expired') NOT NULL DEFAULT 'queued',
	`providerStatusCode` int,
	`failureReason` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pushDeliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `pushSubscriptions` ADD `deviceLabel` varchar(120);--> statement-breakpoint
ALTER TABLE `pushSubscriptions` ADD `userAgent` varchar(512);--> statement-breakpoint
ALTER TABLE `pushSubscriptions` ADD `lastSeenAt` timestamp;--> statement-breakpoint
ALTER TABLE `pushSubscriptions` ADD `lastTestedAt` timestamp;--> statement-breakpoint
ALTER TABLE `pushSubscriptions` ADD `lastSentAt` timestamp;--> statement-breakpoint
CREATE INDEX `goal_milestones_workspace_goal_idx` ON `goalMilestones` (`workspaceId`,`goalId`);--> statement-breakpoint
CREATE INDEX `goal_milestones_workspace_due_idx` ON `goalMilestones` (`workspaceId`,`dueLocalDate`);--> statement-breakpoint
CREATE INDEX `push_deliveries_workspace_created_idx` ON `pushDeliveries` (`workspaceId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `push_deliveries_subscription_idx` ON `pushDeliveries` (`subscriptionId`);