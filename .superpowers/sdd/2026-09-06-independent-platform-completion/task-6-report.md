# Task 6 report

Prepared a guarded Supabase/Vercel rollout on `dev/personal-calendar-workbench`; no external writes performed.

## Implemented

- Added `scripts/audit-supabase.mjs`: repeatable-read/read-only PostgreSQL transaction, default read-only connection, 10-second statement timeout, metadata/aggregate queries, explicit allowlisted report projection and generic errors. No record bodies, credentials, Auth UUIDs, object paths, push endpoints, policy expressions, Cron commands or Vault values are fetched/output.
- Unsupported identity shapes, missing planner tables, empty/multiple unresolved workspaces, invalid target accounts and conflicting owners produce nonzero CLI status. Optional target IDs are parameterized and never output.
- Replaced service tests that fetched sample records with Auth settings GET and zero-row REST HEAD probes. Offline mocked tests now run normally; real service checks require the explicit services configuration. Modern publishable/secret keys do not become Bearer tokens.
- Handoff records observed evidence, the current mismatch gate, exact migration hashes/order, conditional backup/upgrade/deploy/Cron steps, aggregate comparisons, guarded rollback requirements, and the existing phone Sign out obstruction.

## Verification

- Genuine RED: focused audit/credential tests failed to import the not-yet-created audit module.
- GREEN: `pnpm vitest run server/supabase.database.test.ts server/supabase.credentials.test.ts` passed 7 offline tests; 3 live tests skipped. Regression coverage includes sensitive/circular raw payloads, unsafe metadata, unsupported shapes, missing tables, unresolved/conflicting ownership, no existing workspace, null counts, read-only transaction/timeout and redacted rollback errors.
- `pnpm test:services`: 10 tests passed, including safe real Auth/REST probes and read-only database metadata/count audit.
- CLI connected and exited 1 with `no-existing-workspace`, correctly blocking rollout. Saved redacted report outside Git at `C:/Users/win 10/personal-Calander-analysis/supabase-structural-audit-2026-09-06.json`.
- Saved report: all 30 expected tables present, all row counts zero, RLS enabled on all 30, users.openId only, no new auth/ownership fields, planner-files bucket, policies, Cron catalog or migration journals. Vault installed; pg_cron/pg_net absent.
- Controller subsequently audited the correct alternate project: 46 public tables, nonzero unrelated learning-table counts, planner tables all zero, no planner-files bucket/Cron/journal. Handoff distinguishes that observation from this agent's earlier saved 30-table report; neither is proof that existing planner data has been found.
- `pnpm check` passed after final code/test changes. `git diff --check` passed. No full suite rerun as instructed; Task 5 already recorded integrated 200-test verification.
- Main and origin/main remain `782776d7f2a85a52e48a3464989b9ffdbe74c21f`.

## Self-review and gate

Reviewed all Task 6 changes for accidental network access in offline tests, raw exception/body leakage, unsafe identifier interpolation, read-only enforcement, output overwrites, and unguarded rollout instructions. Fixed SQL reserved aliases and null-count reporting before completion. Aggregate table identifiers come from a hardcoded planner list; target values are parameters. The audit counts arbitrary public tables only when they are expected planner tables; other table row counts remain null, while names/columns/RLS are structural metadata.

The exact data-bearing project/export, backup verification, existing workspace/user IDs, Vercel project and preview URL are unresolved. Commands are conditional review templates, not approved for either empty planner target. Do not apply migrations, claim a workspace, install the bucket/Cron, push, or deploy until the correct dataset is identified and a concrete target-specific rollout is reviewed. Preserve unrelated data in the alternate project. No live records, schema, ownership, bucket, policies, jobs, Git remotes, or deployments were changed by this task.

Controller changes in `client/src/lib/supabase.ts` and untracked `.playwright-cli/` are excluded from this commit.
