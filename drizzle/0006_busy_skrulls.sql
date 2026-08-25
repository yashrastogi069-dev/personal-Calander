CREATE TABLE `reminderSchedulers` (
	`id` varchar(64) NOT NULL,
	`scheduleCronTaskUid` varchar(65) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminderSchedulers_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminderSchedulers_scheduleCronTaskUid_unique` UNIQUE(`scheduleCronTaskUid`)
);
