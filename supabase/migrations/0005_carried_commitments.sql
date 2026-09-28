-- Separate carried work from the recurrence series and from daily-plan items.
-- This migration is additive and must be reviewed/applied after 0004; it is not applied by the application.
-- Deploy a compatible reader before enabling carry writes. Once carries exist, do not roll application code
-- back to a pre-0005 reader; a database rollback would need a data-preserving conversion, not DROP TABLE.
CREATE TABLE "carriedCommitments" (
  "id" varchar(64) PRIMARY KEY NOT NULL,
  "workspaceId" varchar(64) NOT NULL,
  "taskId" varchar(64) NOT NULL,
  "rootDailyPlanItemId" varchar(64) NOT NULL,
  "createdByResolutionId" varchar(64) NOT NULL,
  "targetLocalDate" varchar(10) NOT NULL,
  "scope" text NOT NULL,
  "state" text DEFAULT 'pending' NOT NULL,
  "resolvedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  CONSTRAINT "carried_commitments_resolution_fk" FOREIGN KEY ("createdByResolutionId") REFERENCES "commitmentResolutions"("id"),
  CONSTRAINT "carried_commitments_task_fk" FOREIGN KEY ("taskId") REFERENCES "tasks"("id"),
  CONSTRAINT "carried_commitments_root_item_fk" FOREIGN KEY ("rootDailyPlanItemId") REFERENCES "dailyPlanItems"("id")
);--> statement-breakpoint
ALTER TABLE "carriedCommitments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "carried_commitments_created_by_resolution_unique" ON "carriedCommitments" ("createdByResolutionId");--> statement-breakpoint
CREATE INDEX "carried_commitments_workspace_date_state_idx" ON "carriedCommitments" ("workspaceId", "targetLocalDate", "state");--> statement-breakpoint
ALTER TABLE "commitmentResolutions" ADD COLUMN "sourceCarryId" varchar(64);--> statement-breakpoint
ALTER TABLE "commitmentResolutions" ADD COLUMN "sourceCarryVersion" integer;--> statement-breakpoint
ALTER TABLE "commitmentResolutions" ADD COLUMN "requestFingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "commitmentResolutions" ADD CONSTRAINT "commitment_resolutions_source_carry_fk" FOREIGN KEY ("sourceCarryId") REFERENCES "carriedCommitments"("id");--> statement-breakpoint
CREATE INDEX "commitment_resolutions_workspace_source_carry_idx" ON "commitmentResolutions" ("workspaceId", "sourceCarryId");--> statement-breakpoint
CREATE UNIQUE INDEX "commitment_resolutions_source_carry_version_unique" ON "commitmentResolutions" ("sourceCarryId", "sourceCarryVersion");
