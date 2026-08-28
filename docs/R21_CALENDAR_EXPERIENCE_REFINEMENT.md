# R21 Calendar Experience Refinement

**Status:** Design and interaction audit complete; implementation is pending on `dev/personal-calendar-workbench` only.

## Design Read

> Reading this as a premium single-person execution calendar for protecting focused work, with a dark ink-and-verdigris calendar surface, high temporal clarity, and calm direct manipulation rather than a generic scheduling dashboard.

The existing `/calendar` already has the core task-owned reservation model: selected or dragged inbox tasks can be placed on a 15-minute grid; a block can move, resize, and complete; and external calendar context stays read-only. The calendar presently reads as a strong “execution cockpit,” but its time surface is visually too quiet when empty and its calendar-specific control set lacks two familiar, high-value affordances: an at-a-glance nearby-day rail and a direct, non-destructive way to remove only a time reservation.

| Evidence | Applied product decision |
|---|---|
| Google Calendar supports selecting an empty time, then editing duration through the event edges. [1] | Preserve literal placement and 15-minute resize behavior; improve the calendar visual language around the grid rather than replacing the safe task reservation model. |
| Outlook presents edit and cancel as direct event actions for events the person owns. [2] | Add **Remove time** for task-owned blocks only. It clears the reservation but retains the underlying task and its planned day, which is clearer and less destructive than deleting work. |
| Fantastical supports moving events by dragging and resizing timed items at their edges. [3] | Keep the existing drag-move and 15-minute resize contract, and make the selected task/block state more visually legible. |
| The current rendered calendar has clear purpose but its large empty time canvas risks feeling underpowered. | Add an explicit seven-day rail and a purposeful empty-day cue. The grid stays the dominant object and does not become a second task list. |

## Selected Improvement Contract

The implementation will add three tightly connected improvements. First, a nearby-day rail will make date navigation recognizably calendaring-first: it shows seven local dates centred on the selected day, gives the current day a clear textual state, and is fully keyboard-operable. Second, the calendar-specific palette will move from lime-only highlighting to an ink-and-verdigris time surface with stronger hour structure, while preserving category colors on task blocks and blue read-only external busy context. Third, every task block will gain **Remove time**, which clears only `plannedStartAt` and `plannedEndAt` through the existing version-safe task update contract. The task remains active, retains `Plan for`, estimate, recurrence, links, and schedule mode, and returns to the unreserved inbox.

No separate event, block, or duplicate calendar table will be created. There will be no browser-side ICS source, external write, OAuth, scheduled automation, reminder change, or habit timeblock. The dedicated Habit tracker continues to represent repeated behavior separately from the task execution calendar.

## Acceptance Plan

| Area | Evidence required |
|---|---|
| Direct manipulation | A clearly named disposable task is created, placed, resized or moved, then **Remove time** clears only the block and returns the task to the unreserved inbox. |
| Data integrity | The disposable task’s task record remains present and retains its chosen planned date; no unrelated records are modified. |
| Time navigation | The nearby-day rail updates the displayed local day without changing any reservation. |
| Responsive accessibility | Desktop and 390×844 phone inspection show reachable day choices, readable grid labels, visible focus, and non-overlapping task actions. |
| Regression | Focused lifecycle coverage, full Vitest suite, TypeScript, client build, browser console, targeted cleanup, and remote branch verification all pass. |

## Browser Acceptance Evidence

The initial calendar audit was performed at desktop width, followed by direct interaction at 1280px and 390×844px. The updated execution surface exposed a seven-date rail with semantic current-day and selected-day labels, a single **Add task** action, the task inbox, and the 15-minute day grid. Selecting Saturday moved the day header and the `aria-current="date"` day without changing a planner record.

The first calendar **Add task** implementation revealed a deep-link timing defect: React Strict Mode could clear `create=task` before the task dialog became visible. The existing Home task composer now initializes the creation intent from the URL and clears it only after a deliberate close. A fresh `/?surface=tasks&create=task` navigation showed the existing **Add a task** dialog, and the calendar action then invoked that same real composer. There is no secondary or duplicate calendar task form.

A clearly named disposable task, **QA Calendar Remove Time 20260828**, was created through that real composer. The test selected the inbox task and placed it at 09:00, confirming its 30-minute default task-owned block and the visible **Remove time** action. Activating **Remove time** removed the projection and returned the active task to the inbox. A targeted database query then confirmed the task still had its `scheduledLocalDate` of `2026-08-28`, retained its active state and manual scheduling mode, and had null `plannedStartAt` / `plannedEndAt`; no task deletion or calendar-event record was involved. The named disposable task was then deleted by verified ID and workspace ID, with a final query returning **zero remaining rows**. The browser console recorded **zero errors and zero warnings** through the controlled session.

At 390×844px, the day navigation and Add task action remained full-width/reachable, the date rail remained touch-sized and horizontally resilient, and the task execution grid remained below the discrete inbox rather than interleaving habit check-ins. The desktop layout retained the focused two-column inbox-and-grid relationship with the date rail as a calendar-specific visual signature.

## Final Validation

The focused task lifecycle contract passed with seven tests, including the new clear-reservation case. The complete test suite then passed with **37 files and 135 tests**. `pnpm check` and `pnpm build:client` both passed. The calendar remains lazy-loaded as `CalendarExecution-CoZJNozU.js` at **42.59 kB / 7.55 kB gzip**; the existing legacy Home shell at **1,410.69 kB / 369.82 kB gzip** remains separately tracked as the primary initial-bundle opportunity. No schema or migration was needed because the action uses the existing version-safe task patch contract.

## References

[1]: https://support.google.com/calendar/answer/72143?hl=en&co=GENIE.Platform%3DAndroid "Google Calendar Help — Create an event"
[2]: https://support.microsoft.com/en-us/outlook/calendar/change-an-appointment-meeting-or-event-in-outlook "Microsoft Support — Change an appointment, meeting, or event in Outlook"
[3]: https://flexibits.com/fantastical/help/editing-events-and-tasks "Fantastical Help — Editing Events and Tasks"
