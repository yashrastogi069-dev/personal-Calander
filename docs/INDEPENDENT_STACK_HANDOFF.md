# Independent stack: current workbench handoff

> 2026-09-12 current note: the approved roadmap is documented in `PWA_SYNC_NOTIFICATIONS_ROADMAP.md`. Phase 1 is implemented and verified locally on the isolated `work/pwa-foundation` branch. It is not yet claimed Preview- or real-iPhone-complete. Phase 2 synchronization and Phase 3 notifications/integrations have not started.

## 2026-09-12 reliable PWA implementation

The isolated `work/pwa-foundation` branch implements Phase 1 without changing the database, planner IDs, workspace ownership, authentication records, or server data. Commits `5eb764d..10a7344` provide:

- manifest identity, standalone configuration, Today/New Task shortcuts, Apple metadata, and reproducibly generated 180/192/512 standard and maskable icons;
- a build-time SHA-256 release identifier and exact 20-file shell list injected into the single repository-owned worker;
- network-first documents, cache-first fingerprinted assets, bounded seven-day/40-entry static runtime caching, and strict exclusion of API, cross-origin, and non-GET requests;
- controlled waiting-worker activation, a one-reload guard, durable quick-capture check, bounded `/api/health` connectivity verification, and contextual install/offline/reconnected UI;
- allowlisted shortcut consumption that preserves unrelated URL parameters; and
- a phone sign-in layout correction so PWA status does not cover account controls.

Latest generated shell release: `a5f1f2018fa6b158`. Main client artifacts are `assets/index-Cwoo2EKO.js` and `assets/index-BbIcsZJO.css`. The only build warning is the existing main-chunk size warning.

Integrated local gate: `npm run check` passed; all 56 Vitest files passed with 239 tests and 3 environment-dependent skips; `npm run build:client` passed.

Local browser evidence is outside Git at `C:/Users/win 10/AppData/Local/Temp/personal-calander-pwa-verification/`. Four production PWA scenarios passed: cached offline relaunch at 1440x1000 and 390x844, honest cold-offline failure before any worker exists, and explicit waiting-update activation. Cache inspection found only the 20 public shell URLs; the unrelated sentinel cache survived app cleanup; runtime and unexpected console errors were empty. Eight synthetic auth/recovery states and two linked planner layouts also passed. The exact dark task-lane colors and mobile More/settings flow remain intact.

Remaining Phase 1 gates: merge only into `dev/personal-calendar-workbench`, push and verify its Vercel Preview, then test Home Screen icon/cropping, standalone chrome, cached launch, reconnect, and update activation on a real iPhone. Roll back by routing to the last compatible deployment; never clear IndexedDB, quick captures, auth, push subscriptions, planner records, or unrelated caches. The existing authenticated-phone Sign out obstruction remains a separate tracked UI item.

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

Live upgrade, ownership assignment, and backup verification have not been performed. The read-only audit below does not authorize these changes.

## Observed read-only audit and current stop gate

On 2026-09-06, the current local credentials passed all 10 service tests: public Auth settings, server REST HEAD with zero records, and PostgreSQL metadata/count access. `node scripts/audit-supabase.mjs` connected and correctly exited **1**, reporting `no-existing-workspace`. The structural report is outside Git at `C:/Users/win 10/personal-Calander-analysis/supabase-structural-audit-2026-09-06.json`.

- All 30 expected planner tables exist; every aggregate row count is zero, including users, workspaces, and tasks. RLS is enabled on all 30 tables.
- Users retain `openId`; `authUserId`, workspace `ownerUserId`, and `plannerFiles` are absent. This identity shape is an accepted upgrade input, but the empty dataset fails the existing-workspace gate.
- No public/storage policy names were returned. The private `planner-files` bucket is absent.
- Vault is installed; pg_cron and pg_net are absent. There is no Cron job catalog or named reminder job.
- Neither the Drizzle nor Supabase migration journal table exists.

