# HANDOFF: premium redesign (updated 2026-10-13, D2 Dashboard plus delight pass, local)

Worktree: `.claude/worktrees/premium-redesign`, branch `work/premium-redesign`. Push with `git push origin HEAD:dev/personal-calendar-premium-v2`. Never push to main; never force-push.

## Owner rules (standing, read every session)
1. **Checkpoints:** after every checkpoint, update HANDOFF.md and RUN_STATE.md (plus MEMORY.md and docs as needed), commit, push, then keep going.
2. **Subagents:** use them wherever they help, with the routing table below. Opus does UI/UX (after loading the design skills) and all logic. Tell the owner whenever Fable runs.
3. **Design direction:** cool, futuristic icons, animations and motion, and a modern UI on every screen. The full rule is in `CLAUDE.md` under "Design direction". In short:
   - expressive labelled icons in tinted tiles
   - plenty of state-driven motion (count-ups, fills, staggered entry, glides, spring check-offs, hover lift and press scale), under ~300ms with ease-out
   - reuse `client/src/design/motion.ts` and the tokens in `tokens-v2.css`
   - push the v2.1 look further each slice
   - always honour reduced motion
   - real data only
   The D2 delight pass is the bar to meet or beat.
4. **Ask first:** before a new dependency, a gated item or using Fable outside key moments. Never merge to or push to main; never force-push.

Gated, do not touch: G1 stakes, G2 hard reminders, G3 Google two-way sync, Vercel checks, live DB writes, schema migration.

## Status
- **D0** (tokens, motion, primitives): DONE (b0312c8).
- **D1** (shell and navigation): DONE (c092b82, f9fcdb5).
- **D2** (Dashboard home): built locally.
  - Spec: `docs/superpowers/specs/2026-10-13-premium-redesign-d2-dashboard.md`. Decisions are in `docs/DECISIONS.md`, evidence in `docs/PHASE4_SLICE_EVIDENCE.md`.
  - The default landing is now home/overview (the Dashboard). The legacy "planner at a glance" list is gone; its weekly-objectives, saved-reviews and goals routes survive as quiet links.
  - Logic is in `client/src/features/dashboard/dashboardModel.ts`, a pure projection over the saved snapshot, wired in Home.tsx (`dashboardModel` useMemo).
  - UI is in `DashboardView.tsx` and `dashboard.css` (built by opus with the impeccable, design-taste-frontend and emilkowal-animations skills).
  - An independent opus review found 7 medium and 6 low issues. All medium ones are fixed and tested; the accepted low ones are listed under "Known limits" in the spec.
- **Delight pass** (owner ask: "cool icons, animations, motions"), by opus with the design skills loaded:
  - Card-header icon tiles.
  - Hero colour drift, plus a ring glow and drawn check when everything is done.
  - Rolling counts.
  - Habit check-in tick with a spring, a burst and a streak flame.
  - A live dot only for a "now" item.
  - Sidebar and phone-bar glide highlights, with the active icon popping.
  - Capture "+" turns to "×" on press.
  - The palette opens with a blur.
  - New `client/src/design/motion.ts`, with tests.
  - Reduced motion turns all of it off; a test checks that every infinite loop has an opt-out.
- **Final verification (after the delight pass and the test fix)** (details in the evidence doc):
  - Typecheck is clean; the build passes.
  - Full suite: 122 files, 859 passed, 3 skipped, 0 failed.
  - Harnesses on http://127.0.0.1:3100: shell 20/20, plan 36/36, gallery 8/8, phase4 2/2. C2 222/224: 2 load timeouts, and their targeted re-run passed 56/56.
  - Pushed as `d3b25da` to `dev/personal-calendar-premium-v2`.
  - Agent-memory checkpoint recorded.

## Next
1. D3: Tasks board drag (@dnd-kit approved). Build it to the design-direction rule:
   - drag lift and shadow
   - spring drop
   - lane highlight on hover
   - column count roll
   - labelled lucide icons
   - reduced-motion fallbacks
2. Update or retire the stale `preview-task15.py` and `preview-linked-planner.py`.
3. Then D4 (why it matters), D5 (light Analytics) and D6 (polish and first-run states), each with its own checkpoint, handoff and push.

## Owner checks in progress (2026-10-13)
- The owner checks the Vercel Preview and the animations themselves, using `docs/OWNER_PREVIEW_CHECKLIST.md`.
  - Preview for `1acc7ec` (Vercel: success): https://personal-calander-6wkxtwevp-yashnew869-2746s-projects.vercel.app
  - Agents still do not run Vercel checks. Wait for the owner's report and fix whatever they find before D3 polish.

