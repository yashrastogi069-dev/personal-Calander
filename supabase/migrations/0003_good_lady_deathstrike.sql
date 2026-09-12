CREATE TABLE "syncConflicts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"operationId" varchar(128) NOT NULL,
	"entity" varchar(48) NOT NULL,
	"entityId" varchar(64) NOT NULL,
	"field" varchar(80) NOT NULL,
	"baseValue" jsonb,
	"localValue" jsonb,
	"serverValue" jsonb,
	"serverVersion" integer NOT NULL,
	"state" text DEFAULT 'needs_review' NOT NULL,
	"resolvedValue" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"resolvedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "syncConflicts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "syncOperationReceipts" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"operationId" varchar(128) NOT NULL,
	"entity" varchar(48) NOT NULL,
	"entityId" varchar(64) NOT NULL,
	"kind" varchar(32) NOT NULL,
	"outcome" text NOT NULL,
	"result" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "syncOperationReceipts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "sync_conflicts_operation_field_unique" ON "syncConflicts" USING btree ("workspaceId","operationId","field");--> statement-breakpoint
CREATE INDEX "sync_conflicts_workspace_state_idx" ON "syncConflicts" USING btree ("workspaceId","state","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_receipts_workspace_operation_unique" ON "syncOperationReceipts" USING btree ("workspaceId","operationId");--> statement-breakpoint
CREATE INDEX "sync_receipts_workspace_created_idx" ON "syncOperationReceipts" USING btree ("workspaceId","createdAt");