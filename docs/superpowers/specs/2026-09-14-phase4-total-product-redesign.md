# Personal Calendar — Phase 4 product, design, and engineering specification

Status: implementation specification for the workbench branch. Visual selection remains an end-of-prototype review; routine implementation does not require additional product clarification.

## 1. Scope and authority

Implement on `dev/personal-calendar-workbench`. Preserve all capabilities in `docs/PHASE4_CAPABILITY_LEDGER.md`. Do not merge to `main`, promote Production, reset a database, replay a baseline, or overwrite planner history.

Use the current sections of `docs/INDEPENDENT_STACK_HANDOFF.md` as operational truth: Phases 1–3 have engineering/deployment evidence; physical-iPhone checks remain distinct from synthetic browser evidence. Private file storage remains deferred. Phase 4 must not reactivate superseded infrastructure instructions.

Phase 4 delivers a coherent personal planning experience, strengthened follow-through, meaningful long-term planning, responsive interaction, and visual polish. Phase 5 delivers deeper recording, analytical models, longitudinal explanations, and advanced reports. Existing insights remain available throughout.

## 2. Product promise and intended users

**Personal Calendar helps you remember what matters, make a realistic plan, return after interruptions, and connect daily action to longer-term intentions without losing your work.**

Design for one person managing a mixed life rather than a workplace-only task manager.

Primary scenarios:

- A person balancing appointments, work, household needs, meals, shopping, messages, and personal commitments wants a credible view of today.
- A person who starts habits consistently but loses momentum after interruptions needs a visible, manageable way to return.
- A person pursuing monthly, quarterly, or yearly outcomes needs milestones, projects, and next actions that remain connected.
- A person maintaining health, learning, relationships, or financial discipline needs continuing directions without artificial completion dates.
- A person planning on desktop and executing on a phone needs the same records and clear boundaries around offline changes.
- An experienced planner needs recurrence, subtasks, dependencies, saved views, templates, detailed reviews, and calendar controls without exposing every control in every row.

The acceptance scenario is a disrupted personal day: a meeting overruns, a reply is delayed, energy falls, dinner still needs arranging, a habit is due, and a meaningful goal needs attention. The app must help the person choose a workable next step and retain the unresolved remainder.

## 3. Product rules

1. Today is a projection of commitments and relevant context, not a separate task container.
2. Capture does not require deciding a deadline, project, or goal.
3. `Due by`, `Plan for`, `Reserved time`, daily commitment, recurrence occurrence, and actual focus remain separate facts.
4. Each record has one identity across list, board, calendar, Overview, and Roadmap.
5. Planning changes are explicit and reversible where the underlying operation permits reversal.
6. Strict accountability preserves intentional decisions; it never prevents access to unrelated work.
7. Recovery matters more than maintaining an unbroken streak.
8. Personal appointments, household work, rest, unavailable time, and unknown estimates affect planning realism.
9. Progress uses existing explicit relationships and calculation modes. Navigation changes do not change its meaning.
10. Every summary supports a decision and opens the records behind it.
11. Progressive disclosure changes where controls appear, not whether capabilities exist.
12. Unsupported operations communicate their limitation before the user believes a save occurred.

## 4. Information architecture

Use six primary destinations:

| Destination | Views and purpose |
|---|---|
| Home | Today for execution; Overview for orientation |
| Tasks | Inbox, List, Board, saved views, archive access |
| Plan | Daily/weekly planning, Calendar, portfolio Roadmap |
| Projects & Goals | Projects, Outcome goals, Directions; individual detail views |
| Habits | Due practices, schedules, history, recovery |
| Review | Rituals, Insights, History |

Global actions: Capture, Search, and Focus. Account utilities: Settings, Connections, sync review, appearance, phone layout, Categories & Recycle Bin, and sign-out.

Recovery is a resumable flow accessed from relevant screens and a compact attention indicator; it is not another global destination.

Home opens Today by default. A future remembered-last-view preference may be considered after prototype review; do not make it an implicit behavior change.

Desktop uses a fixed, collapsible navigation rail with an independently scrolling content region. Phone defaults to Home, Tasks, Plan, Projects & Goals, and More; preserve user customization and access to Habits and Review.

## 5. Home: Today

Today answers: **What needs my attention, what can I do next, and what no longer fits?**

Composition:

