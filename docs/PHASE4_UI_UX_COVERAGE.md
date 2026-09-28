# Phase 4 whole-app UI/UX signoff map

This is the visual and interaction gate for the workbench branch, not a feature-removal list. Variant A day tokens and their accessible dark adaptation remain the production direction. Exact R20 Task-lane colours remain preserved. Task 14 builds Recovery, while Tasks 15-21 improve destination workflows; Task 22 must sign off every reachable surface and Task 23 adds notifications last.

| Surface | Feature owner | Whole-app signoff owner |
| --- | --- | --- |
| Today, earlier commitments, interruptions, completed evidence | 12, 14, 18, 19 | 22 |
| Separate customizable Overview and factual habit heatmap | 20 | 22 |
| Tasks Inbox/List/Board, saved views, archive, task detail | 11 | 22 |
| Capture, search, quick actions and empty results | 11 | 22 |
| Plan daily/weekly, Recovery and capacity | 14, 15 | 22 |
| Calendar Day/Week/Month/Quarter/Year and subscription context | 15 | 22 |
| Projects, Goals/Directions, Roadmap and detail states | 16, 17 | 22 |
| Habits, return after a gap, history | 18 | 22 |
| Focus and persistent shell control | 19 | 22 |
| Review, Insights, History | 21 | 22 |
| Settings: account, appearance, navigation, sync, connections, categories, recycle, PWA, sign-out | 21 | 22 |
| Shared desktop rail/top bar, phone bottom bar/More, pins/density/theme, route loading | 5-7, 21 | 22 |
| Authentication, unlinked/recovery screens, PWA/offline/conflict overlays, 404, still-reachable legacy views | Existing | 22 |
| Notification preferences and delivery surfaces | 23 | 23 final signoff |

For each row, capture a route/overlay/state by viewport result at 320px, 390px, phone landscape, 768px, and 1440px. Exercise both light and dark Variant A themes and both phone densities where relevant. Check spacing and margins, text measure and hierarchy, contrast, visibility, target size, button placement, safe-area and keyboard clearance, desktop fixed rail, phone taskbar/More alignment, customizable navigation, predictable back/focus, and zero page-level overflow. Include empty, loading, error, offline, conflict, archived, long-label, and large-data cases. Record screenshot path, defect owner, fix commit, and recheck result in `docs/PHASE4_SLICE_EVIDENCE.md`.

No synthetic/browser result is a physical-iPhone or VoiceOver claim. Existing features remain reachable throughout the redesign; hidden modules must be recoverable from settings. Task 22 is not complete until every row has evidence or a clearly documented, owner-approved exception.
