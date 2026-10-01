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

## Scope and release gates

Phase 4 includes product flow and visual redesign across the whole app, preserving existing behavior. Variant A colors are selected; task lanes keep their exact R20 dark colors. Task 20 adds Overview with configurable order, visibility, and bounded size. Phase 5 is reserved for deeper longitudinal analytics. Phone notification/reminder work remains last in the Phase 4 sequence.

Completion requires capability reconciliation, unit/integration checks, responsive and accessibility evidence, and a deployment check for the workbench branch. Local synthetic browser results do not prove physical iPhone or live notification delivery. The current status and blockers are in [project state](PROJECT_STATE.md).
