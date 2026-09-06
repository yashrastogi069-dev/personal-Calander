# Repository working rules

- Work on `dev/personal-calendar-workbench` for the current independent-stack migration.
- Never merge this branch into `main` unless the user explicitly instructs it. `main` is the frozen R20 reference.
- Existing planner data is real. Preserve record IDs, workspace IDs, and history. Do not reset databases or replay the baseline over populated tables.
- Complete infrastructure decoupling and validate it before Vercel deployment. UI/UX redesign follows deployment.
- Use `docs/INDEPENDENT_STACK_HANDOFF.md` for current migration status. Earlier checkpoint documents contain historical claims, not current live verification.
