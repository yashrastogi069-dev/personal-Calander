# Handoff: premium redesign (2026-10-13, after D0)

Read this first in a fresh session, then `RUN_STATE.md`, `AGENTS.md`, `docs/INDEPENDENT_STACK_HANDOFF.md`. Do not bulk-read all docs.

## Goal

Redesign Personal Calander (dashboard + every screen) to match and exceed `BEST Shots/` and the competitor shots (Morgen, Sunsama, Asana, Monday). Keep the white/blue identity and real data only. Owner direction: keep adding features and keep making it more modern and animated; motion is rich but calm and honours reduced motion. Steps D0–D6.

**Working rule (owner, 2026-10-13):** after every checkpoint, update this file and `RUN_STATE.md`, commit, push to `dev/personal-calendar-premium-v2` (`git push origin HEAD:dev/personal-calendar-premium-v2`; never main, never force), post a short note, then **continue to the next step without stopping**. Always tell the owner when Fable runs.

Model routing: haiku for mechanical work, sonnet for ordinary UI and visual review, opus for architecture and risky work, fable for key design moments (tell the owner).

## Done so far

- C3 Plan Studio (`8a242e6`, `780f094`).
- Redesign programme and v2.1 look approved (canvas https://claude.ai/artifact/92uiB3ukGHrDcPqp9Q1SUo v4; PNGs `..\..\..\v2-preview\v2.1\`, untracked; generator `tmp/v2gen/`).
- **D0 done (2026-10-13).**
  - Spec: `docs/superpowers/specs/2026-10-13-premium-redesign-d0-design.md`. Fable reviewed it, and the end of the spec lists what was adopted and what was deferred.
  - Tokens: `client/src/design/tokens-v2.css`, all `--pc-*`: page/card/line/track/hero/night, elevation e1–e3, radius, category and status palette, typography, spacing, z, focus, motion, plus `.pc-rise/.pc-pop/.pc-grow-x/.pc-grow-y/.pc-pulse` and the reduced-motion rule.
  - Primitives: `client/src/design/primitives.css` plus `client/src/components/premium/Pills.tsx` (Pill, StatusPill, TimeChip, CategoryChip) and `SegmentedTabs.tsx` (Radix tabs with a framer `layoutId` indicator).
  - Logic: `categoryTone.ts` (snaps the stored colour by hue; `resolveCategoryTones` deduplicates slots) and `timeFormat.ts`.
  - Wiring: `<MotionConfig reducedMotion="user">` in `App.tsx`. Tailwind `--color-pc-*`, `--radius-pc-*`, `--shadow-pc-*` in `index.css` `@theme`.
  - Quarantine: `client/src/design/legacyGreen.test.ts` sets per-file baselines; lower them when a screen drops green.
  - Dev-only `/premium-gallery` route (`pages/PremiumGallery.tsx`) plus `scripts/preview-premium-gallery.py`.
  - Docs: DESIGN.md (v2 palette/radius/motion), DECISIONS.md, PROJECT_STATE.md, PHASE4_SLICE_EVIDENCE.md.

## Current state

- Branch `work/premium-redesign` in worktree `.claude/worktrees/premium-redesign`, pushed to `dev/personal-calendar-premium-v2` at the D0 commit.
- The Vite dev server may be running on 3100 from this worktree. Otherwise: `npx vite --port 3100 --strictPort --host 127.0.0.1`.
- No screen uses the primitives yet. D1 is the first consumer.

## Decisions and why

- All of them are in `docs/DECISIONS.md` (2026-10-13 section) and the D0 spec. Key points:
  - Category colours are snapped to 5 validated slots and always shown with a label.
  - Card tokens alias the existing surfaces (dark card `#19273a` keeps the validated contrast).
  - 12px is the text floor.
  - Tabs are 44px on coarse pointers.
  - Green CSS is ratcheted, not deleted.

## Open problems

- Deferred from Fable:
  - D2: entrance animation only on first mount; hover lift only on `hover:hover`; pulse on the now-line only.
  - D1: backdrop per layout.
  - D6: extra palette slots and a swatch-only category editor.
- Preview issues still to fix in D2: the dashboard Up-next card has an empty middle, and the Week rhythm card has spare height.
- Data: planned time = `tasks.estimateMinutes`; actual time = focus sessions (needs a projection in D2); "why it matters" (D4) must come from existing goal/project links. No schema migration.

## Next steps (in order)

1. `node scripts/agent-memory.mjs session list`; read `RUN_STATE.md`.
2. **D1 shell/nav**:
   - Read `client/src/features/shell/planner-shell.css`, `approved-workspace.css` and the shell part of `client/src/pages/Home.tsx` (find `planner-rail`, `planner-nav`, `mobile-planner-nav`).
   - Build the grouped sidebar with badges (Plan / Do / Reflect groups as in the v2.1 boards).
   - Add the Home view tabs Dashboard | Today | Calendar using `SegmentedTabs`.
   - Add ⌘K prefixes if a command palette exists.
   - Phone bottom nav: Home / Today / + / Calendar / More.
   - Decide the backdrop per layout.
   - Remove green rules from the rebuilt shell and lower the baselines.
   - Fable is optional for the D1 IA review; tell the owner if used.
3. Verify, write the checkpoint (this file + RUN_STATE), commit, push, continue to D2 (Dashboard home).

## How to verify

- `npm run check`, `npm test` (≥800 passed), `npm run build`.
- `python scripts/preview-premium-plan.py` (36/36) and `python scripts/preview-premium-gallery.py` (8/8) against Vite on 3100.
- Screenshots of changed screens at 1440 and 390, light and dark, compared with `v2-preview/v2.1/*.png`. Also check reduced motion and contrast.
- Never claim Preview, migration or iPhone passes without direct evidence. Never write to live data.
