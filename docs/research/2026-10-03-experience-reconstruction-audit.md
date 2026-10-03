# Experience reconstruction: competitor and current-app audit

Date: 2026-10-03. Owner: primary agent. Status: research and proposed direction, not an implemented redesign or release signoff. Branch: `dev/personal-calendar-workbench`, audited baseline `ae34886`.

## Conclusion

The problem is not a missing decorative style. The app exposes too much implementation structure, repeats orientation and explanation, and loses work context between surfaces. Reconstruct the experience around Capture -> Plan -> Do -> Recover -> Review -> Reconnect, retaining the existing record identities, features, history and mutation boundaries.

Sunsama supplies the strongest daily orchestration reference; Asana and Linear supply contextual project/view continuity; Monday supplies labelled color semantics; Morgen supplies inspectable scheduling proposals. Do not copy their enterprise scope, automatic archival, or history loss. Maintain the approved Variant A direction and exact R20 dark task lanes.

## Evidence and independence

- Primary agent reviewed all 60 supplied desktop PNGs in `Screenshots of competition`, in lexicographic filename order. Original files were not modified or committed. Numbering below follows that order.
- SOL 6 High independently audited navigation, canonical surfaces and retained legacy tools; SOL 6 Medium independently researched daily planning and additional products using official sources. Neither modified product code.
- Astra High independently reviewed the 60 references, product contracts, relevant source and official documentation through the explicitly approved read-only Codex CLI. Its initial consultation did not yet have current app images. The completed bounded eight-image synthetic visual follow-up confirms the composition findings below; no further Astra process is running.
- Fresh local synthetic browser harness: 81 captured views/states, 390x844 and 1440x1000, light/dark. Its final stdout reported `runtimeErrors: []` and `unexpectedRequests: []`. The capture manifest independently records 81 entries and 78 document-overflow measurements, none positive; it does not store console/runtime errors. This does not prove contained grids, controls, contrast or physical iPhone usability.
- All browser API requests were intercepted, including auth and planner mutations. No actual planner write occurred. External fonts were stubbed; real Onest rendering and font-loading performance were not verified.
- Current visuals were inspected for Today, selected project, Habits, Focus, Roadmap and Settings. Large full-page images can show fixed navigation at the initial viewport boundary; that image artifact is not evidence that navigation scrolls incorrectly.
- Static references do not establish animation quality, keyboard behavior, undo, synchronization or competitor mobile parity. No signed-in competitor workflow was tested. Cal.com and Calendly have no supplied screenshots. No physical-device or live Preview check occurred.

## Current-app findings

| Finding | Evidence | Required correction |
| --- | --- | --- |
| Competing orientation before work | Desktop Today repeats shell title/date, a large promotional introduction, date ornament and five summary cells; phone adds global capture and sync messaging first | One compact header; next action and real work first; expandable capacity facts |
| Context is buried | Selected project appears below the full project picker and a second introduction | Project selection opens a stable working context; compact switcher and Back, no duplicate portfolio above detail |
| Navigation promises more than it renders | Source audit: `shared/phase4Navigation.ts` distinguishes Overview, Weekly and History; `Home.tsx` collapses these onto other surfaces | Implement distinct responsibilities and preserve canonical/legacy links; source finding still needs explicit alias-route runtime assertions |
| Task settings expose implementation early | `TaskDetailSheet.tsx` presents many timing, lifecycle, relationship and diagnostic fields | Decision-oriented inspector with progressive disclosure; preserve every existing value and action |
| Habits have useful visuals but dense repeated actions | Current phone view includes practice list, day summary, seven-day tick trace, month calendar, date facts and selected habit return panel | Keep all visuals and corrections; clearer Practice/History boundary, selected-date context and less repeated copy |
| Focus competes with daily orientation | Full Focus view includes setup, measurement and orchestration sections; global control already exists | Preserve larger full-width Home watch option, use compact contextual companion elsewhere, disclose supporting tools |
| Technical status dominates unrelated work | Synthetic sync-review banner and incoming-calendar caveat occupy significant space | Keep actionable conflict visibility, shorten routine status; put connection diagnostics in Settings; never imply unknown incoming availability is free |
| Typography/color need semantic restraint | Large/heavy headings and repeated uppercase metadata; repeated mint panels and bordered cards | A-derived neutral canvas, clear text hierarchy, one primary action per region; state colors always labelled |

These are priority and composition judgments, not a claim that every displayed text fails contrast. Impeccable's source detector returned three side-tab warnings, not an accessibility pass: Today recovery stripe, Roadmap task-point accent and a likely false-positive Habit row border. Actual contrast, focus order and hit regions require measured verification after changes.

### Astra cross-check of SOL and rendered evidence

