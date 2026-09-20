# Independent stack: current workbench handoff

## 2026-09-21 Preview schema-compatibility repair

The workbench Preview returned `500` for `auth.workspace` because source schema definitions from the deferred Phase 4 migration caused ordinary reads to select `workspaces.accountabilityLevel` before that additive migration had been approved or applied. The database error was `42703: column "accountabilityLevel" does not exist`; this was a code/schema ordering error, not a lost workspace, account, or planner record. The repair makes ordinary workspace, goal, and project reads explicitly select only the established database columns until the reviewed Phase 4 migration is separately approved and applied. An isolated pre-migration PGlite regression test proves authenticated workspace loading and the initial snapshot succeed without the optional schema. No database, environment variable, or existing record is changed by this repair.

> 2026-09-12 current note: Phase 1 is deployed and online-verified in Production. Phase 2 secure synchronization and Phase 3 notification/calendar implementation are complete on `dev/personal-calendar-workbench` and awaiting final Preview/Production gates. Physical-iPhone offline/relaunch and notification-delivery checks are delegated to the user. Phase 4 remains separate.

## 2026-09-12 pre-Phase 4 settings and navigation correction

The workbench branch now has a first-class Settings destination on desktop and in the phone More sheet. It consolidates account identity, workspace/timezone, sync/offline state and actions, PWA/device status, phone-layout customization, Categories & Recycle Bin, calendar/reminder connections, and a confirmed device sign-out. The former detached authenticated sign-out control was removed; recovery and unlinked-account screens retain their necessary escape action. Signing out continues to hide rather than delete the account-scoped offline cache.

Desktop navigation is independently fixed while `.planner-main` scrolls, and has a persisted explicit collapse/expand control. Categories remain available from the desktop top bar and phone More utility area. The phone Task board now uses one visible dark work lane at a time with three 48px tabs labelled `To do`, `Doing`, and `Done`; desktop retains all three lanes. The exact R20 lane surfaces remain `#2a405d`, `#155b59`, and `#1d4b3d`.

Fresh verification: TypeScript passed; all 64 Vitest files passed with 274 tests and 3 intentional skips; the Vercel client/server/PWA build passed and generated release `ba8a0e16ab6ba54a` with 20 shell files. Synthetic Playwright flows passed at 1440x1000 and 390x844, including fixed-rail scrolling, rail collapse/expand, Settings/account access, phone More, Categories & Recycle Bin, phone customization, one-lane mobile Task navigation, four offline operations, sign-out pointer access, cache isolation, exact lane colors, and zero horizontal overflow. Screenshots and results are outside Git in `%TEMP%/personal-calendar-settings-verification-final/`. Physical-iPhone checks remain with the user. This work is not authorized for `main`; preview only from `dev/personal-calendar-workbench`.

## 2026-09-12 Phase 2/3 release candidate

Phase 2 now provides an account/workspace-scoped IndexedDB snapshot, immutable task operation queue, bounded idempotent replay, three-way field merging, durable server/local conflict review, orphan-operation retention, and a sign-out boundary that hides rather than deletes cached work. Pending/retry task operations overlay both cached and freshly fetched snapshots so a polling refetch cannot make unsynced work disappear. The supported offline write surface includes task creation and quick capture, full editor updates, state/lane changes, archive/restore, schedule/reservation changes, project-breakdown task creation, post-sync subtasks, and explicit up/down reordering. All planner sections remain readable from the cached account snapshot. Other entity writes remain visibly online-only in this intentionally lean first release.

Settings now exposes a unified `Workspace settings & Recycle Bin` surface on desktop and through phone More. Archived tasks, goals, projects, and habits are retained indefinitely and restorable; nothing is auto-deleted. Category deletion is the only defined permanent action, requires a separate irreversible confirmation, is blocked offline, and detaches only the label while retaining planner history.

Phase 3 now persists and retrieves the current private calendar feed, exposes a `webcal://` Apple Calendar subscription action, uses stable task timestamps/versions and UTC timed reservations in deterministic ICS output, excludes archived work, and marks the feed private/no-cache. Calendar-link creation and phone notification/cadence actions are disabled until the account is online with no pending/retry/review work. Reminder cadence uses the workspace's persisted IANA timezone rather than a hard-coded locale.

