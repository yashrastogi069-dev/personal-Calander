# Agent flow and active handoff

Last updated: 2026-09-12

## Phase 4 discovery

The read-only critical audit is recorded in `PHASE4_DESIGN_AUDIT.md`. Current verdict: technically strong, visually and structurally not yet category-leading. Do not start broad styling before settling the product promise, primary audience, five-or-six-item navigation model, Today composition, visual direction, and density. Physical iPhone More scrolling and bottom-safe Settings sign-out remain verified Phase 4 defects. Notifications and reminders stay last.

Owner scenario recorded 2026-09-14: the product must handle one mixed personal day containing habits, daily tasks, meetings/appointments, documents and replies, meals/groceries/home decisions, and monthly/quarterly/yearly goals. Validate Phase 4 against interruptions and changing capacity, not just an ideal time-boxed workday. Apple Calendar is the first calendar context; Gmail remains a future integration boundary unless separately scoped. Preserve all current capabilities while reducing simultaneous exposure through grouping and progressive disclosure.

Primary Phase 4 outcome: protect follow-through. Missed habits, deferred work, interruptions, unclear next actions, and neglected long-term goals must enter an explicit recovery/review loop. Favor consistent return over punishing perfect-streak mechanics. Plan a small configurable accountability level, with structured guidance as the default and stricter/gentler behavior available without silently changing planner records. Long-term goals need milestones, workstreams/projects, next actions, timelines, evidence, stalled-state visibility, and recurring review while preserving existing flexible relationships.

Owner approved Strict accountability mode: unresolved commitments persist until explicitly resolved as Done, Reschedule, Reduce, Pause, or Abandon. Do not lock access to the application. Reduce/Pause must capture a revised scope or review point; preserve all decision history and never silently mutate or remove the underlying item.

Owner approved both long-term intention types: finishable Outcome goals and continuing Directions. Phase 4 should add project-manager-style Overview/List-or-Board/Timeline views over existing goal/project/task records. Recommended home architecture is a `Today / Overview` switch: Today executes; Overview orients with a bounded, reorderable command dashboard. Do not build a freeform enterprise widget canvas or duplicate planner records. Phone Overview is a prioritized briefing; desktop may use a composed grid.

Phase 5 boundary: the owner wants deeper recording, understanding, and analytics. Keep implementation out of Phase 4, but preserve the event/history semantics required for it. The discovery backlog is in `PHASE5_ANALYTICS_BACKLOG.md`. Use Astra selectively for complex/high-risk architecture and review work; use GPT-5.6 Sol High for implementation after the approved design contract.

Phase 4 baseline verified 2026-09-14 before implementation: direct TypeScript compilation passed; 64/64 Vitest files passed with 274 tests and 3 expected skips; Vite production build passed at 1,299.28 kB / 371.09 kB gzip for the main bundle with the known large-chunk warning; PWA shell generation passed with release `ba8a0e16ab6ba54a` and 20 files. The repository pnpm launcher attempted a registry-verified version switch and failed before compilation because registry verification/fetch was unavailable; direct checked-in `node_modules/.bin` executables were used without disabling that security check. Vitest/esbuild requires permission to spawn local worker processes in the managed Windows environment.

## Current pre-Phase 4 workbench checkpoint

- Work only on `dev/personal-calendar-workbench`; the user wants to inspect its Vercel Preview before any new `main` merge.
- Settings is now a real planner destination and owns account, sync/offline, PWA/device, phone-layout, categories, calendar/reminders, and confirmed device sign-out controls.
- The desktop rail remains fixed while the content pane scrolls and can be collapsed explicitly. Phone Tasks show one dark lane at a time through clear `To do` / `Doing` / `Done` tabs.
- Local gate is green: TypeScript; 64/64 Vitest files (274 passed, 3 skipped); production client/PWA/Vercel bundle; synthetic desktop and 390x844 browser flows. Release: `ba8a0e16ab6ba54a`.
- Do not claim physical iPhone delivery. Standards-based Web Push uses the browser-created subscription plus server VAPID credentials; no Apple Developer key is required. Apple Calendar is a private read-only `webcal://` feed. Native Apple Reminders writes would require a separate native/EventKit implementation.

