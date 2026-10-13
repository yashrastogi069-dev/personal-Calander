# Handoff: premium redesign (2026-10-13)

Read this first in a fresh session, then `RUN_STATE.md`, `AGENTS.md`, `docs/INDEPENDENT_STACK_HANDOFF.md`. Do not bulk-read all docs.

## Goal

Redesign the Personal Calander app (dashboard + every screen) to match and exceed `BEST Shots/` and the competitor screenshots in `Screenshots of competition/` (Morgen, Sunsama, Asana, Monday).

- Keep the white/blue identity and real data only.
- Owner direction: keep adding features and keep making it more modern, futuristic and animated. Motion should be rich but calm, and must honour reduced motion.
- Work in steps D0–D6. Update the docs after each step.
- Model routing:
  - haiku: mechanical work
  - sonnet: ordinary UI and visual review
  - opus: architecture and risky work
  - fable: key design moments, only with the owner's OK. It is already approved for the D0 spec; still tell the owner when it is used.

## Done so far

- **C3 Plan Studio** (weekly board, date continuity) is committed as `8a242e6` and its evidence as `780f094`; both are pushed to `dev/personal-calendar-premium-v2`.
  - Code: `client/src/lib/planBoard.ts` (`restorePlanDate`), `client/src/pages/Home.tsx`, the PlanWeekBoard component, `plan-week.css`, and safe storage in `PwaContext`.
  - Verified: build passes, 754 tests pass, preview harness 36/36.
- **Redesign programme approved** (`4804e95`):
  - Order: D0 tokens/motion → D1 shell/nav → D2 Dashboard → D3 Tasks drag → D4 "why it matters" → D5 Analytics → D6 polish.
  - G1 stakes, G2 hard reminders and G3 Google two-way sync stay gated.
  - Also approved: @dnd-kit, the pill radius, and Fable for the D0 spec.
