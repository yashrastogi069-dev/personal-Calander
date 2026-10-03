# Durable Focus Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make explicit Focus-to-Habit attribution and Finish → Next Step choices durable and conflict-safe without rewriting existing planner history.

**Architecture:** Add nullable, workspace-scoped references to Focus sessions and a small explicit handoff state, then expose them through version-guarded Focus APIs and UI. Store each active interval so habit duration can be split across real workspace-local dates, including midnight and DST boundaries. Existing rows remain unattributed/unset; no inference or backfill is allowed. Ship only local additive migration artifacts and isolated tests: no live database apply, production write, or deployment is authorized by this plan.

**Tech Stack:** TypeScript, React, tRPC, Drizzle ORM, PostgreSQL/Supabase, Vitest, PGlite migration tests.

**Spec:** `docs/FOCUS_ORCHESTRATION_SPEC.md`; migration safety gates in `docs/INDEPENDENT_STACK_HANDOFF.md`.

**Local checkpoint (2026-10-03):** Tasks 1–4 have been implemented and verified locally. The original checkbox list below is the execution brief, not a live rollout checklist. Exact evidence is in `docs/PHASE4_SLICE_EVIDENCE.md`: 100/100 test files, 668 passed and 3 skipped; TypeScript and production build passed; screenshot-free synthetic browser 16/16 established plus 8/8 durable. Migration 0006 remains unapplied, and this branch is not pushed/deployed at this gate. Stop after T19 as requested; T20 is not started.

## Global Constraints

- Stay on `dev/personal-calendar-workbench`; `main` remains frozen R20.
- Preserve all workspace IDs, Focus session IDs, existing history, and old rows. Do not infer `habitId` or next-step values from task names, notes, check-ins, or outcomes.
- A Focus session has at most one explicitly selected habit; its task link remains independent. Allocate persisted active intervals once across local dates; never count running elapsed time as saved habit duration.
- Every read/write is workspace scoped; every mutation uses expected version and rejects archived or cross-workspace targets.
- The new `focusSessionSegments` table must have RLS enabled with no browser-facing policy; access remains through the authenticated server database connection only.
- If the additive schema is absent, existing Focus start/pause/resume/finish and legacy snapshots continue working with new capability unavailable.
- Do not apply SQL to Supabase, change real planner data, push a deployment, or merge `main`. Live rollout requires fresh strict-TLS inventory, restore-tested backup, exact migration approval, and guarded rollout evidence.
- The selected future Apple Calendar route is secure account-authorized CalDAV, not a public link. This Focus plan does not implement calendar authorization; never request or store Apple credentials in chat or contact the provider.

## File Map

- `drizzle/schema.ts`: nullable Focus session habit and handoff columns.
- `supabase/migrations/0006_focus_session_followups.sql`, `supabase/migrations/meta/_journal.json`, and `0006_snapshot.json`: additive SQL and PostgreSQL migration metadata, with a stable exact hash documented for review.
- `server/focus.ts` and a focused `server/focusTime.ts` helper: scoped validation, compatibility detection, version-guarded attribution/handoff mutation, and local-date interval allocation.
- `server/planning.ts` and `server/routers/planner.ts`: capability-aware snapshot fields and validated Focus API inputs.
- `client/src/features/focus/FocusWorkspace.tsx`, `FocusFollowUpPanel.tsx`, and relevant Focus styles: explicit start attribution and durable finish handoff UI with unavailable/conflict states.
- `server/focusFollowupsMigration.test.ts`, `server/focusTime.test.ts`, `server/focusFollowups.test.ts`, `server/focus.lifecycle.test.ts`, and `server/planner.router.test.ts`: preservation, interval splitting, capability absence, validation, conflicts, workspace isolation, and atomicity.
- `docs/FOCUS_ORCHESTRATION_SPEC.md`, `docs/PROJECT_STATE.md`, and `docs/INDEPENDENT_STACK_HANDOFF.md`: distinguish local implementation from live rollout and accurately record evidence.

---

### Task 1: Add the PostgreSQL Focus follow-up model and migration

**Files:** `drizzle/schema.ts`, `supabase/migrations/0006_focus_session_followups.sql`, `supabase/migrations/meta/_journal.json`, `supabase/migrations/meta/0006_snapshot.json`, `server/focusFollowupsMigration.test.ts`.

**Interfaces:**
- New nullable values are unset on every pre-existing Focus row; no historical attribution or handoff is inferred.
- Handoff state is `task | plan | none`; a `task` action requires a workspace-scoped actionable `nextStepTaskId`, while `plan` and `none` forbid it.
- Habit attribution is one nullable `habitId`; selecting a habit never completes/checks in that habit.
- Add `focusSessionSegments` with generated ID, `workspaceId`, `focusSessionId`, `startedAt`, `endedAt`, `localDate`, `timezone`, and `activeSeconds`, plus indexes for workspace/session/time and workspace/local-date. Store rows only for explicitly habit-attributed sessions, split at local midnight, and only after pause/finish; active time not yet paused/finished is not reported as saved habit time. Enable RLS without adding browser policies.
- The migration adds nullable columns/table/index only. It must not update, delete, rename, or backfill existing records.

