| Slice | Capabilities moved | Data mutations | URL/preference compatibility | Loading/empty/error/offline/conflict/large-data | 320/390/landscape/768/1440 evidence | Physical device remaining | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline | None | None | Current routes and preferences inventoried | Existing behavior | Existing synthetic evidence only | iPhone offline/relaunch and delivery | Return to baseline commit; preserve all data and caches |

# Phase 4 slice evidence

This is the traceability record for the Phase 4 slices in the [implementation plan](superpowers/plans/2026-09-14-phase4-total-product-redesign.md). The [Phase 4 specification](superpowers/specs/2026-09-14-phase4-total-product-redesign.md) is the product authority, and the [capability-preservation ledger](PHASE4_CAPABILITY_LEDGER.md) is the preservation contract. Every later slice appends evidence to the table above before release acceptance.

## Immutable baseline

- Branch: `dev/personal-calendar-workbench`.
- Direct TypeScript check: passed with `tsc --noEmit`.
- Vitest: 64/64 files passed; 274 tests passed; 3 expected environment skips.
- Vite production build: passed. Main bundle: 1,299.28 kB / 371.09 kB gzip. The known non-blocking warning remains for chunks larger than 500 kB after minification.
- PWA shell: release `ba8a0e16ab6ba54a`; 20 shell files.
- Data and infrastructure: untouched. This baseline is documentation-only and does not authorize a database reset, baseline replay, schema change, deployment, live connection, cache mutation, branch switch, or merge.
- External boundaries: current Apple Calendar behavior remains an outgoing private read-only subscription. Incoming Apple Calendar context and two-way synchronization are not implemented. Private storage activation and physical-iPhone offline/relaunch or notification-delivery proof remain incomplete.

## Legacy route and action inventory

Behavior labels describe the intended Phase 4 presentation relative to the preserved current semantics: **unchanged** keeps the operation and only relocates access, **improved** changes interaction or clarity without changing domain meaning, and **additive** introduces separately reviewed persistence or behavior while retaining the existing capability.

| Legacy route or action | New destination or view | Behavior | Preservation and compatibility requirement |
| --- | --- | --- | --- |
| Today | Home → Today | Improved | Preserve the `today` destination alias and existing task, commitment, reservation, recurrence, habit, and focus facts; render one canonical actionable task presentation. |
| Capture | Global Capture; Tasks → Inbox | Improved | Preserve the `capture` alias, `create=task`, PWA shortcut, editable parsing, offline idempotent task create, templates, and review-before-create. |
| Search | Global Search | Improved | Preserve the `search` alias, `q`, task query/filter URL state, multi-entity results, and safe record-level deep links. |
| Plan | Plan → Daily/Weekly | Improved | Preserve daily-plan history, weekly ancestry, availability, templates, proposals, and deliberate rollover decisions; no automatic rollover is introduced. |
| Tasks | Tasks → Inbox/List/Board/Saved views | Improved | Preserve legacy destination IDs, lanes, ordering, filters, saved views, archive/restore, recurrence, subtasks, priorities, and phone gestures. |
| Calendar | Plan → Calendar | Improved | Preserve `/calendar`, the `calendar` destination alias and pin, all five calendar ranges, task reservations, move/resize, collision, and timezone semantics. |
| Goals | Projects & Goals → Outcome goals/Directions | Additive | Preserve existing goals, progress modes, nesting, direct task links, IDs, and history. Optional intention metadata is additive; absent metadata retains existing behavior. |
| Projects | Projects & Goals → Projects; Plan → Roadmap | Improved | Preserve standalone projects, goal/category links, lifecycle, progress, dates, archive history, milestones, and existing dependencies. |
| Habits | Habits; Home → Today due habits | Improved | Preserve the `habits` alias and pin, schedules, check-ins, skips/misses, correction history, streak facts, and goal links without rewriting past facts. |
| Focus | Global Focus; contextual Start focus | Improved | Preserve the `focus` alias and pin, linked/unlinked sessions, state, accumulated active time, notes, outcome, and estimate adjustment; reserved time never becomes actual focus automatically. |
| Connections | Settings → Connections | Improved | Preserve the `connections` alias and truthful outgoing calendar/notification status. Do not imply incoming provider events, live readiness, or synchronization that has not been implemented. |
| Insights | Review → Insights | Improved | Preserve the `insights` alias, inspectable calculations, dates, source records, drill-through, and existing goal/planning health definitions. |
| Review | Review → Rituals/Insights/History | Improved | Preserve every review period, reflection, snapshot, allocation, carryover, focus comparison, habit consistency, history, and resumable state. |
| Settings | Settings → grouped utilities | Improved | Preserve account/workspace, timezone, appearance, density, navigation, PWA/device, offline, and connection controls plus compatible device-local preferences. |
| Categories / Recycle Bin | Settings → Categories & Recycle Bin | Unchanged | Preserve restoration, archived records and history, category relationships, and the separately confirmed guarded permanent category deletion. |
| Sync review | Settings → Sync status and review | Unchanged | Preserve account/workspace-scoped snapshots, queued operations, retry, conflicts, orphan review, retained values, and explicit discard confirmation. |
| Sign out | Settings → Sign out on this device | Unchanged | Preserve confirmation, pointer/touch access above safe areas, mounted-private-state clearing, and hiding rather than deleting retained account-scoped cache. |

## Evidence rules for later slices

Each implementation slice must append one row to the opening table and identify the exact capabilities moved, affected records and mutations, URL/preference adapters, state coverage, automated checks, synthetic viewport evidence, remaining physical-device proof, and rollback boundary. A row may claim only evidence produced by that slice. Synthetic browser evidence must never be described as physical-device verification.

Rollback means routing or code rollback to the last compatible commit. It never means deleting planner records, clearing IndexedDB, erasing queued operations or conflicts, purging service-worker or unrelated caches, replaying a baseline over populated tables, or rewriting IDs/history.