1. Date and a compact summary of chosen commitments, available time, and outstanding recovery decisions.
2. A small persistent recovery entry when unresolved earlier commitments exist.
3. Fixed appointments and reserved work in chronological context.
4. Flexible work chosen for today.
5. Due habits, presented as habits rather than duplicated task records.
6. Contextual next-action suggestions with a direct source and an explicit action.

A task with a reservation is rendered in the timeline rather than repeated as a full row in a second action queue. Its commitment and status appear on that canonical presentation. Summary counts and compact references may point to it without duplicating its actionable row.

Distinguish:

- Due today but not planned: an attention signal offering a planning decision.
- Planned today without a time: flexible work.
- Reserved today: a time block.
- Committed in a daily plan: an explicit daily promise.
- Completed today: supporting evidence, collapsed by default.
- Unresolved from an earlier day: recovery work, not silently moved into today.

A fixed appointment does not become a task automatically. Show a source marker and supported actions. Until incoming calendar support exists, the app must not imply that Apple appointments are present.

Capacity displays known scheduled demand, flexible estimates, unavailable time, and the count of unestimated tasks. Do not treat missing estimates as zero effort or pretend that a precise free-time number is complete when context is missing. Overlapping reservations must not double-count the same occupied minute.

Primary actions: Capture, Plan today, Start focus, and Resolve remaining work, shown contextually rather than simultaneously competing in the header.

## 6. Home: Overview

Overview answers: **What deserves a decision across my life and planning horizons?**

Provide a curated module set with useful defaults. Reorder, hide, and bounded size choices are device-local preferences in Phase 4. The default experience requires no dashboard construction.

| Module | Decision | Drill-through |
|---|---|---|
| Needs attention | What requires a deliberate outcome? | Recovery, overdue work, unresolved follow-ups |
| Time and capacity | Does the near-term plan fit? | Plan/Calendar with relevant period |
| Habits | Which practice needs completion or a return plan? | Habit schedule/history |
| Goals and directions | What needs a next action, progress update, or review? | Specific intention detail |
| Projects at risk | Which stalled or blocked work needs intervention? | Project and blocking records |
| Upcoming milestones | What needs preparation before the next checkpoint? | Milestone/Roadmap |
| Review | What is the next useful reflection? | Applicable review session |

Every module has a defined empty state, visible period, source records, and one primary next action. Avoid unexplained productivity scores.

Desktop uses a composed grid with unequal emphasis. Phone uses an ordered briefing with attention first. A hidden module remains discoverable through customization and its owning destination.

## 7. Tasks, Inbox, Capture, and Search

### Capture

Global Capture opens immediately from the shell, keyboard shortcut, existing PWA shortcut, and preserved legacy URL.

Default to Inbox with title only. Offer optional natural-language interpretation, showing editable chips before save. Parsing must distinguish a planned day from a deadline and expose ambiguous interpretation for correction. Preserve templates and review-before-create behavior.

Supported offline task capture uses the existing account/workspace queue and client-request idempotency. A successful local enqueue reads “Saved on this device” or equivalent until synchronized. Unsupported capture types retain the entered draft but do not claim a server save.

### Inbox

Inbox represents unclarified, unscheduled work using existing task records and compatible filtering. Do not create duplicate inbox entities.

Triage choices: clarify, plan for a day, reserve time, link to a project/goal, choose a horizon, mark intentional noncompletion, or archive. None are mandatory merely to retain a task.

### Task presentation

Visible row content: completion control, title, key date/time, limited relevant metadata, and one contextual action. Put secondary fields and actions in the detail sheet or overflow.

Retain all fields and actions: priority, lifecycle, horizon, due date, planned date, reservation, estimate, schedule mode, order, recurrence and occurrence handling, parent/subtasks, goal/project/category, outcome, dependencies, archive/restore, version/conflict status, and templates.

List and Board are views of the same records. Preserve three lanes and phone’s single-lane view. Gestures accelerate visible actions and remain optional. Provide undo for completion/archive where supported and an explicit fallback menu.

### Search

Global Search covers tasks, goals, projects, habits, and review text. Results show entity type, meaningful context, and a record-level destination. Opening and closing a result preserves query and filter state. Empty results offer a clear query reset, not an unsolicited creation.

Preserve structured task filters, saved views, order, pinning, and workspace scope.

## 8. Plan and Calendar

Plan supports both daily/weekly decision-making and longer horizons through Roadmap.

Daily planning follows a resumable sequence:

1. Inspect unresolved commitments and inbox inputs.
2. Review fixed context and availability.
3. Choose realistic commitments.
4. Reserve time where useful.
5. Confirm the plan.

