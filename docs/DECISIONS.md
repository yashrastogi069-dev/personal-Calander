# Current decisions

## 2026-10-13: BEST Shots redesign programme approved

Owner approved (interview 2026-10-13): Dashboard becomes the home with a one-click switch to Today; white/blue + slate-dark identity kept and upgraded with BEST Shots treatment (filled hero card, dark accent card, hatched future bars, tinted tiles); motion "rich but calm" (<=300ms UI, reduced motion honoured); grouped sidebar, per-page view tabs (max 4), command palette; desktop and phone equal. Build order D0 tokens/motion/primitives, D1 routed shell/nav, D2 Dashboard, D3 Tasks drag, D4 "why it matters" from existing facts, D5 light Analytics, D6 polish. Gated separately: G1 stakes fields (migration), G2 hard reminders (migration + live push), G3 two-way Google sync (OAuth verification, token storage, privacy review). Approved: `@dnd-kit` for D3 drag; `pill` (999px) radius added to the design system; Fable used for key design specs with owner told each time. New code does not go into `Home.tsx`; pages move to routes one at a time behind smoke tests. Source: owner interview + Fable structural review, recorded in `RUN_STATE.md`.

## 2026-10-03: visible reconstruction replaces foundation-only delivery

Owner rejected C1/C2's limited visible difference and explicitly requested the C2 push followed by building the approved white/blue screenshot composition. Deliver full visible workflows (Today/work/day/habits, Tasks List/details) with actual rendered comparison, not further groundwork presented as redesign. Existing IDs/options/history and infrastructure gates remain. SOL delegation only; Astra requires fresh permission. Reference: `design-system/personal-calander/concepts/2026-10-03-blue-workspace-preview.png`.

This is the short decision register. [Historical design decisions](DESIGN_DECISIONS.md) and the [Phase 4 visual selection](PHASE4_VISUAL_SELECTION.md) contain context. Record a change here when it alters product or engineering direction.

