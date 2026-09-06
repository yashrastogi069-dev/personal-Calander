-- Additive upgrade for an existing PostgreSQL planner. Also accepts the earlier
-- standalone 0013 identity rename. No workspace is automatically claimed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'openId') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'supabaseUserId') THEN
      RAISE EXCEPTION 'Both identity columns exist; inspect the database before migrating.';
    END IF;
    ALTER TABLE public.users RENAME COLUMN "openId" TO "supabaseUserId";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.users'::regclass AND conname = 'users_openId_unique') THEN
    ALTER TABLE public.users RENAME CONSTRAINT "users_openId_unique" TO "users_supabaseUserId_unique";
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS "ownerSupabaseUserId" varchar(64);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.workspaces'::regclass AND conname = 'workspaces_ownerSupabaseUserId_unique') THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT "workspaces_ownerSupabaseUserId_unique" UNIQUE ("ownerSupabaseUserId");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.workspaces'::regclass AND conname = 'workspaces_ownerSupabaseUserId_users_supabaseUserId_fk') THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT "workspaces_ownerSupabaseUserId_users_supabaseUserId_fk"
      FOREIGN KEY ("ownerSupabaseUserId") REFERENCES public.users ("supabaseUserId");
  END IF;
END $$;
--> statement-breakpoint
-- All planner access goes through the authenticated server. Browser Supabase
-- keys must not read these tables directly. The server's database owner retains
-- access. Existing policies are untouched and must be inspected before release.
DO $$
DECLARE planner_table text;
BEGIN
  FOREACH planner_table IN ARRAY ARRAY[
    'aiDrafts','calendarFeeds','categories','dailyCheckIns','dailyPlanItems',
    'dailyPlans','externalEvents','focusSessions','goalMilestones','goals',
    'habitCheckIns','habits','integrationConnections','planningAvailabilityExceptions',
    'planningTemplates','projects','pushDeliveries','pushSubscriptions','reminderRules',
    'reminderSchedulers','reviewSessions','savedViews','scheduleProposals',
    'taskDependencies','taskOccurrences','taskReservationRollovers','tasks','users',
    'weeklyObjectives','workspaces'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', planner_table);
  END LOOP;
END $$;