- [ ] Seed baseline Focus rows (active and completed) with recognizable IDs, task links, note/outcome, `activeSeconds`, version, and timestamps in the isolated PostgreSQL migration test.
- [ ] Apply migration 0006 only inside PGlite test cases after supported local migration histories; assert all seeded values are byte/value-equivalent, new fields remain null, and the new segment table is empty.
- [ ] Assert generated SQL consists only of nullable Focus columns plus the new table/index; reject any data update, delete, backfill, or destructive DDL.
- [ ] Confirm the PostgreSQL dialect and numbering from `drizzle.config.ts` and `supabase/migrations/meta/_journal.json`; do not use the stale MySQL journal in `drizzle/meta/`.
- [ ] Add the nullable fields/table/index in `drizzle/schema.ts` and generate `supabase/migrations/0006_focus_session_followups.sql` plus `supabase/migrations/meta/0006_snapshot.json` without running `db:migrate` or `db:push`.
- [ ] Ensure both Drizzle schema/snapshot and SQL show RLS enabled on `focusSessionSegments`, with no `CREATE POLICY`; inspect SQL and journal delta, calculate SHA-256, and run `npm test -- server/focusFollowupsMigration.test.ts`; require seeded rows unchanged, new fields null, segment table empty, and `relrowsecurity = true`.

### Task 2: Implement the guarded API and canonical calculations

**Files:** `server/focus.ts`, new `server/focusTime.ts`, `server/planning.ts`, `server/routers/planner.ts`, `server/focusTime.test.ts`, `server/focusFollowups.test.ts`, `server/focus.lifecycle.test.ts`, `server/planner.router.test.ts`, `server/planning.snapshotVisibility.test.ts`.

**Interfaces:**
- Focus start accepts optional `habitId`; service verifies it is active and belongs to `scope.workspaceId`.
- A version-guarded `planner.focus.setFollowUp` mutation saves `nextStepAction` and optional task target; task targets must belong to the workspace and be actionable.
- Snapshot reports `focusHabitAttributionAvailable` and per-habit saved active seconds grouped by the workspace-local date crossed by persisted intervals; all legacy rows contribute zero. Running intervals are excluded until pause/finish.
- Pause/finish appends segments only when an explicit `habitId` exists; task-only and unlinked Focus sessions retain existing behavior and do not create unused segment rows.
- If 0006 is absent, explicit legacy-column selections preserve existing start/pause/resume/finish and snapshot behavior. Only a confirmed PostgreSQL `42703` for a Focus-addition column may disable the new capability; unrelated connection/permission/query errors must remain visible as failures.

- [ ] Add pure interval-splitting tests first for UTC, workspace-local midnight, DST spring-forward/fall-back, and a paused session with multiple intervals; then implement the helper and make them pass.
- [ ] Implement scoped validation and compare-and-swap version checks; verify a stale attempt writes nothing.
- [ ] Pause/finish must atomically append the active interval segment and update Focus `activeSeconds`/state with expected-version CAS; reject a stale update without partial segment or task changes.
- [ ] Add workspace-local-day aggregation tests, paused/completed inclusion rules, midnight/DST splitting, and no double counting.
- [ ] Run focused backend and migration tests.

### Task 3: Connect Focus UI to the durable behavior

**Files:** `client/src/features/focus/FocusWorkspace.tsx`, `client/src/features/focus/FocusFollowUpPanel.tsx`, `client/src/features/focus/focus-watch.css`, `client/src/features/focus/FocusWorkspace.test.ts`.

**Interfaces:**
- Starting Focus may explicitly choose one habit; omission means no attribution.
- After finish, user chooses `task`, `plan`, or `none`; the selected action is saved and remains visible after navigation/reload.
- The UI distinguishes not saved, saved, offline, and conflict states; it never says a habit was completed because Focus time was recorded.

- [ ] Add the explicit optional active-habit selector to the start form and persist the selection only through `planner.focus.start`.
- [ ] Replace page-only handoff state with the version-guarded durable mutation and load saved action from the session.
- [ ] Show saved attributed time using workspace-local dates and explicit source/session labels; do not show unpersisted running seconds as completed habit time.
- [ ] Run Focus UI tests and synthetic browser checks for active/paused/finished states, missing capability, stale conflict, offline state, themes, and phone widths.

### Task 4: Final verification and truthful handoff

**Files:** `docs/FOCUS_ORCHESTRATION_SPEC.md`, `docs/PROJECT_STATE.md`, `docs/INDEPENDENT_STACK_HANDOFF.md`, `docs/PHASE4_SLICE_EVIDENCE.md`.

- [ ] Run `npm test -- server/focusFollowupsMigration.test.ts server/focusTime.test.ts server/focusFollowups.test.ts server/focus.lifecycle.test.ts server/planner.router.test.ts`, then `npm test`, `npm run check`, `npm run build`, and `python scripts/preview-t19-focus.py`; record exact counts/results.
- [ ] Verify `git diff --check`, migration checksum, changed files, and no accidental edits to `.playwright-cli/` or user data.
- [ ] Record that no Supabase migration, live data write, Vercel deployment, `main` merge, Apple Calendar authorization/sync, or physical-device test occurred.
- [ ] Leave the branch local unless the owner explicitly requests a push after reviewing the migration and preview compatibility gate.
