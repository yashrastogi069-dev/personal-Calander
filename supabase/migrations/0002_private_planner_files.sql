-- Additive migration. Existing planner rows and ownership are never changed.
CREATE TABLE IF NOT EXISTS public."plannerFiles" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"workspaceId" varchar(64) NOT NULL,
	"ownerUserId" integer NOT NULL,
	"requestId" varchar(128) NOT NULL,
	"objectPath" text NOT NULL,
	"fileName" varchar(255) NOT NULL,
	"mimeType" varchar(100) NOT NULL,
	"sizeBytes" integer NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"deletedAt" timestamp,
	"failureReason" text,
	CONSTRAINT "plannerFiles_objectPath_unique" UNIQUE("objectPath"),
	CONSTRAINT "plannerFiles_workspaceId_workspaces_id_fk" FOREIGN KEY ("workspaceId") REFERENCES public.workspaces(id),
	CONSTRAINT "plannerFiles_ownerUserId_users_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES public.users(id)
);
--> statement-breakpoint
ALTER TABLE "plannerFiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plannerFiles_workspace_request_unique" ON public."plannerFiles" USING btree ("workspaceId","requestId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "plannerFiles_workspace_status_idx" ON public."plannerFiles" USING btree ("workspaceId","status");
--> statement-breakpoint
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('planner-files', 'planner-files', false, 20971520,
  ARRAY['application/pdf','text/plain','application/json','image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET public = excluded.public,
  file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
--> statement-breakpoint
DO $policies$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'planner_files_owner_select') THEN
    CREATE POLICY planner_files_owner_select ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'planner-files' AND split_part(name, '/', 1) = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'planner_files_owner_insert') THEN
    CREATE POLICY planner_files_owner_insert ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'planner-files' AND split_part(name, '/', 1) = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'planner_files_owner_update') THEN
    CREATE POLICY planner_files_owner_update ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'planner-files' AND split_part(name, '/', 1) = auth.uid()::text)
      WITH CHECK (bucket_id = 'planner-files' AND split_part(name, '/', 1) = auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'planner_files_owner_delete') THEN
    CREATE POLICY planner_files_owner_delete ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'planner-files' AND split_part(name, '/', 1) = auth.uid()::text);
  END IF;
END
$policies$;
