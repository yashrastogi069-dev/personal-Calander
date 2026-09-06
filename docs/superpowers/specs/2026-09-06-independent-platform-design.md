# Independent platform completion design

Date: 2026-09-06  
Branch: `dev/personal-calendar-workbench`  
Status: approved direction; implementation begins after final spec review

## Purpose

Personal Calendar must run without its former managed-platform services while preserving every active planner capability, route, workflow, visual treatment, and item of real planner data. Supabase will own authentication, identity, PostgreSQL data, and private file storage. Standard Web Push will deliver device reminders. Supabase Cron will invoke the deployed reminder worker. Vercel will host the branch preview and provide anonymous web traffic analytics.

The protected `main` branch remains unchanged unless the owner explicitly requests a later merge.

## Functional guarantees

- Preserve Home, Calendar, tasks, projects, goals, habits, focus, planning, search, insights, weekly review, calendar feeds, offline capture, optional AI capture, notification enrollment, reminder controls, and responsive layouts.
- Preserve existing database record IDs, workspace IDs, timestamps, history, and planner relationships.
- Preserve planner analytics. They are computed from the owner's planner records and are separate from deployment traffic analytics.
- Preserve browser notification controls, device subscriptions, reminder rules, delivery history, retries, and idempotency.
- Do not automatically claim an existing workspace for a newly authenticated account.
- Do not reintroduce dormant template utilities as product features. Historical generic image, map, and voice scaffolding had no active planner route or consumer when it was removed.

## Authentication and identity

Supabase Auth is the sole authentication authority. Google OAuth is the primary convenience method and Supabase email/password remains available as a recovery path. The browser keeps the Supabase session and sends its access token to tRPC. The server validates that token with Supabase before loading any private planner data.

The public `users` table separates the application's durable identity from external providers:

- `id`: existing internal integer primary key, retained so current rows and future relationships remain stable.
- `authUserId`: nullable UUID, unique, representing `auth.users.id` for a Supabase account.
- `legacyExternalId`: nullable string containing the old external identity solely for migration provenance.
- profile fields: name, email, avatar URL, provider label, role, and timestamps.

An existing `openId` or prematurely renamed `supabaseUserId` column is converted to `legacyExternalId`; its stored values are never treated as authenticated Supabase UUIDs. New sign-ins upsert by `authUserId`. A workspace stores a unique nullable `ownerUserId` referencing `users.id`. Every planner procedure resolves ownership from the authenticated internal user; a browser-provided workspace ID cannot establish access.

The migration supports both known live-schema starting points, remains additive, and refuses ambiguous mixed identity columns. Existing rows remain unclaimed until the exact Supabase account and workspace have been inspected and explicitly linked.

## Supabase file storage

Create one private bucket named `planner-files`. Files use the path shape `<auth-user-id>/<workspace-id>/<generated-object-id>-<safe-name>`. Storage RLS restricts select, insert, update, and delete operations to the authenticated user prefix. The bucket will reject oversized uploads and unsupported content types through explicit configuration.

A small storage service exposes authenticated operations for creating uploads, issuing short-lived download URLs, listing owned objects, and deleting owned objects. It checks workspace ownership before producing an object path. A metadata table records object ID, workspace, owner, path, original filename, MIME type, size, creation time, and deletion time. Object writes and metadata updates use retry-safe request IDs and surface partial failures for cleanup.

The active planner currently has no attachment screen, so this work replaces the infrastructure contract and verifies it without adding an unrelated UI workflow. Later attachment UI can consume the stable storage service without changing providers.

## Notifications and scheduling

The existing standards-based Web Push implementation remains the sender. It uses project-owned VAPID keys, the existing push subscription and delivery tables, and the browser service worker. Enable, disable, test, expired-device handling, reminder cadence, retry behavior, and delivery idempotency remain available.

The disabled compatibility notification endpoint is removed. The scheduled Vercel endpoint becomes an authenticated worker that processes due reminder rules and returns structured counts. A secret shared between Supabase Vault and Vercel protects the endpoint. Supabase Cron invokes it every five minutes, which supports the current local-time reminder model without depending on Vercel Hobby's once-daily scheduling limit. Concurrent invocations remain safe through the existing unique delivery key.

## Analytics

Planner analytics continue to be derived from private planner records on the authenticated server. No task title, goal, habit, note, calendar event, email address, or other planner content is sent to traffic analytics.

Vercel Web Analytics replaces the removed hosted Umami script for page-view and web-vital visibility. It is enabled only for deployed builds through Vercel's React integration. Custom product events are outside this migration unless they can be defined without private planner content.

## Removing legacy platform artifacts

- Delete `template.json`, which embeds the obsolete project scaffold and packages but is not used by the application or build.
- Remove the obsolete generated-version ignore rule.
- Remove dead notification compatibility files and routes after confirming no consumer exists.
- Rewrite current documentation references in provider-neutral terms while preserving the technical decisions and warnings they communicate.
- Remove obsolete environment names, imports, packages, comments, public assets, and generated build references.
- Require a case-insensitive repository and production-build scan to return zero former-provider name matches.

Git history is not rewritten. Past commits remain available as migration provenance; rewriting shared history would create unnecessary recovery and collaboration risk.

## Real-data migration and rollout

1. Inspect the selected Supabase project read-only: schema, identity columns, workspace IDs, row counts, RLS policies, storage buckets, extensions, cron jobs, and migration journal.
2. Export a recoverable database backup before changing the live schema.
3. Run the additive migration in a transaction and compare row counts before commit.
4. Configure Google OAuth redirect URLs and retain email/password access.
5. Sign in once to create the authenticated profile, then explicitly connect the verified existing workspace to that profile.
6. Create the private storage bucket and policies, store the scheduler secret in Supabase Vault and Vercel, and create the five-minute cron job.
7. Deploy only `dev/personal-calendar-workbench` to a separate Vercel project or preview environment. Do not modify the existing `main` deployment.
8. Test real sign-in, reload, sign-out, account isolation, all planner areas, named disposable CRUD, storage lifecycle, push enrollment/test/delivery, analytics loading, desktop behavior, and phone behavior.

The migration stops before any write if the live schema does not match a supported starting point, a backup is unavailable, an existing workspace already has a different owner, or record counts change unexpectedly.

## Preview and acceptance

Before live migration, run a local production-like preview showing the new sign-in screen, recovery states, and unchanged planner shell with simulated authenticated data. After credentials and OAuth redirects are available, deploy a branch-only Vercel preview and repeat the checks against the real Supabase project.

Completion requires:

- zero current tracked-file and build-output references to the former provider;
- Google OAuth and email/password authentication both reach the correct account state;
- unauthenticated, unlinked, and cross-account users cannot read or mutate planner records;
- existing planner records and IDs remain unchanged except for the explicitly approved ownership link;
- private storage upload, download, list, and delete work only for the owner;
- notification enrollment, test send, scheduled send, disable, expiry, and duplicate prevention work;
- private planner analytics remain correct and Vercel receives only deployment traffic analytics;
- TypeScript, unit/integration tests, production build, desktop browser checks, and phone browser checks pass;
- the user can open and review the branch preview;
- `main` remains at its original commit.
