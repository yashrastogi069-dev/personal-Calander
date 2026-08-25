ALTER TABLE `tasks` ADD `clientRequestId` varchar(64);--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_workspace_client_request_unique` UNIQUE(`workspaceId`,`clientRequestId`);