Preserve daily-plan draft/active/closed/archived states, commitment outcomes, intention, reflection, ordering, history, reopening, and rollover evidence.

Weekly planning retains standalone or goal/project-linked objectives, evidence, state transitions, adjustments, carry-forward ancestry, and week-local dates.

Calendar preserves Day, Week, Month, Quarter, and Year. Retain scheduling, unscheduling, drag, resize, collision checks, manual/flexible/pinned behavior, availability defaults/exceptions, timezones, schedule proposals, dismissal, and undo.

Interaction rules:

- Moving a task to a day changes its planned day, not its deadline.
- Moving a reservation changes the reserved interval.
- Deadline edits use a separately labelled control.
- Resizing a reservation does not rewrite actual focus.
- Collision warnings identify what overlaps.
- Automatic repair produces a preview of proposed changes; Apply is explicit.
- A changed source version invalidates a stale proposal and requires recomputation or review.
- Keyboard and touch alternatives perform every drag/resize operation.

Dates use workspace-local calendar semantics; timed intervals retain actual instants and display timezone context. Daylight-saving transitions and non-existent or repeated local times require explicit handling.

## 9. Projects, Outcome goals, Directions, and Roadmap

Keep the hierarchy flexible:

`intention → milestone/checkpoint → project/workstream → next action → planned work → evidence/review`

Standalone tasks/projects, direct goal-task links, nested goals, and goal-linked habits remain supported.

### Outcome goal

A finishable result with explicit success criteria, optional target date, milestones, projects, progress mode, risks, dependencies, and next review. Dates remain optional so legacy undated goals remain valid.

Show current progress using the existing manual/task/measure/habit mode, its definition, next milestone, next action, and evidence. Completion remains an intentional lifecycle transition, not an automatic result of crossing a visual percentage.

### Direction

A continuing intention such as health or learning. Show purpose, supporting habits/projects, optional standards, evidence, and recurring review. Do not force a completion percentage or arbitrary finish date.

Existing progress configuration remains stored and accessible if an existing goal becomes a Direction. Changing intention type must preview presentation consequences and preserve prior history, dates, links, and progress values. Categories remain categories; do not silently convert them to Directions.

### Project detail

Views: Overview, List/Board, Timeline. Include purpose, optional goal, next action, lifecycle, priority/horizon, progress evidence, relevant dependencies, milestones, and review/attention state.

### Portfolio Roadmap

Roadmap shows projects and milestones across month, quarter, and year. Tasks appear through drill-through/list, avoiding a dense task-level Gantt chart by default.

Show overlaps, dated checkpoints, declared dependencies, explicit risks, stalled work, and gaps in planned execution. Undated items remain in a visible “Not yet dated” section; never fabricate bars.

Moving a bar previews exact date changes and affected dependencies or linked work. Saving requires confirmation. Do not cascade changes into every child task unless a reviewed proposal explicitly lists those mutations.

Phone defaults to grouped periods and milestones. Offer a focused horizontal timeline or landscape view for detailed inspection; all date edits remain possible without dragging.

## 10. Habits and accountability

Habit views retain daily, selected-weekday, times-per-week, and interval schedules; reminder time; goal/category links; archive/version fields; history; notes; and correction behavior.

Completed, skipped, missed, and not-yet-due remain distinct. Missing input is not automatically evidence of a deliberate skip. Corrections preserve history rather than rewriting the past to protect a streak.

Show next scheduled opportunity and recent consistency. When a practice has been interrupted, offer a small return decision: resume its current schedule, revise it, or pause until a review point. Historical missed opportunities do not generate an unlimited mandatory resolution backlog.

### Accountability levels

Gentle consolidates recovery into reviews. Structured is the recommended default and makes unresolved work clear at relevant moments. Strict persists unresolved commitments until an intentional resolution.

The owner’s approval of Strict establishes its availability; it does not establish that every user must use Strict.

| Strict action | Required meaning |
|---|---|
| Done | Complete the intended task/occurrence and resolve the linked commitment using existing domain semantics |
| Reschedule | Choose a new planned day; preserve deadline and prior commitment history |
| Reduce | Record revised scope and a concrete next commitment; retain the original scope/decision evidence |
| Pause | Record a return/review date; retain the item and show it again when that point arrives |
| Abandon | Record intentional noncompletion with timestamp/history; do not delete or represent it as completion |

