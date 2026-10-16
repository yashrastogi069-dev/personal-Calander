# HANDOFF: premium redesign (updated 2026-10-14 ~13:20 NZ: five agents running when the owner's usage limit ran out)

Worktree: `.claude/worktrees/premium-redesign`, branch `work/premium-redesign`. Push with `git push origin HEAD:dev/personal-calendar-premium-v2`. Never push to main; never force-push.

## Start here (read this first; it is enough to resume)
- **RESUME HERE (2026-10-16, owner's usage limit ending).**
  1. **T2a Tasks UI (Opus) was RUNNING at the cutoff.** Its uncommitted files may be on disk (e.g. `client/src/features/tasks/*`, `taskWorkspaceModel.ts`). Run `git status`, then verify: `npx vitest run shared client server`, `npx tsc --noEmit`, `npx vite build`. If all pass and the scope matches the T2a brief (`docs/superpowers/plans/2026-10-14-agent-runs.md` item 3), commit only those files and push. Otherwise relaunch Opus with "continue T2a from files on disk" using that scope.
  2. Then **T2b** (Opus): Week board from `weekBoardColumns` (`day:${id}` zones), the inline `controller.lateDrop` prompt, bulk bar, saved-view pills (the order can live in the jsonb config), detail morph (framer-motion), mount the D3.5 gesture hooks in Tasks; switch the board default lens to `week`. The T1 notes are in `DECISIONS.md` 2026-10-16.
  3. Then the **Today + Focus light prototype** (Opus, no confirmation needed): the brief is ready at `docs/superpowers/ux-restructure/prototypes/today-focus-brief.md`. Primary screenshots → publish privately → record in `04-prototypes.md` → owner verdict.
  4. The checkpoint for this run = items 1–3 done. Then follow the build queue below.
  - Rules: one agent at a time; Opus builds (prototypes too, light); Fable only for consults, with a one-line owner confirm first; record every decision in the MDs; stop dev servers; never commit PNGs.
- **NEWEST (2026-10-16, evening).** Read `docs/superpowers/ux-restructure/05-product-direction.md` (the app's purpose, the core loop, connectors, timeline A–G, owner answers P1–P4, n8n ideas §9), then `docs/DECISIONS.md` (top section).
  - Done: `ba4aa6b` direction doc; `8b01c2e` Tasks T1 logic (156 files / 1385 tests, tsc clean); `3432497` decisions + n8n ideas.
  - **Prototype + Fable rule (owner, 2026-10-16, later):** prototypes are now built by **Opus** and kept **light**: one HTML file showing the key states on desktop and phone, the main interaction only, about a third of the Tasks v1 size. A page that is a small variation of an approved one may skip its prototype. **Fable is only for suggestions, recommendations and consultations** (a flow critique, a second opinion), and each Fable run still gets a one-line owner confirmation. Work proceeds **one item at a time**; every decision is recorded in the MDs.
  - Gated, waiting on the owner: the `tasks.plannedWeekStartLocalDate` migration (This-week flag); Google OAuth setup; Inbox API token storage. The owner still checks the timezone (Q48).
  - **Build queue (one at a time, core loop first, P1):**
    1. **T2a Tasks UI** (Opus, RUNNING): tabs, List grouped by When, row pills + D4 reason, Inbox triage, Archive, cut-list removals.
    2. **T2b Tasks UI** (Opus): Week board + late-drop prompt, bulk bar, saved-view pills, detail morph, D3.5 gesture hooks mounted in Tasks.
    3. **Today + Focus light prototype** (Opus), so the owner can quickly see it → owner yes/changes.
    4. **Today build:** Next-up hero, timeline, tick in place, habit chips, Plan my day (3 moves + energy tap), Shut down (calm but strict).
    5. **Focus upgrades:** immersive, presets/breaks, ambient sounds, notes/stats.
    6. **Nav + Settings:** light prototype → build (rail, phone bar + More, one-page Settings as in `05-product-direction.md` §5).
    7. **Phase C, connected:** push nudges ×3; Inbox API + iOS Shortcut + n8n recipes (pick the first 3 from §9); the Google OAuth sync design. Gated steps need the owner.
    8. Then D (Calendar, Week), E (Goals, Habits, Insights), F (finish), G (release, owner-gated).
  - **Checkpoint target for this run:** T2a + T2b committed and pushed, and the Today+Focus light prototype published for the owner.
- **Earlier on 2026-10-16.** Read `docs/superpowers/ux-restructure/README.md`, then `03-interview-log.md` (Q1–Q16 locked; "RESUME HERE" names the next question, Q17).
  - **Done 2026-10-16:**
    - `0aef6b7` D3.5 gesture hooks + phone bar default (Opus): 14 files / 153 tests in the lane, tsc clean. Not mounted.
    - Interview Q14 (every Today row tickable in place), Q15 (Today = "habits due" chips; heatmap and traces → Habits tab), Q16 (calm 3-step shutdown with strictness: Close day needs an explicit decision per open item; 3+ carries must be scheduled, broken down or let go).
    - Tasks prototype v1 (Fable, relaunched after the rate limit): `docs/superpowers/ux-restructure/prototypes/tasks.html` + `tasks-notes.md`. Primary checked screenshots (List, Board, Inbox, phone 390: no h-scroll, no console errors). Added phone auto-mode at ≤600px. Published privately: https://claude.ai/artifact/NXrHCqtnRYEC1cCJ1kSazR (publish copy = the file minus the doctype/html/head/body wrapper). **Awaiting the owner's verdict** and their answers to Fable's 5 open questions (in `tasks-notes.md`).
  - **New standing rule (owner 2026-10-16):** ask the owner for a one-line confirmation before EVERY Fable run (confirmation only, not a ban). Opus/Sonnet runs need no confirmation.
  - **INTERVIEW COMPLETE (Q1–Q49, 2026-10-16).** The full app map is under "INTERVIEW COMPLETE" in `03-interview-log.md`. Calendar gets a total redesign; Focus gets 4 upgrades; the D4 §9 questions are answered (the owner checks the timezone personally).
  - **Later on 2026-10-16:**
    - Tasks v1 **APPROVED**.
    - Motion plan: glass on floating layers, framer-motion morphs, M2 pass.
    - **Q50: Google Calendar OAuth chosen** (gated setup steps need the owner).
    - Q51: meetings show on Calendar, Today and the hero, with Join and a 10-min reminder.
    - The owner said **"Not now"** to the Fable Today+Focus prototype run. Ask again before running it.
    - **D4 engine DONE `3c7544a`** (surfaces task_row, inbox_triage, task_detail, today_row, dashboard_up_next, habit_row; `whyDetailSection` gives the Q43 empty state; build notes appended to the D4 spec). Open owner judgment: "Supports a goal" still shows on **habit_row**, since Q42 covered task rows only.
    - (was: D4 engine: an Opus agent was launched 2026-10-16 (uncommitted files may be on disk; verify with `npx vitest run server/whyItMatters.test.ts shared server` + `npx tsc --noEmit`).
  - **Product direction (2026-10-16):** the owner asked "is this useful or an app that never opens?" The answer is in `docs/superpowers/ux-restructure/05-product-direction.md`: core-loop-first build order; capture from everywhere (Inbox API + iOS Shortcut + n8n); push nudges; timeline phases A–G (~6–7 weeks). **Owner answered P1–P4:** core loop first; all three capture paths + explore wider n8n use (§9 ideas); all three nudges; AI later, drafts only.
  - **Tasks T1 logic DONE `8b01c2e`** (156 files / 1385 tests, tsc clean). The UI build must read the agent's notes in `DECISIONS.md` 2026-10-16: board default lens still `status` until the Week board ships; lanes come from `weekBoardColumns`; render `controller.lateDrop` inline; pass `keepInPlaceIds`. Gated: the This-week flag migration. Settings is designed by the primary inside prototype #7 (owner OK'd).
  - **Next (current):**
    1. ~~Owner verdict on the Tasks prototype~~ DONE: approved.
    2. Prototypes, one Fable run per page, **each confirmed by the owner first**: Today+Focus → Calendar → Week → Goals → Habits → Insights → Nav+Settings.
    3. D4 engine (Opus, pure logic, files in the D4 spec §6), which can run now.
    4. Then build the approved pages (Opus), mount the D3.5 hooks inside them, and run D3.5.2 browser verification.
  - **Older next-list (superseded):**
    1. Owner verdict on the Tasks prototype → record it in `04-prototypes.md`.
    2. Interview Q17 (energy/mood), then the Calendar, Plan weekly, Roadmap, Goals & Projects, Habits, Review/Analytics and Nav/More/Settings banks, plus the 8 D4 owner questions (D4 spec §6).
    3. D4 engine (Opus, pure logic) can run in the interview gaps.
    4. Today prototype (Fable, after confirmation) once the Today questions are done.
- **Previous (2026-10-15, usage limit hit mid-interview).** Read `docs/superpowers/ux-restructure/README.md`, then `03-interview-log.md` (Q1–Q13 locked; "RESUME HERE" names the next question, Q14).
  - **Pushed today:**
    - `f7282f0`: D3a + M1
    - `1d6854f`: R3 useTaskDnd
    - docs: restructure plan, structure map `01`, reference catalogue `02`, interview log, D4 spec
    - last checkpoint: this commit
  - **Two agents were RUNNING at the cutoff; their uncommitted files are on disk:**
    1. **Opus, D3.5 hooks.** Owns `client/src/features/gestures/*`, `shared/phase4Preferences.ts` (phone bar default Home/Today/+/Calendar/More, plus a one-time migration of an exactly-default saved list) and shell tests.
       - Verify: `npx vitest run client/src/features/gestures client/src/features/shell shared server/phase4Shell.test.ts`, then `npx tsc --noEmit`.
       - If it passes, commit. If not, relaunch Opus with "continue from files on disk".
    2. **Fable 5.1, Tasks prototype.** Owns `docs/superpowers/ux-restructure/prototypes/tasks.html` and `tasks-notes.md`; screenshots go to the job tmp `proto-tasks`.
       - Check that it shows all Q1–Q11 decisions.
       - Publish it as a private Artifact (load the artifact-design skill first) and show the owner for approval.
  - **Next:**
    1. Continue the grill-me interview at Q14, one question at a time, using AskUserQuestion with a recommended option first.
    2. When a free agent slot opens, Opus builds the D4 engine from `docs/superpowers/specs/2026-10-15-premium-redesign-d4-why-it-matters.md`: `shared/whyItMatters.ts`, `server/whyItMatters.test.ts`, `shared/habitStreak.ts` and `client/src/features/why/whyFacts.ts`. It is pure logic; the UI waits for the approved pages.
    3. Max 2 agents at once.
- **2026-10-15 session (newest; supersedes the 2026-10-14 block below).** Goal from the owner: complete everything up to and including D4, autonomously, as a self-paced `/loop`, with **one subagent at a time** (laptop RAM).
  - **New routing (owner, 2026-10-15):** Fable 5.1 plans and designs (specs, design direction, visual audits); Opus builds the visuals and the logic; Sonnet only for low-level mechanical work.
  - **Pushed:** `f7282f0` = D3a List integration + Tasks harness + M1 motion timing. Verified: tsc clean; vitest 143 files, 1140 passed / 3 skipped; build; tasks harness 5/5; demo tour 4/4.
  - **Tasks visual problems found (Opus + primary screenshot review), to fix in the D3b visual run:**
    1. pills crushed to "W.", "H." on busy rows (needs a priority cap and a "+N" pill)
    2. hover-only row actions still reserve ~130px
    3. two headers and two Capture buttons (shell bar + TaskHeader)
    4. the detail sheet footer wraps at 390, with two Close buttons
    5. the "Task triage tools" stub (D3c) and quick-filter chips cut off at 390
  - **Now:** R3 `useTaskDnd` (opus). Keep it: drag mechanics are needed whatever the design.
  - **RE-PLAN (owner, 2026-10-15):** "the DASHBOARD looks great but not other pages". The owner wants a **total UX restructure** of Tasks (Board drag, List, Inbox and its purpose, Saved, Archived), then most other pages, to a very premium, modern, classy look with motion and great icons. The owner chose: grill-me with big interview rounds, competitor references (Asana, Sunsama, monday and others), and prototypes the owner approves before any build. Dashboard and Focus/timer are the quality bar and stay.
    - **Decision (primary, owner asked me to choose the timing):** V is promoted and expanded into **"UX restructure"**, which runs NOW. It goes before the D3b visuals (R4), D3c, the D3.5 build and D4.
      1. Fable maps the structure: every page and what it is for, overlaps and dead ends, and what Inbox, Saved views and Archived do today, plus a competitor read.
      2. grill-me interviews, Tasks first, one question at a time, each with a recommendation.
      3. Fable prototypes for the owner.
      4. On approval, Opus builds page by page. This absorbs D3b visuals and D3c, and D3.5 nav and D4 "why it matters" land inside the redesigned pages.
    - **Owner update (2026-10-15, later):** **Opus** does the structure mapping for now, not Fable, and it covers EVERY page. Interviews cover ALL pages, not just Tasks. The owner asked whether to do this now or after D3.5/D4. My recommendation: now, because the D3.5 phone-bar/More contents and D4's placement depend on the restructured pages. Meanwhile Opus builds the layout-independent logic in the interview gaps:
      - the D4 reason engine (pure)
      - the D3.5 hooks (useSwipeRow, usePullToRefresh, useScrollShrink)
      - R3 drag logic
      The page UIs get built after the prototypes are approved.
    - **Paused:** R4 Board visuals and D3c. Do not build them from the old D3 spec.
    - **Competitor screenshots:** `C:\Users\win 10\Desktop\personal-Calander\Screenshots of competition` (60 PNGs). The owner confirmed "lets do this now".
    - **FULL DETAIL AND STATUS:** `docs/superpowers/ux-restructure/README.md` (process table, owner decisions, file index). Interview answers go in `docs/superpowers/ux-restructure/03-interview-log.md`.
  - **Working assumptions (owner to confirm):** the D3.5 spec's three owner questions take their recommended answers; V runs after D3.5.2 and before D4.
  - The owner's :3200 snapshot was not refreshed this session (the old job folder belongs to a previous session).
- **RESUME FROM HERE (2026-10-14, limit cutoff).** Open `docs/superpowers/plans/2026-10-14-agent-runs.md`. It lists every agent run: done, or running at the cutoff with uncommitted edits. Each entry has the model, the files it owns, a brief and a verify command.
  - **Slice status:**
    - D3a pieces are done and committed.
    - Running at the cutoff:
      - R1: D3a integration + Tasks harness (opus)
      - R2: motion retune (opus, timing only, not Fable)
      - R3: D3b `useTaskDnd` (opus)
      - R4: D3b Board visuals (fable)
      - R5: D3.5 spec (fable, docs only)
    - Not started: D3c, D3.5 build, D3.5.2, V, D4–D7.
  - **First steps next session:**
    1. Run `git status --short` and match the files to R1–R5.
    2. Run each run's verify command.
    3. Re-launch unfinished runs with the same model and brief ("continue from files on disk").
    4. Then follow "After the runs" in that ledger.
  - **Commits:** `cc6ef95` (deps) and `82a3b10` (D3a pieces), plus this docs checkpoint. Check `git log origin/dev/personal-calendar-premium-v2..HEAD` for what is unpushed.
  - **Servers:**
    - :3100 is the agents' Vite (`npx vite --port 3100 --strictPort --host 127.0.0.1` in the worktree).
    - :3200 is the owner's frozen snapshot of `6b3b7cf`, in the job tmp folder `C:\Users\win 10\.claude\jobs\1213955a\tmp\owner-snap`. It has its own `cacheDir` and a `node_modules` junction to the worktree. Start it with `npx vite --port 3200 --strictPort --host 127.0.0.1` from that folder.
    - The owner opens the demo with `python scripts/open-demo-preview.py --url http://127.0.0.1:3200/`.
    - If the job folder is gone, recreate it: `git archive <commit> | tar -x -C <dir>`, add `cacheDir` to its vite.config.ts, and junction `node_modules`.
  - **Owner decisions today (DECISIONS 2026-10-14):**
    - install fix approved
    - #4 → next occurrence
    - the three D3 assumptions confirmed
    - motion "realistic, not too fast", timing only
    - hero drift more visible
    - not Fable for the motion fix
    - no sonnet for important work or any UI/UX work, use opus
    - new standalone task **V**: a Fable visual audit and redesign. The owner sets its timing; assumed after D3.5.2.
  - **Pending for the owner:**
    - Where should V go (currently after D3.5.2)?
    - Should Fable stay the designer, with opus only replacing sonnet (assumed yes)?
- **2026-10-14 earlier update (supersedes the blocker and pending questions below):**
  - **Install fixed:** the worktree has its own `node_modules`, and `@dnd-kit/*` + `@use-gesture/react` are installed (`cc6ef95`, local).
  - **Owner decided:** review #4 → bucket deadline-only recurring tasks by their next occurrence and change the badge to match. All three D3 assumptions are confirmed. See DECISIONS 2026-10-14.
  - **Goal now:** autonomous self-paced loop through D3 → D3.5 → D3.5.2 → D4 → D5 → D6 → D7, with a checkpoint and push after each slice.
  - **Owner testing:** the owner tests the demo on :3200, a frozen snapshot in the job tmp folder. Agents use :3100. Fix owner reports as they arrive.
  - **Next step:** D3a (contract, recurring-date fix, #4, List, row, header, detail), then D3b (Board + `useTaskDnd`, respecting #9), then D3c.
- **Goal (2026-10-13):** keep going until D3.5 is done and pushed, then the owner checks (owner, 2026-10-13). The session runs as a self-paced `/loop`.
- **Pushed:** `dev/personal-calendar-premium-v2` = `fc87b33`. It holds D0, D1, D2, the habit start date fix, stopped-focus time counting, the NZ header date fix, the demo preview, D2.5 Focus (`91bb8d2` + `fc87b33`) and the D3 logic layer (`65be9e0`). Verified: full suite 131 files, 1033 passed / 3 skipped; `npm run check` clean; build passes.
- **Demo tour (2026-10-13, after the harness fix):** 4/4 viewports (1440 and 390, light and dark). Focus starts, habit check-in works, 0 runtime or console errors, no unexpected calls, no horizontal overflow.
- **Opus review of D2.5 + D3 logic (2026-10-13):** no high-severity issues; 4 medium and 5 low. Status of each:

| # | Finding | Status |
|---|---|---|
| 1 | Dashboard "Now" card offers Start focus for a task already running | FIXED (tested): shows "Open focus" / "Focusing · Open" when a session is open (`DashboardView.tsx` UpNextCard) |
| 2 | Pause/Resume then a quick Finish sends a stale version (conflict) | FIXED: pause/resume `onSuccess` awaits the snapshot refetch (`FocusSessionContext.tsx` `refresh`) |
| 3 | Finish offers "Done" for tasks the server refuses (recurring series, open plan, prerequisites, archived) | FIXED: new `doneBlockedReason` from `taskCompletionCheck`; the Done tile is disabled with the reason (`FocusSessionContext.tsx`, `FocusFinishFlow.tsx`) |
| 4 | Deadline-anchored recurring series sit in "Past due" forever (`shared/taskBuckets.ts:79`) | TODO, OWNER DECISION: a test deliberately locks today's behaviour to match the D1 badge. Proposed: skip the overdue rule when recurring and no Plan-for date, and change the badge to match |
| 5 | "Start focus on X" from the Dashboard lands on "What next?" within 10 minutes of a finish | FIXED: `useStartFocus` in `DashboardView.tsx` dismisses the pending review first |
| 6 | The "What next?" step can vanish mid-edit when the 10-minute window ends | FIXED: the review is pinned once shown, until answered or closed (`FocusWorkspace.tsx`) |
| 7 | Clock skew on the 10-minute window; the interval keeps ticking after expiry | ACCEPTED (low, harmless); note in the spec's known limits |
| 8 | "Next 7 days" drop not capped by the deadline | FIXED with a test (`shared/taskDrop.ts`, `server/taskDrop.test.ts`). A deadline inside the next 7 days already puts the task in that bucket, so the real gap was past-due and due-today tasks; those are now refused |
| 9 | Renumbering can scatter hidden tasks if the UI passes a filtered lane | TODO in D3 wiring: `useTaskDnd` must pass the full lane to `planSortOrderMove`, or refuse while filters hide tasks |
| f | Dashboard now-line time pill overlaps the "7:00 AM" gutter label | FIXED: `is-near-now` hides the hour label within 20 minutes of now (`DashboardView.tsx` DayLens, `dashboard.css`). Checked on a screenshot at 7:20 |

- **Also done (pushed `ba1e72a`):** `scripts/open-demo-preview.py` clicks "Start another focus" then "Start focus", because Focus now opens on "What next?" after a recent session.
- **Next steps, in order:**
  1. DONE: review fixes verified. Check clean; full suite 131 files, 1035 passed / 3 skipped; build passes; demo tour 4/4 clean. Committed and pushed.
  2. Install the D3 packages (see the blocker below).
  3. Start the D3 UI: Fable builds §14 of the D3 spec; opus builds `useTaskDnd` (respect #9), the TaskWorkspace wiring and the Home mount, passes occurrences to the other callers, fixes the Someday badge, and writes `scripts/preview-premium-tasks.py`.
- **BLOCKER, needs the owner:** the worktree `node_modules` is a Windows junction to the main checkout's `node_modules`, so `pnpm add @dnd-kit/...` refuses (virtual-store mismatch). The safe fix is to stop the worktree Vite servers (:3100, :3117), remove only the junction (`cmd /c rmdir node_modules`; this doesn't touch the main checkout) and run `pnpm install` in the worktree. The permission check blocked this as a shared-resource change, so the owner must approve it or run it. Alternative: the owner installs the packages in the main checkout.
- **D2.5 left for later (Fable's notes):** the shared-element dial→pill move, pill compaction, Space/F shortcuts and haptics were not built. `focus-watch.css` is no longer imported.
- **D3.5 iPhone nav & gestures:** not started. Fable designs and builds; the scope is in DECISIONS (2026-10-13 iPhone section). `@use-gesture/react` is approved; it is blocked by the same install issue.
- **D3.5.2 browser verification (owner, after D3.5 + MD updates):**
  - Available now: Playwright + CDP, playwright-cli, agent-browser and agent-reach.
  - Approved to install at the start of D3.5.2: browser-use, Chrome DevTools MCP and Claude in Chrome. Use whichever tool is most effective per check.
  - The owner helps verify the animations.
- **Owner questions pending:**
  - Review #4 above.
  - The three D3 assumptions (DECISIONS, end).
  - Approval of the `node_modules` fix.
- **Look at the app:** `python scripts/open-demo-preview.py` (Vite on :3100).
- **Checkpoint rule:** after every checkpoint, update ALL MDs (this block first), commit, push, continue. See CLAUDE.md "Checkpoints".

## Owner rules (standing, read every session)
1. **Checkpoints:** after every checkpoint, update HANDOFF.md and RUN_STATE.md (plus MEMORY.md and docs as needed), commit, push, then keep going.
2. **Subagents:** use them wherever they help, with the routing table below. **Fable 5.1 does ALL UI/UX design** (owner, 2026-10-13: "use FABLE 5.1 not opus for designs"), after loading the design skills. Opus does logic and review. Tell the owner whenever Fable runs.
3. **Design direction:** cool, futuristic icons, animations and motion, and a modern UI on every screen. The full rule is in `CLAUDE.md` under "Design direction". In short:
   - expressive labelled icons in tinted tiles
   - plenty of state-driven motion (count-ups, fills, staggered entry, glides, spring check-offs, hover lift and press scale), under ~300ms with ease-out
   - reuse `client/src/design/motion.ts` and the tokens in `tokens-v2.css`
   - push the v2.1 look further each slice
   - always honour reduced motion
   - real data only
   The D2 delight pass is the bar to meet or beat.
4. **Ask first:** before a new dependency, a gated item or using Fable outside key moments. Never merge to or push to main; never force-push.

Gated, do not touch: G1 stakes, G2 hard reminders, G3 Google two-way sync, Vercel checks, live DB writes, schema migration.

## Status
- **D0** (tokens, motion, primitives): DONE (b0312c8).
- **D1** (shell and navigation): DONE (c092b82, f9fcdb5).
- **D2** (Dashboard home): built locally.
  - Spec: `docs/superpowers/specs/2026-10-13-premium-redesign-d2-dashboard.md`. Decisions are in `docs/DECISIONS.md`, evidence in `docs/PHASE4_SLICE_EVIDENCE.md`.
  - The default landing is now home/overview (the Dashboard). The legacy "planner at a glance" list is gone; its weekly-objectives, saved-reviews and goals routes survive as quiet links.
  - Logic is in `client/src/features/dashboard/dashboardModel.ts`, a pure projection over the saved snapshot, wired in Home.tsx (`dashboardModel` useMemo).
  - UI is in `DashboardView.tsx` and `dashboard.css` (built by opus with the impeccable, design-taste-frontend and emilkowal-animations skills).
  - An independent opus review found 7 medium and 6 low issues. All medium ones are fixed and tested; the accepted low ones are listed under "Known limits" in the spec.
- **Delight pass** (owner ask: "cool icons, animations, motions"), by opus with the design skills loaded:
  - Card-header icon tiles.
  - Hero colour drift, plus a ring glow and drawn check when everything is done.
  - Rolling counts.
  - Habit check-in tick with a spring, a burst and a streak flame.
  - A live dot only for a "now" item.
  - Sidebar and phone-bar glide highlights, with the active icon popping.
  - Capture "+" turns to "×" on press.
  - The palette opens with a blur.
  - New `client/src/design/motion.ts`, with tests.
  - Reduced motion turns all of it off; a test checks that every infinite loop has an opt-out.
- **Final verification (after the delight pass and the test fix)** (details in the evidence doc):
  - Typecheck is clean; the build passes.
  - Full suite: 122 files, 859 passed, 3 skipped, 0 failed.
  - Harnesses on http://127.0.0.1:3100: shell 20/20, plan 36/36, gallery 8/8, phase4 2/2. C2 222/224: 2 load timeouts, and their targeted re-run passed 56/56.
  - Pushed as `d3b25da` to `dev/personal-calendar-premium-v2`.
  - Agent-memory checkpoint recorded.

## Next
1. D3: Tasks board drag (@dnd-kit approved). Build it to the design-direction rule:
   - drag lift and shadow
   - spring drop
   - lane highlight on hover
   - column count roll
   - labelled lucide icons
   - reduced-motion fallbacks
2. Update or retire the stale `preview-task15.py` and `preview-linked-planner.py`.
3. D3.5 iPhone nav & gestures:
   - Fable designs the system first; tell the owner when it runs.
   - Then Fable builds the UI, with the design skills loaded. Opus wires the logic.
   - Add `@use-gesture/react`.
   - Scope is in the owner decisions above.
4. Then D4 (why it matters), D5 (light Analytics) and D6 (polish and first-run states), each with its own checkpoint, handoff and push.
5. D7 Glance & reminders (Calendar feed alerts, app badge, lock-screen push / G2).
6. Fix anything the owner reports from `docs/OWNER_PREVIEW_CHECKLIST.md` as soon as it arrives.

## Owner checks in progress (2026-10-13)
- The owner checks the Vercel Preview and the animations themselves, using `docs/OWNER_PREVIEW_CHECKLIST.md`.
  - Preview for `1acc7ec` (Vercel: success): https://personal-calander-6wkxtwevp-yashnew869-2746s-projects.vercel.app
  - Agents still do not run Vercel checks. Wait for the owner's report and fix whatever they find before D3 polish.

## Owner decisions from the 2026-10-13 interview (full list in DECISIONS.md)
- **Phone bar:** Home / Today / + / Calendar / More, as a floating glass bar that shrinks on scroll. Change the code default in `shared/phase4Preferences.ts` (`phase4DefaultPreferences.primary`); it only applies when no custom list is saved. Home must open the Dashboard on phone. The left sidebar stays for iPad and laptop only; there is no phone drawer.
- **"+" button:** context-aware (event on Calendar, habit on Habits, task elsewhere).
- **Gestures:** swipe task rows, swipe between days, long-press quick actions, pinch Calendar zoom, tap the active tab to scroll to the top. `@use-gesture/react` is approved.
- **Motion and extras:** directional slide on tab switch, outline→filled icons with spring pop and bouncing badges, More as a launcher grid, and pull to refresh with a filling ring.
- **Who designs it:** Fable designs and builds the phone nav, gesture and motion UI, and opus wires the logic. Tell the owner when Fable runs.
- **New slices:**
  - **D3.5 "iPhone nav & gestures"**, after D3.
  - **D7 "Glance & reminders"**, after D6: Calendar feed alerts and categories, app icon badge, lock-screen push. D7 unlocks G2, and the scheduler rollout needs the owner's dashboard steps.
  - Real widgets need native WidgetKit, which was not chosen.
- iPhone Safari has no Vibration API, so there are no web haptics.

## Open owner questions
- **Fable composition review of the Dashboard:** optional, and needs the owner's OK.
- **Owner preview report:** pending (see "Owner checks in progress").

## Demo audit findings to fix in their slices (opus demo tour, 2026-10-13)
- **Fixed already:**
  - Headers showed tomorrow in NZ (`displayLocalDate`, `b580222`).
  - Dashboard now-line strikethrough, milestone label overlap, Week rhythm empty space and phone habit carousel clipping were handed to Fable inside D2.5.
- **Today (D3.5):**
  - The "Completed today" card says "4 evidence records" but its body is empty.
  - The "Upcoming milestone" card is mostly empty.
- **Tasks (D3):** a long flat list ending in a "Task triage tools" stub.
- **Daily plan (D4):** text-link action rows and monospace kickers.
- **Weekly plan (D4):** one day column grows to about 5,200px tall.
- **Calendar (D3.5):**
  - opens in Day view
  - 30-minute blocks clip "Complete"
  - the grid is a short scroll box beside a 24-item inbox
  - Week view is a separate legacy panel below the fold
- **Roadmap (D4):** a May–Apr window, but bars overflow past the October column and later months are cut off.
- **Recurring task meta** shows "Plan for <anchor date>" instead of the occurrence date (D3).

## Known risks and limits
- **Habit start date:** fixed in `b440ddf`. New habits are stamped with a workspace-local `startLocalDate`. Older habits without it still fall back to the UTC date of `createdAt`.
- **Glide animations:** the sidebar and Home-tab glides only animate if Home keeps the shell mounted across navigation; otherwise they snap. Not yet checked in motion; screenshots only show the end states.
- **Habit burst:** may be slightly cut off inside the phone habit scroller.
- **Stale legacy harnesses, not D2 regressions:**
  - `preview-task15.py` clicks `.plan-stage-nav` on phones, but C3 replaced it with `.plan-mobile-stepper`.
  - `preview-linked-planner.py` expects a rail "Settings" button, which has been "Open account settings" since the Phase 4 shell.
  - Update or retire both.
- **Flaky first run:** one earlier full-suite run had 2 errors that didn't recur on two re-runs; they look load-related.
- **Not verified:** no Vercel Preview, live data or physical iPhone checks.

## Where things live
- **Dashboard:** `client/src/features/dashboard/`:
  - dashboardTypes.ts
  - dashboardModel.ts plus its test
  - DashboardView.tsx plus its test
  - dashboard.css
  - dashboardFixture.ts
  - useMinuteNow.ts
- **Tokens, primitives, motion:** `client/src/design/` (tokens-v2.css, motion.ts, categoryTone.ts, timeFormat.ts) and `client/src/components/premium/` (Pills, SegmentedTabs).
- **Shell:** `client/src/features/shell/` (premiumNavigation.ts, PlannerRail.tsx, CommandPalette.tsx, PhoneNavigation.tsx, PlannerShell.tsx with eyebrow, subtitle, titleContext and tabsInHeader, premium-shell.css).
- **Home wiring:** `client/src/pages/Home.tsx`:
  - the `todayProjectionInput` and `todayProjection` memos
  - the `dashboardModel` memo, which stamps pending completions
  - the `<DashboardView>` actions
- **Harnesses:** `scripts/preview-premium-{shell,plan,gallery}.py`, `preview-c2-connected.py`, `preview-phase4-product.py`. Captures go to %TEMP%, never into the repo.
- **Local look with synthetic data:** `python scripts/open-local-preview.py` (tiny dataset, fixed clock).
- **Rich demo (use this for owner checks and visual reviews):** `python scripts/open-demo-preview.py`.
  - Data: 53 tasks, 6 habits, focus sessions and events on the real clock, Pacific/Auckland.
  - It runs an in-memory backend in `scripts/demo-fixtures.py`, so clicks work.
  - For the verification tour, add `--headless --matrix --shots DIR`.

## Subagent routing (owner instruction, updated 2026-10-13)
- **haiku:** mechanical edits and greps.
- **sonnet:** trivial read-only lookups only. Never for important work, UI/UX or screenshot review (owner, 2026-10-14).
- **opus:** all logic, architecture, test and preview tooling, independent review, and every UI/UX review or screenshot check that used to go to sonnet (owner, 2026-10-14: "for IMP things and design UI UX dont use sonnet use opus").
- **fable (Fable 5.1):** ALL UI/UX design and the visual UI build. Load `impeccable:impeccable`, `design-taste-frontend` and `emilkowal-animations` first. Always tell the owner. Owner, 2026-10-13: "use FABLE 5.1 not opus for designs".
- Give every subagent an objective, scope, file paths, a ≤450-word output and an explicit read-only or may-edit statement. Parallel editors must own separate files. Verify their claims before you accept them: the delight pass missed `server/phase4Shell.test.ts`, so always run the FULL suite.

## Gotchas
- **Never commit:** `v2-preview/` PNGs. `tmp/` is gitignored and holds the patch scripts.
- **Never use:** bare `git stash`.
- **Worktree guard:** it rejects heredocs, loops with variables and `$TEMP` and `$CLAUDE_JOB_DIR` expansions. Use Write/Edit or node scripts in `tmp/`.
- **Stray servers:**
  - A Vite on :3117 was left by the first UI agent; stopping it was blocked by permissions.
  - A full `npm run dev` server on :3000 was started at 13:33 from a cmd window outside this session (possibly the owner's). Leave it alone.
- **Agent memory:** `node scripts/agent-memory.mjs`, session 03532cfd-2fbd-4d3b-b503-ca234a6f349c.
