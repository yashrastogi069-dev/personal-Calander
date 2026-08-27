CREATE TABLE `taskReservationRollovers` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`taskId` varchar(64) NOT NULL,
	`fromLocalDate` varchar(10) NOT NULL,
	`priorPlannedStartAt` timestamp NOT NULL,
	`priorPlannedEndAt` timestamp NOT NULL,
	`appliedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskReservationRollovers_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_rollover_task_date_unique` UNIQUE(`taskId`,`fromLocalDate`)
);
--> statement-breakpoint
ALTER TABLE `tasks` ADD `rescheduleCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `task_rollovers_workspace_date_idx` ON `taskReservationRollovers` (`workspaceId`,`fromLocalDate`);--> statement-breakpoint
CREATE INDEX `tasks_workspace_reschedule_idx` ON `tasks` (`workspaceId`,`rescheduleCount`);