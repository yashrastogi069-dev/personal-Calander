# Premium redesign D4: "Why it matters"

Date: 2026-10-15. Author: Fable 5.1 (`claude-fable-5-1`). Status: spec. Nothing built yet. Branch `work/premium-redesign`.

Builds on [D0](2026-10-13-premium-redesign-d0-design.md), [D2 Dashboard](2026-10-13-premium-redesign-d2-dashboard.md), [D3 Tasks](2026-10-13-premium-redesign-d3-tasks.md) (§4.7 detail sheet slot, §5.1 `why: null`) and the UX restructure folder (`docs/superpowers/ux-restructure/`).

Owner decisions that shape this spec (`docs/DECISIONS.md`):

- 2026-10-13: D4 = "why it matters" reasons **from existing facts**. G1 stakes fields (a migration) stay gated.
- 2026-10-15: the reason **engine** is pure logic and is built now, in the interview gaps. Its **UI placement** waits for the restructured pages to be approved.
- 2026-10-15, interview Q1: the Inbox holds undecided tasks only. A dated task never sits there.
- M1 motion (`f7282f0`): taps 120–220ms, entrances 380–600ms, data 1.1–1.6s, reduced motion instant.

Design read: a daily planning tool for one owner on laptop and iPhone. Reasons are quiet, factual annotations, not alerts. Dials: variance 3 (this is a pattern, not a layout), motion 4, density 5.

---

## 1. Problem and goal

**Problem.** A task row shows a title, dates and a project. It never says why the task matters today. The owner has to hold the links in their head. Does this unblock something? Is the goal due soon? Did I promise it this morning? Today's data already knows these answers. The UI does not say them.

**Goal.** Give each task (and each habit on Today) one short, honest reason, built only from facts the app already stores:

- No AI, no guessing, no scoring model. Every reason is a rule over existing fields, and every rule is tested.
- No new field, no migration. G1 "stakes" stays gated. If a reason needs a field we do not have, it is out of scope (see §8).
- Real data only. No sample copy in the product. If no rule fires, show nothing.
- The same numbers as the rest of the app. Reasons reuse the helpers that drive the pills and badges (`isOverdueTask`, `deadlineIsSeriesAnchor`, `recurringTaskStatus`, `dependencyExecutionState`, `habitStreak`), so a reason can never contradict a pill.

**Non-goals.** Reordering tasks by importance. Notifications. Editing anything. Reasons are read-only labels.

---

## 2. Facts the engine may read

All exist today in the planner snapshot. Nothing here is new.

| Fact | Field(s) | Source |
|---|---|---|
| Deadline, Plan for, Reserved time | `tasks.dueLocalDate`, `scheduledLocalDate`, `plannedStartAt/EndAt` | tasks table |
| Lifecycle, Someday, won't do | `tasks.state`, `horizon`, `outcome`, `archivedAt` | tasks table |
| Goal and project links | `tasks.goalId`, `tasks.projectId`, `projects.goalId` | tasks, projects |
| Hard dependencies | `taskDependencies {taskId, dependsOnTaskId, dependencyType}` | `shared/dependencyPolicy.ts` |
| Goal dates and state | `goals.dueLocalDate`, `state`, `intentionKind`, `archivedAt` | goals |
| Goal milestones | `goalMilestones.goalId`, `dueLocalDate`, `state` | goalMilestones (linked to goals, **not** to tasks) |
| Project date, risk | `projects.dueLocalDate`, `riskLevel` (`none/watch/at_risk/blocked`), `riskNote`, `state` | projects |
| Today's plan commitment | `dailyPlans {localDate, state}` + `dailyPlanItems {taskId, state: committed…}` | `committedTaskPlans` in `shared/taskDrop.ts` |
| Earlier plan outcomes | `dailyPlanItems.state` = `rescheduled` / `deferred` on past plans | dailyPlanItems |
| Morning rollovers | `tasks.rescheduleCount` (incremented only by `applyMorningRollover`) | `server/planning.ts:686` |
| Weekly objectives | `weeklyObjectives {weekStartLocalDate, goalId, projectId, title, state}` (linked to goal or project, **not** to tasks) | weeklyObjectives |
| Recurring series and occurrences | `recurrenceRule`, `recurrenceAnchor`, `taskOccurrences` | `shared/taskRecurrence.ts` |
| Habit schedule, check-ins, goal link | `habits.frequency`, `schedule`, `goalId`; `habitCheckIns` | `shared/habitSchedule.ts`, `dashboardModel.habitStreak` |

---

## 3. Reason catalogue

### 3.1 Task reasons

Rank 1 is the strongest. Each reason belongs to a **family**. The engine keeps at most one reason per family (the best-ranked), so a task never says the same thing twice.

