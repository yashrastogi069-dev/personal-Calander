DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'users'
      AND column_name = 'openId'
  ) THEN
    ALTER TABLE "users" RENAME COLUMN "openId" TO "supabaseUserId";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'users'::regclass
      AND conname = 'users_openId_unique'
  ) THEN
    ALTER TABLE "users" RENAME CONSTRAINT "users_openId_unique" TO "users_supabaseUserId_unique";
  END IF;
END $$;