The live independent Supabase project `dwiudauuuxzstbavkkqa` was configured through `scripts/activate-independent-reminders.mjs`. The guard requires the exact direct/project pooler identity, uses ignored local credentials only in process memory, transfers Vercel values via stdin, refuses to overwrite a different Vault endpoint, installs only `pg_cron`/`pg_net`, replaces only `personal-calendar-reminder-sweep`, and compares planner counts. Default mode leaves the named scheduler paused during deployment; rerun with `--activate` only after Production health and authenticated-endpoint verification. Postflight: Vault names 2, Cron jobs 1, `pg_cron=true`, `pg_net=true`; counts remained workspaces 1, tasks/goals/projects/habits 0. Vercel Production has VAPID, app-origin, and scheduler-secret names; Preview has VAPID and app-origin. No secret value is recorded in Git or this handoff. There are currently zero push subscriptions and zero reminder rules, so real delivery remains a post-deploy user opt-in test, not a claimed result.

Fresh local evidence: TypeScript passed; 63 Vitest files passed with 272 tests and 3 intentional environment skips; the production build generated PWA release `8228c8b27d46f581` with 20 public shell files. Synthetic desktop 1440x1000 and phone 390x844 checks passed with zero horizontal overflow, exact dark Task-lane colors, conflict choices, Settings/Recycle Bin access, four simultaneous offline task operations, and signed-out cache isolation. The inspected phone screenshot is outside Git at `C:/Users/win 10/AppData/Local/Temp/personal-calendar-phase23-final/preview-linked-home-phone.png`.

Deployment packaging correction: the first `bc2ff69` Production canary found that the dedicated Calendar and reminder TypeScript functions referenced source modules omitted by Vercel's serverless package (`ERR_MODULE_NOT_FOUND`). Cron remained paused. Both routes now use the same generated `dist/server/planner-app.mjs` Express artifact as the working tRPC function, with explicit `includeFiles` entries and a regression test covering all three planner entrypoints. A new Preview and Production canary are required before enabling the scheduler.

Scheduler/storage separation: the replacement Production function then authenticated correctly and reminder evaluation succeeded, but the shared endpoint returned 500 because the separately deferred `0002_private_planner_files.sql` table is absent. The endpoint now treats only PostgreSQL `42P01` from the optional cleanup query as `{ status: "not_configured", removed: 0, failed: 0 }`, allowing reminders to operate without silently applying the storage migration. Every other cleanup exception or failed deletion still returns 500 for retry. The private bucket/table/policies remain a later explicitly reviewed phase.

### Phase 2/3 Production deployment result

The user explicitly approved the exact GitHub destination and `main` promotion. Workbench Preview `https://personal-calander-96rlta467-yashnew869-2746s-projects.vercel.app` was READY with all planner functions bundled. The final code tree merged to `main` as `cb670f2`; the Production deployment `https://personal-calander-e9kbcl0zo-yashnew869-2746s-projects.vercel.app` became READY and the public alias remained `https://personal-calander.vercel.app`. Root, health, manifest, and worker returned 200; an invalid private calendar token returned 404; an unauthenticated scheduler call returned 401.

The final authenticated scheduler canary returned 200 with `inspected=0`, `sent=0`, and optional storage `status=not_configured`. The exact-project guard then enabled the single five-minute Cron job without changing planner counts. The first actual scheduled run at `2026-09-12 02:50:00 UTC` completed with Cron status `succeeded` and HTTP 200. This proves scheduled execution but not phone delivery: the database still has zero push subscriptions and zero reminder rules until the user opts in from the installed iPhone. Final merged-result evidence was TypeScript clean, 64/64 test files, 274 passing tests, 3 intentional skips, successful production build, and 20-file PWA shell. The existing large main-chunk warning remains non-blocking.

Phase status after this deployment: Phase 1 engineering/deployment complete (physical-iPhone offline/relaunch check delegated to the user); Phase 2 engineering/deployment complete for the approved lean task-first offline scope; Phase 3 engineering/infrastructure/deployment complete (physical-iPhone opt-in/test notification still delegated to the user); Phase 4 holistic design/functions has not started. The private file storage migration remains deliberately deferred and was not applied as part of Phase 2/3.

