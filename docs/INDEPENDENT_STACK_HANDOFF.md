# Independent stack: current workbench handoff

This supersedes older statements that the database is disposable or has no important data. The user confirmed that it contains real planner data. Work only on `dev/personal-calendar-workbench`; do not merge into `main` without explicit instruction.

## Completed locally

- The active Home and Calendar routes now pass through Supabase authentication and server-resolved workspace ownership.
- Every planner tRPC procedure checks the signed-in account against the selected workspace. Browser-generated IDs no longer establish ownership. Cross-account query cache is cleared on sign-out/account changes.
- Existing workspaces are not claimed automatically. A signed-in account without an assigned workspace gets a visible connection/setup state.
- Authentication/bootstrap and query failures display recovery instead of a permanent skeleton. Session lookup and API requests have bounded waits.
- The migration chain uses `supabase/migrations`. Historical MySQL files in `drizzle` remain provenance and are not executed by current migration commands.
- Optional AI uses explicit user-owned provider settings; versioned endpoints are normalized correctly. PostgreSQL duplicate-delivery errors use code 23505.
- Unused legacy OAuth/debug dependencies were removed. Core runtime has no Manus/Forge/TiDB/MySQL endpoint or credential dependency.
- Local development and production launch commands work without Unix-only environment assignment.

## Preserve and upgrade the existing database

1. Inspect the selected Supabase project, table inventory, row counts, user identity columns, workspace IDs, existing RLS policies, and migration journal. Confirm whether this database actually contains the expected planner records.
2. Capture a recoverable database backup/export before applying schema changes. Do not point this branch at the frozen main deployment's database by accident.
3. For a populated PostgreSQL database with the baseline tables, review and apply **only** `supabase/migrations/0001_independent_ownership.sql` in a transaction. It accepts either `users.openId` or the already-renamed `users.supabaseUserId`, adds nullable ownership with uniqueness/FK constraints, and enables RLS on the 30 planner tables. It does not recreate, delete, or assign records. Existing policies are preserved and must be checked for unintended browser access.
4. Do not run `pnpm db:migrate` blindly on a database initially created by manually pasting SQL. First reconcile its Drizzle migration journal with the schema. Otherwise the migration runner may try to replay the baseline.
5. On a truly empty database only, `pnpm db:migrate` runs baseline + upgrade in order. `pnpm db:generate` generates future migrations for review; it does not apply them.
6. Sign in through the application so the validated Supabase account gets its planner `users` profile. An unlinked account will not see or modify any existing workspace.
7. Inspect the exact `users.supabaseUserId` and existing `workspaces.id`, then explicitly assign the chosen workspace to that account. The one-workspace-per-account constraint is deliberate for this private planner. Do not transfer a workspace already owned by another account without the user's instruction.
8. Compare record counts and verify sign-in, reload, task CRUD, Calendar, Habits, Focus, Review, sign-out, and cross-account denial. Use only named disposable records for write tests.

An assignment can be reviewed with the following SQL after replacing placeholders with verified identifiers. It updates only the ownership column and refuses to overwrite an existing owner:

```sql
BEGIN;
SELECT id, name, "ownerSupabaseUserId" FROM public.workspaces WHERE id = '<verified-workspace-id>' FOR UPDATE;
SELECT "supabaseUserId", email FROM public.users WHERE "supabaseUserId" = '<verified-supabase-user-id>';
UPDATE public.workspaces
SET "ownerSupabaseUserId" = '<verified-supabase-user-id>'
WHERE id = '<verified-workspace-id>' AND "ownerSupabaseUserId" IS NULL
RETURNING id, "ownerSupabaseUserId";
-- Commit only after verifying exactly the intended row was updated.
COMMIT;
```

## Vercel staging

- Use a separate user-owned Vercel project for `dev/personal-calendar-workbench`. Keep the existing main deployment intact.
- Root: repository root. The checked-in `vercel.json` builds `dist/public` plus the tRPC server bundle.
- Configure the four required Supabase values from `.env.example`. The two `VITE_` values are public build-time configuration; database/service-role secrets are server-only.
- Set Supabase Auth URLs for the chosen staging domain. Redeploy when public build-time values change.
- Push, analytics, external ICS fetch, and scheduled automation are separate optional services. No storage account is required. The scheduled-reminder endpoint deliberately returns 503 until an owned scheduler is implemented.
- Do not promote to permanent production until live authentication, ownership, data preservation, planner workflows, and phone checks pass.

## Verification and remaining work

Use `pnpm check`, `pnpm test`, and `pnpm build:client` for local checks. `pnpm test:services` explicitly loads local `.env` and performs read-only checks against real Supabase services. It is separate from offline tests so missing secrets cannot be mistaken for logic regressions.

The new tests execute the baseline and upgrade in embedded PostgreSQL, preserve sample existing records, verify compatibility with the earlier identity rename, and exercise cross-account read/write denial. Render tests verify sign-in, recovery, unlinked-account, and authenticated states. These are local tests, not proof of the live deployment.

Validation on 2026-09-06: 155 tests passed across 41 files; TypeScript and the client/server production build passed; Drizzle generation reported no schema differences. A 390x844 browser check verified both Home and Calendar configuration recovery, no premature private API requests, and no runtime errors. Separate simulated authenticated browser checks passed for account-service failure, an unlinked account, and workspace-service failure. The existing large JavaScript bundle warning remains for later performance work.

The official Supabase MCP connection was registered in read-only mode and OAuth login succeeded. This running session did not load the newly configured server, so reload Codex and resume this conversation before live inspection.

Live work remains: load the authenticated Supabase MCP tools in the session; inspect the selected project and backup state; apply the reviewed upgrade and exact account assignment; configure local/staging runtime credentials; verify real workflows; then deploy and validate Vercel. No live database migration or Vercel deployment was performed during preparation.
