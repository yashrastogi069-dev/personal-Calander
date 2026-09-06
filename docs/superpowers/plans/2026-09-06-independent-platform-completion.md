# Independent Platform Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run every active Personal Calendar capability on Supabase and Vercel, with Google OAuth, private file storage, scheduled Web Push, deployment analytics, zero current legacy-provider references, and no loss of real planner data.

**Architecture:** Supabase Auth provides external identity while `public.users` remains the durable application identity. All planner and file operations pass through ownership-checked tRPC/server boundaries; private objects live in Supabase Storage. Supabase Cron calls an authenticated Vercel worker that reuses the existing idempotent Web Push delivery code, and Vercel Web Analytics observes deployment traffic without receiving planner content.

**Tech Stack:** React 19, Vite 7, tRPC 11, Supabase Auth/PostgreSQL/Storage/Cron, Drizzle ORM, Express/Vercel Functions, Web Push/VAPID, Vercel Web Analytics, Vitest, PGlite, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-06-independent-platform-design.md`

## Global Constraints

- Work only on `dev/personal-calendar-workbench`. Never merge into `main` unless the user explicitly instructs it.
- Preserve every active planner capability, route, workflow, responsive layout, and visual treatment.
- Preserve all existing planner record IDs, workspace IDs, timestamps, history, and relationships.
- Existing planner data is real. Do not reset the database or replay the baseline over populated tables.
- Do not automatically claim an existing workspace for a newly authenticated account.
- Keep planner content out of deployment analytics.
- Require zero case-insensitive former-provider name matches in current tracked files and production build output; Git history is excluded.
- Produce a local desktop and phone preview before requesting any live migration, push, or deployment action.

---

### Task 1: Durable Supabase identity and Google OAuth

**Files:**
- Modify: `drizzle/schema.ts`
- Replace: `supabase/migrations/0001_independent_ownership.sql`
- Regenerate: `supabase/migrations/meta/0001_snapshot.json`
- Modify: `server/db.ts`
- Create: `server/supabaseAdmin.ts`
- Modify: `server/supabaseAuth.ts`
- Create: `server/workspaceProcedure.ts`
- Modify: `server/workspaceOwnership.ts`
- Modify: `server/routers.ts`
- Modify: `server/routers/planner.ts`
- Modify: `client/src/components/SupabaseAuthGate.tsx`
- Modify: `client/src/_core/hooks/useAuth.ts`
- Modify: `server/independentOwnership.test.ts`
- Create: `server/supabaseIdentity.test.ts`
- Modify: `server/authenticatedPlanner.test.ts`

**Interfaces:**
- Produces: `getSupabaseAdmin(): SupabaseClient`, which throws a configuration error when server credentials are absent.
- Produces: `getUserByAuthUserId(authUserId: string)` and `upsertAuthenticatedUser(profile: AuthenticatedUserProfile)`.
- Produces: `getAccountWorkspace(userId: number)` and `requireWorkspaceOwner(userId: number, workspaceId: string)`.
- Produces: `workspaceProcedure`, a tRPC procedure whose input contains `workspaceId` and `timezone` and whose middleware validates `ctx.user.id` ownership.
- Preserves: bearer-token authentication and visible unauthenticated, service-error, and unlinked-account states.

- [ ] **Step 1: Write identity migration regression tests**

Extend the embedded PostgreSQL test to create the Supabase Auth schema and prove legacy values remain provenance:

```ts
await client.exec('create schema auth; create table auth.users (id uuid primary key);');
await client.exec('insert into users ("openId", email) values (''old-provider-user'', ''owner@example.test'');');
await applyIndependentUpgrade(client);

