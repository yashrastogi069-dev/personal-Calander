# 002 — Authentication and workspace ownership

Status: implementation exists; current end-to-end live sign-in, account isolation, and physical-device checks remain release gates.

## Goal

An account opens only its owned workspace. Sign-in, reload, offline recovery, and sign-out must protect the same planner identity without discarding locally queued work. The active design is in the [independent platform specification](../superpowers/specs/2026-09-06-independent-platform-design.md), [secure offline sync specification](../superpowers/specs/2026-09-12-secure-offline-sync-design.md), and [current handoff](../INDEPENDENT_STACK_HANDOFF.md).

## Current implementation

- Supabase Auth supplies the bearer identity. `server/supabaseAuth.ts` validates the token and links it to an application user. Server procedures enforce workspace ownership; the client mounts `AuthenticatedPlanner` outside the route switch in `client/src/App.tsx`.
- The guarded `0001_independent_ownership.sql` migration and one account/workspace link were applied to an audited empty planner target in September. This was a specific historical operation, not permission to replay it or create accounts in another target.
- Account/workspace-scoped cached snapshots and the task operation queue support offline reads and supported task writes. Pending, retry, conflict, and orphan work must remain visible and reviewable. Sign-out hides the account's offline copy on this device instead of deleting it.
- Settings hosts account, sync, and confirmed device sign-out actions. Recovery and unlinked-account views retain their necessary escape action.

## Acceptance and verification

1. Verify Supabase sign-in and token refresh on the intended Preview environment, then reload and confirm the same owned workspace and planner records.
2. Verify that a second account cannot read or mutate the first account's workspace, files, offline snapshot, queue, or conflict review.
3. Exercise offline task enqueue, reconnect/replay, conflict handling, and sign-out/re-sign-in isolation. Unsupported offline entity writes must report their limit before claiming a save.
4. Run `server/authenticatedPlanner.test.ts`, `server/auth.logout.test.ts`, and relevant ownership/offline suites; run `pnpm check` and the production build when auth code changes. Record current command output in [slice evidence](../PHASE4_SLICE_EVIDENCE.md).
5. Check reachable auth, unlinked, error, recovery, Settings, and sign-out states at the [whole-app UI gate](../PHASE4_UI_UX_COVERAGE.md), including touch/safe-area behavior on a real iPhone. Synthetic browser evidence does not establish physical-device behavior.

The handoff documents historical Preview health and account-link evidence, but it also identifies live schema/data and device gates. Do not mark this plan fully verified from local tests or `/api/health` alone.
