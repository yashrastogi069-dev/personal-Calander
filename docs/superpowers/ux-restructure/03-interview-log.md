# UX restructure interview log

Method: `grill-me`. One question per turn, each with a recommended answer. Codebase facts are settled before asking. Go depth-first, one page at a time. Record every question here, in order, as:

`Q<n> [page/branch]`: question · **Recommended:** … · **Owner:** … (date) · **Locked decision:** …

Copy locked decisions into `docs/DECISIONS.md` as well.

## Order of pages
1. Tasks: Board, List, Inbox, Saved views, Archived
2. Today
3. Calendar
4. Plan: daily and weekly
5. Roadmap
6. Goals & Projects
7. Habits
8. Review and Analytics
9. Navigation and More, Settings

## Log
Inputs: `01-structure-map.md` (Opus, 40 surfaces) and `02-competitor-patterns.md` (Opus, 76 images).

**Q1 [Tasks › Inbox]**
- **Question:** what should the Inbox mean? Today it mixes new thoughts with dated tasks: 6 of the 9 demo Inbox tasks have deadlines, one overdue since Oct 14.
- **Recommended:** undecided only.
- **Owner (2026-10-15):** "Undecided only".
- **Locked decision:**
  - A task waits in the Inbox only until ONE decision is made: a date, a project or Someday. Then it leaves automatically. Dated tasks never sit in the Inbox.
  - The Inbox becomes a short to-sort pile with a premium triage card: Today / This week / Pick date / Project / Someday / Delete.
  - The goal is an empty Inbox. Notifications never go there.

**Q2 [Tasks › Inbox]**
- **Question:** does a deadline alone take a task out of the Inbox?
- **Recommended:** yes, any date counts.
- **Owner (2026-10-15):** "Yes, any date counts".
- **Locked decision:**
  - Any date (Plan-for OR Deadline), a project or Someday takes a task out of the Inbox.
  - A deadline-only task goes to List under its When group, with the meta line "Due Sat · not planned", so the missing plan day stays visible.
  - The Inbox rule is "no Plan-for date, no deadline, no project, not Someday".
  - Engine impact: `isInboxTask` in shared must match this.

**Q3 [Tasks › Board]**
- **Question:** what is the Board for?
- **Recommended:** a week board with a Status toggle.
- **Owner (2026-10-15):** "Week board, Status toggle".
- **Locked decision:**
  - The default Board columns are Unscheduled · Mon … Sun of the shown week, with ← → week paging.
  - Dragging a card to a day sets its **Plan-for** date to that day (Sunsama style).
  - Each column header shows a count and total estimate.
  - One switch flips to Status columns (To do / In progress / Done).
  - The legacy dark R20 board and its per-card "Move to" dropdowns go; a keyboard and menu "Move to…" stays as the accessible alternative.
  - Build impact: `useTaskDnd` (R3) covers the Status lens and the bucket When lens. It needs a **day-column lens** (plan date = column date; Unscheduled clears the plan date), plus `planTaskDrop` rules for day targets.
  - This supersedes the 2026-10-14 assumption "Status lens is the Board default".