const legacy = await client.query(
  'select "authUserId", "legacyExternalId" from users where email = ''owner@example.test'''
);
expect(legacy.rows[0]).toEqual({
  authUserId: null,
  legacyExternalId: "old-provider-user",
});
```

Also test the supported starting point where the old column was previously renamed to `supabaseUserId`, and test that ambiguous simultaneous identity columns cause the migration to fail before data changes.

- [ ] **Step 2: Run the identity tests and verify the intended failure**

Run: `pnpm vitest run server/independentOwnership.test.ts server/supabaseIdentity.test.ts`  
Expected: FAIL because `authUserId`, `legacyExternalId`, `ownerUserId`, and the new helpers do not exist yet.

- [ ] **Step 3: Update the Drizzle identity model**

Define the durable fields:

```ts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  authUserId: uuid("authUserId").unique(),
  legacyExternalId: varchar("legacyExternalId", { length: 128 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  avatarUrl: text("avatarUrl"),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: enumText("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
}).enableRLS();
```

Change workspaces to `ownerUserId: integer("ownerUserId").unique().references(() => users.id)`. Keep it nullable so no existing workspace is claimed automatically.

- [ ] **Step 4: Replace the additive ownership migration**

The migration must:

1. Rename exactly one existing `openId` or `supabaseUserId` column to `legacyExternalId`.
2. Refuse to proceed if more than one of those three legacy columns exists.
3. Drop `NOT NULL` from `legacyExternalId`.
4. Add nullable UUID `authUserId` and its unique constraint.
5. Add nullable integer `workspaces.ownerUserId` with unique and foreign-key constraints.
6. Enable RLS on every planner table without dropping existing policies.
7. Avoid inserts, deletes, ownership assignments, or baseline table creation.

Regenerate the snapshot with `pnpm db:generate` and inspect that it describes only the intended model.

- [ ] **Step 5: Implement the server identity boundary**

Create a single server admin client and map a validated Supabase user into:

```ts
export type AuthenticatedUserProfile = {
  authUserId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  loginMethod: string;
  lastSignedIn: Date;
};
```

Derive `loginMethod` from `user.app_metadata.provider` with `"supabase_email"` as the fallback. Upsert only by `authUserId`. Return the persisted `users` row so authorization always uses its internal integer `id`.

- [ ] **Step 6: Share the ownership-checked tRPC procedure**

Move the planner-local ownership middleware into `server/workspaceProcedure.ts`. Make `auth.workspace` resolve with `ctx.user.id`. Update every planner procedure to consume the shared procedure without changing its public input or output.

- [ ] **Step 7: Add Google OAuth while preserving email/password**

Add a primary button that calls:

```ts
await supabase.auth.signInWithOAuth({
  provider: "google",
  options: { redirectTo: window.location.origin },
});
```

Keep sign-in and sign-up with email/password available beneath it. Bound the OAuth start with the existing timeout helper, show actionable configuration/provider errors, and preserve keyboard labels and focus behavior.

- [ ] **Step 8: Run focused identity and auth tests**

Run: `pnpm vitest run server/independentOwnership.test.ts server/supabaseIdentity.test.ts server/authenticatedPlanner.test.ts server/planner.router.test.ts`  
Expected: all tests PASS, including legacy preservation, linked account, unlinked account, and cross-account denial.

- [ ] **Step 9: Commit the identity task**

```bash
git add drizzle/schema.ts supabase/migrations server/db.ts server/supabaseAdmin.ts server/supabaseAuth.ts server/workspaceProcedure.ts server/workspaceOwnership.ts server/routers.ts server/routers/planner.ts client/src/components/SupabaseAuthGate.tsx client/src/_core/hooks/useAuth.ts server/independentOwnership.test.ts server/supabaseIdentity.test.ts server/authenticatedPlanner.test.ts
git commit -m "feat: complete Supabase identity and OAuth"
```

---

### Task 2: Private Supabase file storage

**Files:**
- Modify: `drizzle/schema.ts`
- Create: `supabase/migrations/0002_private_planner_files.sql`
- Generate: `supabase/migrations/meta/0002_snapshot.json`
- Create: `server/storage.ts`
- Create: `server/routers/storage.ts`
- Modify: `server/routers.ts`
- Create: `server/storage.test.ts`
- Create: `server/storage.router.test.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `getSupabaseAdmin()` and `workspaceProcedure` from Task 1.
- Produces: `createUpload`, `completeUpload`, `listFiles`, `createDownloadUrl`, and `deleteFile` under `appRouter.storage`.
- Produces bucket ID `planner-files` and object paths `<auth-user-id>/<workspace-id>/<file-id>-<safe-name>`.

- [ ] **Step 1: Write storage service and authorization tests**

Cover owner upload creation, cross-workspace denial, filename normalization, MIME/size rejection, retry-safe request IDs, ready-file listing, short-lived download URLs, deletion, and failed object cleanup. Use a mocked Supabase Storage client and database.

The accepted request contract is:

```ts
type CreateUploadInput = PlannerScope & {
  requestId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};
```

Allow PDF, plain text, JSON, and JPEG/PNG/WebP images up to 20 MiB.

- [ ] **Step 2: Run storage tests and verify they fail**

Run: `pnpm vitest run server/storage.test.ts server/storage.router.test.ts`  
Expected: FAIL because the storage service, router, and metadata table do not exist.

- [ ] **Step 3: Add the planner file metadata table**

Add `plannerFiles` with string `id`, `workspaceId`, integer `ownerUserId`, unique `requestId` scoped to workspace, unique `objectPath`, original filename, MIME type, byte size, `status` (`uploading|ready|deleted|failed`), timestamps, and nullable deletion/failure fields. Enable RLS and add workspace/status indexes.

- [ ] **Step 4: Add the storage migration and policies**

Create the private bucket idempotently:

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'planner-files',
  'planner-files',
  false,
  20971520,
  array['application/pdf','text/plain','application/json','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
```

Create authenticated `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies on `storage.objects` requiring `bucket_id = 'planner-files'` and the first path segment to equal `auth.uid()::text`. Use named-policy existence checks so the migration is retry-safe.

- [ ] **Step 5: Implement the server storage service**

Validate ownership before every admin Storage call. Generate server-owned paths; never accept an object path from the browser. Create signed upload URLs, finalize metadata only after confirming the object exists with expected size/type, issue download URLs lasting 300 seconds, and mark metadata deleted after object deletion. Return stable public metadata without bucket internals.

- [ ] **Step 6: Add the storage router**

Use `workspaceProcedure` for all five operations. Apply Zod limits matching the service and return typed errors for unsupported files, missing objects, configuration failure, and ownership denial.

- [ ] **Step 7: Run storage tests and migration generation**

Run: `pnpm vitest run server/storage.test.ts server/storage.router.test.ts server/independentOwnership.test.ts`  
Run: `pnpm db:generate`  
Expected: tests PASS and generated schema matches `0002_private_planner_files.sql` without destructive changes.

- [ ] **Step 8: Commit the storage task**

```bash
git add drizzle/schema.ts supabase/migrations server/storage.ts server/routers/storage.ts server/routers.ts server/storage.test.ts server/storage.router.test.ts .env.example
git commit -m "feat: replace file storage with Supabase"
```

---

### Task 3: Scheduled Web Push without managed infrastructure

**Files:**
- Create: `server/reminderEndpoint.ts`
- Modify: `server/planning.ts`
- Modify: `server/_core/app.ts`
- Modify: `api/scheduled/reminder.ts`
- Modify: `server/_core/systemRouter.ts`
- Delete: `server/_core/notification.ts`
- Create: `server/reminderEndpoint.test.ts`
- Modify: `server/planning.reminder.test.ts`
- Create: `supabase/cron/reminder_sweep.sql`
- Modify: `.env.example`
- Modify: `docs/WEB_PUSH_ACTIVATION.md`

**Interfaces:**
- Produces: `dispatchAllScheduledReminders(origin: string, now?: Date)`.
- Produces: `handleReminderRequest(req, res)` shared by Express and the Vercel function.
- Requires: `REMINDER_CRON_SECRET` and `APP_ORIGIN` on the server.
- Preserves: VAPID sender, device enrollment, test sends, local-time rules, expiration handling, and unique delivery idempotency.

- [ ] **Step 1: Write endpoint security and sweep tests**

Test missing secret configuration returns 503, absent/wrong Bearer token returns 401, correct token calls the project sweep once, origin comes from `APP_ORIGIN` rather than request headers, duplicate reservations send nothing, and a terminal 410 response expires only that device.

- [ ] **Step 2: Run reminder tests and verify they fail**

Run: `pnpm vitest run server/reminderEndpoint.test.ts server/planning.reminder.test.ts server/planning.push.test.ts`  
Expected: FAIL because the shared authenticated handler and all-rules entry point do not exist.

- [ ] **Step 3: Implement the all-rules reminder entry point**

Wrap `dispatchProjectReminderSweep`:

```ts
export async function dispatchAllScheduledReminders(origin: string, now = new Date()) {
  const db = await requireDb();
  return dispatchProjectReminderSweep(db, origin, now);
}
```

Retain the existing insert-before-send idempotency key and PostgreSQL `23505` duplicate handling.

- [ ] **Step 4: Implement one authenticated HTTP handler**

Validate `Authorization: Bearer <REMINDER_CRON_SECRET>` with constant-time byte comparison for equal-length values. Reject requests when either required environment value is missing. Accept GET or POST, return the structured sweep result, set `Cache-Control: no-store`, and return 500 with a generic error while logging the server-side failure.

- [ ] **Step 5: Wire Express and Vercel to the same handler**

Replace both disabled 503 routes with `handleReminderRequest`. Keep the URL `/api/scheduled/reminder`. Remove `system.notifyOwner` and delete its dead compatibility module while keeping `system.health`.

- [ ] **Step 6: Add the Supabase Cron installation SQL**

Create `pg_cron` and `pg_net` extensions if available. Define one job named `personal-calendar-reminder-sweep` that runs every five minutes and POSTs to the URL and secret stored in Vault under `personal_calendar_reminder_url` and `personal_calendar_reminder_secret`. Make the script refuse installation when either secret is absent and unschedule an existing same-name job before creating the replacement.

- [ ] **Step 7: Run reminder tests**

Run: `pnpm vitest run server/reminderEndpoint.test.ts server/planning.reminder.test.ts server/planning.push.test.ts server/vapidConfig.test.ts`  
Expected: all tests PASS.

- [ ] **Step 8: Commit the notification task**

```bash
git add server/reminderEndpoint.ts server/planning.ts server/_core/app.ts api/scheduled/reminder.ts server/_core/systemRouter.ts server/_core/notification.ts server/reminderEndpoint.test.ts server/planning.reminder.test.ts server/planning.push.test.ts supabase/cron/reminder_sweep.sql .env.example docs/WEB_PUSH_ACTIVATION.md
git commit -m "feat: schedule owned web push delivery"
```

---

### Task 4: Vercel analytics and complete legacy scrub

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `client/src/App.tsx`
- Delete: `template.json`
- Modify: `.gitignore`
- Modify: every current documentation file returned by the case-insensitive provider-name scan
- Modify: `todo.md`
- Create: `server/legacyProviderScan.test.ts`

**Interfaces:**
- Produces: Vercel's standard React `<Analytics />` integration.
- Preserves: server-computed private planner analytics and every UI insights surface.
- Produces: a zero-match scan over tracked current files, excluding `.git` history and dependency directories.

- [ ] **Step 1: Write a tracked-file regression scan**

The test runs `git grep -I -n -i` for both former provider names against `HEAD` plus working-tree tracked files and fails with matching paths. It excludes `.git` internals and does not rewrite history. The test must not spell the full search terms contiguously in its own source; construct each from neutral string fragments so the acceptance scan can reach zero.

- [ ] **Step 2: Run the scan and verify it fails**

Run: `pnpm vitest run server/legacyProviderScan.test.ts`  
Expected: FAIL and list `template.json`, `.gitignore`, and the remaining migration/deployment notes.

- [ ] **Step 3: Add Vercel Web Analytics**

Install `@vercel/analytics` and mount `<Analytics />` once at the application root. Do not add custom events or pass planner fields. Preserve the existing `AnalyticsPanel` and `PlanningInsightsWorkspace` without renaming their product language.

- [ ] **Step 4: Remove obsolete artifacts safely**

Delete `template.json` only after confirming no import, script, build command, or deployment configuration references it. Remove the obsolete generated-version ignore entry. Rewrite legacy-provider references in the current ten documentation/tracker files into precise terms such as “former managed platform,” retaining migration warnings, historical decisions, and current instructions.

- [ ] **Step 5: Verify source and build scans**

Run: `pnpm vitest run server/legacyProviderScan.test.ts`  
Run this repository scan, constructing the retired names from fragments so the plan itself does not violate the acceptance rule:

```powershell
$retiredNames = @((@('man','us') -join ''), (@('for','ge') -join ''))
foreach ($retiredName in $retiredNames) {
  rg -n -i --hidden --glob '!node_modules/**' --glob '!.git/**' $retiredName .
  if ($LASTEXITCODE -eq 0) { exit 1 }
}
exit 0
```

Expected: no matches.

- [ ] **Step 6: Commit analytics and scrub**

```bash
git add -A -- package.json pnpm-lock.yaml client/src/App.tsx template.json .gitignore docs todo.md server/legacyProviderScan.test.ts
git commit -m "chore: remove managed platform artifacts"
```

---

### Task 5: Integrated verification and current branch preview

**Files:**
- Modify: `docs/INDEPENDENT_STACK_HANDOFF.md`
- Modify: `docs/SUPABASE_VERCEL_DEPLOYMENT.md`
- Create: `scripts/preview-auth-states.py`
- Create: `scripts/preview-linked-planner.py`
- Create artifacts outside the repository: desktop and 390x844 screenshots

**Interfaces:**
- Consumes: completed local identity, storage, reminder, and analytics tasks.
- Produces: repeatable Playwright preview checks for signed-out, auth-error, unlinked, workspace-error, and linked-planner states.

- [ ] **Step 1: Update the handoff and deployment documentation**

Record exact required environment names, OAuth redirect configuration, private bucket name, Vault secret names, scheduler installation, Vercel Analytics enablement, migration order, backup gate, and rollback steps. Mark only checks with fresh evidence as complete.

- [ ] **Step 2: Create deterministic preview scripts**

Use Playwright request interception to simulate authenticated tRPC responses without writing live data. Capture:

- desktop `1440x1000` Google/email sign-in;
- phone `390x844` Google/email sign-in;
- desktop linked planner Home;
- phone linked planner Home;
- authenticated unlinked workspace state.

Assert no browser runtime errors, no premature private planner requests while signed out, no horizontal overflow at phone size, and visible sign-out for the linked state.

- [ ] **Step 3: Run focused and full local verification**

Run: `pnpm check`  
Run: `pnpm test`  
Run: `pnpm build:client`  
Expected: TypeScript succeeds, all offline tests pass, and Vite/server bundles build. Record the exact counts and bundle warning, if any.

- [ ] **Step 4: Run the production-like preview**

First run `python C:/Users/win 10/.agents/skills/webapp-testing/scripts/with_server.py --help`. Then start `pnpm dev` through the helper and execute both preview scripts. Save screenshots under `C:/Users/win 10/personal-Calander-analysis/` and open the desktop linked-planner screenshot for user review.

- [ ] **Step 5: Reconfirm protected-branch integrity**

Run:

```powershell
git rev-parse main
git rev-parse origin/main
git status --short --branch
```

Expected: both main references remain `782776d7f2a85a52e48a3464989b9ffdbe74c21f` and the active branch is `dev/personal-calendar-workbench`.

- [ ] **Step 6: Commit verification assets and docs**

```bash
git add docs/INDEPENDENT_STACK_HANDOFF.md docs/SUPABASE_VERCEL_DEPLOYMENT.md scripts/preview-auth-states.py scripts/preview-linked-planner.py
git commit -m "test: verify independent platform preview"
```

---

### Task 6: Prepare and gate the real Supabase/Vercel rollout

**Files:**
- Create: `scripts/audit-supabase.mjs`
- Modify: `vitest.services.config.ts`
- Modify: `server/supabase.database.test.ts`
- Modify: `server/supabase.credentials.test.ts`
- Modify: `docs/INDEPENDENT_STACK_HANDOFF.md`

**Interfaces:**
- Produces: a read-only audit that reports schema shape, aggregate row counts, identity-column state, workspace ownership state, RLS/policy inventory, bucket presence, extension state, cron presence, and migration journal state without printing secrets or planner content.
- Produces: a concrete reviewed rollout checklist; it does not perform the live migration, workspace assignment, push, or deployment.

- [ ] **Step 1: Write audit output tests**

Test redaction of database URLs, API keys, bearer values, emails, titles, notes, object paths, and push endpoints. Test that only table names, column names, policy names, booleans, and aggregate counts appear.

- [ ] **Step 2: Implement the read-only audit**

Use `SUPABASE_DB_URL` with a read-only transaction:

```sql
begin read only;
set local statement_timeout = '10s';
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;
commit;
```

Query only metadata and `count(*)` aggregates. Exit nonzero for unsupported identity shapes, multiple workspaces when no explicit target is provided, an already-owned workspace with a different account, or missing expected planner tables.

- [ ] **Step 3: Run offline verification for the audit**

Run: `pnpm vitest run server/supabase.database.test.ts server/supabase.credentials.test.ts` with network tests mocked.  
Expected: PASS without requiring credentials.

- [ ] **Step 4: Run the live audit only when credentials are available**

Run: `pnpm test:services` and `node scripts/audit-supabase.mjs`. This step is read-only. Save only the redacted structural report outside the repository.

- [ ] **Step 5: Prepare the exact live operations for approval**

From the audit, produce:

1. the backup/export command targeting the verified project;
2. the exact migration files and hashes;
3. pre/post aggregate count queries;
4. the exact internal `users.id` and `workspaces.id` ownership assignment;
5. the bucket/policy and cron installation commands;
6. the exact branch push and Vercel preview deployment commands;
7. rollback commands for the new cron, bucket policies, and nullable ownership link.

Stop before these security-sensitive/external writes and request approval with the concrete identifiers redacted only where the user does not need to see them.

- [ ] **Step 6: Commit rollout preparation**

```bash
git add scripts/audit-supabase.mjs vitest.services.config.ts server/supabase.database.test.ts server/supabase.credentials.test.ts docs/INDEPENDENT_STACK_HANDOFF.md
git commit -m "ops: prepare guarded Supabase and Vercel rollout"
```

---

### Final branch review

- [ ] Run `pnpm check`, `pnpm test`, `pnpm build:client`, the zero-match provider scan, and both Playwright preview scripts from a clean process state.
- [ ] Dispatch a whole-branch review against `git merge-base main HEAD` with the design, plan, task ledger, and complete diff package.
- [ ] Fix any critical or important findings through one reviewed subagent fix wave.
- [ ] Verify `main` and `origin/main` still equal `782776d7f2a85a52e48a3464989b9ffdbe74c21f`.
- [ ] Present the local preview and the concrete live-rollout approval gate to the user. Do not merge, push, migrate live data, assign ownership, or publish without the applicable final approval.
