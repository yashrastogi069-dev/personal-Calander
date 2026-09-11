-- Additive identity and ownership upgrade for an existing PostgreSQL planner.
-- Legacy provider identifiers remain provenance and no workspace is claimed.
DO $$
DECLARE
  identity_column_count integer;
BEGIN
  SELECT count(*)::integer
    INTO identity_column_count
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name = 'users'
     AND column_name IN ('openId', 'supabaseUserId', 'legacyExternalId');

  IF identity_column_count > 1 THEN
    RAISE EXCEPTION 'More than one legacy identity column exists; inspect the database before migrating.';
  END IF;
  IF identity_column_count = 0 THEN
    RAISE EXCEPTION 'No legacy identity column exists; inspect the database before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'openId'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN "openId" TO "legacyExternalId";
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'supabaseUserId'
  ) THEN
    ALTER TABLE public.users RENAME COLUMN "supabaseUserId" TO "legacyExternalId";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.users'::regclass AND conname = 'users_openId_unique'
  ) THEN
    ALTER TABLE public.users RENAME CONSTRAINT "users_openId_unique" TO "users_legacyExternalId_unique";
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.users'::regclass AND conname = 'users_supabaseUserId_unique'
  ) THEN
    ALTER TABLE public.users RENAME CONSTRAINT "users_supabaseUserId_unique" TO "users_legacyExternalId_unique";
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.users'::regclass AND conname = 'users_legacyExternalId_unique'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT "users_legacyExternalId_unique" UNIQUE ("legacyExternalId");
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.users ALTER COLUMN "legacyExternalId" TYPE varchar(128);
--> statement-breakpoint
ALTER TABLE public.users ALTER COLUMN "legacyExternalId" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "authUserId" uuid;
--> statement-breakpoint
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "avatarUrl" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.users'::regclass AND conname = 'users_authUserId_unique'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT "users_authUserId_unique" UNIQUE ("authUserId");
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS "ownerUserId" integer;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.workspaces'::regclass AND conname = 'workspaces_ownerUserId_unique'
  ) THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT "workspaces_ownerUserId_unique" UNIQUE ("ownerUserId");
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.workspaces'::regclass AND conname = 'workspaces_ownerUserId_users_id_fk'
  ) THEN
    ALTER TABLE public.workspaces ADD CONSTRAINT "workspaces_ownerUserId_users_id_fk"
      FOREIGN KEY ("ownerUserId") REFERENCES public.users ("id");
  END IF;
END $$;
--> statement-breakpoint
-- Browser Supabase keys must not read planner tables directly. Existing policies
-- remain intact; the authenticated server's database owner retains access.
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