The controller independently identified this connection as the previously configured empty project. A subsequent controller audit of the correct alternate project found 46 public tables, nonzero unrelated learning-table counts, and zero rows in every planner table; the planner-files bucket, Cron, and migration journals are also absent there. These are distinct observations: the saved 30-table report above belongs to the earlier connection, not the later 46-table project. Neither audit located the user's existing planner data. **Stop: identify the data-bearing project or a verified recoverable export and reconcile that target before requesting any migration, ownership, push, or deployment approval.** Working credentials and an empty planner schema do not prove that the intended data is available. No existing workspace/account IDs can be selected from these audits, and no IDs have been invented. Preserve the alternate project's unrelated learning data as well.

## 2026-09-11 login-repair update

The user explicitly authorized a login repair on the only currently accessible Supabase project (`dwiudauuuxzstbavkkqa`). A fresh read-only MCP audit verified that all planner tables were empty (`users`, `workspaces`, and `tasks` each had zero rows), `users.openId` was the single legacy identity column, and the durable identity/ownership columns were absent. Auth contained one account, but no application user could be persisted. The reviewed `0001_independent_ownership.sql` hash matched the recorded value and was applied in one transaction with preconditions requiring that exact empty state. It renamed only the legacy identity field, added `users.authUserId`, `users.avatarUrl`, and `workspaces.ownerUserId`, and enabled RLS on existing planner tables. It created, deleted, or assigned no planner record.

Post-migration verification confirmed `authUserId`, `legacyExternalId`, and `ownerUserId` exist. After the user completed one successful Preview sign-in, the application created exactly one planner user while all planner record tables remained empty. A guarded transaction then created one default workspace and linked it to that sole planner user; it refused to run unless there was exactly one linked user, zero workspaces, and zero tasks, goals, projects, and habits. The result is one linked user and one owned workspace, with no historical planner record changed. `0002_private_planner_files.sql`, Storage, Cron, and any historical data import remain unapplied. Vercel Production and Preview now have the required public `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` build variables; the branch preview health endpoint returned 200. The historical planner data is still not available in this Supabase project. Do not import records or alter the remaining unrelated tables until the old `DATABASE_URL` data source is backed up and reconciled.

The audit queries only structural metadata and aggregates inside a repeatable-read, read-only transaction with a 10-second statement timeout. It never fetches planner rows, object names, push endpoints, policy expressions, Cron commands, or Vault values. Output is an explicit projection; errors omit connection details. `AUDIT_WORKSPACE_ID` and positive integer `AUDIT_OWNER_USER_ID` can validate privately selected targets using counts, without printing their values. Multiple workspaces require a target; an owned target requires an explicit matching internal account. Audit success is a structural check, not automatic rollout permission.

## Prepared operations after the target is verified

These commands are review templates, **not an approved operation against the current empty project**. First identify the intended project, run a fresh audit, and privately verify its selected workspace, Supabase Auth UUID, and integer user ID. Record those exact IDs in the local rollout record before replacing any placeholders. Do not paste secrets into committed files or logs.

1. Configure PostgreSQL connection service `personal_calendar_verified` locally for the freshly audited target, with its password in the local password file. Confirm its project matches the authenticated application's project. Capture and test a recoverable backup before writes; database dumps do not back up Storage object bodies. Inventory/back up those separately through the owner account. Review commands:

   ```powershell
   pg_dump --dbname='service=personal_calendar_verified' --format=custom --file='C:/Users/win 10/personal-Calander-analysis/pre-independent-rollout.dump'
   pg_restore --list 'C:/Users/win 10/personal-Calander-analysis/pre-independent-rollout.dump'
   node scripts/audit-supabase.mjs --output 'C:/Users/win 10/personal-Calander-analysis/verified-before-rollout.json'
   ```

   A successful list is inventory validation; additionally test restore into an isolated disposable database before approving the production upgrade. Never restore over the existing planner as a rehearsal.

