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

For each row, inspect a route/overlay/state at 320px, 390px, phone landscape, 768px, and 1440px. Exercise both light and dark Variant A themes and both phone densities where relevant. Check spacing and margins, text measure and hierarchy, contrast, visibility, target size, button placement, safe-area and keyboard clearance, desktop fixed rail, phone taskbar/More alignment, customizable navigation, predictable back/focus, and zero page-level overflow. Include empty, loading, error, offline, conflict, archived, long-label, and large-data cases. Record measured browser evidence and recheck result in `docs/PHASE4_SLICE_EVIDENCE.md`. Temporary synthetic captures used for the bounded Astra review and internal visual checks on 2026-10-01 were removed from `%TEMP%` after review. The owner prefers image-free browser checks going forward unless they explicitly approve new captures. Future Astra use requires a separate explicit yes from the owner.

No synthetic/browser result is a physical-iPhone or VoiceOver claim. Existing features remain reachable throughout the redesign; hidden modules must be recoverable from settings. Task 22 is not complete until every row has evidence or a clearly documented, owner-approved exception.

## Owner-authorized redesign work (2026-10-01)

The owner explicitly authorized local UI/UX redesign before deployment. This overrides only the order of local design work; infrastructure validation remains a hard prerequisite to Vercel deployment, and no database/migration action is authorized by this decision. Keep work on `dev/personal-calendar-workbench`; preserve every existing capability, record, identifier, relationship, and history.

### Independent source audits

Two agents reviewed different aspects without modifying files or accessing the browser/database. These are code-backed findings, not yet a whole-app runtime defect census.

| Priority | Finding | User impact / repair direction | Current state |
| --- | --- | --- | --- |
| P0 | Approved A tokens are overridden by repeated root themes, page-level hex colors, and an explicit dark-mode-to-light-surface block (`phase4-tokens.css`, `index.css`, Today/Calendar styles) | Make A daylight/night the single semantic source, then migrate high-traffic surfaces; preserve user theme selection and exact task-lane palette. Core token pairs already pass AA; inconsistency is the actual defect. | Global shell/Focus tokens and Today aliases now use A tokens; Calendar's last unconditional light palette is overridden by A tokens. Component accent is separated from brand-action color. Other destinations still have legacy palettes; whole-app color signoff remains open. |
| P0 | Projects & Goals composition also mounts legacy GoalPanel and a second project listing on the Goals alias (`Home.tsx` around 8552-8660) | One canonical Projects/Outcome/Directions surface; preserve capabilities by migrating them before removing duplicate renderers. Keep legacy URLs as adapters. | In progress; legacy tools are grouped under a disclosure, project card/dropdown selection now shares the URL state, and phone has a project detail/back transition. The progress compass and breakdown actions still need intentional placement in the canonical detail. |
| P0 | Habits destination stacked HabitPanel, HabitCalendarTracker, HabitDisciplineWorkspace, and AnalyticsPanel over overlapping check-in/history data | One authoritative habit surface with selected habit/month drill-in; preserve one-tap tick/Undo, calendar, correction, skip/miss, consistency, archive, and history. Move task-only charts to Insights. | Task 18 local slice now mounts one grouped Habits workspace with visible seven-day trace and month calendar; Home stays compact and task charts are in Insights. Image-free responsive checks passed, but authenticated live Preview, phone device, VoiceOver, and Task 22 whole-app visual signoff remain open. |
| P1 | Focus mutations have no `isOnline` boundary (`FocusWorkspace.tsx`) | Disable start/pause/resume/finish before tap while offline, explain the online requirement, retain an active local display without implying changes were saved. | Implemented locally and unit-tested; shared Home connectivity is wired. Offline runtime toggle remains unverified to avoid altering the owner's intentionally active session. Readable multi-day elapsed/overrun labels are display-only. |
| P1 | Settings combines a read-only outbound Apple Calendar subscription and device notifications under “Calendar & reminders” (`Home.tsx` around 6735-6755) | Split copy/surfaces so users do not infer incoming Apple/Google event sync. | Not started. |
| P1 | Today's large hero and summary stack can place the next action below the first phone screen (`TodayWorkspace.tsx`, `today-workspace.css`) | Put actionable next step before optional capacity/commitment diagnostics while retaining all data. | Contextual phone action now precedes summary and duplicate CTA is removed; narrow-phone metrics now use two columns with the final item spanning both. Authenticated runtime recheck remains unavailable from the isolated browser session. |
| P1 | Phone Plan stage control compresses five stages into equal tiny controls; Calendar contains 8-11px labels (`plan-stages.css`, `calendar-execution.css`) | Make current stage and movement legible, increase calendar text/control readability, define a deliberate phone calendar layout. | Phone Plan now has a named stage with Back/Next and a jump selector; Review now starts with saved commitments and the weekly tools are expandable. Calendar controls use semantic theme colors. Synthetic route checks passed; live-device verification remains open. |
| P1 | Goal/Directions meaning and review details are small secondary text (`intention.css`) | Elevate outcome-vs-direction meaning and the next action; use full detail on demand without losing provenance. | Core intention cards and detail lines now use larger semantic text; the complete long-term flow still needs Task 17's Timeline and whole-app signoff. |
| P2 | Phone More hides Habits/Review by default; alias destinations appear as peer views in desktop rail and phone More (`phase4Preferences.ts`, `PlannerRail.tsx`, `PhoneNavigation.tsx`) | Align primary/secondary hierarchy; preserve user order/pins and route compatibility. | Phone More is grouped and pinned parent tabs now represent Calendar/Goals/Insights child routes; desktop alias hierarchy and broader customization signoff remain open. |
| P2 | Review vs Insights scope is not explicit | State that Review is reflection/history and Insights is read-only analysis; keep calculations unchanged. | Not started. |

