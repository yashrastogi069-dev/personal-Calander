# Experience reconstruction proposal

Date: 2026-10-03. Status: owner approved reconstruction and the blue/porcelain preview; foundation implementation in progress, not complete. Companion: [research audit](../../research/2026-10-03-experience-reconstruction-audit.md) and [approved current contract](../specs/2026-10-03-blue-workspace-reconstruction.md). The later contract supersedes earlier A-green palette requirements.

## Non-negotiable boundaries

- Workbench branch only; main stays frozen. Local UI work does not authorize push, deployment, live database writes or migrations.
- Preserve every capability in [the ledger](../../PHASE4_CAPABILITY_LEDGER.md), record/workspace IDs, history, saved views, preference versions, navigation aliases and PWA entry paths.
- Use the approved blue/porcelain world with richer labelled semantic/project colors and a slate-dark equivalent; keep exact R20 dark Board lanes, comfortable/compact choice and user customization. Never shrink essential text or phone hit regions to achieve compact density.
- Preserve Habit tick trace, month calendar, selected-day facts, corrections, archived history, return decisions and distinct Complete/Skip/Miss/Unrecorded states.
- Preserve the larger Home watch option, one backend Focus session, explicit duration evidence and saved next-step handoffs. No inferred habit time.
- Due dates, planned days, commitments, reservations, occurrences and actual duration remain distinct. A task is not deleted or silently rescheduled because it is inconvenient.
- Reuse canonical projection/mutation paths. Presentation consolidation must precede deletion of duplicate presentation and prove action parity first.

## Slice R1: baseline and prototype

Owner approved the illustrated direction on 2026-10-03 and requested the working build. R1 now implements the shared light/dark theme and compact shell, Today work-first composition and contextual selected-project composition in disjoint agent scopes. Existing capture/habit/Focus behavior is retained. Verify these together before expanding the pattern; do not claim a prototype or screenshot as proof of all features working.

Use identical synthetic mixed-life fixtures at phone/desktop widths, both themes, with sparse/busy/long-title/active-session states. Create a side-by-side local prototype of Today, selected-project workspace and task inspector. Review the actual loaded typography, not stubbed-font captures. Keep source tools out of primary work surfaces.

Acceptance: one clear destination header; at least one complete actionable work row above phone navigation in the mixed-life fixture; useful work visible without explanatory hero; selected project owns the canvas; every prototype action mapped to existing or explicitly deferred capability. Include the larger-Home-watch variant without losing work orientation. Owner reviews ordering, density, color balance and watch prominence before extending the pattern.

## Slice R2: shell, navigation and canonical inspector

Make parent/child active states unambiguous and establish distinct routes for Today/Overview, daily/weekly planning and ritual/Insights/history. R2 owns route/IA scaffolding; R3 owns execution/planning content and R5 owns completed Overview/Review/Settings content. Do not claim empty scaffolds as completed destinations. Preserve back/forward, reload and legacy URLs. Prototype Inbox/Today capture choice without silently changing existing Today quick-capture or PWA entry defaults; any changed default requires explicit parity tests and owner review. Establish grouped Settings navigation; final group contents follow in R5.

Inspector: title/state/next action/relevant time/link context first; scheduling, recurrence, dependencies and history expanded when needed. Existing consequential values remain visible. Maintain drafts, focus restoration, version guards, conflict explanation and keyboard-safe Save/Close.

Acceptance: runtime tests for aliases, reload/Back, selected-record context, preference migration and customized pins; phone More menu works without locking scrolling; desktop rail stays independent of canvas scrolling. Keyboard and reduced-motion equivalents exist for every gesture.

Capture parity includes title-only capture, Today/Inbox choice, editable natural-language interpretation, templates, AI proposal review, idempotent retries, current Today quick-capture and PWA `create=task` entry behavior. Preserve existing intent/context until a changed default is reviewed.

## Slice R3: Today, Tasks and connected planning

Today prioritizes next action/active session, next timed commitment, due/flexible habits, agenda and flexible work. Collapse capacity to a factual expandable summary with unknown estimates. Recovery is resumable, explicit and non-blocking. Retain full-width larger watch as a preference, compact companion elsewhere.

Planning preserves date, stage, selected tasks and return context through Calendar/inspector handoffs. Integrate saved-view and bulk controls into Tasks instead of a detached legacy panel. Lists, Board and Calendar reference the same IDs and actions.

Acceptance scenario: a meeting overruns while a reply, document, dinner preparation and long-term project action remain; preview revised work without changing deadlines or losing commitments. No automatic archive/delete or fabricated time. Offline task capture and conflicts still use existing queue semantics.

