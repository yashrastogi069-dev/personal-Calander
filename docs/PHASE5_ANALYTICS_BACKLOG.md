# Phase 5 deep analytics backlog

Status: future discovery boundary; do not expand Phase 4 scope into analytics implementation.

## Product intent

Phase 5 should help a person understand how plans, time, energy, habits, interruptions, and long-term goals interact. It should produce useful decisions, not merely more charts. The design should distinguish recorded fact, derived interpretation, and recommendation.

Potential questions include:

- Which kinds of work are consistently completed, deferred, reduced, paused, or abandoned?
- Where do estimates differ from actual focus, and how should future capacity change?
- Which interruptions repeatedly disrupt planned work?
- Which habits recover after gaps, and which schedules are unrealistic?
- Which goals have activity but little progress, or progress without recent activity?
- How do energy, mood, availability, appointments, and workload correlate over time?
- Which categories receive too much or too little planned and actual attention?
- What follow-ups are repeatedly forwarded without a meaningful next action?

## Foundations Phase 4 must preserve

- Stable record and workspace identifiers.
- Versioned entity history and explicit outcome timestamps.
- Distinct deadline, planned date, reservation, commitment, occurrence, and focus facts.
- Daily-plan resolutions including done, rescheduled, deferred, won't-do, and archived.
- Strict-mode resolutions including reduce, pause, and abandon, with revised scope or review date.
- Habit scheduled/completed/skipped/missed facts without rewriting history.
- Focus actuals separate from calendar reservations.
- Weekly objective evidence and carry-forward ancestry.
- Goal/project/milestone relationships, progress modes, dependencies, and review snapshots.
- Availability exceptions, schedule proposals, conflicts, and approved/undone decisions.
- Timezone context needed to interpret local dates correctly.

## Likely Phase 5 layers

1. Personal activity/event ledger with explicit retention and export controls.
2. Derived metrics with inspectable definitions and recalculation/version rules.
3. Trends and comparisons across days, weeks, months, quarters, and years.
4. Explanations that link every signal back to supporting records.
5. Recommendations presented as reviewable proposals, never autonomous mutations.
6. User-configurable dashboards and reports built after the curated Phase 4 Overview proves useful.

## Guardrails

- Do not infer actual work from reserved calendar time.
- Do not treat streak length as the sole measure of discipline.
- Do not convert correlation into causal claims.
- Do not shame the user or rank personal categories as moral success/failure.
- Do not silently retain sensitive message/document content for analytics.
- Do not let analytics redefine existing goal-progress semantics.
- Keep detailed analytics primarily in Review; surface only decision-relevant signals in Today/Overview.