## Approved reliability roadmap

The work is decomposed into four gated phases: (1) reliable installable PWA shell, (2) lean account-scoped IndexedDB operation queue and backend synchronization, (3) opt-in phone notifications/reminders plus standards-based Apple Calendar bridges, and (4) holistic iPhone UI/UX polish. Phases 1–3 are deployed and engineering-verified in Production. Physical-iPhone offline/relaunch and opt-in notification-delivery checks belong to the user. Phase 4 remains a separate design/function discussion and has not started.

Approved data behavior: automatically merge non-overlapping fields; retain both values for overlapping conflicts; never silently delete; move explicit deletes to an indefinite recycle bin; require a separate confirmed permanent-delete action. Signing out preserves but hides the account-scoped device cache and unsynchronized work. Keep the initial synchronization design lean: full snapshot plus idempotent pending operations, not CRDTs or a complex incremental event stream.

## Working branch and safety

- Branch: `dev/personal-calendar-workbench`; never merge into `main` without explicit user instruction.
- Planner data is real. Never reset the database, replay baseline migrations on populated tables, or replace IDs/workspace history.
- Current source of truth for deployment/migration status: `INDEPENDENT_STACK_HANDOFF.md`.

## Completed in the current independent stack

1. Supabase ownership migration was applied under guarded empty-table conditions.
2. Auth user ↔ application user ↔ one default owner-linked workspace is established.
3. Vercel dev-branch preview is ready and its health endpoint passed.
4. iPhone-first UI pass added safe-area navigation, 44pt controls, existing task gesture support, and device-local phone layout settings.

## Active implementation record

- `client/src/pages/Home.tsx`: phone layout preferences, tab pinning/reordering and density controls.
- `client/src/index.css`: safe-area sheet, adaptive tab bar, compact density, touch targets.
- `docs/PHONE_PREMIUM_REDESIGN_CONTRACT.md`: mobile product contract, edge-case review, and acceptance criteria.
- Preference scope: browser `localStorage`, keyed by workspace ID. It is explicitly not cross-device sync.
- Verification: `tsc --noEmit` and `vite build` passed after the UI update. The Vite large-client-chunk warning is pre-existing/non-blocking.

## Next authorized phases (in user-stated order)

1. Apply private file storage migration after reviewing existing Storage policies/bucket state.
2. Design and connect Apple Calendar/reminders and notifications; validate on a real iPhone.
3. Fix the authenticated mobile Sign out obstruction.

## Latest corrective checkpoint

The initial More sheet was structurally invalid because it lived inside a filtered sticky rail. The fixed overlay could therefore use the rail as its coordinate system. The rail is now viewport-fixed at the phone bottom without that containing effect, while More/settings overlays occupy the viewport above it. The local 390×844 Playwright flow verifies More → Customize & settings → Done and full overlay coverage. Keep this test whenever changing phone navigation, safe-area CSS, sheets, or account actions.

The installed-PWA update path now uses `personal-calander-shell-v2`, deletes older owned shell caches during activation, bypasses HTTP cache when checking `/sw.js`, and explicitly checks for a worker update after registration. This prevents a successful Vercel deployment from remaining hidden behind the original permanent phone shell cache.

Production and Preview were confirmed to use different application/data generations. Production was the August 26 legacy build with no Supabase client project URL; Preview uses Supabase project `dwiudauuuxzstbavkkqa`, whose read-only counts were one user, one workspace, and zero task/goal/project/habit records. The user explicitly accepted that old planner data would not appear in the independent stack and authorized merging/deploying the verified workbench on 2026-09-11. This authorizes code promotion only: do not reset or delete either data source.