| Rank | Kind | Family | Trigger (exact) | Short copy (chip) | Long copy (detail, "because" line) | Tone | Icon (lucide) |
|---|---|---|---|---|---|---|---|
| 1 | `deadline_missed` | deadline | `isOverdueTask(task, today)` (already excludes a recurring series' anchor date) | `Overdue 1 day` / `Overdue N days` | `The deadline was yesterday.` / `The deadline was Mon 12 Oct, N days ago.` | off | `CalendarX2` |
| 2 | `deadline_soon` | deadline | open, has `dueLocalDate`, not `deadlineIsSeriesAnchor`, `0 ≤ days(today→due) ≤ 3` | `Due today` / `Due tomorrow` / `Due in N days` | `Due Fri 16 Oct.` Adds ` Not planned yet.` when there is no Plan for date or reservation on or before the deadline (same test as `deadlineRiskForTask`) | risk if ≤ 1 day, else neutral | `CalendarClock` |
| 3 | `unblocks` | blocking | `dependencyExecutionState(task.id).blocksIds` filtered to dependents that exist, are open and are not `wont_do`; count ≥ 1 | `Unblocks 1 task` / `Unblocks N tasks` | `“Send Fonterra application” is waiting on this.` / `N tasks are waiting on this, including “X”.` (X = the dependent with the earliest deadline, then title A–Z) | accent | `LockOpen` |
| 4 | `in_today_plan` | plan | a `dailyPlanItems` row with this `taskId`, `state = committed`, in a plan with `localDate = today` and `state` in `draft`/`active` | `On today's plan` | `You committed to this in today's plan.` | accent | `ClipboardCheck` |
| 5 | `milestone_soon` | goal | the task's resolved goal (§3.3) is active and has an open milestone with `0 ≤ days(today→due) ≤ 14`; nearest milestone wins | `Milestone in N days` / `Milestone today` | `Your goal “Land a graduate role” has a milestone, “10 applications sent”, due Fri 24 Oct.` | neutral | `Milestone` |
| 6 | `project_due` | project | task has an active project with `dueLocalDate` and `days(today→due) ≤ 14` (negative = passed) | `Project due in N days` / `Project due today` / `Project past its date` | `Part of “Job search sprint”, due Tue 20 Oct.` / `Part of “Job search sprint”, which passed its date on 10 Oct.` | risk if passed, else neutral | `FolderKanban` |
| 7 | `goal_due_soon` | goal | resolved goal is active, `intentionKind` is not `direction`, `0 ≤ days(today→goal due) ≤ 30` | `Goal due in N days` | `This supports “Land a graduate role”, due Mon 26 Oct.` | neutral | `Target` |
| 8 | `project_at_risk` | project | task's active project has `riskLevel` `at_risk` or `blocked`, or `state = blocked` | `Project at risk` / `Project blocked` | `“Job search sprint” is marked at risk.` Adds `: <riskNote>` (first 80 chars) when the owner wrote one | risk | `TriangleAlert` |
| 9 | `weekly_objective` | week | an objective with `today` in `[weekStartLocalDate, +6]`, `state = active`, not archived, whose `projectId` = task's project or whose `goalId` = task's resolved goal | `This week's aim` | `Part of this week's aim: “Send 5 applications”.` | accent | `Crosshair` |
| 10 | `carried_over` | history | `pushedBack = rescheduleCount + count(dailyPlanItems for this task, state rescheduled/deferred, plan localDate < today)`; show when ≥ 2 | `Pushed back N times` | `This has moved to a later day N times.` | risk | `History` |
| 11 | `recurring_today` | repeat | `recurringTaskStatus(...).kind === "pending_today"` | `Today's repeat` | `This repeats weekly, and today's one is still open.` (cadence from `recurrenceCadenceLabel`, lower-cased) | accent | `Repeat` |
| 12 | `goal_link` | goal | resolved goal is active and no other goal-family reason fired | `Supports a goal` | `This supports “Land a graduate role”.` | neutral | `Target` |

Notes on copy:

- **Short copy never names a record.** The row already shows the project or goal in its context chip. Names go in long copy only.
- Titles in long copy use curly quotes and are cut at 40 characters with `…`. The `accessible` string carries the full title.
- Day words: `today`, `tomorrow`, `in N days` (2–30). Long copy uses `weekdayDayMonthLabel` (`Fri 16 Oct`) or `dayMonthLabel` (`10 Oct`) from `shared/taskDateLabels.ts`. Never ISO dates.
- Plurals: `1 task`, `2 tasks`; `1 day`, `2 days`; `1 time` is never shown (threshold is 2).
- No exclamation marks, no "urgent", no "you should". Plain facts.

### 3.2 Habit reasons (Today rows and the habit detail)

| Rank | Kind | Family | Trigger | Short | Long | Tone | Icon |
|---|---|---|---|---|---|---|---|
| 1 | `streak_at_risk` | streak | habit not archived, scheduled today (`isHabitScheduledOnLocalDate`), today unrecorded, `habitStreak(habit, checkIns, today, today − 27) ≥ 3` | `N-day streak` (`28+ day streak` at the window cap) | `You have an N-day streak. Doing it today keeps it going.` | accent | `Flame` |
| 2 | `week_target` | target | `frequency = times_per_week`, target from `habitWeeklyTarget`, `remaining = target − completed this week > 0`, `remaining ≥ daysLeft` (days from today to week end, today included) | `N more, N days left` | `Your target is 3 this week. 1 done, 2 days left.` | risk when `remaining = daysLeft`, else neutral | `CalendarRange` |
| 3 | `habit_gap` | gap | scheduled today, today unrecorded, last `completed` check-in is ≥ 7 days ago (or none within 60 days and the habit is older than 7 days) | `Last done N days ago` | `Last done Tue 6 Oct, N days ago.` | neutral | `Hourglass` |
| 4 | `habit_goal` | goal | `habit.goalId` resolves to an active goal | `Supports a goal` | `This supports “Get fit”.` | neutral | `Target` |

The streak uses the same 28-day window as the Dashboard, so both show the same number.

### 3.3 Resolving the goal

`resolvedGoal = active(task.goalId) ?? active(project(task.projectId).goalId) ?? null`

"Active" means the record exists in the facts, `state` is not `completed`/`archived`, and `archivedAt` is empty. A missing or finished goal is skipped silently. The engine never prints an id or "Unknown goal".

### 3.4 When to show NOTHING

The engine returns `[]` when any of these is true:

1. The task is `completed` or `archived`, has `archivedAt`, or has `outcome = wont_do`.
2. The habit is archived, or today's check-in is already recorded (done, skipped or missed).
3. The timezone is not a valid IANA zone (the engine will not guess a "today").
4. No rule fires. Nothing is better than filler. There is no "Just a task" or generic copy.

Narrower rules:

- **Someday tasks:** only `unblocks` may fire. Someday is a decision to park the task, and the engine respects it.
- **Recurring series:** deadline reasons never use the series anchor date. `carried_over` still counts.
- **Stale data:** when `facts.snapshotAt` falls on a local day before `today`, drop the reasons that depend on today's state: `in_today_plan`, `recurring_today`, `streak_at_risk`, `week_target` and `habit_gap`. Date and link reasons are still true, so they stay.
- **Dependents or projects missing from the facts** are ignored. They never count, and they are never named.

### 3.5 Per-surface limits and suppression

The engine returns every reason, ranked. `reasonsForSurface` then drops the duplicates that each surface already shows, and caps the count.

| Surface | Max | Suppressed (already visible there) | Copy used |
|---|---|---|---|
| `task_row`: List row and Board card (`why` slot) | 1 | `deadline_missed`, `deadline_soon` (the date pill), `recurring_today` (occurrence pill), `goal_link` (context chip) | short |
| `inbox_triage`: triage card | 1 | none | short |
| `task_detail`: "Why" section in the side pane / sheet | 3 | none | long |
| `today_row`: Today / Plan "because" line | 1 | `in_today_plan`, `recurring_today` (every row there is on today's plan) | long, single line, truncates |
| `dashboard_up_next`: hint on the Up Next card | 1 | `in_today_plan` | short |
| `habit_row`: habit on Today | 1 | none | short |

The order inside a surface is always rank order. Ties cannot happen (one reason per kind).

---

## 4. Engine contract

### 4.1 Files

| File | What |
|---|---|
| `shared/whyItMatters.ts` | The pure engine: types, `whyItMatters`, `reasonsForSurface`, `WHY_WINDOWS`. Imports only from `shared/`. |
| `server/whyItMatters.test.ts` | Vitest unit tests. This follows the repo convention: `shared/x.ts` is tested in `server/x.test.ts` (see `server/taskBuckets.test.ts`; `vitest.config.ts` includes `server/**/*.test.ts`). |
| `shared/habitStreak.ts` | `habitStreak` moved out of `client/src/features/dashboard/dashboardModel.ts` unchanged (it uses `shiftLocalDate` from `shared/taskRecurrence.ts`). `dashboardModel.ts` re-exports it, so `dashboardModel.test.ts` passes unchanged. `shared/` cannot import `@/`, which is why it moves. |
| `client/src/features/why/whyFacts.ts` (+ `.test.ts`) | Adapter: planner snapshot → `WhyFacts`, memoised per snapshot. Layout-independent, so it may be built with the engine. |

### 4.2 Types and signatures

```ts
import type { DependencyEdge } from "./dependencyPolicy";
import type { TaskOccurrenceLike } from "./taskRecurrence";
import type { CalendarHabit } from "./habitSchedule";

type DateValue = Date | string;

export type WhyTask = {
  id: string; title: string; state: string;
  horizon?: string | null; outcome?: string | null; archivedAt?: DateValue | null;
  goalId?: string | null; projectId?: string | null;
  dueLocalDate?: string | null; scheduledLocalDate?: string | null;
  plannedStartAt?: DateValue | null; plannedEndAt?: DateValue | null;
  recurrenceRule?: unknown; recurrenceAnchor?: string | null; recurrenceUntilLocalDate?: string | null;
  rescheduleCount?: number | null; createdAt?: DateValue | null;
};

export type WhyHabit = CalendarHabit & {
  id: string; name: string; goalId?: string | null; archivedAt?: DateValue | null; createdAt?: DateValue | null;
};

export type WhyEntity = { kind: "task"; task: WhyTask } | { kind: "habit"; habit: WhyHabit };

export type WhyFacts = {
  /** Every task, finished ones included: dependency state needs them. */
  tasks: readonly WhyTask[];
  goals: readonly { id: string; title: string; state: string; intentionKind?: string | null; dueLocalDate?: string | null; archivedAt?: DateValue | null }[];
  milestones: readonly { id: string; goalId: string; title: string; state: string; dueLocalDate?: string | null; archivedAt?: DateValue | null }[];
  projects: readonly { id: string; title: string; state: string; goalId?: string | null; dueLocalDate?: string | null; riskLevel?: string | null; riskNote?: string | null; archivedAt?: DateValue | null }[];
  dependencies: readonly DependencyEdge[];
  occurrences: readonly TaskOccurrenceLike[];
  dailyPlans: readonly { id: string; localDate: string; state: string }[];
  dailyPlanItems: readonly { dailyPlanId: string; taskId: string; state: string }[];
  weeklyObjectives: readonly { id: string; title: string; state: string; weekStartLocalDate: string; goalId?: string | null; projectId?: string | null; archivedAt?: DateValue | null }[];
  habitCheckIns: readonly { habitId: string; localDate: string; state: string }[];
  /** When the snapshot was fetched. Missing = treat as fresh. */
  snapshotAt?: DateValue | null;
};

export type WhyReasonKind =
  | "deadline_missed" | "deadline_soon" | "unblocks" | "in_today_plan" | "milestone_soon"
  | "project_due" | "goal_due_soon" | "project_at_risk" | "weekly_objective" | "carried_over"
  | "recurring_today" | "goal_link"
  | "streak_at_risk" | "week_target" | "habit_gap" | "habit_goal";

export type WhyFamily = "deadline" | "blocking" | "plan" | "goal" | "project" | "week" | "history" | "repeat" | "streak" | "target" | "gap";
export type WhyTone = "off" | "risk" | "accent" | "neutral";
export type WhyIcon = "CalendarX2" | "CalendarClock" | "LockOpen" | "ClipboardCheck" | "Milestone" | "FolderKanban"
  | "Target" | "TriangleAlert" | "Crosshair" | "History" | "Repeat" | "Flame" | "CalendarRange" | "Hourglass";
export type WhyRef = { kind: "task" | "goal" | "project" | "milestone" | "weekly_objective" | "daily_plan" | "habit"; id: string };

export type WhyReason = {
  kind: WhyReasonKind;
  family: WhyFamily;
  /** 1 = strongest. Fixed per kind (tables in §3). */
  rank: number;
  tone: WhyTone;
  /** A lucide-react export name. The UI maps it; the engine stays free of React. */
  icon: WhyIcon;
  /** Chip copy, about 24 characters or fewer, never names a record. */
  short: string;
  /** Sentence for detail and "because" lines; titles cut at 40 characters. */
  long: string;
  /** Full sentence with full titles, for screen readers and tooltips. */
  accessible: string;
  /** What a tap on the detail tile opens, or null. */
  ref: WhyRef | null;
  /** The numbers behind the copy, for tests and debugging. */
  basis: { days?: number; count?: number; localDate?: string };
};

export type WhySurface = "task_row" | "inbox_triage" | "task_detail" | "today_row" | "dashboard_up_next" | "habit_row";

/** Tunable windows. Exported so tests and a later owner tweak use one source. */
export const WHY_WINDOWS = {
  deadlineSoonDays: 3,
  milestoneDays: 14,
  projectDays: 14,
  goalDays: 30,
  carriedOverMin: 2,
  streakMin: 3,
  streakLookbackDays: 28,
  habitGapDays: 7,
  titleMax: 40,
  riskNoteMax: 80,
} as const;

/**
 * All reasons for one task or habit, best first, at most one per family.
 * `today` = localDateForInstant(now, timezone). Pure and deterministic: same inputs, same output.
 * Returns [] for finished work, an archived habit, an invalid timezone, or when no rule fires.
 */
export function whyItMatters(entity: WhyEntity, facts: WhyFacts, now: Date, timezone: string): WhyReason[];

/** Drops what the surface already shows (§3.5), then keeps the first N. */
export function reasonsForSurface(reasons: readonly WhyReason[], surface: WhySurface): WhyReason[];

/** Convenience: the single reason a one-line surface shows, or null. */
export function topReason(entity: WhyEntity, facts: WhyFacts, now: Date, timezone: string, surface: WhySurface): WhyReason | null;
```

### 4.3 Rules for the build

- **Pure.** No tRPC, no React, no `Date.now()`, no `Intl` default zone. `now` and `timezone` are the only clock inputs. The caller passes `safeTimeZone(workspace.timezone)`, exactly as the pages do, so "today" matches the rest of the app.
- **Timezone-aware.** Reservation days use `localDateForInstant` and `reservedLocalDate`. A local date string is never sliced from a UTC ISO string. Test fixtures use `Pacific/Auckland`, including a case near NZ midnight and one across the DST change (5 Apr 2026, 27 Sep 2026).
- **Fast.** Lists call this once per row. The engine builds lookup maps (tasks by id, dependents by task, plans by id, objectives by week) once per `facts` object and caches them in a module `WeakMap<WhyFacts, Index>`. The cache never changes the output. 500 tasks must stay well under 16ms in total.
- **Reuse, don't re-derive.** Use `isOverdueTask`, `hasMissedDeadline`, `deadlineIsSeriesAnchor`, `overdueDays` (`shared/taskBuckets.ts`), `deadlineRiskForTask` (`shared/planningForecast.ts`), `recurringTaskStatus`, `recurrenceCadenceLabel`, `shiftLocalDate` (`shared/taskRecurrence.ts`), `dependencyExecutionState` (`shared/dependencyPolicy.ts`), `localDaysBetween`, `weekdayDayMonthLabel`, `dayMonthLabel` (`shared/taskDateLabels.ts`), `isHabitScheduledOnLocalDate`, `habitWeeklyTarget` (`shared/habitSchedule.ts`), `habitStreak` (`shared/habitStreak.ts`).
- **Week bounds for `week_target`:** the same Monday-start week as `weekStartFor` in `client/src/features/planning/planBoard.ts`. The engine re-implements that three-line rule in `shared/` (or the build moves it there with a re-export), so the client and the engine cannot drift.

### 4.4 Test cases (`server/whyItMatters.test.ts`)

Fixed clock: `now = 2026-10-15T09:00:00+13:00`, timezone `Pacific/Auckland`, so `today = 2026-10-15` (a Thursday).

1. Open task, deadline 2026-10-12 → `deadline_missed`, short `Overdue 3 days`, long names `Mon 12 Oct`.
2. Deadline yesterday → `Overdue 1 day` and `The deadline was yesterday.`
3. Deadline today, no plan → `deadline_soon` `Due today`, long ends `Not planned yet.`, tone risk.
4. Deadline in 3 days with Plan for on the deadline → `Due in 3 days`, no "Not planned yet", tone neutral.
5. Deadline in 4 days → no deadline reason.
6. Task blocks 2 open tasks and 1 completed task → `Unblocks 2 tasks`; long names the dependent with the earliest deadline.
7. Task blocks a dependent missing from `facts.tasks` → no `unblocks`.
8. Soft dependency only → no `unblocks`.
9. Committed in today's active plan → `in_today_plan`. The same item in yesterday's plan → nothing.
10. Committed in today's archived plan → nothing.
11. Goal with an open milestone due in 9 days → `milestone_soon` `Milestone in 9 days`. Goal due in 20 days on the same goal → only the milestone shows (one per family).
12. Goal link through the project only (`task.goalId` null, `project.goalId` set) → goal reasons resolve through the project.
13. `task.goalId` points to a goal not in the facts → no goal reason, no crash, no id in any string.
14. Linked goal is completed → no goal reason, including no `goal_link`.
15. Direction goal (`intentionKind = direction`) with a due date → no `goal_due_soon`; `goal_link` still fires.
16. Project due 2026-10-10 → `project_due` `Project past its date`, tone risk. Project `riskLevel = at_risk` as well → only one project-family reason (the date wins on rank).
17. Project `riskLevel = watch` → no `project_at_risk`.
18. Active weekly objective for the week of 2026-10-12 on the task's project → `weekly_objective`. The same objective for the previous week → nothing.
19. `rescheduleCount = 1` plus one past plan item `deferred` → `Pushed back 2 times`. `rescheduleCount = 1` alone → nothing.
20. Recurring daily task with today's occurrence pending → `recurring_today`; the deadline set to the series anchor in the past → no `deadline_missed`.
21. Recurring task with today's occurrence completed → no `recurring_today`.
22. Completed task with every trigger set → `[]`.
23. Archived task, and a task with `outcome = wont_do` → `[]`.
24. Someday task that blocks one task and is linked to a goal due in 10 days → only `unblocks`.
25. Stale facts: `snapshotAt` = yesterday NZ time, task committed in today's plan → no `in_today_plan`; its `deadline_soon` still shows.
26. Invalid timezone `"Mars/Base"` → `[]`.
27. NZ midnight edge, deadline 2026-10-16: `now = 2026-10-15T23:30:00+13:00` gives `Due tomorrow`, and `now = 2026-10-16T00:30:00+13:00` gives `Due today`. In UTC both instants are on 2026-10-15, which proves the engine is not using UTC days.
28. Reservation edge: `plannedStartAt = 2026-10-15T11:30:00Z` (00:30 NZ on 16 Oct) counts as a plan on 16 Oct for the "Not planned yet" test.
29. Habit, 5-day streak, scheduled today, unrecorded → `streak_at_risk` `5-day streak`. Today already completed → `[]`.
30. Habit streak equal to the 28-day window → `28+ day streak`, and the number equals `dashboardModel` for the same input.
31. Habit `times_per_week` target 3, 1 done. With `now` on Sat 17 Oct (2 days left) → `week_target` `2 more, 2 days left`, tone risk. On Thu 15 Oct (4 days left) → no `week_target`.
31a. DST: a reservation at `2026-09-26T14:01:00Z` (03:01 NZDT on 27 Sep, just after the clocks change) falls on local day 2026-09-27.
32. Habit last completed 9 days ago, scheduled today → `habit_gap` `Last done 9 days ago`.
33. Archived habit → `[]`.
34. `reasonsForSurface(task_row)` drops deadline, repeat and goal-link reasons, keeps 1. `task_detail` keeps 3 in rank order.
35. Copy rules: no string contains an ISO date, `undefined`, `null`, an em dash or a record id. Titles over 40 characters end with `…` in `long` and are whole in `accessible`.
36. Determinism: two calls with the same inputs deep-equal; shuffling `facts` arrays does not change the output.

---

## 5. UI patterns (placement provisional)

The restructure interviews decide which pages exist. The patterns below are fixed. Where each pattern lands is not. If, say, Today and Plan › Daily merge, the "because" line goes on the merged rows.

### 5.1 Inline reason chip (task rows, Board cards, Inbox triage card)

```
○  Tailor CV for the Fonterra graduate role
   [Today 09:15-10:30]  [Due Fri, not planned]  ▣ Job search sprint   (🔓 Unblocks 2 tasks)
                                                                       └ why slot, last in the pill row
```

- Fills the existing `why` slot in `TaskCardModel` (D3 §5.1). The type changes from `null` to `WhyReason | null`, filled with `topReason(..., "task_row")`.
- It reuses the D0 `Pill` (radius `--pc-r-chip` 8px, 22px tall). Tone soft background and tone ink text: `off` → `--pc-off-soft`/`--pc-off`, `risk` → `--pc-risk-soft`/`--pc-risk`, `accent` → accent soft/ink, `neutral` → `--pc-cat-neutral-soft`/`--pc-cat-neutral-ink`. Reasons never use category colours, so they cannot be mistaken for a category.
- Leading icon at 12px, `strokeWidth={2}` (the app's lucide weight), `aria-hidden`. **Colour always comes with a word.** The chip is never icon-only.
- Max width 24ch with ellipsis. `title` carries `accessible`.
- **Not a button.** A tap on the row opens the detail, where the reason is tappable. This avoids a nested button inside a row button and keeps phone targets clear.
- On the phone the pill row wraps. The chip goes to a second line before it ever truncates the title.

### 5.2 "Why" section in the task detail (side pane on desktop, sheet on phone)

```
┌ Task ──────────────────────────────── [✕ Close] ┐
│ (◐ In progress ▾)  ▣Work  ▤Job search sprint     │
│ Tailor CV for the Fonterra graduate role         │
│ [▶ Start focus]  [✓ Complete]                    │
│                                                  │
│ Why it matters                                   │
│ [🔓] “Send Fonterra application” is waiting  (→) │  tinted 28px tile + sentence + open
│      on this.                                    │
│ [◎]  You committed to this in today's plan.      │
│ [▣]  Part of “Job search sprint”, due Tue 20 Oct.(→)│
│ [▦] Plan …                                       │
```

- It sits where D3 §4.7 reserved the slot: under the action row, above Plan.
- Up to 3 rows. Each row: a 28px tile (tone soft fill, radius 8, 16px icon in tone ink), then `long` at body size (14/20, ink), then an arrow-in-circle "open" control when `ref` is set (opens the goal, project or dependent task in place). The whole row is the hit target, at least 44px tall.
- The heading "Why it matters" is plain sentence case. No uppercase eyebrow.
- **Empty state** (open, non-Someday task, no reasons): one muted line, `Not linked to a goal or project yet.`, plus a text button `Link to a goal` that opens the existing goal picker in the same sheet. Linking is the only owner action that creates reasons, so this is the one honest next step. Done, archived and Someday tasks hide the section entirely. (Owner question 2.)

### 5.3 Today / Plan "because" line

```
○  09:15  Tailor CV for the Fonterra graduate role            75m
          🔓 2 tasks are waiting on this, including “Send Fo…”
```

- One line under the title, 13px, `--pc-ink-muted` text (checked for ≥ 4.5:1), 14px icon in tone ink. Uses `long` copy, truncated to one line. The full text is in `title` and `aria-describedby`.
- No literal "Because" prefix. The icon and the sentence carry it.
- `in_today_plan` and `recurring_today` are suppressed here (§3.5).

### 5.4 Dashboard hint

- Only on the Up Next hero card (the filled blue card): one line under the title, `--pc-on-night-muted` ink, 14px icon, `short` copy. For example: `🔓 Unblocks 2 tasks`.
- No other Dashboard card gets reasons. The Dashboard is the quality bar and stays calm. One hero, one hint.

### 5.5 Habit rows on Today

- Same as the inline chip, `habit_row` surface, one reason. `Flame` + `5-day streak` is the common case.

### 5.6 Motion (M1)

| Moment | Motion | Timing |
|---|---|---|
| Rows and cards render | The chip is part of the row. It enters with the row's existing `pc-rise` stagger; it has no animation of its own | entrance 480ms, `--pc-ease`, 70ms stagger, capped at 8 |
| Detail "Why" rows | `pc-rise`, staggered after the action row | 480ms, 70ms stagger, cap 3 |
| A reason changes (for example, you commit the task and `On today's plan` appears) | Crossfade old to new chip; no width animation, no layout jump | 160ms (`--pc-dur-fast`) |
| A reason disappears (task completed) | Fades with the row's done state | 200ms (`--pc-dur-exit`) |
| Tap a detail row | Press scale 0.97 | 120ms (`--pc-dur-press`) |
| Dashboard hint | Fades in after the hero title | 480ms, after `--pc-data-delay` 260ms |
| Reduced motion | All of the above are instant. Content is visible by default; motion only enhances it | 0ms |

No pulse, no shimmer, no attention loops. A reason is information, not an alarm.

### 5.7 Accessibility

- Text first: every reason is a real word. Colour and icon only repeat it.
- Row accessible name: `<title>, <date pills>, why: <accessible>`. Screen readers get the full sentence with full titles.
- The detail section is `<section aria-labelledby="why-heading">` with a `<ul>`. Rows with a `ref` are buttons named by `accessible` plus `, open <kind>`.
- No `aria-live` on reasons. They change as a side effect of the owner's own action, and announcing them would be noise.
- Contrast: tone ink on tone soft meets 4.5:1 in light and dark (D0 tokens). The build checks `--pc-cat-neutral-ink` on `--pc-cat-neutral-soft` in dark mode explicitly.
- Touch: detail rows ≥ 44px. The inline chip is not a target.

### 5.8 Empty, loading, error

- **Loading:** reasons need the snapshot, which the row already needs. There is no separate skeleton. The slot stays empty until data arrives, and the row height does not depend on the chip.
- **No reasons:** nothing on rows, the Today line or the Dashboard. The detail uses the empty line in §5.2.
- **Engine error:** the engine is pure and must not throw. A thrown error in the adapter is caught per row and renders nothing, and it is logged in dev only.

---

## 6. Build split

| Step | Who | When | Output | Done when |
|---|---|---|---|---|
| E1 | Opus | Now (interview gap) | `shared/habitStreak.ts` (moved, re-exported from `dashboardModel.ts`) | `dashboardModel.test.ts` passes unchanged |
| E2 | Opus | Now | `shared/whyItMatters.ts` + `server/whyItMatters.test.ts` (all 36 cases in §4.4) | `pnpm vitest run server/whyItMatters.test.ts` green; `pnpm check` clean |
| E3 | Opus | Now | `client/src/features/why/whyFacts.ts` + `whyFacts.test.ts` (snapshot → `WhyFacts`, memoised) | Adapter test with a demo-shaped snapshot; no UI file touched |
| U1 | Opus | After the owner approves the restructured Tasks pages | `WhyChip`, wired through `TaskCardModel.why` (type changes from `null` to `WhyReason \| null`) | D3 card and row tests updated; screenshots at 1440 and 390, light and dark |
| U2 | Opus | Same approval | `WhySection` in the task detail, with the empty state and links | Keyboard and screen-reader pass; reduced motion checked |
| U3 | Opus | After Today/Plan approval | "Because" line on Today rows, habit chips | Screenshots, both themes |
| U4 | Opus | After Today/Plan approval | Dashboard Up Next hint | Dashboard tests still pass; visual check against D2 |

Rules for every step:

- E1–E3 touch no page, no shell file and no D3.5 hook file. Another agent is building D3.5 hooks in `client/src/features/shell/`, so stay out of it.
- No schema, no migration, no live DB write. All of this is read-only over the snapshot.
- Each step ends with: tests run and results, `pnpm check`, files changed, and remaining risks (AGENTS.md completion rules).

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| **Noise.** Every row gets a chip and the list feels busy. | 1 per row. Pill duplicates suppressed. Strict thresholds (2+ push-backs, 3+ day streak, 3-day deadline window). Many rows will show nothing, and that is correct. |
| **A reason contradicts a pill or badge.** | The engine calls the same helpers as the pills (§4.3). Test 20 locks the recurring anchor case. Test 30 locks the streak against the Dashboard. |
| **Stale snapshot after the phone sleeps overnight.** | The stale rule (§3.4) drops today-state reasons. "Today" comes from `now`, not the snapshot. |
| **Wrong day near NZ midnight or across DST.** | Tests 27 and 28. Local dates come from `localDateForInstant` only. |
| **The workspace timezone column defaults to `UTC`** in `drizzle/schema.ts`. If the owner's workspace were still UTC, every "today" in the app would be wrong, reasons included. | Not a D4 bug, but D4 makes it visible. Owner question 7 (read-only check). |
| **Copy reads like nagging.** | Facts only. No "urgent", no "should", no exclamation marks. The copy self-audit is test 35 plus a read-through at U1. |
| **Performance on long lists.** | One index per snapshot (WeakMap). O(1) lookups per row. A budget test of 500 tasks in E2. |

## 8. Known limits (honest scope)

- **Milestones and weekly objectives link to goals and projects, not tasks.** The copy says "your goal has a milestone" and "part of this week's aim". It never claims "this task counts toward the milestone".
- **"Pushed back" only sees two kinds of move:** morning rollovers (`rescheduleCount`) and plan items resolved as rescheduled or deferred. Editing the Plan for date by hand is not recorded anywhere, so it is not counted. Fixing that needs a field, which is a G1-style gate.
- **No "stakes".** "Why this matters to me" in the owner's own words is G1 (gated migration). D4 never invents it.
- **Priority is not a reason.** It is the owner's own label, and the row already shows the flag.
- **Recurring slippage** ("missed 3 of the last 5") is derivable from occurrences, but it is left out of v1 to keep the catalogue small. It is a candidate for D5.
- **Projects and goals get no reasons of their own** in v1. Their pages are still being restructured. The engine's entity union can grow later.

---

## 9. Owner questions (for the grill-me interview, one at a time)

> **ANSWERED 2026-10-16** (interview log Q42–Q49). All recommendations accepted except Q7: **the owner checks the timezone personally**, and agents do not read or change it. Mapping: 1→Q42, 2→Q43, 3→Q44, 4→Q45, 5→Q46, 6→Q47, 7→Q48, 8→Q49.

1. **Should "Supports a goal" ever show on task rows?**
   **Recommended: no.** It shows only in the detail and on the Inbox triage card. The row's context chip already names the goal or project, so the chip would repeat it on every linked row.

2. **When a task has no reasons, what should the detail's "Why" section show?**
   **Recommended:** one quiet line, "Not linked to a goal or project yet", with a "Link to a goal" button, for open tasks that are not Someday. Hide it for done and Someday tasks. Linking is the only action that creates reasons.

3. **Show "Pushed back N times", and from what count?**
   **Recommended: yes, from 2, in the amber "risk" tone, with the neutral word "pushed back".** It is the most honest signal the app has that a task keeps slipping. One move is normal life.

4. **What windows count as "soon"?**
   **Recommended:** deadline 3 days, milestone 14, project 14, goal 30, streak from 3 days. Keep them in `WHY_WINDOWS` and tune them after a week of real use.

5. **Should Someday tasks show any reason?**
   **Recommended:** only "Unblocks N tasks", because parking a task that holds up others is worth knowing. Nothing else, out of respect for the Someday decision.

6. **On the Dashboard, should reasons appear anywhere other than the Up Next card?**
   **Recommended: no.** One hint, on the hero only. The Dashboard is the quality bar, and it stays calm.

7. **Is your workspace timezone set to Pacific/Auckland?** The database default is UTC.
   **Recommended:** Opus checks Settings read-only on the demo and tells you. No code or data change. Every "today" in the app depends on it.

8. **When the restructure merges pages (for example Today with Plan › Daily), should the "because" line follow the rows to their new home?**
   **Recommended: yes.** The patterns in §5 are fixed; placement follows the approved pages. No new prototype round is needed just for reasons.
