# Claude Code instructions (personal-Calander)

Read `AGENTS.md` first. It holds the repository rules (branches, gates, data safety, evidence). This file adds Claude-specific working rules from the owner.

## Start of session
- Read `HANDOFF.md` and `RUN_STATE.md` (premium redesign), then `docs/INDEPENDENT_STACK_HANDOFF.md` if the work touches infrastructure.
- Run `node scripts/agent-memory.mjs session list` and continue the active session.

## Subagents and model routing (owner instruction, 2026-10-13)
Use subagents wherever they help: independent review, screenshot/visual review, separate investigations, parallel UI pieces in separate files. Pick the model by task:

| Model | Use for |
| --- | --- |
| haiku | Mechanical edits, greps, renames, log/file digests |
| sonnet | Trivial read-only lookups only. Never for anything important, and never for UI/UX design or visual/screenshot review (owner, 2026-10-14) |
| opus | All logic (data/projection, state), architecture, risky integration, test and preview tooling, independent code review, plus every UI/UX review, screenshot/visual check and important exploration that used to go to sonnet (owner, 2026-10-14: "for IMP things and design UI UX dont use sonnet use opus") |
| fable (Fable 5.1) | ALL UI/UX design: specs, layout, icons, motion, and building the visual UI layer. Load `impeccable:impeccable`, `design-taste-frontend`, `emilkowal-animations` first. Always tell the owner when Fable runs. |

Owner update 2026-10-13 (latest, supersedes earlier): "use FABLE 5.1 not opus for designs". Fable does all design work. Opus keeps logic and review.
- Assumption, not yet confirmed: Fable also builds the visual UI code. Opus wires the logic.

- Give every subagent an objective, scope, file paths, expected output (≤450 words, prioritised) and an explicit read-only or may-edit statement.
- Parallel editors must own separate files; otherwise run sequentially.
- Verify subagent claims before applying them. The primary agent integrates, runs final verification and reports.
- The Codex/SOL routing helper in `docs/AGENT_MODEL_ROUTING.md` is for Codex sessions; Claude sessions use the table above.

## Design direction: modern, futuristic, cool (owner standing rule, 2026-10-13)
Every screen in D3–D6 (and any later UI work) must look modern and futuristic and feel good to use, not just function:
- **Icons:** expressive lucide icons on headers, empty states, actions and navigation, always paired with labels (no icon-only meaning). Use tinted icon tiles like the Dashboard cards.
- **Animations and motion:** plenty, but driven by state. Examples: count-ups, ring and bar fills, staggered card entry, glide indicators, spring check-offs with small bursts, shared-element view switches, hover lift and press scale. Keep interactions under ~300ms with ease-out. Infinite loops only for ambient or "live" cues.
- **Reuse the motion system:** `client/src/design/motion.ts` and the `--pc-ease`/`--pc-dur-*`/`pc-rise`/`pc-pop` tokens and classes in `tokens-v2.css`. Don't invent one-off timings.
- **Modern UI:** the v2.1 look (white/blue plus slate dark, validated category palette, status pills, glassy surfaces where it fits, generous rounded cards). Keep pushing it further each slice, without breaking the approved identity.
- **Always:** honour `prefers-reduced-motion` (everything off or instant). Show real data only; no decorative fake numbers. Keep it accessible (contrast, focus rings, labels).
- **Who builds it:** Fable 5.1 agents with `impeccable:impeccable`, `design-taste-frontend` and `emilkowal-animations` loaded do the UI design and motion work. Opus does the logic. Tell the owner whenever Fable runs.

## Checkpoints
- After every checkpoint: update `HANDOFF.md` + `RUN_STATE.md`, commit, `git push origin HEAD:dev/personal-calendar-premium-v2`, then keep going. Never push to main, never force-push.
- Owner, 2026-10-13: after EVERY checkpoint (each slice D2.5, D3, D3.5 and any sub-checkpoint), update ALL the MDs. The goal is that a future session saves tokens by reading HANDOFF.md first, and only what it points to.
  - **HANDOFF.md:** keep a short "Start here" block at the top: status, exact next step, unpushed commits, open owner questions, where to look.
  - **RUN_STATE.md:** step table plus checkpoint log.
  - **docs/DECISIONS.md:** new decisions and assumptions.
  - **docs/PHASE4_SLICE_EVIDENCE.md:** verification numbers.
  - **The slice spec:** status and known limits.
  - **docs/OWNER_PREVIEW_CHECKLIST.md:** what the owner should look at.
  - **CLAUDE.md:** only when rules change.
  - **Memory:** `MEMORY.md` plus files.

## Local preview
- Dev server: `npx vite --port 3100 --strictPort --host 127.0.0.1` (the worktree has no `.env`, so plain Vite shows "Sign-in is not configured").
- To see the app with synthetic data: `python scripts/open-local-preview.py [--theme dark] [--width 390 --height 844]`. It intercepts every API, so no live data is read or written.
- Harnesses: `scripts/preview-premium-{shell,plan,gallery}.py`, `scripts/preview-phase4-product.py --url http://127.0.0.1:3100`.
