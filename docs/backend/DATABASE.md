# Database and migration policy

The application uses PostgreSQL through Drizzle. The current schema is [`../../drizzle/schema.ts`](../../drizzle/schema.ts); Supabase migration SQL and its journal live in [`../../supabase/migrations/`](../../supabase/migrations/). The actual live schema must be established by a fresh read-only inventory. This file describes source code and the current migration gate; it does not assert that every source column or table exists in Production.

## Ownership and data model

`users.authUserId` links Supabase Auth to an application user. `workspaces.ownerUserId` links one workspace to an application user. Planner rows carry `workspaceId`; server procedures check the owner before access. The schema enables RLS on its application tables, but server authorization and any Storage policies are separate controls. Do not infer that a table is browser accessible because RLS is enabled.

The model contains categories, goals and milestones, projects, tasks and dependencies, recurrence occurrences, habits and check ins, daily plans and items, weekly objectives, focus sessions, templates, availability exceptions, schedule proposals, saved views, reviews, calendar feeds, push subscriptions/deliveries, reminder rules, sync receipts/conflicts, AI drafts, and private file metadata. `commitmentResolutions` and `carriedCommitments` support distinct recovery and carry history. `drizzle/schema.ts` defines keys, indexes, version fields, and nullable links; consult it before changing a relation or deletion behavior.

Most mutable planner records have a `version` column for optimistic concurrency. Archive and restore operations retain records rather than deleting history. Task `clientRequestId` and sync operation receipts help prevent duplicate replay. Calendar and scheduling data distinguish local dates from UTC timestamps; preserve the workspace IANA timezone when interpreting a local planning day.

## Migration status and compatibility

| Migration | Current code role | Live status from the current handoff |
| --- | --- | --- |
| `0000_loving_madrox.sql` | Original baseline | Historical provenance. Never replay over populated tables. |
| `0001_independent_ownership.sql` | Auth and workspace ownership | Applied to the identified empty independent planner target after guarded checks. |
| `0002_private_planner_files.sql` | Private metadata, bucket, and Storage policies | Deferred. The scheduler tolerates only the optional missing table case. |
| `0003_good_lady_deathstrike.sql` | Secure sync receipts and conflicts | Applied after project and data preservation checks. |
| `0004_phase4_product_model.sql` | Additive Phase 4 workspace, goal, project, and planning fields | Pinned but not approved or applied in the handoff. Ordinary reads explicitly select established columns; optional goal intention writes are rejected until this migration is available. |
| `0005_carried_commitments.sql` | Additive carried commitment identity | Has local journal/snapshot and isolated preservation tests, but no live apply approval. Do not assume it exists remotely. |

The migration journal in Git records intended order, not live application. The current handoff says a strict TLS, read-only live inspection failed with `SELF_SIGNED_CERT_IN_CHAIN`, leaving fresh schema, IDs, and counts unverified. The runtime database pool currently configures `ssl: { rejectUnauthorized: false }` in `server/db.ts`; that implementation detail does not satisfy the strict TLS requirement for a live audit. Resolve the project CA certificate before using audit output as evidence for a migration decision. Reconcile the exact project, schema, journal, and existing rows before any runner or SQL apply.

## Safe change sequence

1. Read [`../INDEPENDENT_STACK_HANDOFF.md`](../INDEPENDENT_STACK_HANDOFF.md) for the newest gate. Inventory the exact connected project, tables, columns, migration journals, RLS/Storage policies, workspace and record IDs, and per-table counts through a bounded read-only connection.
2. Capture a recoverable database backup and test restore in isolation. Back up Storage object bodies separately if a Storage change is involved. Compare IDs and counts before and after any approved migration.
3. Review the exact additive SQL and hash, compatibility with both pre and post migration code, rollback routing, and owner approval for each live migration separately. `pnpm db:generate` creates source migration files; `pnpm db:migrate` and `pnpm db:push` run migrations and are live write operations when pointed at a live database.
4. Apply only to the verified target with an approved plan. Never reset a database, replay the baseline on populated tables, substitute an empty project for the data bearing target, or overwrite live planner history. Preserve record IDs and workspace IDs.
5. Verify post migration schema, row counts, IDs, authenticated reads, and affected writes. Keep older code compatible with new rows before routing traffic back. In particular, code before `0005` cannot safely display carried commitments created after that migration without a data preserving conversion.

The source of truth for current migration approvals, hashes, and live evidence is the handoff, not older checkpoint prose or the Git journal alone. No migration command in this document is an authorization to execute it.
