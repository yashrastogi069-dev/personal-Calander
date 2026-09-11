# R21 Morning Rollover Acceptance

## Delivered contract

Morning rollover is deliberately **manual and reviewable**, not a background job. The Calendar route requests a preview for the previous completed local day and shows an Apply control only when unfinished task-owned reservations exist. The control explicitly states that it clears **Reserve time only** and keeps task state, Plan for date, and recurrence unchanged.

Applying a reviewed candidate is version-safe and transactional. It writes one immutable `taskReservationRollovers` row per task/source-day, clears `plannedStartAt` and `plannedEndAt`, increments `rescheduleCount`, and preserves `scheduledLocalDate`, lifecycle state, estimate, project/goal/category links, and recurrence fields. A unique task/source-day constraint means repeated preview/apply attempts do not double-count the same rollover. Today and future local dates are rejected server-side. No timer, polling loop, cron, reminder, or automatic action has been added.

## Isolated browser proof and cleanup

A clearly named disposable task, **R21 QA manual morning rollover**, was created with a 30-minute estimate. It was manually reserved at 09:00–09:30 on Wednesday 2026-08-26 through the task execution calendar. On Thursday 2026-08-27, the Calendar route displayed one reviewed candidate and the visible **Apply 1 rollover** action.

After Apply, the task returned to the unreserved inbox with visible text `rescheduled 1×`; the morning-rollover panel returned to its empty state. Direct database verification proved state remained `not_started`, `scheduledLocalDate` remained `2026-08-26`, reservation timestamps were `NULL`, `rescheduleCount` was `1`, and the audit evidence retained the original 09:00–09:30 block. Targeted cleanup then deleted only the disposable task, its rollover row, dependencies, occurrences, daily-plan items, focus sessions, and proposals. The final cleanup query returned zeros for every scope.

## Validation

The migration `0012_nice_morph.sql` was reviewed and applied as additive-only schema work. Full automated validation passed: 35 Vitest files / 128 tests, TypeScript, and production client build. Desktop 1280×720 and iPhone 390×844 screenshots showed the rollover surface with readable language, reachable controls, and a distinct task-only execution canvas.
