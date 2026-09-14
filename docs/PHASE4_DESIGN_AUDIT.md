# Phase 4 critical product and design audit

Status: discovery; no Phase 4 interface implementation has started.

Date: 2026-09-12

## Executive verdict

Personal Calendar is technically more trustworthy and functionally broader than its visual design currently communicates. It is not yet better than the leading products in this category. The foundations are strong: account-scoped offline work, deliberate conflict handling, a useful Today/time relationship, planning rituals, goals, habits, review, and a recognizable verdigris identity. The interface currently makes those strengths harder to use through excessive peer-level navigation, repeated information, small controls, weak contrast between pale surfaces, inconsistent visual weight, and too much explanatory copy.

Current design score: **C (5.8/10)**. Current AI-template/slop score: **C-**. The product looks considered, not careless, but it still resembles a sequence of independently-designed dashboard modules rather than one composed personal planning instrument.

## First impression

The product communicates a serious personal planning workspace. The first three visual anchors on desktop are the full-width sync-conflict banner, the large `Today` heading, and the two large work panels. That order is wrong: system exceptions visually outrank the user's day, while the empty time canvas can outweigh actual commitments.

One-word first impression: **overbuilt**.

Clearly named areas include navigation, quick capture, today's commitments, and the time canvas. Less self-evident areas include Action queue, Daily signal, Goal runway, Planning health, Decision signals, and several review/forecast concepts. Those names expose the product model instead of the next user decision.

## Measured evidence

- Rendered desktop Today exposes 62 interactive controls; the audit found many visible controls below 44px, including 21px completion controls and 28px task actions.
- Rendered phone Today exposes 48 interactive controls; completion controls remain 20-21px and several date/add actions measure 36-42px.
- The interface uses two intentional font families, Onest and IBM Plex Mono, but labels and functional copy frequently fall to 10-13px.
- The rendered sample produced more than 70 distinct foreground/background color values. The palette is directionally coherent but not token-disciplined in practice.
- Desktop and 390px phone had zero page-level horizontal overflow.
- Phone More is technically scrollable (`overflow-y: auto`, 878px content inside a 639px viewport), but the user reports unreliable touch scrolling. Treat this as a real iPhone interaction defect until physically resolved.
- The automated phone result records Settings sign-out as visible but not pointer-accessible behind the fixed navigation. This is unresolved.
- The production client continues to emit a large-main-chunk warning. Recent local builds produced a main bundle of roughly 1.08-1.30 MB before gzip, depending on environment.

## Category grades

| Category | Grade | Critical read |
| --- | --- | --- |
| Visual hierarchy | C- | Too many elements compete; system banners and empty surfaces can dominate actual work. |
| Typography | C | Distinctive enough, but small type and inconsistent heading weights reduce legibility and authority. |
| Color and contrast | C | Verdigris is recognizable; pale green layers blur together and the dark lanes feel detached from the rest. |
| Spacing and layout | C+ | Desktop split and fixed rail are useful; nested cards, rounded containers, and repeated frames add noise. |
| Interaction states | C- | Good feedback exists in places, but small targets, crowded row actions, and obstructed sign-out fail the phone standard. |
| Responsive design | C | Safe areas and bottom navigation are improved; several screens still behave like stacked desktop modules. |
| Content and microcopy | C | Language is thoughtful but too instructional and internally named for frequent daily use. |
| Motion and continuity | D+ | Sheets have basic motion; route changes and task transitions lack consistent spatial continuity. |
| Performance feel | C- | Offline behavior is strong, but a large initial bundle and blank `Opening your account...` transitions reduce confidence. |
| AI-template resistance | C- | Stronger identity than a generic template, but repeated cards, icon tiles, gradients, and uniform radii remain obvious patterns. |

## Highest-impact product problems

### 1. Fourteen top-level destinations flatten the product hierarchy

Today, Capture, Search, Plan, Tasks, Calendar, Goals, Projects, Habits, Focus, Connections, Insights, Review, and Settings appear as peers on desktop. They are not peers. Capture, Search, and Focus are actions or modes. Connections and Settings are account utilities. Insights belongs with Review. Goals, Projects, and Habits are related planning systems. The current structure makes the product feel larger and harder than it is.

Direction: reduce primary navigation to five or six destinations. Move actions to a command/capture layer and place utilities under Account/Settings.

### 2. Today repeats work instead of progressing it

The same sample tasks appear in Today's commitment, the time canvas, and the action queue. Repetition increases scanning without increasing understanding. The user should move through one loop: capture, decide, reserve time, do, review.

Direction: make Today one composed decision surface. Use a single canonical task row that moves between an unscheduled list and the timeline. Supporting signals should be collapsed or contextual.

### 3. Visual calm has become low contrast

The verdigris direction is appropriate, but almost every layer is mint, pale green, or green-gray. Surfaces lack separation and small green-gray text fades. The dark Task lanes are memorable, but three large dark blocks create a separate visual product inside the light planner.

Direction: keep verdigris as the brand accent, use warmer neutral surfaces for structure, strengthen ink contrast, reduce the number of tints, and use the dark lane colors as controlled state accents rather than an unrelated theme.