Changing accountability level does not rewrite outcomes or discard unresolved commitments.

Recovery groups multiple historical references to the same task while preserving each commitment record. A current decision must specify which commitment/occurrence it resolves. Rescheduling one occurrence must not unintentionally rewrite the recurrence series.

The flow can be closed and resumed. Strict uses persistent count/status and contextual prominence, never a lockout, forced modal on every navigation, shame copy, or notification escalation.

## 11. Focus

Provide contextual Start focus and a global Focus mode. Preserve linked and unlinked sessions, target duration, active/paused/completed/abandoned states, accumulated active time, notes, outcome, and estimate adjustment.

The running session remains visible through a compact persistent control when navigating. Pause, resume, stop, and return to full Focus are keyboard and touch accessible.

Finishing asks for the existing supported outcome: done, continue, adjust estimate, or stopped. Actual focus comes from recorded session state, not reservation duration. Browser suspension and refresh must not manufacture elapsed active work.

Current non-task offline limitations apply: the UI must not claim that unsupported focus mutations were durably saved. Display the last confirmed session state and explain the available recovery path.

## 12. Review and Insights

Review contains Rituals, Insights, and History.

Preserve daily, weekly, monthly, quarterly, and yearly periods, reflection, energy/mood, snapshots, allocation, carryover, focus comparison, habit consistency, goal health, planning health, and workload/deadline signals.

A ritual proceeds through evidence, reflection, unresolved decisions, and next commitments. Sessions are resumable. Historical snapshots remain historical; a current task edit must not rewrite what an earlier review recorded.

Insights show inspectable existing calculations with dates and source records. Phase 4 improves comprehension and drill-through. New activity ledgers, inferred interruption patterns, correlation models, personalized forecasts, and advanced dashboards belong to Phase 5.

## 13. Settings and connection boundaries

Use grouped settings rows rather than repeated decorative cards:

- Account and owned workspace.
- Workspace timezone and planning defaults.
- Appearance, density, navigation, and Overview layout.
- Sync status, pending operations, conflicts, and orphan review.
- Connections: calendar subscription and notifications.
- Categories & Recycle Bin.
- PWA/device status and update controls.
- Sign out on this device.

Sign-out remains pointer-accessible above safe areas/navigation. Preserve the current confirmation and account boundary. It hides retained account-scoped offline cache; it does not delete planner data.

Current Apple Calendar support is an **outgoing, private, read-only calendar subscription** displaying planner-owned work in Apple Calendar. It is not incoming Apple appointments or two-way synchronization.

Incoming calendar context requires a separately engineered adapter with provider authorization, stable external identity, source ownership, refresh/error state, cancellation handling, timezone/recurrence policy, and revocation. Phase 4 may prepare a truthful UI boundary but may not label it connected without implementation and verification.

Gmail capture remains future work with separate authorization and explicit email-to-task conversion. Do not retain message bodies for analytics by default.

Notifications are the final Phase 4 slice: explicit device opt-in, supported installed-app state, permission outcomes, test delivery, cadence, timezone, opt-out, and real-iPhone confirmation. Do not equate subscription success or scheduler success with delivery to the phone.

## 14. Responsive and accessibility contract

Phone:

- Minimum 44px interactive hit regions in both densities.
- Stable safe-area-aware bottom navigation.
- Full-viewport sheets rendered outside sticky/filter containing blocks.
- Fixed sheet header, independently scrolling body, accessible final actions.
- Back, Close, scrim, and Escape behavior; swipe-down is optional.
- Preserve draft and scroll position through sheet transitions.
- Accommodate software keyboard and visual viewport changes.
- Do not require horizontal page scrolling; timeline scrolling is confined and explicit.

Desktop/tablet:

- Rail and content scroll independently.
- Task detail may use a side panel while retaining list context.
- Keyboard shortcuts have discoverable equivalents and do not override typing.
- Dense mode reduces spacing but retains readable text and accessible targets.

Accessibility targets: WCAG 2.2 AA behavior, semantic landmarks, visible focus, logical order, proper dialog focus trapping/restoration, accessible names, live announcements for relevant state changes, contrast verification, non-color status indicators, 200% text scaling, reduced motion, and complete alternatives to drag/swipe.

Prototype/test widths: 390px phone, narrow 320px stress case, phone landscape, 768px tablet, and 1440px desktop. Physical iPhone evidence remains separately recorded.

## 15. Design system and prototype variants

