CREATE TABLE "focusSessionSegments" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"focusSessionId" varchar(64) NOT NULL,
	"startedAt" timestamp NOT NULL,
	"endedAt" timestamp NOT NULL,
	"localDate" varchar(10) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"activeSeconds" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "focusSessions" ADD COLUMN "habitId" varchar(64);--> statement-breakpoint
ALTER TABLE "focusSessions" ADD COLUMN "nextStepAction" text;--> statement-breakpoint
ALTER TABLE "focusSessions" ADD COLUMN "nextStepTaskId" varchar(64);--> statement-breakpoint
CREATE INDEX "focus_segments_workspace_session_time_idx" ON "focusSessionSegments" USING btree ("workspaceId","focusSessionId","startedAt");--> statement-breakpoint
CREATE INDEX "focus_segments_workspace_date_idx" ON "focusSessionSegments" USING btree ("workspaceId","localDate");