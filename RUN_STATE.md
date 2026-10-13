# Run state: premium BEST Shots redesign

Owner goal (2026-10-13): finish Plan Studio, then redesign Dashboard and every screen to match and exceed `BEST Shots/` with rich-but-calm motion, keeping the white/blue identity and real data only. Work in a self-paced loop, keep the owner posted, ask before each Fable use, new dependency or gate.

Branch: `work/premium-redesign` (worktree `.claude/worktrees/premium-redesign`), pushed to `dev/personal-calendar-premium-v2` after verification. Never main. No Vercel checks, live writes or migrations.

Model routing: haiku = mechanical edits/greps; sonnet = ordinary UI work, screenshot review; opus = architecture, risky integration, independent review; fable = key design decisions, only with owner OK each time.

## Steps

| # | Step | Status |
|---|---|---|
| C3 | Plan Studio weekly board + date continuity | Done locally, `8a242e6`; build + 754 tests + harness 36/36 |
| A | Owner approval of redesign sequence (D0-D6, G1-G3) | Waiting on owner |
| D0 | Tokens v2 (radius pill, elevation, hero/dark cards, hatch), motion tokens, primitives, quarantine legacy green CSS | Not started |
| D1 | Routed shell, grouped sidebar with badges, view tabs, command palette prefixes, phone pill nav | Not started |
| D2 | Dashboard home + one-click Today switch, Schedule card lens | Not started |
| D3 | Tasks board drag (needs @dnd-kit approval) | Not started |
| D4 | "Why it matters" reasons from existing facts | Not started |
| D5 | Light Analytics | Not started |
| D6 | Polish, empty/first-run states | Not started |
| G1-G3 | Stakes fields, hard reminders, two-way Google sync | Gated |

## Open owner questions

1. Approve the D0-D6 order and gates?
2. Fable for the D0 visual/motion spec (tokens, Dashboard layout)?
3. Add `@dnd-kit` for D3 drag?
4. Add a `pill` radius (999px) to DESIGN.md?
