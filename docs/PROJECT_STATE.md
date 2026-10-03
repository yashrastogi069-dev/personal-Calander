# Project state

Updated 2026-10-03. Read [the independent stack handoff](INDEPENDENT_STACK_HANDOFF.md) for the most detailed and current migration record. This file is the quick status board.

| Area | Current state | Evidence / next gate |
| --- | --- | --- |
| Branch | `dev/personal-calendar-workbench`; `main` frozen R20 | No merge authorization for the current branch |
| Phase 1 PWA | Engineering and deployment recorded historically | Physical iPhone offline/relaunch result remains a separate user check |
| Phase 2 sync | Task-first offline queue, replay, conflict review and account-scoped cache implemented | Broader offline entity writes are not claimed |
| Phase 3 integrations | Read-only private calendar feed, push/reminder infrastructure and opt-in surfaces implemented | Installed iPhone delivery/permissions require real device evidence; private files and incoming Apple Calendar remain deferred |
| Phase 4 | Tasks 1–18 have local slice evidence; T19 watch/orchestration baseline is pushed, and the durable Focus extension is locally implemented but not pushed/deployed | T19 extension: 100 test files / 668 passed / 3 skipped, TypeScript/build, 16/16 established and 8/8 durable synthetic browser cases passed. Live migration, authenticated Preview, physical iPhone, and whole-app signoff remain open |
| Phase 5 | Backlog only | Deeper analytics follow Phase 4; [backlog](PHASE5_ANALYTICS_BACKLOG.md) |
| Schema | 0004/0005/0006 are additive and locally tested, not live-approved | Fresh strict-TLS read-only inventory, restore-tested backup, exact approval packets and compatible rollout required; do not apply 0006 from a local test result |
| Deployment | T18/T19 are the current dev-branch checkpoint; verify the remote commit before claiming Preview availability | Current Vercel Preview and live schema have not been verified for these slices; a branch push is not deployment approval until infrastructure gates pass |
| Agent memory | Local SQLite session/memory CLI is implemented and tested; capture is explicit | Fresh-process integration evidence is in `npm run test:agent-memory`; host transcript auto-capture is unavailable |

Task 16 local evidence: focused tests 4 files / 56 tests passed; TypeScript and production build passed (PWA release `d5e3e702cee7cabe`, 22 shell files); authenticated local browser verified Projects/Outcome/Directions navigation, selected-goal linked work, and an unsubmitted new-Direction form with no runtime errors. Live Supabase schema, Vercel Preview, and physical-device evidence remain open. See [slice evidence](PHASE4_SLICE_EVIDENCE.md).

2026-10-01 UX slice evidence: TypeScript passed; Focus/Today tests passed 3 files / 33 tests; production build passed (PWA release `8f971e9f89586773`, 22 shell files); local browser showed one phone Today primary action and no runtime errors. A previously active Focus session rendered an unusually long 7,788-minute timer; it was not changed. Later local pass adds A-token shell/Focus/Today/Calendar styling, 44px sign-in controls, readable timer duration, and a safe mobile Calendar action row. Whole-app authenticated visual QA remains incomplete. Details: [slice evidence](PHASE4_SLICE_EVIDENCE.md).

## Experience reconstruction audit: 2026-10-03

Current checkpoint C1 is locally verified (104 test files, 684 passed / 3 skipped; TypeScript/build; 46 intercepted browser states). White working background is retained. Owner authorized branch checkpoint pushes with branch-only automatic deployment disabled, then requested a hard stop after C1. See [remaining phases](RECONSTRUCTION_CHECKPOINTS.md). No C2/Overview/provider implementation has started. No live migration, deployment or main merge is approved by this checkpoint.

Latest owner instruction: the blue/porcelain preview is approved for local implementation with more semantic color, light/slate-dark themes and preserved features. Theme/shell, Today and selected-project foundation are in progress under disjoint SOL scopes. [Current contract](superpowers/specs/2026-10-03-blue-workspace-reconstruction.md) supersedes A-green identity and the earlier proposal-only status below. No new implementation verification/deployment claim yet. Apple/Google calendar/reminder work follows supported-provider/live gates; hosting optimization remains later.

The owner authorized further competitive research and planning after the T19 stop. SOL and approved Astra High consultations reviewed all 60 competitor references and current source; a bounded Astra visual follow-up reviewed eight current synthetic viewports. A fresh 81-state synthetic browser baseline had no runtime errors or unexpected requests; 78 measured cases had no document-level horizontal overflow. This is not whole-app accessibility or physical-device signoff. [Audit](research/2026-10-03-experience-reconstruction-audit.md) and [proposal](superpowers/plans/2026-10-03-experience-reconstruction.md).

No redesign implementation or deployment occurred. Next proposed work is a Today/selected-project/task-inspector prototype with capability preservation, followed by navigation, connected workflows, Overview/Review/Settings and whole-product verification. Deeper analytics remains Phase 5 and notifications last. Current local T19 checkpoint is `ae34886`; its complete suite result is 672 passed / 3 skipped, as recorded in the handoff (the older summary count above is superseded).

## Immediate sequence

1. T19 local durable follow-up is verified and stops at this checkpoint. Explicit habit attribution and saved next actions need a separately approved live 0006 rollout before they can work on Preview; custom Routine Conductor editing/history is deferred. Task 20 customizable Overview, Task 21 Review/Settings consolidation, Task 22 whole-app signoff/performance, and Task 23 notifications remain later and are not started by this checkpoint.
2. Resolve the independent stack live database audit and migration approval prerequisites without modifying existing records by assumption.
3. Verify workbench Preview and then conduct the separately scoped physical iPhone checks. Notifications and reminders remain the final feature area.

Do not treat earlier dated success claims as proof of current live state. Verify the exact deployment, schema, and record counts before release decisions.
