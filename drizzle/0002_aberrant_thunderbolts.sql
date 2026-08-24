CREATE TABLE `calendarFeeds` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`token` varchar(128) NOT NULL,
	`name` varchar(120) NOT NULL DEFAULT 'Personal Calander',
	`isEnabled` int NOT NULL DEFAULT 1,
	`includeCompleted` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`revokedAt` timestamp,
	CONSTRAINT `calendarFeeds_id` PRIMARY KEY(`id`),
	CONSTRAINT `calendar_feeds_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `pushSubscriptions` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`endpoint` varchar(512) NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`status` enum('active','disabled','expired') NOT NULL DEFAULT 'active',
	`failureReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pushSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_subscriptions_endpoint_unique` UNIQUE(`endpoint`)
);
--> statement-breakpoint
CREATE INDEX `calendar_feeds_workspace_idx` ON `calendarFeeds` (`workspaceId`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_workspace_status_idx` ON `pushSubscriptions` (`workspaceId`,`status`);
