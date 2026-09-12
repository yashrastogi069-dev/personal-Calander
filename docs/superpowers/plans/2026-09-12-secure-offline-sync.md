# Secure Offline Synchronization Implementation Plan

Status: implementation complete; deployment verification pending

Date: 2026-09-12

## Task 1: Freeze contracts and live-state evidence

- [x] Confirm the workbench branch and preserve the user-owned `.gitignore` change.
- [x] Audit the connected Supabase project, planner tables, migrations, and advisors read-only.
- [x] Record the account-scope, merge, tombstone, and failure contracts.
- [x] Capture a concise live planner schema fingerprint without reading planner content: 21 core tables found; 15 are versioned and 6 already expose archive/delete tombstone fields.

## Task 2: Account-scoped IndexedDB foundation

- [x] Write the first failing tests for scope keys, immutable enqueue, acknowledgement, merge classification, and conflict persistence.
- [x] Implement a dependency-free IndexedDB adapter with `snapshots`, `operations`, `conflicts`, and `meta` stores.
- [x] Add a memory adapter for unit tests.
- [x] Prove account A cannot read account B; the auth boundary mounts the sync scope only after account and workspace authorization.

## Task 3: Cached snapshot bootstrap and sync status

- [x] Persist the primary successful authenticated workspace snapshot with its exact range.
- [x] Fall back to that matching scoped snapshot only after identity and workspace authorization succeed.
- [x] Overlay pending/retry task operations over cached and freshly fetched snapshots without treating omissions as deletion; review-state overlaps remain explicit.
- [x] Add accessible `offline`, `pending`, `syncing`, `needs review`, and `retry` presentation with iPhone safe-area spacing.
- [x] Keep unsupported first-release actions visibly connection-gated instead of pretending to queue them.

## Task 4: Idempotent backend operations and conflict engine

- [x] Add tested Drizzle schemas for workspace-scoped receipts and conflict records.
- [x] Generate and inspect an additive migration; it creates only two tables and four indexes.
- [x] Implement pure three-way field merge tests first.
- [x] Add an authenticated 25-operation tRPC task replay procedure reusing existing planning services.
- [x] Support duplicate receipts, independent batch outcomes, retry state, stale-version re-merge, safe partial merges, and retained overlaps for task updates.
- [x] Apply the guarded additive migration and re-audit: row counts preserved; both tables have RLS; only expected server-only no-policy and pre-traffic unused-index notices were added.

## Task 5: Offline mutation coverage

- [x] Migrate quick capture into the scoped queue without losing existing localStorage captures.
- [x] Cover task create/update/state/archive/restore, full editor, quick capture, project breakdown task creation, subtask creation after parent sync, scheduling/reservation, and visible reorder flows.
- [x] Close the approved lean first-release scope: goals, milestones, projects, habits, categories, saved views, daily plans, reviews, dependencies, and availability remain readable from the account snapshot but their writes stay online-only until a coherent future slice, rather than receiving a partial queue.
- [x] Keep focus, push, calendar, file upload, permanent deletion, and security-sensitive operations online-only unless separately designed; push/calendar activation additionally requires healthy synchronization.

## Task 6: Conflict review and recycle bin

- [x] Add a visible Needs Review inbox retaining base/local/server values.
- [x] Resolve via a fresh version-checked operation.
- [x] Present archived tasks, goals, projects, and habits as an indefinite Recycle Bin with restore.
- [x] Keep permanent deletion separate and explicitly confirmed only for categories, where defined history behavior detaches the label without deleting planner history; it is blocked offline.

## Task 7: Verification, documentation, and deployment

- [x] Run focused tests after every slice.
- [x] Run TypeScript, full tests, and production build locally.
- [x] Run synthetic authenticated phone/desktop checks including sign-out cache isolation, offline task operations, conflict review, Recycle Bin access, and reconnection-safe queue storage.
- [x] Update handoff, flow, and roadmap with exact evidence.
- [ ] Push workbench, verify Vercel Preview/database compatibility, then merge/push `main` under explicit authorization.
- [ ] Leave the physical-iPhone offline/relaunch gate to the user.

## Execution rule

Proceed in small test-driven commits. Do not delegate unless explicitly requested. Stop before remote DDL if additive migration or recovery evidence is not clean; never reset, truncate, rewrite IDs, or apply a baseline to populated tables.
