# Secure Offline Synchronization Implementation Plan

Status: active

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
- [ ] Overlay pending operations without treating omissions as deletion.
- [ ] Add accessible `offline`, `pending`, `syncing`, `needs review`, and `retry` presentation with iPhone safe-area spacing.
- [ ] Keep unsupported offline actions explicitly disabled.

## Task 4: Idempotent backend operations and conflict engine

- [x] Add tested Drizzle schemas for workspace-scoped receipts and conflict records.
- [x] Generate and inspect an additive migration; it creates only two tables and four indexes.
- [x] Implement pure three-way field merge tests first.
- [x] Add an authenticated 25-operation tRPC task replay procedure reusing existing planning services.
- [x] Support duplicate receipts, independent batch outcomes, retry state, stale-version re-merge, safe partial merges, and retained overlaps for task updates.
- [ ] Re-audit advisors after schema changes.

## Task 5: Offline mutation coverage

- [ ] Migrate quick capture into the scoped queue without losing existing localStorage captures.
- [ ] Cover task create/update/state/archive/restore and reorder flows. Common state, archive/restore, schedule, and reservation updates are implemented; full editor/create/reorder coverage remains.
- [ ] Cover goal, milestone, project, habit, category, saved-view, daily-plan, review, dependency, and availability writes in coherent groups.
- [ ] Keep focus, push, calendar, file upload, permanent deletion, and security-sensitive operations online-only unless separately designed.

## Task 6: Conflict review and recycle bin

- [ ] Add a visible Needs Review inbox retaining base/local/server values.
- [ ] Resolve via a fresh version-checked operation.
- [ ] Present archived entities as an indefinite recycle bin with restore.
- [ ] Add separately confirmed permanent deletion only where history rules are defined.

## Task 7: Verification, documentation, and deployment

- [ ] Run focused tests after every slice.
- [ ] Run TypeScript, full tests, and production build.
- [ ] Run synthetic authenticated phone/desktop checks including account switching and reconnection.
- [ ] Update handoff, flow, and roadmap with exact evidence.
- [ ] Push workbench, verify Vercel Preview/database compatibility, then merge/push `main` under explicit authorization.
- [ ] Leave the physical-iPhone offline/relaunch gate to the user.

## Execution rule

Proceed in small test-driven commits. Do not delegate unless explicitly requested. Stop before remote DDL if additive migration or recovery evidence is not clean; never reset, truncate, rewrite IDs, or apply a baseline to populated tables.
