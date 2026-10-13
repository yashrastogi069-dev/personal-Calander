# Premium redesign D3: Tasks (list, board with drag, Inbox triage, detail sheet)

Date: 2026-10-13. Author: Fable 5.1 (owner-approved key design moment). Status: logic layer built and pushed (`65be9e0`). The "Next 7 days" drop is now capped at the deadline. The UI (§14 Fable column) and `useTaskDnd` are not built: they wait on the `@dnd-kit` install (see HANDOFF blocker). When wiring `useTaskDnd`, pass the full lane to `planSortOrderMove` (review #9). Branch `work/premium-redesign`.
Builds on [D0](2026-10-13-premium-redesign-d0-design.md), [D1](2026-10-13-premium-redesign-d1-shell.md), [D2](2026-10-13-premium-redesign-d2-dashboard.md) and the [Focus and inner-surface map](2026-10-13-premium-redesign-focus-and-inner-surfaces.md) (Part 2, rows "Tasks", "Task detail sheet", "Inbox triage").

Owner input: "a long flat list ending in a 'Task triage tools' stub"; every screen modern, futuristic and cool, with lots of state-driven motion. `@dnd-kit` is approved for D3 (DECISIONS 2026-10-13).

Design read: a daily-use planning tool for one owner on laptop and iPhone. Precise-instrument language inside the approved v2.1 white/blue and slate-dark identity, Fernly Tasks board as the structural reference (`BEST Shots/... 4.37.07 PM (1).jpeg`: lane headers with count, tinted tags, priority flag, progress bar, date footer). Dials: variance 5, motion 7 (state-driven only), density 5.

---

## 1. What is wrong today (demo data, 1440 and 390, light and dark)

1. List is one 52-row flat list (3,539px tall at 1440, 5,209px at 390). Overdue, today, someday and done are interleaved. Done work sits in the middle (sorted by sortOrder), and 16 struck-through rows close the page.
2. Every row repeats a boxed "Focus" button. Metadata is one grey run-on line ("Reserved 09:15-10:30 · Subtask of … · Graduate job search sprint · Critical priority · 75 min").
3. The page ends in an `OwnedToolsDisclosure` "Task triage tools" stub. Behind it is a second, older task list (`TaskTriagePanel` in `Home.tsx`) with its own filter, sort, bulk select and saved-view save. That duplicates the workspace.
4. Board: 3 lanes (To do, In progress, Completed). `blocked` exists in the schema but is folded into To do. Drag is native HTML5 (no touch, no keyboard), and every card carries a native "Move to" select plus ↑/↓ buttons.
5. Native `select` controls for filter and order. The dark search field still has the legacy green border.
6. **Bug.** A daily recurring task ("LinkedIn engagement: 15 minutes") shows "Plan for Sep 24", which is the series anchor date (`scheduledLocalDate`), not the occurrence. `keyTimeForTask` in `shared/canonicalTask.ts` never looks at `recurrenceRule`.
7. Empty states are sentences in dashed boxes, and the archive is a fifth tab.

## 2. What the data supports (from code; nothing invented)

| Fact | Source |
|---|---|
| Lifecycle `not_started / in_progress / blocked / completed / archived` | `drizzle/schema.ts` `lifecycleStates`, router `lifecycle` |
| `priority none/low/medium/high/critical`, `horizon daily…someday`, `scheduleMode` | tasks table |
| Three separate dates: `dueLocalDate` (Deadline), `scheduledLocalDate` (Plan for), `plannedStartAt/EndAt` (Reserved time) | tasks table, `shared/planningLanguage.ts` |
| `estimateMinutes`, `sortOrder`, `parentTaskId` (subtasks), `projectId`, `goalId`, `categoryId` | tasks table |
| Recurrence `recurrenceRule {frequency, interval, weekdays}`, `recurrenceAnchor scheduled/completion`, `recurrenceUntilLocalDate`; dated `taskOccurrences` (pending/completed/skipped/missed/rescheduled) | tasks + taskOccurrences, `server/plannerRules.ts isRecurringLocalDate` |
| Dependencies `taskDependencies {taskId, dependsOnTaskId, hard/soft}` | `shared/dependencyPolicy.ts dependencyExecutionState` |
| Saved views `{name, viewType:"tasks", configuration: jsonb, isPinned}` | savedViews table. `configuration` is free-form, so new keys are not a schema change |
| Deadline risk `overdue / due_today / unplanned_soon` | `shared/planningForecast.ts` |
| Offline queue, pending ids, conflict counts per task | `persistTaskPatch`, `pendingOperations`, `conflictCountByTask` in `Home.tsx` |

Mutations that D3 may call (all exist):

- `planner.task.update({id, expectedVersion, patch})`. It writes any subset of task fields in one call (state + sortOrder together is one write).
- `planner.task.bulkSetState({ids, state})` (max 100)
- `planner.task.create` (subtasks, via existing `onCreateSubtask`)
- `planner.task.addDependency`, `planner.task.removeDependency`
- `planner.occurrence.resolve({id, expectedVersion, state, rescheduledToLocalDate?})`
- `planner.occurrence.materialize({start, end})`
- `planner.savedView.create`, `planner.savedView.update`, `planner.savedView.delete`

Server rules the UI must respect, because they reject writes (`server/planning.ts updateTask`, `bulkSetTaskState`):

- **R1.** A task with `recurrenceRule` cannot be set `completed`, `archived` or `wont_do`. Resolve a dated occurrence instead.
- **R2.** `completed` is refused while any hard prerequisite is incomplete.
- **R3.** `completed`/`archived` is refused while the task is `committed` in a non-archived daily plan (`assertNoOutstandingTaskCommitments`). It has to be resolved from Plan.
- **R4.** A version mismatch throws `PlannerConflictError`.
- **R5.** The bulk procedures are online only. Offline writes go through `persistTaskPatch` one record at a time (same as `archiveCompletedTasks` already does).

---

## 3. Information architecture

One Tasks page, four tabs (owner rule: max 4 per page), SegmentedTabs with `activationMode="manual"` because tabs navigate:

| Tab | URL view (unchanged) | Answers |
|---|---|---|
| Inbox `12` | `inbox` | "What have I not decided about yet?" |
| List | `list` (default) | "What is next, by time?" |
| Board | `board` | "Where does each piece of work stand?" |
| Views | `saved` | "My saved filters" |

- **Archive** leaves the tab bar. It opens from the header overflow ("Archived tasks"), and `view=archive` still deep-links. Restore keeps its current semantics.
- **The "Task triage tools" disclosure and `TaskTriagePanel` are removed.** Their three real functions move into the workspace: filter + sort become the toolbar, bulk state change becomes Select mode (§9), and save view becomes "Save view" (§10).

### 3.1 Lane model (decision)

**Board default lens: Status.** It has four lanes: To do · In progress · Blocked · Done.

**Board second lens: When**, a toggle that persists in the URL and in saved views. It has five lanes: Past due · Today · Next 7 days · Later · No date.

**List is always grouped by When**, with Done collapsed at the end.

Why Status is the default board:

1. Every Status drop is one unambiguous write (`state`) with no date picker. That is what makes drag feel instant.
2. It gives `blocked` a home. Today it is hidden inside To do.
3. The time question is already answered by List, so the two views answer different questions instead of repeating each other.
4. It matches the Fernly reference and the owner's "Tasks board with drag" approval.

The cost: for one person, To do is the tallest lane. So inside To do (Status lens only), cards keep the List's When order, and quiet inline dividers ("Today", "Next 7 days", …) appear between groups whenever sort is not Manual.

### 3.2 When buckets (pure function `taskWhenBucket(task, ctx)`)

These buckets apply to open tasks only. The key date is the earliest of `Reserved date`, `Plan for` and `Deadline` that is on or after today. For recurring tasks it is the next occurrence (§7).

| Bucket | Rule (first match wins) | Section/lane copy |
|---|---|---|
| Past due | `dueLocalDate < today`, or `scheduledLocalDate < today` with no future reservation and no pending occurrence today | "Past due". The card pill says which: "Overdue 2d" (deadline) or "Planned 12 Oct" (slipped plan) |
| Today | key date = today, or a pending occurrence today | "Today" |
| Next 7 days | today < key date ≤ today+7 | "Next 7 days" (not "This week": on Sunday "this week" would be empty) |
| Later | key date > today+7 | "Later" |
| No date | no deadline, no plan, no reservation, not recurring | "No date". Inbox tasks plus Someday (`horizon=someday`, shown with a "Someday" pill) |
| Done | `state=completed` | List only, collapsed: "Done 16" |

The Past due count must equal the D1 rail badge "N overdue" for the deadline part. The rail counts only `dueLocalDate < today`, so the section header shows both numbers: "Past due 5 (3 overdue)".

### 3.3 Drop → mutation table (pure function `planTaskDrop(task, target, ctx)`)

It returns `{ok:true, write}` or `{ok:false, reason}`. `write` is one of `update(patch)`, `resolveOccurrence(occurrenceId, "completed")` or `needsDate({min,max})`. While the card hovers, the lane shows the refusal reason (§6). It never fails silently.

**Status lens**

| Drop target | Write | Refused when (reason shown) |
|---|---|---|
| To do | `update({state:"not_started"})`. Reopens Done (server clears `completedAt`) | never |
| In progress | `update({state:"in_progress"})` | never (state on a recurring series is legal; only terminal states are blocked by R1) |
| Blocked | `update({state:"blocked"})` | never |
| Done | non-recurring: `update({state:"completed"})`. Recurring with a pending occurrence today: `occurrence.resolve(today's occurrence, "completed")`, and the card stays in its lane with "Done today" | R1 recurring with no pending occurrence today: "Repeats weekly. Next one is Fri 16 Oct." R2: "Waiting on 2 tasks: finish them first." R3: "Committed in today's plan. Resolve it in Plan." (link) |
| Same lane, new position (sort = Manual) | `update({sortOrder})` via `sortOrderBetween(prev, next)` | sort ≠ Manual: the drop changes the lane only, and the card lands where the sort puts it. Announce "Sorted by due date, so the order follows the sort." |
| Other lane at a position | `update({state, sortOrder})` in ONE write | as above |

**When lens**

| Drop target | Write | Refused when |
|---|---|---|
| Past due | (never a target) | always: "You can't plan into the past." |
| Today | `update({scheduledLocalDate: today})` | reserved on another day: "Reserved Fri 16 Oct 09:15. Move it in Calendar." Recurring: "Repeating tasks follow their schedule. Edit the repeat in details." |
| Next 7 days | `needsDate({min: today+1, max: today+7})`. A day-strip popover opens at the drop point (Tomorrow, Fri 16, … 7 chips) and the choice writes `update({scheduledLocalDate})` | reserved / recurring as above |
| Later | `needsDate({min: today+8, max: deadline})`: date popover with "Next Monday" and "In 2 weeks" quick chips | deadline ≤ today+7: "Deadline 16 Oct keeps this in Next 7 days." Reserved / recurring as above |
| No date | `update({scheduledLocalDate: null})`. Announce "Moved to No date. It is back in Inbox." when it now matches `inboxTasks()` | has a deadline: "Has a deadline (20 Oct). Clear it in details." Has reserved time / recurring |

Escape or a click outside a date popover cancels the drop, and the card glides home with no write.

**Drop dock** (both lenses, appears only while dragging). It is a floating glass strip at the bottom of the board with two targets: **Plan for today** (`update({scheduledLocalDate: today})`, same refusals as Today) and **Archive** (`update({state:"archived"})`, refusals R1/R3, with the 6s Undo that already exists).

**Re-order maths.** `sortOrderBetween(prev, next)` returns the integer midpoint. If the neighbours have no integer gap, the lane's visible tasks (max 24, the existing preview limit) are renumbered with a 1024 step using sequential `update({sortOrder})` calls, and the moved card is written last. Above 24 the drop is refused with "Use Move up and down for long lanes." This is listed under Needs data as a bulk reorder.

---

## 4. Layouts

### 4.1 1440, Board, Status lens (light; dark mirrors with slate tokens)

```
┌ rail 216 ┐┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ Tasks ●  ││ [▣] Tasks                                        [☐ Select]  [+ Capture]   [⌕ Search ⌘K]   [⋯] │
│ 3 overdue││     36 open · 3 overdue · 13 for today                                                        │
│          ││ ( Inbox 12 │ List │ Board● │ Views )                                 Lens ( Status● │ When )  │
│          ││ [⌕ Search tasks           / ]  (All 52)(Open 36)(Today 13)(At risk 4)  [⊕ Filter] [⇅ Manual ▾] [Save view] │
│          ││                                                                                               │
│          ││ ┌ ○ To do        24 ┐ ┌ ◐ In progress  11 ┐ ┌ ⊘ Blocked       1 ┐ ┌ ✓ Done         16 ┐      │
│          ││ │ Today ─────────── │ │┌─────────────────┐│ │┌─────────────────┐│ │┌─────────────────┐│      │
│          ││ │┌─────────────────┐│ ││▣Learning  ⚑High ⋯││ ││▣Work           ⋯││ ││▣Health         ⋯││      │
│          ││ ││▣Work ⚑Critical ⋯││ ││GA4 module 5:     ││ ││Finalise the brand││ ││Book physio       ││      │
│          ││ ││Tailor CV for the ││ ││Explorations and  ││ ││audit survey      ││ ││appointment       ││      │
│          ││ ││Fonterra graduate…││ ││▤ GA4 certificat… ││ ││▤ Grey Lynn mark… ││ ││✓ Done 14 Oct     ││      │
│          ││ ││▤ Graduate job s… ││ ││◷ Today 11:00-11:45││ ││⛓ Waiting on 1   ││ │└─────────────────┘│      │
│          ││ ││━━━━━━━━░░░░ 2/4  ││ ││◔ 45m             ││ ││⚑ Due 15 Oct  45m ││ │┌─────────────────┐│      │
│          ││ ││◷ Today 09:15-10:30││ │└─────────────────┘│ │└─────────────────┘│ ││…                ││      │
│          ││ ││◔ 75m             ││ │┌─────────────────┐│ │                   │ │                   │      │
│          ││ │└─────────────────┘│ ││…                ││ │  Nothing else is   │ │ [Archive 16 done] │      │
│          ││ │ Next 7 days ───── │ │                   │ │  blocked.          │ │                   │      │
│          ││ │┌─────────────────┐│ │                   │ │                   │ │                   │      │
│          ││ ││…                ││ │                   │ │                   │ │                   │      │
│          ││ │ Show 6 more       │ │                   │ │                   │ │                   │      │
│          ││ └───────────────────┘ └───────────────────┘ └───────────────────┘ └───────────────────┘      │
│          ││                                                                                               │
│          ││              ╭──── while dragging ─────────────────────────────────────╮                      │
│          ││              │  [☀ Plan for today]            [🗄 Archive]              │  drop dock (glass)  │
│          ││              ╰─────────────────────────────────────────────────────────╯                      │
└──────────┘└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Lanes: 4 × equal `minmax(248px, 1fr)` columns, 16px gap. Each lane is a `--pc-card-2` well with radius 16 and an independently scrolling list (`max-height: calc(100dvh - header)`). Long lanes use the existing preview limits (24 active / 12 done) and "Show N more".
- Lane header: tinted icon tile (To do `Circle` neutral, In progress `CircleDashed` work-blue, Blocked `Ban` off, Done `CheckCircle2` ok), the name, and a count in tabular figures that rolls on change.
- The Done lane footer keeps "Archive N done" (existing `onArchiveCompleted`, now confirmed in a premium `Sheet` instead of `window.confirm`).
- At 1061-1280px the lanes keep `minmax(232px,1fr)` and the board scrolls horizontally inside its own container (snap to lane start). The page never scrolls horizontally.

### 4.2 1440, Board, When lens

Five lanes: Past due (`AlertTriangle`, off tone, header "5 · 3 overdue") · Today (`Sun`, accent) · Next 7 days (`CalendarRange`) · Later (`CalendarClock`) · No date (`Inbox`, neutral). Lanes are `minmax(220px,1fr)`. The Past due lane renders with a "Can't plan into the past" lock line while something is dragged.

### 4.3 1440, List (default view)

```
│ [▣] Tasks  …header, tabs, toolbar as 4.1 (no Lens toggle on List)…                                      │
│                                                                                                        │
│ [⚠] Past due  5 · 3 overdue                                                                    ⌃      │
│   ○  Update IRD tax code for the new part-time job   ▣Personal  ⚑High   [Overdue 1d]   20m    ⋮⋮  ⋯    │
│   ○  Submit expense claim for the Marketing Meetup   ▣Personal          [Planned 11 Oct] 15m   ⋮⋮  ⋯    │
│ [☀] Today  13                                                         7h 25m planned · 2 done   ⌃      │
│   ○  Deep work: competitor analysis for the Fonterra…  ▤Graduate job…  [06:00-07:00]  60m  ▶ Focus ⋯  │
│   ○  LinkedIn engagement: 15 minutes   ▣Work  [↻ Daily]  [Today]  15m                                 │
│   ✓  Book physio appointment for the knee   (done today, stays until tomorrow, muted)                 │
│ [▦] Next 7 days  14                                                                             ⌃      │
│   ○  Submit the Fonterra graduate marketing application  ▤Graduate job…  ⚑Critical  ▸ 1/4  [Due Thu 15 Oct] 45m │
│ [◷] Later  6                                                                                    ⌃      │
│ [⌂] No date  8 · 2 someday                                                                      ⌃      │
│ [✓] Done  16                                                                       Show done ⌄         │
```

- A row is 56px (64px under `pointer: coarse`). Left to right:
  - the check (spring check-off)
  - the title (one line, ellipsis; the full title is in `title` and in the accessible name)
  - meta pills, right-aligned in a fixed order: project/goal, category, priority, date pills, subtasks, dependency, estimate
  - the hover/focus actions: Focus (ghost button with `Play` icon and label) and More
  - the drag handle (Manual sort only)
- Phone swipe is reserved (§11).
- Section headers are sticky inside the list (`top: header height`), with a collapse chevron, a count, and on Today the planned-minutes sum (real: `dailyCapacityForecast` already computes `plannedMinutes`).
- A task completed today stays in its section, muted, until the next day, so a check-off doesn't make the list jump. Earlier completions live in Done.
- Drag in List: reorder within a section (Manual sort), plus dragging onto another section header. Section headers are drop targets and use the When-lens table.

### 4.4 390, Board (Status)

```
┌──────────────────────────────┐
│ Tasks                 [⌕][⋯] │
│ 36 open · 3 overdue          │
│ (Inbox 12│List│Board●│Views) │
│ [⌕ Search    ] [⊕ Filter 2]  │
│ (All)(Open)(Today)(At risk)→ │  chips scroll horizontally, snap
│ ┌──────────────────────────┐ │
│ │To do 24│Doing 11│⊘1│✓16  │ │  lane segment (sticky); each segment is
│ └──────────────────────────┘ │  also a drop target while dragging
│ Today ───────────────────    │
│ ┌──────────────────────────┐ │
│ │▣Work  ⚑Critical        ⋯ │ │
│ │Tailor CV for the Fonterra│ │
│ │graduate marketing role   │ │
│ │▤ Graduate job search spr…│ │
│ │━━━━━━━━░░░░ 2/4          │ │
│ │◷ 09:15-10:30   75m       │ │
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │…                         │ │
│                              │
│ ╭──────────────────────────╮ │  shell pill nav (D1), content padded
│ │ ⌂   ☀   (+)   ▦   ⋯      │ │  104px + safe area
│ ╰──────────────────────────╯ │
└──────────────────────────────┘
```

**Phone decision: segmented lane control, not a horizontal snap carousel.** A horizontal carousel would fight the D3.5 horizontal row swipes (right = complete, left = reschedule) and iOS edge-back. The segment shows 4 lanes with counts at 390 ("Doing" is the short label for In progress, as the current tab already uses; Blocked and Done collapse to icon + count with a full `aria-label`).

**Phone cross-lane drag.**

1. Long-press a card (250ms) to lift it.
2. Drag it up onto the lane segment. Each segment highlights as a drop target.
3. Hover a segment for 400ms to spring-load it: the list switches to that lane, so the card can be placed at a position.
4. Or release on the segment to drop at the lane top (Manual) or at the sort position.

The drop dock sits above the pill nav during the drag.

### 4.5 390, List

Same sections as 4.3, single column. A row is two lines: the title (2-line clamp), then pills (date first, estimate, project). The Focus action lives in More on phone. The swipe underlay is reserved (§11).

### 4.6 Inbox triage, 1440 and 390

```
1440
│ [▣] Tasks … (Inbox● 12 │ List │ Board │ Views)                                                         │
│ ┌──────────────── decide one at a time ─────────────────┐  ┌ Up next in Inbox ───────────────┐          │
│ │ (◔ ring 3 of 15 decided)                           ⋯  │  │ Ask Sam for a referral at Spark │          │
│ │                                                         │  │ Find Auckland marketing meetups │          │
│ │  Look into the Google Ads search certification          │  │ Tidy Google Drive folders       │          │
│ │  ▣Learning  ⚑Low   Captured 9 Oct                        │  │ Replace running shoes           │          │
│ │                                                         │  │ Idea: short video series…       │          │
│ │  [☀ Today T] [→ Tomorrow M] [▦ Pick date D] [☾ Someday S] │  │ … 7 more                        │          │
│ │  [▤ Add to project P] [✓ Done X] [🗄 Archive A]  [Open ↵] │  └─────────────────────────────────┘          │
│ └─────────────────────────────────────────────────────────┘                                               │
│  J / K to skip. Every choice can be undone for 6 seconds.                                                 │

390: the same decision card full width; the queue becomes "11 more" under it. The action chips wrap 2 per row
(48px), and the ring sits in the card header.
```

| Triage action | Write (existing) |
|---|---|
| Today | `update({scheduledLocalDate: today})` |
| Tomorrow | `update({scheduledLocalDate: today+1})` |
| Pick date | date popover → `update({scheduledLocalDate})` |
| Someday | `update({horizon:"someday"})`. Owner question 2: whether this also leaves Inbox |
| Add to project | project picker (ChipSelect) → `update({projectId})`. The task stays in Inbox if still undated, and the card shows the project, so it is clarified but not planned |
| Done | the existing toggle (R1-R3 guards apply) |
| Archive | `update({state:"archived"})`, with Undo |
| Open | the detail sheet |
| Focus | only from More (Inbox is for deciding) |

- **Ring.** The ring counts decisions made in this session ÷ (decisions + remaining Inbox count), so it is real and resets on reload. It never shows a target that doesn't exist.
- **Empty Inbox.** EmptyState `Inbox` "Inbox is clear" + "Capture a thought". When the session made decisions, the ring completes with the celebrate pop first.
- **Search active.** Triage collapses to the plain list of matches, because a one-at-a-time stack makes no sense for search results.

### 4.7 Task detail sheet

Desktop: a right-docked panel, 480px wide, full height (owner question 3, needs a `side` variant on the shared `Sheet`; fallback is the existing centred `is-dialog`, 560px). Phone: the shared bottom sheet with grabber, drag-to-dismiss, labelled Close.

```
┌ Task ─────────────────────────────── [✕ Close] ┐
│ (◐ In progress ▾)  ▣Work  ▤Graduate job search  │   state pill is a ChipSelect
│ Tailor CV for the Fonterra graduate marketing   │   title: inline-edit field, h2 size
│ role                                             │
│ [▶ Start focus]  [✓ Complete]                    │   Complete obeys R1-R3 (disabled + reason)
│ ┄ Why it matters slot (D4; renders nothing) ┄    │
│ ⚠ 1 field conflict kept for review  [Review]     │   only when real
│ [▦] Plan                                         │
│    Deadline [15 Oct ▾]  Plan for [Today ▾]       │
│    Focus time needed [75m]                       │
│ [◷] Reserved time   Today 09:15-10:30  [Edit]    │
│ [☑] Subtasks 2/4   ━━━━━━░░░░                     │
│    ✓ Research the Fonterra brand portfolio       │
│    ○ Write the Fonterra cover letter draft       │
│    [+ Add subtask…]                              │
│ [⛓] Dependencies  Waiting on 1 · Blocks 0        │
│ [↻] Repeat  (None│Daily│Weekly│Monthly)  Every[1]│
│    Next: Fri 16 Oct, Fri 17 Oct, Sat 18 Oct      │   computed, real
│ [⌖] Links  Goal ▾  Project ▾  Category ▾         │
│ [⚙] Properties  Priority (None…Critical)  Horizon ▾  Mode ▾ │
│ ▸ Record facts                                   │   collapsed disclosure
├──────────────────────────────────────────────────┤
│ Unsaved changes      [Discard]  [Save changes]   │   sticky footer, only when draft.changed
└──────────────────────────────────────────────────┘
```

- **Keep all existing draft, scope-key, conflict, offline and focus-return behaviour** (`TaskDetailSheet.tsx` editor state, `returnFocusRef`, AlertDialog confirmations). D3 changes the presentation only: native selects become `ChipSelect`, sections become `SectionCard`, and the shell moves from `PlannerSheet` to premium `Sheet`.
- The header description that today reads "in progress · Plan for 2026-09-24" goes away. The state pill and date pills replace it, and they use the occurrence fix (§7).

---

## 5. Components and reuse

| Component (file) | Purpose | Reuses | Owner |
|---|---|---|---|
| `TaskHeader` (`features/tasks/TaskHeader.tsx`) | Title, real summary line, Select, Capture, overflow (Archived tasks), view tabs | `PageHeader`, `SegmentedTabs` (manual activation), `ReviewChip` for "N to review" when conflicts > 0 | Fable |
| `TaskToolbar` (`features/tasks/TaskToolbar.tsx`) | Search (`/` focuses), quick filter chips with counts, Filter popover (category, project, priority), sort menu, Lens toggle (Board), Save view | `FilterChips` (new shared), `ChipSelect` (new shared), `SegmentedTabs` (lens) | Fable |
| `FilterChips` (`components/premium/FilterChips.tsx`) | Toggle chips with live counts, horizontally scrollable with snap on phone; `aria-pressed` | `Pill` styles, `.pc-num` | Fable (shared, the map listed it for D2.5; build here if absent) |
| `ChipSelect` (`components/premium/ChipSelect.tsx`) | Premium replacement for native selects: Radix Popover + listbox, type-ahead, tone dots | `@radix-ui/react-popover` (installed) | Fable (shared) |
| `TaskCard` (`features/tasks/TaskCard.tsx`) | Board card | `CategoryChip`, `Pill`, `TimeChip`, `TaskMetaPills` | Fable |
| `TaskRow` (`features/tasks/TaskRow.tsx`) | List row (Tasks surface only; `CanonicalTaskRow` stays for Today/Calendar until D3.5) | `TaskMetaPills`, `CheckButton` | Fable |
| `TaskMetaPills` (`features/tasks/TaskMetaPills.tsx`) | Date, recurring, priority, subtasks, dependency, estimate, pending, conflict pills in a fixed order | `Pill`, `StatusPill` tones, `TimeChip` | Fable |
| `CheckButton` (`features/tasks/CheckButton.tsx`) | Spring check-off + burst, guarded state with reason tooltip | `useBecameTrue`, `pc-check-draw`, `pc-spring-pop`, `pc-burst-ring` keyframes (tokens-v2) | Fable |
| `TaskBoard`, `TaskLane` (`features/tasks/TaskBoard.tsx`) | Lane grid, lane header with rolling count, drop highlight, lock reason, empty wells, DragOverlay visuals | `useTaskDnd` state, `pc-digit`/`pc-tick` roll, `EmptyState` (compact) | Fable (visuals) |
| `DropDock` (`features/tasks/DropDock.tsx`) | Plan for today / Archive targets during drag | glass surface (`backdrop-filter`, solid fallback under `prefers-reduced-transparency`) | Fable |
| `DateDropPopover` (`features/tasks/DateDropPopover.tsx`) | Day strip / date picker for When-lens drops and triage "Pick date" | Radix Popover, `ChoiceTiles` keyboard pattern for the day strip | Fable |
| `TaskListSections` (`features/tasks/TaskListSections.tsx`) | When-grouped sticky sections, collapse, Done disclosure | `PageHeader level=3` styles, `EmptyState` | Fable |
| `InboxTriage` (rewrite, same file) | Decision card + queue + ring | `FocusDial` ring at `--pc-dial-sm`/`xs` for progress, `ChoiceTiles`-style action chips with key hints | Fable |
| `TaskDetailSheet` (restyle, same file) | §4.7 | `Sheet` (+ `side` variant request), `SectionCard`, `ChipSelect`, `SegmentedTabs` (repeat, priority), `StatusPill` tones | Fable |
| `SavedViewsPanel` (`features/tasks/SavedViewsPanel.tsx`) | View tiles: name, filter summary pills, live count, pin, rename, delete | `EmptyState`, `Pill`, `ChipSelect` | Fable |
| `BulkActionBar` (`features/tasks/BulkActionBar.tsx`) | Select-mode floating bar | glass surface, `pc-rise` | Fable |
| `TaskSkeleton` (`features/tasks/TaskSkeleton.tsx`) | Loading shapes for row, card and lane | none | Fable |
| `tasks-premium.css` (`features/tasks/`) | All new styles, `pc-` tokens only. `task-workspace.css` rules are deleted as each piece lands (legacy-green baseline lowered) | tokens-v2 | Fable |
| `taskCardModel.ts` (`features/tasks/`) | Pure view model for card/row (contract §5.1) | `canonicalTaskPresentation`, `dependencyExecutionState`, `deadlineRiskForTask`, `resolveCategoryTones` | opus |
| `useTaskDnd.ts` (`features/tasks/`) | dnd-kit sensors, collision, keyboard coordinate getter, announcements, optimistic placement and rollback | `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (new deps, approved) | opus |
| `taskWorkspaceModel.ts` (`features/tasks/`) | Filters (+category/project/priority), counts, sort, saved-view v2 adapt (moved out of `TaskWorkspace.tsx`) | existing functions | opus |
| `shared/taskBuckets.ts`, `shared/taskDrop.ts`, `shared/taskRecurrence.ts` | §3.2, §3.3, §7 | `server/plannerRules.ts` recurrence maths (moved to shared; server re-imports) | opus |

### 5.1 Card/row contract (agree first so both builders can start)

```ts
// features/tasks/taskCardModel.ts (opus writes; Fable imports the type)
export type TaskDatePill =
  | { kind: "overdue"; label: string; tone: "off" }               // "Overdue 2d"
  | { kind: "slipped"; label: string; tone: "risk" }              // "Planned 12 Oct"
  | { kind: "reserved"; label: string; tone: "accent" }           // "Today 09:15-10:30" | "Fri 16 · 09:15"
  | { kind: "occurrence"; label: string; tone: "accent" | "neutral" } // "Today" | "Next Fri 16 Oct" | "Done today"
  | { kind: "plan"; label: string; tone: "accent" | "neutral" }   // "Today" | "Tomorrow" | "Fri 16 Oct"
  | { kind: "due"; label: string; tone: "risk" | "neutral" };     // "Due today" | "Due Fri, not planned" | "Due 20 Oct"
export type TaskCardModel = {
  id: string; version: number; title: string; state: string; isComplete: boolean;
  tone: ToneOrNeutral; categoryName: string | null;
  context: { kind: "project" | "goal"; title: string } | null;
  priority: "high" | "critical" | null;            // low/medium/none render nothing
  dates: TaskDatePill[];                            // max 2: plan-or-reserved-or-occurrence, then deadline
  estimateMinutes: number | null;
  subtasks: { done: number; total: number } | null;
  waitingOn: number; blocks: number;                // hard deps only
  recurring: { cadence: string } | null;            // "Daily" | "Weekly" | "Every 2 weeks" | "Monthly"
  someday: boolean;
  pending: boolean; conflictCount: number;
  completionBlock: { reason: string; action?: "open_plan" | "open_detail" } | null; // R1-R3 pre-check
  why: null;                                        // D4 fills; D3 renders nothing
};
```

Date copy uses `en-NZ` short forms to match the Dashboard ("16 Oct", "Fri 16 Oct"). Time ranges use a hyphen.

---

## 6. States

| State | Where | Design |
|---|---|---|
| Loading | first paint before the snapshot | `TaskSkeleton`: 6 row shapes (List), 4 lanes × 3 card shapes (Board), header text kept. Shimmer is a single 1.2s sweep, then static. No spinner |
| First run (no tasks ever) | List/Board | EmptyState `ListChecks`, "Your tasks start with one captured thought", body from `plannerObjectDefinitions.task.description`, primary "Capture a task". Below it, three small definition pills: Deadline · Plan for · Reserved time (text from `taskSchedulingLanguage`) |
| Filtered empty | any view | EmptyState `SearchX`, "No task matches "{query}" in Today", action "Clear filters" (keeps sort) |
| Lane empty (idle) | Board | Quiet line in the well: To do "Nothing waiting.", In progress "Drag a task here when you start it.", Blocked "Nothing is blocked.", Done "Finished work shows here." |
| Lane empty (dragging) | Board | Dashed 1.5px well with a "Drop to mark in progress" label; locked lanes show the reason instead |
| Drop refused | Board/List/dock | The lane keeps its colour, a `Lock` icon + reason line rises in, and the overlay card loses its tilt. On release: return glide + polite announcement. No toast |
| Saving | card | Optimistic: the card sits in the new lane immediately with a 2px progress shimmer on its top edge until the write resolves. Counts roll on drop, not on server reply |
| Offline | header + card | Header chip `CloudOff` "Offline · changes save on this device". Drops go through `persistTaskPatch` (queued) and the card shows `CloudUpload` "Saved on this device". Dependency add, Select-mode bulk Done/Archive (they fall back to sequential per-record writes, with progress "3 of 7 saved on this device") and saved-view writes stay available only if the existing paths queue them; otherwise disabled with "Needs a connection" |
| Error (write) | card | `PlannerPolicyError`/R1-R3 text from the server is shown verbatim inline under the card for 6s + polite announcement; the card glides back to its origin |
| Conflict (R4) | card | The card glides back, refetch, and a `pc-pop` "Changed elsewhere" pill on the card opens the detail sheet, where the existing conflict review lives. Persistent `conflictCountByTask` > 0 shows the "N conflict" pill until resolved |
| Error (snapshot) | page | Inline panel, `CloudAlert` icon tile, "Tasks couldn't load", "Try again" (refetch). If an offline snapshot exists, render it read-only with "Showing saved copy from 10:42" |

---

## 7. Recurring occurrence fix (the bug)

**Rule.** A recurring task never shows its anchor `scheduledLocalDate` as "Plan for". Its date pill is the occurrence:

1. A pending occurrence today in `snapshot.taskOccurrences` → "Today" (accent).
2. Today's occurrence is already completed/skipped → "Done today" / "Skipped today" (neutral), plus the next date in the accessible name.
3. Otherwise the next occurrence date ≥ today. It comes from a materialized pending occurrence if present, else from `nextRecurringLocalDate(rule, anchor, today, until)` computed with the same maths the server uses. Label: "Next Fri 16 Oct".
4. `recurrenceUntilLocalDate < today` → "Series ended 30 Oct".
5. `recurrenceAnchor = "completion"` → the next date comes only from materialized occurrences. If none exist yet, show "Repeats after completion".

The cadence pill (`Repeat` icon + "Daily"/"Weekly"/"Every 2 weeks"/"Monthly") always appears next to it.

**Implementation (opus).**

- Move `isRecurringLocalDate` and `recurringLocalDates` from `server/plannerRules.ts` to `shared/taskRecurrence.ts`. The server re-exports them, so there is no behaviour change.
- Add `nextRecurringLocalDate`.
- Extend `CanonicalTaskContext` with an optional `occurrences` list and teach `keyTimeForTask` the rule above, so Today, Calendar and Search are fixed too.
- The detail sheet header uses the same label.
- Remaining raw "Plan for {date}" strings in `ProjectDetail.tsx` and `ProjectExecutionWorkspace.tsx` are logged for D4 (their surfaces are redesigned there).

**Check-off on a recurring row** resolves today's pending occurrence (`occurrence.resolve(..., "completed")`) instead of `update({state:"completed"})`, which R1 rejects today. With no occurrence today, the check is disabled and its tooltip and accessible name read "Next one is Fri 16 Oct".

---

## 8. Motion

All values come from `tokens-v2.css` / `motion.ts`. Entrance animation plays on the first mount per route per session only (D2 rule), never on refetch.

| Trigger | Animation | Duration / easing | Reduced motion |
|---|---|---|---|
| View tab change | Indicator glide (SegmentedTabs `GLIDE`); outgoing view fades out, incoming `pc-rise` | 240ms `--pc-ease`; exit 160ms | Instant swap |
| First mount of List/Board | `pc-rise` per row/card, stagger `--pc-stagger` capped at 8 per section/lane | 240ms + 40ms × i | None |
| Card hover (`@media (hover:hover)`) | translateY(-2px), shadow e1 → e2 | 140ms `--pc-ease` | Shadow only |
| Press (check, chips, buttons) | scale .97 | 80ms in / 140ms out | Off |
| Drag lift (pointer) | DragOverlay clone: scale 1.03, rotate -1.5deg, shadow e3, cursor grabbing; source slot becomes a ghost (opacity .35, 1.5px dashed `--pc-line`) | 140ms `--pc-ease` | No scale/rotate; shadow and ghost instant |
| Long-press arming (touch) | Card eases to scale .98 during the 250ms hold, then pops to the 1.03 lift; `-webkit-touch-callout:none`, `user-select:none` on cards | 250ms linear hold, 140ms pop | Outline appears at activation, no scale |
| Siblings make room | Sortable transform shift | 200ms `--pc-ease` (dnd-kit `transition`) | 0ms |
| Lane over (valid) | Well tints to `--pc-k-soft` of the lane tone, border 1.5px solid lane colour, header count shows a ghost "+1" | 140ms `--pc-ease` | Colour change only (allowed) |
| Lane over (refused) | `Lock` + reason line rises 6px; overlay card tilt → 0, saturation .6 | 140ms | Text appears instantly |
| Drop (valid) | Overlay glides to its slot, then settles scale 1.03 → 1 with a critically-damped spring (framer `{type:"spring", duration:.28, bounce:.12}`) | 240ms glide + 280ms settle | Instant placement |
| Drop refused / cancel / failed write | Overlay glides back to origin. A failed server write adds one 4px horizontal nudge ×2 on the returned card | 240ms `--pc-ease`; nudge 240ms | Instant return, message only |
| Lane/section count change | Digit roll: old digit exits up, new enters from below (`pc-tick`, `.pc-digit` cells, keyed by `useChangeCount`) | 240ms `--pc-ease` | Instant |
| Complete (false → true only) | Check stroke draw, spring pop, burst ring + dots; title strike colour fades | `--pc-dur-draw` 280ms, `--pc-dur-celebrate` 520ms (celebration token) | Instant checked state, no burst |
| Subtask progress change | Bar `scaleX` to the new value | `--pc-dur-data` 600ms `--pc-ease-data` | Instant |
| Filter / search change | Leaving rows fade 160ms; remaining rows FLIP via framer `layout` (only when ≤ 40 visible items, else plain swap) | 240ms `--pc-ease` | Instant |
| Lens switch Status ↔ When | Shared `layoutId` per card moves cards to their new lanes (≤ 40 visible, else crossfade) | 300ms `--pc-ease` | Instant |
| Drop dock / Bulk bar appear | Rise 12px + fade; hide fade 160ms | 240ms `--pc-ease` | Instant |
| Date popover after a When drop | Scale .96 → 1 from the drop point (`transform-origin` = pointer) | 200ms `--pc-ease` | Instant |
| Triage decision | Current card exits toward its outcome (Today/Tomorrow/Pick date: up 16px; Someday: right 16px; Archive: down 12px) with fade; next card rises from the stack (scale .96 → 1); ring advances | exit 160ms, enter 240ms, ring 600ms data | Crossfade 0ms, ring instant |
| Detail sheet | Shared `Sheet`: side x 100% → 0 (`SHEET` 300ms iOS curve), dialog scale .96 → 1 (240ms), phone y 100% → 0 (300ms), drag-to-dismiss with 0.11 px/ms momentum | per `motion.ts` | `MotionConfig reducedMotion="user"` |
| Pending / conflict pill | Fade in; conflict `pc-pop` once | 140ms / 320ms | Instant |
| Saving shimmer | 2px top-edge sweep while the write is in flight (state-driven, stops on resolve) | 900ms linear, repeats only while saving | Static 2px accent line |

Performance: only `transform`, `opacity`, `filter` and `box-shadow` animate. `will-change: transform` sits on the DragOverlay only during drag. Each sortable item sets `transform` via `CSS.Translate.toString` (no scale on siblings).

---

## 9. Select mode and bulk (replaces the triage stub)

"Select" in the header toggles checkboxes on rows/cards (44px targets; Shift+click selects a range in List). A floating `BulkActionBar` shows "{n} selected" with four actions:

- **Start** (In progress): `bulkSetState("in_progress")`
- **Done**: `bulkSetState("completed")`. It is pre-checked with `planTaskDrop` per task: tasks hit by R1-R3 are listed and excluded, as in "2 can't be completed here: Repeats daily; Committed in today's plan".
- **Plan for today**: sequential `update` (no bulk patch exists)
- **Archive**: `bulkSetState("archived")`, pre-checked R1/R3

Plus "Clear". Offline, each action uses sequential `persistTaskPatch` with a progress count. Escape exits Select mode.

## 10. Filters, search, saved views

- **Quick chips.** All · Open · Today · At risk (existing `TaskBoardFilter`, relabel "Deadline risk" → "At risk", keep URL values). Each chip shows its live count.
- **Filter popover.** Category (tone dot + name), Project, Priority (multi-select). Active filters appear as removable chips after the quick chips ("▣ Work ✕"), each with a "Remove Work filter" name.
- **Search.** `/` focuses it. It matches title and description, case-insensitive. Escape clears, and a second Escape blurs.
- **Sort.** A `ChipSelect` with Manual · Priority · Deadline · Plan for · Newest. A non-Manual sort hides the drag handles and shows the reorder guidance only when someone tries to reorder (no permanent banner).
- **Saved view configuration v2** (no schema change; `configuration` is jsonb):

  ```json
  { "version": 2, "view": "list|board", "lens": "status|when", "query": "", "filter": "all|open|today|deadline_risk", "sort": "manual|priority|due|scheduled|created", "categoryIds": [], "projectIds": [], "priorities": [] }
  ```

  `adaptSavedTaskView` reads v1 configs unchanged (missing keys fall back to defaults; `"risk"` → `deadline_risk` stays).
- **Save view.** It appears when the current state differs from the applied saved view. A small `Sheet` asks for a name, with a pin toggle. Reusing a name updates that view (same rule as the stub).
- **Views tab.** A 2-column grid (1 on phone). Pinned tiles come first. Each tile shows the name, summary pills ("Board · When · Work · High"), a live count and a More menu (Pin/Unpin, Rename, Delete with confirm). Empty: EmptyState `Bookmark` "No saved views yet" + "Save the current view" (disabled with reason when nothing is filtered).

## 11. Phone swipe (reserved for D3.5, not designed here)

`TaskRow` renders an `aria-hidden` underlay container (`.task-row-swipe`, empty) and exposes `data-swipe="complete|reschedule"` hooks. The legacy `resolveMobileTaskGesture` pointer handlers are **removed** from the Tasks surface in D3, because they would fight long-press drag and the D3.5 gesture system replaces them. Complete and Archive stay reachable through the check and the More menu.

---

## 12. Accessibility

- **Drag handle.** Every card/row has a visible `GripVertical` handle button ("Move {title}"), 44px hit area. It is visible on hover and focus, and always visible under `pointer: coarse`. Mouse drag also starts from the card body (PointerSensor, 6px distance; buttons inside the card cancel activation). Touch uses the TouchSensor (250ms delay, 8px tolerance). Keyboard drag uses the handle only.
- **Keyboard drag** (dnd-kit KeyboardSensor with a custom coordinate getter):
  - Space/Enter picks up and drops.
  - ↑/↓ moves within the lane.
  - ←/→ moves to the adjacent lane (top of the lane in Manual; the sort position otherwise).
  - Escape cancels.
  - When-lens drops onto Next 7 days/Later open the date popover with focus on the first chip. Arrow keys move, Enter confirms, Escape cancels the whole move.
  - Per Emil's rule, keyboard moves do not play the lift/tilt. Only the focus ring and the sibling shift (0ms) show.
- **Screen-reader instructions** (`accessibility.screenReaderInstructions`): "To move a task, press Space. Use the arrow keys to move it, Left and Right to change lane. Press Space to drop or Escape to cancel."
- **Announcements** (`accessibility.announcements`, polite live region; lane names and positions are 1-based and human):
  - start: "Picked up {title}. In {lane}, position {i} of {n}."
  - over (valid): "{title} is over {lane}, position {i} of {n}."
  - over (refused): "{lane} is not available. {reason}"
  - end: "{title} moved to {lane}, position {i}." Then, after the write: "Saved." / "Saved on this device." / "Could not move. {reason} {title} is back in {origin lane}."
  - cancel: "Move cancelled. {title} is back in {lane}."
- **Single-pointer alternative** (WCAG 2.5.7). The card/row More menu holds "Move to ▸ To do / In progress / Blocked / Done" (status) or "Plan for ▸ Today / Tomorrow / Pick date / No date" (When), plus "Move up" / "Move down" (Manual). It uses the same `planTaskDrop`, so refusals read the same.
- **Structure.** Each lane is a `section` with `aria-labelledby` the lane heading, which includes the count ("In progress, 11 tasks"). Lists use `role="list"`. Section collapse buttons have `aria-expanded`. The view tabs are Radix tabs (manual activation). Filter chips use `aria-pressed`.
- **Focus.**
  - After a drop, focus stays on the moved card's handle.
  - After a refused drop, focus returns to the handle in the origin lane.
  - The detail sheet returns focus to its trigger (existing `returnFocusRef`).
  - Triage moves focus to the next card's first action after each decision.
- **Colour.** It is never alone: every pill has a word, and lanes have names and icons. The category palette and status tones are already contrast-tested (D0). New pill pairs (`--pc-k-ink` on `--pc-k-soft`, `--pc-off` on `--pc-off-soft`) are added to `design.test.ts` coverage.
- **Reduced motion.** See the §8 column. `prefers-reduced-transparency` swaps the dock/bulk-bar glass for solid `--pc-card`.

---

## 13. Needs data (not designed in; flagged)

1. **Bulk reorder** (`task.reorder({orderedIds, expectedVersions})`): removes the sequential renumber writes when a lane has no integer gap. Without it, lanes over 24 tasks fall back to Move up/down. Optional.
2. **Bulk patch** (e.g. plan N tasks for today in one call): Select-mode "Plan for today" loops `update` meanwhile. Optional.
3. **Lifetime tracked focus minutes per task**: snapshot `focusSessions` are range-bounded (±31 days), so a planned/actual `TimeChip` would understate. D3 shows the estimate only. Revisit in D5.
4. **"Why it matters"**: the slot exists and renders nothing in D3. D4 fills it from existing goal/project links.
5. **Hard delete** for tasks: no mutation exists. Triage uses Archive (the inner-surface map said "Delete").
6. **Comments, assignees, attachments** (the Fernly card footer): not in the schema. Not designed.

---

## 14. Build split (parallel; editors own separate files)

Order inside the slice, one checkpoint each (HANDOFF + RUN_STATE + push after each):

- **D3a.** Contract + recurring fix + List + row + header/toolbar + detail restyle.
- **D3b.** Board + dnd + dock + When lens.
- **D3c.** Inbox triage + Views + Select mode + remove the stub.

| Fable UI (loads impeccable, design-taste-frontend, emilkowal-animations) | opus logic |
|---|---|
| `components/premium/FilterChips.tsx`, `ChipSelect.tsx` (+ styles in `premium.css` section "D3") | `shared/taskRecurrence.ts` (move from `server/plannerRules.ts`; server re-imports) + tests |
| `features/tasks/TaskHeader.tsx`, `TaskToolbar.tsx` | `shared/canonicalTask.ts` recurring key time (bug) + tests |
| `features/tasks/TaskCard.tsx`, `TaskRow.tsx`, `TaskMetaPills.tsx`, `CheckButton.tsx` | `shared/taskBuckets.ts` + tests |
| `features/tasks/TaskBoard.tsx` (lanes, overlay visuals), `DropDock.tsx`, `DateDropPopover.tsx` | `shared/taskDrop.ts` (`planTaskDrop`, R1-R3 pre-checks) + tests |
| `features/tasks/TaskListSections.tsx`, `TaskSkeleton.tsx` | `shared/taskBoard.ts` (4 lanes, `blocked`), `shared/taskOrdering.ts` (`sortOrderBetween`, rebalance plan) + tests |
| `features/tasks/InboxTriage.tsx` (rewrite) | `features/tasks/taskCardModel.ts` (§5.1) + tests |
| `features/tasks/TaskDetailSheet.tsx` (presentation only; editor logic untouched) + `task-detail-inspector.css` → `tasks-premium.css` | `features/tasks/taskWorkspaceModel.ts` (filters, counts, saved view v2) + tests |
| `features/tasks/SavedViewsPanel.tsx`, `BulkActionBar.tsx` | `features/tasks/useTaskDnd.ts` (sensors, coordinate getter, announcements, optimistic + rollback) + tests |
| `features/tasks/tasks-premium.css`; delete superseded rules in `task-workspace.css`; lower the legacy-green baseline | `features/tasks/TaskWorkspace.tsx` container wiring; `package.json` add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` |
| Gallery entries in the premium gallery route (card, row, pills, lanes, dock: light/dark) | `pages/Home.tsx` (mount only, per DECISIONS "no new code in Home"): pass `taskOccurrences`, committed task ids, occurrence resolve, bulk + saved-view handlers; delete the `OwnedToolsDisclosure "Task triage tools"` + `TaskTriagePanel` |
| Request to the Sheet owner (D2.5 Fable agent): `Sheet variant="side"` (right, 480px, x-slide `SHEET`). Until it lands, the detail sheet uses `variant="auto"` | `scripts/preview-premium-tasks.py` harness (below) |

Integration: the primary agent mounts the Fable components into opus's container once both sides pass their own tests. Fable components take only `TaskCardModel` and callbacks, never raw snapshot data.

---

## 15. Test plan

**Unit (vitest)**

- `taskRecurrence`:
  - daily/weekly-with-weekdays/monthly/interval cases
  - `until` in the past
  - completion anchor
  - parity test: the shared functions return the same dates as the old server copies over a 400-day window
- `canonicalTask` regression: a daily series anchored 2026-09-24 shows "Today" on 2026-10-14 (pending occurrence), "Done today" after resolve, and "Next Thu 15 Oct" for a weekly Thursday series. It never shows "Plan for 24 Sep".
- `taskBuckets`:
  - each rule
  - deadline vs slipped plan in Past due
  - reserved today beats a later plan date
  - Someday lands in No date
  - the Past due deadline count equals the D1 overdue badge logic
- `taskDrop`: the full matrix in §3.3 (each lane × recurring/prereq/committed/reserved/deadline/sort), including "same lane, non-Manual sort → no sortOrder write".
- `taskOrdering`:
  - `sortOrderBetween` gaps
  - no-gap rebalance plan (moved card written last)
  - > 24 refusal
- `taskWorkspaceModel`: filter counts, category/project/priority filters, saved view v1 → v2 adapt.

**Component (Testing Library + jsdom)**

- TaskCard/TaskRow render the right pills in order, priority only for high/critical, and the `why` slot renders nothing.
- Keyboard drag on a 4-lane board: Space, →, Space calls `onUpdate(task, {state:"in_progress"})` once. Escape writes nothing. A refused lane writes nothing and announces the reason. The announcement strings match §12.
- The More menu "Move to" produces the same patch as the drag.
- A recurring row check calls occurrence resolve, not task update.
- Inbox triage: Today/Someday/Archive patches, ring maths, focus moves to the next card.
- The detail sheet keeps draft/discard/conflict behaviour (the existing `TaskDetailSheet.test.ts` must still pass).

**Browser harness** (`scripts/preview-premium-tasks.py`, demo fixtures, all APIs intercepted)

- Shots: List, Board-Status, Board-When, Inbox, Views, Detail × 1440/390 × light/dark, plus reduced motion. Check for no horizontal page overflow, no console errors, and that no green computed colours remain on Tasks.
- Mouse drag To do → In progress records exactly one `planner.task.update` with `{state:"in_progress"}`. A Manual reorder records `{sortOrder}`.
- Touch long-press drag at 390 (CDP touch emulation) onto the "Doing" segment records the same mutation. A quick swipe (<250ms) scrolls and does not drag.
- Drop a recurring card on Done records `planner.occurrence.resolve`. Drop a prerequisite-blocked card on Done records no mutation, and the lock text is visible.
- When lens: drop on Next 7 days, choose Fri, records `{scheduledLocalDate}`. Escape records nothing.
- Offline (`context.set_offline(true)`): a drop shows "Saved on this device" and no network call.
- A conflict (intercepted CONFLICT error) returns the card to its origin and shows the "Changed elsewhere" pill.
- The "Task triage tools" text no longer exists on the page.
- axe-core scan on every view (0 serious/critical).

**Gates**: `npm run check`, `npm test`, `npm run build`. The legacy-green ratchet baseline for `task-workspace.css` goes down. The existing plan and shell harnesses stay green.

---

## 16. Owner questions

1. **Board default lens.** Status: To do · In progress · Blocked · Done (**recommended**). Or When: Past due · Today · Next 7 days · Later · No date. Either way the other is one toggle away, and List is always grouped by When.
2. **Inbox "Someday".** Should Someday also take a task out of Inbox and out of the Inbox badge (**recommended**: Inbox then means "undecided", and Someday tasks live under No date with a Someday pill)? Or should Someday only set `horizon=someday` and leave the task in Inbox?
3. **Desktop task detail.** A right-side panel that keeps the board visible (**recommended**; it needs a `side` variant on the shared Sheet), or the centred dialog the Sheet already has?
