# Secure Offline Synchronization Design

Status: approved; implementation active

Date: 2026-09-12

## Outcome

Personal Calendar keeps an authenticated user's latest planner available on the same device, accepts supported work while disconnected, and reconciles it without silently losing either a local or server value. The design stays intentionally small: one scoped snapshot, one durable operation log, existing row versions, and an explicit conflict inbox.

## Non-negotiable data rules

- Existing record IDs, workspace IDs, ownership, history, and populated tables are preserved.
- No baseline migration is replayed and no database is reset.
- Signing out clears memory and query caches but retains IndexedDB records for that account; signed-out screens and other accounts never read them.
- Missing fields in a snapshot or mutation never mean delete.
- A normal delete creates a tombstone/recycle-bin state retained indefinitely.
- Permanent deletion is a separate confirmed online action and is never replayed implicitly.
- Non-overlapping field edits merge automatically. If the server and device changed the same field from the same base value, both values are retained until the user chooses.

## Device storage

IndexedDB database `personal-calander-planner-v1` has four stores:

1. `snapshots`: one record per `accountId::workspaceId::range`, containing the serializable planner snapshot, fetch time, and schema version.
2. `operations`: immutable operations keyed by globally unique `operationId`, with scope, entity, entity ID, operation kind, base version, base field values, patch, creation time, and retry state.
3. `conflicts`: durable records retaining base, local, and server values per overlapping field.
4. `meta`: non-sensitive per-scope synchronization metadata.

Every read requires the currently authenticated account ID and workspace ID. Scope is part of the primary key, not a filter added after reading. Auth transitions cancel requests, clear React Query memory, and replace the active scope before cached data can be exposed.

## Bootstrap and offline behavior

After identity and workspace authorization succeed, the client may load only that scope's cached snapshot. A successful backend snapshot replaces the stored snapshot after pending operations are overlaid. If the backend is unavailable and a scoped snapshot exists, the planner renders it with a persistent stale/offline indicator. If no snapshot exists, the app presents an honest first-connect state rather than an empty planner.

Date-range data is stored with its exact requested range. Range-bound collections do not pretend to cover dates that were never downloaded.

## Operation contract

Operations are append-only until the server acknowledges the exact `operationId`. Retrying is safe because the server stores an idempotency receipt scoped to the workspace and returns the prior outcome. Batches are bounded and processed in creation order. One rejected operation does not make later independent operations disappear.

The first implementation covers high-frequency writes in coherent groups, beginning with task capture and field updates, then goals/projects/habits and planning/review records. Unsupported offline actions stay disabled with precise copy; they are never presented as saved.

## Three-way field merge

For each patched field, compare `baseValues[field]` with the current server value:

- unchanged on server: apply the local value;
- changed only on server: keep the server value when the device did not patch that field;
- changed on both to the same value: treat as already applied;
- changed on both to different values: retain base, local, and server values in `syncConflicts` and mark the operation `needs_review`.

Safe fields from the same operation may still be applied. Conflict resolution is itself a new version-checked operation.

## Recycle bin

Archivable entities use their existing `archivedAt`/archived state as the first recycle-bin representation. Entities that currently hard-delete require an additive tombstone before offline deletion is enabled. Restore clears only tombstone fields and advances the row version. Permanent deletion is not part of automatic synchronization.

## Backend boundaries

The sync API is an authenticated tRPC procedure. It derives the user from the Supabase session, verifies workspace ownership through existing middleware, validates an allowlisted operation schema, and calls existing planning services. Payload, patch, and batch limits are bounded.

Receipts and conflicts are additive workspace-scoped tables. Migration creation must be verified locally and against the live schema before remote DDL.

## UX states

One compact surface communicates `saved`, `offline`, `syncing`, `pending`, `needs review`, and `retry needed`. It shows pending count, last successful sync, and retry. Conflicts use human field labels and two explicit choices while preserving both values. Gestures always have visible button alternatives.

## Failure and recovery

- Network interruption leaves operations durable and retryable.
- Authentication expiry pauses replay without discarding work.
- Workspace access loss hides cached records and pauses operations; it does not reassign them.
- Invalid or unsupported operations become visible retry/review items.
- Storage quota failure blocks the affected offline action before optimistic success is shown.
- IndexedDB upgrades are transactional or leave the prior database readable.

## Security notes from the live audit

On 2026-09-12 the connected Supabase project was `ACTIVE_HEALTHY` and populated planner tables were present. The audit also reported pre-existing RLS-without-policy warnings for planner tables and an externally executable `rls_auto_enable()` security-definer function. The application accesses planner data through authenticated server procedures; Phase 2 does not broaden browser database access. Those advisories are tracked separately and must not be “fixed” by destructive policy or role changes during sync work.

## Release gates

- Unit tests for scope isolation, serialization, idempotency, merge classification, queue retry, sign-out hiding, and tombstones.
- Router/service tests for ownership, batch limits, duplicate IDs, stale versions, partial merges, and conflict retention.
- TypeScript, complete automated suite, and production build.
- Browser checks at 390x844 for cached bootstrap, pending/retry/review states, account switching, and overflow.
- Preview migration and deployment verification before production merge.
- Physical iPhone offline/relaunch verification is delegated to the user and remains unclaimed.
