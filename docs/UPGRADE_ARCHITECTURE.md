# Upgrade Architecture and Reliability Contract

## Core model

The planning system remains the source of truth. Goals represent outcomes, projects represent finite commitments, tasks represent actionable work, and occurrences represent a dated execution fact for recurring work. External calendar events, calendar subscriptions, and notifications remain separate projections; none can silently alter a task, goal, project, habit, or historical completion.

| Capability | Persistent model | Action rule |
| --- | --- | --- |
| Daily plan | `dailyCheckIns` is extended with focus task, energy, mood, intention, reflection, and planned capacity | A focus task must be an active workspace task; replacing it does not edit its lifecycle or schedule. |
| Recurring task | `tasks.recurrenceRule` defines the series; `taskOccurrences` records local-date outcome, reschedule, skip, completion, and series version | Series edits apply forward; past occurrences remain immutable facts. |
| Saved views | `savedViews.configuration` stores an allowlisted filter, sort, grouping, and date-range configuration | A saved view must be scoped to its workspace and cannot contain executable expressions. |
| Review | `reviewSessions` captures period, prompts, factual metrics, carryover decisions, and reflection | A review can suggest actions but never changes open work without explicit confirmation. |
| Notifications | `pushSubscriptions` and `reminderRules` record permission, endpoint state, delivery preference, snooze, and opt-out | A reminder is delivered only if active, not snoozed, and the subscription is valid. Failed or expired endpoints are disabled. |
| Calendar connections | `calendarConnections`, sync cursor, and `externalEvents` isolate provider state | Imports are read-only by default; token invalidation clears the local projection before a fresh sync. |
| iPhone Calendar | An authenticated public `.ics` feed is generated from selected planning records | The subscription never exposes private notes; revoking the feed invalidates its opaque token. |

## Decision-support analytics

The dashboard will calculate a planning-health view from facts: planned versus completed work, carryover rate, schedule reliability, blocked-task age, work-category balance, focus-task completion, habit consistency, time estimate calibration, and goal momentum. Each metric must offer a plain-language explanation and a linked next action, such as rescheduling overflow, reducing daily commitment, or opening a stalled goal.

## Integration rollout

The first activation path is a web calendar subscription for iPhone Calendar because it is read-only and requires no third-party credentials. Push requires a Home Screen installed web app, an explicit permission gesture, server-side VAPID credentials, and a valid browser subscription. Full provider synchronization is deferred until the user authorizes a provider; it uses incremental cursors, idempotent upserts, deletion handling, and full resync after cursor invalidation.

## Edge-case contract

| Condition | Required behavior |
| --- | --- |
| Timezone changes | Existing historical check-ins retain their recorded timezone. Future recurrence generation and date labels use the workspace’s new timezone. |
| Duplicate reminder trigger | A delivery key prevents duplicate sends for the same rule, occurrence, and planned time. |
| Stale update | Version mismatch returns the current record and gives the person refresh/resolve options. |
| Series modification | Future occurrences are regenerated after the selected boundary; completed, skipped, and rescheduled history stays unchanged. |
| Push endpoint failure | A 404/410 endpoint is disabled, its failure is recorded, and the app invites the person to re-enable notifications. |
| Calendar feed compromise | Revoking the opaque feed token invalidates the entire previous subscription URL. |