## 2026-09-12 secure synchronization checkpoint

The account-scoped device foundation is committed as `bed7e00`. A second verified local slice adds additive `syncOperationReceipts` and `syncConflicts` schemas/migration, a workspace-owner-protected bounded replay procedure, task field three-way merging, durable client retry/review states, and offline support for common task state/schedule/reservation changes. It does not reset or rewrite existing rows and it does not infer deletion from missing fields.

Local evidence: TypeScript passed; 61 test files / 258 tests passed with 3 intentional skips; the isolated migration test preserved an existing task and enforced workspace/operation receipt uniqueness; final production build release `9c2868b93211e476` contains 20 public shell files. Synthetic desktop and 390x844 phone browser checks passed. The phone check queued one offline task update in IndexedDB, showed the pending-sync surface, preserved the dark work-lane colors and zero horizontal overflow, then verified the planner cache was hidden after sign-out.

The remote migration was applied only after a clean preflight. `scripts/apply-secure-sync-migration.mjs` verified the exact project and SQL hash, rejected destructive statements, created both tables transactionally, and proved workspace/task counts unchanged. Postflight found both tables with RLS enabled. Their no-policy and unused-index advisor notices are expected because synchronization is server-only and traffic has not started; do not add direct-browser policies. Unsupported offline entities, conflict-choice UI, and the consolidated recycle-bin screen remain Phase 2 work. Existing unrelated advisor warnings remain tracked separately.

### Conflict-review slice

Overlapping task fields now have an explicit workspace-owner-protected review path. The server lists only open conflicts in the active workspace. “Use this device” applies the retained device value only when the task still has the exact recorded server version; a later edit produces a fresh conflict instead of being overwritten. “Keep online” resolves the conflict without writing the task. The phone dialog presents both values with 46px actions. Server conflicts surface across signed-in devices, while the account-scoped IndexedDB copy remains available offline. Orphaned unsynced operations remain retained by default and require a separate two-step “Confirm discard”; this removes only that queued change and never deletes an online planner record.

Verification: 49 focused sync/router/storage tests passed, followed by the complete 61-file suite with 258 passing tests and 3 intentional skips. TypeScript and the production client build passed; generated PWA release `5ca7582c4a167c3b` contains 20 shell files. Synthetic desktop 1440x1000 and phone 390x844 checks passed with no horizontal overflow, preserved the exact dark Task-lane palette, queued an offline task change, and rendered the conflict choices correctly. The inspected phone screenshot is outside Git at `C:/Users/win 10/AppData/Local/Temp/personal-calendar-sync-review/preview-linked-phone-sync-review.png`.

### Account-scoped quick-capture slice

Quick task captures now enter the account/workspace IndexedDB operation queue and render immediately in the current snapshot while offline. Replay uses the existing workspace-scoped unique `clientRequestId`, so a lost response or repeated reconnect cannot create a duplicate task. Legacy localStorage captures are copied into the scoped queue first and removed from the legacy list only after enqueue succeeds; an unavailable IndexedDB keeps the older bounded localStorage fallback. No existing capture or planner record is deleted during migration.

Verification: the complete suite passed with the new create/replay router and client tests; TypeScript passed; production build generated release `84daa9a657fc24cc` with 20 shell files. The synthetic desktop and 390x844 phone flow passed, including an immediately visible offline capture plus an independent queued task update in the same IndexedDB scope.

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

### Deployment result

The user explicitly authorized both branch push and `main` promotion. Workbench commit `15d3a8f` deployed successfully to Vercel Preview with generated worker release `a19a367f5ecb20f4`. The identical source tree was merged into `main` as `2c17978` and Vercel reported deployment success. Production `https://personal-calander.vercel.app` returned 200 for root and `/api/health`; its environment-specific worker release is `0962e8db7704ad8f`, with 20 public entries and no API/Supabase cache entry. A clean online Chromium run at 390x844 showed no runtime error or horizontal overflow. The user will perform the remaining physical-iPhone offline test.

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
