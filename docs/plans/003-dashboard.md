# 003 — Home Overview dashboard

Status: planned. The separate configurable Overview from Phase 4 Task 20 is not implemented as of 2026-10-01. Today exists as a separate execution surface.

## Product outcome

Overview answers: “What deserves a decision across my life and planning horizons?” It opens alongside Today under Home and uses the same underlying planner records. The [product specification, section 6](../superpowers/specs/2026-09-14-phase4-total-product-redesign.md) and [Task 20](../superpowers/plans/2026-09-14-phase4-total-product-redesign.md) are authoritative.

## Scope

| Module | Decision and destination |
| --- | --- |
| Needs attention | Resolve recovery, overdue work, or follow-ups at the source |
| Time and capacity | Open the relevant Plan/Calendar period |
| Habits | Complete or plan a return; open schedule/history |
| Goals and directions | Open the specific intention needing action or review |
| Projects at risk | Open the stalled project and blocking records |
| Upcoming milestones | Open the milestone or Roadmap period |
| Review | Open the next useful review session |

Every module needs a defined empty state, visible period, source record IDs, one primary next action, and record-level drill-through. The Habits module may include a compact factual heatmap of existing dated check-ins. Completed, intentional skip, not due, and unrecorded days must remain distinct; blank cells must not become inferred failure or a new productivity score.

## Implementation path

1. Build `shared/overview.ts` as pure, bounded projections from established snapshot facts and existing Today, Recovery, Habit, Goal, Project, Roadmap, and Review selectors. Do not create dashboard-owned planner records.
2. Add `server/overview.test.ts` for each module's decision, period, source IDs, action, empty state, and canonical destination. Cover duplicate prevention and heatmap timezone/text-summary semantics.
3. Build `OverviewWorkspace.tsx`, `OverviewModule.tsx`, and `overview.css` under `client/src/features/today/`. Use a composed desktop grid and a phone briefing that puts active attention first.
4. Extend versioned device-local preferences through `usePlannerPreferences.ts` for bounded size, ordering, and hide/show. Hidden modules remain discoverable, and hiding Needs attention must not suppress the global Strict recovery indicator.
5. Integrate Home's Today/Overview navigation with existing route, Back/Forward, loading, error, offline, and account boundaries. Preserve all Today behavior and existing destinations.

## Acceptance gate

Run the Task 20 focused suite (`overview`, goal health, planning forecast, and planner rules), TypeScript check, production build, and responsive synthetic browser scenario at 320, 390, 768, and 1440px. Verify populated and empty modules, keyboard/touch drill-through, screen-reader text for the heatmap, customization migration, hidden-module recovery, and zero page-level overflow. Record results in [slice evidence](../PHASE4_SLICE_EVIDENCE.md). Final whole-app and physical-device review belong to [Task 22](../PHASE4_UI_UX_COVERAGE.md).

No dashboard test, schema migration, live write, or deployment is claimed by this planning document.
