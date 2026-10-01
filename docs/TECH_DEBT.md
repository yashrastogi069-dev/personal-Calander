# Technical debt register

Updated 2026-10-01. This is an actionable register from current source review. It does not replace the Phase 4 plan or authorize live database changes. Close an item only with code and the matching verification evidence; update this register when priority or status changes.

| Priority | Item | Evidence and impact | Next action |
| --- | --- | --- | --- |
| P0 | PostgreSQL TLS verification is disabled in the application pool | `server/db.ts` sets `rejectUnauthorized: false`. A prior strict-TLS read-only audit failed with `SELF_SIGNED_CERT_IN_CHAIN`; the live schema and record counts remain unverified. | Obtain and configure the correct CA chain. Add a strict-TLS connection test. Re-run bounded read-only inventory and restore-tested backup before considering any live migration. |
| P1 | Task 16 Outcomes/Directions is an incomplete flow | The `goal.update` route rejects intention metadata until migration 0004; snapshot reads intentionally omit it. New tabs therefore cannot create or convert Directions. The selected detail lacks linked work, milestones, risk/dependency and next-review controls. Project cards currently lack a connected destination and the new list truncates at 12. | Finish create/edit/convert/detail/navigation, preserve all existing fields and histories, support all records, and test both pre- and post-migration schemas without live writes. |
| P1 | Current live schema and backup evidence are missing | The handoff records failed strict-TLS inspection, 0004/0005 unapproved, and private-file migration deferred. Git migration journals are not live proof. | Establish target identity, schema and row IDs/counts read-only; test backup restore in isolation; produce separate exact-hash approval for each live migration. |
| P1 | Whole-app Phase 4 redesign is incomplete | The detailed plan continues through Tasks 17–23. Roadmap, habit return, persistent focus, Overview, Review/Settings consolidation, whole-app accessibility/performance, and final notification work remain. | Work in task order and record route/state/viewport evidence in `PHASE4_SLICE_EVIDENCE.md`; keep notification work last. |
| P2 | Current deployment and real-device evidence lag local branch | Task 16 is pushed, but its current Vercel Preview was not verified. Physical iPhone, VoiceOver, offline/relaunch, and real notification delivery require separate evidence. | Verify the exact workbench Preview after code completion, then record device checks separately. |
| P2 | Production bundle has a large main chunk and mixed import warning | The Task 16 build emitted a 1,441.85 kB main JavaScript chunk and noted `WorkspaceSearchWorkspace.tsx` is both statically and dynamically imported. Build passes, but startup/download cost may be high. | Profile real route loading, remove unintended eager imports, and split only where measured behavior remains correct. |
| P3 | Agent-flow historical sections remain long and partly superseded | `docs/AGENT_FLOW.md` now points at current state and labels its 2026-09-12 sections historical, but those sections still contain old instructions. | Consolidate old evidence into linked historical checkpoints during a later documentation cleanup. |
| P2 | Agent memory depends on explicit capture and scales linearly | `scripts/agent-memory.mjs` persists only recorded events; it cannot hook the host transcript. Search ranks by token overlap and scans the local store. | Keep the capture boundary visible. If the store grows materially, measure retrieval and add FTS/indexing without changing saved IDs or deletion behavior. |

## Maintenance rules

- Keep priority tied to user harm, data loss, security, correctness, and release impact.
- Link each resolved item to a commit or evidence section; do not mark an item resolved because a test file exists.
- Never store credentials or raw private planner records in this file.
- Keep product backlog and technical debt distinct: a feature can be planned without being a debt, while a broken/unsafe implementation is debt even if no new feature is requested.
