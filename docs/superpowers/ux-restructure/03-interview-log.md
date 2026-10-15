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
- **Next for Tasks:** a Fable prototype for owner approval (step 4). Today's code also drops tasks with a deadline; confirm during the build.
