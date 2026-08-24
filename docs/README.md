# Documentation Index

This directory is the project memory for **Personal Calander**. Product behavior, design choices, data rules, and verification evidence are kept here so subsequent development work can be reasoned about rather than rediscovered.

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
