# Repository working rules

- Work on `dev/personal-calendar-workbench` for the current independent-stack migration.
- Never merge this branch into `main` unless the user explicitly instructs it. `main` is the frozen R20 reference.
- Existing planner data is real. Preserve record IDs, workspace IDs, and history. Do not reset databases or replay the baseline over populated tables.
- Complete infrastructure decoupling and validate it before Vercel deployment. UI/UX redesign follows deployment.
- Use `docs/INDEPENDENT_STACK_HANDOFF.md` for current migration status. Earlier checkpoint documents contain historical claims, not current live verification.

## Working memory and documentation

- Read `docs/PROJECT_STATE.md` and `docs/INDEPENDENT_STACK_HANDOFF.md` before resuming implementation. The handoff wins if dates or status disagree.
- Keep `MEMORY.md` short and current. Record decisions in `docs/DECISIONS.md`, product behavior in `docs/PRODUCT_SPEC.md`, and verified results in `docs/PHASE4_SLICE_EVIDENCE.md`.
- Treat `docs/superpowers/specs/2026-09-14-phase4-total-product-redesign.md` and its companion plan as the detailed Phase 4 contract. Preserve the capability ledger and distinguish a local pass from a live deployment or physical-device pass.
- Do not claim a migration, Preview, production, notification delivery, or iPhone check succeeded without direct evidence. Never print or commit credentials.
- Do not declare a task complete from code inspection alone. Completion reports must include tests executed and results, build result, relevant runtime verification, files changed, and remaining known risks. Mark inapplicable evidence explicitly; do not imply it was run.

## Memory discipline

- `MEMORY.md` is a compact, curated handoff. It is not a transcript or proof that conversations are durably stored. Link decisions and verification to their source documents.
- Before adding a memory, search for an equivalent fact and update it instead of duplicating it. Give each entry a date, source, current status, and owner or next action when relevant.
- Correct or remove stale entries when evidence changes. Do not retain secrets, access tokens, raw personal planner records, or private conversation text in committed Markdown.
- Use the repository-local store described in `docs/AGENT_MEMORY.md` for agent work sessions. Run `node scripts/agent-memory.mjs session list` and search relevant context before implementation. Record the active request, decisions, work result, verification, and remaining risks at meaningful checkpoints; resume from retrieved session history after restarts.
- Stored history is explicitly captured, not automatically imported from the host transcript. Keep private data and secrets out. Use the permanent delete command only for the selected memory/session ID requested by the user.
