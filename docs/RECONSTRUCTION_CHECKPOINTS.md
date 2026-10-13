# Reconstruction checkpoint board

## 2026-10-04 premium v2 first checkpoint (current)

Source checkpoint `09a52f0` pushed/remote-confirmed; docs-only receipt follow-up on the same new branch. Hard stop for owner review. No Vercel check per owner instruction.

Current branch after verification: `dev/personal-calendar-premium-v2`, owner-requested auto Preview enabled. Leave old workbench remote at `85b4014`, main frozen. Selected screenshots are the minimum visual benchmark; prefer coherent modern icons and useful flow over decoration. Preserve every capability. Stop here for owner review.

Implemented: visible white/blue and slate-dark shell, Task List/grouped complete inspector, Today Tasks/Habits desktop bento, day context/milestone/remaining decisions, factual 28-day heatmap plus individual trace/actions, half-canvas full Focus watch with Next steps/context. Workspace today refreshes overnight without resetting deliberate planning dates.

Evidence: final full suite748 passed /3 skipped, TypeScript and client/server/PWA build passed; Home/Tasks48/48, empty16/16, inspector8/8, capture17/17, actual Onest/shell4/4, Focus16/16 with intercepted planner APIs. Vercel verification intentionally owner-owned. [Delivery/limits](PHASE4_SLICE_EVIDENCE.md).

2026-10-13: C3 dated weekly Plan board, selected-day continuity and Calendar/task handoffs verified locally (`8a242e6`); Tasks Board drag remains for redesign step D3. Remaining: complete Tasks/Board refinements (C3); project/goal Timeline/Roadmap and linked views (C4); remaining Habit history/return refinements (C5); configurable Overview/Review/Settings (C6); supported Calendar/provider connections and real reminders (C7); whole-app accessibility/error/offline/performance, physical-device and approved live infrastructure release gates (C8). This checkpoint advances C3/C5 presentation, not every phase. [Selected Timeline/Week concepts and plan](superpowers/plans/2026-10-04-premium-v2-checkpoint.md). Earlier dated sections below are historical.

Updated 2026-10-03. Branch: `dev/personal-calendar-workbench`. Main remains frozen. C1 is pushed as `f728f16` (handoff `e49b7a1`); C2 is pushed and remote-confirmed as `85b4014`. Actual screenshot-led Today/Tasks/shell reconstruction is in progress under [the visible build plan](superpowers/plans/2026-10-03-visible-workspace-reconstruction.md). The screenshot is the minimum standard, with calm useful improvements expected beyond it. One owner-approved Astra Medium consultation finished; SOL implements. This is not full-app or live-release completion.

## C2: locally verified connected workspace

Distinct Today/Overview, daily/weekly Plan and Review history/Insights; grouped existing Settings; exact navigation/pin behavior; entity-family record safety; task inspector hierarchy; account/workspace-scoped session drafts and deliberate retries. All existing capabilities remain. This is functional continuity, not the screenshot-faithful visual redesign.

Evidence: final `npm run check` and `npm run build` passed; full `npm test` 111 files / 736 passed / 3 skipped. Build `63500b9ea2efb542`, 28 PWA shell files. Final post-review navigation 72/72 with 72 clear document-width measurements, PWA/pins 16/16, phone grid 8/8, lazy Planning Settings 8/8; root inspector 16/16 and capture 17/17. All browser APIs synthetic/intercepted, no screenshots. Prior dev-server interruption was rerun, not counted as an application pass/failure. Independent review's unpin, duplicate Connections, wrong entity ID and capture retry races were corrected and checked. The newly introduced Plan static import regression was removed; existing Search/bundle warnings remain.

Limits: actual fonts, physical iPhone/VoiceOver/PWA and live integrations are unverified. Cross-account late capture feedback and blocked session storage have unit/guard coverage, not rendered browser evidence. Impeccable detector: no primary findings, 26 advisories for legacy colors/contextual font/radius values; not a whole-app design/accessibility pass. User-requested 1M Codex config remains an unverified provider-capacity override.

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

The C1 hard stop was satisfied. After C2 verification, the owner explicitly requested its push and the actual screenshot-led visual redesign. That supersedes the C2-only stop, not live database/deployment gates. Build complete visible workflows, not another foundation-only checkpoint. Astra still needs fresh explicit permission.
