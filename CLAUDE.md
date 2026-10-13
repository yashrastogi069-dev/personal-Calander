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
| sonnet | Ordinary UI building, screenshot and visual review against the boards |
| opus | Architecture, data/projection logic, risky integration, independent code review |
| fable | Key design moments only (planning, UI/UX structure, important design decisions). Always tell the owner when Fable runs. |

- Give every subagent an objective, scope, file paths, expected output (≤450 words, prioritised) and an explicit read-only or may-edit statement.
- Parallel editors must own separate files; otherwise run sequentially.
- Verify subagent claims before applying them. The primary agent integrates, runs final verification and reports.
- The Codex/SOL routing helper in `docs/AGENT_MODEL_ROUTING.md` is for Codex sessions; Claude sessions use the table above.

## Checkpoints
- After every checkpoint: update `HANDOFF.md` + `RUN_STATE.md`, commit, `git push origin HEAD:dev/personal-calendar-premium-v2`, then keep going. Never push to main, never force-push.

## Local preview
- Dev server: `npx vite --port 3100 --strictPort --host 127.0.0.1` (the worktree has no `.env`, so plain Vite shows "Sign-in is not configured").
- To see the app with synthetic data: `python scripts/open-local-preview.py [--theme dark] [--width 390 --height 844]`. It intercepts every API, so no live data is read or written.
- Harnesses: `scripts/preview-premium-{shell,plan,gallery}.py`, `scripts/preview-phase4-product.py --url http://127.0.0.1:3100`.
