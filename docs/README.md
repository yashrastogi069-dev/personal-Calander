# Documentation Index

## Current entry points (2026-10-01)

| Read this | For |
| --- | --- |
| [Project state](PROJECT_STATE.md) | What is done, incomplete, and awaiting live proof |
| [Independent stack handoff](INDEPENDENT_STACK_HANDOFF.md) | Current migration and deployment status; authoritative for live gates |
| [Product specification](PRODUCT_SPEC.md) | Concise product purpose and behavior |
| [Architecture](ARCHITECTURE.md) | Current system boundaries, followed by marked historical design |
| [Decisions](DECISIONS.md) | Current product and engineering choices |
| [Technical debt](TECH_DEBT.md) | Prioritized unresolved correctness, security, and delivery issues |
| [Agent session memory](AGENT_MEMORY.md) | Local session capture, recovery, retrieval, and deletion workflow |
| [Testing](TESTING.md) | Current verification contract and historical evidence |
| [Security](SECURITY.md) | Identity, integrity, secrets, migration safety |
| [Backend API](backend/API.md) / [database](backend/DATABASE.md) | Route and schema maps |
| [Plans](plans/PLANS.md) | Foundation, authentication, and upcoming dashboard guides |
| [Phase 4 spec](superpowers/specs/2026-09-14-phase4-total-product-redesign.md) / [plan](superpowers/plans/2026-09-14-phase4-total-product-redesign.md) | Detailed product and implementation contract |

The older index below describes initial documentation checkpoints and may contain historical status. Use the current entry points above for active work.

## Original index (historical)

This directory is the project memory for **Personal Calendar**. Product behavior, design choices, data rules, and verification evidence are kept here so subsequent development work can be reasoned about rather than rediscovered.

| Document | Purpose | Status |
| --- | --- | --- |
| `MARKET_RESEARCH.md` | Findings from established planning and productivity tools | Complete; update when the scope changes |
| `FEATURE_SCOPE.md` | Product boundaries, priorities, and non-goals | Initial scope captured |
| `DATA_MODEL.md` | Domain entities, relations, invariants, and migration rationale | Initial structure captured |
| `WORKFLOW_RULES.md` | State, scheduling, recurrence, timezone, and review behavior | Initial rules captured |
| `DESIGN_DECISIONS.md` | Visual system, interaction principles, and accessibility choices | Initial direction captured |
| `TESTING.md` | Test strategy, acceptance criteria, and completed verification | Initial strategy captured |
| `ROADMAP.md` | Delivery phases and future integrations | Initial roadmap captured |

All timestamps are persisted in UTC. The interface displays time using the workspace timezone, and every scheduling rule must name which timezone determines its occurrence.
