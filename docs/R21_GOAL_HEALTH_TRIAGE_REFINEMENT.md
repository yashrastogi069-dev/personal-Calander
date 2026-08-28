# R21 Goal Health Triage Refinement

**Status:** Implemented and under final validation on `dev/personal-calendar-workbench` only.  
**Scope:** This refinement is deliberately limited to filtering existing, factual goal-health evidence. It creates no tasks, reviews, reminders, integrations, scores, or hidden records.

## Design Read

> Reading this as a decision-dense personal planning workspace for one person managing several time horizons, with a calm verdigris language and low-motion, high-clarity interaction.

The Goal runway already derives progress from visible work, milestones, child goals, and completed reviews. Its constraint was not more analytics; it was helping a person locate the small subset of active goals that deserve a decision when their planning system grows. The refined control is therefore a compact, factual triage surface rather than a new dashboard, artificial score, or automatic replanning feature.

| Product finding | Applied decision |
|---|---|
| Goals are more useful when work, milestones, and progress live in a connected system. [1] | Reuse the established `longHorizon` contract instead of re-computing, copying, or storing goal-health data in the client. |
| Weekly objectives should be bounded outcomes, not a large task list, and can align supporting work. [2] | Show missing execution evidence distinctly; the existing task, project, habit, and weekly-objective flows remain the only way to add work. |
| Long-term direction should be revisited against current work so it does not become a set-and-forget list. [3] | Add a clearly named **Needs attention** view, limited to overdue, behind-pace, or review-due evidence. |
| Large goal collections need focused views without removing the underlying record set. [1] | Preserve **All goals**, disclose counts, cap the initial visual card set at six, and provide an explicit **Show all N goals** control when needed. |

## Interaction Contract

The triage operates on active, non-archived goals that are already present in the Goal runway. It has four visible, keyboard-operable filters. Each uses `aria-pressed`, resets the optional initial-card cap when changed, and has a short explanation of the evidence it uses. A filter that finds nothing renders an explicit status message and directs the person to another view rather than suggesting data was deleted.

| Filter | Inclusion rule | Intended next decision |
|---|---|---|
| **All goals** | Every active goal | Inspect the complete runway. |
| **Needs attention** | Overdue, behind pace, or review due | Review the plan, deadline, or next move. |
| **Needs work** | No active linked project, task, or habit | Add the smallest real execution link through existing flows. |
| **Needs milestone** | Has a date but no milestone or child-goal runway evidence | Add a dated milestone only when it represents real proof. |

Status language remains plain and visible: **Overdue**, **Behind pace**, **Review due**, **Ahead**, or **On pace**. It is based on existing evidence; the refinement does not present a synthetic health percentage. The control follows the Verdigris Daylight system: a compact green-tinted decision surface, dark green selected state, responsive two-column phone layout, visible focus, and short tactile feedback only on intentional button presses.

## Validation Evidence

Automated validation added `server/goalHealthTriage.test.ts` to cover factual attention classification, the distinction between missing work and missing dated-milestone evidence, and safe treatment of unknown health records. The focused test passes. The complete suite passed with **37 files and 134 tests**. `pnpm check` passed, and `pnpm build:client` passed with the main client bundle at **1,410.41 kB / 369.81 kB gzip**. The existing legacy Home shell remains the principal bundle opportunity; this small refinement did not introduce another route or a duplicate data model.

Browser acceptance used one clearly named disposable goal, **QA Goal Triage 20260828**, created through the existing goal planner with an explicit start date and deadline. At phone width, the rendered control showed all four labeled filters, their counts, `aria-pressed` state, the selected-view explanation, and the existing linked-work recovery guidance. The **Needs work** filter was activated and retained the factual card. Desktop inspection confirmed the filter group remains a one-line compact control rather than turning the runway into a second dashboard. The browser console reported **zero errors and zero warnings** during this controlled run. Targeted cleanup deleted only the disposable goal by its verified ID and workspace ID; a final exact-name/ID query returned **zero remaining rows**.

## Non-Goals and Boundaries

This work does not add automatic dynamic replanning, calendar writes, external calendar fetches, OAuth, collaborative goal ownership, scheduled actions, reminders, timers, browser-side secret handling, or changes to habit cadence. Habits remain a dedicated rhythm tracker; their goal linkage is read only as execution evidence.

## References

[1]: https://help.asana.com/s/article/get-started-with-asana-goals "Asana Help Center — Get started with Asana Goals"
[2]: https://help.sunsama.com/docs/usage-guides/weekly-objectives/ "Sunsama User Manual — Weekly Objectives"
[3]: https://www.todoist.com/inspiration/goals-todoist "Todoist Inspiration — 7 Ways to Set and Track Your Goals in Todoist"