## Slice R4: Projects, Goals, Habits and Focus continuity

Selected project uses a compact switcher and contextual Overview/List/Board/Timeline; optionally reuse filtered Calendar. Same task inspector from each lens. Portfolio Roadmap remains project/milestone-level; optional task layer stays within selected-project Timeline. No bars invented from plan-date-to-deadline spans.

Move unique legacy goal/project actions into canonical detail only after feature parity. Directions and Outcomes can link standalone tasks/projects/habits without mandatory hierarchy. Keep factual progress basis visible.

Habits: clear Practice/History/Settings, visible due/flexible summary on Home, liked trace/calendar intact, selected-day correction context and a supportive strict return flow. Focus handoffs retain origin context; supporting orchestration expands without becoming a second dashboard.

Acceptance: Outcome -> project -> milestone/task -> reservation -> Focus result is navigable with the same IDs. After ten days away, Resume/Revise/Pause does not invent missed records. Concurrent follow-up saves and refreshed untouched drafts retain T19 race regression coverage. Preserve explicit time attribution and migration capability gates.

R3/R4 must reconcile action-level ledger parity before moving each surface, not defer it to R6: standalone/direct goal-task links, nested legacy goals, manual/measure/habit progress, recurrence and rollover, scheduling proposal approve/dismiss/undo, archive/restore and all correction/history actions. Record each old action's new location and test before retiring its old presentation.

## Slice R5: Overview, Review and Settings

Overview is a sibling Home view, not an extra primary page: curated attention, upcoming milestones, project risk, habit consistency, capacity and review modules. Each module has a period, evidence source, drill-through action and honest insufficient-data state. Allow bounded reorder/hide/size preferences; no mandatory dashboard construction or universal productivity score.

Review separates ritual from history and Insights, connecting conclusions to next actions. Settings groups Account, Appearance/Layout, Planning, Data/Sync, Connections and Device. Incoming Apple events remain explicitly unavailable; outbound ICS and browser push are not described as full Apple integration.

Acceptance: customization persists/reloads and can reset without touching planner data; historical evidence is reachable; conflicts and sign-out remain discoverable; settings do not require traversing the Home feed. Deep analytics belongs to Phase 5.

Review parity explicitly includes daily, weekly, monthly, quarterly and yearly sessions, snapshots/reflection, and Insights allocation/carryover/health surfaces. Each retained period and evidence source needs a working drill-through test, not merely a History tab.

## Slice R6: whole-product verification and release gate

Reconcile every ledger action to the implemented destination before retiring duplicate UI. Run focused tests, full suite, TypeScript, production build, responsive runtime scenarios and measured accessibility checks. Verify loaded fonts, contrast, keyboard navigation, focus, touch regions, zoom, long labels, loading/error/empty states, scrolling and overlay behavior. Test pointer and keyboard alternatives to gestures. Owner deferred hosting changes and dedicated performance optimization; ordinary responsive interactions remain required and performance debt stays recorded rather than declared fixed.

Offline testing must respect the actual task-first scope: prove reload/reconnection/conflict behavior and mark other entity writes unavailable rather than implying full offline support. Physical iPhone/PWA keyboard, VoiceOver, offline/relaunch and notification delivery remain separate evidence supplied by actual device checks.

Release requires strict-TLS read-only exact-target inventory, restore-tested backup, separately approved migrations 0004-0006, compatible rollout, authenticated branch Preview and remaining device gates. Never disable TLS validation or infer rollout success from local tests. Notifications/reminders remain the final feature area.

Each live approval packet must specify exact target and migration hash, before-record IDs/counts, restore-tested backup, per-migration reader/writer compatibility and rollback routing. The handoff forbids reverting to a pre-0005 application after carry identities are written. These are live release prerequisites, never work implicitly authorized by local UI slices.

## Completion report required per slice

Report tests executed/results, build result, relevant runtime verification, files changed and remaining risks. Mark inapplicable/not-run evidence explicitly. A code review, detector score or screenshot is not a complete functional test. No claims of market superiority without user/testing evidence.

## Calendar and reminder work after connected UI

Apple and Google Calendar plus notifications/reminders are part of the approved goal, but provider credentials/consent and live rollout need separate completion evidence. Inventory existing feed/device/reminder capabilities, then implement a provider-neutral connection/event experience and supported Google OAuth path with tests. Verify Apple-supported authorization before promising incoming events; earlier no-public-share/no-app-specific-password constraints remain. Preserve existing outbound feed and task sync throughout. Real iPhone delivery and owner provider configuration cannot be replaced by synthetic tests.
