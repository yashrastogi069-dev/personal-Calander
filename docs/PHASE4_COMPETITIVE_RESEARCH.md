Status: Official documentation checked 2026-09-14; Phase 4 research and recommendations.

# Phase 4 competitive research and product architecture

Research checked against official documentation available on September 14, 2026. This is a read-only report: no repository files, branches, records, or deployments were changed. The required branch was verified as `dev/personal-calendar-workbench`.

The recommended direction is a personal planning system organized around Today for execution, Overview for orientation, and a connected long-term planning model. Its distinguishing promise should be reliable follow-through when ordinary life disrupts the plan.

Competitor documentation supports combining a few specific strengths: Things’ separation of actionable and future work; Structured’s deliberate recovery flow; Sunsama’s capacity-aware planning; Akiflow’s capture-to-calendar movement; Amazing Marvin’s outcome and ongoing goals; and Linear’s separation of strategic roadmaps from individual tasks. Copying any one product wholesale would leave important requirements unmet.

This report distinguishes documented product behavior from recommendations. Documentation is not hands-on usability verification. “Not established” in the matrix means that the reviewed evidence does not support a claim; it does not mean a feature is absent.

## 1. Capability and pattern matrix

| Product | Documented daily/capture pattern | Time, recovery, or habits | Long-term orientation | Implication for Personal Calendar |
|---|---|---|---|---|
| Things | Today, Upcoming, Anytime, Someday, Inbox, Logbook; context and time are separate ways of viewing work | Today can include calendar events; This Evening provides a quieter later-day section | Areas and projects; completed/cancelled work remains in Logbook indefinitely | Adopt predictable destinations and progressive disclosure. Keep recovery and goals more explicit. [An In-Depth Look at Today, Upcoming, Anytime, and Someday](https://culturedcode.com/things/support/articles/4001304/) |
| Todoist | Today/Upcoming with list, board, and calendar workflows | Planned dates are distinct from deadlines; calendar time blocking; overdue work can be rescheduled from a planning sidebar | Projects and flexible views; a full personal goal system was not established here | Preserve separate “Plan for” and “Due by” fields and views over the same task. [Introduction to deadlines in Todoist](https://www.todoist.com/help/todoist/features/introduction-to-deadlines-in-todoist-uMqbSLM6U), [Plan your week with the Upcoming view](https://www.todoist.com/help/todoist/get-started/plan-your-week-with-the-upcoming-view-OKOg1mR8) |
| TickTick | Task lists, calendar views, matrix, focus, habits, and a lighter timeline | Habit statistics and multiple planning methods are documented; exact current recovery semantics were not readable from its help article | Lightweight timeline; a first-class outcome/direction portfolio was not established | Demonstrates breadth, but breadth should sit behind a coherent primary workflow. [Help Center](https://help.ticktick.com/), [Features](https://www.ticktick.com/features) |
| Structured | Daily timeline is the starting surface; Inbox holds undated work | Replan processes unfinished tasks through explicit choices; recurring/all-day work excluded by default; repeated moves get a badge | Not established as a strategic portfolio tool | Adopt deliberate recovery and a legible day. Extend beyond the day without crowding Today. [Getting Started With Structured](https://help.structured.app/en/articles/380546), [How to Use Replan](https://help.structured.app/en/articles/4511874) |
| Sunsama | Guided daily planning: review, select work, check load, finalize | Planned workload compared with capacity; automatic rollover and configurable auto-archive | Weekly objectives feed daily planning | Adopt realistic planning rituals; reject automatic disappearance or date mutation for Strict mode. [Daily Planning](https://help.sunsama.com/docs/usage-guides/daily-planning/), [Task rollover: the basics](https://help.sunsama.com/docs/getting-started/basics/task-rollover-and-recurring-tasks-the-basics/) |
| Akiflow | Inbox for unplanned work; Today for dated work; direct movement into calendar | Scheduled work remains identifiable within Today; daily and weekly rituals | Week/month/someday planning; weekly “Goals” are tasks with Goal priority | Adopt capture-to-plan continuity, but retain the app’s richer goal entities. [Today Page](https://product.akiflow.com/articles/0741055-today-page), [Rituals](https://product.akiflow.com/help/articles/0805246-rituals) |
| Motion | Scheduling engine consumes task metadata and calendar context | Duration, priority, deadline, start date, chunks, schedules, busy events; hard deadlines can override normal hours | Projects and task blockers | Learn from explicit scheduling constraints. Avoid invisible overload solutions and automatic commitment changes. [What Auto-Scheduling considers](https://www.usemotion.com/help/time-management/auto-scheduling/reference-auto-scheduling/what-auto-scheduling-considers), [Task Scheduling FAQ](https://www.usemotion.com/help/project-management/task/task-scheduling-faq) |
| Reclaim | Calendar, Planner, assistant, and background scheduling agents | In Reclaim 2.0, preview stages user/assistant changes; habits can move, shorten, skip, or defend time under configured rules | Calendar-focused coordination and integrations | Adopt reviewable proposals and explicit flexibility policies. Do not make this an autonomous scheduling product by default. [Reclaim 2.0 FAQ](https://help.reclaim.ai/en/articles/15280604-reclaim-2-0-faq) |
| Amazing Marvin | Configurable Day View with optional strategies | Goal check-ins, procrastination tools, optional strategies | Explicit end goals and ongoing goals linked to tasks, projects, and habits | Strongest direct model for approved outcome/direction distinction. Offer useful defaults with bounded customization. [Goals & Objectives](https://help.amazingmarvin.com/en/articles/5015479-goals-objectives), [How to pick Strategies](https://help.amazingmarvin.com/en/articles/1949346-how-to-pick-strategies) |
| Routine | Dashboard gives tasks, upcoming events, and time before next event; capture through console | Weekly planner combines calendars and tasks; postponement supports later consideration | Notes, projects, contextual information, customizable entities | Adopt return-to-context and nearby-time awareness; avoid turning personal planning into a generic database platform. [Dashboard](https://help.routine.co/articles/0079805-dashboard), [The Routine workflow](https://feedback.routine.co/en/help/articles/4208126-the-routine-workflow) |
| Morgen | Unified calendar planning; Frames describe recurring periods for types of work | Frames filter eligible work and guide planning; tasks are not structurally embedded in Frames | Supports workstreams and learning through time allocation | Adapt optional “usual week” templates. Clearly distinguish a template/window from a real task reservation. [How to use Frames](https://www.morgen.so/guides/how-to-use-frames) |
| Apple Reminders/Calendar | Scheduled reminders appear within Calendar | Create, edit, complete reminders in Calendar; all-day and timed reminders have different placement | Lists and Smart Lists; personal portfolio not established | Adopt native clarity and direct manipulation, with strict ownership boundaries for external records. [Use reminders in Calendar on iPhone](https://support.apple.com/guide/iphone/use-reminders-iph14f1d32a5/ios) |
| Google Calendar/Tasks | Tasks available in Calendar and Tasks views | Current docs distinguish start/end time from deadline; Pending tasks surfaces incomplete work from the past 365 days | Lists/subtasks; strategic goals not established | Basic tasks-plus-calendar is now a higher competitive baseline. Recovery, capacity, and long-term continuity must supply additional value. [Create and manage tasks in Google Calendar](https://support.google.com/calendar/answer/9901136?hl=en-uk) |
| Notion | Current sidebar Home includes upcoming events, recents, favorites, and workspace content; My Tasks remains accessible | Database timeline is another view of existing records | Flexible databases, relations, subtasks, dependencies, timelines | Adopt shared-data views and controlled information density. Avoid requiring users to design their own operating system. [Navigate Notion with the sidebar](https://www.notion.com/help/navigate-with-the-sidebar), [Timeline view](https://www.notion.com/help/timelines) |
| monday.com | Configurable dashboard widgets | Overview derives project status/progress from connected boards’ dates and statuses | Cross-project summary and risk labels | Borrow aggregation and drill-through. Do not default to an enterprise widget builder. [The Overview Widget](https://support.monday.com/hc/en-us/articles/360007078739-The-Overview-Widget) |
| Asana | Customizable Home with tasks, projects, status updates, notes, and shortcuts | Upcoming/overdue/completed task snapshots | Tasks/projects/portfolios/goals hierarchy | Borrow a concise orientation surface and connection to execution. Team administration is outside the personal default. [Explore Asana Home features](https://asana.com/features/project-management/home), [Asana hierarchy: tasks, projects, portfolios & goals](https://help.asana.com/s/article/asana-hierarchy?language=en_US) |
| Linear | Project overview collects summary, documents, milestones, and properties | Explicit health updates retain explanatory context | Initiatives organize projects; timeline supports week/month/quarter/year and intentionally shows projects rather than individual issues | Best roadmap reference: choose the level of detail appropriate to the planning horizon. [Projects](https://linear.app/docs/projects), [Timeline](https://linear.app/docs/timeline), [Initiative and Project updates](https://linear.app/docs/initiative-and-project-updates) |

## 2. Findings that change the design decisions

### Today is a projection, not another task container

Things treats Today as a view across work organized elsewhere. Akiflow similarly distinguishes unplanned Inbox items from dated Today items, then identifies scheduled tasks as such. The shared principle is that moving through the day should change a record’s planning attributes, not create another version of the task. [Things’ date-based views](https://culturedcode.com/things/support/articles/4001304/), [Akiflow Today Page](https://product.akiflow.com/articles/0741055-today-page)

**Recommendation:** A task should have one canonical identity across capture, Tasks, Today, Calendar, goal/project detail, and review. Today may present a reservation and a compact link elsewhere, but should not repeatedly display the same full task row in several panels.

Separate three questions in both UI and data:

| Question | User-facing label | Existing repository concept |
|---|---|---|
| When must this be finished? | Due by | `tasks.dueLocalDate` |
| Which day do I intend to work on it? | Plan for | `tasks.scheduledLocalDate` |
| What time have I reserved? | Reserved time | `plannedStartAt`, `plannedEndAt` |

This is already structurally possible in the repository. Collapsing these fields into one date picker would be a regression.

### Recovery deserves its own interaction, but not its own global destination

Structured’s Replan presents unfinished tasks sequentially, supports undo, and highlights repeated rescheduling. Its documentation also excludes recurring and all-day tasks by default and distinguishes imported events from editable tasks. [How to Use Replan](https://help.structured.app/en/articles/4511874)

Sunsama illustrates the alternative: automatic overnight rollover, automatic archiving after repeated rollover, and special handling for recurring instances. These choices reduce clutter, but they would conflict with the approved Strict accountability behavior if copied directly. [Task rollover: the basics](https://help.sunsama.com/docs/getting-started/basics/task-rollover-and-recurring-tasks-the-basics/)

**Recommendation:** Recovery is a persistent, compact state in Home and a resumable flow. It should appear after interruption, when closing a day, and when returning after absence. Users can continue using the application throughout.

Do not interpret every uncompleted object identically:

- One-off commitment: remains unresolved until a decision.
- Missed habit occurrence: retains its historical outcome; the next scheduled occurrence remains separate.
- Expired appointment: remains historical context; it does not become an overdue task.
- Waiting-for task: needs a follow-up/review date, not fictional working time.
- Paused goal/direction: needs a review point.
- Someday idea: belongs in periodic consideration, not daily overdue pressure.

### A strict system must ask for decisions, not manufacture success

The approved five outcomes can provide a coherent recovery vocabulary, but they require different semantics.

| Outcome | Required behavior | Important distinction |
|---|---|---|
| Done | Record completion of the relevant task or occurrence | A completed focus session does not necessarily complete the task |
| Reschedule | Select another planned day, optionally reserve time | Due date remains unchanged unless explicitly edited |
| Reduce | Record revised scope and the next actionable commitment | Reducing an estimate alone must not claim the original work was achieved |
| Pause | Record a return/review point and optional reason | Pause is not an invisible backlog |
| Abandon | Record intentional non-completion; retain record and history | Abandon is not Done and is not permanent deletion |

Strict mode should prevent a day from being represented as fully resolved while unresolved commitments remain. It should never prevent capture, navigation, editing, or reviewing another day.

**Repository implication:** `shared/dailyPlanResolution.ts` currently supports `done`, `rescheduled`, `deferred`, `wont_do`, and `archived`. Deferral clears the planned date and reservation; `wont_do` archives with an outcome marker. Reduce and Pause therefore require an explicit design and storage contract. Renaming current actions would misrepresent behavior.

### Capacity must represent personal life

Sunsama’s daily planning totals estimated work and warns about overcommitment. Its account settings currently specify that only tasks in work contexts count toward the workload threshold, excluding personal contexts. [Daily Planning](https://help.sunsama.com/docs/usage-guides/daily-planning/), [Account Settings](https://help.sunsama.com/docs/settings/user-settings/)

Motion makes scheduling constraints explicit, but its hard-deadline behavior can place tasks outside ordinary scheduled hours. [Task Scheduling FAQ](https://www.usemotion.com/help/project-management/task/task-scheduling-faq)

**Recommendation:** Personal Calendar’s capacity should include relevant appointments, home responsibilities, meals, travel, recovery time, and flexible tasks. It should not assume a universal office day or treat evenings as an unlimited overflow buffer.

Present approximate capacity honestly:

- “About 90 minutes available; 2 tasks have no estimate.”
- “Your plan exceeds the remaining time by about 45 minutes.”
- “Calendar information last refreshed at 10:20.”

Unknown effort is not zero. Overlapping busy events must not be double-counted. An all-day reminder should not automatically consume the entire day.

### Long-term planning needs different representations for outcomes and directions

Amazing Marvin explicitly distinguishes end goals from ongoing goals and permits actions through projects, tasks, and habits. This directly supports the approved product distinction. Its goal setup also offers expectations and scheduled check-ins. However, the same help article warns that completed check-ins are not retained for later viewing unless exported or emailed. [Goals & Objectives](https://help.amazingmarvin.com/en/articles/5015479-goals-objectives)

Linear provides a complementary idea: project dates may express uncertainty at year, half-year, quarter, month, or exact-day granularity. Its timeline deliberately focuses on projects, while individual issues remain in lists or boards. [Projects](https://linear.app/docs/projects), [Timeline](https://linear.app/docs/timeline)

**Recommendation:** An Outcome goal should answer “What result will establish success?” A Direction should answer “What continuing standard or practice matters, and when will I review it?” Both can connect to existing tasks, habits, and projects.

Do not force a direction such as maintaining friendships to reach 100%. Do not force a distant intention to choose a fictional exact date. Do not infer that all tasks completed means the real-world outcome has been achieved.

### Overview should explain attention, not decorate activity

monday.com’s Overview aggregates date/status columns into project rows with progress and risk labels, then opens the underlying board. Asana’s Home exposes work snapshots and status updates. Linear’s health updates add explanation to status rather than relying solely on percentages. [The Overview Widget](https://support.monday.com/hc/en-us/articles/360007078739-The-Overview-Widget), [Explore Asana Home features](https://asana.com/features/project-management/home), [Initiative and Project updates](https://linear.app/docs/initiative-and-project-updates)

**Recommendation:** Every Overview module needs a decision and a destination. “Goal needs a next action” is useful. An unlabeled productivity score is not. Phase 4 should reuse existing factual signals; deeper recording and analytical interpretation belong to Phase 5.

## 3. Recommended information architecture

Use six logical destinations, with capture/search/focus as actions or modes:

| Destination | Contents | Current capabilities preserved |
|---|---|---|
| Home | Today / Overview switch; planning/recovery entry points | Today, current daily signals, capacity, habit reminders, daily planning entry |
| Tasks | Inbox, active work, board/list, saved views, recurrence, waiting, completed | Capture processing, Tasks, Search results, filters, ordering, task detail, subtasks |
| Plan | Calendar/agenda, week planning, availability, proposals, templates | Calendar, daily/weekly planning tools, reservations, external context |
| Goals | Outcomes, Directions, Projects, portfolio Roadmap | Goals, Projects, horizons, milestones, progress modes, task dependencies |
| Habits | Due practice, schedules, history/corrections, goal links | Habit tracker and practice evidence |
| Review | Daily/weekly reviews and existing Insights | Review rituals/checklists, reflection, historical summaries |

Utilities remain accessible through Account/Settings: account identity, workspace/timezone, sync/conflicts, device/PWA, display preferences, categories, recycle bin, calendar connections, reminders, sign-out.

Desktop can show all six destinations. Phone can use four pinned destinations plus More, with a short, grouped More surface; all six remain navigable and pinnable within the approved customization constraints. Capture stays a clearly labeled, thumb-accessible action.

Important IA details:

- “Today / Overview” remains a first-level switch inside Home.
- “Plan your day” launches a guided mode over Today and Plan; it does not maintain a second competing commitment list.
- Search remains globally available and can still have a results screen.
- Focus opens from a task or the global command layer; active sessions remain accessible across navigation.
- Project detail supports Overview, List/Board, and Timeline. These are views, not duplicate records.
- Saved views remain accessible even if their old entry points move.
- Existing deep links and navigation preferences need an explicit compatibility mapping.

### Today composition

Recommended default order:

1. Date, Today/Overview switch, compact sync status, capture.
2. Current/next fixed appointment or reservation, with time until it begins.
3. Flexible committed work that is not already represented as a full timeline row.
4. Due habits in a compact section with honest completion/skip state.
5. Persistent recovery summary when decisions remain.
6. Plan/replan and close-day actions.
7. Completed work collapsed below active work.

Desktop: compose a task/commitment column beside the day’s calendar context. Phone: prioritize an agenda with flexible work and due habits; do not compress a desktop hour grid into the only execution surface.

If the day has no timed work, do not devote the largest area to an empty calendar. If appointments dominate, time context should become more prominent. These are deterministic layout rules, not an opaque personalization system.

### Overview composition

Use a bounded set of modules with a strong default:

| Module | Question answered | Primary action |
|---|---|---|
| Needs attention | What remains unresolved or blocked? | Resolve / inspect |
| This week | What have I committed to, and what is close? | Open weekly plan |
| Goals and projects | Which intention lacks movement, evidence, or a next action? | Open goal/project |
| Habits | What is due, paused, or returning after interruption? | Resume/check in |
| Upcoming milestones | What meaningful checkpoint is approaching? | Open roadmap |
| Review | What review is due or unfinished? | Resume review |

Permit reorder, hide, and bounded size choices. Keep active Strict recovery discoverable even if users hide its Overview module: hiding a module must not resolve commitments.

On phone, render a prioritized briefing. On desktop, a restrained grid or mixed-width composition is appropriate. Avoid ornamental counters, empty charts, and repeated nested cards.

## 4. Long-term model and roadmap behavior

The default relationship can be:

`Outcome or Direction → milestone/checkpoint → project/workstream → next action → planned work → evidence/review`

It is optional, not a mandatory ownership tree. Standalone tasks/projects, direct goal-linked tasks, and goal-linked habits remain valid.

| Concept | Meaning | Phase 4 treatment |
|---|---|---|
| Outcome goal | A finishable result | Success criteria, target horizon/date, progress basis, milestones, review |
| Direction | Continuing area or standard | Purpose, linked practices/projects, review cadence; no artificial completion |
| Project | Finite body of work | Next action, task state, dependencies, timeline |
| Milestone | Meaningful checkpoint | Date or horizon, evidence/status, linked work |
| Weekly objective | Near-term outcome | Preserve separate weekly record and carry-forward ancestry |
| Reservation | Intended use of time | Never treated as actual work evidence |
| Review | Deliberate assessment | Retained reflection and explicit next decisions |

Portfolio Roadmap should default to projects and milestones grouped by goal/direction. Month/quarter/year switching changes resolution, not record meaning. Unscheduled work must remain visible in an accompanying list. Long-term planning should not require every task to appear as a bar.

Moving a bar should preview:

- Which dates change.
- Whether the target deadline remains fixed.
- Which linked tasks or milestones are affected.
- Any dependency conflict.
- What remains untouched.
- Save and cancel, with undo where supported.

A phone milestone list grouped by month/quarter is the primary alternative. A landscape timeline can support deeper manipulation, but must not be the only way to inspect or change dates.

**Repository constraints:**

- `goals` already has parent links, horizons, manual/task/measure/habit progress modes, and local date fields.
- `goalMilestones` already exists, with monthly/quarterly horizons.
- `taskDependencies` stores hard/soft links between tasks.
- `ProjectExecutionWorkspace.tsx` explicitly says hard links prevent completion; soft links supply context.
- Existing task dependencies are not equivalent to project-level timeline dependencies or finish-to-start date propagation.

Consequently, a project dependency editor, more general milestone types, direction semantics, and persistent per-goal review dates are additions to specify carefully. They are not automatically delivered by drawing a timeline.

## 5. Patterns to adopt, adapt, and reject

| Pattern | Decision | Reason |
|---|---|---|
| Inbox as temporary capture buffer | Adopt | Protects attention during capture; processing can happen later |
| Planned date separate from deadline | Adopt | Prevents rescheduling from erasing urgency |
| Explicit unfinished-work recovery | Adopt | Directly addresses loss of follow-through |
| One record across list/calendar/roadmap | Adopt | Avoids divergent completion and progress |
| Time before next appointment | Adopt | Helps users choose realistically sized next work |
| Reviewable scheduling proposals | Adopt | Matches existing `scheduleProposals` model |
| Default day/week routines | Adapt | Make them resumable and brief; support personal schedules |
| Outcome versus ongoing goal | Adopt | Matches approved long-term requirements |
| Project-level portfolio timeline | Adapt | Preserve task detail through drill-down and accessible lists |
| Habit streaks | Adapt | Optional historical metric; recovery and consistency remain primary |
| Customizable dashboard | Adapt | Bounded modules and defaults, not an empty canvas |
| Automatic rollover/auto-archive | Reject as default | Conflicts with explicit resolution and preservation semantics |
| Automatic completion of elapsed appointments | Reject as task evidence | Elapsed time does not prove attendance or follow-through |
| Automatic scheduled-time-to-actual-time conversion | Reject | Corrupts the distinction Phase 5 will need |
| Auto-scheduling beyond user capacity | Reject as silent behavior | Overload needs a decision, not hidden overtime |
| Mandatory goal/project linkage | Reject | Everyday personal tasks must remain lightweight |
| Full enterprise work management shell | Reject | Creates setup, permissions, coordination, and support complexity outside the core product |
| Shame language, forced streak repair, lockout | Reject | Undermines returning after interruption |

The last column is analysis and recommendation, not a claim that every comparator exhibits the rejected behavior.

## 6. Phone, desktop, offline, and accessibility

### Platform divergence must be intentional

Todoist documents a three-day calendar on portrait mobile and seven days in landscape. Structured’s Replan documentation currently restricts the feature to Apple devices and excludes Android/web; its accessibility page also acknowledges platform differences. These are useful reminders that “cross-platform” does not establish feature parity. [Time blocking in Todoist](https://www.todoist.com/help/todoist/get-started/time-blocking-in-todoist-d6Pf1uTpc), [How to Use Replan](https://help.structured.app/en/articles/4511874), [Which Accessibility Features Does Structured Support?](https://help.structured.app/en/articles/4725634)

For Personal Calendar:

- Phone optimizes capture, next-action selection, appointment context, check-ins, recovery, and short edits.
- Desktop optimizes weekly planning, comparison, bulk organization, and timelines.
- Both preserve the same semantics and offer all essential decisions.
- Horizontal task gestures must yield to ordinary vertical scrolling.
- Sheets need independent scrolling, stable headers, visible close controls, safe-area padding, and correct browser Back behavior.
- Important actions cannot depend on hover, long press, swipe, dragging, or landscape orientation.

### Offline reliability remains a product feature

Todoist’s September 4, 2026 offline article documents offline task changes and automatic synchronization, but also warns against closing, signing out, or clearing local data before syncing. Notion’s current offline documentation limits support to desktop/mobile apps, requires page downloads, excludes automatic subpage download, and initially includes only the first 50 rows of a database’s first view. Akiflow documents offline use with later synchronization for its desktop app. These are product-specific limitations, not grounds for broad superiority claims. [Use Todoist while offline](https://www.todoist.com/help/todoist/features/use-todoist-while-offline-4rbaZw), [Use pages offline](https://www.notion.com/help/use-pages-offline), [Desktop App](https://product.akiflow.com/articles/0883150-desktop-app)

The repository’s handoff establishes cached planner reading and a task-first offline write scope. Other entity writes remain online-only. The redesign must preserve that distinction.

Show “Saved on this device” separately from “Synced.” Preserve queued work through navigation, relaunch, and sign-out boundaries as currently designed. A redesigned habit or goal editor must not appear successfully saved offline unless that operation is actually supported.

### Accessibility target

WCAG 2.2 includes requirements for visible keyboard focus, focus not obscured by sticky content, and alternatives to dragging. Its AA target-size minimum is 24 CSS pixels with exceptions; the app should retain its stronger phone target of at least 44 pixels for ordinary controls. These are different requirements, not interchangeable numbers. [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)

Prototype and implementation checks should cover:

- Keyboard completion, scheduling, ordering, recovery, and timeline editing.
- VoiceOver labels that distinguish task completion, habit occurrence, and external appointment.
- Text enlargement and reflow.
- Contrast in light and dark presentations.
- Status distinguished by text/icon as well as color.
- Reduced motion.
- Focus returning to the invoking row after a sheet closes.
- Final settings/sign-out actions remaining pointer-accessible above the phone bar.

## 7. Apple Calendar first: the actual integration boundary

Apple Calendar can display and manipulate native scheduled Reminders. Apple also documents external subscribed calendars as read-only. Native EventKit access has explicit permission requirements and belongs to native application APIs. [Use reminders in Calendar on iPhone](https://support.apple.com/guide/iphone/use-reminders-iph14f1d32a5/ios), [Set up multiple calendars on iPhone](https://support.apple.com/en-mide/guide/iphone/-iph3d1110d4/ios), [Accessing the event store](https://developer.apple.com/documentation/eventkit/accessing-the-event-store)

The repository handoff describes an outgoing private `webcal://` feed. `shared/icsOverlay.ts` currently allows a server-configured Google ICS source; it does not establish a working incoming Apple Calendar connection.

Therefore:

1. Keep the existing outgoing subscription available and label its direction and read-only nature.
2. Do not claim Apple appointments already populate Today.
3. Prototype external appointments with explicit source labeling and a clearly stated connection requirement.
4. Define incoming Apple/iCloud scope separately: provider/account type, permission path, supported recurrence, update lag, cancellation handling, and conflict behavior.
5. Preserve the distinction between imported context and planner-owned tasks.
6. Keep Gmail as a later capture boundary. A message link should retain provenance; importing a message should not silently promise or schedule its work.

“Apple Calendar” is an application that can display calendars from multiple providers. A connector plan must identify where the actual calendar data lives.

## 8. Feature-preservation requirements

The following were established through the handoff, schema, and relevant source inspection. They must remain reachable after restructuring.

| Existing capability/evidence | Preservation requirement |
|---|---|
| Task identity, workspace identity, versions, request IDs | Keep all identities and sync deduplication intact |
| Task lifecycle, priorities, categories, horizons | Preserve state values and filtering semantics |
| Subtasks and direct task-to-goal/project links | Retain flexible relationships |
| Separate due/planned/reserved dates | Do not flatten into one ambiguous scheduling field |
| Manual/flexible/pinned scheduling modes | Preserve explicit scheduling intent |
| Recurring tasks and `taskOccurrences` | Keep series and occurrence histories distinct |
| `taskReservationRollovers` | Preserve prior reservation evidence |
| `dailyPlans` and `dailyPlanItems` | Reuse canonical commitment/outcome records |
| `weeklyObjectives` and carry-forward ancestry | Preserve outcome intent separately from task lists |
| Goals, milestones, progress modes | Preserve manual, task, measure, and habit meanings |
| Hard/soft task dependencies | Retain current completion policy; do not silently change it |
| Habits, schedules, check-ins, corrections | Preserve completed/skipped/missed/not-scheduled distinctions |
| Focus sessions and active seconds | Keep actual focus separate from reservations |
| Templates and schedule proposals | Preserve explicit apply/approve/undo behavior |
| Availability defaults and daily exceptions | Do not rewrite workspace defaults when changing one day |
| Saved views, search, capture, AI drafts | Relocate without removing access or bypassing review |
| Review sessions, snapshots, checklists, reflections | Preserve prior review contents |
| Archive/restore and indefinite recycle bin | No automatic expiry or destructive redesign cleanup |
| Scoped cache, operation queue, conflict review | Keep ownership, durability, and explicit resolution |
| Calendar feed and reminder controls | Preserve access; notifications remain last |
| File-related surfaces | Preserve relevant UI/data contracts without claiming the deferred storage migration is live |

A full migration acceptance inventory should map each old route/action to its new route/action and identify whether the behavior is unchanged, improved, or newly added. Visual redesign alone cannot certify capability preservation.

## 9. Required prototype scenarios

Use realistic mixed-life fixtures rather than a perfect empty day.

1. **Ordinary mixed day:** habits, two appointments, document reading, reply, groceries, dinner preparation, and one goal-linked task.
2. **Interrupted afternoon:** an appointment overruns; a pinned commitment stays fixed; flexible work no longer fits.
3. **Low-capacity day:** availability reduced without changing future defaults; Reduce/Pause decisions retain context.
4. **Return after ten days:** unresolved one-off work grouped for recovery; missed habit occurrences do not become ten duplicate chores.
5. **Waiting for someone:** a reply-dependent task remains visible through follow-up without occupying fictional work time.
6. **Goal without next action:** an outcome has a target and milestones but no executable work; Overview points to the missing step.
7. **Ongoing direction:** health or relationships has habits and periodic review without artificial completion.
8. **Roadmap movement:** date change previews dependencies and unchanged deadlines; cancel leaves records unchanged.
9. **Recurring boundary:** scheduled recurrence versus completion-anchored recurrence; skip one occurrence versus pause the series.
10. **Offline interruption:** capture and supported task edit persist; unsupported goal/habit write is honest; conflict is visible after reconnect.
11. **Long text and large data:** crowded week, many projects, unscheduled items, long titles, hidden categories.
12. **Phone usability:** keyboard open, sheet scroll, safe-area controls, one-lane board, More navigation, and sign-out.
13. **Accessibility:** same outcomes reached through keyboard and non-drag pointer controls.
14. **Empty state:** useful capture/planning entry without fabricated metrics or an oversized empty timeline.
15. **Archived linked work:** restore task/goal/project while retaining history and exposing unresolved links.

Prototype success should be judged by completing these actions with the intended semantics—not by screenshot attractiveness alone.

## 10. Phase 5 foundations without expanding Phase 4

Deep recording, understanding, and analytics remain Phase 5. Phase 4 should preserve the raw distinctions that make later analysis possible and document gaps discovered during redesign.

Sunsama distinguishes planned and actual time, including daily versus cumulative totals, but optionally substitutes planned time when actual time is absent. Amazing Marvin distinguishes numeric measurements from ratings and supports tracker history. Linear retains structured project updates alongside property changes. These patterns illustrate why an analytical system needs provenance and history rather than one mutable percentage. [Planned and Actual Times](https://help.sunsama.com/docs/usage-guides/tasks/planned-and-actual-times/), [Trackers](https://help.amazingmarvin.com/en/articles/5015912-trackers), [Initiative and Project updates](https://linear.app/docs/initiative-and-project-updates)

Phase 4 should preserve or specify:

- Original record identity and workspace scope.
- Task series identity separately from occurrence identity.
- Planned date, deadline, reservation, completion, and resolution as separate facts.
- Effective local date/timezone separately from when a change was recorded or synchronized.
- Original and revised scope for Reduce.
- Pause/review decisions and return dates.
- Manual versus measured versus inferred evidence.
- Goal progress basis and target changes.
- Carry-forward ancestry and previous reservations.
- External source identity, read-only status, refresh time, and cancellation.
- Undo/correction lineage where available.
- Unknown/missing evidence as unknown, never zero or failure.

Existing `updatedAt`, `version`, sync receipts, and current-value rows do **not** by themselves establish a complete behavioral history. The repository already has several useful history-bearing entities, but there is no basis here to claim a comprehensive append-only event history.

Do not add a new analytics dashboard, continuous behavior tracking, or generalized event platform during the Phase 4 visual work. Record a Phase 5 contract and avoid destructive simplifications. Retain existing Insights access under Review, and use only established operational signals in Overview.

## 11. Delivery and complexity risks

**Configuration burden:** The more audiences supported, the greater the temptation to expose every option. Use complete capability with progressive disclosure, clear defaults, and optional views.

**Ritual burden:** Recovery and planning can themselves become overdue work. Preserve resumable flows and concise decisions; do not require lengthy reflections.

**Semantic debt:** Pause, Reduce, Direction, milestone, and roadmap dependencies are not merely labels. Each needs a concrete storage and behavior specification before implementation.

**Integration burden:** Calendar providers bring recurrence, timezone, stale-state, permissions, and source-ownership problems. A connection logo is not proof of trustworthy schedule context.

**False progress:** Completion count can rise while an important result stalls. Keep activity, outcomes, and evidence distinct.

**Performance:** The current audit records a large client bundle. The new shell should support route-level loading and stable transitions; a redesign that adds charts, timelines, and editors to initial load could worsen daily use.

**Unsupported superiority claims:** Official documentation establishes competitor behavior, not comparative task success. The app should claim its tested strengths precisely.

**Evidence limitations:** TickTick’s help index and official feature page were readable, but individual help articles returned no text. Several Asana help articles similarly returned an empty application shell; corresponding claims were limited to official indexed descriptions and readable official product pages. Reclaim’s 2.0 FAQ explicitly says version availability varies; its described behavior must not be generalized to every existing account. No competitor accessibility certification or complete offline parity was independently tested.

The next concrete deliverable should be a small, connected prototype covering Home Today/Overview, recovery, task detail, and one outcome/direction roadmap across phone and desktop. It should be evaluated against the scenarios above before broad implementation begins.
