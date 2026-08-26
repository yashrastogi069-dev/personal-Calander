# Task Board Workflow

## Purpose

The Tasks route is a persistent work-state view rather than a decorative dashboard. Every non-archived task appears in exactly one visible lane after the active search and date-risk filter are applied.

| Board lane | Persisted task state | Meaning |
|---|---|---|
| **To do** | `not_started` | Work that still needs a clear first move. Existing `blocked` work remains here and keeps its explicit blocked label. |
| **In progress** | `in_progress` | Work currently being carried. |
| **Completed** | `completed` | Finished work retained as visible planning evidence. |

Archived tasks remain excluded from active planning and are not restored by board movement.

## Interaction contract

A pointer user can drag any task card from one lane to another. The target lane is visibly highlighted during drag, and the standard version-safe task update persists the mapped state. A keyboard or touch user can make the same state change through the native **Move to** control on every card. This alternate control is intentional: browser drag-and-drop is not reliable enough on touch devices to be the only path.

Each state transition provides a visible success or recovery message. A failed update does not optimistically hide the task; the board refetches through the existing workspace snapshot after a successful mutation. Completing or reopening through the existing check control uses the same state mapping, so Today, Calendar, analytics, goals, and the three lanes remain consistent.

## Functional-control audit scope

The Tasks route now has no decorative task actions. Search and date-risk filters adjust the displayed task set. The check control completes or reopens a task. The priority flag cycles to the next persisted priority with a confirmation message. The plus action adds a real subtask, the overflow action opens the existing task editor, and every lane card can be moved through drag-and-drop or the accessible native control. Creation stays available through the top-bar **New** action and the task composer.

The broader planner’s already-verified actions continue to use their existing real data contracts: capture/create, category management, Calendar scheduling, goals and milestones, dedicated habit completion/skip/undo, weekly review, private calendar feed, device controls, and confirmation-first AI drafts. Controls that require a prerequisite use disabled state and explanatory copy rather than silently doing nothing.
