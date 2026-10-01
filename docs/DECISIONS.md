# Current decisions

This is the short decision register. [Historical design decisions](DESIGN_DECISIONS.md) and the [Phase 4 visual selection](PHASE4_VISUAL_SELECTION.md) contain context. Record a change here when it alters product or engineering direction.

| Decision | Rationale and effect |
| --- | --- |
| Workbench branch only; `main` frozen R20 | Keeps the reference and live planner data stable while Phase 4 is developed. A merge requires an explicit instruction. |
| Preserve all existing capabilities and IDs/history | Presentation can relocate controls; it cannot silently delete records, links, recurrence history, or user options. |
| Variant A colors | Owner selected A for the product. Dark mode is an accessible adaptation of A. Exact R20 dark Task lane colors remain. |
| Comfortable default; compact optional | Readability first, with a deliberate density choice in Settings. |
| Today and Overview are separate Home views | Today supports action; Overview supports orientation. Task 20 supplies bounded, reorderable, hideable modules and factual habit evidence. |
| Portfolio Roadmap stays project-level; selected Project Timeline can reveal dated tasks | The owner approved an optional task layer inside a project on 2026-10-01. The portfolio compares projects and goal checkpoints without task clutter; selected-project Overview/List/Board/Timeline share the same record IDs. A task's planned day and deadline are markers, not an invented start-to-finish bar. This mirrors the useful level distinction in [Linear's timeline](https://linear.app/docs/timeline) and [Asana's project timeline](https://help.asana.com/s/article/plan-and-execute-projects-with-timeline?language=en_US) without importing their team-management complexity by default. |
| Instant cross-device Roadmap updates are not yet claimed | Project edits use version-checked backend writes and snapshot invalidation; the current workspace query also refreshes periodically. A future account-scoped push invalidation path must respect offline reconnection, authorization, and migration/deployment gates before it can be called real-time. |
| Outcomes and Directions are additive | Goals without new metadata retain their old semantics. No title-based inference or automatic conversion. |
| Strict recovery is a deliberate choice | The user can resolve, reschedule, reduce, pause, or abandon a specific commitment; history remains inspectable. |
| Task-first offline writing | The existing queue and conflict review cover supported task actions; other writes must communicate their online requirement. |
| Apple Calendar feed is outgoing and read-only | Incoming events, two-way sync, and Gmail are future integrations and must not be described as working. |
| Phase 5 owns deep analytics | Phase 4 keeps current Insights and provenance; it does not replace this with fabricated scoring. |
| New schema requires an exact, separate approval | Local migration tests are insufficient for live writes. Preserve the pre-migration read path until deployment is coordinated. |
| Local cross-page UX redesign may proceed before deployment | Owner explicitly changed the sequence on 2026-10-01 after two independent read-only UX audits. This authorizes local branch work only; infrastructure validation remains mandatory before Vercel deployment, and migration/live-database gates remain unchanged. |

Open questions and active gates live in [project state](PROJECT_STATE.md) and [the handoff](INDEPENDENT_STACK_HANDOFF.md), not in inferred completion labels here.