Pre-merge visual gate: the Task board restores the exact R20/main dark state palette (To do `#2a405d` → `#15283f`; In progress `#155b59` → `#0b393b`; Completed `#1d4b3d` → `#102f27`) while retaining the workbench mobile layout and typography. The synthetic Playwright flow asserts the three computed surface tokens and no horizontal overflow at 1440×1000 and 390×844; both passed and screenshots were visually reviewed.

## 2026-09-12 PWA foundation checkpoint

- Implementation commits from `5eb764d` through `10a7344` add stable manifest identity and shortcuts, reproducible raster icons, Apple standalone metadata, a generated release-specific shell cache, honest offline fallback, controlled updates, connectivity verification, install guidance, and a safe-area-aware status surface.
- Shell release `a5f1f2018fa6b158` contains 20 explicit public files. Cache Storage excludes `/api/**`, Supabase, authorization, snapshots, mutations, attachments, and uploads. Optional runtime static entries are capped at 40 and seven days.
- Local gate: TypeScript passed; all 56 test files passed with 239 tests and 3 environment-dependent skips. The final production build passed with only the pre-existing large-client-chunk warning.
- Browser gate: four production PWA scenarios passed at 1440x1000 and 390x844 with no unexpected runtime/console errors; eight synthetic auth/workspace states and two linked planner layouts also passed. Cold offline without a prior service worker fails honestly. Cached relaunch, waiting-update activation, unrelated-cache preservation, exact task-lane colors, settings navigation, and zero horizontal overflow were verified.
- Visual inspection found and fixed PWA status overlap on the phone sign-in screen. The independent pre-existing authenticated phone Sign out obstruction remains explicitly tracked.
- Next: merge the isolated implementation into `dev/personal-calendar-workbench`, push that branch, verify Vercel Preview, then perform the real-iPhone install/relaunch/update check. Do not merge `main` without a new explicit user instruction.

## 2026-09-12 PWA deployment checkpoint

- The user explicitly authorized production promotion. Workbench commit `15d3a8f` passed its Vercel Preview gate, then identical tree `2c17978` was merged and pushed to `main`.
- Preview: health/root/manifest/worker returned 200; worker release `a19a367f5ecb20f4`; 20 public shell entries; no API entry; clean 390x844 online render.
- Production: `https://personal-calander.vercel.app` returned 200 for root and `/api/health`; manifest exposes 5 icons and 2 shortcuts; active worker release `0962e8db7704ad8f` owns exactly 20 entries and no API/Supabase entry; online 390x844 render had no overflow or runtime errors.
- The different Preview/Production release hashes are expected because their Vercel build environments produce different bundle bytes. Both were generated from the same source tree.
- User owns the remaining physical-iPhone offline/relaunch/update gate. Continue Phase 2 on `dev/personal-calendar-workbench`; do not enable notification delivery until account sync passes.

## 2026-09-12 secure-sync implementation checkpoint

- Commit `bed7e00` adds account/workspace-scoped IndexedDB snapshot, operation, conflict, and metadata stores. Cached snapshots mount only after authenticated workspace authorization; sign-out clears memory and hides the retained device cache.
- The second slice adds two additive backend tables, a bounded 25-operation replay route, idempotent receipts, task field three-way merge, and durable overlap conflicts. Guarded migration `0003_good_lady_deathstrike.sql` was applied to the verified Supabase project in one transaction; workspace/task counts were unchanged.
- Common task moves, completion, archive/restore, scheduling, and duration changes queue offline and update the matching device snapshot immediately. Unsupported entity writes remain online-only and are not falsely acknowledged.
- Verification: TypeScript passed; the full suite passed 61 files / 258 tests with 3 intentional skips, and the final production build generated shell release `9c2868b93211e476` with 20 files. A synthetic 390x844 browser check queued one task operation in IndexedDB, displayed pending status, retained exact dark work-lane colors, had no horizontal overflow, and hid cached planner UI after sign-out.

