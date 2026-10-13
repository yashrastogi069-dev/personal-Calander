# HANDOFF — premium redesign (updated 2026-10-13, mid-D1, usage limit hit)

Worktree: `.claude/worktrees/premium-redesign`, branch `work/premium-redesign`. Push with `git push origin HEAD:dev/personal-calendar-premium-v2` (never main, never force).
Owner rules: write a handoff and push after EVERY checkpoint, then keep going. Use subagents with routing (below). Tell the owner whenever Fable runs.
Gated (do not touch): G1 stakes, G2 hard reminders, G3 Google two-way sync, Vercel checks, live DB writes, schema migration.

## Status
- D0 tokens, motion and primitives: DONE (commit b0312c8). See `docs/superpowers/specs/2026-10-13-premium-redesign-d0-design.md`.
- D1 shell/nav: CODE WRITTEN, committed as a WIP checkpoint. NOT complete. Remaining work is below.
- D2–D6: not started.

## D1: what exists (all under client/src/features/shell unless noted)
- `premiumNavigation.ts`: grouped nav model (main: Dashboard/Today/Inbox; Plan: Tasks/Plan/Calendar/Roadmap; Grow: Goals & Projects/Habits/Focus; Reflect: Review/Analytics; More: Goals/Connections/Categories & Recycle Bin). Also `activeNavState`, `homeTabs`, `navBadgeCounts`, `badgeText`.
- `PlannerRail.tsx`: grouped rail, badges, "Search or jump ⌘K" button. `CommandPalette.tsx`: cmdk palette, Ctrl/⌘K, `>` actions, `#` tasks.
- `PhoneNavigation.tsx`: centre Capture button (`.pc-phone-capture`). `PlannerShell.tsx`: `pc-shell` class, `data-backdrop="page"` on home/overview only.
- `premium-shell.css`: all D1 styling.
- `client/src/pages/Home.tsx`: palette wiring, navBadges, Home SegmentedTabs (Dashboard | Today | Calendar).
- `shared/phase4Navigation.ts`: Insights is now labelled "Analytics".
- Tests: `PlannerShell.test.tsx` and `premiumNavigation.test.ts` (24/24 pass). Harness: `python scripts/preview-premium-shell.py`, 16/16 pass. Needs Vite on 127.0.0.1:3100: `npx vite --port 3100 --strictPort --host 127.0.0.1`.

## D1: remaining to-do (in order)
1. FIX 2 failing tests in `server/phase4Shell.test.ts` (full suite: 806 pass, 2 fail):
   - "keeps every legacy child view and Categories utility reachable" deep-equals the `shellSecondaryTargets` labels. The Insights→Analytics rename changed them; update the expected label.
   - "renders six grouped desktop destinations…" expects the text `Projects &amp; Goals`. The rail now says `Goals &amp; Projects` and uses new groups. Update the assertions to the new grouped rail (intended semantic change). Do not weaken coverage of reachability.
