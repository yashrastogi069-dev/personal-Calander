# Run state: premium BEST Shots redesign

Owner goal (2026-10-13): finish Plan Studio, then redesign Dashboard and every screen to match and exceed `BEST Shots/` with rich-but-calm motion, keeping the white/blue identity and real data only. Work in a self-paced loop, keep the owner posted, ask before each Fable use, new dependency or gate.

Branch: `work/premium-redesign` (worktree `.claude/worktrees/premium-redesign`), pushed to `dev/personal-calendar-premium-v2` after verification. Never main. No Vercel checks, live writes or migrations.

Model routing: haiku = mechanical edits/greps; sonnet = ordinary UI work, screenshot review; opus = architecture, risky integration, independent review; fable = key design decisions, only with owner OK each time.

## Steps

| # | Step | Status |
|---|---|---|
| C3 | Plan Studio weekly board + date continuity | Done locally, `8a242e6`; build + 754 tests + harness 36/36 |
| A | Owner approval of redesign sequence (D0-D6, G1-G3) | Approved 2026-10-13 (also @dnd-kit, pill radius, Fable for D0 spec) |
| D0 | Fable D0 spec running, then tokens v2 (radius pill, elevation, hero/dark cards, hatch), motion tokens, primitives, quarantine legacy green CSS | Not started |
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

## Open owner questions

- 2026-10-13: Fable D0 spec drafted. Visual preview (sample data) published as private Design canvas https://claude.ai/artifact/92uiB3ukGHrDcPqp9Q1SUo (v3) with PNGs in `v2-preview/` (untracked, not committed). Waiting on owner approval of D0 look before writing the spec doc and implementing.
- Owner decisions to record in DECISIONS.md with D0: Roadmap in Plan + Goals & Projects + compact Home strip; Today drops weekly overview and links to the week; Insights becomes Analytics under Reflect; grey backdrop on Dashboard only.
