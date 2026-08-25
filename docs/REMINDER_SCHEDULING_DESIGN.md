# Pacific/Auckland Reminder Scheduling Design

## Approved behavior

The user has approved two visible PWA reminders in the `Pacific/Auckland` IANA timezone: a **daily planning prompt at 11:00** and a **weekly review prompt every Sunday at 17:00**. `Pacific/Auckland` is retained as an IANA timezone rather than a fixed offset, so New Zealand daylight-saving changes are applied by the runtime’s timezone database.

| Rule | Persisted type | Local schedule | Delivered content |
| --- | --- | --- | --- |
| Daily planning | `daily_plan` | Every day at `11:00` | A concise visible prompt to open the planner and choose the next commitment. |
| Weekly review | `weekly_review` | Sunday at `17:00` | A concise visible prompt to close the planning loop and review the week. |

## Execution model

The platform scheduler uses **one project-owned hourly UTC trigger** for the deployed application, not a fixed UTC wall-clock schedule and not one user-owned task per reminder rule. On each invocation, the authenticated handler first verifies that the platform-issued task identifier matches its durable project-scheduler record. It then evaluates only enabled daily-plan and weekly-review rules with `Intl.DateTimeFormat` in their persisted IANA timezones. This makes the user-facing schedule stable at 11:00 and 17:00 in Auckland even when the corresponding UTC hour changes.

The scheduled callback contains no trusted business input. It authenticates the platform caller and reads the immutable task identifier supplied by that identity. An unknown or historical task identifier is an orphaned successful no-op; it cannot trigger a cross-workspace sweep. A valid project task can inspect enabled rules only, and a paused, disabled, or not-yet-due rule produces a successful no-op response rather than a retryable failure.

## Idempotency and delivery lifecycle

For every due active subscription, the handler computes an idempotency key from the reminder rule, subscription, local date, and local time. It reserves a `pushDeliveries` record with that unique key before provider delivery. A duplicate-key result means another attempt has already reserved or completed that send, so the handler safely skips it. This protects against retry behavior, concurrent triggers, and repeated invocations in the same local reminder minute.

The server signs the payload with the server-only VAPID credentials, records a sent provider status on success, and records a failure or terminal expiration on rejection. A `404` or `410` provider response expires only the affected device subscription. Reminder payloads remain short, visible, and non-sensitive; they do not contain task titles, goal titles, private notes, or an Apple Reminders claim.

## User control and deployment sequence

The reminder rule interface exposes the local timezone, cadence, enabled state, and pause/resume behavior. Activating the approved cadence persists and enables the two rules without relying on an anonymous browser session cookie. Pausing disables the two rules; the project-owned hourly trigger remains in place but finds no enabled work. Disabling a device removes that browser subscription without changing reminder rules for another device.

> The callback code and scheduler-registry migration must be deployed before the single project-owned scheduling task is created and recorded. A prior browser activation attempt failed before creating a task because that design attempted to provision user-owned tasks from an anonymous PWA session. The replacement preserves the approved cadence and removes that fragile dependency. Actual installed-iPhone automatic delivery remains a final verification step.

The first project-owned callback exposed a separate authentication integration issue: Heartbeat supplies a platform-issued cron cookie that is not signed with the app’s local browser-session secret. The callback now resolves an otherwise-unverifiable cookie through the authoritative identity endpoint and accepts it only when it identifies a `cron_` actor with a platform-bound task UID. Normal raw or foreign tokens remain rejected. The repair has a focused regression test; a successful post-repair scheduler audit remains required before automatic provider delivery is claimed.

The post-repair audit completed successfully with HTTP `200`. It authenticated the project scheduler, inspected the two enabled Auckland rules, found neither due at the audit instant, and returned two safe `not_due` no-ops with no push sends. The temporary audit-modified job was then deleted and replaced with a fresh project-owned hourly job; the durable scheduler registry was updated atomically to its new task UID. Automatic provider delivery remains future-observed evidence, but the authenticated callback and safe off-schedule evaluation are now verified in production.

## Validation contract

The automated suite covers daily and weekly local-time matching in both Auckland daylight-saving and standard-time periods. Additional service and route tests cover project-task ownership, session-independent activation, disabled/no-op behavior, duplicate reservation, provider expiration, and payload safety. Live validation must prove enable, visible manual test, automatic scheduled delivery, pause, and re-enable on the user’s installed PWA.
