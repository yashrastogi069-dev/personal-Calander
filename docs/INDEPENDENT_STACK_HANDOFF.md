# Independent stack: current workbench handoff

The Supabase project contains real planner data. Work only on `dev/personal-calendar-workbench`; never merge into `main` without the user's explicit instruction. This document supersedes earlier disposable-database, external-identity, and disabled-scheduler instructions.

## Implemented in this branch

- Google OAuth and email/password use Supabase Auth. Bearer tokens are validated server-side. Durable application identity is integer `users.id`, linked through UUID `users.authUserId`; earlier identifiers remain in `users.legacyExternalId`.
- Workspaces use nullable integer `ownerUserId`. Existing workspaces stay unclaimed until an explicit assignment. Every planner/file procedure checks the current account's workspace ownership. Sign-out/account changes clear cached private data.
- Auth and workspace failures have bounded waits and visible recovery. An authenticated unlinked account sees connection instructions.
- Private Supabase bucket `planner-files` supports PDF, plain text, JSON, JPEG, PNG, and WebP up to 20 MiB. Metadata, request deduplication, object verification, deletion, and 300-second download links run through the owned server boundary.
- Deleted/failed file metadata remains durable cleanup work. The scheduled worker repeatedly removes matching objects, including uploads arriving after cancellation. It preserves ownership checks and retries failures.
- One shared authenticated `/api/scheduled/reminder` endpoint dispatches existing VAPID reminders and file cleanup independently. Supabase Cron installation SQL runs it every five minutes using Vault values.
- Vercel Web Analytics is mounted once, without custom events or planner fields. Its page URLs discard queries/fragments and unknown paths. Private planner insights and the existing design remain intact.
- Retired runtime/template dependencies and current source/build references have been removed. Historical SQL files remain migration provenance, not current migration commands.

## Upgrade the populated database safely

1. Read-only audit first: confirm project identity, PostgreSQL tables/columns, exact workspace and user IDs, row counts, migration journal, bucket contents, and all current RLS policies. Check for preliminary ownership columns or schema variants before choosing an upgrade.
2. Capture a recoverable database backup/export plus inventory/backups of any existing storage objects. Record counts and identifiers before changing anything. Never assume this project is empty or silently substitute the frozen main deployment's database.
3. For supported existing baseline tables, review `supabase/migrations/0001_independent_ownership.sql` and apply it transactionally. It accepts exactly one earlier identity column, retains provenance, adds the durable auth/ownership fields, and enables RLS without assigning or deleting records. Ambiguous columns fail for manual inspection.
4. Review and apply `supabase/migrations/0002_private_planner_files.sql` afterward. It adds metadata and the private bucket/policies. Inspect existing Storage policies because permissive policies combine; an older broad policy can undermine newly added owner-folder policies.
5. Reconcile the actual schema with the migration journal before using Drizzle's runner. Never replay `0000_loving_madrox.sql` over existing data. Baseline + upgrades are only for a verified empty database. `pnpm db:generate` is offline generation; `pnpm db:migrate` applies changes.
6. Sign in to persist the validated Supabase profile. Verify its UUID `users.authUserId`, internal integer `users.id`, and the chosen existing `workspaces.id`. Never link by email alone or copy a prior provider ID into the new UUID field.
7. Explicitly assign only the reviewed workspace to that internal user ID, guarded by `ownerUserId IS NULL`. Lock and inspect the target row in a transaction, require exactly one returned row, and refuse to overwrite another owner. This planner intentionally permits one workspace per account.
8. Compare record counts/relationships and test the actual account's reads, reload, sign-out, and cross-account denial. Any write verification must use named disposable records and remove only those records afterward.

Live upgrade, ownership assignment, and backup verification have not been performed by these offline implementation tasks.

## Runtime and deployment

The complete configuration is in [Supabase/Vercel deployment](SUPABASE_VERCEL_DEPLOYMENT.md) and `.env.example`. Modern Supabase publishable keys map to `VITE_SUPABASE_ANON_KEY`; modern secret keys map to the server-only `SUPABASE_SERVICE_ROLE_KEY`. These are the application's existing variable names, not a requirement to choose legacy key formats.

Use a separate user-owned Vercel project with repository root and the checked-in `vercel.json`. Set public keys before building, configure Google/email redirect origins, and keep database/admin/VAPID/cron secrets server-only. A preview deployment does not require merging to main.

For scheduled work, set `APP_ORIGIN` and `REMINDER_CRON_SECRET`, create Vault values `personal_calendar_reminder_url` and `personal_calendar_reminder_secret`, then review/install `supabase/cron/reminder_sweep.sql`. Confirm the endpoint is reachable by automation through any deployment protection. Do not disable the shared job merely to pause reminder rules: file reconciliation also depends on it.

## Local verification and preview

Fresh integrated verification on 2026-09-06: `pnpm check` passed; `pnpm test` passed **200 tests across 48 files**; `pnpm build:client` passed. Client build transformed 2464 modules; the main chunk is 1250.17 kB (358.05 kB gzip), with the existing large-chunk warning. The Vercel server bundle is 223.5 kB. Dependency/runtime build differences can change bundle size; performance optimization is separate work.

`scripts/preview-auth-states.py` and `scripts/preview-linked-planner.py` use Playwright interception with synthetic account/planner data. They block remote requests, intercept all APIs, disable service-worker interception, and fix the preview date. These screenshots prove rendered states, not live OAuth or real-data connectivity. Artifacts live outside Git in `C:/Users/win 10/personal-Calander-analysis/`.

Fresh browser results: eight auth/recovery/unlinked states and linked Home at desktop 1440x1000 and phone 390x844 passed required rendering, runtime-error, private-request and overflow checks. Ten screenshots were captured. An additional interaction check found that the visible phone Sign out button is covered by the fixed bottom navigation; desktop pointer sign-out succeeds. This phone UI issue is recorded in the external results JSON and remains to be fixed. No forced clicks or style overrides were used.

Example local run in PowerShell (requires Python Playwright/Chromium):

```powershell
$env:PORT = '14773'
$env:NODE_ENV = 'development'
$env:VITE_HMR_CLIENT_PORT = '14773'
node --import tsx server/_core/index.ts
# In another terminal:
python scripts/preview-auth-states.py --url http://localhost:14773 --with-linked
```

The no-watch server avoids the observed Windows watch restart loop. Match the HMR client port to the actual local port. The generic with_server.py helper can leave its Windows child server running; confirm and stop only the preview process you started before restarting it.

## Rollback and remaining live work

Keep the pre-change backup, deployment configuration, VAPID pair, workspace IDs, and auth mapping. On a failed rollout, stop new writes and return traffic to a known compatible deployment. Keep additive schema fields and file metadata; do not drop tables, purge cleanup tombstones, reset accounts, or rotate VAPID keys as a repair. Pause the named Cron job only when necessary, knowing cleanup pauses too. Restore from backup only after comparing post-backup writes and obtaining explicit direction.

Remaining: live project/backup audit, reviewed migration and exact account assignment, runtime credentials, real Google/email sign-in and planner checks, Vercel deployment, Web Analytics enablement, Cron activation, and a real device delivery check. Offline tests do not establish completion of those steps.
