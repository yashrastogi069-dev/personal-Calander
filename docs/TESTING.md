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

## Long-horizon, milestone, and device-reminder expansion

The pure planner-rule suite now verifies recursive goal hierarchy rollups, milestone-derived progress, explicit progress-source labeling, valid date-span pace calculations, behind-pace review prioritization, no-execution signaling, and cycle-safe handling of corrupted parent relationships. It does not fabricate goal links: hierarchy exists only where an explicit `parentGoalId` is persisted.

The router suite verifies that a dated monthly milestone, its optional user-authored if–then cue/response, device subscription upsert, device opt-out, and a safe HTTPS/localhost-only test origin all pass through the public tRPC contracts with the expected workspace scope. The isolated push service suite mocks both the provider and persistence adapter. It proves that a manual test uses a compact visible payload, records success, and turns a provider `410` response into an expired-device outcome rather than an uncontrolled retry. No real provider call was made by automated tests. Separately, the user reported that the installed iPhone received a visible manual test notification after the Vercel VAPID configuration was corrected.

At 1280 × 720 and 375 × 812, the local planner rendered its upgraded Goal runway entry and device-reminder entry point without introducing workspace records or layout overflow. An interaction-level check through the connected personal browser could not proceed because the browser extension timed out; this is recorded as an infrastructure limitation rather than passed UI evidence. A real installed-iPhone opt-in, visible manual test notification, opt-out, and later re-enable remain required before claiming APNs delivery verification.

The full local suite now passes with **38 tests across 8 files**. `pnpm check` passes, and `pnpm build:client` produces both the Vite application bundle and the Vercel-targeted server artifact. The client bundle reports an existing large-chunk warning; it is non-fatal and should be addressed as a later performance-focused code-splitting task rather than hidden as a validation success.

## Pacific/Auckland scheduled reminder validation

The approved schedule is represented as two local rules: daily planning at `11:00` and weekly review at `Sunday 17:00`, both in `Pacific/Auckland`. The pure schedule evaluator was tested against both New Zealand daylight-saving and standard-time UTC offsets, proving the same requested local daily hour is matched while its UTC hour changes. It also verifies that the weekly rule matches Sunday only.

The scheduled-delivery service suite proves that a due callback reserves a unique `(rule, subscription, local date, local time)` delivery record before it signs a visible payload, that an off-minute invocation is a no-op, and that a duplicate reservation is a safe no-op. The original two-per-rule Heartbeat design failed in the anonymous PWA because it attempted to create an end-user-owned scheduler task without a browser session. The regression suite now verifies the replacement: cadence activation persists the two approved Auckland rules without a session or per-user scheduler job, and only a task UID recorded in the durable project-scheduler registry can sweep enabled rules. The additive migration `0006_busy_skrulls.sql` was reviewed and applied successfully to the connected database.

The scheduled service regression now also proves that a paused rule creates no reservation or provider request, and that a terminal `410` response expires only the affected scheduled device. The full local automated suite now passes with **49 tests across 11 files**; TypeScript checking and the Vercel-targeted production build pass after the scheduler correction. The one global callback is registered under the project owner and its task UID is persisted in the scheduler registry. Its first attempt was rejected with a cron-cookie permission error, which isolated a raw platform-cookie versus local browser-session mismatch. A focused SDK regression now proves the repaired authoritative cron-identity fallback. A production off-schedule callback audit then returned HTTP `200`, authenticated the global job, inspected both enabled rules, and safely returned `not_due` with zero sends. The audit-modified job was replaced by a clean hourly project job and the registry was updated. The user confirmed that the installed iPhone PWA changed to **Pause reminders** after one activation tap; an aggregate privacy-preserving database check confirmed exactly the enabled daily `11:00` and weekly Sunday `17:00` Auckland rules. Automatic provider delivery remains future-observed evidence because no actual reminder wall-clock has elapsed in this session.

After the user could not find the device lifecycle action, the mobile UI was made unambiguous: a dedicated **This device** row is always rendered separately from Scheduled rhythm. The pure state presentation has focused Vitest coverage for connected, reconnect, blocked, and unsupported cases. An iPhone-sized local render shows the row and its **Connect this device** action in a full-width reachable layout. TypeScript, the full **49-test** suite, the production build, and the interface detector pass. The r4 public marker verification and installed-PWA confirmation remain pending.

The complete mobile options audit then removed duplicated connection instructions and reduced the surface to two explicit blocks: **This iPhone** and **Schedule**. The isolated public DOM inventory confirmed that only **Connect this iPhone** is actionable when the exact device is absent; the schedule action is intentionally disabled with **Connect iPhone first**. The independent persistence audit confirmed one active device and the two enabled Auckland rules without exposing identifiers. The revised mobile screenshot has no clipped actions or hidden state. The r5 public artifact and installed-PWA confirmation remain the final release checks.

The user then supplied an installed-iPhone r5 screenshot showing the connected-device state and all relevant controls together: **Send test**, **Disconnect this iPhone**, and **Pause reminders**, alongside the saved daily 11:00 and Sunday 17:00 New Zealand-time schedule. This confirms real-device rendering and the intended separation of the device and cadence actions. It does not substitute for a new provider delivery event or a deliberately invoked disconnect/re-enrol test.

The user then confirmed that the shown state was complete and chose not to perform the optional destructive disconnect/re-enrol test. That decision preserves the active setup and does not weaken the verified device-control rendering, visible manual-test path, persisted enabled cadence, authenticated scheduler audit, or duplicate-safe delivery contract. A future recovery test can use the documented disconnect and reconnect controls if a device change is required.
