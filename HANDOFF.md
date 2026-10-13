# HANDOFF — premium redesign (updated 2026-10-13, D1 closed, D2 in progress)

Worktree: `.claude/worktrees/premium-redesign`, branch `work/premium-redesign`. Push with `git push origin HEAD:dev/personal-calendar-premium-v2` (never main, never force).
Owner rules: write a handoff and push after EVERY checkpoint, then keep going. Use subagents with routing (below). Tell the owner whenever Fable runs.
Gated (do not touch): G1 stakes, G2 hard reminders, G3 Google two-way sync, Vercel checks, live DB writes, schema migration.

## Status
- D0 tokens, motion and primitives: DONE (b0312c8). Spec `docs/superpowers/specs/2026-10-13-premium-redesign-d0-design.md`.
- D1 shell/nav: DONE locally. Spec `docs/superpowers/specs/2026-10-13-premium-redesign-d1-shell.md`. 808 tests, check and build pass.
- D1 browser harnesses re-run 2026-10-13: shell 16/16, plan 36/36, gallery 8/8, phase4 shell-navigation 2/2 (harness fixes only). D1 CLOSED.
- D2–D6: not started.

## Next: D2 Dashboard (home/overview)
1. Build the real Dashboard and make it the default landing (currently home/today; `defaultLocationTarget` in `client/src/lib/plannerLocation.ts`).
2. Header per v2.1 Main.png: eyebrow date, H1 ~32px/700, intention subline; Home tabs inline in the title row before Capture; no border-bottom.
3. Cards: Up next (fix the empty middle), Today progress ring, Week rhythm (fix the spare height), Roadmap strip, Habits, focus planned vs actual (from focus sessions; `timeChipState` in `client/src/design/timeFormat.ts`).
4. Motion: entrance on first mount only, hover lift only for `(hover:hover)`, pulse only on the now-line, ring and count-up ≤600ms, reduced motion respected.
5. Carried-over polish:
   - 390px Home tabs truncate ("Dashb…"); make them full width. The centre phone Capture looks washed out.
   - dark-mode active rail item and tab contrast
   - check that Onest renders (the harness may use a fallback font)
   - legacy green search-input surface on dark Tasks (do it with the D3 Tasks work)
Suggested subagents for D2: sonnet builds the card components (may edit, in its own files); opus reviews the data and projection logic; Fable is optional for the Dashboard composition review ("key moment"; tell the owner); sonnet does the screenshot review against Main.png/Dark.png/Phone.png.
After D2: D3 Tasks drag (@dnd-kit approved), D4 "why it matters", D5 Analytics, D6 polish (extra palette slots, swatch-only category editor, lower the legacy-green baselines in `client/src/design/legacyGreen.test.ts`).

## Where things live
- Tokens and primitives: `client/src/design/` (tokens-v2.css, primitives.css, categoryTone.ts, timeFormat.ts) and `client/src/components/premium/` (Pills, SegmentedTabs). There is also a dev-only `/premium-gallery`.
- Shell: `client/src/features/shell/`:
  - premiumNavigation.ts (model + badges)
  - PlannerRail.tsx
  - CommandPalette.tsx
  - PhoneNavigation.tsx
  - PlannerShell.tsx
  - premium-shell.css
- Home wiring: `client/src/pages/Home.tsx`, around lines 8383–8420 (palette, badges) and the `viewNavigation` SegmentedTabs.
- Harnesses: `scripts/preview-premium-{shell,plan,gallery}.py`. Captures go to %TEMP%, never into the repo.

## Subagent routing (owner instruction)
- haiku: mechanical edits and greps.
- sonnet: ordinary UI work and screenshot/visual review.
- opus: architecture, risky changes, independent code review.
- fable: key design moments only. Always tell the owner when it runs. Used once (D0 spec review).
Give each subagent an objective, scope, file paths, expected output (≤450 words, prioritised), and an explicit read-only or may-edit statement. Verify their claims before applying.
D1 history: sonnet compared the shell screenshots with the v2.1 boards (12 findings), and opus reviewed the D1 diff (10 findings). Both are applied except the deferred items in the D1 spec.

## Gotchas
- Never commit `v2-preview/` PNGs. `tmp/` is gitignored (debug scripts).
- Never use bare `git stash`.
- The worktree guard rejects `$CLAUDE_JOB_DIR` paths and long chained heredocs, so split commands.
- cmdk item `value`s must be static strings.
- `useTheme` in Home's main component is its own call.
- Memory can run low: the host may kill the background Vite server. Restart it only when you need the harnesses.
- Agent-memory store: `node scripts/agent-memory.mjs` (session 03532cfd-2fbd-4d3b-b503-ca234a6f349c). Add a checkpoint event when you can.
