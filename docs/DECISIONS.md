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

## 2026-10-13: iPhone navigation, gestures and glance features (owner interview)

- Phone bottom bar becomes Home / Today / + / Calendar / More (v2.1). Home opens the Dashboard. Tasks, Daily plan, Inbox, Habits, Focus, Review and Analytics live in More. Only the code default changes (`shared/phase4Preferences.ts`); a saved custom shortcut list is never overwritten.
- Style: floating glass bar that shrinks to a compact pill on scroll down and expands on scroll up. The left sidebar stays for iPad and laptop only. A phone left drawer was rejected (hidden navigation, poor thumb reach).
- The centre "+" is context-aware: Calendar → New event, Habits → New habit, elsewhere → New task, with a short spring icon morph.
- Gestures (all approved):
  - swipe task rows (right to complete, left to reschedule, buttons kept)
  - swipe between days on Today and Calendar
  - long-press "+" and tabs for quick actions
  - pinch on Calendar for day ↔ week ↔ month
  - tap the active tab to scroll to the top
- New dependency approved: `@use-gesture/react` (pinch, swipe velocity).
- Tab switches on phone use a directional slide (~240ms ease-out). Reduced motion makes them instant.
- Extras approved:
  - outline → filled tab icons with a spring pop and bouncing live badges
  - More becomes a launcher grid of tinted icon tiles with live badges and drag-down dismiss
  - pull to refresh with a ring that fills as you pull
