# R21 Calendar Execution Acceptance Notes

## 2026-08-27 — direct-route opening state

The new `/calendar` execution route loaded through the managed development preview with a visible **Daily desk** return path, an accessible **Open Tasks** action, an explicit task-owned reservation explanation, a separate inbox, and a 15-minute execution grid. The empty-state copy accurately reported that no active task was currently unreserved; no user task, external event, calendar connection, reminder, or device state was changed during this read-only opening check.

The initial desktop rendering exposed a low-contrast outline treatment on **Open Tasks**. This was immediately corrected in the route-specific stylesheet before subsequent acceptance steps. The external busy treatment is currently an honest **External overlay not configured** status; it does not claim a connected ICS source.

## 2026-08-27 — disposable task setup

Using the existing compact creator, a clearly named **R21 QA Calendar reservation — default duration** task was created without an estimate. The Tasks board refreshed to show one active To do item, confirming a valid isolated acceptance record for the disclosed 30-minute default. No existing user task, historical item, integration, reminder, device, or external event was altered.

## 2026-08-27 — linked reservation creation

The Tasks navigation opened the dedicated `/calendar` execution route. Selecting the disposable inbox task updated each visible slot’s accessible action label, then placing it at 09:00 completed successfully: the inbox count changed from **1** to **0**, and its empty state confirmed that the active task now has a time reservation. This proves the new task-owned reservation write succeeded from the calendar surface; the next acceptance steps will verify the rendered block’s move, bounded resize, completion projection, and cleanup.

The refreshed accessibility tree exposed one projected task block at **09:00 · 30 min** and its linked controls: **Complete**, **−15**, and **+15**. The block contains no separate event identifier or independent lifecycle control, preserving the task as the single source of truth.

The **+15** control updated the same block to **09:00 · 45 min**. This is a successful bounded resize through the direct reservation contract: its source task remained active, no estimate was silently added, and no external calendar record was created or modified.

Dragging the projected block to the 10:00 grid slot persisted **10:00 · 45 min**. The movement retained the same task-bound reservation duration rather than creating a second time block, demonstrating the intended move behavior on the 15-minute execution grid.

Completing the task from the block removed the block from the active calendar projection. The refreshed grid exposed no **Complete** control and all slots returned to the unselected state. This confirms that completion changes the source task lifecycle and the block disappears as its projection; it does not create a second completion record or modify any external calendar.

The completed task then returned to the Tasks board, which exposed the normal **Archive 1 completed** safeguard with clear consequence copy. The explicitly named disposable record was confirmed through that prompt; the following cleanup checks verify its archived state and remove only this acceptance artifact.

The refreshed Tasks board showed **0 shown** across active work lanes and **4 stored** in Archived work, confirming archive behavior before cleanup. A narrowly scoped cleanup removed only task `ZQ-bqZtgT_Ys_T7n3NMsb` with the exact disposable title and its task-scoped dependency, occurrence, daily-plan-item, focus-session, and schedule-proposal rows. The follow-up query reported zero remaining rows in all six scopes. No user-created planner record or external integration data was touched.

After cleanup, a fresh Tasks load again showed **0 shown** and the archive count returned to its prior **3 stored** value. The next separately named disposable record is reserved only for literal inbox-to-grid dragging, so the click-placement and native drag paths remain independently evidenced.

Using the same compact creation path, a second disposable task named **R21 QA Calendar drag reservation** was created with a reviewed 30-minute focus estimate. It is distinct from the prior default-duration record and will be removed through the same narrowly scoped verification process after the literal inbox-drag test.

The second task appeared as the sole execution-calendar inbox item with **30 min focus**. It was dragged directly from that inbox to the 13:00 grid slot; the next snapshot verifies the persisted projected block and the same task-scoped cleanup contract.

The resulting projected task block rendered as **13:00 · 30 min**, directly proving inbox-to-grid drag persistence. Database verification found the same task in `not_started` state with `scheduledLocalDate` `2026-08-27`, `plannedStartAt` `13:00`, `plannedEndAt` `13:30`, and its reviewed `estimateMinutes` `30`. Targeted cleanup then reported zero remaining task, dependency, occurrence, daily-plan-item, focus-session, and schedule-proposal rows for this exact disposable record. A full-page 390×844 acceptance screenshot was captured after resizing the browser; it involved no further planner mutation.

## 2026-08-27 — final responsive review

Fresh managed-preview screenshots at 1280×720 and 390×844 show the execution calendar’s direct **Open Tasks** action at readable contrast, clear Daily desk return path, inbox-to-grid hierarchy, manual-reservation boundary, honest external-overlay-unavailable status, and a phone layout that stacks the inbox above the scrollable time grid. The mobile viewport retains reachable day controls and avoids clipped card text or horizontal page overflow. The deliberately dark execution canvas is limited to this concentration surface and does not change the established task lanes or Habit tracker.

## 2026-08-27 — keyboard workflow opening checks

After a managed-preview restart, the Calendar route displayed the visible Keyboard guide. A global unmodified **n** key press from the non-editable calendar surface navigated to `/?surface=tasks` without any calendar write or browser error. The next check confirms the existing task Composer opens as part of that query-backed handoff.

The Tasks destination opened the existing **Add a task** Composer and focused its Name field, so **n** remains actionable rather than a decorative shortcut. Pressing **n** again while that editable dialog field was active left the dialog open and entered the literal character `n`; it did not trigger a second navigation or an unintended planner mutation. This confirms the text-entry and dialog guard in the user-visible flow.

The calendar grid presents its full keyboard contract through visible keycaps and an accessible grid description. A separately named **R21 QA Keyboard next free reservation** task was created through the guarded New shortcut. With the task selected, direct focus on the 09:00 grid entry followed by **ArrowDown** advanced both active focus and the roving selected slot to `555` (09:15). **Enter** then created the linked **09:15 · 30 min** reservation. This proved keyboard selection and reviewable next-free-slot placement without a pointer reservation.

The database confirmed the keyboard-created reservation on the same active task at 09:15–09:45 with its 30-minute estimate. Targeted cleanup then removed only task `uR3xhddz_q7WJ-ZrJGn5r` and its task-scoped auxiliary rows. Verification returned zero remaining rows for task, dependency, occurrence, daily-plan-item, focus-session, and schedule-proposal scopes.

The calendar was then moved to the next local day with its visible control. An unmodified **t** key press returned the heading and execution grid to **Thu, Aug 27**, confirming the Today shortcut is a non-destructive navigation reset. It made no planner or external-calendar write.

During browser acceptance, the initial test harness focus landed on the grid container rather than its roving entry button. The keyboard handler was hardened so it supports both the focused slot and its grid-container path; directly focused slot verification confirmed ArrowDown moves the active and selected state from 09:00 to 09:15. The shared tests are now located in the configured server Vitest scope, where 33 test files and 122 tests pass, including shortcut guards, next-free-slot selection, 15-minute rounding, lifecycle projection, window, and conflict contracts.