**Q4 [Tasks › Board drag]**
- **Question:** what happens when a card is dropped on a day after its deadline?
- **Recommended:** ask once, then allow.
- **Owner (2026-10-15):** "Ask once, then allow".
- **Locked decision:**
  - A drop past the deadline shows an inline prompt on the card: "Mon is after the Sat deadline", with Plan anyway / Move deadline / Cancel.
  - Every other drop applies instantly, with an Undo toast.
  - Build impact: `shared/taskDrop.ts` currently REFUSES past-deadline and due-today drops (review #8). Change those cases from refusal to a "confirm" outcome; keep hard refusals only for impossible moves (archived, recurring series rules, still saving).

**Q5 [Tasks › Board › Status view]**
- **Question:** which Status columns?
- **Recommended:** To do · Doing · Done.
- **Owner (2026-10-15):** "To do · Doing · Done".
- **Locked decision:**
  - Three columns.
  - Blocked / "waiting on" is an amber chip on the card showing what it waits on, not a column.
  - The Done column shows today's finished work, then clears quietly. Older done work lives in the Completed archive (see the Archive questions).

**Q6 [Tasks › List rows]**
- **Question:** how much should one row show?
- **Recommended:** calm, 2 facts + time.
- **Owner (2026-10-15):** "Calm: 2 facts + time".
- **Locked decision:**
  - A row is the title, then at most 2 smart pills chosen by importance, then the time estimate.
  - Pill priority:
    1. The urgency state (Overdue Nd / Due X · not planned / Plan Thu)
    2. Project, OR the category dot if there is no project
    3. Waiting chip, if blocked
  - Everything else lives in the side pane.
  - Focus and More actions float in on hover or focus (on touch, swipe or long-press) and reserve NO width. This fixes the D3a visual problems 1–2.

**Q7 [Tasks › List grouping]**
- **Question:** what should the default grouping be?
- **Recommended:** When, with a Project/Category switch.
- **Owner (2026-10-15):** "When, + Project/Category switch".
- **Locked decision:**
  - Default groups: Overdue · Today · This week · Later · Someday · No date. Each is collapsible and shows a count and total time.
  - A "Group by" switch offers When / Project / Category, remembered per device.
  - "Done today" sits collapsed at the bottom.

**Q8 [Tasks › Saved views]**
- **Question:** what should saved views become?
- **Recommended:** pills with live counts.
- **Owner (2026-10-15):** "Pills with live counts".
- **Locked decision:**
  - A pill row sits under the Tasks tabs. It holds built-in smart views (e.g. Due soon, Quick wins ≤15m, Waiting on) plus the owner's own views, each with a live count.
  - "Save view" appears whenever filters, group or sort change.
  - A pill's menu offers rename / reorder / delete.
  - A saved view stores filter + group + sort + layout (List/Board).
  - The separate Views tab and the legacy SavedViewsPanel creation path go.
  - Check whether the existing `savedViews` snapshot fields can hold group and layout without a migration (migrations are gated). If they can't, store the extras inside the existing JSON field or ask the owner.

**Q9 [Tasks › Archive]**
- **Question:** where do finished and put-away tasks live? There are 3 archive lists today.
- **Recommended:** one Archive with a Completed | Archived switch.
- **Owner (2026-10-15):** "One Archive: Completed | Archived".
- **Locked decision:**
  - There is one quiet "Archive" entry at the end of the Tasks tabs.
  - Inside, a switch:
    - **Completed:** finished work, grouped by week with counts and time, searchable, with Restore.
    - **Archived:** put away without doing it, with Restore.
  - Done tasks dim in place for the rest of the day, then move to Completed automatically. This is a display rule only; no data is deleted.
  - The legacy board's "Archive N completed" button goes.
  - The Settings Recycle Bin keeps only deleted categories and projects.

**Q10 [Tasks › Bulk actions]**
- **Question:** do you want multi-select?
- **Recommended:** yes, with a floating action bar.
- **Owner (2026-10-15):** "Yes, floating action bar".
- **Locked decision:**
  - Selection starts from a row's check-circle edge on hover/keyboard, or by long-press on phone.
  - A floating glass bar rises with Plan for… · Move to project · Priority · Archive · Delete, plus one Undo for the whole batch.
  - Esc exits selection.
  - Works in Inbox, List and Board.
  - The unwired Select button and the "Task triage tools" stub (`TaskTriagePanel`) go.

**Q11 [Tasks › Task detail]**
- **Question:** how should editing feel?
- **Recommended:** autosave, with Focus as the hero.
- **Owner (2026-10-15):** "Autosave, Focus as hero".
- **Locked decision:**
  - Every field saves on change, with a quiet "Saved ✓", an Undo toast on mistakes, and a conflict message on version clash. No Save button.
  - Layout: one ✕ close; a big check circle + title; fact rows (Plan for · Deadline · Estimate · Project · Category · Priority · Repeats · Waiting on); then "Why it matters" (D4), subtasks, notes.
  - One primary button: ▷ Start focus.
  - Desktop shows a right side pane; phone shows a sheet.
  - This fixes the D3a visual problem 4 (wrapping footer, two Close buttons).

### Tasks: locked summary (Q1–Q11)
- **Tabs:** Inbox · List · Board, plus a quiet Archive at the end. The pill row of saved views sits under the tabs.
- **One header, not two:** the shell bar and TaskHeader merge, with one Capture button. No question needed; this fixes a bug.
- **Inbox:** undecided only, with triage cards.
- **List:** calm rows grouped by When, with a group-by switch.
- **Board:** a Week board by default (drag to a day = plan it), with a Status switch (To do · Doing · Done). A late drop asks once.
- **Saved views:** pills with live counts.
- **Archive:** Completed | Archived.
- **Bulk:** a floating bar.
- **Detail:** autosave, with Focus as the hero.
- **Cut:** the legacy dark board, per-card Move-to dropdowns, the Views tab, the legacy SavedViewsPanel creation path, the "Task triage tools" stub and the unwired Select.
- **Next for Tasks:** a Fable prototype for owner approval (step 4).

**Q12 [Today]**
- **Question:** what's the difference between Dashboard and Today?
- **Recommended:** Dashboard = look, Today = do.
- **Owner (2026-10-15):** "Dashboard = look, Today = do".
- **Locked decision:**
  - Dashboard stays the overview: week rhythm, goals, focus, habits at a glance.
  - Today becomes the ONE place to plan and do this day:
    - a "Next up" hero with Focus
    - the timeline
    - today's tasks, tickable
    - habits due
    - a short "Plan my day" mode and a "Shut down day" mode
  - Plan › Daily folds into Today. Calendar Day stays as the time grid only.

**Q13 [Today › Plan my day]**
- **Question:** how should planning the day work?
- **Recommended:** one calm pass with 3 moves.
- **Owner (2026-10-15):** "One calm pass, 3 moves".
- **Locked decision:** a focused overlay on Today with three moves:
  1. Yesterday's leftovers: keep / move / let go, one tap each.
  2. Pick today's tasks from a tray (Overdue, Due soon, This week) with a live capacity bar ("planned 4h10 of 6h free").
  3. Optionally drag them onto the timeline.

  Finishing fills Today with a staggered entrance. It replaces the 5 numbered steps.

**Q14 [Today › ticking]**
- **Question:** recurring and committed (planned) tasks on Today have no tick. `TodayFlexibleWork.tsx` sends them to "Resolve in Plan / Recovery". Should every Today task be tickable in place?
- **Recommended:** yes, tick in place.
- **Owner (2026-10-16):** "Yes, tick in place".
- **Locked decision:**
  - Every Today row has ONE check circle.
  - Ticking a recurring task completes only today's occurrence. Ticking a committed or carried task closes its plan record. The app resolves which record behind the scenes.
  - Every tick gives an Undo toast.
  - The "Resolve in Plan / Recovery" copy leaves Today. Leftovers are handled by Plan my day, move 1 (Q13).
  - Build impact: the Today row needs one `completeTodayItem(row)` that dispatches by `row.source` (task / occurrence / daily_commitment / carried_commitment) to the existing mutations. No schema change expected; confirm during the build.

**Q15 [Today › habits]**
- **Question:** Today shows a habit list with 7-day traces AND a full heatmap with a key (`TodayHabits.tsx`). What belongs on Today?
- **Recommended:** a "habits due" row only.
- **Owner (2026-10-16):** "keep the one compact row of habit chips due today in TODAY, but keep the heat maps and other things inside the Habits tab. What do you think?" Primary agreed: same do-vs-look split as Q12.
- **Locked decision:**
  - Today shows one compact row of chips for the habits due today. Tap = done (the ring fills). Long-press or the menu = skip.
  - Done chips fade. The row hides when nothing is due.
  - Heatmap, 7-day traces, streaks, history and the colour key move to the **Habits** tab (and its Dashboard glance).
  - Build impact: split `TodayHabits.tsx`. The activity grid and traces go to the Habits page; Today keeps a chip row.

**Q16 [Today › Shut down day]**
- **Question:** the shutdown lives in Plan › Daily (`PlanWorkspace.tsx` ~1444). It blocks closing until every commitment is resolved and has a one-line reflection. Plan Daily folds into Today (Q12), so how should "Shut down day" work?
- **Recommended:** a calm 3-step overlay that never blocks.
- **Owner (2026-10-16):** "Calm 3-step overlay but add some strictness as well in the end or anywhere".
- **Locked decision (primary's design of the strictness; check it in the Today prototype):**
  - Today offers "Shut down day" from the owner's preferred shutdown time (the existing `preferredShutdownAt` setting), and it is also always in Today's menu.
  - **Step 1, Wins:** done count, focus time and habits done, with a soft count-up animation.
  - **Step 2, Open items:** each gets Tomorrow / Pick day / Let go, one tap each. "Move all to tomorrow" is allowed, but it is an explicit tap.
  - **Step 3, Reflection:** one line, optional. Then "Close day".
  - **Strictness:**
    - "Close day" stays disabled until every open item has an explicit decision. Nothing carries over silently, which is the spirit of today's rule.
    - Any item carried over **3+ times** cannot use "Move all"; it must be scheduled on a specific day, broken down, or let go.
    - Closed days can be reopened (the existing `reopenPlan`).
  - Build impact: reuse the Plan close/resolve/move mutations; the carry count comes from the existing carry/recovery data (confirm the field during the build).

**Q17 [Today › energy & mood]**
- **Question:** a hidden DailyCompass form (energy, mood and a second "intention" field) sits in Plan's tools panel, and the server stores it. Keep it?
- **Recommended:** optional, one tap.
- **Owner (2026-10-16):** "Optional one tap".
- **Locked decision:**
  - Plan my day (and the shutdown recap) shows one skippable row of 5 energy levels; one tap records it.
  - Mood folds into the shutdown reflection line.
  - Review/Analytics may later chart energy against focus time.
  - The hidden DailyCompass form and its duplicate intention field go. Stored data stays untouched; no migration.

### Today: locked summary (Q12–Q17)
- **Today = do**, Dashboard = look.
- **Contents:** Next-up hero with Focus · timeline · tickable tasks (all kinds, Q14) · "habits due" chips (Q15).
- **Plan my day:** a calm 3-move overlay (Q13), with an optional energy tap (Q17).
- **Shut down day:** a calm-but-strict 3-step overlay (Q16).
- **Moves out:** Plan › Daily folds in; the habit heatmap and traces go to Habits; Recovery copy and DailyCompass go.
- **Next for Today:** a Fable prototype, after owner confirmation.

**Calendar: scope note (owner, 2026-10-16):** "we are going to change the calendar right? Because right now it's too messed up, needs major changes of UI UX, total design." **Yes: Calendar gets a total UI/UX redesign.** Q18 onward set its structure; a Fable prototype follows (owner confirms before the run), and the Opus build comes after approval.

**Q18 [Calendar › default view]**
- **Recommended:** Week on desktop, Day on the phone.
- **Owner (2026-10-16):** "Week desktop, Day phone".
- **Locked decision:**
  - Desktop opens on the week grid.
  - Phone opens on Day, with swipe between days (D3.5 `useDaySwipe`).
  - The last view used is remembered per device.

**Q19 [Calendar › hours]**
- **Recommended:** the whole day, scrolled to now.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - The grid runs 00–24 and auto-scrolls so "now" sits about a third of the way down.
  - Hours outside the work window are softly tinted, not hidden.

**Q20 [Calendar › Quarter/Year]**
- **Recommended:** Roadmap only.
- **Owner (2026-10-16):** same.
- **Locked decision:** Calendar is Day / Week / Month. Quarter and Year live in Roadmap; the legacy Calendar Quarter/Year view goes.

**Q21 [Calendar › side list]**
- **Recommended:** an "Unscheduled" tray.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - The tray beside the grid is renamed from "Inbox" to **Unscheduled**.
  - It holds tasks planned for the shown day or week that have no time slot, grouped Overdue / Today / This week.
  - Drag a task onto the grid to time-block it. The tray collapses.

**Q23 [Plan › weekly objectives]** (asked alongside Q22)
- **Recommended:** yes, 1–3, kept light.
- **Owner (2026-10-16):** "Yes, 1–3, light".
- **Locked decision:**
  - 1–3 objectives are set during the weekly planning moment.
  - They show as a slim strip (on the weekly surface chosen in Q22, and on Dashboard), can be ticked off, and unfinished ones offer carry-forward (the existing `weeklyObjective.carryForward`).
  - An objective can optionally link to a Goal.

**Q22 [Plan › Weekly]: first ask unclear.** The owner leans to "keep a lean weekly page" but found the question confusing. The primary explained it in plain words (three places show "your week") and re-asked.

**Q22 [Plan › Week], re-asked in plain words**
- **Explanation given:** three places show "your week". Tasks Board decides *which day*, Calendar Week decides *what time*, and Plan › Weekly is a second board plus forms. Its only unique parts are the objectives and the weekly planning moment.
- **Recommended:** a lean "Week" page.
- **Owner (2026-10-16):** "Lean 'Week' page. We can do this but make sure the user flow is right, or something else, whichever is best for the flow, UX, planning and the user's understanding."
- **Locked decision (the primary owns the flow; check it in the prototype):**
  - **One pattern, daily and weekly.** Plan my day (Q13) and Plan my week both run *look back → choose → place*.
  - **Entry:** on the owner's weekly planning day (Sunday evening / Monday morning; the setting defaults to Monday), Dashboard and Today show a quiet "Plan your week" card until it is done. Plan › Week can always be opened from nav.
  - **Page, top to bottom:**
    1. **Look back:** last week's done count, focus time, objective results, and leftovers with keep / move / let go (one tap; the same pattern as shutdown).
    2. **Objectives:** 1–3 (Q23), optionally linked to a Goal.
    3. **Place:** a 7-day capacity strip (planned vs free hours per day, from the work window minus calendar busy time) above the **same Week board component as Tasks** (one component, two doors).
  - Finish with "Week planned" (soft celebration), which returns to Today.
  - **After planning,** the page becomes a calm "This week" overview: objective progress, capacity, the board. It is safe to revisit; nothing re-runs.
  - **Roles stay distinct:** Week = the planning ritual + overview; Tasks Board = everyday drag-to-day; Calendar = time grid; Today = do.
  - **Cut:** the 5,100px forms, the duplicate board, and the planning-history block (history lives in Review).

**Q24 [Roadmap › rows]**
- **Recommended:** goals as rows, with projects nested.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - Each goal is a row: a runway bar to its target date, with milestones as diamonds.
  - Expanding a goal shows its projects as bars beneath it.
  - Projects without a goal sit in a "No goal" group at the bottom.

**Q25 [Roadmap › editing dates]**
- **Recommended:** drag the bar ends, with a form as fallback.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - Drag a bar to move it; drag its ends to resize. A live date tooltip shows while dragging, and an Undo toast follows.
  - Clicking a bar opens the side pane with date fields; this is the keyboard and phone path.
  - The separate "Review project dates" form goes.

**Q26 [Roadmap › window]**
- **Recommended:** this quarter plus the next.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - Roadmap opens on about 6 months with today marked.
  - Zoom chips: Month / Quarter / Year. Quarter and Year live here now (Q20).

**Q27 [Goals & Projects › structure]**
- **Recommended:** usually linked; one page.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - There is one **Goals** page: goals with their projects inside.
  - Projects without a goal sit in a "Standalone projects" section.
  - The separate Projects / Outcome goals tabs go.

**Q28 [Goals › Directions]**
- **Recommended:** one line on a goal.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - The Directions tab goes.
  - Each goal gets an optional "Why this matters to me" line, which also feeds the D4 "Why it matters" reasons.
  - Existing direction rows stay untouched; no migration.

**Q29 [Goals › view]**
- **Recommended:** runway bars with milestones.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - Each goal shows a progress runway to its date with milestones, % done (from its projects and tasks), and a "next step" task.
  - Cards on the phone.
  - This view moves out from behind "More tools" to lead the page.

**Q30 [Projects › board]**
- **Recommended:** reuse the Tasks views.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - Opening a project shows the same Tasks List and Board components filtered to that project, under a header with goal, dates and progress.
  - There is one board concept app-wide.

**Habits: settled earlier.** Check-ins happen on Today as "habits due" chips (Q15). Habits is for history and setup.

**Q31 [Habits › layout]**
- **Recommended:** habit cards plus one heatmap.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - **Top:** one year heatmap of all habits combined (GitHub style, with an animated fill).
  - **Below:** one card per habit with its streak, a this-week ring and 7-day dots.
  - **Card tap:** opens a detail with that habit's month calendar, its own heatmap, and edit.
  - No duplicate views on one screen.

**Q32 [Habits › settings]**
- **Recommended:** no settings tab; edit in the habit detail.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - Cadence, target, reminder and archive are all edited in the habit's detail pane.
  - "+ New habit" sits on the page.
  - The Habits Settings tab goes.

**Q33 [Review › weekly ritual]**
- **Recommended:** one ritual, Review → Plan.
- **Owner (2026-10-16):** same.
- **Locked decision:** one weekly flow on the Week page, which refines the Q22 flow:
  1. **Review:** wins; numbers (done, focus hours, habits, energy); resolve recurring and leftover work; a one-line "lesson".
  2. **Objectives:** 1–3.
  3. **Place:** capacity strip and the Week board.

  It is saved as that week's review. The daily reflection stays in Today's shutdown (Q16).

**Q34 [Review › history & Analytics]**
- **Recommended:** one page, "Insights", with history and charts.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - Review and Analytics become one page, **Insights**: past weekly reviews (a searchable timeline) plus Analytics charts (focus hours, completion, habits, energy vs focus).
  - One rail item.
  - The Ritual panel and the duplicate review lists go.

**Q35 [Review › cadence]**
- **Recommended:** weekly, plus the daily shutdown.
- **Owner (2026-10-16):** same.
- **Locked decision:**
  - The weekly ritual runs on the planning day; the daily close is Today's shutdown.
  - An optional monthly recap card is auto-generated in Insights. It is not a ritual.

**RESUME HERE (usage limit, 2026-10-15):** Q14 LOCKED 2026-10-16. Q15 LOCKED 2026-10-16. Q16 LOCKED 2026-10-16. Q17 LOCKED 2026-10-16; Today branch DONE. Calendar Q18–Q21 LOCKED 2026-10-16; Plan Q22–Q23 LOCKED 2026-10-16. Roadmap Q24–Q26 LOCKED 2026-10-16. Goals & Projects Q27–Q30 LOCKED 2026-10-16. Habits Q31–Q32 LOCKED 2026-10-16. Review Q33–Q35 LOCKED 2026-10-16. Next: Nav/More/Settings Q36+. Then the, Plan weekly, Roadmap, Goals & Projects, Habits, Review/Analytics and Nav/More/Settings banks in `01-structure-map.md` "Interview question bank", plus the 8 D4 owner questions in the D4 spec §6. Today's code also drops tasks with a deadline; confirm during the build.
