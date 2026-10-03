# Product specification

This is the short product contract for the current workbench. The [Phase 4 specification](superpowers/specs/2026-09-14-phase4-total-product-redesign.md) defines detailed behavior, and the [capability ledger](PHASE4_CAPABILITY_LEDGER.md) protects existing features.

## Promise and users

Help a person remember what matters, make a realistic plan, act today, recover after interruptions, and connect daily action with longer term intentions. The workspace serves mixed personal and professional life: meetings, messages, reading, meals, shopping, habits, and projects. Power features remain available without crowding the everyday path.

The acceptance scenario is a disrupted day. A meeting overruns, planned work slips, a habit is due, and a goal still needs attention. The app must show what happened, what remains, what fits, and the next deliberate action. It must preserve the unresolved work and its history.

## Core product rules

1. A task keeps one identity across Today, Tasks, Calendar, Overview, Roadmap, and linked records.
2. `Due by`, `Plan for`, a timed reservation, a daily commitment, recurrence, and actual focus are distinct facts.
3. Capture is quick and does not require a deadline or project. Scheduling and recovery are explicit decisions.
4. Habits represent practices and dated evidence. A gap invites a return plan; an empty day is not automatically a failure.
5. Long term Outcomes can have targets and success criteria. Directions represent continuing standards. Legacy goals retain their existing meaning until a person explicitly changes them.
6. Summaries reveal their period and source records. They never invent a score or pretend that missing estimates are zero effort.
7. Preferences may simplify a screen, but the user can still reach every existing capability.
8. Offline work, conflicts, unsupported actions, and integration readiness must be stated before the user assumes a save or delivery happened.

## Information architecture

| Destination | Purpose |
| --- | --- |
| Home | Today execution; separate Overview orientation and bounded customizable modules |
| Tasks | Inbox, List, Board, saved views, search and detail |
| Plan | Daily/weekly planning, Calendar, portfolio Roadmap |
| Projects & Goals | Projects, Outcome goals, Directions and details |
| Habits | Due practices, history and returning after a gap |
| Review | Rituals, Insights and History |

Global actions are Capture, Search, and Focus. Settings contains account, appearance, layout, synchronization, connections, categories, archive/recycle, and sign out. Phone navigation stays customizable; desktop navigation remains collapsible and independently fixed while the content scrolls.

## Roadmap and project timeline contract

The portfolio Roadmap answers: which projects overlap, what goal checkpoint comes next, what is blocked, and which long-term intention lacks an executable next action? It is a month/quarter/year comparison of existing projects and goal milestones, not a second task database or a requirement to schedule every task. A selected project keeps its Overview, List, Board, and Timeline over the same IDs. The owner approved an optional dated-task layer inside that selected-project Timeline; the portfolio remains project-level by default. Task planned days and deadlines must be labeled as different markers, never inferred as a continuous work-duration bar.

A person can use the view to turn a quarterly outcome into a project checkpoint and then into work for this week. Undated and archived records remain visible and honest. Date editing previews exactly which project dates change, names dependency/milestone consequences, and explicitly states that linked goal, task, and milestone dates do not move. A hard dependency conflict must block Apply in both UI and backend. Local edits may refresh immediately through query invalidation, but periodic cross-device refresh is not instant real-time collaboration; that claim requires an authenticated push/invalidation path plus reconnection and conflict evidence.

## Habit practice contract

Home answers which scheduled habits need attention today and shows remaining flexible weekly progress without making a weekly target look due every day. Habits owns the full visual tick trace, calendar, history, settings, notes, archive, and return decisions. Complete, Skip, and an explicitly recorded Miss are different facts; an empty past date stays unrecorded. A gap offers Resume, Revise, or Pause to a review date without manufacturing a backlog or changing past check-ins. The calendar can retrieve older archived history by bounded month windows. Corrections and clears require the observed check-in ID/version so a stale tab cannot silently overwrite another edit. Saved reminder time is not notification delivery. Existing IDs, dated records, and linked goals/categories survive a presentation or schedule change.

## Focus contract

An active or paused Focus session follows the user across planner destinations and refresh. Home gives it a prominent full-width watch; other destinations keep a compact companion; the full Focus view offers Dial/Digital and a larger Desk View. These are presentations of one confirmed session, not extra timers or new saved durations. The displayed active time may advance locally from the backend-confirmed resume timestamp, but offline time is marked estimated and cannot be written until reconnected. Paused time does not accrue. Start links only to an eligible task or explicitly stays unlinked; an unavailable task never silently redirects focus to another task. Stop confirms first, then retains the existing Done/Continue/Adjust estimate/Stopped outcomes and notes. A Focus session does not complete its task unless Done is chosen, and a calendar reservation is not actual focus.

The Focus follow-up layer adds a post-finish next-step handoff, a source-labelled three-hour Meeting Horizon, a factual Habit Companion, a bounded Session Trail, and a read-only Routine Conductor. The conductor suggests one next action but never mutates order or starts work automatically. Habit check-ins are not duration records. The local workbench now contains an additive, unapplied model for explicit habit time and a separately saved next action; routine customization/history still needs a later model. The existing Focus flow must remain usable before the optional migration is installed. See [Focus orchestration](FOCUS_ORCHESTRATION_SPEC.md).

Incoming Apple Calendar events are not connected. The owner chose to wait for a supported, secure account-authorization route rather than provide a public calendar link or app-specific password. Meeting Horizon can only use events already saved in the planner; an empty horizon does not prove the Apple Calendar is free.

## Scope and release gates

Phase 4 includes product flow and visual redesign across the whole app, preserving existing behavior. Variant A colors are selected; task lanes keep their exact R20 dark colors. Task 20 adds Overview with configurable order, visibility, and bounded size. Phase 5 is reserved for deeper longitudinal analytics. Phone notification/reminder work remains last in the Phase 4 sequence.

Completion requires capability reconciliation, unit/integration checks, responsive and accessibility evidence, and a deployment check for the workbench branch. Local synthetic browser results do not prove physical iPhone or live notification delivery. The current status and blockers are in [project state](PROJECT_STATE.md).
