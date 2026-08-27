# R21 Branch Execution Audit — Execution-Grade Personal Planning

**Branch:** `dev/personal-calendar-workbench`  
**Scope source:** user-supplied competitor/product roadmap and New Capability brief, read in full on 27 August 2026.  
**Operating promise:** *Plan a realistic day, protect time for what matters, maintain habits, and adjust deliberately when life changes.*

> **Design read:** This is an operating interface for a solo planner during a busy day, with a calm, high-information, verdigris-led workspace language, deliberate progressive disclosure, and restrained motion that communicates state rather than decoration.

## Delivery Rules

The implementation stays on this branch. `main` remains untouched unless the user explicitly authorizes a later merge. No new feature may create tasks, reservations, check-ins, calendar events, reminder rules, or external connections merely by being opened. Every modification requires a direct user action, optimistic concurrency where a persisted record changes, visible local failure recovery, and browser verification.

The current production is structurally capable but does not yet make all competitor-grade workflows real. This branch will raise the connected daily-planning subset first and build the required data contracts for the remaining capability groups. Google Calendar live synchronization cannot be activated until the user supplies a Google OAuth client configuration and agrees to the consent/connection policy; the branch can build the concrete readiness, status, and recovery experience without impersonating a connection.

## Requirement Map

| Supplied requirement | Current basis | Branch implementation contract | Acceptance evidence |
|---|---|---|---|
| Guided daily planning | Today capture, triage, capacity, calendar | Persist an ordered set of daily commitments with a plan state, explicit capacity fit, and reopenable daily plan | Open → add/remove/reorder commitments → save → refresh retains plan |
| Realistic workload | 360-minute capacity and deadline forecast | Store work window, breaks, shutdown, and day exceptions; calculate available/free minutes and explain overload | Settings persist; forecast distinguishes task load, busy time, breaks, capacity, and unestimated work |
| Calendar timeboxing | Task planned date/start/end and day timeline | Add an all-day/unscheduled task shelf, duration-aware slot proposals, safe resize and in-calendar completion | Drag, resize, complete, and undo/retry flows remain consistent after reload |
| Daily shutdown | Daily check-in and task lifecycle | Persist resolve decisions (`done`, `reschedule`, `defer`, `wont_do`, `archive`) and reflection without silent carryover | A close-day session records every unfinished selected task’s explicit outcome |
| Weekly objectives | Goals/milestones/reviews | Persist weekly objectives linked to goals/projects, contribution evidence, carry-forward, and review outcome | Create/edit/complete/carry-forward and review visible after reload |
| At-risk repair | Deadline risk and workload signal | Explain risk constraints and provide explicit corrective choices: schedule, defer, reduce commitment, or keep manual | No predictive probability claim; each choice shows the exact effect before save |
| Focus support and analytics | Estimates only | Add task-linked focus sessions, start/pause/end, outcome, note, actual minutes, and estimate accuracy | Session records are attributed to task, excluded from future/fabricated stats, and can adjust estimate deliberately |
| Dependency/project execution | Cycle-safe dependency table and project/task links | Add list/remove dependency controls, blocker state, next executable action, project workload/risk, and milestone context | Invalid/self/cyclic edges fail locally; blockers and next action update after refresh |
| Natural-language capture | Confirmation-first AI draft | Add deterministic editable parser for date, time, duration, priority, and recurrence hints | Parsed fields are shown before creation; ambiguous text stays as a title rather than guessed facts |
| Templates and personalized views | Saved-view and reviewed breakdown primitives | Add review-first task/project templates and reusable cross-surface views | Applying template creates nothing until explicit confirmation; relative dates are previewed |
| Habits — New Capability | Schedule truth, check-ins, 28-day tracker | Add factual monthly board, historical corrections, year-scale map, best/current run, eligible/completed totals, and discipline overview | Future/pre-start/non-scheduled dates excluded; historical recorded results remain correctable after schedule edits |
| Recurrence and reminders | Occurrence rows, daily/weekly push rules | Expose occurrence exceptions/anchors and item-level reminder readiness/status while preserving active approved cadence | Existing reminder device/cadence remains unchanged; unsupported schedule states are explicit |
| Calendar integration | Read-only ICS plus connection/event tables | Build source-of-truth policy, connection status/error/recovery, event overlay, and OAuth readiness; defer live Google connection to credentials | A disconnected state is clear; no calendar write occurs; imported events use busy/free-only semantics |
| Scheduling assistance | Capacity/risk data | Build a deterministic free-slot proposal engine with pinned/flexible controls, approval, audit history, and undo | Suggestions never silently move work; every proposal names duration, time window, deadline, and reason |
| Cross-device continuity | Database, PWA, browser workspace identifier | Add account-migration/recovery design, conflict status, and offline edit boundary documentation; connect only after account policy validation | No false cross-device claim; identified recovery path and visible conflict handling |

## Implementation Order

The branch is divided into coherent vertical slices rather than unrelated feature buttons. Each slice must be usable by itself and tested before the next expands it.

| Slice | Capability set | Primary surfaces | Persisted additions |
|---|---|---|---|
| A | Planning settings, daily plan, shutdown, weekly objectives, factual habit analytics | **Plan** workspace, **Habits** workspace, Settings | Workspace planning preferences, daily plans/items/decisions, weekly objectives, focus/analytics foundations |
| B | Focus loop, dependency editor, project execution, parser/templates/views | Task editor, Project execution, Focus overlay, Capture | Focus sessions, template records, dependency management operations |
| C | Calendar execution, workload corrections, proposal scheduling | Calendar, Today, Plan | Day availability/exceptions, schedule proposals/audit, flexible/pinned task state |
| D | Integration and reminder readiness | Integrations page, Settings | Encrypted provider credentials only after user supplies them; connection state and event data use existing seams |

## Non-Negotiable Semantics

| Concept | Product meaning |
|---|---|
| **Deadline** | The latest date a task or outcome should be complete; it is not a calendar reservation. |
| **Plan for** | The day work is intended; it does not imply a free calendar slot. |
| **Reserve time** | A bounded task time block in the task calendar. |
| **Flexible task** | Eligible for a proposal only; it is never automatically moved in early stages. |
| **Pinned task** | Kept manual; scheduling assistance must not move it. |
| **Busy event** | External availability context; imported data is read-only and never changes an external calendar. |
| **Won’t do** | A deliberate non-completion decision recorded at shutdown; it is separate from archive and completion. |
| **Habit eligibility** | A date permitted by its cadence. Non-scheduled, future, and pre-start days are never inferred as misses. |

## Branch Acceptance Gate

Before any branch release claim, the work must have schema migration evidence where data changes, focused deterministic tests, error/rollback coverage, 390×844 and desktop visual checks, keyboard/touch checks for new controls, a clean development-branch push, and a branch preview check. The checkpoint/public-production deployment must not be treated as a merge to `main`.
