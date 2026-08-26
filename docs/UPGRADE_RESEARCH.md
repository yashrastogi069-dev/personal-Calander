# Upgrade Research: Personal Operating System

## Design premise

The next release should reduce planning friction while increasing the quality of decisions. A trustworthy system makes the next action clear, protects an achievable daily focus, makes plan-versus-reality visible, and supports reflection without turning life into a surveillance dashboard.

## Evidence-backed product decisions

| Research signal | Product decision |
| --- | --- |
| A daily planning ritual works best when it connects long-term goals, a weekly sketch, and one protected daily priority. [1] | Add a daily-plan ritual with one selected focus, capacity guardrails, an inbox-to-plan triage flow, and explainable goal alignment. |
| A useful weekly review combines clearing inputs, reconciling past and future calendar commitments, reviewing projects/goals, and planning ahead. [2] | Replace the static review surface with a persisted review session that tracks review steps, carryover choices, reflections, at-risk work, and a next-week commitment. |
| Apple Calendar supports subscription calendars on iPhone and iPad by adding a trusted calendar web address. [3] | Deliver a read-only Personal Calendar `.ics` subscription feed as the first iPhone Calendar connection. It requires no Apple credentials, remains user-controlled, and never lets an external calendar overwrite planning records. |
| Apple supports standards-based web push for Home Screen web apps on iOS 16.4 or later. Permission must follow a user gesture; subscription endpoints and encryption keys must be stored server-side; push delivery failures require cleanup/retry handling. [4] | Add an installable web-app foundation, explicit notification opt-in, a server-side subscription model, and a reminder-outbox contract. Actual push delivery activates only after VAPID credentials and permission are available. |
| Incremental calendar sync requires stored cursors, delete handling, idempotent application of changes, and a full reset when the provider invalidates a token. [5] | Future Google/Outlook adapters will remain isolated, use cursor-based incremental sync, enforce idempotency, and use a full-resync recovery policy. Core tasks and goals remain the source of truth. |

## Expanded functional backlog

The release should add a genuine inbox, a daily focus commitment, energy and mood check-ins, contexts, recurring work with occurrence history, custom saved views that users can create and recall, bulk actions, sort modes, a review wizard, schedule-reliability analytics, carryover and overload signals, and privacy-respecting integrations. Each surface must modify persisted state or explain why no action is available.

## Guardrails

Analytics are advisory, not judgmental: they should reveal capacity and patterns rather than score a person. Calendar subscriptions are read-only by default. Push is opt-in, reversible, and only sends time-sensitive reminders. External adapters never silently create, complete, reschedule, or delete a core planning record.

## References

[1]: https://www.todoist.com/inspiration/how-to-plan-your-day "Todoist — How to Plan Your Day"
[2]: https://www.todoist.com/productivity-methods/weekly-review "Todoist — The Weekly Review"
[3]: https://support.apple.com/en-us/102301 "Apple Support — Add calendar subscriptions in iCloud"
[4]: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers "Apple Developer — Sending web push notifications"
[5]: https://developers.google.com/workspace/calendar/api/guides/sync "Google Calendar API — Synchronize resources efficiently"