- **v2.1 visual preview** approved by the owner on 2026-10-13. It is the D0 target look.
  - Private Design canvas: https://claude.ai/artifact/92uiB3ukGHrDcPqp9Q1SUo (version 4, 13 boards).
  - PNGs: `C:\Users\win 10\Desktop\personal-Calander\v2-preview\v2.1\` (untracked, never commit).
  - Generator: `tmp/v2gen/gen.py` writes `tmp/dash-canvas/project/*.dc.html` plus `canvas.json`. `tmp/v2gen/shoot.py` renders the PNGs. `tmp/` is gitignored. Run with:
    - `python tmp/v2gen/gen.py tmp/dash-canvas <standalone-dir>`
    - `python tmp/v2gen/shoot.py <standalone-dir> <png-dir>`
  - Republish with Artifact: `url` set to the canvas link, `root: "tmp/dash-canvas"`, `file_path` set to the absolute path of `tmp/dash-canvas/project/canvas.json`, and `files` mapping each `project/X.dc.html` to itself.
- **Run log and checkpoints:** `RUN_STATE.md`, commits `8c1591e` and `932b094`. These are not pushed.

## Current state

- Branch `work/premium-redesign` in worktree `.claude/worktrees/premium-redesign`.
  - Local commits `4804e95`, `8c1591e`, `932b094` (and this handoff, if committed) are ahead of `dev/personal-calendar-premium-v2`.
- **D0 has not started.** No app code has changed since C3.
- The Vite dev server may still be running on port 3100 from the old session. Restart it if needed: `npx vite --port 3100 --strictPort --host 127.0.0.1`.

## Decisions and why

- **Home tabs: Dashboard | Today | Calendar.** The owner asked for a calendar next to Dashboard and Today. Phone bottom nav is Home / Today / + / Calendar / More.
- **Category palette.** Checked with the dataviz `validate_palette.js`, so colour-blind users can tell the categories apart.

  | Category | Light (on #ffffff) | Dark (on #19273a) |
  |---|---|---|
  | Work | #2f6fe4 | #5b8ef0 |
  | Health | #0f9d8a | #26a089 |
  | Learning | #c27612 | #c4852f |
  | Personal | #7a5af0 | #9479ee |
  | Social | #e0567a | #dc5f80 |

  Always pair a colour with a label or dot, because tritan separation is low.
- **Base tokens:**
  - Accent #1459de, ink #14233c, Onest font.
  - Radius: chip 8, control 12, panel 16, feature 24, pill 999.
  - Elevation e1–e3.
  - Easing `cubic-bezier(.23,1,.32,1)`; data easing `(.16,1,.3,1)`; UI motion ≤300ms.
- **Components taken from competitors:**
  - Status pills (On track / At risk / Off track)
  - Planned/actual time chips
  - Focus bar stacked by category
  - Google events as hatched "busy" blocks
  - Pulsing now-line
  - Today: task list beside a timeline, with an after-shutdown zone
  - Calendar week: rail with mini month, unscheduled Overdue / Due today / Due this week, and calendar toggles; all-day multi-day bars
  - Calendar month: spanning bars
- **Earlier owner decisions:**
  - Roadmap lives in Plan and in Goals & Projects, plus a compact strip on Home.
  - Today drops the weekly overview and links to the week instead.
  - Insights becomes Analytics under Reflect.
  - The grey backdrop is used on Dashboard only.
  - These are not yet recorded in `docs/DECISIONS.md`. Do that in D0.

## Open problems

- **Preview issues:**
  - The phone segmented tabs overflow slightly at 390px.
  - The dashboard Up-next card has an empty middle.
  - The Week rhythm card has spare height.
- **Missing docs:** the D0 spec doc does not exist yet. DECISIONS.md, PRODUCT_SPEC.md and PHASE4_SLICE_EVIDENCE.md have not been updated for the redesign decisions.
- **Data gaps:** the "Actual time", category, and "why it matters" fields need real data sources. Check what the existing schema has. **No schema migration** without its gate. If a field has no real source, hide that UI.

## Next steps (in order)

1. Run `node scripts/agent-memory.mjs session list` and search for redesign context. Read `RUN_STATE.md`.
2. Write `docs/superpowers/specs/2026-10-13-premium-redesign-d0-design.md`: tokens, palette, components and motion from the v2.1 boards. Use Fable for the spec review (pre-approved) and tell the owner.
3. Record the decisions above in `docs/DECISIONS.md`. Update `docs/PROJECT_STATE.md` and `RUN_STATE.md`.
4. Implement D0 in the client:
   - CSS tokens v2 (light and dark) plus the category tokens
   - Motion tokens and reduced-motion handling
   - Primitives: pill, status pill, time chip, category chip, segmented tabs
   - Quarantine the legacy green CSS
5. Verify (see below). Commit. Push to `dev/personal-calendar-premium-v2` only (never main, never force-push). Do not check Vercel.
6. Continue with D1 (shell, sidebar, tabs, ⌘K, phone nav), then D2 (Dashboard home), and so on. Write a checkpoint plus a handoff after each step.

## How to verify

- `npm run build` passes and `npm test` passes; C3 had 754 tests pass and the count should not drop. Run the preview harness (36/36 at C3).
- Take light and dark screenshots of the changed screens at 1440px and 390px with the local dev server. Compare them against `v2-preview/v2.1/*.png`.
- Check reduced motion (emulate `prefers-reduced-motion`). Check contrast (body text ≥4.5:1).
- Re-run `validate_palette.js` if any category colour changes.
- Do not claim a Preview, migration or iPhone pass without direct evidence. Never write to the live database.

## Session rules for continuation

- At about 30% context, or at the end of any step or checkpoint: update `RUN_STATE.md` and this file, commit, tell the owner, then stop.
- During a long continuous task, rely on auto-compact, then write the handoff and stop at the next checkpoint.
