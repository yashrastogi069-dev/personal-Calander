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