| Decision | Rationale and effect |
| --- | --- |
| Workbench branch only; `main` frozen R20 | Keeps the reference and live planner data stable while Phase 4 is developed. A merge requires an explicit instruction. |
| Preserve all existing capabilities and IDs/history | Presentation can relocate controls; it cannot silently delete records, links, recurrence history, or user options. |
| Blue/porcelain reconstruction, 2026-10-03 | Owner reopened A-green colors and approved the blue-led desktop/phone preview. Build light and slate-dark appearances with labelled supporting colors; exact R20 dark Task lanes remain. [Current contract](superpowers/specs/2026-10-03-blue-workspace-reconstruction.md) supersedes the historical A selection. |
| Comfortable default; compact optional | Readability first, with a deliberate density choice in Settings. |
| Today and Overview are separate Home views | Today supports action; Overview supports orientation. Task 20 supplies bounded, reorderable, hideable modules and factual habit evidence. |
| Habits has one visual practice owner | Keep the liked seven-day tick trace and month calendar visible in the canonical Habits workspace, with compact due-only Home actions and deeper corrections/settings behind deliberate navigation. This preserves capability without four duplicate stacked panels. |
| Flexible weekly habits are period targets, not daily misses | Show completed/target/remaining for the current week; no invented daily due date, missed check-in, or streak repair. An explicit skipped/missed state and an unrecorded date remain distinct. |
| Habit corrections use existing check-in identity and version | A correction/clear must reference the observed row; stale concurrent edits return a conflict and refresh instead of overwriting a state or note. This needs no schema migration and legacy unguarded clients cannot modify an existing row. |
| Portfolio Roadmap stays project-level; selected Project Timeline can reveal dated tasks | The owner approved an optional task layer inside a project on 2026-10-01. The portfolio compares projects and goal checkpoints without task clutter; selected-project Overview/List/Board/Timeline share the same record IDs. A task's planned day and deadline are markers, not an invented start-to-finish bar. This mirrors the useful level distinction in [Linear's timeline](https://linear.app/docs/timeline) and [Asana's project timeline](https://help.asana.com/s/article/plan-and-execute-projects-with-timeline?language=en_US) without importing their team-management complexity by default. |
| Instant cross-device Roadmap updates are not yet claimed | Project edits use version-checked backend writes and snapshot invalidation; the current workspace query also refreshes periodically. A future account-scoped push invalidation path must respect offline reconnection, authorization, and migration/deployment gates before it can be called real-time. |
| Outcomes and Directions are additive | Goals without new metadata retain their old semantics. No title-based inference or automatic conversion. |
| Strict recovery is a deliberate choice | The user can resolve, reschedule, reduce, pause, or abandon a specific commitment; history remains inspectable. |
| Task-first offline writing | The existing queue and conflict review cover supported task actions; other writes must communicate their online requirement. |
| Focus watch is a view of confirmed session state | Home and the shell companion present the same backend Focus row. Elapsed time derives from confirmed active seconds plus the last confirmed resume time; device-local display style may change without altering recorded time. Offline time is labeled estimated and write actions wait for reconnection. Stop requires confirmation; reservation time never becomes actual focus. |
| Focus follow-ups start as truthful projections | Finish handoff, Meeting Horizon, Habit Companion, Session Trail, and Routine Conductor use existing workspace records and explicit source/empty labels. No meeting is inferred, no habit duration is fabricated, and the conductor never auto-mutates work. Durable habit attribution, next-step fields, or custom routine history require a separately approved additive model. |
| T19 durable Focus is explicit and locally gated | Local migration 0006 adds nullable habit and handoff fields plus saved active-time segments; historical rows remain unattributed and no check-in is inferred. The backend uses the stored workspace timezone and version-checked, workspace-scoped transactions; old-schema Focus remains usable. The migration is not live-approved or deployed. Routine customization remains deferred. |
| Apple Calendar feed is outgoing and read-only | Incoming events, two-way sync, and Gmail are future integrations and must not be described as working. |
| Incoming Apple Calendar waits for supported account authorization | The owner chose to defer incoming CalDAV rather than use a public calendar link or an app-specific password. Do not solicit Apple credentials or claim incoming appointments are connected. Revisit only after a supported authorization route, strict database TLS verification, encrypted credential storage, and the separate integration/release gates are established. |
| Phase 5 owns deep analytics | Phase 4 keeps current Insights and provenance; it does not replace this with fabricated scoring. |
| New schema requires an exact, separate approval | Local migration tests are insufficient for live writes. Preserve the pre-migration read path until deployment is coordinated. |
| Local cross-page UX redesign may proceed before deployment | Owner explicitly changed the sequence on 2026-10-01 after two independent read-only UX audits. This authorizes local branch work only; infrastructure validation remains mandatory before Vercel deployment, and migration/live-database gates remain unchanged. |

Open questions and active gates live in [project state](PROJECT_STATE.md) and [the handoff](INDEPENDENT_STACK_HANDOFF.md), not in inferred completion labels here.
## 2026-10-04: premium v2 checkpoint and visual benchmark

Owner selected the Focus studio big watch (roughly half the desktop Focus workspace), factual habit heatmap, useful Next steps, and desktop Tasks/Habits bento. Phone keeps Work above Habits. Selected concept images are the minimum composition/typography/color benchmark, not screenshots of implemented functionality; improve readability and action flow without copying illustrative data. Keep modern coherent iconography rather than decorative provider logos implying a working integration. Preserve all established features and exact saved IDs/history.

Selected Timeline reference: `design-system/personal-calander/concepts/2026-10-03-beyond-timeline-concept.png`. Weekly Plan reference: `2026-10-04-week-studio-concept.png` in the same folder. Both remain later checkpoint scope. Larger Focus and Today recorded-practice bento are this checkpoint, not a complete reconstruction of every page.

Delivery: verify locally, create/push only `dev/personal-calendar-premium-v2`, then stop for owner review. Owner explicitly requested automatic Vercel deployment enabled for this new branch; leave the old dev branch remotely untouched and deployment-disabled. A Git-connected Vercel project may create its Preview on push; confirm actual status/URL before claiming availability. No live schema changes, main merge, or production promotion. Source: [checkpoint plan](superpowers/plans/2026-10-04-premium-v2-checkpoint.md).

## 2026-10-13: premium redesign programme and D0 foundation

- Build order D0 tokens/motion → D1 shell/nav → D2 Dashboard → D3 Tasks drag (@dnd-kit approved) → D4 "why it matters" → D5 Analytics → D6 polish. G1 stakes, G2 hard reminders and G3 Google two-way sync stay gated.
- v2.1 preview (private canvas `92uiB3ukGHrDcPqp9Q1SUo` v4) is the approved target look.
- Home tabs are Dashboard | Today | Calendar. Phone bottom nav is Home / Today / + / Calendar / More.
- Roadmap lives in Plan and in Goals & Projects, plus a compact strip on Home. Today drops the weekly overview and links to the week. Insights becomes Analytics under Reflect. The grey backdrop is Dashboard-only (D1 confirms per layout).
- Category palette: five CVD-validated slots. Stored category colours remain user data and are snapped to the nearest slot on screen. A colour never stands alone.
- Legacy green CSS is quarantined by a ratchet test, not deleted, and is removed screen by screen as D1–D6 rebuild each one.
- Owner, 2026-10-13: write a handoff and push to `dev/personal-calendar-premium-v2` after every checkpoint, then continue without stopping.
- Spec: [D0 design](superpowers/specs/2026-10-13-premium-redesign-d0-design.md).

## 2026-10-13: premium redesign D1 shell

- The grey page backdrop is confirmed Dashboard-only (`data-backdrop="page"` on home/overview).
- Insights is labelled Analytics everywhere (rail, palette, `shellSecondaryTargets`, aliases). URLs keep `view=insights`.
- Rail groups: Home (Dashboard, Today, Inbox), Plan, Grow, Reflect, plus More (Goals, Connections, Categories & Recycle Bin).
- Palette prefixes: `>` actions, `#` tasks. ⌘K never opens over another dialog.
- Home tabs use manual activation because selecting one navigates.
- Phone with Capture shows three preferred shortcuts (2 | + | 2, v2.1). The fourth moves to More. This is an assumption made without owner input, and stored preferences are untouched.
- The default landing stays home/today until D2.
- Spec: [D1 shell](superpowers/specs/2026-10-13-premium-redesign-d1-shell.md).

## 2026-10-13: premium redesign D2 Dashboard

- The bare URL now lands on home/overview, the Dashboard. Explicit URLs, `?surface=today` and the PWA shortcuts are unchanged. The `overview` label is "Dashboard".
- The legacy "planner at a glance" list is replaced. Its routes (weekly objectives, saved reviews, goals) stay as quiet Dashboard links, so no capability is dropped.
- Evidence rules, owner rule "Missing evidence is not treated as progress":
  - A project with no roadmap evidence has no status pill instead of "On track".
  - Unknown planned time shows as "—".
  - A pending completion counts only once Home stamps it as evidence.
  - All-day events sit in their own strip.
- Habit check-in from the Dashboard runs only online on a live snapshot, waits for any in-flight habit write, and shows the shared habit error.
- Deferred: the UTC fallback for the habit start date in `shared/habitSchedule.ts` (affects Today and Habits too). The phone "Home" target stays Today until the owner chooses the phone shortcut defaults.
- Owner, 2026-10-13: use opus for UI/UX (with the design skills loaded) and for logic. The owner also asked for more icons, animation and motion; an opus delight pass follows the D2 logic.
- Spec: [D2 Dashboard](superpowers/specs/2026-10-13-premium-redesign-d2-dashboard.md).
