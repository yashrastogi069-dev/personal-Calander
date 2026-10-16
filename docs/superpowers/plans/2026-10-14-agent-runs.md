# Agent runs, 2026-10-14 (resume ledger)

Written right before the owner's usage limit ran out. Background agents do not survive a session end. Their edits stay on disk, uncommitted, in this worktree. To resume each run:

1. Run `git status --short` and `git diff --stat` and match the changed files to the "Owns" lists below.
2. Run that run's verify command. If it passes, review the diff. If the work is unfinished, start a new agent of the **same model** with the brief summary below, plus "continue from the current files on disk; don't redo finished parts".
3. Never let two runs edit the same files at once.

Routing (owner, 2026-10-14):
- **Fable 5.1:** UI/UX design and visual build. Load `impeccable:impeccable`, `design-taste-frontend` and `emilkowal-animations` first.
- **Opus:** logic, integration, review, and **all** UI/UX and screenshot reviews.
- **Haiku:** mechanical work.
- **Sonnet:** nothing important.
- **Exception:** the owner said **not Fable** for the motion retune.

## Finished and verified (committed locally, NOT pushed unless HANDOFF says so)

| Run | Model | Result | Commit |
|---|---|---|---|
| Install fix | primary | Own `node_modules`; adds `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` and `@use-gesture/react` | `cc6ef95` |
| D3a logic | opus (`claude-opus-5-5`) | Review #4: deadline-only recurring tasks bucket by next occurrence. Shared `isOverdueTask` / `isInboxTask` drive the rail badges, the Tasks header and the Dashboard count. Someday leaves the Inbox. Today rows get occurrence labels (`TodayFlexibleWork`, `TodayTimeline`). Full suite 132 files, 1049 passed / 3 skipped | `82a3b10` |
| D3a UI pieces | fable (`claude-fable-5-1`) | TaskRow, TaskMetaPills, CheckButton, TaskListSections, TaskSkeleton, TaskHeader, TaskToolbar, FilterChips (+ RollingCount), ChipSelect, detail sheet restyle on `Sheet variant="side"`, gallery `PremiumGalleryTasks.tsx`. 19 files, 192 tests; tsc clean. **Not checked in a browser yet** | `82a3b10` |
| Fable motion attempt | fable | **Stopped on the owner's order** ("do not use FABLE for this"). Partial edits reverted | none |

## 2026-10-15 resume session (one agent at a time, owner laptop rule)
- New owner routing (2026-10-15): Fable 5.1 plans and designs; Opus builds visuals and logic; Sonnet only low-level work.
- R2 DONE (opus, 2026-10-15): count-ups 1300ms easeOutCubic in sync with rings (`dataStartMs(card)`), hero drift 10s cycle (12s tint), taps 120–220ms, entrances 380–500ms, digit roll 360ms; motion tests updated to the new budgets. Scoped tests 186/186, tsc clean. Uncommitted until R1 verifies.
- R1 relaunched (opus) to finish integration, harness and demo tour.
- R5 found complete (528 lines). Its three owner questions use the recommended answers as working assumptions until the owner says otherwise.
- R3 and R4 never started (no files on disk).

## Running when the limit hit (uncommitted edits may be on disk)

### R1. D3a integration + Tasks harness (opus)
- **Owns:**
  - `client/src/features/tasks/TaskWorkspace.tsx`
  - `client/src/pages/Home.tsx` (plumbing only)
  - `client/src/features/tasks/task-workspace.css`
  - the legacy-green ratchet baseline
  - new `scripts/preview-premium-tasks.py`
  - It also touched `TaskHeader.tsx` and `TaskToolbar.tsx`.
- **Brief:** mount TaskHeader, TaskToolbar and TaskListSections in the List view, fed by `taskWorkspaceModel` + `taskCardModel`. Replace the old local `inboxTasks` with the shared one.
  - Loading shows TaskSkeleton; empty states follow spec §6.
  - A recurring row's check calls occurrence resolve; a blocked check shows `completionBlock` and writes nothing.
  - Rows open TaskDetailSheet (side) with `cardModel` + `onComplete`.
  - Keep the legacy Board and Inbox working until D3b and D3c.
  - Home passes `snapshot.taskOccurrences` into TaskWorkspace → rows + `<InboxTriage occurrences>`.
  - Harness: Tasks List + Detail at 1440/390, light and dark, plus reduced motion. Check overflow, console errors, unexpected network, no "Plan for" on recurring rows, one `planner.task.update` per check, `planner.occurrence.resolve` for a recurring check, and that the side sheet opens. Output a JSON report; exit non-zero on failure.