Astra's completed visual follow-up confirms that the phone shell consumes roughly 290px before destination content; Today presents no task or habit before bottom navigation in the supplied first viewport. On desktop, empty chronology occupies the broader column while actual flexible work wraps in a narrower column. The selected project is displaced by an expanded chooser. Phone Roadmap reaches its Months heading before navigation, with work below the initial viewport. Habits, Settings and Focus repeat container/intro treatments that compete with their controls.

Corrections: compact shell and actionable review status; work-first Today; compact selected-project switcher; merged Roadmap toolbar/current-period opening; consistent insets and fewer nested borders. A's warm neutrals and verdigris are a coherent foundation. Real-font hierarchy and interaction quality still require testing. These eight previews do not contain an active Home watch or Board lanes, so they provide no basis for shrinking the approved watch option or changing dark lanes.

Astra corrected two SOL research details (Morgen range and deprecated Booker docs, noted under sources). Its first source review independently supports contextual project views, inspector disclosure and removal of duplicate presentation only after capability parity. This is agreement on a proposed direction, not approval of an unbuilt implementation or proof that all SOL assertions are correct.

An additional SOL independent plan review identified and resolved six planning issues: distinguish R2 route scaffolding from R5 content completion; preserve capture/PWA entry intent before changing defaults; reconcile action-level capability parity at each moved surface; explicitly retain every Review period/evidence source; specify exact live approval/rollback packets; and distinguish runtime-error stdout from the narrower manifest evidence. No product implementation was part of that review.

## Competitor findings and what to transfer

| Product | Useful pattern | Apply here / reject |
| --- | --- | --- |
| Sunsama | Guided planning, work/calendar juxtaposition, weekly objectives and deliberate shutdown | Reopenable connected planning ritual; reject silent carry/archive and replacing missing actual time with an estimate |
| Asana | Multiple lenses on project work, contextual inspector, milestones and goal relationships | Same IDs/actions across List/Board/Calendar/Timeline; reject enterprise navigation and mandatory assignment |
| Monday | Named status fields mapped consistently to colors, saved/grouped views | Stable labelled task lanes and restrained status accents; reject simultaneous saturated state/priority/category treatments |
| Morgen | Calendar plus tasks, metadata capture and preview/approve scheduling | Editable proposals and reasons work was excluded; no autonomous rearrangement or new Frames subsystem by default |
| Cal.com / Calendly | Separate organizer configuration from booking decisions; explain unavailable slots | Clear timezones, collision reasons and truthful connection states; not a booking-platform expansion |
| Akiflow | Inbox versus planned Today versus calendar-reserved work; planning rituals | One task identity across contexts; explicit recovery rather than silent rollover |
| TickTick | Optional habits/calendar overlays and historical check-in correction | Habits visibly contribute to Today without becoming ordinary tasks; configurable overlays retain history |
| Amazing Marvin | Optional strategies, ongoing versus finishable goals, trackers | Useful defaults plus bounded customization; reject documented goal check-in history loss |
| Linear | Focused project Overview, milestones, filtered views and contextual peek | Project-level orientation with tasks one step deeper; provide phone/pointer alternatives to keyboard shortcuts |

Official sources, accessed 2026-10-03:

