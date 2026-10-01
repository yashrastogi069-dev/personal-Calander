# Project state

Updated 2026-10-01. Read [the independent stack handoff](INDEPENDENT_STACK_HANDOFF.md) for the most detailed and current migration record. This file is the quick status board.

| Area | Current state | Evidence / next gate |
| --- | --- | --- |
| Branch | `dev/personal-calendar-workbench`; `main` frozen R20 | No merge authorization for the current branch |
| Phase 1 PWA | Engineering and deployment recorded historically | Physical iPhone offline/relaunch result remains a separate user check |
| Phase 2 sync | Task-first offline queue, replay, conflict review and account-scoped cache implemented | Broader offline entity writes are not claimed |
| Phase 3 integrations | Read-only private calendar feed, push/reminder infrastructure and opt-in surfaces implemented | Installed iPhone delivery/permissions require real device evidence; private files and incoming Apple Calendar remain deferred |
| Phase 4 | Tasks 1–15 have local slice evidence; Task 16 functional slice is implemented locally | Task 16 local verification passed; production build and branch delivery remain gates. Then Tasks 17–22 and whole-app signoff; see [implementation plan](superpowers/plans/2026-09-14-phase4-total-product-redesign.md) |
| Phase 5 | Backlog only | Deeper analytics follow Phase 4; [backlog](PHASE5_ANALYTICS_BACKLOG.md) |
| Schema | 0004/0005 are additive and locally tested, not live-approved | Fresh strict-TLS read-only inventory, restore-tested backup, exact approval packets and compatible rollout required |
| Deployment | Current Task 16 follow-up changes are local and uncommitted | Current Vercel Preview and live schema have not been verified for these changes |
| Agent memory | Local SQLite session/memory CLI is implemented and tested; capture is explicit | Fresh-process integration evidence is in `npm run test:agent-memory`; host transcript auto-capture is unavailable |

Task 16 local evidence: focused tests 4 files / 56 tests passed; TypeScript and production build passed (PWA release `d5e3e702cee7cabe`, 22 shell files); authenticated local browser verified Projects/Outcome/Directions navigation, selected-goal linked work, and an unsubmitted new-Direction form with no runtime errors. Live Supabase schema, Vercel Preview, and physical-device evidence remain open. See [slice evidence](PHASE4_SLICE_EVIDENCE.md).

## Immediate sequence

1. Finish Task 16's functional gaps, then Task 17 project views and Roadmap, Habits, persistent Focus, customizable Overview, consolidated Review/Settings, and Task 22 whole-app quality gate.
2. Resolve the independent stack live database audit and migration approval prerequisites without modifying existing records by assumption.
3. Verify workbench Preview and then conduct the separately scoped physical iPhone checks. Notifications and reminders remain the final feature area.

Do not treat earlier dated success claims as proof of current live state. Verify the exact deployment, schema, and record counts before release decisions.