## 2026-09-12 conflict-review checkpoint

- Open server conflicts are listed through the authenticated owned-workspace router and now appear on another signed-in device, not only where the offline edit originated.
- Each overlapping task field retains base/device/server evidence. “Use this device” is version-guarded; “Keep online” performs no task write. A task changed after the conflict cannot be overwritten.
- Local conflict evidence is removed only after the selected server resolution succeeds. Orphaned queued changes have a separate two-step explicit discard that does not delete the planner record.
- Verification: 49 focused tests passed; then the complete suite passed 61 files / 258 tests with 3 intentional skips. TypeScript and the production build passed, generating PWA release `5ca7582c4a167c3b`. Desktop and 390x844 synthetic browser checks passed, including the phone conflict sheet, dark Task-lane colors, offline queue, and zero horizontal overflow.
- Current next work: the user performs physical-iPhone offline/relaunch and notification opt-in/test delivery. Then discuss and scope Phase 4 holistic phone design/functions. The private file storage migration remains a separate reviewed operation and is not implied by the Phase 2/3 release.

## 2026-09-12 scoped quick-capture checkpoint

- New quick captures use an idempotent account/workspace-scoped task-create operation and are visible immediately while offline.
- Existing localStorage captures migrate losslessly: enqueue first, remove the legacy copy second. The server's unique workspace/client-request key prevents duplicate creation after ambiguous responses.
- Complete tests, TypeScript, production build release `84daa9a657fc24cc`, and desktop/390x844 browser checks passed. The phone test retained two independent operations—one create and one update—without overflow.

Before each external/data-changing phase: refresh the relevant live audit, preserve records, make only scoped changes, and add the exact verification result to `INDEPENDENT_STACK_HANDOFF.md` and this file.

## 2026-09-14 Phase 4 visual-gate checkpoint

- Phase 4 research, audit, product architecture, capability ledger, implementation spec, 23-task execution plan, and Phase 5 analytics backlog are recorded in the `PHASE4_*` documents and `docs/superpowers/` plan/spec files. Today remains the execution home; Overview is the bounded orientation layer; long-term goals use Outcome/Direction semantics, projects, milestones, dependencies, and explicit review/recovery.
- Tasks 1–3 are complete through commit `07a0bc8` on `dev/personal-calendar-workbench`. The isolated authenticated `/phase4-prototypes` route contains three feature-parity directions over one immutable synthetic fixture: A Verdigris Workbench, B Quiet Agenda, and C Night Instrument. It has no planner/backend/offline/account mutation path.
- Task 3 final verification: 31/31 focused tests, TypeScript, and production build passed. Independent review confirmed truthful task detail, portable JSX-bound interaction handlers, single auth boundary, A/B contrast, exact R20 lane colors, 14px functional text, 44×44px targets, reduced motion, and source isolation. The existing large main-chunk warning remains.
- Task 4 local preview harness is implemented but intentionally uncommitted until the owner visual decision. Authoritative synthetic Chromium evidence is `%TEMP%\personal-calendar-phase4-prototypes-fix1-clean-20260914-220312`: 13/13 harness self-tests, 18/18 browser scenarios, 38/38 manifest entries, both densities across all core views, zero runtime/console/unexpected/planner requests or overflow, and minimum 44×44px targets / 14px functional text / 5.034:1 sampled contrast. Fresh independent review returned 0 Critical, 0 Important, 0 Minor.
- Current gate: owner must select A/B/C, lane treatment, default density, and motion refinement. Recommended production direction is A as the default light architecture with exact R20 lanes, C as the selectable dark theme, comfortable default density, and the tested short sheet transition with reduced-motion fallback. Selection authorizes production styling only; it does not authorize schema migration, push, deployment, merge, feature removal, data mutation, or integrations.
- Phase 5 analytics remains deferred. Preserve provenance/history/event semantics during Phase 4; do not build analytics surfaces yet.
