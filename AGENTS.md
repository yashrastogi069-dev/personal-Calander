# Repository working rules

- Work on `dev/personal-calendar-workbench` for the current independent-stack migration.
- Never merge this branch into `main` unless the user explicitly instructs it. `main` is the frozen R20 reference.
- Existing planner data is real. Preserve record IDs, workspace IDs, and history. Do not reset databases or replay the baseline over populated tables.
- Complete infrastructure decoupling and validate it before Vercel deployment. The owner explicitly authorized local UI/UX redesign to begin before deployment on 2026-10-01; this does not authorize Vercel deployment, live database writes, or schema migration before their separate gates.
- Use `docs/INDEPENDENT_STACK_HANDOFF.md` for current migration status. Earlier checkpoint documents contain historical claims, not current live verification.

## Multi-Agent Delegation Policy

When true sub-agent collaboration tools are available, proactively use
sub-agents when delegation would materially improve speed, context isolation,
independent verification, or solution quality.

Before substantial work, briefly determine whether the task contains
independent workstreams.

Good reasons to delegate include:

- exploring separate parts of a large codebase
- investigating multiple plausible causes of a bug
- comparing alternative architectures or implementations
- researching independent technologies or dependencies
- performing an independent code review
- performing security analysis
- designing or extending tests independently from implementation
- checking backwards compatibility
- investigating performance bottlenecks
- reviewing database/API/frontend/backend concerns separately
- validating an implementation from an independent perspective

Prefer parallel delegation only when tasks are meaningfully independent.

Do not create sub-agents merely to increase agent count.

Keep work in the primary agent when:

- the task is small or straightforward
- the steps form one tightly ordered chain
- each step depends strongly on the result of the previous step
- multiple agents would need to repeatedly modify the same files
- coordination overhead would exceed the likely benefit

For substantial tasks, consider 2–4 focused sub-agents before increasing
parallelism further.

Each delegated task must have:

1. a clear objective
2. defined scope
3. relevant context
4. expected output
5. explicit constraints
6. a clear statement about whether file modification is allowed

Avoid assigning the same broad task to multiple agents unless independent
comparison is explicitly valuable.

Sub-agents should return concise findings and evidence rather than dumping
large amounts of raw context into the parent.

The primary agent remains responsible for:

- coordinating agents
- resolving conflicting findings
- preserving architectural consistency
- deciding what gets implemented
- integrating changes
- running final verification
- reporting the final result

Parallelize investigation aggressively when appropriate.
Parallelize code modification conservatively.

When multiple agents would modify overlapping files or tightly coupled
components, prefer sequential execution or isolated worktrees.

After delegated work completes, synthesize the findings before proceeding.
Do not blindly accept a sub-agent's conclusion.

Do not delegate merely for the sake of delegation.

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
