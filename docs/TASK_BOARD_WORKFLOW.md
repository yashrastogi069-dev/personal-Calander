# Task Board Workflow

## Purpose

The Tasks route is a persistent work-state view rather than a decorative dashboard. Every non-archived task appears in exactly one visible lane after the active search and date-risk filter are applied.

| Board lane | Persisted task state | Meaning |
|---|---|---|
| **To do** | `not_started` | Work that still needs a clear first move. Existing `blocked` work remains here and keeps its explicit blocked label. |
| **In progress** | `in_progress` | Work currently being carried. |
| **Completed** | `completed` | Finished work retained as visible planning evidence. |

Archived tasks remain excluded from active planning. They can be restored explicitly from **Archived work** or the workspace organizer; a board move never restores them silently.

## Interaction contract

A pointer user can drag any task card from one lane to another. The target lane is visibly highlighted during drag, and the standard version-safe task update persists the mapped state. A keyboard or touch user can make the same state change through the native **Move to** control on every card. This alternate control is intentional: browser drag-and-drop is not reliable enough on touch devices to be the only path.

Each state transition provides a visible success or recovery message. Lane movement is **optimistic**: the card and lane count move immediately while the version-safe update persists in the background. A successful response merges the current server record into the workspace snapshot; a failed response removes the optimistic state and shows recovery guidance, leaving the last confirmed planner state intact. Completing or reopening through the existing check control uses the same state mapping, so Today, Calendar, analytics, goals, and the three lanes remain consistent.

## Scale and recovery contract

The board is deliberately not an unbounded history feed. To do and In progress each preview the first **24** matching tasks; Completed previews the most recent **12**. A visible **Show more** control expands only the lane the planner chooses, while an active text search reveals all matching results so a record cannot be hidden behind a default preview cap. Completed work can be archived in server-safe batches of at most 100 records per request. Archiving preserves the record instead of deleting it; an Archived work panel supports search, bounded history browsing, and explicit restore to To do.

Restoring a task clears `archivedAt` and `completedAt`, returns it to `not_started`, and increments its version. Equivalent recovery actions exist for archived Goals, Projects, and Habits in **Categories → Organize planning**. Goal and Project restoration returns unfinished work with completion/archive timestamps cleared; Habit restoration clears only its archive timestamp and retains check-in history. No permanent task, goal, project, or habit delete control is introduced by this workflow.

## Functional-control audit scope

The Tasks route now has no decorative task actions. Search and date-risk filters adjust the displayed task set. The check control completes or reopens a task. The priority flag cycles to the next persisted priority with a confirmation message. The plus action adds a real subtask, the overflow action opens the existing task editor, and every lane card can be moved through drag-and-drop or the accessible native control. Creation stays available through the top-bar **New** action and the task composer.

The broader planner’s already-verified actions continue to use their existing real data contracts: capture/create, category management, Calendar scheduling, goals and milestones, dedicated habit completion/skip/undo, weekly review, private calendar feed, device controls, and confirmation-first AI drafts. Controls that require a prerequisite use disabled state and explanatory copy rather than silently doing nothing.

## Lane color roles

The three lanes are intentionally distinct without turning individual task cards into a rainbow. **To do** uses deep leaf green, **In progress** uses deep teal green, and **Completed** uses dark forest green. The same role controls the lane marker, count, drag target, and mobile outline; task content stays on a quiet high-contrast surface. At phone width the lanes stack into separately bounded work zones, while the native **Move to** control remains available inside every card.

## Optional Companion reliability boundary

The Optional Companion is a drafting aid, not a hidden task creator. It validates a note before sending it, makes the pending state explicit, returns a reviewable proposal, and only creates work after the user selects **Confirm draft**. GPT requests use the model family’s `max_completion_tokens` field. If a provider returns unusable content, times out, or rejects the request, the service returns a plainly labeled **Safe starting draft** based on the user’s own note; the user can confirm, discard, or retry the model. This keeps the flow useful without pretending a fallback came from the model.