### 4. Task rows expose expert controls before the task

Completion, priority, date shifts, subtask, edit, ordering, and lane movement compete within each row. This is powerful but slows recognition and creates tiny targets.

Direction: task title, completion, date/time, and one contextual action stay visible. Secondary fields open through a detail sheet or overflow menu. Gestures accelerate the same visible actions and always offer undo.

### 5. Mobile navigation is structurally improved but not yet native-feeling

The five-slot bar is clearer than the earlier implementation, but More is a long secondary directory and reportedly fails to scroll reliably on the physical iPhone. Settings is itself a long card stack. The current sign-out remains obstructed in automation.

Direction: use a native-feeling full-height navigation sheet with a fixed header and independently verified content scroll. Reserve bottom-safe padding for every final action. Preserve state and support swipe-down, Close, scrim, Escape, and browser Back.

### 6. Settings is a card catalog, not a settings hierarchy

Account, sync, app status, layout, connections, and sign-out are logically correct, but the repeated icon-card treatment adds decoration and vertical length. It resembles a generated SaaS dashboard.

Direction: use grouped settings rows with clear section headers, disclosure indicators, inline status, and one dedicated Account section. Keep technical detail available without making it the first layer.

### 7. System states visually outrank the user's work

The full-width `Needs review` banner dominates every screen, even when the user is trying to execute today's plan. Disabled/secondary actions inside it are low-contrast.

Direction: use a compact persistent status indicator and expand it only when action is required. Conflict review should be explicit but not become the product header.

### 8. Empty/loading transitions are not designed as part of the experience

At least one lazy surface was captured as a near-black screen containing only `Opening your account...`. Even brief blank transitions feel like navigation failure in a planner.

Direction: keep the application shell stable, use route-matched skeletons, retain the prior screen until the next screen is ready where safe, and never remount the identity boundary for ordinary destination changes.

## Competitive benchmark

| Product | What it currently does better | Personal Calendar opportunity |
| --- | --- | --- |
| Things | Ruthless hierarchy, progressive disclosure, fast capture, clear Today/Upcoming/Anytime/Someday model, polished gestures | Match its clarity while exceeding it with time capacity, goals, habits, review, and offline conflict transparency. |
| Todoist | Mature information architecture, filters, search, deep linking, list/board/calendar flexibility | Offer less configuration overhead and a more coherent daily planning loop. |
| Structured | One timeline tells the whole day at a glance | Combine timeline clarity with stronger projects, goals, and weekly review. |
| Sunsama | Guided daily/weekly rituals and workload realism | Turn existing planning/review capabilities into a deliberate guided flow rather than separate modules. |
| Akiflow | Clear inbox-to-plan-to-calendar movement and integration-led capture | Make capture-to-time-blocking feel equally direct without becoming integration-heavy. |
| Apple Calendar/Reminders | Native interaction, accessibility, notification trust, OS conventions | Respect iOS conventions and provide a unified planning layer; do not imitate native controls poorly. |