2. Review these exact files in order, recompute SHA-256, and reconcile missing journals manually. Never run the baseline migration on populated tables:

   | Order | File | SHA-256 |
   | --- | --- | --- |
   | 1 | `supabase/migrations/0001_independent_ownership.sql` | `FD3388E70581E354E8B7CC64DC2D9C1190C84D356B659112FAD28730D53356EA` |
   | 2 | `supabase/migrations/0002_private_planner_files.sql` | `F15EFC4CBD2F74FC8C0A24DA88974F574438FAB9A63AE3CA1D6381FA6A317606` |
   | 3, after deployment/Vault | `supabase/cron/reminder_sweep.sql` | `1F98F97E62F0F79964DAFDB133DC86EBF0E9F581A8C4E7E61F36A95E9D74F472` |

   ```powershell
   psql 'service=personal_calendar_verified' -X --set=ON_ERROR_STOP=1 --single-transaction --file=supabase/migrations/0001_independent_ownership.sql --file=supabase/migrations/0002_private_planner_files.sql
   ```

   The second file installs the bucket and four `planner_files_owner_*` Storage policies. Before execution, review existing bucket settings, object backups, and all Storage policies in the dashboard; policy names alone cannot establish whether existing permissive rules are safe. This migration can change an existing bucket's configuration. The audit intentionally omits object contents and policy expressions.

3. Save and compare the full audit's per-table counts immediately before/after the upgrade. At minimum, this aggregate check must agree before any sign-in or new writes:

   ```sql
   BEGIN READ ONLY;
   SET LOCAL statement_timeout = '10s';
   SELECT 'users' AS entity, count(*) FROM public.users
   UNION ALL SELECT 'workspaces', count(*) FROM public.workspaces
   UNION ALL SELECT 'tasks', count(*) FROM public.tasks
   UNION ALL SELECT 'goals', count(*) FROM public.goals
   UNION ALL SELECT 'projects', count(*) FROM public.projects
   UNION ALL SELECT 'habits', count(*) FROM public.habits;
   COMMIT;
   ```

   Sign-in may subsequently add one application user. Explain any delta explicitly; do not accept unexplained planner-record changes. Validate the new Auth UUID against the signed-in account, then record the chosen integer `users.id` and existing `workspaces.id`. Ownership assignment is intentionally not executable yet: the audited target has zero candidate records. The eventual transaction must lock the reviewed workspace, require the reviewed UUID/user mapping, refuse any different owner, guard `ownerUserId IS NULL`, require exactly one updated row, and preserve the one-workspace-per-account rule.

4. After the target/backup/migration/ownership record is reviewed and approved, select the intended Vercel project, configure server-only credentials and Auth redirect origins, and review these exact branch commands:

   ```powershell
   git push origin HEAD:dev/personal-calendar-workbench
   pnpm dlx vercel link
   pnpm dlx vercel deploy
   ```

   These create a branch preview without merging main. Verify project selection, deployment protection, actual OAuth, account isolation, real planner reads/reload/sign-out, and Web Analytics before enabling the scheduler. The final preview URL remains unknown until deployment.

5. In the verified Supabase project, store the deployed HTTPS `/api/scheduled/reminder` URL as Vault value `personal_calendar_reminder_url`, and the runtime's matching `REMINDER_CRON_SECRET` as `personal_calendar_reminder_secret`. Use the dashboard so secret literals do not enter shell history. Then review:

   ```powershell
   psql 'service=personal_calendar_verified' -X --set=ON_ERROR_STOP=1 --file=supabase/cron/reminder_sweep.sql
   node scripts/audit-supabase.mjs --output 'C:/Users/win 10/personal-Calander-analysis/verified-after-rollout.json'
   ```

   Expect one named Cron job and the private bucket with a 20 MiB limit. Test actual push delivery on a real device and file cleanup across scheduler sweeps. A paused reminder rule must not disable storage cleanup.

6. Roll back routing to the previously verified compatible deployment before changing data. Preserve additive schema, planner files, and cleanup tombstones. If the new scheduler must stop, review `SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'personal-calendar-reminder-sweep';`; file cleanup pauses too. If newly introduced Storage policies must be removed, review the four explicit `DROP POLICY IF EXISTS planner_files_owner_select/insert/update/delete ON storage.objects` statements individually, preserving all pre-existing policies and the bucket/objects. Dropping policies restricts browser access; it is not a bucket rollback. An ownership rollback must clear only the newly assigned target matching both recorded IDs, using `UPDATE public.workspaces SET "ownerUserId" = NULL WHERE id = :verified_workspace_id AND "ownerUserId" = :verified_user_id` in a checked transaction. No exact rollback assignment is authorized until those IDs exist in the rollout record. Never reset the database or restore a backup over later writes without a reconciliation decision.

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

