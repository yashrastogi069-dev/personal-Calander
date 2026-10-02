# Working memory

Updated 2026-10-02. This is a short navigation aid, not a deployment record. For live migration status, read [the handoff](docs/INDEPENDENT_STACK_HANDOFF.md).

This file is curated project memory, not a transcript. Repo-local agent sessions now persist in the ignored SQLite store via `node scripts/agent-memory.mjs`; use `docs/AGENT_MEMORY.md` for commands and recovery. Capture is explicit because the host does not expose its transcript. The planner still has only one-shot `planner.ai.draft`; the `AIChatBox` in `ComponentShowcase` remains an in-memory demo.

- Work on `dev/personal-calendar-workbench`; `main` is frozen R20. Preserve all planner IDs, workspace ownership, history, and features.
- Phase 4 product direction: Variant A colors, an accessible A-derived dark appearance, comfortable density by default with compact optional, exact R20 dark Task lane colors. See [visual selection](docs/PHASE4_VISUAL_SELECTION.md).
- Task 15 planning/calendar flow was locally verified and pushed. Task 16 presentation and the established-field goal update contract were pushed at `6745d7c`; the editable Direction/Outcome flow and full detail requirements are still open.
- Task 17 Roadmap/project Timeline, Task 18 visual Habits, and Task 19 persistent Focus watch are the current dev-branch checkpoint: full-width/larger Home watch, compact cross-page companion, Dial/Digital/Desk View, confirmed clock semantics, offline boundary, and preserved finish outcomes. See [slice evidence](docs/PHASE4_SLICE_EVIDENCE.md). Stop after the owner-requested T19 branch push. Task 20 is the separate customizable Home Overview/dashboard; Tasks 21–23 and deeper Phase 5 analytics remain. Notification work follows the core redesign.
- Focus follow-up ideas are preserved in [FOCUS_ORCHESTRATION_SPEC.md](docs/FOCUS_ORCHESTRATION_SPEC.md): safe projections first (Finish → Next Step, Meeting Horizon, factual Habit Companion, bounded Session Trail, read-only Routine Conductor); durable habit duration, next-step fields, and custom routine history need an approved additive model later.
- Additive migrations 0004 and 0005 have not passed the live approval gate. Live database shape and counts remain unverified after strict TLS inspection failed. No reset or baseline replay is allowed.
- Physical iPhone, VoiceOver, and live Preview verification are separate from synthetic checks. Current local evidence is in [slice evidence](docs/PHASE4_SLICE_EVIDENCE.md).
- Current prioritized risks are tracked in [TECH_DEBT.md](docs/TECH_DEBT.md); the highest priority is restoring strict PostgreSQL TLS verification and establishing a read-only live inventory.
- Unrelated worktree changes may exist. Check `git status` and stage only task files. Use [agent flow](docs/AGENT_FLOW.md) and [model routing](docs/AGENT_MODEL_ROUTING.md); Astra requires explicit user permission.
