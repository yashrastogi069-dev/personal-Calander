# Phase 4 capability-preservation ledger

Status: source-audited baseline; action-level verification scenarios are expanded per implementation slice.

Branch: `dev/personal-calendar-workbench`

## Non-negotiable invariants

- Preserve all existing planner capabilities, record IDs, workspace IDs, version fields, relationships, history, and offline/conflict evidence.
- A change in navigation or presentation never authorizes a schema reset, baseline replay, silent migration, record deletion, or altered progress calculation.
- Deadline, planned date, reserved interval, daily commitment, recurrence occurrence, and actual focus are distinct facts.
- A record shown in multiple views remains one record. Dashboards, boards, lists, calendars, and timelines are projections, not copies.
- Archive and recycle-bin behavior remains recoverable. Permanent deletion remains explicit and separately confirmed.
- Unsupported offline writes must fail honestly; the interface may not imply that every entity is currently writable offline.
- Existing URLs, stored mobile pins/order, density preferences, and authenticated workspace boundaries require compatibility handling.

## Product-level destination map

| Capability family | Current access | Phase 4 home | Preservation requirement | Implementation task(s) |
| --- | --- | --- | --- | --- |
| Daily execution | Today | Home → Today | One canonical task presentation; retain commitment and schedule semantics. | [2–4](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [5–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-5-establish-selected-semantic-tokens-and-accessible-sheet-primitives), [10](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-10-define-one-canonical-todaytask-projection), [12–15](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-12-replace-the-old-dashboard-like-today-canvas), [22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-22-complete-accessibility-large-data-and-measured-performance-work) |
| Personal overview | Today signals, Insights, Goals, Review | Home → Overview | Curated, reorderable modules over existing records; no duplicate state. | [2–4](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [5–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-5-establish-selected-semantic-tokens-and-accessible-sheet-primitives), [20–22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-20-build-bounded-home-overview-modules) |
| Fast capture | Top capture, Capture destination, PWA shortcut | Global Capture; Inbox | Preserve offline idempotent create, editable parsing, templates, and review-before-create. | [2–4](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [5–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-5-establish-selected-semantic-tokens-and-accessible-sheet-primitives), [10–11](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-10-define-one-canonical-todaytask-projection), [22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-22-complete-accessibility-large-data-and-measured-performance-work) |
| Workspace search | Search destination and task search | Global Search | Preserve tasks, goals, projects, habits, and review text; improve record-level deep links. | [2–4](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [6–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-6-add-canonical-route-and-device-preference-compatibility), [11](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-11-extract-canonical-tasks-inbox-capture-and-search), [22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-22-complete-accessibility-large-data-and-measured-performance-work) |
| Daily/weekly planning | Plan | Plan | Preserve daily plan state/history, weekly objectives, availability, templates, proposals, and rollover. | [2–4](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [5–9](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-5-establish-selected-semantic-tokens-and-accessible-sheet-primitives), [13–15](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-13-implement-transactional-strict-recovery-semantics), [21–22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-21-consolidate-review-insights-history-and-settings-utilities) |
| Calendar execution | Calendar | Plan → Calendar | Preserve Day/Week/Month/Quarter/Year, task reservations, move/resize, collisions, and timezone rules. | [2–4](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [5–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-5-establish-selected-semantic-tokens-and-accessible-sheet-primitives), [15](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-15-upgrade-plan-and-calendar-without-collapsing-date-semantics), [22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-22-complete-accessibility-large-data-and-measured-performance-work) |
| Long-term planning | Goals, Projects, Plan horizons | Projects & Goals; Plan → Roadmap | Preserve flexible relationships, milestones, dependencies, progress modes, and all horizons. | [2–4](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [5–9](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-5-establish-selected-semantic-tokens-and-accessible-sheet-primitives), [16–17](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-16-add-outcome-and-direction-semantics-without-reinterpreting-legacy-goals), [20–22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-20-build-bounded-home-overview-modules) |
| Task workflow | Tasks | Tasks | Preserve lanes, ordering, filters, saved views, archive/restore, recurrence, subtasks, priorities, and gestures. | [2–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [10–12](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-10-define-one-canonical-todaytask-projection), [22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-22-complete-accessibility-large-data-and-measured-performance-work) |
| Habit practice | Habits and Today | Habits; Today due habits | Preserve schedules, check-ins, skip/miss facts, corrections, history, streaks, and goal links. | [2–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [18](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-18-reframe-habits-around-return-and-correction), [20–22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-20-build-bounded-home-overview-modules) |
| Focus evidence | Focus and task actions | Focus; contextual Start focus | Preserve linked/unlinked sessions, pause/resume/stop, actual duration, outcome, and estimate adjustment. | [2–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [19–22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-19-make-focus-persistent-across-navigation) |
| Reviews and insight | Review, Insights, Today signals | Review → Rituals/Insights/History | Preserve daily through yearly sessions, reflection, snapshots, allocation, carryover, goal health, and planning health. | [2–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [13–14](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-13-implement-transactional-strict-recovery-semantics), [20–22](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-20-build-bounded-home-overview-modules) |
| Integrations | Connections and Settings | Settings → Connections | Preserve truthful status and source ownership; do not present readiness as live sync. | [2–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [21–23](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-21-consolidate-review-insights-history-and-settings-utilities) |
| Account and app | Settings, rail account area | Settings | Preserve sign-out, theme/density/navigation preferences, sync review, PWA state, category restore, and device controls. | [2–7](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-2-build-the-shared-functional-prototype-fixture), [21–23](superpowers/plans/2026-09-14-phase4-total-product-redesign.md#task-21-consolidate-review-insights-history-and-settings-utilities) |

## Data and action ledger

### Tasks and occurrences

- Fields: title, description, lifecycle state, priority, horizon, due date, planned date, reserved start/end, estimate, order, schedule mode, outcome, recurrence, parent, goal, project, category, completion/archive timestamps, record version.
- Relationships: subtasks, hard/soft dependencies, goal/project/category, recurrence occurrences, focus sessions, daily-plan items, reservation rollovers, schedule proposals.
- Actions: create, edit, complete/reopen, move lane, reorder, schedule/unschedule, resize reservation, reschedule, mark won't-do, archive/restore, archive completed, add/remove dependencies, generate/resolve occurrences, search/filter/save view.
- Recovery: queued offline create/update, conflict review, orphaned-operation review, explicit retry, no silent overwrites.

### Daily plans and check-ins

- Daily plan states: draft, active, closed, archived.
- Commitment outcomes: committed, done, rescheduled, deferred, won't-do, archived.
- Preserve ordering, resolved date, notes, timestamps, reopen behavior, prior-day rollover evidence, intention, reflection, energy, and mood.
- Phase 4 Strict accountability adds presentation and deliberate resolution; it does not overwrite historical commitment records.

### Weekly planning

- Weekly objectives may link to a goal/project or remain standalone.
- Preserve active/completed/continued/adjusted/archived states, evidence, carry-forward ancestry, and week-local dates.
- Weekly review must show what changed, not merely current task state.

### Goals, milestones, and projects

- Goals: optional parent/category, state, priority, daily-to-someday horizon, color, manual/task/measure/habit progress, values, dates, completion/archive history.
- Milestones: monthly/quarterly horizon, progress, dates, cue/response, lifecycle and archive history.
- Projects: optional goal/category, lifecycle, priority, horizon, dates, completion/archive history.
- Preserve standalone projects/tasks, direct goal-task links, and nested goals. Do not impose a mandatory goal → project → task hierarchy.
- Phase 4 intention types are product semantics layered over existing records: finishable Outcome goal and continuing Direction. Any required persistence change must be additive and separately reviewed.

### Long-term views

- Overview, List/Board, and Timeline/Roadmap must read the same goal/project/task/milestone data.
- Timeline spans month, quarter, and year and exposes milestones, dependencies, overlaps, risk, stalled state, and unplanned gaps.
- Dragging a timeline item previews consequences and requires explicit confirmation before changing stored dates.
- Phone uses readable grouped periods/milestones by default; detailed timeline manipulation may use landscape or a focused sheet.

### Habits

- Fields: name, description, color, daily/days-of-week/times-per-week/interval frequency, schedule, reminder time, optional goal/category, archive/version.
- Check-in facts: completed/skipped/missed by local date and timezone, with notes and correction history.
- Actions: create/edit/archive, complete, skip, clear/correct, inspect calendar/history.
- Accountability emphasizes recovery and consistent return; never rewrite past check-ins to protect a streak.

### Focus

- Preserve active/paused/completed/abandoned states, linked or unlinked task, target duration, accumulated active time, notes, outcomes, and estimate adjustments.
- Reserved time is planned time; it is never counted as actual focus without a recorded session.

### Scheduling and availability

- Preserve default workday/capacity/break settings and date-specific unavailable/custom-hour exceptions.
- Preserve proposal reasons, proposed/approved/dismissed/undone states, prior schedule values, collision checks, and undo.
- No automatic optimizer may silently alter the plan. Interruption recovery presents a reviewed repair proposal.

### Capture and templates

- Preserve quick capture, natural-language parsing, editable interpretation, Today/Inbox decision, offline queue, client request idempotency, and failure recovery.
- Preserve task/project/daily-plan templates, review-first payloads, explicit application, and archive behavior.
- AI-assisted drafts remain proposals requiring confirmation.

### Search, filters, and saved views

- Search tasks, goals, projects, habits, and review text.
- Preserve URL-backed task query/filter state and entity destination links.
- Preserve saved view type, configuration, pin state, order, version, and workspace scope.

### Reviews and insights

- Preserve daily, weekly, monthly, quarterly, and yearly review periods and snapshots.
- Preserve focus comparison, carryover, allocation, habit consistency, goal health, workload/capacity, deadline risk, and review history.
- Overview may summarize these signals, but detailed analysis and historical review live under Review.

### Account, synchronization, and offline behavior

- Preserve authenticated account → owned workspace authorization.
- Preserve account/workspace-scoped IndexedDB snapshots, operations, conflicts, and metadata.
- Sign-out clears mounted planner memory and hides the retained device cache; it does not delete online or offline data.
- Merge non-overlapping fields automatically; retain both values for overlaps; never infer deletion.
- Keep compact status visible. Required conflict/orphan review remains reachable and explicit.

### Categories, archive, and recycle bin

- Preserve category names, colors, ordering, relationships, restoration, and guarded permanent deletion.
- Preserve archived task/goal/project/habit/review history.
- The new Settings hierarchy changes access, not deletion semantics.

### PWA, appearance, and device behavior

- Preserve manifest identity, icons, shortcuts, standalone display, safe areas, controlled service-worker updates, offline shell behavior, and honest connectivity messages.
- Preserve light/dark/follow-device choice, phone density/navigation customization, rail collapse, pins, and ordering.
- Meet keyboard, pointer, touch, reduced-motion, contrast, and accessible-name requirements at every density.

### Connections, calendar, and notifications

- Preserve the private read-only Apple-compatible calendar subscription and existing standards-based Web Push controls/status.
- External events remain provider-owned context; importing an event does not silently create a planner task.
- Gmail remains a future capture/communication adapter with separate authorization and explicit email-to-task decisions.
- Notification/reminder activation and real iPhone delivery remain the final Phase 4 slice.

## Approved accountability behavior

- Levels: Gentle, Structured (recommended default), Strict.
- Strict unresolved outcomes: Done, Reschedule, Reduce, Pause, Abandon.
- Strict mode never locks the user out of unrelated work.
- Reduce captures revised scope; Pause captures a review date; Abandon is deliberate and historical.
- Persistent visibility and escalating presentation must not become notification spam or shame language.

## Home architecture

- `Today`: action surface for fixed appointments, reserved work, flexible work, due habits, and recovery decisions.
- `Overview`: orientation surface for attention, capacity, consistency, goal momentum, risk, milestones, follow-ups, and reviews.
- Desktop Overview may use a composed grid; phone Overview is a prioritized vertical briefing.
- Users can reorder/hide/resize a bounded module set. Defaults remain complete and useful without setup.
- The application should open Today by default unless the final prototype review selects remembered-last-view behavior.

## Slice exit criteria

Every Phase 4 slice must record:

1. capabilities moved and compatibility behavior;
2. affected entity fields and mutations;
3. online, offline, pending, conflict, error, empty, loading, and large-data states;
4. desktop and phone behavior, including safe areas and keyboard/sheet behavior;
5. automated tests and visual evidence;
6. unresolved physical-device checks;
7. confirmation that unrelated features remain reachable.
