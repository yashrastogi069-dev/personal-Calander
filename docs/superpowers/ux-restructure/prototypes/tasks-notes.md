# Tasks prototype notes

File: `tasks.html`. One self-contained page with inline CSS and JS. It loads Onest from Google Fonts and `lucide@0.453.0` from jsdelivr, and has no other dependencies. Open it straight in a browser. The fixed "today" is Thu 15 Oct 2026.

The floating "Prototype" bar at the top switches between Desktop and a 390 px Phone frame, toggles Dark mode and resets the demo data. Every screen also has the app's own moon/sun toggle in the header.

Colour, radius, type and motion values come from `client/src/design/tokens-v2.css` (`--pc-*`) and `design/motion.ts`. Taps run at 120–220 ms and entrances at 380–500 ms on `--pc-ease`. The sheet uses `--pc-ease-sheet` at 500 ms. When `prefers-reduced-motion` is set, every animation and transition is instant.

## Screens and the decision each one implements

| Screen / element | What it shows | Decision |
|---|---|---|
| Header | A single bar holding the date eyebrow, the "Tasks" title, search, the theme toggle and **one Capture button** (shortcut `C`). Capture opens a quick-add box, and new items land in the Inbox. | Locked summary: "One header, not two" |
| Tabs | Inbox (with a live count badge) · List · Board, then a quiet Archive. The underline glides between tabs. | Q8 (Views tab gone), Q9 |
| Saved-view pills | All · Due soon · Quick wins ≤15m · Waiting on, plus two owner views (Portfolio push, Deep work ≥45m). Each pill shows a live count, and the count ticks when it changes. Changing Group or Filter makes a dashed **Save view** pill appear, which you name inline. Clicking an active owner pill opens Rename / Move left / Delete. | Q8 |
| Inbox | Undecided tasks only (no plan date, no deadline, no project, not Someday). Each one gets a triage card with Today / This week / Pick date / Project / Someday / Delete, and keyboard shortcuts T W D P S ⌫. A triaged card slides out and collapses, an Undo toast appears and the count ticks down. When the Inbox is empty it shows a calm "Inbox clear" state. | Q1, Q2 |
| List | Calm rows: check circle, title, at most 2 smart pills (urgency first, then project or category dot, then the waiting chip) and the estimate on the right. Focus and More float in on hover or focus over a fade, so they take up no width. Groups are Overdue · Today · This week · Later · Someday · No date, each collapsible with a count and total time. "Done today" sits collapsed at the bottom. The Group switch offers When / Project / Category. | Q6, Q7 |
| Board, Week lens (default) | Unscheduled · Mon…Sun with ← → week paging and a Today chip. Each column header shows a count and total estimate. Past empty days shrink. Dragging a card with the mouse lifts it (shadow plus slight tilt), highlights the target column, sets the plan day and shows "Planned for Fri 16 · Undo". A drop past the deadline shows the inline prompt on the card: "Sun is after the Sat deadline", with Plan anyway / Move deadline / Cancel. The ⋯ menu is the keyboard/touch alternative ("Plan today/tomorrow/…"). | Q3, Q4 |
| Board, Status lens | To do · Doing · Done for this week's work. Cards can be dragged between columns. A waiting task keeps its amber chip. Done shows today's finished work only. | Q5 |
| Bulk select | Hovering a row shows a select box in the left gutter. Shift-click selects a range, `X` works on a focused row and long-press works on phone. Selecting rises a glass bar with Plan for… · Move to project · Priority · Archive · Delete. Each batch action has one Undo, and Esc exits. This works in Inbox, List and Board. | Q10 |
| Detail | A right side pane on desktop and a bottom sheet with a grab handle on phone. It has one ✕, a big check circle with an editable title, and fact rows Plan for · Deadline · Estimate · Project · Category · Priority · Repeats · Waiting on. Below them come a "Why it matters" block (up to 2 lines, e.g. "Due Sat · 2 days left", "Moves goal: Launch portfolio"), subtasks with add, and notes. Any edit shows "Saving" and then "Saved ✓". There is one primary **Start focus** button. | Q11 |
| Archive | A Completed \| Archived switch. Completed is grouped by week (This week / Last week / date range) with counts and total time. Both lists have search and a hover Restore. | Q9 |
| Completion | The check draws in and a soft ring bursts. The row dims and strikes through **in place** for the rest of the session, with an Undo toast. Recurring tasks say when the next one is due. | Q9 (dim in place) |
| Phone (390) | Bottom nav, an icon-only Capture button, stacked board columns with past empty days hidden, two-line rows (title, then pills), an icon-only bulk bar above the nav and the detail as a sheet. Nothing scrolls horizontally on Inbox, List, Board or Archive (checked with scrollWidth = 375). | All |

Demo data: 18 active tasks across 5 projects and 5 categories. It includes 2 overdue tasks, 1 waiting task, 2 recurring tasks, deadline-only tasks ("Due Sat · not planned"), 4 Inbox tasks, 8 completed over three weeks and 2 archived.

## Open questions for the owner

1. **What should "This week" in Inbox triage store?** It is a decision without a day. **Recommended:** keep it as a week flag with no plan day. The task then shows under "This week" with a "This week" pill and sits in the Board's Unscheduled column until it is dragged to a day. The other option is to set Plan-for to Friday, which would invent a date the owner never chose. This needs an `isInboxTask` rule and maybe a field.
2. **Should a task ticked off today stay in its group or jump to "Done today"?** The prototype keeps it dimmed in place for the session, as Q9 says, and the collapsed "Done today" group holds tasks finished earlier in the day. **Recommended:** keep it in place until the next page load or midnight, so a mis-tick is easy to spot and undo.
3. **Should drag-to-plan work by touch on the phone Board?** The prototype uses the ⋯ "Plan for" menu and long-press to select, with no touch drag, because it clashes with scrolling. **Recommended:** keep it that way for v1 and consider press-and-hold drag later.
4. **Should the Board's Status lens cover this week only, or everything?** The prototype shows overdue, today and this-week tasks plus anything in Doing. **Recommended:** this week only, so To do stays short. Later work belongs in the List.
5. **Should Board cards carry less than List rows?** On the Week board the column already says the plan day, so "Plan Fri" is hidden and "Due Sat · not planned" shortens to "Due Sat". **Recommended:** yes, cards show only what the column doesn't.

## Known prototype shortcuts (not design decisions)
- Search in the header is visual only. Archive search works.
- Rename uses a browser `prompt()`. The real app would rename inline.
- The Inbox card collapses by animating max-height. This is a one-off exit, so the layout-animation cost is acceptable here. The build should use framer-motion `AnimatePresence` with height or layout.
