# Market Research and Product Implications

## Research objective

This research examined established products for four personal-planning problems: quickly finding the right work, modeling repeated work without losing history, connecting strategic goals to daily actions, and keeping a calendar accurate when external data changes. The product should take the useful interaction patterns without reproducing the complexity of team-oriented tools.

## Findings from planning tools

| Market pattern | Evidence | Product decision for Personal Calendar |
| --- | --- | --- |
| Saved, composable views reduce retrieval friction | Todoist defines filters as reusable views that can combine task name, date, project, label, priority, and creation date; it also supports list, board, and calendar renderings of a view. [1] | Saved views will store structured filters, sort order, grouping, and a preferred layout. The first release offers approachable filter controls rather than exposing a query language as a requirement. |
| Calendar is a planning surface, not merely a deadline list | Todoist supports creating from a calendar date, dragging unscheduled work into a date, rescheduling by drag-and-drop, changing the displayed coloring dimension, and viewing future recurring occurrences in calendar form. [2] | The calendar will expose actionable tasks separately from goals, retain an unscheduled backlog, support drag-to-schedule, and let color represent category while status is communicated with shape and labels. |
| Recurrence needs explicit semantics | Todoist distinguishes recurrence based on the original schedule from recurrence based on completion; it treats postponement and rescheduling as changes to only the next instance in the series. [3] | Recurrence records will name their anchor (`scheduled` or `completion`), preserve a specific occurrence’s outcome, and apply a single-instance edit without silently rewriting the entire series. |
| Daily planning benefits from capacity feedback | Sunsama guides people through reviewing unfinished work, choosing the day’s tasks, comparing estimated workload with a configured threshold, and then timeboxing or deferring work. [4] | Daily planning will display an estimated-workload indicator, distinguish scheduled time from due date, and provide explicit defer/backlog actions when capacity is exceeded. |
| Repeated work and fixed appointments are different | Sunsama treats recurring tasks as flexible commitments and recurring calendar events as fixed appointments; it also preserves completed instances when editing a recurring series. [5] | A task can have an optional planned timeblock, but calendar imports will be modeled as external events. The UI will never make a person choose a time for a flexible recurring task merely to maintain its habit. |
| Sustainable habit tracking distinguishes a miss from a planned break | Habitify documents separate actions for account-wide time off, a single-day skip, and archival; the first two protect streaks while archive retains history outside the active routine. [6] Streaks also allows habits to follow the days on which the habit is actually expected. [7] | Habit check-ins will be an explicit state machine: `completed`, `skipped`, `missed`, and `not_due`. Planned rest days and deliberate skips are excluded from the streak denominator; unacknowledged eligible dates become missed only after the local-day boundary passes. |
| Review rituals bridge daily actions and long-term goals | Todoist describes a weekly review as a short cycle to clear inputs, reconcile current work, evaluate goal/project progress, and plan ahead. [8] | The review flow will use a compact staged ritual: capture clean-up, factual look-back, at-risk goal/project review, capacity-aware next-period plan, and a short reflection. It will remain user-customizable and never frame incomplete tasks as failure. |
| Goal progress is more useful when it is connected to work and measured intentionally | Notion documents relations between tasks and projects plus rollups across those relations, while ClickUp describes progress aggregation from task targets and goal groupings. [9] [10] | A goal can link to projects, tasks, habits, and a numerical measurement. Dashboard progress will explain its contributing data instead of showing an opaque percentage. |
| Different temporal views answer different questions | Asana positions timelines for date ranges and dependencies, calendars for near-term deadlines, and Gantt views for a start-to-finish plan. [11] | Day and week views prioritize commitment and capacity; month is a deadline/coverage view; quarter and year prioritize goal horizons, milestones, and project runway. The same record remains one source of truth across these views. |

## Integration findings

External-calendar synchronization should be isolated from the planning system. Google Calendar’s incremental synchronization begins with a full sync token, then applies changed and deleted records from later requests; a `410` response requires replacing local synchronized state with a new full sync. [10] Microsoft Graph similarly pairs change notifications with delta queries and requires clients to tolerate replays, deleted entities, expiration, and explicit synchronization resets. [11] [12]

Therefore, an adapter will store provider-specific identifiers, sync cursors, subscription metadata, and an explicit source-of-truth policy outside the core task model. Imported events remain external events by default. A person may deliberately create or link a planning task from an external event, but no connector may silently mutate goal, task, or habit records. Incoming syncs will be idempotent, retry-safe, versioned, and capable of a complete rebuild after an expired cursor.

## Product principles derived from the research

The workspace should optimize for a clean daily decision, not make people manage the system itself. It will distinguish goals from actions, schedule tasks without conflating dates and timeblocks, treat recurring history as facts, explain calculations, let people recover from overplanning, and keep external services at the boundary rather than in control of the core workflow.

## References

[1]: https://www.todoist.com/help/articles/introduction-to-filters-V98wIH "Todoist — Introduction to filters"
[2]: https://www.todoist.com/help/articles/use-the-calendar-layout-in-todoist-lPHRQTu0o "Todoist — Use the calendar layout"
[3]: https://www.todoist.com/help/articles/introduction-to-recurring-dates-YUYVJJAV "Todoist — Introduction to recurring dates"
[4]: https://help.sunsama.com/docs/usage-guides/daily-planning/ "Sunsama — Daily Planning"
[5]: https://help.sunsama.com/docs/usage-guides/tasks/recurring-tasks/ "Sunsama — Recurring Tasks"
[6]: https://www.todoist.com/productivity-methods/weekly-review "Todoist — The Weekly Review"
[7]: https://www.notion.com/help/relations-and-rollups "Notion — Relations & rollups"
[8]: https://clickup.com/features/goals "ClickUp — Goals"
[9]: https://help.asana.com/s/article/plan-and-execute-projects-with-timeline "Asana — Plan and execute projects with a deadline"
[6]: https://intercom.help/habitify-app/en/articles/11597864-how-to-pause-or-cut-off-your-habits "Habitify — How to Pause or Cut Off Your Habits"
[7]: https://streaksapp.com/ "Streaks — Habit tracker overview"
[8]: https://www.todoist.com/productivity-methods/weekly-review "Todoist — The Weekly Review"
[9]: https://www.notion.com/help/relations-and-rollups "Notion — Relations & rollups"
[10]: https://clickup.com/features/goals "ClickUp — Goals"
[11]: https://help.asana.com/s/article/plan-and-execute-projects-with-timeline "Asana — Plan and execute projects with a deadline"
[12]: https://developers.google.com/workspace/calendar/api/guides/sync "Google Calendar API — Synchronize resources efficiently"
[13]: https://learn.microsoft.com/en-us/graph/delta-query-overview "Microsoft Graph — Use delta query to track changes"
[14]: https://learn.microsoft.com/en-us/graph/change-notifications-overview "Microsoft Graph — Set up notifications for changes in resource data"
