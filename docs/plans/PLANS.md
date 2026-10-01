# Plans index

These short plans orient work on `dev/personal-calendar-workbench`. The [Phase 4 specification](../superpowers/specs/2026-09-14-phase4-total-product-redesign.md) defines product behavior; the [detailed implementation plan](../superpowers/plans/2026-09-14-phase4-total-product-redesign.md) owns the task sequence and checks. [Current migration handoff](../INDEPENDENT_STACK_HANDOFF.md) takes precedence for live infrastructure status. A checked box or historical checkpoint in an older document does not prove a current deployment.

| Plan | Purpose | Status on 2026-10-01 |
| --- | --- | --- |
| [001 Foundation](001-foundation.md) | Branch, data, shell, preferences, design, and verification baseline | Local foundation established; live gates remain |
| [002 Authentication](002-authentication.md) | Supabase account, owned workspace, session and sign-out boundaries | Implemented with local and historical Preview evidence; current live end-to-end proof remains |
| [003 Dashboard](003-dashboard.md) | Separate, configurable Home Overview | Planned Phase 4 Task 20; not implemented |

The numbered files are topic guides, not replacements for Tasks 1-23. Update their status only after inspecting current code and evidence. Record implementation proof in [slice evidence](../PHASE4_SLICE_EVIDENCE.md) and the whole-app visual gate in [UI/UX coverage](../PHASE4_UI_UX_COVERAGE.md).

## Standing constraints

- Preserve existing planner capabilities, records, IDs, workspace ownership, history, offline operations, and compatibility routes.
- Keep `main` as the frozen R20 reference. Do not merge without explicit owner instruction.
- Treat database migrations, Preview or Production deployment, physical-device verification, and synthetic browser checks as separate gates.
- Never reset a populated database or replay its baseline migration. Additive Phase 4 migrations require their own reviewed target, inventory, backup, and approval path.

## How to use these plans

Read the relevant numbered page, then follow the linked source specification and detailed task. Before marking a plan complete, verify code, focused tests, build, browser states, and the applicable live or device gate. Update the handoff and evidence ledger with precise results and remaining limits.
