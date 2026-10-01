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
