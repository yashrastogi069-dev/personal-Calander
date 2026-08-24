# Testing Strategy

## Business rules

Unit tests will cover lifecycle transitions, dependency cycle rejection, horizon validation, optimistic update rollback, conflict detection, recurrence generation, skipped/missed/completed outcomes, habit streak math, timezone date conversion, calendar rescheduling, and dashboard aggregates.

## Interface verification

The UI will be verified in desktop and mobile viewports. Critical paths include rapid capture, full task editing, completion, bulk update, saved-view recall, recurrence modifications, habit check-ins, calendar drag-and-drop, review generation, reminder opt-out, AI draft confirmation, and conflict recovery.

## Acceptance standard

No completion path may silently drop a task, mutate historical recurrence data, cross a workspace boundary, or change a local planning date because of a timezone conversion. New core features require tests before delivery and must display loading, empty, success, and error behavior where applicable.

## Current verification evidence

The automated suite verifies task-backed goal progress, progress clamping, inclusive local-date sequences including a month boundary, skipped and missed habit behavior, and over-capacity workload detection. Browser checks verified anonymous workspace bootstrap, real quick capture, immediate dashboard refresh, task completion/reopening, and confirmation-based goal creation. The next integration phase will add connector-specific tests before external calendars or phone notification channels are enabled.

## Public deployment contract checks

After the Vercel recovery, isolated anonymous workspaces were used against the public alias to validate persistence without altering the user’s live planner data. A temporary saved view was created, version-safely overwritten, retrieved from a fresh snapshot with its changed configuration, and deleted. A temporary daily habit was created, completed for a local date, observed in a fresh snapshot, then cleared; the cleared snapshot no longer contained the completed check-in. These calls exercised the same deployed tRPC procedures that support saved-view recall and calendar-habit check-in/undo. The connected personal browser then became temporarily unavailable after a timeout, so no further live-browser mutations were attempted.

An independent browser also completed the strict visible saved-view case after that timeout: it saved a view as **Today / Priority**, overwrote the same name as **All active history / Newest**, reloaded the public app, recalled the saved view, and read the rendered select values as `all` and `created`. The temporary saved view was deleted after validation.
