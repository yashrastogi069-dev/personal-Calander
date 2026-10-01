# Working memory

Updated 2026-10-01. This is a short navigation aid, not a deployment record. For live migration status, read [the handoff](docs/INDEPENDENT_STACK_HANDOFF.md).

- Work on `dev/personal-calendar-workbench`; `main` is frozen R20. Preserve all planner IDs, workspace ownership, history, and features.
- Phase 4 product direction: Variant A colors, an accessible A-derived dark appearance, comfortable density by default with compact optional, exact R20 dark Task lane colors. See [visual selection](docs/PHASE4_VISUAL_SELECTION.md).
- Task 15 planning/calendar flow was locally verified and pushed. Task 16 presentation and the established-field goal update contract were pushed at `6745d7c`; the editable Direction/Outcome flow and full detail requirements are still open.
- Tasks 17–22 remain in the Phase 4 plan. Task 20 is the separate customizable Home Overview/dashboard; deeper analytics belong to Phase 5. Notification work follows the core redesign.
- Additive migrations 0004 and 0005 have not passed the live approval gate. Live database shape and counts remain unverified after strict TLS inspection failed. No reset or baseline replay is allowed.
- Physical iPhone, VoiceOver, and live Preview verification are separate from synthetic checks. Current local evidence is in [slice evidence](docs/PHASE4_SLICE_EVIDENCE.md).
- Unrelated worktree changes may exist. Check `git status` and stage only task files. Use [agent flow](docs/AGENT_FLOW.md) and [model routing](docs/AGENT_MODEL_ROUTING.md); Astra requires explicit user permission.
