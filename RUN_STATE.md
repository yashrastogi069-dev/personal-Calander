# Run state: premium BEST Shots redesign

Owner goal (2026-10-13): finish Plan Studio, then redesign Dashboard and every screen to match and exceed `BEST Shots/` with rich-but-calm motion, keeping the white/blue identity and real data only. Work continuously: after every checkpoint, write HANDOFF.md + this file, commit, push to `dev/personal-calendar-premium-v2`, then continue to the next step (owner 2026-10-13). Ask before a new dependency, a gate, or Fable outside pre-approved moments; always tell the owner when Fable runs.

Branch: `work/premium-redesign` (worktree `.claude/worktrees/premium-redesign`), pushed to `dev/personal-calendar-premium-v2` after verification. Never main. No Vercel checks, live writes or migrations.

Model routing: haiku = mechanical edits/greps; sonnet = ordinary UI work, screenshot review; opus = architecture, risky integration, independent review; fable = key design decisions, only with owner OK each time.

## Steps

| # | Step | Status |
|---|---|---|
| C3 | Plan Studio weekly board + date continuity | Done locally, `8a242e6`; build + 754 tests + harness 36/36 |
| A | Owner approval of redesign sequence (D0-D6, G1-G3) | Approved 2026-10-13 (also @dnd-kit, pill radius, Fable for D0 spec) |
| D0 | Tokens v2, motion, primitives, legacy-green ratchet | Done 2026-10-13: 800 tests, build, Plan harness 36/36, gallery harness 8/8; pushed |
| D1 | Routed shell, grouped sidebar with badges, view tabs, command palette prefixes, phone pill nav | Not started |
| D2 | Dashboard home + one-click Today switch, Schedule card lens | Not started |
| D3 | Tasks board drag (needs @dnd-kit approval) | Not started |
| D4 | "Why it matters" reasons from existing facts | Not started |
| D5 | Light Analytics | Not started |
| D6 | Polish, empty/first-run states | Not started |
| G1-G3 | Stakes fields, hard reminders, two-way Google sync | Gated |

## Handoff (2026-10-13, context checkpoint; owner asked to stop at ~25% context)

- v2.1 preview published as version 4 of the same private canvas https://claude.ai/artifact/92uiB3ukGHrDcPqp9Q1SUo. It has 13 boards: Dashboard / Today / Calendar week / Calendar month, each in light and dark, plus phone Dashboard / Today / Calendar (light and dark).
- PNGs are in `v2-preview/v2.1/` (untracked, do not commit).
- Generator: `tmp/v2gen/gen.py <canvas root> <standalone dir>` writes `tmp/dash-canvas/project/*.dc.html` plus `canvas.json`. Then `tmp/v2gen/shoot.py <standalone dir> <png dir>` renders the PNGs. `tmp/` is gitignored.
- Republish with `root: "tmp/dash-canvas"`, `file_path` set to the absolute path of `canvas.json`, and `files` mapping each `project/X.dc.html` to itself.
- v2.1 adds:
  - A header tablist: Dashboard | Today | Calendar.
  - Validated category palette (Work #2f6fe4, Health #0f9d8a, Learning #c27612, Personal #7a5af0, Social #e0567a; dark #5b8ef0 / #26a089 / #c4852f / #9479ee / #dc5f80), always shown with labels.
  - Status pills (On track / At risk / Off track), planned/actual chips, a stacked focus bar by category, Google busy blocks with hatching, and a pulsing now-line.
  - Today: task list with a timeline and an after-shutdown zone.
  - Calendar week: rail with mini month, unscheduled Overdue / Due today / Due this week, and calendar toggles; all-day multi-day bars.
  - Calendar month: spanning bars.
  - Phone Calendar: week strip with coloured dots. Phone bottom nav now Home / Today / + / Calendar / More.
- Next steps:
  1. Get owner feedback on v2.1.
  2. Optionally run a Fable critique (ask first).
  3. On approval, write the D0 spec `docs/superpowers/specs/2026-10-13-premium-redesign-d0-design.md`, record the decisions in DECISIONS.md, then implement D0.
- Known minor issues:
  - The phone segmented tabs slightly overflow at 390px.
  - The dashboard Up-next card has an empty middle.
  - The Week rhythm card has spare height.
- Not pushed: `4804e95` and this checkpoint commit.
- **2026-10-13 owner APPROVED v2.1 and the plan.** This supersedes the "waiting on D0 approval" note below. Owner direction: keep adding features and make the app progressively more modern and futuristic, with more animation and motion. Reduced motion must still be honoured.
- **Next session starts D0:**
  - Write `docs/superpowers/specs/2026-10-13-premium-redesign-d0-design.md` from the v2.1 boards. Fable is pre-approved for the D0 spec; still tell the owner when it is used.
  - Record the decisions in DECISIONS.md.
  - Implement tokens v2 (palette, radius, elevation, motion) in the app.

## Open owner questions

- 2026-10-13: Fable D0 spec drafted. Visual preview (sample data) published as private Design canvas https://claude.ai/artifact/92uiB3ukGHrDcPqp9Q1SUo (v3) with PNGs in `v2-preview/` (untracked, not committed). Waiting on owner approval of D0 look before writing the spec doc and implementing.
- Owner decisions to record in DECISIONS.md with D0: Roadmap in Plan + Goals & Projects + compact Home strip; Today drops weekly overview and links to the week; Insights becomes Analytics under Reflect; grey backdrop on Dashboard only.

## Checkpoint log

- 2026-10-13 D0 done. Spec `docs/superpowers/specs/2026-10-13-premium-redesign-d0-design.md` (Fable-reviewed, owner told). Code in `client/src/design/` and `client/src/components/premium/`. Evidence in `docs/PHASE4_SLICE_EVIDENCE.md`. Next: D1.
