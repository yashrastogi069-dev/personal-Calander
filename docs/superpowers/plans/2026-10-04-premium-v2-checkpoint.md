# Premium v2: first checkpoint

Date: 2026-10-04. Status: local checkpoint verified; Git delivery receipt in slice evidence. Work started on `dev/personal-calendar-workbench`; create/push only `dev/personal-calendar-premium-v2`, then stop. Main and old dev remote remain untouched. Vercel verification is owner-owned.

## Owner selections

- [Focus studio concept](../../../design-system/personal-calander/concepts/2026-10-04-focus-studio-concept.png): large watch occupying roughly half the Focus screen, with useful Next steps/context alongside it.
- Tasks and Habits side by side in a readable desktop bento; phone keeps Work above Habits. This explicitly changes the prior stacked desktop Home composition, not the phone order.
- Visible factual habit-record heatmap; retain the existing seven-day trace/calendar and every check-in/correction action. No invented scores, future ticks or inference that an empty day means failure.
- [Timeline concept](../../../design-system/personal-calander/concepts/2026-10-03-beyond-timeline-concept.png) remains the next Projects/Goals direction. [Week studio](../../../design-system/personal-calander/concepts/2026-10-04-week-studio-concept.png) is the selected Plan direction. Neither engine is included in this bounded checkpoint.
- White/blue, Onest typography and readable slate dark remain. Feature parity and honest data take precedence over copying fictional concept labels.

## Authority and delivery

The owner explicitly requested one completed checkpoint followed by a new branch and push. They then explicitly requested automatic deployment enabled for this new branch; `vercel.json` enables `dev/personal-calendar-premium-v2` while retaining the workbench branch's disabled setting. A push may trigger Vercel Preview. This is a branch-specific Preview instruction, not evidence that infrastructure gates passed, production promotion, a main merge, live database writes or migration approval. Do not apply schema changes to make a Preview look successful. Record actual deployment evidence and unresolved TLS/backup/schema/device gates separately.

No Astra call is authorized or required for this implementation. Use SOL high for Focus and Home work, SOL medium for independent data-contract review.

## Independent ownership

1. Focus-specific presentation and tests: half-canvas watch, real session controls and existing next-step/conductor/context features.
2. Today-specific presentation/helper/tests: desktop Tasks/Habits bento, narrow stacking and explicit-record 28-day heatmap.
3. Read-only reviewer: record/date/evidence coverage, long/offline timers, identity and deployment hazards.
4. Primary: integration, final test/typecheck/build/browser verification, docs/memory, new branch and verified push, then stop. Owner's latest instruction delegates Vercel verification to them; do not check Vercel.

Keep edits disjoint; no backend/schema or actual planner mutations. Preserve the existing uncommitted Today/Tasks/shell redesign at this checkpoint.

## Acceptance

- Actual synthetic phone/tablet/desktop light/dark render checks, not just source inspection. No document overflow; reachable touch/keyboard controls and correct stacking.
- Large Focus shows real elapsed/target state including long durations; Pause/Resume/Stop remain distinct from completing a task. Next steps and existing Session Trail/Habit Companion/Meeting Horizon remain reachable with honest availability.
- Heatmap ends at workspace today, excludes future/foreign records, distinguishes completed/missed/skipped/unrecorded, and labels bounded evidence. Do not infer habit compliance or create/delete check-ins.
- Full tests, focused regressions, TypeScript and production build; preserve capture and inspector draft/concurrency protections.
- Report exact results, files changed, runtime evidence and risks. Physical iPhone, provider authorization/delivery and live data are not proved by mocked browser tests.
- Confirm the exact new remote branch SHA; a successful Git push is not a successful Vercel deployment. Automatic deployment stays enabled; Vercel verification is owner-owned and intentionally not executed. Stop after this checkpoint handoff.
