# Workflow Rules

## Lifecycle states

Tasks, projects, and goals support `not_started`, `in_progress`, `blocked`, `completed`, and `archived`. A completed record may be reopened; reopening a recurring task never edits an already completed historical occurrence. Archive is reversible and removes a record from ordinary views without deleting history.

## Dates and scheduling

The workspace timezone is the source of truth for date-only plans, recurring schedules, daily check-ins, habits, and review periods. UTC is used for stored moments such as creation, completion, and edit timestamps. Moving a scheduled task changes only the intended schedule; it does not change a due date unless the user selects that action explicitly.

## Recurrence and habits

Recurring tasks generate independent occurrences. An occurrence can be completed, skipped, rescheduled, or missed. A skipped occurrence is intentional and does not count as completed; a missed occurrence becomes overdue only after its due boundary passes. Recurrence edits apply forward from the chosen boundary and preserve history. Habit streaks count only eligible, successfully completed check-ins; a planned rest day is excluded from the streak denominator.

## Dependencies and blocking

Completion is prevented only for dependencies explicitly marked as hard blockers. Soft dependencies create a warning but still permit completion. A dependency cycle is rejected at validation time. If a prerequisite is reopened, dependent records are marked at risk rather than silently reset.

## Reminder policy

Every reminder is opt-in, pauseable, and removable. Snooze creates a new explicit next-reminder time without changing the underlying task due date. Reminder scheduling is activated only after the live application is deployed and the person enables it. Any repeated delivery must be idempotent.

## Conflict and recovery policy

The interface updates lightweight actions optimistically. If the server rejects a mutation, the cached item is restored and the person receives a concise explanation. If another version of an item exists, the interface presents the current value and asks the person to refresh or reapply the edit; it never overwrites a newer version silently. A failed integration or unavailable AI assistant cannot block task capture, task completion, calendar use, habit tracking, or review.