- Fable is approved to design the phone navigation, gesture and motion system before opus builds it. Tell the owner when it runs.
- Order: the new slice "D3.5 iPhone nav & gestures" runs after D3 (Tasks board drag), then D4–D6.
- Widgets: real iPhone widgets need WidgetKit (native only), so the free PWA-only path was chosen. It is a new slice, D7 "Glance & reminders", after D6:
  - Calendar feed upgrade: VALARM alerts, category tags, focus blocks, and a setup guide. On the iPhone, "Remove Alerts" must be off for the subscription.
  - App icon badge for tasks left today (Badging API, iOS 16.4+).
  - Lock-screen push. This unlocks G2: turn on the existing daily-plan and weekly-review reminders (the scheduler rollout is the owner's dashboard steps), then add Next-up, evening shutdown and habit nudges.
- Not chosen: the Siri & Shortcuts pack, a native Capacitor wrapper.

## 2026-10-13: Focus redesign (D2.5) and model routing

- **Routing:** the owner said "use FABLE 5.1 not opus for designs". Fable 5.1 does all UI/UX design and the visual build, with the design skills loaded. Opus does logic and review.
- **Spec:** Fable wrote [Focus and inner surfaces](superpowers/specs/2026-10-13-premium-redesign-focus-and-inner-surfaces.md). Its references are the Coterie Time tracker and the Fernly Time Tracker (`BEST Shots/`).
- **Stopped focus sessions** (state `abandoned`) now count in Dashboard focus totals, because the stop prompt promises their time is saved.
- **At the target**, the timer keeps counting with an overtime lap and a quiet "Target reached" moment. It does not open the Finish panel automatically, and there is no sound.
- **The Dashboard focus card** is dark while a session is live and white when idle.
- **Order:** D2.5 Focus is built now, before D3. It also creates the shared pieces later slices reuse: dial, sheet, choice tiles, page header, empty state and review chip.
- **Preview diagnosis:** production (`personal-calander.vercel.app`, `main`) still runs the old code, and the dev database is empty. A rich in-browser demo preview is being added for owner checks.

## 2026-10-13: D2.5 review outcomes (opus review of D2.5 + D3 logic)

- **Built and pushed:** D2.5 Focus (`91bb8d2`, `fc87b33`) and the D3 logic layer (`65be9e0`).
- **Review:** 0 high, 4 medium, 5 low. The full status table is in HANDOFF "Start here".
- **Decided (agent, within the approved scope):**
  - The Dashboard "Now" card never offers a second Start focus while a session is open. It shows "Open focus" instead.
  - Finish disables "Done" when the server would refuse it, and shows the reason.
  - A deliberate "Start focus on X" skips the pending "What next?" review.
  - The review stays pinned once shown.
  - A "Next 7 days" drop is capped at the deadline.
- **Open, owner to decide:** recurring tasks anchored only on a deadline count as "Past due" forever (`shared/taskBuckets.ts`). This matches the D1 badge and a test locks it in. Proposed: treat them by their next occurrence instead, and change the badge to match.
- **Accepted:** clock skew on the 10-minute "recent session" window (low).

## 2026-10-13: D3 Tasks spec (Fable 5.1) — working assumptions, owner to confirm after D3.5

- Spec: [D3 Tasks](superpowers/specs/2026-10-13-premium-redesign-d3-tasks.md), written by Fable 5.1 (`claude-fable-5-1`).
- The owner is away until D3.5 and asked for continuous work, so Fable's recommended answers are applied as assumptions:
  - The Board's default lens is Status: To do / In progress / Blocked / Done. The When lens is one toggle away.
  - Inbox "Someday" takes a task out of the Inbox and its badge. It then lives under No date with a Someday pill.
  - Desktop task detail opens in a right-side panel (`Sheet variant="side"`).
- Build order inside D3: D3a (contract, recurring-date fix, List, row, header, detail), D3b (Board, dnd, dock, When lens), D3c (Inbox triage, Views, Select mode, remove the triage stub).

## 2026-10-14: owner answers (session start)

- **Install fix APPROVED:** the worktree gets its own `node_modules`. Done: the Vite servers on :3100 and :3117 were stopped, only the junction was removed (the main checkout's `node_modules` is untouched), `pnpm install --frozen-lockfile` ran, and then `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` and `@use-gesture/react` were added (`cc6ef95`). The wouter patch is still applied.
- **Review #4 DECIDED:** recurring tasks anchored only on a deadline (no Plan-for date) are bucketed by their **next occurrence**, not "Past due" forever. The sidebar badge changes to match. Update the test that locked the old behaviour.
- **D3 assumptions CONFIRMED** (all three above): Status lens is the Board default with When one toggle away; Inbox "Someday" leaves the Inbox for No date with a Someday pill; desktop detail opens in a right-side panel.
- **Run mode:** the owner asked for autonomous loops through to the end of the plan (D3 → D3.5 → D3.5.2 → D4 → D5 → D6 → D7), with subagents and model routing. The owner tests the demo in parallel and reports issues. Gates G1/G3, Vercel checks, live DB writes and migrations stay closed.
- **Owner test report 1 (Dashboard demo):** the numbers roll and the animations run, but they are **far too fast**. Make them realistic, not too fast. **New motion direction (replaces "under ~300ms" for non-interaction motion):**
  - Interactions stay crisp: about 120–220ms.
  - Entrances are slower and visible: about 380–600ms, with a 60–90ms stagger.
  - Data motion (count-ups, ring fills, bars) is clearly visible: about 1.1–1.6s, on a gentler curve.
  - Reduced motion stays instant.
  - The hero colour drift was too subtle to notice. Make it clearly visible but calm.
  - **Opus (not Fable) does this retune.** Owner: "do not use FABLE for this". The stopped Fable agent's partial edits were reverted.
- **New standalone task "V: visual audit and redesign" (owner, later):** "lots of things need to be redesigned again and the UX and UI need big changes". A separate task where Fable 5.1 runs the visual checks, finds the problems, writes the plan and fixes them. Its timing within the run is for the owner to set.
- **Routing (owner):** "for IMP things and design UI UX dont use sonnet use opus". Opus takes every UI/UX review and screenshot check that used to go to sonnet. Fable 5.1 stays the designer and builder (assumption logged).
- **Owner test server:** a frozen source snapshot of the pushed commit runs on :3200 (job tmp folder, own Vite cache), so agent edits on :3100 don't reload the owner's page.

## 2026-10-16: owner decisions (UX restructure, Today)
- **Q14:** every Today row is tickable in place. Recurring = today's occurrence only; committed/carried = closes the plan record. Undo toast. No "Resolve in Plan/Recovery" copy on Today.
- **Q15:** Today shows only a compact "habits due" chip row. Heatmap, 7-day traces, streaks and history live in the Habits tab.
- **Q16:** "Shut down day" is a calm 3-step overlay (wins → open items → one-line reflection) with strictness. Close day needs an explicit decision per open item ("Move all to tomorrow" is one explicit tap). Items carried 3+ times must be scheduled, broken down or let go.
- **Process:** confirm with the owner before every Fable run (confirmation only).
- **Q17–Q49 (same day; the interview is complete):**
  - optional energy tap
  - **Calendar total redesign** (Week desktop / Day phone, 00–24 grid, Unscheduled tray, no Quarter/Year)
  - a lean **Week** page as one weekly ritual: Review → Objectives (1–3) → Place
  - **Goals** = Overview | Timeline (Roadmap merged)
  - Habits = a combined heatmap plus cards, no settings tab
  - **Insights** = Review + Analytics
  - rail: Dashboard · Today · Tasks · Calendar · Week | Goals · Habits · Insights | Settings
  - phone bar kept
  - palette search and one-page Settings
  - Dashboard is home everywhere
  - **Focus upgrades:** immersive mode, presets and breaks, Web Audio ambient sounds, session notes and stats
  - D4 §9 answered (the owner checks the timezone personally)
- **Tasks prototype v1 APPROVED** (2026-10-16).
- **Motion:** glassmorphism on floating layers only; framer-motion shared-element morphs (row→pane, +→capture, Focus→immersive, chip→ring); no neumorphism; an M2 motion pass after the build.
- **Q50 Integrations:** go straight to **Google Calendar OAuth** (two-way, near-real-time, Meet links). GATED: Google Cloud/OAuth app setup, env secrets, token storage (likely a migration) and live activation each need owner authorisation. Apple stays standards-based; Apple Reminders is impossible on the web.
- **Q51:** outside meetings show on Calendar, the Today timeline and the Next-up hero with Join, a 10-min push reminder, and they count in capacity; never in Tasks.
- Full log: `docs/superpowers/ux-restructure/03-interview-log.md` ("INTERVIEW COMPLETE" + "After the interview").

## 2026-10-15: owner decisions (UX restructure)

- **Routing (owner):** Fable 5.1 plans and designs. Opus builds both visuals and logic. Sonnet is for low-level mechanical work only. One subagent at a time (laptop RAM).
- **Total UX restructure, NOW (owner):** "the DASHBOARD looks great but not other pages". The app must become very premium, modern, classy and aesthetic, with motion, great icons and animations. This is a rethink of structure and purpose, not a reskin:
  - Tasks first: Board and drag, List, Inbox (what is it for?), Saved views, Archived.
  - Then most other pages.
  - Dashboard and Focus/timer are the bar and stay.
  - It runs before the D3b visuals, D3c, the D3.5 build and D4. Asked "now or after D3.5/D4", the owner chose now on my recommendation.
- **Process (owner):**
  1. **Opus** maps every page.
  2. **grill-me** interviews cover ALL pages, in big rounds.
  3. Prototypes go to the owner for approval before any build.
  4. Competitor references are in `Screenshots of competition/` (Asana, Sunsama, monday and others).
  5. Layout-independent logic (R3 drag, the D4 reason engine, the D3.5 hooks) is built in the interview gaps.
  6. R4 Board visuals and D3c are paused.

  Full detail: `docs/superpowers/ux-restructure/README.md`.
- **Working assumptions (owner to confirm):** the three owner questions in the D3.5 spec take their recommended answers ("New time block" for + on Calendar; Today swipes Yesterday/Today/Tomorrow only; a one-time migration of an exactly-default saved shortcut list).
