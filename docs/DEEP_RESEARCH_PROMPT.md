# Deep Research Prompt: Personal Calendar Product Hardening

## Objective

Research the highest-confidence product, workflow, and architecture patterns for evolving **Personal Calendar** into a genuinely useful personal operating system. The aim is to distinguish proven practices from feature accumulation, then recommend an evidence-based implementation sequence that improves day-to-day planning, habit accountability, lifecycle safety, review quality, integrations, and privacy.

## Context

You are researching for a polished, single-user personal planning web application called **Personal Calendar**. It uses React 19, TypeScript, Vite, Tailwind, Express, tRPC, Drizzle, and MySQL/TiDB. The live product is intentionally anonymous for now: an opaque browser workspace ID scopes records but is not account-grade authentication. It currently supports tasks, goals, projects, habits, task dependencies/subtasks, categories with colors, safe archival, task calendars, a separate habit calendar/tracker, recurring tasks, daily signals, weekly reviews, analytics, an iCalendar subscription feed, and browser-notification readiness. The public app is deployed on Vercel; GitHub is the source of truth.

The product deliberately treats calendar subscription as **read-only**, not iCloud/Google two-way sync. Browser notification permission is not yet actual delivery: no VAPID keys, subscription persistence, delivery sender, or scheduled reminder service has been activated. The design requirement is premium, calm, low-glare, and operationally useful—never a cluttered feature wall or fake action surface.

## Investigate

1. Research the planning mechanics used in mature personal productivity systems such as Things, Todoist, Sunsama, Motion, Akiflow, TickTick, Notion, and Structured. Separate direct evidence from marketing claims. Identify which mechanisms measurably reduce planning friction or support follow-through: inbox capture, triage, projects, areas/categories, task lifecycle, scheduling, estimates, recurrence, time blocking, daily planning, and weekly review.
2. Compare task, project, goal, and habit data models. Identify durable boundaries, mandatory fields, lifecycle states, safe archive versus deletion policies, version/conflict strategies, category removal behavior, and migration paths from anonymous workspaces to account-based ownership.
3. Research habit-tracking evidence and interaction patterns. Evaluate calendar/heatmap, streaks, scheduled frequency, skips, retroactive edits, “never miss twice,” weekly targets, and how to avoid punitive or misleading visual metrics. Recommend the best model for a dedicated habit tracker that does not clutter a task calendar.
4. Research calendar integration options. Contrast read-only ICS subscription, Google Calendar OAuth, Apple Calendar limitations, Microsoft Graph, and two-way synchronization. Explain conflict resolution, idempotency, time zones, privacy implications, and the safest incremental integration path for a personal planner.
5. Research browser and iPhone web-push implementation. Cover VAPID key generation, user-gesture permission, Push API subscription lifecycle, iOS Home Screen requirements, server-side send semantics, endpoint expiry, explicit opt-out, notification content privacy, rate limiting, and idempotent reminder scheduling. Clearly distinguish a manual test notification from dependable recurring reminders.
6. Examine analytics and reviews. Recommend only metrics that are actionable and honest for a personal planner: capacity, carryover, schedule reliability, completion trend, blocked-work age, goal momentum, habit adherence, and decision prompts. Identify misleading metrics to avoid when time tracking or historical data are sparse.
7. Assess accessibility and interaction design for dense planning applications: keyboard workflows, focus order, meaningful empty states, mobile behavior, confirmation thresholds, undo patterns, and how to ensure every visible action has a real, safe outcome.
8. Produce a risk register for this product. Include data isolation, anonymous workspace loss/recovery, production database management, secret management, Vercel/serverless constraints, recurring job delivery, duplicate reminders, timezone/DST behavior, stale browser state, and progressive rollout testing.

## Output Format

Deliver a cited Markdown report containing: an executive synthesis under 250 words; a comparison matrix of relevant product patterns; a decision table with **adopt / defer / reject** recommendations; a concrete domain-model and lifecycle specification; a phased implementation roadmap ordered by user value and risk; a push/integration architecture diagram described in Mermaid; a test strategy; and a risk register. For every recommendation, identify the evidence source, expected user value, implementation cost, and the specific failure mode it prevents.

## Constraints

Do not recommend fabricated testimonials, fake analytics, opaque “AI automation,” or unbounded feature expansion. Preserve the current anonymous-workspace decision until a deliberate authentication migration is approved. Preserve the task-focused main Calendar and the dedicated habit tracker. Treat VAPID private keys and calendar feed tokens as secrets. Prefer user-controlled, reversible, and idempotent workflows. Use primary documentation and credible product documentation wherever possible; label opinion separately from verified evidence.