Sources: [Things features](https://culturedcode.com/things/features/), [Todoist calendar layout](https://www.todoist.com/help/todoist/features/use-the-calendar-layout-in-todoist-lPHRQTu0o), [Structured](https://structured.app/), [Sunsama daily planning](https://help.sunsama.com/docs/usage-guides/daily-planning/), [Akiflow Today](https://product.akiflow.com/articles/0741055-today-page).

## Defensible differentiation

The strongest product position is not `more planner features`. It is: **a trustworthy personal operating system that connects intentions, commitments, available time, habits, and reflection without losing work online or offline**. The interface should make that promise feel simpler than the underlying system.

## Owner's real-life validation scenario

Phase 4 must support a mixed personal day rather than optimizing only for office work. The reference scenario includes:

- following up on due habits without turning the entire day into a streak dashboard;
- completing everyday tasks and recurring to-dos;
- attending meetings and appointments that currently live in Apple Calendar;
- reading documents and replying to messages or email;
- retaining monthly, quarterly, and yearly goals while identifying the next useful action;
- deciding what to eat, what can be cooked, and which groceries or household items need buying;
- recovering gracefully when meetings, delayed replies, low energy, or other interruptions invalidate the original plan.

The intended loop is `remember -> clarify -> plan -> do -> adapt -> review`. Today must combine fixed appointments, flexible tasks, and due habits without duplicating the same work. Longer-term intentions must remain visible through Goals, Projects, milestones, and planning horizons without forcing every personal task into that hierarchy.

Apple Calendar is the first external-calendar context. Gmail is a future capture/communication integration, not a prerequisite for the Phase 4 shell or daily loop. Both integrations must preserve source ownership, show the difference between imported context and planner-owned records, and avoid silently converting messages or appointments into tasks.

## Follow-through and accountability product requirement

The owner identified loss of follow-up as the highest-impact failure: habits are maintained for several days, interrupted, and restarted later; deferred work disappears; interruptions invalidate a plan; the next action becomes unclear; and long-term goals lose attention behind daily work. Phase 4 should therefore make **consistent return** more important than perfect streaks.

The design must support different users and temperaments through a small accountability preference rather than assuming one universally strict workflow. The recommended default is structured and explicit: missed or deferred work returns to a recovery decision, long-term goals surface at an appropriate review cadence, and the app recommends a concrete next action. A stricter setting may require daily resolution and stronger prompts; a gentler setting may consolidate prompts into reviews. None of these modes may silently reschedule, complete, or delete work.

Owner decision: Strict mode is approved. In Strict mode, unresolved commitments remain persistently visible until the user intentionally chooses an outcome such as `Done`, `Reschedule`, `Reduce`, `Pause`, or `Abandon`. The user may continue using the rest of the app; strictness must not become a lockout, destructive action, notification flood, or shame mechanic. Reducing and pausing require a new scope/review point so they cannot become invisible dismissal paths. Every resolution retains its history and can inform later review.

Long-term planning should become an execution system rather than a static goal list:

`goal -> milestones/checkpoints -> projects or workstreams -> next actions -> scheduled/planned work -> evidence and review`

This is a helpful default hierarchy, not a mandatory schema constraint. Standalone tasks and projects, direct goal-linked tasks, habits linked to goals, and existing monthly/quarterly/yearly/someday horizons remain supported. A timeline or roadmap is one view of the same records, with explicit progress, risks, dependencies, stalled state, and next review date; it must not create duplicate goal data.

Owner decision: support both long-term intention types:

1. `Outcome goal`: a finishable result with target date, milestones, projects/workstreams, dependencies, risks, and a timeline.
2. `Ongoing direction`: a continuing area such as health, learning, relationships, or financial discipline, supported by habits, standards, evidence, and recurring reviews rather than artificial completion.

## Dashboard and roadmap direction

The owner wants an at-a-glance dashboard and project-management-style timelines. Do not replace Today with a configurable widget canvas. Today is the execution surface; an Overview is the orientation surface. They are two views of the same records and must not create duplicate tasks, goals, or progress values.

Recommended structure:

- `Today / Overview` is a first-level view switch within the home context, not another peer in the global navigation.
- Today remains action-first: next reservation, flexible work, due habits, and explicit recovery decisions.
- Overview is a curated personal command view: commitments needing attention, capacity, habit consistency/recovery, goal momentum, stalled/at-risk work, upcoming milestones, and the next meaningful review.
- Users may reorder, hide, or resize a bounded set of modules. The app provides a strong default and does not ask new users to construct their own system.
- Goal/Project detail supports `Overview`, `List/Board`, and `Timeline/Roadmap` views over the same records.
- The portfolio-level Roadmap spans month, quarter, and year; it displays milestones, overlapping projects, dependencies, risks, and unplanned gaps. Moving a bar proposes a date change and makes consequences explicit before saving.
- Phone Overview is a prioritized vertical briefing, not a compressed desktop grid. Phone Roadmap starts as milestones and grouped periods, with an optional landscape timeline for detailed manipulation.

This borrows the useful aggregation principle from [monday.com's Overview widget](https://support.monday.com/hc/en-us/articles/360007078739-The-Overview-Widget) and the shared-data/multiple-view principle from [Notion Timeline](https://www.notion.com/en-gb/help/guides/intro-to-timeline-view), while avoiding an enterprise widget-builder as the default personal-planning experience.

## Recommended Phase 4 order

1. Settle product promise, audience, navigation hierarchy, visual direction, and density.
2. Create one semantic design system: typography, neutral/brand/state colors, spacing, radii, elevation, motion, and component states.
3. Recompose Today and the global shell.
4. Rebuild task capture, task rows, task detail, lanes, and task-to-calendar movement.
5. Recompose Calendar/Plan, Goals/Projects, Habits, Review/Insights, Search, and Settings in that order.
6. Validate empty, loading, error, offline, conflict, large-data, long-text, keyboard, Dynamic Type, reduced-motion, portrait, landscape, tablet, and desktop states.
7. Optimize the client bundle and route transitions.
8. Finish real iPhone notifications/reminders only after the interaction system is stable.

## Decisions needed from the owner

The questions in the associated Phase 4 discussion determine the final information architecture, visual character, and default workflow. Do not begin broad interface implementation until the first product-direction answers are recorded. 
         
1B, 2C (with a more deeper usecases in real life basically hael the user in any way), 3C, 4C, 5A and 5C (Look i want to preserve all the features, I would want any removal of any feature because I personally feel giving all the features is imp), 6A but plans is also for long term planing or we can something else for longterm planing, 7A, 8A and 8B its imp, 9B but i am not sure with this where this make more sense, 10C, 11B, 12C and B as well, 13C But i am not sure with this do some more research for this its IMP understand what others are doing and how we can do this, 14A, 15A, 16A to be honest i an not sure for this as well what you can do you show me some smaple when you start working on this and then we can do something by looking visually, 17A But other option should be actuly better than this, 18C i did dark because i want more cleaity and visibility if you do something else that has these two things you can show that as well, 19B give option to user as well, 20C. Wok on wed brach only and I want you to make this plan with astra and then switch to 5.6 sole High for everything.