Shared foundation: retain recognizable verdigris identity, use warmer neutral structure and stronger ink contrast, reduce nested containers, and use typography/spacing to establish hierarchy.

Start from existing Onest and IBM Plex Mono. Use mono only where aligned dates, times, or numerical comparison benefit. Default body text 16px; secondary functional copy generally 14px. Small labels must remain exceptional.

Use semantic tokens for surface, elevated surface, ink, muted ink, border, accent, selection, completion, warning, destructive action, and focus ring. Separate brand color from task state and category color. All candidates require measured contrast before acceptance.

Prototype the same representative Today, Tasks, goal/Roadmap, and Settings content in three variants:

| Variant | Direction | Differentiation |
|---|---|---|
| A — Verdigris Workbench | Warm off-white, strong charcoal ink, verdigris accents | Most continuous with current identity; retain exact dark R20 lanes in Tasks |
| B — Quiet Agenda | Warm paper surfaces, restrained dividers, more typographic hierarchy | Greater reading calm; state accents on rows/headers rather than large colored panels |
| C — Night Instrument | Coherent dark shell, warm light text, restrained verdigris/cyan accents | Strong night-time clarity with equally legible task lanes and timeline |

Keep layout/data identical enough for a meaningful comparison. Show light, dark, selected, error, conflict, loading, and disabled states as applicable. Variant B’s lane treatment is a reviewable alternative, not authorization to replace the currently requested R20 palette.

Density is independent of theme. Provide comfortable and compact options without shrinking hit regions. Motion should explain continuity—sheet entry, task movement, recovery progress—using short transitions and an immediate reduced-motion equivalent.

## 16. Shared state matrix

| State | Required behavior |
|---|---|
| Loading | Stable authenticated shell and route-matched skeleton; no ordinary-navigation auth remount |
| Empty | Explain what belongs here and offer one useful action |
| Filtered empty | Show active filters and a reset action |
| Read error | Preserve confirmed content where available; scope retry to failed data |
| Saving | Prevent duplicate submission; retain user input |
| Saved locally | Identify device-pending state without claiming server confirmation |
| Offline, supported task change | Queue durably and show pending overlay consistently across views |
| Offline, unsupported write | Prevent false save; retain unsent draft and explain reconnect requirement |
| Conflict | Preserve both values and make explicit review reachable |
| Orphan operation | Retain by default; separate discard confirmation |
| Stale proposal | Recompute/review before applying |
| Archived | Restore remains available; history is retained |
| Long content/large data | Wrap meaningfully, paginate/virtualize where warranted, preserve focus |
| Signed out/account changed | Clear mounted private state; hide retained cache belonging to prior scope |
| Update ready | Preserve unsaved/queued work before controlled worker activation |

## 17. Data and engineering design

### Preserve unchanged

Entity IDs, workspace ownership, record versions, relationships, current lifecycle values, recurrence identity, explicit progress modes, original timestamps/history, daily-plan semantics, weekly ancestry, sync receipts/conflicts, queue idempotency, archive/restore, and service-worker cache boundaries.

Do not replace domain operations with direct client mutations merely to simplify redesigned components.

### Additive persistence required

Current source lacks explicit goal intention type and Strict Reduce/Pause records. Implement these as reviewed additive changes:

1. Optional intention metadata for existing goals: `outcome | direction`, review cadence/date, and supporting descriptive fields only where existing description cannot serve the product. Null/absent kind renders existing behavior; do not bulk infer intention types from titles.
2. A versioned commitment-resolution record retaining action, original commitment/task/occurrence reference, revised scope or return date, timestamps, timezone context, and operation idempotency.
3. Minimal review metadata for projects/directions if needed to support promised persistent review points.
4. Roadmap relationship/risk additions only after auditing existing dependency storage. Reuse existing relations where semantically valid; do not encode project dependencies as unrelated task links.

Maintain compatible existing daily-plan states. For example, Pause may project to the existing deferred state while retaining explicit pause semantics in the additive resolution record. Reduce must not be represented solely by changing a title and losing the original scope.

Resolution operations validate ownership, references, expected versions, required fields, and idempotency. Related domain changes must commit atomically. A stale version returns a reviewable conflict rather than overwriting another device.

A resolution awaiting server persistence stays pending, not fully resolved. Until a reviewed offline compound-operation extension exists, Strict actions requiring multi-entity history remain online-only. Supported task-only operations continue to work offline.

