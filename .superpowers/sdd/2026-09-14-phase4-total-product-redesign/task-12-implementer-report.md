# Task 12 implementation report

## Outcome

Completed the canonical, action-first Today workspace on `dev/personal-calendar-workbench` using the owner-approved Variant A colours. Today projects the existing planner snapshot and offline task overlay; it does not copy records, manufacture history, or write to a new task model. The responsive briefing is useful at 320, 390, 768, and 1440 pixels, and its final phone content scrolls clear of the fixed navigation.

Commits: `3a518ec` (Today workspace), `443cd12`, `559e2cc`, `f4a237d`, `53d7f96`, and `7493c24` (review-driven history, recurrence, and offline-cache safety).

## Behavior and preservation

- Today separates incoming read-only calendar context, reserved/fixed time, flexible executable work, scheduled habits, recovery, and collapsed completed evidence. Capacity distinguishes merged timed demand, flexible estimates, break allowance, all-day unavailability, and missing estimates; it does not imply a precise forecast where facts are absent.
- Task actions retain canonical record IDs and existing mutation paths. Blocked work offers detail/blocker review instead of a false Start focus action. Start focus hands the exact selected task into Focus, including tasks beyond the first 50 options. Global Focus navigation clears that preselection.
- The existing unresolved daily-plan commitment state is reachable through Plan's real `planner.dailyPlan.resolveItem` path from Today's recovery call to action. There is no fabricated recovery write. `commitmentResolutions: []` remains an explicit pre-migration compatibility choice; Task 13/14 may replace this once the additive migration is authorized and applied.
- Habits retain their existing check-in action and show reconnect guidance instead of promising an offline write. External calendar events remain read-only context. Today exposes offline capture/sync truth and conflict entry points.
- The old Today canvas controls remain available at canonical owners: Daily Compass and recurring planning in Plan, triage in Tasks, AI Companion in Capture, goals in Goals, analytics in Insights, habits in Habits, and calendar controls in Calendar. Disclosure content mounts only when opened.
- Exact-record detail/navigation returns correctly. A stale selected record no longer opens a ghost Search sheet after destination changes.

## Post-review safety addendum

- An independent Sol 6 High review found that a generic Today checkbox could complete the parent task of a dated recurrence or leave a daily-plan item committed. Today now derives occurrence and commitment links from canonical snapshot records, regardless of whether the row is labelled reservation, planned work, or recurrence. Linked rows use a non-checkbox resolution action and cannot trigger generic complete, swipe complete, archive, detail mutation, or Focus handoff from Today. Review opens the exact dated occurrence, including items beyond the former three-row preview; Plan focuses the exact commitment. A row with both links goes to Review first and keeps the remaining Plan commitment visible.
- Plain task quick actions remain. Completed/blocked selection falls back to another executable task; unsynced `offline:*` IDs cannot be started in server-backed Focus. Protected action labels name their actual destination for screen readers.
- Later review found and fixed older-history gaps: each outstanding non-archived commitment now remains distinct even when several reference one task; missing-task links show reconciliation rather than disappearing. The snapshot loads only the owning plans needed for committed items outside its normal date window. A recurring series without a materialized occurrence is fail-closed with a non-mutating explanation. Generic terminal task, bulk, Focus-done, and offline-replay paths reject outstanding-history or recurring-series parent mutation.
- Offline optimism comes from the queued-operation overlay, not the durable confirmed snapshot. A deterministic history-policy rejection moves the operation to review, removes its optimistic terminal state, and revalidates the snapshot, including after reload. Transactional read/check/write and immutable resolution evidence belong to Task 13.

## Verification

- TypeScript: `.\node_modules\.bin\tsc.cmd --noEmit` passed.
- Focused Vitest: 8 files, 72 passed, 0 failed (Today/projections, canonical tasks, forecast, habits, offline capture, navigation, Task workspace).
- Initial full Vitest run: 75 files passed; 425 tests passed, 3 skipped. A legacy-provider scan flagged an invalid-URL test variable in `scripts/phase4-product-migration.test.ts`; `c685aba` renamed it without changing behavior, and subsequent complete suites passed.
- Production `npm run build` passed, generating PWA release `22859a27f663a54b` with 21 shell files. Existing Search static/dynamic import and large-chunk warnings remain.
- Final synthetic Chromium Today flow passed 4/4 at 320, 390, 768, and 1440 pixels, with canonical order/identity, read-only external context, detail return, real recovery mutation, Focus task handoff, offline habit guidance, actual empty Today, touch-target/text checks, scroll clearance, and no overflow/runtime errors/unexpected requests. Artifacts: `C:\Users\win 10\AppData\Local\Temp\personal-calendar-phase4-product-20260928T010954Z\` (including `today-empty-390.png` and `today-empty-end-390.png`).
- Adjacent synthetic Task/Capture/Search flow passed 2/2 at 390/1440 (`...20260928T005445Z`); shell navigation passed 2/2 at 390/1440 (`...20260928T010506Z`). `git diff --check` passed.
- Post-review final verification: full Vitest 76 files, 431 passed, 3 expected skips; TypeScript and production build passed (PWA release `f76fc225a900aa62`). The guarded Today Chromium matrix passed 4/4 at 320/390/768/1440, including linked action surfaces, exact 4th occurrence/Plan-item handoff, combined-link order, stale Focus, offline ID guard, accessibility target size, and scroll clearance. Final screenshots/results: `C:\Users\win 10\AppData\Local\Temp\personal-calendar-phase4-product-20260928T014505Z\`; stable local copy: `temp/phase4-visual-evidence/task12-safety-final-014505/`. The earlier legacy scan false positive was removed by `c685aba`; the full suite now passes.
- Final Task 12 safety verification after independent review: 80 test files, 476 passed, 3 expected skips on the combined Task 12/13 tree; TypeScript and build passed on the final offline-cache fix. Today/browser matrices passed 4/4 at 320/390/768/1440 for older plan links, unresolved recurrence, and rejected offline replay after IndexedDB reload. Stable local evidence: `temp/phase4-visual-evidence/task12-final-022729/` and `temp/phase4-visual-evidence/task12-offline-rejection-final-024640/`. Independent Sol 6 High review found no remaining Task 12 release blocker after `7493c24`.

## Scope and remaining gates

No live database, migration, deployment, merge, or external integration was touched by Task 12. A later workbench-branch push does not apply either migration. Physical iPhone/Safari, VoiceOver, dark theme, reduced-motion runtime, live persistence, and authorized recovery migration remain unclaimed. Bounded Overview customization and factual habit heatmap belong to Task 20, not Today. The frontend-design skill informed the hierarchy, responsive composition, explicit states, and touch targets; its off-brand palette suggestions were not used.