2. Apply the visual review fixes from sonnet (high priority first):
   - Phone: content needs bottom padding (pill height + safe-area + 16px) so the pill doesn't cover it.
   - Phone pill labels clip. Consider the v2.1 Phone.png set: Home | Today | (+) | Calendar | More (the owner's preferences currently drive the primaries; decide whether to change the defaults).
   - 390px Home tabs truncate ("Dashbo…"). Make `.pc-home-tabs` full width with equal segments, and hide or shrink the Today badge on phone.
   - 1440: "Search or jump" wraps. Add nowrap and ellipsis on the span (the rail measured ~215px wide; check the legacy grid width overriding 248px).
   - Desktop header: v2.1 Main.png puts the Home tabs inline in the title row before Capture. Ours sits on its own row. Do this in D2 with the Dashboard header.
   - Rail collapse button is half-clipped at x≈210. Heading spacing is tight: margin-top ~20px.
   - Dark tasks-list search input has a legacy green surface (~#0d1a12). Bind it to tokens.
   - Dark-mode active rail item and active tab contrast is low.
   - Font may render as the system fallback in the harness. Check that Onest loads.
3. The opus code review FINISHED (do not re-run). Hook order in Home.tsx is OK. Fix these, most severe first:
   a. phase4Shell.test.ts, the 2 failures in step 1. Also `scripts/preview-phase4-product.py:322` clicks "Insights", and its `click_destination` loop needs Goals, Connections and Categories visible, but they now sit inside a closed `<details>`. Update that harness.
   b. `npm run check` FAILS: PlannerShell.test.tsx:35 `[...nav.matchAll()]` gives TS2802. Use `Array.from(nav.matchAll(...))`.
   c. Home SegmentedTabs uses `activationMode="automatic"`, so arrow keys navigate and push history (arrowing to Calendar leaves Home). The triggers' aria-controls point at missing panels, and Calendar is duplicated with "Planning views". Fix: `activationMode="manual"`, or render as nav buttons with aria-current.
   d. ⌘K listener (CommandPalette.tsx:34-40) has no guards. Skip when `e.isComposing` is set, when another `[role=dialog]` is open, or while the snapshot is still loading (the palette pops up later). Follow `plannerShortcutCommand`.
   e. `searchFromPalette` (Home ~8406) uses replaceState to put `q` on the current entry before pushing. Do one merged location `{home, search, action:"search", query}` and push once.
   f. `openPaletteTask` (~8400): first set `searchReturnTargetRef` and `searchRecordFocusRef` to null (otherwise close returns to Search, and Board users get switched to List).
   g. At 681–1060px the rail buttons have no accessible names (the spans are hidden, and aria-label is only set when the collapsed preference is on). Always set aria-label, including the badge text.
   h. Today "N left" overcounts: flexible includes carried_commitment duplicates (todayProjection.ts:320-323). Count unique open-task recordIds.
   i. Phone Capture is off-centre (inserted at ceil(n/2)-1, with More appended). Centre by total slots and update the test order. Preference changes remount the buttons.
   j. Low: the rail Focus item should call `setFocusEntryTaskId(null)`. Remove the unused `phase4Destinations` import in PlannerRail.tsx.
   Confirmed OK: the inbox badge matches `inboxTasks()`; no URL or preference schema change; aria-current is unique.
4. Run `npm test`, `npm run check`, `npm run build`, `python scripts/preview-premium-plan.py` (expect 36/36), `scripts/preview-premium-gallery.py` (8/8) and `scripts/preview-premium-shell.py` (16/16).
5. Write `docs/superpowers/specs/2026-10-13-premium-redesign-d1-shell.md`; premiumNavigation.ts already references it. Then add D1 entries to `docs/DECISIONS.md`:
   - Dashboard-only backdrop
   - Insights → Analytics
   - rail groups
   - palette prefixes `>` and `#`
   - default landing stays home/today until D2
   Also update `docs/PHASE4_SLICE_EVIDENCE.md`, `docs/PROJECT_STATE.md` and RUN_STATE.md (mark D1 done), and this file.
6. Commit with "feat(design): premium redesign D1 shell…", push, and append an agent-memory event (`node scripts/agent-memory.mjs`, session 03532cfd-2fbd-4d3b-b503-ca234a6f349c).

## Next: D2 Dashboard (home/overview)
- Real Dashboard. Make it the default landing.
- Planned vs actual time from focus sessions.
- Header with the tabs inline.
- Motion: first-mount-only entrance, hover lift only for hover:hover, pulse only on the now-line, ring/count-up ≤600ms.
- Fix the v2.1 notes: Up-next card's empty middle and the Week rhythm card's spare height.
Then D3 Tasks drag (@dnd-kit approved), D4 "why it matters", D5 Analytics, D6 polish (extra palette slots, swatch-only category editor, lower the legacy-green baselines in `client/src/design/legacyGreen.test.ts`).

## Subagent routing (owner instruction)
- haiku: mechanical edits and greps.
- sonnet: ordinary UI work and screenshot/visual review. D1 used sonnet to compare `%TEMP%\premium-shell\shell-*.png` against `v2-preview\v2.1\*.png`.
- opus: architecture, risky changes, independent code review (D1 review done; findings in step 3).
- fable: key design moments only. Always tell the owner when it runs. Used once for the D0 spec review.
Give each subagent: an objective, scope, file paths, expected output (≤450 words, prioritised), and an explicit read-only or may-edit statement.

## Gotchas
- Never commit `v2-preview/` PNGs. `tmp/` is gitignored and holds the debug scripts pal.py, kbd.py and greens.py. Keep screenshots in %TEMP%.
- Never use bare `git stash`. The worktree guard rejects `$CLAUDE_JOB_DIR` paths and long chained heredocs, so split commands.
- cmdk item `value`s must be static strings (including the query in them made everything match).
- The `useTheme` used in Home.tsx's main component is its own call (line ~6547 belongs to another component).
