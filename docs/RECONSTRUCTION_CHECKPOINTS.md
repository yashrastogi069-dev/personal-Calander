# Reconstruction checkpoint board

Updated 2026-10-03. Branch: `dev/personal-calendar-workbench`. Main remains frozen. Current checkpoint: C1 verified locally and pushed as `f728f16`; a read-only GitHub ref check confirmed the exact commit. Work is stopped at the owner's requested checkpoint. This is not full-app or live-release completion.

## C1: white/blue foundation

Implemented: true white light working canvas, subtle neutral rail, blue selection/actions, named supporting color tokens and slate dark; retained exact R20 dark Task lanes. Compact shell, persistent parent/exact navigation semantics, native expandable Quick entry preserving draft/defaults. Today places flexible work first and preserves all metrics in expandable capacity, with visible disclosure cue. Selected project uses compact switcher/context and opens task details from List; archived detail retains its own return control. Existing Habit trace/calendar/corrections and Settings controls remain.

Owner-authorized Git checkpoint guard: `vercel.json` disables automatic deployment for this branch only. Other branches retain default behavior. The owner-requested `.codex/config.toml` contains `[skills] include_instructions = false`; effectiveness depends on host/runtime support and does not erase existing session context.

### Evidence

- Final `npm run check`: passed.
- Final `npm test`: 104 files passed; 684 tests passed / 3 skipped. Initial sandbox attempt could not launch esbuild; final suite succeeded through the reviewed local execution path.
- Final focused corrections/configuration: 5 files / 27 passed before full-suite rerun.
- `npm run build`: passed, client/PWA/server. Release `c8b25e03ad3c7b5e`, 27 shell files. Existing large main-bundle and mixed static/dynamic search-import warnings remain; performance/hosting work is deferred.
- Final synthetic browser harness: 46 captured states across 320/390/768/1440px, light/dark, Today/Projects/Roadmap/Habits/Settings. Final stdout reported no runtime errors or unexpected requests. Forty manifest document-overflow measurements were all negative.
- Runtime assertions include white/slate semantic surfaces, Quick entry close/reopen draft preservation, selected-project identity across Board/Timeline, archived-project return, Habit trace/calendar/history/settings and phone More. All auth/planner requests were intercepted; no actual planner write.
- Final manual visual inspection: desktop light Today and phone dark Projects. External fonts were stubbed by the harness; real Onest loading and physical-device rendering remain unverified. Contrast token tests pass; this is not a whole-app accessibility audit.
- `git diff --check`: passed, LF/CRLF notices only. Screenshots outside Git: `%LOCALAPPDATA%/Temp/personal-calendar-blue-checkpoint1-final-20261003`.

Earlier harness failures were obsolete selected-card/return selectors and a test sequence returning before testing archived Board; assertions were repaired while retaining ID/URL/control checks. Independent SOL review identified the actual archived-return regression; it was fixed and covered by component and runtime tests. No source change was hidden as a test-only repair.

### Files

Application: shell/rail/styles/semantic tokens/new blue theme; Today component/style; ProjectsGoals/ProjectDetail and styles; index theme import. Tests: shell/theme/project detail, design foundation/Today and checkpoint guard. Harness: `scripts/preview-ui-review.py`. Configuration: `.codex/config.toml`, `vercel.json`. Documentation: current contract/plan, design/evidence/status/decision/memory files and approved synthetic concept reference. Supplied competitor screenshots, unrelated `.playwright-cli` artifacts and secrets are not staged.

## Remaining phases before a final core release

| Phase | Remaining work | Exit evidence |
| --- | --- | --- |
| C2: connected navigation/details | Real Today/Overview and Review child routes, stateful view/context continuity, task inspector organization, drafts/Back/reload and complete capture-entry parity | Route/inspector regressions, both-theme phone/desktop runtime, action ledger |
| C3: Tasks and planning | Refined List/status Board/saved/bulk tools; Sunsama-inspired dated planning board beside Calendar; daily/weekly stage/date handoffs; true calendar horizons and reviewed schedule/undo actions | One ID across lenses, timing semantics, collision/recovery/offline tests |
| C4: Projects/Goals/Timeline | Complete project views/task actions, portfolio Roadmap and selected-task timeline refinement, milestones/dependency consequences, standalone and legacy goal/progress tools | Capability parity per action; archive/restore and linked-flow tests |
| C5: Habits/Focus continuity | Refine practice/history/return and Home placement without losing tick/calendar; readable Focus/handoff/orchestration and duration facts | Habit correction/history/return and Focus concurrency/offline regressions |
| C6: Overview/Review/Settings | Reorder/hide dashboard modules with factual habit evidence; all review periods/history/Insights; grouped account/layout/sync/connection settings | Persistence/reset, drill-through, period/source coverage and device layout tests |
| C7: calendar connections/reminders | Google dedicated Calendar OAuth, selected read-only event/busy sync, token encryption/revocation/recovery; Apple supported-authorization gate; existing private outgoing ICS and push/reminders retained | Provider configuration/consent, secure persistence approval, real connection and delivery evidence |
| C8: final whole-app acceptance/release | Every ledger action, loading/empty/error/offline/conflict/large-data states, keyboard/contrast/zoom/touch, physical iPhone/PWA; exact live rollout approval and authenticated branch checks | Full suite/typecheck/build/runtime, actual device evidence, migration/backup/compatibility/deployment gates |

These are remaining bounded workstreams, not promises that every connector is available. Google app/consent configuration and Apple's accessible supported authorization require owner/provider input. Outgoing Apple subscription is not incoming/two-way sync. Existing migrations 0004-0006 remain local and not live-approved. Deeper analytics belongs to Phase 5; dedicated speed/hosting optimization remains later by owner choice. No main merge, live migration or deployment is included in C1.

## Stop instruction

After the verified C1 GitHub push, stop all agent work and wait for the owner's next instruction. Do not start C2 or provider implementation on the strength of the earlier loop request.
