# R21 Calendar Execution Research and Delivery Decisions

## Purpose and boundary

This note translates the requested inbox-to-grid task workflow, read-only external calendar context, keyboard-first operation, and morning rollover into safe product contracts. It is intentionally specific about what must remain **task-owned**: a planner time block is a projection of a task reservation, not an independent event record. This prevents a task and a block from diverging while retaining the established rule that Personal Calendar never changes an external event.

| Requested capability | Product contract | Deliberate boundary |
|---|---|---|
| Inbox task to time block | Dropping a task creates or updates that task’s `scheduledLocalDate`, `plannedStartAt`, and `plannedEndAt`. The task remains the sole source of truth. | A block cannot exist without its task; completing the task removes its projected block rather than writing to an external calendar. |
| Move and resize | Moving or resizing changes the same reservation fields, with UTC persistence and timezone-aware validation. | A resize must preserve a positive duration, stay in the selected day, respect the current 15-minute granularity, and report local recovery on rejection. |
| Read-only real calendar | Imported busy intervals render behind planner blocks and are considered during scheduling. | They are never movable, completable, or deletable from Personal Calendar. No OAuth write scope is required. |
| Keyboard-first planning | Commands work only when planner chrome or a planner composite owns focus, never while typing, composing text, using a modifier, or inside a dialog. | Arrow-key movement belongs to a focused calendar grid, not a page-global listener. A visible shortcut reference is required. |
| Morning rollover | Yesterday’s unfinished reserved work is first presented as a reviewable rollover set. Applying it clears the reservation, increments a counter, retains the task, and writes a factual record. | It must never silently complete, archive, reschedule, or alter a recurring rule. A future scheduled trigger remains separately deferred. |

## Findings

Sunsama documents a practical manual pattern: users drag a task onto a calendar and should set an estimate first so the created timebox has a sensible duration. Its rescheduling design also leaves work that cannot fit **unscheduled**, rather than silently deleting it from the task list.[1] [2] Personal Calendar will use the same preservation rule, but it will not copy automatic external-event manipulation: only its own task reservation fields are updated.

> “The simplest way to timebox a task is to grab the task and drag and drop it onto the calendar view at a time where you want to work on it.” — Sunsama[1]

Todoist distinguishes postponing a recurring task’s next occurrence from replacing the underlying recurrence. It also makes the recurrence basis explicit because a completion-anchored rule can produce a different next occurrence from a schedule-anchored rule.[3] [4] Rollover must therefore be a reservation operation only: it changes neither a task’s recurrence definition nor its next occurrence semantics.

Google documents a calendar “Secret Address” for viewing a calendar in another application, while iCalendar is the standardized exchange format for calendar events.[5] [6] A Google secret iCal URL is consequently treated like a password: it belongs in server-side configuration, is never sent to the client, never emitted in logs, and is not stored in UI-visible planner data. RFC 5545 also distinguishes UTC, timezone-qualified (`TZID`), and floating local `DATE-TIME` values, which means the importer must preserve source-time semantics before projecting an interval into the workspace timezone.[6]

OWASP identifies server-side fetching of a user-controlled remote URL as an SSRF risk and recommends allowlisting destination, scheme, and port, disabling redirects, and avoiding raw responses to clients.[11] The eventual importer will therefore accept a configured, validated source—not a client-side fetch—and must revalidate any redirect target rather than trusting a source URL because it once passed validation.

The WAI-ARIA Authoring Practices and MDN recommend predictable focus movement, visible focus, and a roving-tabindex or `aria-activedescendant` model for composite widgets such as a grid.[7] [8] MDN further cautions against conflicting shortcuts and advises that shortcuts be discoverable to sighted and assistive-technology users.[9] Therefore, **n** and **t** will be planner commands only outside editable controls, and date/grid arrows will require an intentional grid focus state; a shortcut reference will show the active commands.

## Architecture decisions

### One reservation, one task

Existing `tasks` reservation fields are sufficient for the first delivery. The client must not create an additional “block” model. A time block’s title, category color, deadline and completion state come from its task. Dragging from the inbox calls a single reservation mutation; moving and resizing call the same validated mutation; task completion changes task state and automatically removes the block because no standalone record exists. This preserves the requested bidirectional outcome without duplicate writes.

The mutation contract must reject archived, completed, non-estimated, or already-conflicting tasks with an inline recovery message. It should preserve prior fields until validation passes and version-check every write. Existing flexible scheduling proposals remain approval-first; direct drag is an intentional manual reservation and must state that distinction in the interface.

### External ICS overlay without OAuth

The initial integration is **optional, server-side, read-only, and configuration-gated**. A secure configuration value can hold one or more HTTPS feed URLs, but the active app will show an honest unavailable state until the user supplies a real value through the secure configuration flow. The server will validate protocol, block private/link-local/loopback destinations, cap redirects and download size, use a timeout, parse only supported `VEVENT` fields, and store a bounded normalized busy-time cache with opaque source labels. It must never return the secret URL to tRPC clients.

The first internal release will prefer explicit user refresh over background polling. A later refresh cadence requires explicit approval, production deployment, an idempotent scheduled handler, and observability; it will not be introduced as an in-process timer.[10]

### Keyboard behavior

The command model uses a single guarded handler and shared underlying actions. `n` opens the existing task composer, `t` selects Today, and `Enter` creates a **reviewable** reservation in the next valid free slot for a selected task rather than silently scheduling hidden work. Arrow keys are limited to a focused day-grid composite and move a visible selection by the grid’s slot increment; focus and selection remain visually distinct. Commands are ignored for input, textarea, select, contenteditable, dialog, IME composition, and modified-key events. A visible keyboard-help control will disclose active commands.

### Morning rollover and avoided-work evidence

Rollover uses the selected workspace timezone and compares only completed calendar days. It selects unfinished tasks with a reservation ending before the current local day, clears only `plannedStartAt` and `plannedEndAt`, leaves `scheduledLocalDate` explicit rather than guessing a new date, increments a persisted `rescheduleCount`, and records a bounded audit row with the prior local date and resolution timestamp. A morning review surface will expose the count and individual tasks before the user applies it. The later optional scheduled version must reuse the exact same idempotent service.

## Source list

[1] [Sunsama, “Timeboxing: the basics”](https://help.sunsama.com/docs/getting-started/basics/timeboxing-the-basics/)

[2] [Sunsama, “Auto-rescheduling”](https://help.sunsama.com/docs/usage-guides/timeboxing/auto-rescheduling/)

[3] [Todoist, “Introduction to recurring dates”](https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV)

[4] [Todoist, “Complete a task with a recurring date”](https://www.todoist.com/help/articles/complete-a-task-with-a-recurring-date-dmI6SVqdP)

[5] [Google Calendar Help, “Sync your calendar with computer programs”](https://support.google.com/calendar/answer/37648?hl=en)

[6] [IETF, RFC 5545: Internet Calendaring and Scheduling Core Object Specification](https://datatracker.ietf.org/doc/html/rfc5545)

[7] [W3C WAI-ARIA APG, “Developing a Keyboard Interface”](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)

[8] [MDN, “Keyboard-navigable JavaScript widgets”](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Keyboard-navigable_JavaScript_widgets)

[9] [MDN, “ARIA: aria-keyshortcuts attribute”](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-keyshortcuts)

[10] Periodic Updates Reference (local project operating guidance; no public URL)

[11] [OWASP, “A10:2021 – Server-Side Request Forgery (SSRF)”](https://owasp.org/Top10/2021/A10_2021-Server-Side_Request_Forgery_%28SSRF%29/)
