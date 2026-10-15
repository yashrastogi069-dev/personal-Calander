# 01 · Structure map

Step 1 of the UX restructure (see `README.md`). This file lists every page the planner has today, what each one really does, where they overlap, and where they fall short of the Dashboard. It ends with hypotheses and a question bank for the owner interview. Nothing here is decided yet.

- Branch: `work/premium-redesign` (worktree `premium-redesign`), as of 2026-10-15.
- Method: read the code, then toured every URL with demo data (`scripts/demo-fixtures.py`) at 1440x900 light, 390x844 light, and 1440x900 dark for 4 key pages. Two saved views were added to the demo data so the Views tab is not empty.
- Screenshots: `C:\Users\win 10\.claude\jobs\9a89bdcc\tmp\structure-shots\`. They are named `{width}-{theme}-{nn}-{page}.png`, for example `1440-light-05-tasks-board.png`. Full-page shots are capped at 7,000 px tall.
- Quality bar: Dashboard (D2) and Focus (D2.5). They are mapped briefly and not restructured.

## Words used in this file

- **Rail**: the left sidebar on desktop.
- **Phone bar**: the bottom tab bar on a phone.
- **More sheet**: the panel that slides up from "More" on the phone bar.
- **Palette**: the Ctrl/Cmd+K command box.
- **Destination / view**: the two URL settings that pick a page (`?destination=tasks&view=list`).
- **Legacy**: older UI from before the premium redesign. You can spot it by dark green panels, monospace type, small text links and native dropdowns.
- **Deadline / Plan for / Reserved time**: the three dates a task can have. In the code they are `dueLocalDate`, `scheduledLocalDate` and `plannedStartAt/EndAt`.
- **Someday**: a task parked with no time pressure (`horizon = someday`).
- **Triage**: deciding what to do with a new task (plan it, date it, park it, finish it, or bin it).
- **Archive**: the soft delete. There is no hard delete for tasks.
- **Grade**: A means as good as the Dashboard. F means broken or plainly legacy.

## Summary table

31 URL views across 7 destinations, plus 9 overlays and hidden panels. That makes 40 surfaces in total. Verdicts: **keep** (structure is right, polish only), **merge** (fold into another page), **rethink** (purpose is right, structure is wrong), **cut-candidate** (could go).

| # | Page / sub-view | Purpose in one line | Verdict | Grade |
|---|---|---|---|---|
| 1 | Dashboard (`home/overview`) | Calm overview of today, the week and goals | keep | A |
| 2 | Today (`home/today`) | Do today's work: tasks, habits, timeline | rethink | C |
| 3 | Focus (`home/focus`) | Run a focus timer on one task | keep | B |
| 4 | Search (`home/search`) | Full-text search over all records | merge (into palette) | C+ |
| 5 | Capture sheet (overlay) | Add a task, project, goal or habit | keep | B- |
| 6 | Natural capture page (`tasks/inbox&action=capture`) | Type a sentence, get a task | merge (into capture sheet) | D |
| 7 | Tasks › Inbox | Process new, unplanned tasks | rethink | C- |
| 8 | Tasks › List | All tasks grouped by date | keep | C+ |
| 9 | Tasks › Board | Move tasks between status lanes | rethink | F |
| 10 | Tasks › Views | Open a saved filter | rethink | D |
| 11 | Tasks › Archived | See and restore archived tasks | merge (with Recycle Bin) | D |
| 12 | "Task triage tools" panel | Legacy filters, saved views, bulk actions | cut-candidate | F |
| 13 | Task detail sheet | Read and edit one task | keep | C |
| 14 | Plan › Daily | Commit to today's work in 5 steps | rethink | C- |
| 15 | Plan › Weekly | Lay out the week and weekly objectives | rethink | D |
| 16 | Calendar (Day, plus Week/Month/Quarter/Year) | Reserve time for tasks | rethink | D |
| 17 | Roadmap | Projects and goals on a timeline | keep | C- |
| 18 | Goals & Projects › Projects | List of projects | keep | C |
| 19 | Project detail | One project: overview, list, board, timeline | rethink | C |
| 20 | Goals & Projects › Outcome goals | Goals with progress and milestones | rethink | D+ |
| 21 | Goals & Projects › Directions | Lasting standards ("values") | cut-candidate | D |
| 22 | Habits (`habits/due`) | Check off habits, see the trace | keep | C+ |
| 23 | Habits history (`habits/history`) | Meant to be history. Shows the same page as 22 | merge | C+ (duplicate) |
| 24 | Review › Ritual | Weekly review | rethink | C- |
| 25 | Review › Analytics | Planning patterns and charts | keep | B- |
| 26 | Review › History | Past reviews | merge | D |
| 27 | Settings (7 tabs) | Account, appearance, planning, navigation, sync, device | rethink | C- |
| 28 | Settings › Connections | Calendar feeds and phone reminders | rethink | D+ |
| 29 | Categories & Recycle Bin (dialog) | Manage categories, restore archived records | merge | not captured |
| 30 | Palette (Ctrl/Cmd+K) | Jump anywhere, run actions, find tasks | keep | B |
| 31 | Phone More sheet | Every destination not in the phone bar | rethink | C |
| 32 | Hidden "tools" panels (Plan, Goals) | Legacy forms kept behind a toggle | cut-candidate | F |
| 33 | `/calendar` route | Older standalone calendar page | cut-candidate | not captured |

Dev-only routes `/phase4-prototypes` and `/premium-gallery` are not product pages. They are listed under Navigation.

---

## Pages

Each page uses the same 8 headings.

### 1. Dashboard — quality bar (A)

- **Purpose vs behaviour**: An overview of the day, week and goals. It does what it says.
- **Entry**: rail "Dashboard", the header tab "Dashboard | Today | Calendar", the palette. On the phone it sits inside the More sheet only.
- **Files**: `client/src/features/dashboard/DashboardView.tsx`. Mounted in `client/src/pages/Home.tsx`.
- **Data / mutations**: reads the planner snapshot. Mostly read-only, with links out.
- **Actions**: open Today, Plan and Calendar items, and check things off.
- **Overlaps**: Today, Plan › Daily and Calendar day all show "today" too.
- **Dead ends / legacy**: none seen.
- **Visual**: the reference. Shots: `1440-light-01-dashboard.png`, `390-light-01-dashboard.png`, `1440-dark-01-dashboard.png`.

### 2. Today (C)

- **Purpose vs behaviour**: Meant as "do today's work". In practice it is a long report:
  - a capacity summary
  - "Your work"
  - "Habits today" with a 28-day red/green striped heatmap
  - "Your day" timeline
  - an upcoming milestone
  - "Remaining decisions"
  - a collapsed "Completed today"
- **Entry**: rail "Today" (badge "6 left"), the header tabs, and phone bar tab 1.
- **Files**: `client/src/features/today/TodayWorkspace.tsx`, which also uses TodayTimeline, TodayFlexibleWork and `TaskDetailSheet`.
- **Data / mutations**: snapshot, habits and calendar events. Writes task complete, habit check-in and focus start.
- **Actions**: check items off, "Plan day", "Open Review", "Open Plan", "Review task", "Start focus".
- **Overlaps**:
  - Dashboard: same day summary.
  - Plan › Daily: "Remaining decisions" is the same as Plan step 01 "Resolve".
  - Habits page: the same check-ins.
  - Calendar day: same timeline.
- **Dead ends / legacy**:
  - Recurring and committed items cannot be ticked here. They show "Open Review" or "Open Plan" buttons instead, because of server rules R1 and R3: a recurring task must be resolved as an occurrence, and a committed task from Plan.
  - "9 evidence records" is shown in monospace.
  - Three different counts appear: "6 left" in the rail, "4 items" in Your work, and "8 commitments" in the summary.
- **Visual**: text-heavy and long (3,740 px on the phone). Shots: `1440-light-02-today.png`, `390-light-02-today.png`.

### 3. Focus — quality bar (B)

- **Purpose vs behaviour**: A timer bound to a task. It works.
- **Entry**: rail "Focus", the palette "Start Focus", the "Start focus" button on task rows, and the More sheet.
- **Files**: `client/src/features/focus/FocusWorkspace.tsx`.
- **Data / mutations**: focus sessions and tasks. Writes session start, stop and continue.
- **Actions**: pick a task, pick a length, start, continue a recent session, "Choose next step", check habits.
- **Overlaps**: the "Today" side card repeats the habit check-ins.
- **Dead ends / legacy**: none.
- **Visual**: good. At 1440 the task picker's chip ("Work · 1h") overlaps the "Last session" card, and the "Use estimate 1h" pill is clipped. Shot: `1440-light-19-focus.png`.

### 4. Search (C+)

- **Purpose vs behaviour**: Full-text search over tasks, goals, projects, habits and reviews. It works.
- **Entry**: header Search box, the rail "Search or jump" field, and the palette fallback "Search everything".
- **Files**: `client/src/features/search/WorkspaceSearchWorkspace.tsx`, plus `SearchRecordSheet` in Home.tsx.
- **Data / mutations**: read-only.
- **Actions**: type a query, "Open record".
- **Overlaps**: the palette already finds tasks and pages. There are three search entry points on one screen: rail field, header box and page field.
- **Dead ends / legacy**: while on Search, the rail highlights "Dashboard".
- **Visual**: clean but a plain list of cards with monospace kickers. Shot: `1440-light-23-search.png`.

### 5. Capture sheet (B-)

- **Purpose vs behaviour**: Add a Task, Project, Goal or Habit. New tasks go to the Inbox by default, with a "Plan for today" checkbox. It works.
- **Entry**: header "Capture", the phone "+", the palette "Capture a task", and the "Capture" button inside the Tasks header (a duplicate).
- **Files**: `client/src/features/tasks/CaptureSheet.tsx`.
- **Data / mutations**: creates a task, project, goal or habit.
- **Actions**: type, choose a type, save, or switch to natural capture.
- **Overlaps**: the natural capture page (6).
- **Dead ends / legacy**: none.
- **Visual**: decent. Shots: `1440-light-04d-capture-sheet.png`, `390-light-04d-capture-sheet.png`.

### 6. Natural capture page (D)

- **Purpose vs behaviour**: Type a sentence and get a parsed task, with an "AI companion" panel.
- **Entry**: a link inside the capture sheet, and the URL `tasks/inbox&action=capture`.
- **Files**: `client/src/features/capture/NaturalLanguageCaptureWorkspace.tsx`, plus `AICompanion` in Home.tsx (~6325).
- **Data / mutations**: creates tasks.
- **Actions**: type, review the parse, save.
- **Overlaps**: the capture sheet does the same job in a lighter way.
- **Dead ends / legacy**: it is a full page for something that should be one field.
- **Visual**: legacy green panels. Shot: `1440-light-08-capture-natural.png`.

### 7. Tasks › Inbox (C-)

See the Tasks deep dive below for the full story.

- **Purpose vs behaviour**: Meant as a triage queue. It is a plain list with a "Plan today" button per row.
- **Entry**: rail "Inbox" (badge 9), the Tasks tab "Inbox", the palette.
- **Files**: `client/src/features/tasks/TaskWorkspace.tsx` (`InboxTriage`), `shared/taskBuckets.ts` (`isInboxTask`).
- **Data / mutations**: snapshot tasks. Writes Plan for today, complete, archive (with a 6-second undo), and edits via the detail sheet.
- **Actions**: tick, "Plan today", the row menu, open details.
- **Overlaps**:
  - Calendar's "Inbox · Unreserved tasks" (24 items) uses the word Inbox for a different set.
  - List's "No date" group.
  - Today's "Remaining decisions".
  - Plan step 01 "Resolve".
- **Dead ends / legacy**:
  - Overdue tasks sit here, because a deadline alone does not take a task out of the Inbox.
  - A long guidance paragraph.
  - The "Task triage tools" stub at the bottom.
- **Visual**: doubled header (shell "Inbox" plus page header "Tasks"), two Capture buttons, a hover-only "…" that still takes up a row on the phone. Shots: `1440-light-03-tasks-inbox.png`, `390-light-03-tasks-inbox.png`, `1440-dark-03-tasks-inbox.png`.

### 8. Tasks › List (C+)

- **Purpose vs behaviour**: All tasks grouped Past due / Today / Next 7 days / Later / No date, with a collapsed Done group. It works.
- **Entry**: rail "Tasks" (badge "3 overdue"), phone bar tab 2, the Tasks tab "List".
- **Files**: `TaskWorkspace.tsx` (`TaskListSections`, `TaskToolbar`), `CanonicalTaskRow`.
- **Data / mutations**: as for Inbox, plus toolbar facets (search, quick chips, Filter popover, Sort).
- **Actions**: search, filter, sort, tick, row actions (Open details, Start focus, Plan for today, Archive).
- **Overlaps**: Views (saved filters) and the triage stub (its own filters).
- **Dead ends / legacy**: the "Select" button is hidden, because `onSelectModeChange` is not wired. So there is no bulk action here.
- **Visual**: the best Tasks view, but pills are crushed to "W." and "H.", and the header is doubled. Shots: `1440-light-04-tasks-list.png`, `390-light-04-tasks-list.png`, `1440-dark-04-tasks-list.png`.

### 9. Tasks › Board (F)

- **Purpose vs behaviour**: Status lanes. Today it has 3 lanes: To do / In progress / Completed. Blocked tasks are folded into To do.
- **Entry**: the Tasks tab "Board" only.
- **Files**: `TaskWorkspace.tsx` (board section), `shared/taskBoard.ts`. The new `client/src/features/tasks/useTaskDnd.ts` (802 lines, R3 done in `1d6854f`) is **not mounted**.
- **Data / mutations**: state changes, and "Archive N completed" (a bulk archive in batches of 100).
- **Actions**: native HTML5 drag, ↑/↓ buttons on every card, and a "Move to" dropdown on every card.
- **Overlaps**: the Project detail "Board" is a second, different board (Ready next / Waiting / Completed).
- **Dead ends / legacy**: dark R20 green and navy lanes inside the light theme. The spec says lanes keep "exact R20 dark colors".
- **Visual**: worst page in the app. It is 5,943 px tall. Shots: `1440-light-05-tasks-board.png`, `390-light-05-tasks-board.png`.

### 10. Tasks › Views (D)

- **Purpose vs behaviour**: Meant to manage saved filters. It can only **apply** them.
- **Entry**: the Tasks tab "Views".
- **Files**: `TaskWorkspace.tsx` (saved section), `adaptSavedTaskView`. Helpers that are written but not used: `savedTaskViewSummary`, `savedTaskViewCount`, `orderSavedTaskViews`, `savedTaskViewDiffers`.
- **Data / mutations**: `snapshot.savedViews`. There are no writes from this tab.
- **Actions**: click a tile to apply it.
- **Overlaps**: the triage stub is the only place to create, pin or delete a view.
- **Dead ends / legacy**: an empty state with no "create" button.
- **Visual**: two bare tiles reading "Pinned" and "Saved". Shot: `1440-light-06-tasks-saved.png`.

### 11. Tasks › Archived (D)

- **Purpose vs behaviour**: List archived tasks and restore them. It works.
- **Entry**: the Tasks header "…" menu, then "Archived tasks".
- **Files**: `TaskWorkspace.tsx` (archive section).
- **Data / mutations**: a restore puts the task back in To do.
- **Actions**: Restore.
- **Overlaps**: the "Categories & Recycle Bin" dialog lists the same archived tasks, plus goals, projects and habits.
- **Dead ends / legacy**: two groups, "Completed before archive" and "Archived without completion". The difference is unclear to a user.
- **Visual**: legacy green panel, monospace. Shot: `1440-light-07-tasks-archive.png`.

### 12. "Task triage tools" panel (F)

- **Purpose vs behaviour**: A legacy collapsed panel under the task list. It is the **only** place to save, pin or delete a view, and the only place for multi-select bulk Start / Complete / Archive.
- **Entry**: the "Task triage tools" toggle at the bottom of Inbox, List and Board. A copy also sits in a legacy Plan tools group.
- **Files**: `Home.tsx` `TaskTriagePanel` (~2452–2650).
- **Data / mutations**: runs its own separate snapshot query. Calls `planner.savedView.create/update/delete` and `planner.task.bulkSetState` (max 100, online only).
- **Actions**: filter and sort selects, "Save view" (a browser `window.prompt`), star to pin, × to delete, checkboxes plus bulk buttons.
- **Overlaps**: the toolbar filters, the Views tab, and the hidden Select mode.
- **Dead ends / legacy**: saves views in the old v1 format `{filter, sort}`.
- **Visual**: tiny legacy list. Shot: `1440-light-04b-tasks-triage-stub-open.png`.

### 13. Task detail sheet (C)

- **Purpose vs behaviour**: Read and edit one task. It works. On desktop it is meant to be a right-side panel.
- **Entry**: click any task row.
- **Files**: `client/src/features/tasks/TaskDetailSheet.tsx`.
- **Data / mutations**: edits fields, the three dates, state, project and category.
- **Actions**: edit, save, close.
- **Overlaps**: the `SearchRecordSheet` from Search.
- **Dead ends / legacy**: two Close buttons, and the footer wraps and overlaps the content.
- **Visual**: shots `1440-light-04c-task-detail.png`, `390-light-04c-task-detail.png`.

### 14. Plan › Daily (C-)

- **Purpose vs behaviour**: Five numbered steps: 01 Resolve, 02 Capacity, 03 Commit, 04 Reserve (only a link to Calendar), 05 Review, then a daily shutdown. It works, but it is slow to use.
- **Entry**:
  - rail "Plan"
  - phone bar tab 4 "Daily plan"
  - the "Plan day" button on Today
  - the in-page switch Daily / Weekly / Calendar / Roadmap
- **Files**:
  - `client/src/features/planning/PlanWorkspace.tsx` (1,792 lines)
  - `Home.tsx` `DailyCompass` (~2016) and `RecurringWorkControl` (~2084), inside a hidden "Planning and recurring work tools" panel
- **Data / mutations**: dailyPlan upsert/addItem/moveItem/resolveItem/close, availability upsert/clear, scheduleProposal create/approve/dismiss/undo, workspace.update, dailyCheckIn (inside the hidden panel).
- **Actions**: resolve yesterday's items, set capacity, commit tasks, set the day's intention, close the day.
- **Overlaps**:
  - Today: same day.
  - Calendar: step 04.
  - Review: step 05.
  - DailyCompass asks for an intention a second time, plus energy and mood.
- **Dead ends / legacy**: step 04 is only a link. The hidden tools panel holds an energy/mood form and a "Refresh series" button.
- **Visual**: doubled heading, old rectangular view-switch buttons, 01–05 kickers in monospace, text-link actions. Shots: `1440-light-09-plan-daily.png`, `1440-light-09b-plan-tools-open.png`, `390-light-09-plan-daily.png`.

### 15. Plan › Weekly (D)

- **Purpose vs behaviour**: A week board, unplanned work, the selected day, a weekly objectives form, and recent planning history.
- **Entry**: the in-page switch, and the More sheet "Weekly plan".
- **Files**: `PlanWorkspace.tsx` (`PlanWeekBoard`).
- **Data / mutations**: weeklyObjective create/update/carryForward, plus the daily plan item moves.
- **Actions**: move items between days, write objectives, carry objectives forward.
- **Overlaps**: Calendar Week mode (a second week view), and Roadmap for objectives.
- **Dead ends / legacy**: the Thursday column grows to the length of all its items. The page is 5,104 px tall.
- **Visual**: long forms. Shots: `1440-light-10-plan-weekly.png`, `390-light-10-plan-weekly.png`.

### 16. Calendar (D)

- **Purpose vs behaviour**:
  - The header says "Reserve real focus time".
  - Day mode is a 08:30–17:30 grid inside a short scroll box, next to "Inbox · Unreserved tasks" (24), a "Morning rollover" note and a keyboard guide.
  - The Day / Week / Month / Quarter / Year switch sits at the **bottom**.
  - The other modes render the legacy `CalendarMatrix`, which has "Move here" in every cell.
- **Entry**: rail "Calendar", the header tab "Calendar", the Plan switch, and the More sheet.
- **Files**: `client/src/features/calendar/CalendarExecutionWorkspace.tsx`, `Home.tsx` `CalendarMatrix` (~9428).
- **Data / mutations**: reservations (plannedStartAt/EndAt), plus read-only external busy events.
- **Actions**: drag or select a task into a slot, move days, switch mode.
- **Overlaps**:
  - Plan › Weekly, which is a second week view.
  - Roadmap, which also covers Quarter and Year.
  - Today's timeline.
  - The standalone `/calendar` route.
- **Dead ends / legacy**:
  - A third meaning of "Inbox".
  - 30-minute blocks clip their labels.
  - Year mode starts in January 2026.
- **Visual**: on the phone, the day strip overflows sideways ("SU 18" is cut off), and two tab rows are stacked (Dashboard/Today/Calendar plus Daily/Weekly/Calendar/Roadmap). Shots: `1440-light-11-calendar*.png` (5 modes), `390-light-11-calendar*.png`, `1440-dark-11-calendar.png`.

### 17. Roadmap (C-)

- **Purpose vs behaviour**: Month / Quarter / Year timelines of projects and goals: Portfolio timeline, Focused timeline, Not yet dated, Archived records, and a "Review project dates" editor.
- **Entry**: rail "Roadmap", the Plan switch, the More sheet, and the Project detail "Timeline" tab (reused).
- **Files**: `client/src/features/goals/RoadmapWorkspace.tsx`.
- **Data / mutations**: project and goal date edits.
- **Actions**: change the window, edit dates.
- **Overlaps**: Calendar Quarter and Year modes, and the Goals runway.
- **Dead ends / legacy**: the window is May 2026–Apr 2027, but bars stop after October.
- **Visual**: shots `1440-light-12-roadmap.png`, `390-light-12-roadmap.png`.

### 18. Goals & Projects › Projects (C)

- **Purpose vs behaviour**: A list of projects. It works.
- **Entry**: rail "Goals & Projects", and the More sheet "Projects".
- **Files**: `client/src/features/goals/ProjectsGoalsWorkspace.tsx`.
- **Data / mutations**: project create and update.
- **Actions**: open a project, create a project.
- **Overlaps**: the legacy project list with "Break down", in the Goals tools panel.
- **Dead ends / legacy**: the Projects / Outcome goals / Directions tabs sit inside a card.
- **Visual**: doubled header. Shot: `1440-light-13-projects.png`.

### 19. Project detail (C)

- **Purpose vs behaviour**: Tabs Overview / List / Board / Timeline. Its "Board" is a different concept from the Tasks Board: Ready next / Waiting / Completed, plus a dependency linker.
- **Entry**: click a project.
- **Files**: `client/src/features/goals/ProjectDetail.tsx`, `client/src/features/projects/ProjectExecutionWorkspace.tsx`.
- **Data / mutations**: task dependencies and task state.
- **Actions**: switch tabs, link dependencies.
- **Overlaps**: Tasks Board, Tasks List filtered by project, Roadmap.
- **Dead ends / legacy**: a select-based tab switcher.
- **Visual**: plain. Shot: `1440-light-14-project-detail.png`.

### 20. Goals & Projects › Outcome goals (D+)

- **Purpose vs behaviour**: Goal cards with success criteria and review dates. A hidden "More goal and project tools" panel holds the actually useful parts:
  - the Goal runway with progress bars
  - the Horizon compass with milestones
  - the project breakdown list
- **Entry**: the tab inside Goals & Projects, and **also** rail More › "Goals". That gives two rail entries for one page; the highlight moves between them.
- **Files**: `ProjectsGoalsWorkspace.tsx`, `Home.tsx` `GoalPanel` (~4354).
- **Data / mutations**: goals, milestones, project links.
- **Actions**: new outcome, add milestone, plan goal, break down a project.
- **Overlaps**: Dashboard goal cards, Roadmap, Analytics "goal allocation".
- **Dead ends / legacy**: the tools panel uses greyed-out titles and black milestone chips with monospace text. On desktop the tab block stretches to a large empty blue area.
- **Visual**: shots `1440-light-15-goals-outcomes.png`, `1440-light-15b-goals-legacy-tools-open.png`.

### 21. Goals & Projects › Directions (D)

- **Purpose vs behaviour**: "Keep a lasting standard". The demo has 0 directions.
- **Entry**: the tab inside Goals & Projects.
- **Files**: `ProjectsGoalsWorkspace.tsx`.
- **Data / mutations**: direction create.
- **Actions**: "New direction".
- **Overlaps**: goals, and the day's intention.
- **Dead ends / legacy**: an empty page next to an empty "More tools" card.
- **Visual**: shot `1440-light-16-goals-directions.png`.

### 22. Habits (C+)

- **Purpose vs behaviour**: Practice / History / Settings tabs. Practice shows Due today, Flexible this week, Recorded, a seven-day trace, a month calendar, the day's facts and one habit's detail. It all works, on one long page.
- **Entry**: rail "Habits" (badge "4 due"), and the More sheet.
- **Files**: `client/src/features/habits/HabitDisciplineWorkspace.tsx` (2,007 lines).
- **Data / mutations**: habit check-in, skip, undo, edit record, add habit.
- **Actions**: Complete, Skip, Undo, Add note, edit past days.
- **Overlaps**: Today "Habits today", the Focus "Today" card, and the Dashboard.
- **Dead ends / legacy**:
  - "Task insights" button sitting on the habits page.
  - Tabs are local state that always starts at "Practice".
  - Colored left stripes on the cards.
- **Visual**: clear, but it repeats the same facts three ways. Shot: `1440-light-17-habits.png`.

### 23. Habits history URL (duplicate)

- **Purpose vs behaviour**: `habits/history` is titled "History" but renders the same Practice tab. The component ignores the URL view (`useState<View>("practice")`).
- **Entry**: deep link only. The More sheet "History" item goes to Review history, not here.
- **Files / data / actions**: same as 22.
- **Overlaps**: the Habits "History" tab.
- **Dead ends / legacy**: a dead route.
- **Visual**: shot `1440-light-18-habits-history.png`, which is identical to 17.

### 24. Review › Ritual (C-)

- **Purpose vs behaviour**:
  - The left side is a big hero: "Close the loop before you open a new one" with "Return to today".
  - The right side is a dense green legacy panel with recent reviews, recurring work due (Done / Skip / Missed), plan health and decision signals.
  - The real "Begin review" is a tiny text link.
- **Entry**: rail "Review", the More sheet "Review ritual", and "Open Review" from Today.
- **Files**: `Home.tsx` `ReviewRitual` (~2115), `OccurrencePanel` (~3119), `PlanningHealthStrip` (~2288), `DecisionSignals` (~2331).
- **Data / mutations**: review sessions and recurring occurrences (resolve).
- **Actions**: begin review, resolve occurrences.
- **Overlaps**:
  - Plan step 05.
  - Daily shutdown.
  - Analytics.
  - Review history: the same review list again.
- **Dead ends / legacy**: "Return to today" is the primary button on a page meant for reviewing.
- **Visual**: shot `1440-light-20-review-rituals.png`.

### 25. Review › Analytics (B-)

- **Purpose vs behaviour**: Tasks completed over time, tasks by category, planned vs completed focus, carryover, allocation, and saved review evidence. It works.
- **Entry**: rail "Analytics", the tab, the More sheet, and Habits "Task insights".
- **Files**: `client/src/features/insights/PlanningInsightsWorkspace.tsx`.
- **Data / mutations**: read-only.
- **Actions**: read daily counts, show or hide sections.
- **Overlaps**: "Saved review evidence" repeats Review history.
- **Dead ends / legacy**: the chart runs to 11-12, a flat line into the future.
- **Visual**: close to the bar. Shot: `1440-light-21-review-insights.png`.

### 26. Review › History (D)

- **Purpose vs behaviour**: A list of past reviews in a legacy green half-panel. The right half is empty.
- **Entry**: the tab, and the More sheet "History".
- **Files**: `ReviewRitual` with `historyOnly`.
- **Data / mutations**: read-only.
- **Actions**: none. Rows do not open.
- **Overlaps**: the Ritual right panel and Analytics evidence. That is three copies of the same list.
- **Visual**: shot `1440-light-22-review-history.png`.

### 27. Settings (C-)

- **Purpose vs behaviour**: 8 tabs: Account, Appearance, Planning, Navigation, Data & sync, Connections, Categories & Recycle Bin, Device. Every tab repeats a large "Settings" hero card ("Personal space · Ready").
- **Entry**:
  - the "Personal space" footer in the rail
  - rail More › "Connections" and "Categories & Recycle Bin"
  - the More sheet
  - the "Categories" utility button
- **Files**: `Home.tsx` `SettingsSurface` (~6530).
- **Data / mutations**: workspace and preferences update, sign out.
- **Actions**: per tab.
- **Overlaps**: the "Navigation" and "Categories & Recycle Bin" tabs show the **same card**, with two buttons that open dialogs.
- **Dead ends / legacy**: thin pages, each one card deep.
- **Visual**: shots `1440-light-24…31-settings-*.png`.

### 28. Settings › Connections (D+)

- **Purpose vs behaviour**: iPhone calendar link, phone reminders, Google ICS overlay and OAuth status.
- **Entry**: the Settings tab, rail More › "Connections".
- **Files**: `client/src/features/integrations/CalendarIntegrationWorkspace.tsx`.
- **Data / mutations**: calendar link create, integration status.
- **Actions**: "Create link".
- **Overlaps**: none.
- **Dead ends / legacy**: engineer copy ("Configuration-gated and non-connecting", "Secret stays server-side"), and a disabled "ICS refresh is not enabled".
- **Visual**: legacy blue and green blocks with monospace. Shot: `1440-light-29-settings-connections.png`.

### 29. Categories & Recycle Bin dialog (not captured)

- **Purpose vs behaviour**: Manage categories. Lists archived tasks, goals, projects and habits with Restore.
- **Entry**: the Settings button and the rail More item.
- **Files**: `Home.tsx` (~6180).
- **Overlaps**: Tasks › Archived and Roadmap "Archived records". That gives three archive lists.
- **Not captured**: the dialog needs a click the tour did not make.

### 30. Palette (B)

- **Purpose vs behaviour**: Ctrl/Cmd+K. Typing ">" filters to actions and "#" to tasks. Offers "Go to" for every rail item, up to 6 task matches, and "Search everything".
- **Files**: `client/src/features/shell/CommandPalette.tsx`.
- **Overlaps**: the Search page.
- **Visual**: shot `1440-light-01b-command-palette.png`.

### 31. Phone More sheet (C)

- **Purpose vs behaviour**: "More planning". Groups: Work (Habits, Focus, **Dashboard**), Planning & review (Projects, Review ritual, Calendar, Roadmap, Goals, Analytics, Weekly plan, History), then Account & settings.
- **Files**: `client/src/features/shell/PhoneNavigation.tsx`.
- **Overlaps**: it repeats the full rail.
- **Dead ends / legacy**:
  - Dashboard, the best page, is buried here.
  - "Review ritual" and "History" use the same icon.
  - "History" does not say which history.
- **Visual**: shot `390-light-01b-phone-more.png`.

### 32. Hidden "tools" panels (F)

These are the `OwnedToolsDisclosure` and `details.goal-legacy-tools` blocks:

- Tasks: "Task triage tools".
- Plan daily: "Planning and recurring work tools" (DailyCompass and Refresh series).
- Goals: "More goal and project tools".

Each holds legacy UI that the new page never replaced. Each one is either a feature to move into the new page or a thing to delete.

### 33. `/calendar` route (not captured)

`client/src/pages/CalendarExecution.tsx` is an older standalone calendar page. Nothing in the nav links to it. It is a cut-candidate.

---

## Tasks deep dive

### How a task decides where it shows

A task can carry any of three dates:

- **Deadline**: when it must be done.
- **Plan for**: the day you mean to do it.
- **Reserved time**: a block on the calendar.

It can also be parked as **Someday**.

- **Inbox** = open, no Plan for, no Reserved time, not Someday. A deadline alone keeps a task in the Inbox. That is why overdue tasks sit there.
- **List** groups everything by date into Past due / Today / Next 7 days / Later / No date, plus Done.

### Inbox

- **What it is**: the "not yet decided" pile. Nine tasks in the demo, six of them with deadlines.
- **What it does**:
  - It lists them with a "Plan today" button and a menu.
  - The planned one-at-a-time triage card (Today / Tomorrow / Pick date / Someday / Project / Done / Archive, with J/K keys) is not built.
- **Earns its place?** Yes, as a short processing queue. That only works if:
  - it gets real triage actions;
  - a task leaves it as soon as it has any decision;
  - the word "Inbox" stops being used for Calendar's unreserved list.

### List

- **What it is**: every open task by date. This is the workhorse.
- **Earns its place?** Yes. It needs:
  - visual polish: crushed pills, doubled header;
  - a working Select mode.

### Board (legacy, live today)

- **What it is**:
  - Three lanes: To do / In progress / Completed. Blocked is folded into To do, even though the decision says 4 lanes with Blocked.
  - Native drag, plus ↑/↓ buttons and a "Move to" dropdown on every card, as keyboard and phone fallbacks.
  - Dark R20 lane colors in the light theme.
  - "Archive N completed" on the Completed lane.
- **Earns its place?** Not in this form. Status lanes only help if the owner really uses In progress and Blocked. That is a question for the interview.

### Board (D3b, paused)

- **What it is**: `useTaskDnd.ts` (802 lines, R3 done) is a drag-and-drop hook with a drop→mutation table and a drop dock (Plan for today / Archive). It supports Status and When lenses. It is not mounted anywhere.
- **Earns its place?** It is the right fix *if* the Board stays. If the Board is cut, the hook's When lens could still power dragging in List groups.

### Saved views (the Views tab)

- **What it is**: named filters, for example "Job hunt, high priority". They are stored as `{version 2, view, lens, query, filter, sort, categories, projects, priorities}`; older ones are `{filter, sort}`.
- **What it does**:
  - The tab can only apply a view.
  - Creating, pinning and deleting live only in the legacy triage panel, and creating uses a browser prompt.
  - The summary, count and "changed" helpers exist but are not shown.
- **Earns its place?** Weakly. For one person, 2–5 views are plenty. A "Views" dropdown in the toolbar, with "Save current", would do the job without a tab.

### Archived

- **What it is**: archived tasks with Restore.
- **Overlap**: the Recycle Bin dialog lists the same tasks.
- **Earns its place?** Not as its own view. One Recycle Bin (or an "Archived" filter in List) is enough.

### Select and bulk

- **What it is**: the planned Select mode has a Start / Done / Plan for today / Archive bar. Its button is hidden because the handler is not wired.
- **What works today**:
  - checkboxes in the legacy triage panel;
  - Board "Archive N completed".
- **Server limits**: bulk is online only and capped at 100.
- **Earns its place?** Yes, for clean-ups. It should live in List and Inbox, not in a hidden panel.

### Tasks verdict in one line

Keep Inbox and List. Decide Board on use, not looks. Fold Views and Archived into the toolbar and the Recycle Bin. Delete the triage panel once its three jobs (save view, pin and delete view, bulk actions) have new homes.

---

## Navigation and journeys

### Entry points today

| Place | What it holds |
|---|---|
| Rail (desktop) | Dashboard, Today (6 left), Inbox (9) · **Plan**: Tasks (3 overdue), Plan, Calendar, Roadmap · **Grow**: Goals & Projects, Habits (4 due), Focus · **Reflect**: Review, Analytics · **More**: Goals, Connections, Categories & Recycle Bin. That is 15 items plus a search field and the "Personal space" footer. |
| Header | Page title and date, Capture, Search, "…". The tabs Dashboard / Today / Calendar appear on those three pages only. |
| In-page switches | Plan: Daily / Weekly / Calendar / Roadmap. Review: Ritual / Analytics / History. Settings: 8 tabs. Tasks: Inbox / List / Board / Views. Habits: Practice / History / Settings. Goals: Projects / Outcome goals / Directions. |
| Phone bar | Today · Tasks · **+** · Daily plan · More. The owner decided Home · Today · + · Calendar · More (`docs/DECISIONS.md`), but it is not built yet. |
| More sheet | Habits, Focus, Dashboard, Projects, Review ritual, Calendar, Roadmap, Goals, Analytics, Weekly plan, History, then settings. |
| Palette | Go to any page, Capture, Start Focus, theme, task search, "Search everything". |

### Problems with the navigation

- Calendar belongs to two tab groups: Home tabs and Plan tabs. On the phone both rows show at once.
- "Goals" appears twice in the rail.
- "Tasks" sits under the "Plan" group.
- "Inbox" means three things:
  - the rail queue (9)
  - Calendar's unreserved list (24)
  - the capture default
- Badges count different things. "6 left" in the rail does not match "4 items" or "8 commitments" on Today.
- The best page (Dashboard) is hidden in More on the phone.

### The core journey today: capture → triage → plan → do → review

1. **Capture**: header Capture, phone +, palette, or the Tasks header button. Tasks land in the Inbox.
2. **Triage**: there is no single place for it. It is spread over:
   - Inbox ("Plan today")
   - Today ("Remaining decisions")
   - Plan step 01 ("Resolve")
   - Calendar ("Inbox · Unreserved")
3. **Plan**: three pages each own part of the day:
   - Plan › Daily commits tasks.
   - Calendar reserves time.
   - Plan › Weekly spreads work over the week.
   Step 04 of Daily only links to Calendar.
4. **Do**: Today, Focus, or ticking rows anywhere. Recurring and committed tasks bounce you to Review or Plan to finish them.
5. **Review**: there are four places to look back:
   - Plan step 05 and the daily shutdown
   - Review › Ritual (weekly)
   - Review › History
   - Analytics

The journey works, but each step has two to four homes. A new user cannot tell which one is "the" place.

---

## Restructure hypotheses

These are for the owner interview, not decisions.

1. **One "Today" for planning and doing.** Merge Today and Plan › Daily into one page with a short "plan my day" mode. Today, Plan daily, Dashboard and Calendar day all show the same day today.
2. **Calendar is the one time view.** Day and Week fill the screen, and Weekly plan folds into Calendar Week. Quarter and Year leave Calendar for Roadmap. There are two week views and two year views today.
3. **Inbox means "undecided", and nothing else.** Any decision (a date, a project, Someday) takes a task out of the Inbox. It gets the one-at-a-time triage card. Calendar's list is renamed "Unscheduled". Overdue tasks hide in the Inbox today, and "Inbox" has three meanings.
4. **Tasks = Inbox and List, plus Board only if used.** Saved views become a toolbar dropdown with "Save current". Archived moves to the Recycle Bin. The triage panel is deleted. The Views and Archived tabs are thin, and their real controls live in a hidden legacy panel.
5. **One board component, in the light theme.** If a board stays, mount D3b (`useTaskDnd`) and use it for Tasks and Project detail. Drop the R20 dark lane rule. There are two different boards today, and the live one is the worst page in the app.
6. **Goals hold their projects.** Goals & Projects becomes one page where each goal shows its projects and milestones. Directions is cut or becomes a field on a goal. The "More tools" panel's runway and compass become the main view. The useful goal UI is hidden today, and Directions is empty.
7. **Review is one guided weekly flow.** Steps are: resolve recurring work, read the numbers, write the next move. History lives inside it, and Analytics stays as a reference page. The same review list appears three times today, and the main button says "Return to today".
8. **The phone bar follows the decision, and More gets shorter.** Use Home · Today · + · Calendar · More. More then holds about 6 items (Tasks, Goals, Habits, Focus, Review, Settings). Search moves into the palette. The decided bar is not built, and More lists 11 pages including the Dashboard.

Smaller fixes that need no interview:

- Habits ignores `view=history`.
- Navigation and Categories settings tabs are identical.
- Search highlights Dashboard.
- Remove the doubled page headers and the second Capture button.
- The phone day strip overflows sideways.

---

## Interview question bank

Order follows `README.md`. Each question has a recommended answer and a one-line reason. Ask them depth-first: finish one page before moving on.

### Tasks

1. **When you add a task, where do you expect to find it next?** Recommended: in the Inbox until you make one decision about it. *Why:* this sets the meaning of "Inbox" for the whole app.
2. **Should a task with only a deadline still count as "undecided"?** Recommended: no. A deadline is a decision, so it moves to List under its date. *Why:* overdue tasks hiding in the Inbox is the biggest trust leak in Tasks.
3. **Do you ever mark tasks "In progress" or "Blocked"?** Recommended: if rarely, drop the Board and keep List plus Inbox. *Why:* a board is only worth its cost if you use status, and the current one is the worst page.
4. **How many saved filters would you really keep?** Recommended: 2–5, in a toolbar dropdown with "Save current". *Why:* a whole tab for two tiles is heavy, and the create flow is hidden today.
5. **When you archive a task, do you ever go back for it?** Recommended: rarely. One Recycle Bin for everything, with Restore. *Why:* there are two archive lists today, plus a third on Roadmap.
6. **Do you need to act on many tasks at once?** Recommended: yes, through a Select button in List and Inbox (Done, Plan for today, Archive). *Why:* bulk only exists in a hidden legacy panel today.
7. **On the phone, should Inbox triage be one card at a time?** Recommended: yes, with Today / Tomorrow / Someday / Project / Done / Archive. *Why:* it is faster than a list with menus, and it is already designed (D3 spec).

### Today

1. **What is the one thing Today must answer?** Recommended: "what do I do next?". Everything else is secondary. *Why:* the page currently tries to be a report.
2. **Should planning the day happen on Today itself?** Recommended: yes, as a short mode, replacing Plan › Daily. *Why:* four pages show the same day today.
3. **Should a recurring or committed task be tickable right here?** Recommended: yes. The app handles the occurrence or plan record behind the scenes. *Why:* "Open Review" and "Open Plan" buttons instead of ticks break the flow.
4. **Do you want the 28-day habit heatmap on Today?** Recommended: no. Show a "habits due" row only, and keep history on Habits. *Why:* it is the noisiest block on the page.
5. **What is the difference between Dashboard and Today for you?** Recommended: Dashboard = look (week and goals), Today = do (this day). *Why:* without a clear split one of them should go.

### Calendar

1. **Which view should Calendar open in?** Recommended: Week on desktop, Day on the phone. *Why:* it opens in a cramped Day view today.
2. **Should the grid show the whole day or only work hours?** Recommended: the whole day, scrolled to now. *Why:* 08:30–17:30 hides evening tasks the demo has.
3. **Do you need Quarter and Year here, or on Roadmap?** Recommended: Roadmap only. *Why:* two year views, and the Calendar one is legacy.
4. **Is Weekly plan a separate thing from Calendar Week?** Recommended: no. Merge them, with unscheduled work in a side tray. *Why:* the weekly page is 5,100 px of forms.
5. **What should the side list next to the grid be called?** Recommended: "Unscheduled". *Why:* "Inbox" already means something else.

### Plan

1. **Do you plan the day as five steps, or in one pass?** Recommended: one pass: carry over, pick, place. *Why:* numbered steps with text links feel like a form.
2. **Do you want to record energy and mood each day?** Recommended: optional, one tap, on Today. Otherwise cut DailyCompass. *Why:* it is hidden and duplicates the day's intention.
3. **Where should the daily shutdown live?** Recommended: at the end of Today. *Why:* it closes the same day you are looking at.
4. **Do you write weekly objectives?** Recommended: if yes, put them at the top of Calendar Week; if no, cut the form. *Why:* that is the main weight of the weekly page.

### Roadmap

1. **What do you look at on Roadmap: goals, projects or both?** Recommended: goals as rows, with their projects nested. *Why:* this matches hypothesis 6.
2. **Should date editing happen on the bars or in a form?** Recommended: drag the bar ends, with a form as a fallback. *Why:* "Review project dates" is a separate form today.
3. **What window should it open on?** Recommended: this quarter plus the next. *Why:* the 12-month window shows empty months.

### Goals & Projects

1. **Is a project always part of a goal?** Recommended: usually. Allow "no goal", but show projects inside goals. *Why:* it sets whether this is one page or two.
2. **Do you use Directions?** Recommended: cut it, or make it a single line on a goal. *Why:* it is empty in real use.
3. **Which goal view helps most: runway bars or goal cards?** Recommended: runway bars with milestones. *Why:* the best goal UI is hidden behind "More tools".
4. **Should a project have its own board?** Recommended: only if the Tasks Board stays, and as the same component. *Why:* two board concepts confuse.

### Habits

1. **Where do you check off habits?** Recommended: on Today. Habits is for history and setup. *Why:* three pages show the same check-ins.
2. **Which history view is most useful: 7-day trace, month calendar, or heatmap?** Recommended: the 7-day trace on the page, and the month on demand. *Why:* the page shows three versions of the same facts.
3. **Should Habits have its own Settings tab?** Recommended: no. Edit a habit from its detail. *Why:* it is one more tab system.

### Review and Analytics

1. **How often do you review?** Recommended: weekly, guided. Daily is handled by the Today shutdown. *Why:* it sets what "Review" means.
2. **What should "Begin review" walk you through?** Recommended: resolve recurring work, see the numbers, write one next move. *Why:* today the start is a tiny link.
3. **Do you reread past reviews?** Recommended: yes, inside Review only. Remove the copies from Analytics and the Ritual panel. *Why:* the same list appears three times.
4. **Is Analytics for weekly use or occasional?** Recommended: occasional reference, reached from Review. *Why:* that decides whether it needs a rail item.

### Navigation, More and Settings

1. **Confirm the phone bar: Home · Today · + · Calendar · More?** Recommended: yes, as decided. *Why:* it is decided but not built.
2. **Should "Tasks" be in the phone bar instead of Home?** Recommended: no. Inbox gets a badge inside More or Home. *Why:* this protects the decided bar while keeping Tasks one tap away.
3. **Is a separate Search page needed?** Recommended: no. The palette covers it, with a "show all results" panel. *Why:* there are three search fields on one screen today.
4. **Should Settings be one scrolling page?** Recommended: yes, with section anchors. *Why:* 8 thin tabs, two of them identical.
5. **Do you need the Connections detail copy?** Recommended: no. Show status plus one action per connection. *Why:* the page reads like an engineering note.

### Dashboard and Focus (quality bar, light touch)

1. **Should Dashboard be the app's home on every device?** Recommended: yes. *Why:* it is the best page and it is buried on the phone.
2. **Anything missing from Focus?** Recommended: fix only the picker overlap. *Why:* it is already near the bar.

---

## Dark theme note

Dark mode (Dashboard, Inbox, List, Calendar) holds up better than light:

- **List** reads close to the Dashboard in dark. The crushed pills ("W.", "H.") remain.
- **Calendar** in dark still has the core layout problem. The 24-item "Inbox" list runs to about 2,000 px, while the grid box stops near 12:00, and the mode switch sits at the very bottom.
- Light-mode problems are structure problems, not theme problems.

Shots: `1440-dark-01-dashboard.png`, `1440-dark-03-tasks-inbox.png`, `1440-dark-04-tasks-list.png`, `1440-dark-11-calendar.png`.

## Not captured

- The Categories & Recycle Bin dialog: it needs a click inside Settings.
- The `/calendar` legacy route: it is outside the shell tour.
- Drag-in-progress states on Board and Calendar: these cannot be captured as stills.
- The Settings › Appearance, Planning, Sync and Device tabs were captured, but are only summarised here.
