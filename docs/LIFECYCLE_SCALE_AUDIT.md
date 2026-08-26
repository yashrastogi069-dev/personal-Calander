# Lifecycle and Scale Audit

## Product decision

The planner should remain usable after **50–500** tasks, goals, projects, habits, reviews, and historical records. Completion is evidence, not deletion. Archive is a reversible cleanup step. Permanent deletion is intentionally not introduced for planner records because it would remove planning evidence, break related analytics, and create a recovery burden that the current product does not need.

| Area | Current strength | Scale or recovery gap | Safeguard selected |
|---|---|---|---|
| Tasks | Version-safe update, completed timestamp, archive state, bulk API, offline capture idempotency | A shared snapshot still transfers the workspace task set; active and completed lanes can become visually noisy | To do/In progress preview at 24, Completed preview at 12, explicit expansion/search, archive/restore, and 100-ID batches |
| Goals and projects | Version-safe archive and completion timestamps | Archived work had no user-facing restore/history workflow | Reversible restore state in the organizer; archived projects excluded from active Goals views |
| Habits | Archived timestamp and retained check-in history | Archive restoration was not user-facing | Version-safe organizer restore that retains check-ins; dedicated active-first rhythm/calendar views remain unchanged |
| Calendar and occurrences | Date-range occurrence retrieval, 3-item matrix-cell cap, unique occurrence key | Dense days require a clear overflow path rather than hidden work | Preserve task-only Calendar, expose overflow through the task route/search rather than widening every cell |
| Reviews and analytics | Date-bounded review and dashboard calculations | Old evidence must stay queryable without flooding active planning | Keep active views bounded and use time-range history rather than all-time active lists |
| Categories, saved views, devices | Safe category detachment, saved-view delete, device-specific actions | Bulk or destructive actions need scope and consequence feedback | Maximum batch sizes, confirmation copy, and no permanent planner-item deletion |

## External product evidence

Todoist keeps completed tasks available inside a project and Reporting, while restoring or deleting happens from a deliberate completed-task context rather than silently from active work. Its Reporting view treats event history as an immutable record with date and event filtering.[1] [2]

Any.do documents a staged lifecycle—complete, archive, then permanent delete—and warns that hundreds of archived items can create sync or loading problems, especially on mobile. It recommends archive/history access and export before destructive cleanup.[3]

> **Adopted rule:** Active work must be kept small and actionable, while completed and archived evidence remains recoverable through explicit history. A destructive operation may never be the default consequence of finishing work.

## Current implementation audit

The task schema already has the right fields and indexes for this hardening: lifecycle state, `completedAt`, `archivedAt`, task state index, due/schedule indexes, and a unique client request ID for duplicate-safe offline capture. The shared snapshot still loads workspace task history, so the board does not claim to reduce database transfer at 500 records. Instead, it now prevents that transfer from becoming an unbounded visible lane: To do/In progress preview 24 records and Completed previews 12, with explicit per-lane expansion and search-revealed matches. A task restore clears `archivedAt` and `completedAt`, returns `not_started`, and increments the version; Goal/Project restore clears both lifecycle timestamps, while Habit restore clears only `archivedAt`. Existing `bulkSetTaskState` accepts at most 100 IDs at the router boundary; the client splits completed-work archive requests to that limit.

## Release acceptance checks

The scale release proves by automated contracts that 50 completed tasks remain at a 12-record preview; 50 active tasks remain at a 24-record preview; explicit expansion/search exposes full matches; restore clears task archive/completion metadata and increments the version; bulk lifecycle writes are timestamp-consistent and router-bounded to 100 IDs; Goal/Project/Habit recovery is version-safe; and stale updates return a recoverable conflict. Desktop populated-board and 390×844 structural renders confirm readable archive/history treatment without horizontal overflow. Browser-native confirmation automation timed out before a destructive archive request could be confirmed, so that prompt is documented as a test-environment limitation rather than represented as a passed browser archive/restore action.

## References

[1]: https://www.todoist.com/help/articles/view-completed-tasks-in-todoist-J19h2s "Todoist: View completed tasks"
[2]: https://www.todoist.com/help/articles/view-reporting-in-todoist-oOra6D "Todoist: View Reporting"
[3]: https://support.any.do/en/articles/8635866-completing-archiving-personal-tasks "Any.do: Completing and Archiving Personal Tasks"