- **Verify:** `npx tsc --noEmit`, full `npx vitest run`, `npm run build`, `python scripts/preview-premium-tasks.py --shots <tmp>` against :3100, and `python scripts/open-demo-preview.py --headless --matrix --shots <tmp>` (4/4).

### R2. Motion retune M1 (opus; owner said not Fable)
- **Owns:**
  - `client/src/design/*` (tokens-v2.css, motion.ts + test)
  - `client/src/features/dashboard/*`
  - motion parts of `client/src/components/premium/*`
  - timing in `client/src/features/focus/*.css`
- **Owner report:** "numbers do roll but very fast; make them realistic, not too fast"; "hero colours didn't change or were too subtle".
- **Scope is TIMING ONLY** (owner, later message). No IntersectionObserver, no re-animate logic, no settle-logic changes.
- **Target:**
  - taps about 120–220ms
  - entrances about 380–600ms, stagger 60–90ms
  - data motion (count-ups, rings, bars) about 1.1–1.6s on a gentler curve, number and ring in sync
  - digit roll about 300–420ms
  - hero drift clearly visible but calm, an 8–12s cycle
  - reduced motion instant (keep the infinite-loop opt-out test)
- **Proof:** one quick Playwright frame capture (tmp script in the job folder, using demo-fixtures interception).
- **Verify:** `npx vitest run client/src/design client/src/features/dashboard client/src/components/premium client/src/features/focus`, then `npx tsc --noEmit`.

### R3. D3b drag logic `useTaskDnd` (opus)
- **Owns:** new `client/src/features/tasks/useTaskDnd.ts` + `useTaskDnd.test.tsx`. Additive changes to `taskDndTypes.ts` only if needed.
- **Brief:** implement `TaskDndController` from the contract `client/src/features/tasks/taskDndTypes.ts`.
  - Sensors: pointer, touch long-press about 250ms (a quick swipe scrolls), keyboard with a custom coordinate getter.
  - `planTaskDrop` on hover sets the refusal. A drop runs the plan's write through injected callbacks (no Home/tRPC imports).
  - Optimistic placement, `pendingIds`, rollback, and `inlineErrors` for 6s. A conflict rolls back. `needsDate` sets `dateRequest`, resolved with `taskDropDateChoice`.
  - **Review #9:** pass the FULL lane to `planSortOrderMove`, or refuse in-lane reorder while filters hide tasks (`reorderDisabledReason`). A non-Manual sort writes no sortOrder.
  - Announcements use the exact strings in spec §12. `moveTo` uses the same path as a drop.
  - Tests: the cases in spec §15.
- **Verify:** `npx vitest run client/src/features/tasks shared server/taskDrop.test.ts`, then `npx tsc --noEmit`.

### R4. D3b Board visuals (fable)
- **Owns:** new files in `client/src/features/tasks/`:
  - `TaskCard.tsx`
  - `TaskBoard.tsx` (TaskBoard + TaskLane)
  - `DropDock.tsx`
  - `DateDropPopover.tsx`
  - `tasks-board.css`
  - their tests
  - plus a Board section in `client/src/pages/PremiumGalleryTasks.tsx`, using a fake controller
- **Brief:** spec §4.1, §4.2, §4.4, §5, §6, §8, §12.
  - Status lens by default, When lens one toggle away.
  - Renders `<DndContext {...dnd.contextProps}>`, a SortableContext per lane, droppable wells and a DragOverlay.
  - Motion: drag lift (scale, shadow, tilt), spring drop, siblings make room, lane hover highlight, refused lock + reason, rolling counts, dashed empty wells, saving shimmer. Use the owner's timing direction; reduced motion is instant.
  - Phone 390: a lane switcher or snap scroller.
  - No tRPC or snapshot data inside.
- **Verify:** `npx vitest run client/src/features/tasks client/src/components/premium`, `npx tsc --noEmit`, and gallery screenshots in the job tmp folder `d3b-gallery`.

### R5. D3.5 iPhone nav & gestures spec (fable, docs only)
- **Owns:** `docs/superpowers/specs/2026-10-14-premium-redesign-d3-5-iphone-nav.md` only.
- **Brief:** use the owner decisions in DECISIONS (2026-10-13, iPhone section):
  - the glass bar Home/Today/+/Calendar/More, which shrinks on scroll; change the `phase4DefaultPreferences.primary` default; Home opens the Dashboard on phone
  - context "+"
  - swipe rows (`TaskRow` `.task-row-swipe`), swipe days, long-press, pinch Calendar, tap the active tab to scroll to top
  - directional slide, outline→filled icons, launcher More, pull to refresh with a ring
  - no haptics on iPhone Safari
