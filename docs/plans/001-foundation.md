# 001 — Foundation

Status: local foundation established as of 2026-10-01; full Phase 4 and live rollout remain open.

## Goal

Provide a stable base for Phase 4 changes while preserving planner identity, route access, offline work, and the existing visual language. This page records existing work and its remaining gates; detailed execution lives in [Phase 4 Tasks 1-10](../superpowers/plans/2026-09-14-phase4-total-product-redesign.md).

## Established in the workbench

- The repository branch is `dev/personal-calendar-workbench`; `main` is the frozen R20 reference. The Phase 4 capability ledger and [slice evidence](../PHASE4_SLICE_EVIDENCE.md) track preservation.
- Three functional prototype variants were evaluated. The owner selected Variant A colours and architecture, with an accessible A-derived dark appearance and the exact R20 Task lane gradients; see [visual selection](../PHASE4_VISUAL_SELECTION.md).
- `client/src/App.tsx` keeps `AuthenticatedPlanner` around the router. `client/src/features/shell/PlannerShell.tsx` supplies the shared rail, phone navigation, and global actions. `shared/phase4Navigation.ts` and `shared/phase4Preferences.ts` provide canonical navigation and versioned device-local preferences. The preference migration retains a backup of the prior value.
- `shared/todayProjection.ts` provides a pure Today projection over existing records. Phase 4 does not create a duplicate task identity for Today.
- The additive Phase 4 product migration has a guarded, default-read-only controller; the [handoff](../INDEPENDENT_STACK_HANDOFF.md) records its pinned hash and `readyForApply: false` status. No Phase 4 live migration is inferred from the presence of SQL or generated schema.

## Invariants for subsequent work

1. Keep one record identity across Today, Tasks, Calendar, Overview, and Roadmap. Preserve legacy URLs, queries, saved views, phone pin order, and Back/Forward behavior.
2. Keep `Due by`, `Plan for`, reserved intervals, daily commitments, recurrence occurrences, and actual focus separate.
3. Keep supported task writes in the account/workspace offline queue; show other writes as online-only until separately designed.
4. Preserve planner rows, IDs, relationships, timestamps, versions, histories, conflicts, and queued operations. A code rollback does not delete data or cache.
5. Complete infrastructure decoupling and validate it before Vercel deployment; the broader UI/UX redesign follows the deployment gate under the repository working rules.

## Remaining proof

- A fresh read-only inventory of the intended live database and a recoverable backup tested in isolation are needed before any approved Phase 4 migration. The last bounded inventory failed certificate validation; do not bypass TLS verification.
- Preview and physical-iPhone checks are distinct from local tests and synthetic Chromium results. The whole-app route/state/viewport gate is [Task 22](../PHASE4_UI_UX_COVERAGE.md).
- For changes to this foundation, run focused tests, `pnpm check`, `pnpm test`, and `pnpm build:client` as appropriate, then record exact current results. Historical passing counts in the handoff are checkpoints, not a claim about a new change.

Next: continue the remaining Phase 4 slices in the detailed plan, maintaining these invariants and recording each slice's evidence.
