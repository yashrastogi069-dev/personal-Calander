# Focus orchestration follow-up

This document preserves the four Focus follow-up ideas and the Routine Conductor so they do not disappear between slices.

## Current slice: safe projections on existing records

The first follow-up slice is intentionally additive at the UI/domain-projection layer:

- Finish → Next Step shows a post-session handoff after a confirmed finish. `Done`, `Continue`, `Adjust estimate`, and `Stopped` retain their existing meaning. A note is displayed as retained context; it is not silently relabeled as a durable next-step field.
- Meeting Horizon shows only active, timed `externalEvents` that overlap the next three hours. It states the source and shows an honest empty state. Outgoing Apple Calendar subscription is not incoming appointment ingestion.
- Habit Companion shows today’s scheduled check-ins and distinguishes completed, skipped, and unrecorded. It explicitly says that duration is not attributed to habits yet.
- Session Trail shows completed/abandoned Focus sessions present in the current bounded snapshot, newest first, with task/unlinked labels and recorded active duration. It must not imply that this is the entire account history.
- Routine Conductor derives one suggested next focus from the confirmed session, nearest meeting, due habit, or next eligible task. It is guidance, not automation and does not reorder or mutate records.

These projections preserve record IDs, workspace ownership, history, and existing offline/conflict rules. They do not create a second timer, infer a meeting, fabricate a habit duration, or write a routine.

## Deferred durable capabilities

Two capabilities need a separately gated additive data-model decision:

1. True Habit Duration Companion needs a nullable `habitId` on Focus sessions or an isolated workspace-scoped association table. Notes, titles, or check-ins must never be used to infer attribution.
2. Durable Finish → Next Step needs an explicit next-step field or a linked follow-up task identity, with version-guarded writes and conflict behavior. Routine Conductor customization/history likewise needs a persisted routine model.

The current branch does not apply such a migration or claim those features are persisted. The next implementation slice should add compatibility reads and tests first, then an owner-approved migration packet with before-counts, backup/restore evidence, exact SQL hash, and rollback routing.

## UI contract

The full Focus workspace owns the follow-up cards. The compact phone companion remains focused on clock state and primary controls so it cannot cover Today content above the bottom navigation. All actions retain 44px targets, visible focus states, reduced-motion behavior, source labels, and explicit offline/empty states.

## Verification contract

The pure projections must cover ordering, cancelled/overlapping meetings, empty states, long labels, unlinked sessions, scheduled/unrecorded habits, and active-session priority. Browser evidence must cover 320/390/768/1440px, both themes, keyboard focus, no horizontal overflow, and no writes while inspecting the cards. No Preview, physical iPhone, incoming Apple Calendar, notification delivery, or live schema result may be claimed from synthetic checks.
