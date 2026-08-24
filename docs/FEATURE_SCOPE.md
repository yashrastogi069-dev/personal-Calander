# Feature Scope

## Product premise

Personal Calander is a focused personal operating workspace. It separates intent (**goals and projects**) from commitment (**tasks and scheduled work**) while still letting a person see the full picture from a daily focus view through annual planning.

## Core outcomes

The first release must make capture, prioritization, scheduling, completion, review, and reflection fast enough to become a daily practice. No account sign-in is required in the initial release. The current workspace acts as a locally scoped planning profile and is intentionally designed so ownership can migrate to authenticated users later.

| Area | Included in the build |
| --- | --- |
| Planning hierarchy | Goals, projects, tasks, subtasks, categories, priorities, due dates, dependency links, colors, and horizons |
| Daily practice | Inbox capture, today focus, daily check-ins, habits, scheduled occurrences, and rescheduling |
| Time planning | Day, week, month, quarter, and year views with timezone-safe behavior |
| Insight | Goal progress, workload, streaks, completion patterns, category balance, and review periods |
| Reliability | Validation, idempotent recurrence logic, optimistic updates with rollback, conflict detection, accessible controls, and meaningful empty/error states |
| Extension points | User-controlled reminders, AI-assisted drafts pending confirmation, and a separate external-data integration boundary |

## Explicit safeguards

Goals do not appear as directly completable calendar work unless linked tasks exist. Completed recurring occurrences remain historical facts, while future generated occurrences stay independently editable. Archived records never disappear from audit history. Every mutation carries a record version to prevent silent overwrites.

## Deliberate non-goals for the initial release

The initial release does not attempt collaboration, shared workspaces, external calendar write-back, or autonomous AI actions. Integration adapters remain disabled until explicitly configured, and AI suggestions remain drafts until a person confirms them.
