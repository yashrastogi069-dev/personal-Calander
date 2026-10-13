# Premium redesign D2: Dashboard home

Date: 2026-10-13. Status: locally implemented; evidence lives in `docs/PHASE4_SLICE_EVIDENCE.md`. Builds on [D0](2026-10-13-premium-redesign-d0-design.md) and [D1](2026-10-13-premium-redesign-d1-shell.md). Target look: v2.1 preview boards Main (light), Dark and Phone.

## Scope
- A real Dashboard at `home/overview`. It replaces the legacy "Your saved planner at a glance" list.
- The default landing (bare URL, no stored location) is now `home/overview`; it used to be `home/today`. Explicit URLs, stored deep links and the PWA shortcuts are unchanged.
- The `overview` view label is now "Dashboard".
- Hero header (`PlannerShell` `eyebrow`, `subtitle`, `tabsInHeader`):
  - The eyebrow shows "weekday, day month · City".
  - The H1 is the greeting.
  - The subtitle reads "Today's intention: **…**".
  - The Home tabs sit inline in the title row on desktop and drop to row 2 at 681–1180px and on phone.
- No schema, migration, stored-preference or planner-data change. Everything is a read-only projection, except the existing habit check-in mutations and navigation.

## Data contract (`client/src/features/dashboard/dashboardModel.ts`)
`projectDashboard(input)` is pure. Home passes it the snapshot (with optimistic task states applied), plus:
- `projectToday` for today
- `projectPlanWeek` for the Monday-based week
- `roadmapProjection` items, wrapped in try/catch so a failure means an empty status
- the workday bounds and a minute-aligned `now` from `useMinuteNow`, active only while the Dashboard is visible

| Card | Source | Rule |
| --- | --- | --- |
| Greeting | `now` in the workspace timezone | before 12:00 morning, before 17:00 afternoon, otherwise evening |
| Intention | today's daily plan (`dailyPlans.intention`, not archived) | trimmed; empty means no subtitle |
| Today's commitments | unique task rows in the Today timeline plus the flexible list, and today's completion evidence | done counts completion evidence, including occurrences and optimistic completions without `completedAt`. "Due today" and "overdue" count open tasks by `dueLocalDate`; won't-do tasks are excluded. |
| Habit consistency | `habitPeriodConsistency` over 28 days, plus a 14-day strip | an open today is pending, not missed; times-per-week habits are left out of the percentage |
| Focus this week | focus sessions started inside the plan week, measured with `confirmedActiveSeconds` | abandoned sessions are ignored; "planned" is the sum of estimates on the week's planned cards, or null if there are none |
| Up next | the first open timed task not yet ended; otherwise the first open flexible task ("anytime") | `now` while it is running, otherwise `next` with the minutes until it starts |
| Day schedule | timed rows from the Today timeline: tasks and appointments | window = the workday (default 09–17), widened to fit the items; the now-line shows only inside the window; planned and free time come from Today capacity |
| Week | `projectPlanWeek` days | committed excludes archived and won't-do; done = completed, a done commitment or a completed occurrence |
| Goals & Projects | active projects ranked off → risk → on, then by due date, top 3 | status follows the roadmap attention table below |
| Milestones | open milestones due within the next 30 days, at most 4 | `offsetPercent` places each one on the 30-day track |
| Habits today | Today projection habit rows | streak = consecutive completed due days, ending today or yesterday; skips and non-due days neither count nor break it; 7-day trace |

How roadmap attention maps to project status:

| Attention | Status | Label |
| --- | --- | --- |
| blocked | off | Blocked |
| deadline_overdue | off | Overdue |
| explicit_risk | risk | Watch or At risk |
| review_due | risk | Review due |
| execution_gap | risk | No next step |
| none of these | on | On track |

Rules added after the independent opus review (2026-10-13):
- **Done today is one set.** It comes from Today's completion evidence: the task itself, or today's occurrence of a recurring task. The hero count, the schedule's done state, the unscheduled count, Up next and Later today all read it. A completed occurrence can no longer show as open.
- **Pending completions are stamped.** A completion that hasn't synced yet (an optimistic tick, or a queued offline update that isn't in review) has no `completedAt`. Home stamps it with the current minute and re-projects Today for the Dashboard only, so it counts as done. Nothing is inferred from a bare `state`.
- **All-day stays out of the hourly window.** All-day events (`externalEvents.isAllDay`) and anything spanning 23 hours or more go to a separate "All day" strip instead of stretching the window to 0–24.
- **No evidence, no status.** A project with no roadmap item, or every project when `roadmapProjection` fails, gets no status pill instead of "On track".
- **Unknown planned time is a dash.** Planned time is null (shown as "—") when nothing carries an estimate.
- **A missed slot stays doable.** An open task whose slot has ended can still be Up next ("anytime").
- **Skipped habit days are excused** in the 14-day strip, matching the streak rule.
- **Habit check-ins wait while a write is pending,** and Dashboard check-ins surface the same habit error as Today and Habits.
- `useMinuteNow` re-aligns on focus and visibility change, so a woken device doesn't show the old time for up to a minute.
- The h1 greeting carries a screen-reader suffix ", Dashboard".
- `snapshot` is memoised, so Today and Dashboard projections no longer rerun on every Home render.