Layout, density, mobile pins, and rail state remain device-local in Phase 4. Keep preference versioning and safe fallback; do not add syncable account preferences merely for the redesign.

### Code organization

Extract shell/navigation, route state, canonical task presentation/detail, Home projections, and settings groups from the large `Home.tsx` incrementally. Keep shared selectors pure and domain actions behind existing tRPC/sync boundaries.

Lazy-load destination workspaces and substantial chart/timeline code. Keep authentication/workspace context stable across navigation. Establish a production bundle baseline and show a measured reduction in initial-load cost; do not claim success merely because code was split into files.

## 18. URL and preference compatibility

Preserve `/`, `/calendar`, existing `surface`, task filter/query, `q`, `create=task`, and PWA shortcut behavior.

Legacy destinations resolve to equivalent new contexts:

- `today` → Home/Today.
- `capture` → Capture/Inbox.
- `search` → Global Search.
- `calendar` → Plan/Calendar.
- `goals`, `projects` → corresponding Projects & Goals view.
- `insights` → Review/Insights.
- `connections` → Settings/Connections.
- `focus` → Focus mode.
- Remaining destinations → equivalent same-named context.

Back/Forward must restore context without losing query, filters, selected record, or a safe retained draft. Unknown parameters are preserved unless owned and intentionally consumed by the app.

Current mobile preferences use `personal-calander:mobile-preferences:${workspaceId}` and contain legacy destination IDs. Keep those IDs as valid shortcut aliases during migration. Do not silently discard a user’s calendar, habits, or focus pin because it is no longer a primary desktop destination.

Read prior preferences, map deterministically, de-duplicate only truly identical destinations, and preserve original stored values for rollback. Rail collapse and density remain compatible.

## 19. Delivery slices and acceptance

1. **Specification and prototypes:** capability traceability, all three visual variants, representative phone/desktop flows, recorded review.
2. **Foundation and shell:** semantic tokens, navigation grouping, compatibility adapter, stable route loading, settings sheet primitives.
3. **Today and Capture/Tasks:** canonical task presentation, explicit date semantics, inbox triage, preserved offline queue.
4. **Recovery and Plan/Calendar:** Strict resolution persistence, resumable recovery, capacity and proposal interaction.
5. **Projects/Goals/Roadmap:** Outcome/Direction, next reviews, shared views, reviewed date changes.
6. **Habits and Focus:** recovery-oriented practice views and persistent focus controls.
7. **Overview and Review/Settings:** decision modules, preserved insight/history, grouped utilities.
8. **Integrated accessibility/performance/device validation:** regression scenarios, safe areas, large data, route continuity.
9. **Notifications last:** final settings integration, opt-in/test/cadence/opt-out, physical-iPhone evidence.

Each slice records moved capabilities, data mutations, URL/preference compatibility, affected states, phone/desktop evidence, automated checks, and remaining device checks.

Release acceptance requires:

- Every ledger capability remains reachable.
- No unexplained planner-record count/identity/history changes.
- Existing progress calculations retain their definitions.
- Due, planned, reserved, committed, recurring, and actual-focus facts remain distinguishable.
- Interruption recovery produces deliberate, inspectable decisions.
- Offline supported task changes survive reload/reconnect and never disappear during refetch.
- Unsupported offline writes never report false success.
- Account switching/sign-out never exposes another account’s retained cache.
- Legacy URLs, saved views, pins, and PWA shortcuts work.
- Keyboard/touch alternatives cover critical flows.
- Phone final actions remain reachable without forced clicks or CSS overrides.
- Tests/build pass with actual evidence; synthetic checks are not described as real-device verification.

## 20. Risks and explicit non-goals

Principal risks are accidental semantic changes during visual consolidation, incomplete history for Strict actions, overloaded Roadmap scope, stale proposal application, duplicate task presentation, hidden offline limitations, preference loss, and confusing outgoing calendar subscription with incoming synchronization.

Mitigate through the capability ledger, additive schema review, shared record projections, version checks, compatibility fixtures, and representative cross-device scenarios.

Phase 4 does not include an enterprise widget builder, a mandatory goal hierarchy, automatic rescheduling, automatic progress reinterpretation, two-way Apple/Gmail synchronization, direct browser-based Apple Reminders access, a native iOS companion, private-file rollout, database reconstruction, autonomous notification escalation, or Phase 5 deep analytics.

No blocking product questions remain. The owner’s later review should select among concrete visual prototypes and assess clarity, colors, density, and flow.
