# Project state

Updated 2026-10-01. Read [the independent stack handoff](INDEPENDENT_STACK_HANDOFF.md) for the most detailed and current migration record. This file is the quick status board.

| Area | Current state | Evidence / next gate |
| --- | --- | --- |
| Branch | `dev/personal-calendar-workbench`; `main` frozen R20 | No merge authorization for the current branch |
| Phase 1 PWA | Engineering and deployment recorded historically | Physical iPhone offline/relaunch result remains a separate user check |
| Phase 2 sync | Task-first offline queue, replay, conflict review and account-scoped cache implemented | Broader offline entity writes are not claimed |
| Phase 3 integrations | Read-only private calendar feed, push/reminder infrastructure and opt-in surfaces implemented | Installed iPhone delivery/permissions require real device evidence; private files and incoming Apple Calendar remain deferred |
| Phase 4 | Tasks 1–17 have local slice evidence; Task 17 independent review findings were repaired; Task 18 Habits is next | Latest local gate: 92 Vitest files / 596 passed / 3 skipped, TypeScript and client/PWA build passed. Screenshot-free synthetic Roadmap checks passed at 320/390/768/1440; authenticated Preview and whole-app signoff remain open; see [coverage map](PHASE4_UI_UX_COVERAGE.md) |
| Phase 5 | Backlog only | Deeper analytics follow Phase 4; [backlog](PHASE5_ANALYTICS_BACKLOG.md) |
| Schema | 0004/0005 are additive and locally tested, not live-approved | Fresh strict-TLS read-only inventory, restore-tested backup, exact approval packets and compatible rollout required |
| Deployment | Current Task 17/UX checkpoint is local pending dev-branch delivery | Current Vercel Preview and live schema have not been verified for these changes; do not treat a branch push as deployment approval until infrastructure gates pass |
| Agent memory | Local SQLite session/memory CLI is implemented and tested; capture is explicit | Fresh-process integration evidence is in `npm run test:agent-memory`; host transcript auto-capture is unavailable |

Task 16 local evidence: focused tests 4 files / 56 tests passed; TypeScript and production build passed (PWA release `d5e3e702cee7cabe`, 22 shell files); authenticated local browser verified Projects/Outcome/Directions navigation, selected-goal linked work, and an unsubmitted new-Direction form with no runtime errors. Live Supabase schema, Vercel Preview, and physical-device evidence remain open. See [slice evidence](PHASE4_SLICE_EVIDENCE.md).

2026-10-01 UX slice evidence: TypeScript passed; Focus/Today tests passed 3 files / 33 tests; production build passed (PWA release `8f971e9f89586773`, 22 shell files); local browser showed one phone Today primary action and no runtime errors. A previously active Focus session rendered an unusually long 7,788-minute timer; it was not changed. Later local pass adds A-token shell/Focus/Today/Calendar styling, 44px sign-in controls, readable timer duration, and a safe mobile Calendar action row. Whole-app authenticated visual QA remains incomplete. Details: [slice evidence](PHASE4_SLICE_EVIDENCE.md).

## Immediate sequence

1. Push the reviewed Task 17 dev-branch checkpoint, then implement Task 18 Habit return/correction. Continue Tasks 19–22 and whole-app signoff in bounded, feature-preserving slices.
2. Resolve the independent stack live database audit and migration approval prerequisites without modifying existing records by assumption.
3. Verify workbench Preview and then conduct the separately scoped physical iPhone checks. Notifications and reminders remain the final feature area.

Do not treat earlier dated success claims as proof of current live state. Verify the exact deployment, schema, and record counts before release decisions.
