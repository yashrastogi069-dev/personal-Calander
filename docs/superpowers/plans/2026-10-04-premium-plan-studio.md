# Premium Plan Studio checkpoint

Date: 2026-10-04. Status: owner resumed after premium v2 checkpoint `2f7a7fe`; implementation authorized on `dev/personal-calendar-premium-v2`. Use SOL6 High for implementation and independent SOL6 review. No Astra, main/old dev push, live database changes or Vercel check. Owner verifies automatic Preview; keep it enabled.

## Spec and visual reference

Binding contracts: Phase4 specification sections3/8/14/16/17 and `2026-10-03-blue-workspace-reconstruction.md`, with latest handoff superseding historical branch/palette/delivery authority. Week Studio concept: `design-system/personal-calander/concepts/2026-10-04-week-studio-concept.png`. It is the visual benchmark, not real records or an API contract. Preserve every existing Plan capability.

## Global Constraints

- One record identity across views. Due by, planned day, reservation, occurrence, daily commitment and actual Focus remain distinct.
- Never invent records, time slots, completion, scores or incoming Apple/Google events. Missing bounded context is not proof the calendar is empty.
- No backend/schema/live writes. Reuse existing versioned planning mutations and Recovery; unsupported offline writes retain draft and explain reconnect, never claim queue persistence.
- Preserve daily stages/intention/order/outcomes/close/reopen/history and weekly objective create/links/evidence/Complete/carry ancestry/history. Preserve missing/final/recurring task reconciliation safeguards.
- White/blue/slate themes, readable Onest, labelled semantic colors, 44px phone controls, visible keyboard focus, safe bottom navigation. Horizontal scrolling may occur only inside the explicitly labelled week board; phone uses day selection/list, no document overflow.
- Root integrates/verifies/docs/pushes verified checkpoint only to premium v2. Vercel check belongs to owner. No Astra without fresh permission.

## Task 1: Build the Plan Studio presentation and date continuity

Own `client/src/features/planning/PlanWorkspace.tsx`, `plan-stages.css`, new `PlanWeekBoard.tsx`, `planBoard.ts` and focused tests in that folder. Targeted Home integration allowed only for Plan selected-date/task/calendar callbacks and truthful data-range context. No other Home/shell/task/Focus/backend rewrites. One implementer to avoid overlapping edits.

1. Inspect current tests and add pure projection tests before implementation. Week board derives seven dates and rows from explicit snapshot planned-day/reservation/daily-plan facts. Never place a deadline-only task on a planned-day column. Collapse repeated same-task/day references into one task card with all source commitment identities retained; recurrence occurrences must not rewrite series or disappear. Retain unplanned work visibly and existing history/outcome actions.
2. Compose weekly objectives, unplanned pool, dated work board and selected-day context in the approved visual family. A bounded horizontally scrolling desktop board is acceptable; make every weekend reachable. Phone uses a seven-day selector and selected-day cards, then context/pool. Do not duplicate lifecycle Board from Tasks.
3. Daily retains its resumable stage rail and real controls, with cleaner work/context hierarchy. Existing weekly objective editor/history remain reachable through intentional sections. Do not remove Planning/Recurring tools or proposal/recovery controls.
4. Selected day is navigation, not a write. Use Home's existing selected-date state where practical and scoped safe session storage for reload continuity; no cross-account/workspace draft leakage. Calendar and canonical task-detail handoffs carry exact date/record and retain Plan return context. Show date/timezone/source facts. Old links and default Today behavior remain compatible.
5. Inspect snapshot coverage before showing context/counts outside it. Prefer bounded range or explicit unavailable-context labels to silent false empty state; do not widen every query indefinitely or relabel missing events as zero busy time.
6. No pretend drag handles. Reuse real reviewed scheduling/Calendar actions; add keyboard/touch-equivalent actions only with honest behavior. Changes to planned day never secretly move daily commitment history or deadlines.
7. Apply online guards to server-backed Plan mutations and contextual controls (including weekly evidence/carry and day outcomes), preserve versions/pending/error behavior and drafts. Do not promise offline daily-plan/weekly writes.
8. Add tests for date/identity/duplicate facts/deadline-only/missing links/empty/out-of-range, accessible phone/desktop markup, guarded unsupported offline writes and date-aware callback integration. Run focused tests and TypeScript; root owns full suite/build and rendered final verification.

Report file in this plan's SDD workspace: implementation, files, focused commands/results, red/green evidence, risks and self-review. Do not spawn subagents or push. Root controls commits and independent review; don't stage unrelated reference/browser files.

## Task 2: Independent review and integration acceptance

Read-only reviewer receives Task1 brief/report/diff; verify both spec compliance and code quality. Focus on explicit date/source/coverage semantics, every retained planning action, identity/recurrence, unsupported offline writes, safe storage, scope transitions and date-aware handoffs. Root resolves gaps through implementer fix/review, not silent inspection-based completion.

Root runs full tests, TypeScript, production client/server/PWA build and synthetic loopback browser: 320/390/768/1440 light/dark, daily/weekly populated/empty/offline, selected dates/weekend/date handoff/Back/reload, version conflict/error and at least one existing Plan mutation with intercepts. Actual public font loading checked separately if changed; no live records/credentials. Update product/decisions/evidence/state/memory. Push checkpoint to current premium branch, verify remote SHA, no Vercel check, then report what's left.