Remaining: resolve the verified empty-project mismatch, audit/back up the actual planner target, review migrations and exact account assignment, confirm runtime configuration and real Google/email sign-in/planner checks, fix the phone Sign out obstruction, deploy the Vercel preview, enable Web Analytics/Cron, and check real device delivery. Credential probes and offline tests do not establish completion of those steps.

## 2026-09-11 live checkpoint (supersedes earlier empty-project status)

- The independent ownership migration (`0001_independent_ownership.sql`) was applied only after guarded checks confirmed the target planner tables were empty. It was not replayed over records.
- A successful Supabase Auth account is now linked to one application user and one newly-created, owner-linked `My planning workspace`. The creation transaction required zero planner data and preserved all existing IDs/history.
- The dev branch is deployed as a ready Vercel preview. Public Supabase URL/anon-key variables are configured for Preview and Production; server-only values remain server-only. `/api/health` returned `200` on the preview.
- The phone planner has an in-progress iPhone-first update: safe-area-aware bottom navigation, 44pt touch controls, task gestures (left complete, right archive reveal, long-press edit), and a device-local “Customize phone” sheet for tab pinning, destination ordering, and compact/comfortable density. TypeScript and the production client build passed after this update.

Not yet performed: private file storage migration (`0002`), Apple Calendar/reminder connection, push notification/device verification, Cron/Vault setup, and the separately tracked authenticated-phone Sign out obstruction. Preferences intentionally remain device-local until a separate syncable account-preferences schema is approved.

## 2026-09-11 phone overlay correction

The initial customizable phone navigation did not meet the mobile contract. Root cause: the `More` overlay was rendered inside a sticky mobile rail with `backdrop-filter`, which establishes a containing block. Its `position: fixed` layer therefore used the rail instead of the viewport and could trap the interface. The correction removes that containing context on phone, fixes the rail to the actual viewport bottom, and gives More/settings independent full-viewport overlay layers above it. `scripts/preview-linked-planner.py` now verifies the 390×844 More → Customize & settings → Done flow and asserts that the overlay spans the viewport. The premium-phone design contract is in `PHONE_PREMIUM_REDESIGN_CONTRACT.md`.

The service-worker shell cache was also still permanently named `personal-calander-shell-v1`. The phone PWA update path now advances to `v2`, removes older owned shell caches on activation, registers with `updateViaCache: "none"`, and requests an update after registration. This is intended to prevent installed iPhone PWAs from continuing to display an older successful deployment.

## Production/Preview data split confirmed on 2026-09-11

Read-only bundle inspection confirmed that `https://personal-calander.vercel.app` served the August 26 production build (`index-DduYup5E.js`) and contained no Supabase client project URL. The dev-branch alias served the independent build (`index-B6Bui5tb.js`) and targets `dwiudauuuxzstbavkkqa.supabase.co`. A fresh read-only count on that Supabase project returned one user, one workspace, and zero tasks, goals, projects, and habits.

Therefore, a Git merge or Vercel promotion updates code but does not migrate planner records from the old phone app. The independent code selects `SUPABASE_DB_URL` and the Supabase Auth client, so the new empty workspace becomes visible while legacy records remain in the legacy data source. On 2026-09-11 the user stated that the old data was not required and explicitly authorized merging and deploying the workbench after the requested Task-lane colors were verified. This approval does not authorize deleting, resetting, or overwriting either data source.

## Pre-merge Task-lane palette verification on 2026-09-11

The workbench's later light-lane override was replaced with the exact dark R20/main palette: To do `#2a405d` → `#15283f`, In progress `#155b59` → `#0b393b`, and Completed `#1d4b3d` → `#102f27`. New Playwright assertions check all three computed `--lane-surface` values and horizontal overflow. The linked synthetic flow passed at desktop 1440×1000 and iPhone 390×844, and both rendered screenshots were visually reviewed. `npm run check` and `npm run build:client` also passed; Vite's existing large-chunk warning remains non-blocking.