### Short Astra prioritization (2026-10-01)

Simplify the experience without removing capability: consolidate duplicate Projects/Goals and Habit editors under one canonical owner; make navigation match the user's task rather than expose aliases as peer destinations; guide phone planning with a visible current stage and reachable Back/Next; distinguish due date, planned day, reserved time, and actual focus where each action occurs; finish the A-token system before adding decoration. Keep every existing action, history record, setting, and compatible deep link reachable.

A bounded second review of real synthetic phone/desktop views recommended one selected project detail, daily Review separated from Commit, weekly outcomes accessible without occupying the daily review, grouped phone More, and paired light/dark component colors. The owner later gave explicit yes for bounded Astra Medium consultations on Task 17 and Task 18. All have finished and stopped. Task 18 advice prioritized visible tick/calendar tracking, grouped due/flexible/done/paused practice, honest weekly progress, notes and historical corrections, and a compact Home habit section. No new Astra use is authorized without another explicit yes. Plan → Roadmap and selected Project → Timeline are on the dev branch; Task 18 is a local owner-review checkpoint. Whole-app signoff remains open. `/phase4-prototypes` is still only a prototype.

### Execution sequence

1. Preserve the completed Task 16 functional delivery while consolidating duplicate Projects/Goals views without losing progress, compass, or project-breakdown actions.
2. Consolidate the Habit destination around one source of truth without dropping any existing actions/history.
3. Continue the verified Focus connectivity and Today action-first slices; fix remaining narrow-phone summary density and make long active-session duration readable without changing session data.
4. Clarify Calendar/notification boundaries and unify navigation hierarchy while preserving URL/back/pin behavior.
5. Improve phone Plan and Calendar readability, Goal detail hierarchy, and Review/Insights naming; test small phone/landscape/tablet/desktop and both themes.
6. Continue Tasks 17-22, then run the whole-app quality gate in the coverage matrix. Notifications stay last. No deployment or migration until independent-stack gates pass.

### Design constraints

Use the owner-approved A colors and exact task lanes. The existing token system uses Variant A by day with an A-derived accessible dark theme; borrow rich layered depth selectively but avoid stacking glass/clay/neumorphic/skeuomorphic treatments. Follow the complete component rules in `design-system/personal-calander/MASTER.md`. User asked for live browser verification but no screenshots; inspect the local app with agent-browser at relevant routes/viewports, do not claim physical-iPhone or live-deployment success. The agent-browser test context is isolated from the owner's authenticated Edge context, so protected-route visual claims require an explicitly connected browser surface.
