CREATE TABLE "commitmentResolutions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"operationId" varchar(128) NOT NULL,
	"dailyPlanItemId" varchar(64) NOT NULL,
	"taskId" varchar(64) NOT NULL,
	"occurrenceId" varchar(64),
	"action" text NOT NULL,
	"originalScope" text NOT NULL,
	"revisedScope" text,
	"resolvedToLocalDate" varchar(10),
	"returnLocalDate" varchar(10),
	"decisionNote" text,
	"timezone" varchar(64) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "commitmentResolutions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projectDependencies" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"projectId" varchar(64) NOT NULL,
	"dependsOnProjectId" varchar(64) NOT NULL,
	"dependencyType" text DEFAULT 'hard' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projectDependencies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "intentionKind" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "successCriteria" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "standards" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "reviewCadence" text;--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "nextReviewLocalDate" varchar(10);--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "riskLevel" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "riskNote" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "nextReviewLocalDate" varchar(10);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "accountabilityLevel" text DEFAULT 'structured' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "commitment_resolutions_workspace_operation_unique" ON "commitmentResolutions" USING btree ("workspaceId","operationId");--> statement-breakpoint
CREATE INDEX "commitment_resolutions_workspace_item_idx" ON "commitmentResolutions" USING btree ("workspaceId","dailyPlanItemId");--> statement-breakpoint
CREATE INDEX "project_dependencies_workspace_project_idx" ON "projectDependencies" USING btree ("workspaceId","projectId");--> statement-breakpoint
CREATE UNIQUE INDEX "project_dependency_unique" ON "projectDependencies" USING btree ("projectId","dependsOnProjectId");