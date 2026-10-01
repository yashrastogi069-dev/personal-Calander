# Backend API

This is a code map for the current workbench branch. The route and input definitions in `server/routers/planner.ts`, `server/routers/storage.ts`, and `server/_core/app.ts` are authoritative when this document differs from code. Deployment and live migration status are tracked in [`../INDEPENDENT_STACK_HANDOFF.md`](../INDEPENDENT_STACK_HANDOFF.md).

## Transport and authentication

- The Express application mounts tRPC at `/api/trpc` with SuperJSON serialization. `server/routers.ts` exposes `system`, `auth`, `planner`, and `storage` namespaces.
- The client sends a Supabase access token as `Authorization: Bearer <token>`. The server validates it through Supabase Auth and upserts the corresponding application `users` row. Protected procedures reject missing users. Planner procedures verify that the requested workspace belongs to the authenticated application user; a supplied `workspaceId` alone does not grant access.
- Most planner procedures accept `workspaceId` and `timezone` as scope fields. Mutations of established records commonly require `expectedVersion`; clients should fetch the current record and handle stale version errors by reviewing the newer server state. Inspect the exact Zod input and response for each procedure in the router before building a caller.
- `auth.me` returns the current user or null, `auth.workspace` returns the owned workspace or null, and `auth.logout` returns an acknowledgement. Device sign out is completed by the client Supabase session flow; this acknowledgement does not revoke that session.

## Planner procedure map

| Namespace | Current procedures | Purpose |
| --- | --- | --- |
| `planner.workspace` | `ensure`, `update`, `snapshot` | Workspace settings and the dated planner snapshot. |
| `planner.recovery`, `planner.sync` | `resolve`; `conflicts`, `resolve`, `replay` | Account recovery and bounded offline task replay/conflict resolution. `replay` accepts 1–25 operations. |
| `planner.availability`, `planner.scheduleProposal`, `planner.focus` | `upsert`, `clear`; `create`, `approve`, `dismiss`, `undo`; `start`, `pause`, `resume`, `finish` | Availability, reviewed scheduling proposals, and focus sessions. |
| `planner.category`, `planner.goal`, `planner.milestone`, `planner.project` | Category `create/update/delete`; goal `create/update/archive/restore`; milestone `create/update/archive`; project `create/archive/restore` | Organization and goal hierarchy. |
| `planner.task`, `planner.occurrence` | Task `create/update/reserve/rolloverPreview/applyRollover/bulkSetState/addDependency/removeDependency`; occurrence `materialize/resolve` | Tasks, reservations, dependencies, and recurrence instances. |
| `planner.habit`, `planner.dailyCheckIn` | Habit `create/archive/restore/checkIn/clearCheckIn/practiceEvidence`; daily check in `upsert` | Practice and daily reflection. |
| `planner.dailyPlan`, `planner.weeklyObjective` | Daily plan `upsert/addItem/updateItem/moveItem/resolveItem/close`; weekly objective `create/update/carryForward` | Commitments and planning periods. |
| `planner.planningTemplate`, `planner.savedView`, `planner.search` | Template `create/update/archive`; saved view `create/update/delete`; search `workspace/record` | Reusable plans, views, and lookup. |
| `planner.calendarFeed`, `planner.notification`, `planner.reminder` | Feed `current/ensure/revoke`; notification `devices/currentDevice/enableDevice/disableDevice/testDevice`; reminder `rules/activateApproved/pauseApproved` | Calendar subscriptions and device reminders. |
| `planner.review`, `planner.ai`, `planner.dashboard` | Review `history/start/updateChecklist/complete`; AI `draft`; dashboard query | Review history, draft capture, and overview data. |
| `storage` | `createUpload`, `completeUpload`, `listFiles`, `createDownloadUrl`, `deleteFile` | Private file workflow, contingent on the separately reviewed file storage migration. |

The `planner.goal.update` contract updates established goal fields with workspace ownership and `expectedVersion` checks. It also accepts optional intention fields (`intentionKind`, success criteria, standards, review cadence/date) at validation time, but the service rejects those writes until `0004_phase4_product_model.sql` is applied. Ordinary workspace, goal, and project reads select established columns so a pre migration database does not fail on absent Phase 4 fields. Existing goals without intention metadata stay legacy goals; titles are never used to infer a type.

## Non-tRPC endpoints

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Returns `{ "status": "ok" }`; this is process health, not a database or Auth proof. |
| `GET /api/calendar/:token.ics` | Returns a private, no-cache ICS feed for an enabled, unrevoked token; unknown or revoked tokens return 404. The token is a bearer secret. |
| `GET or POST /api/scheduled/reminder` | Requires `Authorization: Bearer <REMINDER_CRON_SECRET>` and configured `APP_ORIGIN`. Dispatches reminders and storage cleanup; rejects other methods. A missing optional file table is reported as `storageCleanup.status: "not_configured"`; other job failures return 500. |

The Vercel entrypoints are in `api/`; the shared Express app is in `server/_core/app.ts`. Keep database URLs, service role credentials, calendar tokens, subscription endpoints, and scheduler secrets out of documentation and logs.

## Change and verification rules

Update the Zod contract, implementation, callers, and relevant focused tests together. Protect every record by authenticated workspace ownership, preserve stable IDs/history, and use version checks for changes that could overwrite newer work. For a route requiring a deferred table or column, gate the read and write path until migration approval and verification. Run `pnpm check` and relevant `pnpm test` targets; use the handoff for live Preview and migration gates. Local synthetic tests do not prove deployed account or database behavior.