- **The spec must contain:**
  - the problems today
  - 390 ASCII layouts
  - a gesture table, each gesture with a button alternative
  - a motion table
  - a parallel build split (Fable visual files vs opus hooks: `useSwipeRow`, `usePullToRefresh`, `useScrollShrink`, the nav default)
  - states, accessibility, a test plan (CDP touch at 390), risks
  - owner questions, each with a recommended answer
- **Verify:** the file exists and covers the list above.

## 2026-10-16 runs
- **Opus, D3.5 hooks:** finished; committed `0aef6b7` after the primary re-ran the lane (14 files / 153 tests) and tsc (clean).
- **Fable, Tasks prototype:** the first run hit the API rate limit before writing files. Relaunched; finished: `prototypes/tasks.html` + `tasks-notes.md`. Primary verified it visually and published it privately (see `ux-restructure/04-prototypes.md`).
- From now on, every Fable run needs a one-line owner confirmation first.
- **RUNNING (launched 2026-10-16, uncommitted files may be on disk):**
  1. ✅ DONE `3c7544a` (primary re-verified: 128 tests in the why/habit/dashboard lanes, tsc clean). **Opus, D4 engine:** shared/whyItMatters.ts, shared/habitStreak.ts, client/src/features/why/*, server/whyItMatters.test.ts, server/habitStreak.test.ts, and an edit to client/src/features/dashboard/dashboardModel.ts. Verify: npx vitest run server/whyItMatters.test.ts server/habitStreak.test.ts shared server, then npx tsc --noEmit.
  2. ✅ DONE `8b01c2e` (primary re-verified: 156 files / 1385 tests, tsc clean). **Opus, Tasks logic T1:** the isInboxTask rule (Q2); taskDrop confirm outcome (Q4); the useTaskDnd day-column lens (Q3); groupTasksByWhen (Q7); rowPills (Q6); archive selectors (Q9); plus report-only checks on the This-week flag storage and the savedViews fields. Verify: npx vitest run shared client/src/features/tasks server, then npx tsc --noEmit.
  3. ✅ DONE `d514d76` (2026-10-17, primary re-verified: tsc clean; vitest 159 files / 1409 passed / 3 skipped after updating one stale guidance test; build; tasks harness 5/5). Visual follow-ups moved to T2b-1: two headers + two Capture buttons, uneven row-title indent, 390 Group switch "Cate…" and clipped "At risk" chip. **Opus, Tasks UI T2a:** tabs Inbox/List/Board + Archive; List grouped by When (group switch); row pills + D4 reason line; Inbox triage (This week → this-week day picker, no migration); cut-list removals. Out of scope (T2b): Week board UI, late-drop UI, bulk bar, saved-view pills, morphs, gesture mounting. Uncommitted until the primary verifies. Verify: npx vitest run shared client server, npx tsc --noEmit, npx vite build.
  - If the session dies, re-run the verify commands; if they pass, commit; otherwise relaunch Opus with "continue from files on disk".

## 2026-10-17 runs (T2b split into two sequential Opus runs)
- ✅ DONE `23f891a` (2026-10-17; primary re-verified: tsc clean; vitest 160 files / 1432 passed / 3 skipped; build; harness 5/5, 0 live writes; Board/late-drop shots checked). Follow-ups → T2b-2: hover ⋯/drag handle overlaps card title; sidebar marks Inbox active on Board; page title "Board" → "Tasks"; wire workspace week start (was fixed Monday); unused `onReorder` prop. **Opus, T2b-1 (Week board + late drop + T2a follow-ups).** Owns `client/src/features/tasks/*` (new `TaskWeekBoard.tsx` etc.), `client/src/pages/Home.tsx` wiring lines only, `scripts/preview-premium-tasks.py`. Scope: Week board from `weekBoardColumns` (`day:${id}` zones via the useTaskDnd day lens), week paging + Today chip, Status lens switch (this week only), board default lens → `week`, inline `controller.lateDrop` prompt (Plan anyway / Move deadline / Cancel), ⋯ "Plan for…" menu as keyboard/touch alternative, cards show only what the column doesn't; one header + one Capture; even row-title indent; 390 Group switch/chips fit; harness covers Inbox, Archive, Board week. Verify: npx vitest run shared client server; npx tsc --noEmit; npx vite build; harness.
- **RUNNING: Opus, T2b-2:** bulk select + glass bulk bar, saved-view pills with live counts (order in jsonb config), detail morph (framer-motion), D3.5 gestures mounted in Tasks (swipe row, long-press select, pull to refresh), plus T2b-1 follow-ups a–e. Full brief below.
- **NEXT (replaces the Today+Focus prototype, owner 2026-10-17):** Opus **Today layout pass** → primary publishes a private screenshot gallery → owner verdict. The primary writes its brief after T2b-2 commits.

## After the runs: integration order
1. R1 + R2 verified → commit, then the full suite, build and demo tour. Push D3a + M1. Refresh the owner's :3200 snapshot (see HANDOFF "Owner test server") and tell the owner to reload.
2. R3 + R4 → mount the Board in TaskWorkspace (opus), run the harness drag checks (spec §15), verify, push D3b.
3. D3c: Inbox triage rewrite, SavedViewsPanel, BulkActionBar and Select mode, and remove the "Task triage tools" stub + `TaskTriagePanel`. Same split (Fable visuals, opus logic).
4. D3.5 build from the R5 spec → D3.5.2 browser verification → **V** (Fable visual audit and redesign, the owner's standalone task) → D4 → D5 → D6 → D7.

### T2b-2 full brief (stored 2026-10-17 so it can be relaunched identically; model Opus, general-purpose, may edit, no commit/push/stash)
- **Worktree:** `.claude/worktrees/premium-redesign`. Windows 8 GB: one heavy command at a time; stop any dev server before finishing.
- **Read (targeted):** `ux-restructure/prototypes/tasks-notes.md` (Bulk select, Detail, Saved views, Phone 390) and `tasks.html`; `03-interview-log.md` "Tasks: locked summary (Q1–Q11)"; `specs/2026-10-14-premium-redesign-d3-5-iphone-nav.md` gesture rows G1–G3 + rules (20px edge guard, `touch-action: pan-y`, one gesture owner, filterTaps; no swipe on Board cards); hooks `client/src/features/gestures/*` (mount, don't rewrite); the T2a/T2b-1 Tasks code; saved views live in the jsonb `configuration` (no migration; pill order stored there); `CLAUDE.md` Design direction (motion tokens; owner timing: taps 120–220ms, entrances 380–600ms; reduced motion = instant; framer-motion for the morph).
- **Hard rules:** no schema/migration, no new deps, preserve IDs/history, only existing write procedures (leave out and report any action without a backend path), new code in feature files, `Home.tsx` only for prop wiring.
- **Scope:** (1) bulk select: hover gutter box, Shift-range, `X`, long-press on phone; glass bar Plan for… · Move to project · Priority · Archive · Delete (icon-only above the nav at 390); one Undo per batch; Esc exits; non-dialog delete confirm; Inbox/List/Board. (2) saved-view pills under the tabs with live counts; "Save view" from current filters; rename/delete menu; order in jsonb; remove the legacy SavedViewsPanel creation path. (3) detail morph row → side pane / bottom sheet with grab handle (framer-motion shared layout); one ✕; "Saving" → "Saved ✓"; one primary Start focus; D4 "Why it matters" (`task_detail`, `whyDetailSection` empty state); keep all fields. (4) phone gestures in Tasks: useSwipeRow G1–G3 on List/Inbox rows (complete + Undo; recurring → occurrence resolve; refusal nudge + reason), pull to refresh, long-press → select; not on Board. (5) follow-ups: (a) Board card hover ⋯/drag handle overlaps the title; (b) sidebar marks Inbox active on Tasks › Board; (c) page title "Tasks" on every Tasks view; (d) workspace week start into TaskWeekBoard (default Monday); (e) remove the unused `onReorder` prop. (6) harness `scripts/preview-premium-tasks.py`: bulk 2 rows → Plan tomorrow → expected updates + Undo; pill create shows a count; detail morph open/close via ✕/Esc; 390 swipe-right = exactly one completion write (or occurrence resolve); keep prior checks; 0 live writes; shots outside the repo. (7) vitest for the bulk model (range, X, Esc, undo batching), pill order/config round-trip, detail save states, gesture outcomes incl. recurring refusal, and the follow-ups.
- **Verify:** `npx tsc --noEmit`; `npx vitest run shared client server`; `npx vite build`; harness on :3100; inspect the shots; stop Vite.
- **Report:** ≤450 words: files, scope outcomes, verify numbers, deviations, left-out actions, owner questions, risks.
- **Status 2026-10-17 19:30 IST:** running. The Claude session was exited once (~19:15) and the agent survived (a resume message was queued). In final verification (harness extended, 66 shots).