"Missing evidence is not treated as progress": there are no inferred completions, an empty source shows an honest empty state, and a null percentage renders as "—", never 0%.

## Actions
Every action routes through existing Home handlers.

| Action | Goes to |
| --- | --- |
| Today | home/today |
| Calendar | plan/calendar |
| Plan day | plan/daily |
| Tasks (filtered) | tasks/list; `overdue` maps to `deadline_risk` |
| Habits | the habits surface |
| Focus | the global Focus action |
| Roadmap | plan/roadmap |
| Weekly objectives | plan/weekly |
| Saved reviews | review/history |
| Goals | intentions/outcomes |
| A project | `openProjectRecord` |
| A task | `openTaskRecord` |
| Start focus | `setFocusEntryTaskId`, then Focus |
| Habit check-in | toggle with `recordHabitCheckIn` / `undoHabitCheckIn`; available only online and on a live (not cached) snapshot |

Weekly objectives, saved reviews and goals carry over the routes the legacy overview offered, so no capability is lost.

## UI
The components are `DashboardView.tsx` and `dashboard.css`. They use only D0 tokens and primitives (`--pc-*`, `pc-tone-*`, Pill, StatusPill, TimeChip, CategoryChip) and D0 motion classes, and they honour `prefers-reduced-motion`. The root is `section.pc-dash[aria-label="Dashboard"]`.

## Known limits (accepted for D2, recorded for later)
- **Habit start date (pre-existing, in `shared/habitSchedule.ts`).** A daily habit with no `schedule.startLocalDate` starts on the UTC date of `createdAt`. East of UTC (Auckland) that can be the day before local creation, so the day before shows one "missed" day. The fix belongs in shared code used by Today and Habits too, so it is deferred to a separate change.
- **Drill-through filters are broader than the counts.** "Overdue N" opens the `deadline_risk` filter, which also covers due-today and at-risk work. "Due today" opens the `today` filter.
- **Streak is capped by the 28-day snapshot window.** Weekly-quota habits show no streak.
- **Phone "Home" target.** On phone, `targetForDestination("home")` still opens Today. The Dashboard is reached through the Home tabs or the default landing; see the open question below.

## Delight pass (owner: "cool icons, animations, motions")
Built by opus with the `impeccable`, `design-taste-frontend` and `emilkowal-animations` skills.
- **Icons:** card headers get lucide icon tiles. The Due card shows an alarm clock, or a calendar check when nothing is due.
- **State-driven motion:** it plays on a real change, never on page load.
  - Counts roll to the new number.
  - A habit check-in draws its tick, springs, shows a small burst and a streak flame.
  - The hero ring glows and a check draws in only when everything is done.
  - A live dot appears only when Up next is happening now.
- **Ambient:** a slow hero colour drift (22-second cycle) and the live dot are the only infinite loops.
- **Interaction:** hover lift, arrow nudges and hover effects apply on mouse devices only. Buttons press to 0.97 scale; interactions stay under 300ms with ease-out.
- **Shell:**
  - Sidebar and phone-bar highlights glide between items, and the active icon pops.
  - The Home tab indicator uses the same timing.
  - The phone Capture "+" turns 45° (to ×) on press, with a glow.
  - The command palette opens with a slight blur and dims the page.
- **Foundation:** `client/src/design/motion.ts` holds shared timing and the "only on change" helpers. Motion tokens were added to `tokens-v2.css` without changing existing ones.
- **Reduced motion:** turns everything off or makes it instant. A test checks that every infinite animation has an opt-out.

## Open questions for the owner
- The phone primary shortcuts keep their current default (Today / Tasks / Daily plan). v2.1 Phone shows Home / Today / Calendar. Changing it would change a stored-preference default, so it is left until the owner decides.

## Deferred
- Fable composition pass on the hero and the Up next card (needs the owner's go-ahead).
- Lowering the legacy-green and radius findings in older CSS: D3–D6 as each screen is rebuilt.
