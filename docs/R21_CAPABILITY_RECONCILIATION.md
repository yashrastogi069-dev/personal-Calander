# R21 Capability Reconciliation

## Scope and count

The supplied competitor/roadmap sentence was decomposed into **29 named capability areas**. Of these, **25 are delivered end to end**, **4 are deliberately readiness-only or manual-first boundaries**, and **0 are silently omitted**. The four bounded areas remain visible in the product or architecture, but are not represented as complete live third-party automation: live external ICS refresh, multi-calendar aggregation beyond the existing busy-event model, automatic dynamic replanning, and cross-device account collaboration.

| Capability | Status | What exists now |
|---|---|---|
| Guided daily planning | Delivered | Persisted commitments, capacity fit, ordering, re-entry, and plan history. |
| Realistic workload planning | Delivered | Work hours, availability exceptions, effort estimates, capacity forecast, and explicit overload reasons. |
| Calendar timeboxing | Delivered | Task-owned inbox-to-grid blocks, move, bounded resize, completion linkage, and 15-minute slots. |
| Daily shutdown | Delivered | Done, reschedule, defer, won’t-do, archive, reflection, close guard, and daily history. |
| Weekly objectives | Delivered | Goal/project linkage, carry-forward, evidence, and outcome review. |
| Analytics and statistics | Delivered | Focus comparison, carryover, allocation, consistency, goal health, review history, and workload signals. |
| Integration policy | Delivered boundary | Truthful Connections surface and server-only readiness architecture; no pretend connections. |
| Focus support and timer | Delivered | Task-linked start/pause/resume, actual duration, evidence, and estimate accuracy. |
| Dependencies | Delivered | Visible Ready/Waiting state, hard/soft dependencies, cycle protection, guarded completion, and removal. |
| Duration-aware scheduling | Delivered | Estimate-aware availability, proposals, direct 15-minute reservations, bounded resize, and collision checks. |
| Dynamic replanning | Manual-first | Reviewed schedule proposals, undo, explicit reschedule and rollover; no silent automated replan. |
| At-risk warnings | Delivered | Deadline risk filter, capacity/load signals, dependency state, and transparent reasons. |
| Multi-calendar coordination | Readiness-only | Existing external busy-event model and secure Google ICS readiness; live approved feed refresh remains unconfigured. |
| Integrated project planning | Delivered | Project execution view, links, milestones, dependencies, risk context, and reviewed breakdown flow. |
| Calendar views | Delivered | Timezone-aware day, week, month, quarter, and year behavior with task-only execution calendar. |
| Flexible habits | Delivered | Separate tracker with daily, weekday, and interval cadence; complete, clear, skip, history, and streaks. |
| Reminders | Delivered existing scope | Existing approved device/rule path and Auckland cadence retained; no new cadence was activated in R21. |
| Natural-language / fast capture | Delivered | Deterministic, editable parsing plus durable offline-first quick-capture recovery. |
| Filters, search, and personalized views | Delivered | Task filters, saved views, workspace-wide search, and URL-persisted destination/filter state. |
| Dates and recurring tasks | Delivered | Local-date discipline, selected weekdays, recurrence, occurrences, exceptions, and historical outcomes. |
| Templates | Delivered | Persisted review-first planning templates with no hidden task creation. |
| Long-term reliability | Delivered | Version-safe writes, archive/restore, high-volume safeguards, task lifecycle checks, targeted cleanup rules, test suite, and source archives. |
| Subtasks and priority persistence | Delivered | Parent/child task relation, priority persistence, filtering, and board/editor visibility. |
| Cross-device support | Readiness-only | Account-backed workspace data, conflict visibility, offline capture, and recovery guidance; no collaboration or third-party sync. |
| Status design system | Delivered | Non-neutral states retain text/icon labels, visible focus, local recovery text, low-glare dark execution surfaces, and reduced-motion behavior. |
| Dark heading / visual identity depth | Improvement queued | The hierarchy is readable and brand-consistent, but a focused next pass can strengthen dark editorial headings and calendar-specific identity without adding clutter. |
| Live ICS source refresh | Credential-dependent | Parser and safety model exist; a real provider allowlist, secure secret configuration, and explicit approval are required before any fetch. |
| Scheduled automatic rollover | Explicitly deferred | Manual, audited rollover is delivered; any automatic job needs separate approval and deployment-safe scheduling work. |
| Automatic dynamic schedule optimisation | Explicitly deferred | The product intentionally requires preview/approval instead of silently changing task plans. |

## User-requested additions

All four explicitly named additions are present. Recurrence, subtasks, priority persistence, and filter/search behavior are implemented. Search spans tasks, goals, projects, habits, and reviews and keeps supported URL state. Insights includes weekly planned-versus-completed focus, carryover, category/goal allocation, and review history. Status semantics pair colour with readable language or an icon; the last refinement removed the remaining brown To do lane and retained purpose-built dark panels only in the timeboxing surface.

## Genuine next work

The visual identity follow-up is now delivered: the daily desk uses stronger ink-green editorial headings and date labels, with a quiet repeating dayline integrated into the existing topbar rule. It is intentionally static, decorative only, and does not compete with functional calendar grids. Desktop and 390px phone verification show the hierarchy remains readable and proportionate. TypeScript and the production build both pass; the production entry stays at approximately 1.399 MB / 367.76 kB gzip.

External ICS refresh and automated scheduling remain intentionally blocked until secure configuration/authorization and explicit approval exist. Those are external action boundaries, not coding omissions or inactive UI controls.
