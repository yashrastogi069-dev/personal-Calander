# Roadmap

## Build sequence

1. Research established planning practices and convert the relevant findings into documented product decisions.
2. Finalize the schema, date semantics, recurrence model, API contracts, and UX system.
3. Deliver core planning: dashboard, inbox, goals, projects, tasks, habits, scheduling, and calendar views.
4. Deliver analytics, review periods, saved views, reminders, optional AI drafting, and integration boundaries.
5. Verify edge cases, accessibility, responsiveness, documentation, and public repository synchronization.

## Future extensions

Potential future extensions include account migration, multiple workspaces, external calendar adapters, read-only shared review reports, imported health data, phone notification delivery, and configurable automation. Each extension must preserve the core planning database as the source of truth and degrade gracefully when disconnected.

## Deferred integration activation

The core workspace is intentionally completed before third-party connections or phone notifications are activated. The schema and architecture preserve a boundary for `IntegrationConnection`, external event identity, reminder rules, delivery state, idempotency keys, provider cursors, and reset handling. A later integration phase will add provider authorization, real-time subscriptions, phone delivery, user-enabled reminder schedules, snooze behavior, and connector-specific failure recovery without allowing a disconnected service to corrupt core planning data.
