# Visible workspace reconstruction

Date: 2026-10-03. Status: implementation. Branch: `dev/personal-calendar-workbench`.

The owner rejected foundation-only progress and authorized actual screenshot-led reconstruction. C2 is pushed as `85b4014`. The approved [white/blue concept](../../../design-system/personal-calander/concepts/2026-10-03-blue-workspace-preview.png) is the minimum visual standard, not a claim that the app already matches it. Improve its usefulness with Sunsama's calm planning and Asana's legible working lists. Preserve all capabilities and real record identity; no invented data, destructive cleanup, live writes, migration, deployment or main merge.

## Design decision

One explicitly approved Astra Medium consultation inspected the concept and bounded UI source, then stopped. It produced recommendations, not implementation or test evidence. SOL owns implementation. No further Astra use without a new explicit Yes.

- Retain a white main working canvas, neutral rail, blue actions/selection and readable slate dark. Supporting colors identify project/category or factual status, not decorative whole-panel washes. Preserve R20 Board lanes exactly.
- One destination header, then destination tabs, then the large full-width active Home watch. No repeated page introductions or competing quick-entry hero. Actionable offline/conflict warnings remain visible.
- Desktop rail about 216px, main inset 28px; phone inset 16px. Section headings 18/26px, task titles 15/22px, metadata 13/18px. Consistent medium/semibold weight, tabular time, clear keyboard focus.
- Today's thin capacity strip precedes a 1.9:1 work/day grid. Work then Habits then completed evidence occupy the broad column; chronology then real milestone/project context occupy the narrow one. Unestimated and unavailable facts remain honest. Phone stacks work, habit evidence and day context.
- Home watch: real lifecycle controls, 108px desktop dial/48px time and approximately 88px phone dial/40px time. Full Focus keeps every display, duration and orchestration capability. Stop must not masquerade as task completion.
- Tasks: clear working views, compact search/filter/sort controls, removable active filters, spacious actionable rows and reachable archive/restore/reorder/bulk tools. No hover-only actions. Desktop inspector about 480px; phone full-height keyboard-safe detail. Secondary properties remain available and populated values summarized.

## Independent ownership

1. SOL Today: Today components/styles/helpers/tests; real habit trace and milestone context through optional snapshot props.
2. SOL integration: Home, shell/rail/phone navigation, Home Focus control and styles/tests; coordinate props without editing Today/Tasks ownership.
3. SOL Tasks: Task workspace/rows/Inbox and inspector presentation/styles/tests, preserving C2 draft and retry protections.
4. Primary: reconcile interfaces, independent rendered verification, full tests/typecheck/build, capability/evidence documentation and checkpoint push.

## Acceptance

- Compare rendered synthetic phone/desktop light/dark composition with the approved concept; identify differences rather than declaring visual quality from source.
- Cover active/idle Focus, populated/empty work, long titles, habits with complete/missed/skip/unrecorded evidence, actionable warnings and detail keyboard/draft behavior.
- No document overflow at 320/390/768/1440px. Verify actual font readiness separately from stubbed-font automation.
- Preserve capture, navigation, inspector concurrency, timer state/offline and task lifecycle regressions. Run focused and full tests, TypeScript and production build before pushing.
- Record files, exact results, runtime limits and unresolved risks. Physical iPhone/PWA/VoiceOver, real providers and live deployment remain separate evidence gates.

## Remaining reconstruction

This visible Today/Tasks/shell checkpoint does not complete the entire app. Connected Plan/Calendar views, Projects/Goals/fluid Timeline, further Habits/Focus continuity, configurable Overview/Review/Settings, authorized calendar connections/reminders, and final whole-app/device/infrastructure acceptance remain in [the checkpoint board](../../RECONSTRUCTION_CHECKPOINTS.md). Hosting/performance work remains later by owner choice. No new dependency or framework is needed for this composition.
