# R21 Weekly Review Checklist Refinement

## Why this refinement

The next execution-quality improvement was selected from current planner practice rather than adding another generic dashboard control. Sunsama’s daily-planning guidance stresses reflective review, bounded workload checks, ordered work, and deliberate finalisation; its timeboxing guidance pairs planning with explicit duration. Todoist’s weekly review frames the useful sequence as clearing loose inputs, updating current work, checking goals/projects, and choosing the next move.[1][2][3]

Personal Calendar already had persisted review reflection, review history, planning signals, and goal/project context. The missing operational bridge was a **small, recoverable review path** that makes the review usable before the reflection field without creating automatic tasks, dates, calendar blocks, or external actions.

## Delivered workflow

The open weekly review now includes five persistent checks grouped as **Get clear**, **Get current**, and **Set direction**. They cover loose captures, unresolved/waiting work, task lanes/deadlines, goals/projects, and one deliberate next-week move. Each item is an accessible native checkbox with an explicitly labelled completion state; progress is factual, stored in the existing review-session snapshot, and updated through a workspace-scoped optimistic-version contract.

Only an in-progress review can be changed. Unsupported checklist items/values are rejected; stale writes return the existing conflict-recovery behavior; a failed save restores the last persisted checklist and shows local recovery text. Completing a review keeps the stored checklist as part of its historical evidence. The feature adds no schema migration, recurring task, notification, external connection, or hidden plan change.

## Validation and cleanup

Focused contract coverage verifies normalisation, bounded keys/types, factual progress calculation, and public tRPC procedure wiring. The current automated baseline is **36 passing test files / 131 tests**, including the new two-test checklist suite and expanded planner-router coverage. Browser acceptance started a disposable weekly review, verified the accessible checklist region, checked **Process loose captures**, and observed the live state move from five to four remaining checks. Database inspection confirmed the persisted JSON state and version increment. The exact in-progress review session was then narrowly deleted; the cleanup query returned zero remaining rows.

A separate disposable weekly review was opened solely for 390×844 review of the checklist’s mobile layout. The grouped path, single-line progress counter, checkbox labels, and explanatory text remained readable above the installed-PWA bottom navigation. That exact second session (`uehZwo4_LyHoWvP2hp43D`) was then deleted through a fully scoped query; a final count confirmed zero remaining rows.

## References

[1] [Sunsama, Daily Planning](https://help.sunsama.com/docs/usage-guides/daily-planning/)

[2] [Sunsama, Timeboxing](https://help.sunsama.com/docs/usage-guides/timeboxing/)

[3] [Todoist, The Weekly Review](https://www.todoist.com/productivity-methods/weekly-review)
