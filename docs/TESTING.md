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

## Recurrence and review workflow validation

In an isolated local workspace, a disposable task was created through the real composer with a **weekly** cadence, interval `2`, due date `2026-08-24`, and stop date `2026-10-31`. After persistence and a fresh editor render, the active task-row editor restored **Weekly**, `2`, and `2026-10-31`. The task was then archived, leaving no active validation task. The dedicated Review route started a weekly session, accepted a reflection, completed it, and visibly displayed the saved review in its recent-history section. Compiler, test, and client-production-build validation all passed afterward, with 23 Vitest tests across six test files.

## Explicit habit schedule validation

The habit composer was exercised through the local planner for both non-daily paths. A disposable **Selected weekdays** habit used the default Monday–Friday cadence; its dedicated Habit Calendar showed it on Monday while the compact trace rendered Saturday and Sunday as non-actionable rest days. A disposable **Every N days** habit was created with an interval of `3` and local anchor `2026-08-18`; the trace exposed actions precisely on August 18, 21, and 24, and rendered August 19, 20, 22, and 23 as unscheduled. Both temporary records were archived through the organizer after verification, and subsequent accessibility searches found no active test residue.

The router suite additionally mocks `createHabit` and proves that both `days_of_week`/`weekdays` and `interval`/`startLocalDate`/`intervalDays` payloads reach the planner service unchanged. The current full automated suite contains **26 passing tests across six test files**; TypeScript checking and the deployable client/server bundle also pass.

## Add-control and comprehensive archive validation

The browser audit exercised each visible creation affordance individually: the top-bar **New** action; **New goal**; **Add habit**; all three context-specific **Shape it** empty-state actions; **New project**; and **New category**. Each opened the exact expected composer or organizer surface. Quick capture created a disposable task, and its row-level **Add subtask** control opened a prompt that persisted a real child task. The parent and child were then archived through confirmation-backed lifecycle controls and verified absent from a fresh accessibility search.

The archive manager no longer truncates its active-record list at twelve entries. It now exposes all active tasks, goals, projects, and habits in the workspace in alphabetical order, retaining the existing confirmation message and history-preserving archive semantics.

## Integration-boundary and keyboard verification

In an isolated local workspace, the **Create link** control generated a real private, read-only `.ics` subscription URL and presented **Copy link**, **Open .ics**, and **Revoke** controls. The verification did not represent two-way iCloud sync. The notification control first presented the browser-ready default action, then, under an isolated temporary granted browser permission, rendered **Permission ready. Delivery activates after VAPID credentials are configured.** No device subscription, VAPID request, or push message was sent.

Keyboard checks focused and operated the task composer’s **Repeat** combobox with `Enter` and `Escape`; focused the Review route’s **Begin review** button; and used `Enter` to complete then undo a daily habit directly through the selected-date Habit Calendar control. The disposable habit was archived afterward. These checks confirm keyboard reachability for the upgraded recurrence, review, and dedicated habit-calendar paths.

## Embedded plus-card repair verification

Every plus-led empty state is now a single full-card button rather than a decorative plus beside a small secondary control. The exact browser audit verified the following mappings without creating test records: **Begin with one honest commitment** opens the task composer; **Give today a destination** opens the goal composer; **Projects make goals executable** opens the project composer; **Build a rhythm, not a streak** opens the habit composer; and **Add a habit to start the calendar** opens the habit composer from the dedicated tracker. The cards expose meaningful accessible button labels, keyboard focus, hover, focus, and press states. The full automated suite remained at **26 passing tests**, the type checker passed, the Vercel-targeted build passed, and the interface detector reported no findings.

The source inventory includes one further embedded empty state: **No tasks match this view**, which was separately exercised and opened the task composer. Calendar and Review contain **zero** embedded empty-state plus cards, so no inert plus controls remain on those surfaces. The confirmed inventory is therefore: Focus → task; Tasks → task; Goal runway → goal; Projects → project; Habit rhythm → habit; Habit Calendar → habit; Calendar → none; Review → none.