## Open owner questions
- **Phone primary shortcut defaults:** they are still Today, Tasks and Daily plan; v2.1 shows Home, Today and Calendar. Defaults live in `shared/phase4Preferences.ts` (`phase4DefaultPreferences.primary`) and only apply when an account has no saved shortcut list, so a saved custom list is never overwritten. On phone, the "Home" target still opens Today.
- **Phone navigation concept (owner asked for designer thinking, 2026-10-13).** Options put to the owner:
  - (a) A v2.1 floating glass bar (Home / Today / + / Calendar / More) that shrinks on scroll and shows a context-aware "+".
  - (b) The same bar plus iPhone gestures:
    - swipe a task row to complete or reschedule
    - swipe days in Today/Calendar
    - long-press tabs and "+" for quick actions
    - tap the active tab to scroll to the top
    - swipe up on the bar for More
  - (c) A left drawer on phone. Not recommended: the hamburger hides navigation and the top-left is out of thumb reach on large iPhones. Keep the left sidebar for iPad and desktop.
  - iPhone Safari has no Vibration API, so web haptics are not available.
  - Record the answers in DECISIONS.md and here.
- **Fable composition review of the Dashboard:** optional, and needs the owner's OK.

## Known risks and limits
- **Habit start date:** `shared/habitSchedule.ts` uses the UTC date of `createdAt`. East of UTC, a new daily habit can show one false "missed" day. This is pre-existing and shared with Today and Habits, so it's deferred.
- **Glide animations:** the sidebar and Home-tab glides only animate if Home keeps the shell mounted across navigation; otherwise they snap. Not yet checked in motion; screenshots only show the end states.
- **Habit burst:** may be slightly cut off inside the phone habit scroller.
- **Stale legacy harnesses, not D2 regressions:**
  - `preview-task15.py` clicks `.plan-stage-nav` on phones, but C3 replaced it with `.plan-mobile-stepper`.
  - `preview-linked-planner.py` expects a rail "Settings" button, which has been "Open account settings" since the Phase 4 shell.
  - Update or retire both.
- **Flaky first run:** one earlier full-suite run had 2 errors that didn't recur on two re-runs; they look load-related.
- **Not verified:** no Vercel Preview, live data or physical iPhone checks.

## Where things live
- **Dashboard:** `client/src/features/dashboard/`:
  - dashboardTypes.ts
  - dashboardModel.ts plus its test
  - DashboardView.tsx plus its test
  - dashboard.css
  - dashboardFixture.ts
  - useMinuteNow.ts
- **Tokens, primitives, motion:** `client/src/design/` (tokens-v2.css, motion.ts, categoryTone.ts, timeFormat.ts) and `client/src/components/premium/` (Pills, SegmentedTabs).
- **Shell:** `client/src/features/shell/` (premiumNavigation.ts, PlannerRail.tsx, CommandPalette.tsx, PhoneNavigation.tsx, PlannerShell.tsx with eyebrow, subtitle, titleContext and tabsInHeader, premium-shell.css).
- **Home wiring:** `client/src/pages/Home.tsx`:
  - the `todayProjectionInput` and `todayProjection` memos
  - the `dashboardModel` memo, which stamps pending completions
  - the `<DashboardView>` actions
- **Harnesses:** `scripts/preview-premium-{shell,plan,gallery}.py`, `preview-c2-connected.py`, `preview-phase4-product.py`. Captures go to %TEMP%, never into the repo.
- **Local look with synthetic data:** `python scripts/open-local-preview.py`.

## Subagent routing (owner instruction, updated 2026-10-13)
- **haiku:** mechanical edits and greps.
- **sonnet:** read-only exploration and routine screenshot checks.
- **opus:** all UI/UX design and building (load `impeccable:impeccable`, `design-taste-frontend` and `emilkowal-animations` first), all logic, and independent review.
- **fable:** key design moments only; always tell the owner. Used once so far, for the D0 spec review.
- Give every subagent an objective, scope, file paths, a ≤450-word output and an explicit read-only or may-edit statement. Parallel editors must own separate files. Verify their claims before you accept them: the delight pass missed `server/phase4Shell.test.ts`, so always run the FULL suite.

## Gotchas
- **Never commit:** `v2-preview/` PNGs. `tmp/` is gitignored and holds the patch scripts.
- **Never use:** bare `git stash`.
- **Worktree guard:** it rejects heredocs, loops with variables and `$TEMP` and `$CLAUDE_JOB_DIR` expansions. Use Write/Edit or node scripts in `tmp/`.
- **Stray servers:**
  - A Vite on :3117 was left by the first UI agent; stopping it was blocked by permissions.
  - A full `npm run dev` server on :3000 was started at 13:33 from a cmd window outside this session (possibly the owner's). Leave it alone.
- **Agent memory:** `node scripts/agent-memory.mjs`, session 03532cfd-2fbd-4d3b-b503-ca234a6f349c.
