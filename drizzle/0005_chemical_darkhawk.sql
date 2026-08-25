ALTER TABLE `pushDeliveries` ADD `idempotencyKey` varchar(255);--> statement-breakpoint
ALTER TABLE `pushDeliveries` ADD CONSTRAINT `push_deliveries_idempotency_unique` UNIQUE(`idempotencyKey`);