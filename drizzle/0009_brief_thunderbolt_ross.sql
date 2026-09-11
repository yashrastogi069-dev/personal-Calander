CREATE TABLE `planningAvailabilityExceptions` (
	`id` varchar(64) NOT NULL,
	`workspaceId` varchar(64) NOT NULL,
	`localDate` varchar(10) NOT NULL,
	`isUnavailable` int NOT NULL DEFAULT 0,
	`workdayStartsAt` varchar(5),
	`workdayEndsAt` varchar(5),
	`breakMinutes` int,
	`note` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`version` int NOT NULL DEFAULT 1,
	CONSTRAINT `planningAvailabilityExceptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `planning_availability_exception_workspace_date_unique` UNIQUE(`workspaceId`,`localDate`)
);
