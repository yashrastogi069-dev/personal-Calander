# Personal Calendar

Personal Calendar is a personal planning workspace for tasks, habits, plans, projects, goals, reviews, calendar reservations, and recovery after an interrupted day. The current premium reconstruction uses `dev/personal-calendar-premium-v2`; the original workbench and main remain reference branches. Preserve existing planner records and capabilities.

The 2026-10-04 checkpoint adds the visible Today/Tasks/shell reconstruction, desktop Tasks/Habits bento, factual habit heatmap and large Focus studio. See [checkpoint scope and approved visual references](docs/superpowers/plans/2026-10-04-premium-v2-checkpoint.md), [remaining phases](docs/RECONSTRUCTION_CHECKPOINTS.md) and [verification/delivery evidence](docs/PHASE4_SLICE_EVIDENCE.md). Automatic Vercel Preview is enabled for this new branch by owner request; a Git push alone is not evidence the Preview or live database works.

## Start here

- [Current project state](docs/PROJECT_STATE.md) and [independent stack handoff](docs/INDEPENDENT_STACK_HANDOFF.md)
- [Technical debt register](docs/TECH_DEBT.md)
- [Agent session memory](docs/AGENT_MEMORY.md)
- [Product specification](docs/PRODUCT_SPEC.md), [architecture](docs/ARCHITECTURE.md), and [decisions](docs/DECISIONS.md)
- [Testing](docs/TESTING.md), [security](docs/SECURITY.md), [API](docs/backend/API.md), and [database](docs/backend/DATABASE.md)
- [Phase 4 plan](docs/superpowers/plans/2026-09-14-phase4-total-product-redesign.md) and [slice evidence](docs/PHASE4_SLICE_EVIDENCE.md)

## Local development

Use Node and the lockfile's pnpm version. Install dependencies with `pnpm install`, start the application with `pnpm dev`, and open the local URL printed by the server. The application needs the environment values appropriate to the independent Supabase stack; keep them in ignored local configuration and see the deployment guide before connecting to live services.

```text
pnpm check          TypeScript
pnpm test           Vitest suite
pnpm build          local client, PWA, and server build
pnpm build:client   Vercel client and server artifact
```

The workbench branch is `dev/personal-calendar-workbench`. `main` is the frozen R20 reference. Do not run schema migration commands against a populated database as part of local setup. See [database safety](docs/backend/DATABASE.md) for the approval gate.

## Implementation map

`client/src` contains the React app and feature workspaces; `server` contains authentication, scoped tRPC procedures, planning rules, and service boundaries; `shared` contains pure contracts and projections; `drizzle` contains schema and migrations; `api` contains Vercel entrypoints; `scripts` contains verification and guarded operational tools. The root [agent instructions](AGENTS.md) apply to all work.
