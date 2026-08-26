# Major Experience Redesign Audit

> **Design read:** an operate-first personal planning system for one person making daily trade-offs, with a precise instrument-like language, a cold mineral palette, and purposeful asymmetry rather than wellness-dashboard softness.

## Observed issues

| Area | Evidence from current desktop and phone renders | Redesign response |
| --- | --- | --- |
| Hierarchy | The Today heading, immediate commitment, signal, queue, utilities, calendar, goals, habits, capacity, and analytics all compete as pale bordered surfaces. | Establish a dominant **day command surface**, a secondary **time field**, and quiet contextual rails. Use open layout and divider rhythm for utilities rather than equal cards. |
| Color and material | The mint-white surfaces blend together; decisive actions and active states do not carry enough contrast or identity. | Replace the washed palette with a slate-mineral base, a deep ink foundation, and a controlled vivid signal color reserved for commitments and irreversible state changes. |
| Controls | Important actions are distributed across card headers, inline rows, small text links, and full buttons. Their size and placement do not consistently predict importance. | Introduce a three-tier action system: command buttons, context actions, and quiet utility actions. Each placement will follow the object it changes. |
| Layout | The current desktop reads as stacked generic dashboard cards; the phone preserves the same long vertical sequence. | Use an intentional editorial workbench: one commanding decision column, one temporal field, and smaller link-to-horizon artifacts. Phone becomes a vertical sequence with clear stage changes rather than mini desktop cards. |
| Artifacts | Capacity, momentum, goal runway, and habit rhythm are technically present but visually small or empty enough to feel ancillary. | Turn them into useful planning artifacts: an attention budget, directional runway, rhythm ledger, and review pulse, all driven by existing real data and empty states. |
| Identity | Small generic mark, modest type contrast, and repeated rounded containers produce an average productivity-app impression. | Add a more assertive typographic system, a compact time-mark identity, a coherent corner-radius rule, and one distinctive navigational signature without fabricating brand claims. |

## Non-negotiable preservation

The redesign will retain task lifecycle, goals, projects, categories, task-only Calendar, dedicated habit calendar/tracker, reviews, analytics, offline capture/replay, private iCalendar, device controls, manual push test, and the currently paused automatic reminder-delivery boundary. The mobile route inventory remains Today, Tasks, Calendar, Goals, Habits, and Review; any information-architecture change must preserve reachability and keyboard/touch access.

## Proposed operating-system artifacts

| Artifact | Existing truth it uses | User job |
| --- | --- | --- |
| **Attention ledger** | Planned minutes, capacity, task state | Decide whether today has room before committing more work. |
| **Focus cue** | Today’s tasks, priority, scheduled date | Make the single next deliberate action unmistakable. |
| **Horizon link** | Goals, milestones, projects, habits | Connect today’s work to direction without treating goals as a separate dashboard. |
| **Rhythm ledger** | Habit schedule and check-ins | Show consistency and intentional skips as a physical, readable trace. |
| **Review pulse** | Completion trend, category load, review state | Turn historical metrics into a compact prompt for the next planning decision. |

## Verified cross-route audit

The managed preview was inspected without modifying workspace data. **Today** currently exposes capture, task focus, a daily check-in, saved-view triage, recurring work, planning health, decision signals, private calendar feed actions, phone-device actions, AI drafting, time canvas, goals, habits, capacity, and analytics in one route. Each capability works and is meaningful, but the visual treatment currently makes this long list read as one administrative form rather than a sequence of planning decisions.

**Tasks** has the appropriate behaviors—search, All/Today/At risk filtering, draggable rows, completion, priority, subtasks, editing, and the global creation flow—but its present surface is a small toolbar followed by a low-density list inside an oversized generic card. The redesign must let the task inventory become a purposeful workbench: search and view controls anchored together, a readable state count, stronger row rhythm, and obvious edit/plan actions without hiding them behind decoration.

| Route | Current operational strength | Design deficit to correct |
| --- | --- | --- |
| Today | Complete system visibility and direct capture | Too much information competes before the user has chosen a current commitment. |
| Tasks | Correct filters, search, row actions, and drag-to-plan behavior | Inventory lacks an identifiable working posture and collapses into unused empty canvas. |
| Calendar | Dedicated task/time-block semantics and multiple time views | Needs a stronger temporal-field identity and clearer context when switching scale. |
| Goals | Explicit runway, milestone, project, and evidence logic | Needs a strategy-map composition rather than a nested progress-card arrangement. |
| Habits | Current-day actions, trace, and dedicated calendar are functionally strong | Needs to inherit the new material system while retaining its current rhythm-first hierarchy. |
| Review | Facts, recurring outcomes, and reflection logic are separated correctly | Needs to feel like a closing ritual with one clear decision path rather than a secondary dashboard. |

## First redesign-batch evidence

The first Mineral Workbench render was captured at **1440×1000** and **390×844** after rebuilding the static managed-preview artifact. The active state is now visibly distinct from the prior pale-sage dashboard: the navigation selection and primary command use calibrated copper, the schedule has a blue temporal field, goals/habits use related but separate directional materials, and primary/captured actions have a stronger placement hierarchy. The phone capture confirms that the command button, quick capture, current commitment, daily signal, disclosure rows, time field, direction, rhythm, attention reading, and safe-area navigation remain present and legible at 390px without horizontal page overflow.

The next implementation batch must continue the transformation at structural level: replace more same-weight secondary cards with route-specific workbench forms, raise the density and purpose of empty states, and carry the new language through Tasks, Calendar, Goals, Habits, and Review rather than leaving the redesign concentrated in shared styling.

The rebuilt **Tasks** route was also opened through the managed preview. Search, All/Today/At risk filters, task completion, priority, add-subtask, edit, and drag-to-plan controls remain in the DOM and accessible by their existing names. The route now uses an open inventory workbench with a structural top rule and row separators instead of one oversized generic card; this is appropriate for a sparse task list and will scale into a denser state without changing the task model or actions.

The rebuilt **Calendar** and **Goals** routes were checked next. Calendar retains Day/Week/Month/Quarter/Year modes, safe prior/next controls, and its task-only time canvas. Its new blue temporal field makes the calendar’s purpose visible without mixing it with Habits. Goals retains Plan goal, Add milestone, and New project. Its strategy-map layout separates the horizon compass from finite project work by structure and material rather than only a label. No schedule, goal, milestone, or project data changed during this visual audit.

The dedicated **Habits** rhythm ledger retains Add habit, Complete, Skip, Undo-capable trace squares, the four-week calendar pager, and selected-day Complete/Skip actions. Its evergreen material and joined rhythm/calendar treatment make it distinct from task scheduling while preserving the existing habit-calendar boundary. **Review** retains Return to today, the weekly reflection field, Close review, planning health, and decision signals; its copper closing line and split ritual layout now clearly frame reflection as a finite closeout action. No habit check-in, review session, or planner record was modified during inspection.