- Sunsama: [daily planning](https://help.sunsama.com/docs/usage-guides/daily-planning/), [weekly objectives](https://help.sunsama.com/docs/usage-guides/weekly-objectives/), [planned/actual time](https://help.sunsama.com/docs/usage-guides/tasks/planned-and-actual-times/), [rollover](https://help.sunsama.com/docs/getting-started/basics/task-rollover-and-recurring-tasks-the-basics/).
- Asana: [project views](https://asana.com/features/project-management/project-views), [timeline](https://help.asana.com/s/article/timeline), [navigation](https://help.asana.com/s/article/navigating-asana), [goal evidence](https://help.asana.com/s/article/progress-status-and-connecting-work-to-goals). Some Help pages returned a Salesforce shell on direct open; indexed official text and owner screenshots support the scoped findings, not authenticated behavior.
- Monday: [Status column](https://support.monday.com/hc/en-us/articles/360001269685-The-Status-Column), [board views](https://support.monday.com/hc/en-us/articles/360001267945-The-board-views), [Gantt](https://support.monday.com/hc/en-us/articles/360015643840-The-Gantt-Chart-View-and-Widget), [documented mobile view limits](https://support.monday.com/hc/en-us/articles/360015740220-Mobile-app-board-views).
- Morgen: [command bar](https://www.morgen.so/guides/create-events-and-tasks-with-command-bar), [AI planning](https://www.morgen.so/guides/plan-your-day-using-the-ai-planner), [Frames](https://www.morgen.so/guides/how-to-use-frames). Astra corrected the earlier SOL planning-range summary: the currently consulted guide says up to eight days, not 1-7. This limit is not our product requirement.
- Calendly: [event types](https://help.calendly.com/hc/en-us/articles/360044700074-Create-a-new-event-type), [availability diagnostics](https://help.calendly.com/hc/en-us/articles/223145627-How-to-use-Calendly-s-Troubleshoot-Tool).
- Cal.com: [availability](https://cal.com/docs/availability), [FAQ](https://cal.com/scheduling/frequently-asked-questions), [Booker documentation](https://cal.com/docs/platform/atoms/booker). Astra flagged Booker Atom documentation as deprecated: interaction reference only, never a recommended dependency.
- Akiflow: [Today](https://product.akiflow.com/articles/0741055-today-page), [rituals](https://product.akiflow.com/articles/0805246-rituals).
- TickTick: [habit FAQ](https://help.ticktick.com/articles/7055792921664028672), [calendar overlays](https://help.ticktick.com/articles/7055782085826445312), [features](https://ticktick.com/features).
- Amazing Marvin: [optional strategies](https://help.amazingmarvin.com/en/articles/1951470-how-to-turn-features-on-and-off-with-strategies), [goals](https://help.amazingmarvin.com/en/articles/5015479-goals-objectives), [trackers](https://help.amazingmarvin.com/en/articles/5015912-trackers).
- Linear: [project Overview](https://linear.app/docs/project-overview), [projects](https://linear.app/docs/projects), [display options](https://linear.app/docs/display-options), [custom views](https://linear.app/docs/custom-views), [peek](https://linear.app/docs/peek).

## Complete screenshot coverage

| Reference numbers | Visible evidence |
| --- | --- |
| 01-06 Sunsama | Planning tasks/calendar; documenting plan; day board; shutdown-time prompt; daily highlights; shutdown review |
| 07-12 Sunsama | Backlog horizons; folder creation; Asana source panel; Gmail connection panel; weekly objectives; Focus/subtasks |
| 13-18 | Morgen task/calendar, account selector, command palette; Monday grouped tables and colored Kanban |
| 19-24 | Monday alternate Kanban; Asana Timeline, Calendar, Board and List onboarding; dashboard |
| 25-30 Asana | Calendar checklist; task inspector; subtasks/attachments/activity; customization; dependencies; Home widgets |
| 31-36 Asana | Notification Inbox (not task-capture Inbox); My Tasks; two view choosers; project List; dashboard |
| 37-42 Asana | Gantt; workload; Timeline; project Overview; Goals example hierarchy; goal period picker |
| 43-48 | Asana goal details/related work/custom field; Sunsama horizon, channel and priority pickers |
| 49-54 Sunsama | Weekly objectives; estimate/actual shutdown; what-can-wait stage; calendar layers; integrations; day board/calendar |
| 55-60 | Sunsama future board, insufficient-data analytics, workspace menu, three-day/week calendars; Morgen task timing editor |

Some references show onboarding illustrations rather than populated working surfaces. Private email addresses and example planner content visible in originals are not reproduced in this document. No iPhone reference was supplied.

## Proposed experience contract

Home defaults to **Today**, a proper execution dashboard. **Overview** is a distinct sibling for cross-horizon attention and bounded module customization, not a duplicate agenda. The six primary destinations remain Home, Tasks, Plan, Projects & Goals, Habits and Review. Settings owns account/sign-out, appearance, planning defaults, sync/conflicts, connections, categories/recycle and device controls.

Today answers what to do now; Overview answers what needs a decision. Tasks owns capture Inbox and saved views. Plan owns daily/weekly rituals, Calendar and portfolio Roadmap. Projects owns its contextual views, milestones and next actions. Review separates rituals, Insights and historical evidence.

Desktop uses a stable collapsible rail, one compact header and at most two working regions plus an overlay/replacement inspector. Phone uses deliberate compact ordering, agenda/day by default, one Board lane at a time, keyboard-safe detail sheets and customizable bottom pins. Features remain reachable through clear disclosure, not removed.

See [the staged implementation proposal](../superpowers/plans/2026-10-03-experience-reconstruction.md). Deeper analytics stays Phase 5. Notifications remain last. Incoming Apple Calendar and migrations remain separately gated.

## Evidence status

Executed: `python scripts/preview-ui-review.py --url http://localhost:3000/ --widths 390,1440 --output <OS-temp-review-folder>` (exit 0, 81 captures); manifest inspection (78 overflow measurements, zero positive); documentation local-link validation (two documents, zero broken local links); `git diff --check` (passed, only LF/CRLF notices); fresh-process agent-memory search retrieved the checkpoint. Synthetic captures remain outside committed files. The temporary audit server was stopped after capture.

Research and synthetic visual baseline only. Unit/integration tests, TypeScript and production build were not rerun for this documentation-only audit; earlier T19 results remain historical evidence, not redesign evidence. No new product implementation, database operation, push, deployment or main merge occurred. Remaining risks: feature loss during consolidation, contextual navigation regressions, timing-semantic confusion, misleading integration status and insufficient real-device/accessibility evidence.
