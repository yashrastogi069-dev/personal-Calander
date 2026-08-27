# R21 Branch Preview Findings

## 2026-08-27 — Modular workflow review

The current `dev/personal-calendar-workbench` preview was inspected at the dedicated query-string destinations after a clean stable-client rebuild.

| Destination | Observed result | Status |
|---|---|---|
| `/?surface=focus` | The Focus workspace renders a task-linked or unlinked session selector, 25/50/90-minute choices, custom duration input, a Start focus control, and factual evidence states. | Pass — empty-state behavior is legible. |
| `/?surface=habits` | The Habits destination preserves the separate rhythm tracker/calendar explanation and adds the factual practice-evidence surface. With no habits, it correctly avoids inventing monthly data. | Pass — no fabricated evidence. |
| `/?surface=projects` | The dedicated Project Execution destination is reachable from the rail and renders an actionable empty state that routes to the Task workbench. | Pass — no navigation dead end. |

The empty workspace used during visual review contained no created R21 records. The preview also confirms that the direct surface query is being applied to the initial planner destination state after the stable build refresh.

## 2026-08-27 — Capture workspace review

The dedicated `/?surface=capture` destination was checked in the rebuilt stable client at desktop and 390×844 phone widths.

| Check | Observed result | Status |
|---|---|---|
| Desktop input-to-review surface | The explicit natural-language input, examples, and Parse for review control are grouped in one understandable surface without creating data. | Pass |
| Phone composition | The input, helper text, and parse action stack cleanly; the control is wide enough for touch input and no content is clipped. | Pass |
| Safety boundary | The initial destination contains a parser entry action only. No task is created or calendar time reserved until the later review form’s explicit Create task action. | Pass |

## 2026-08-27 — Connections readiness review

The read-only `/?surface=connections` destination was inspected at desktop and 390×844 phone widths.

| Check | Observed result | Status |
|---|---|---|
| Truthful default state | The page declares Google Calendar not connected and confirms no external calendar data is being read. | Pass |
| Data boundary | The policy explicitly states that external calendars contribute busy/free context only; Personal Calendar does not write, move, complete, or delete external events. | Pass |
| Phone readability | Status, prerequisites, and recovery guidance stack without clipping or relying on an unavailable action. | Pass |

## 2026-08-27 — Calendar execution review

The upgraded `/?surface=calendar` Day view was inspected at desktop and 390×844 phone widths after a contrast correction.

| Check | Observed result | Status |
|---|---|---|
| Task/habit separation | The empty task time canvas explicitly directs repeated behavior to the Habit tracker and does not place habits in calendar slots. | Pass |
| Unscheduled work shelf | The calendar renders a readable, task-only shelf with clear drag-or-keep guidance and a truthful empty state. | Pass |
| Mobile composition | Day controls, time-canvas decision surface, and unscheduled shelf stack without clipping at 390px width. | Pass |

## 2026-08-27 — Workspace Search review

The dedicated `/?surface=search&q=plan` destination was inspected at desktop and 390×844 phone widths.

| Check | Observed result | Status |
|---|---|---|
| Findability | Search is a dedicated destination, rather than a hidden task-board filter, and identifies its five record types in the opening explanation. | Pass |
| URL state | The supplied `q=plan` query remains in the rendered field and is explicitly described as retained in the link. | Pass |
| Recovery | No-result feedback names the checked record types and suggests a specific recovery path; the phone layout remains unclipped. | Pass |

## 2026-08-27 — Insights review

The new `/?surface=insights` destination was inspected at desktop and 390×844 phone widths against an empty but real workspace.

| Check | Observed result | Status |
|---|---|---|
| Evidence boundary | Weekly focus, carryover, category allocation, goal allocation, and review history all render truthful zero/empty messages rather than invented statistics. | Pass |
| Status semantics | The review-history visual uses a text state alongside the check icon and color role; blank history has clear recovery text. | Pass |
| Responsive composition | Weekly evidence and carryover sequence remain readable at 390px; allocation and review areas stack without horizontal overflow. | Pass |

## 2026-08-27 — Task-board URL-state review

The task board was loaded directly with `/?surface=tasks&taskQ=plan&taskFilter=deadline_risk` at desktop and 390×844 phone widths.

| Check | Observed result | Status |
|---|---|---|
| Restored filter state | The typed `plan` query and **Deadline risk** selection render immediately after direct navigation. | Pass |
| Empty-state behavior | The board reports zero matching work without hiding the three task lifecycle lanes or archived-work recovery surface. | Pass |
| Phone layout | Search and filter controls stack before the dark task lanes; all labels stay legible with no horizontal clipping. | Pass |

## 2026-08-27 — Plan and Review recheck

The rebuilt `/?surface=plan` and `/?surface=review` destinations were inspected at desktop width after adding the bounded review-history contract and scoped record-link safeguards.

| Check | Observed result | Status |
|---|---|---|
| Guided Plan | Capacity, available work, approval-required scheduling assistance, and weekly-objective links remain visible without an overloaded primary dashboard. | Pass |
| Review empty state | The Review route presents a clear **Begin review** action plus health and decision evidence when no saved review history exists. | Pass |
| Source integrity | No browser mutation was made; the review-history data and planning records remained unchanged during verification. | Pass |

## 2026-08-27 — Lazy destination and bundle recheck

The modular Plan, Focus, Projects, Habits, Capture, Connections, and Insights destinations were opened directly after applying lazy loading.

| Check | Observed result | Status |
|---|---|---|
| Direct destinations | Every checked destination loaded its intended workspace rather than its loading fallback or an error state. | Pass |
| Initial client weight | The standard production build reduced the primary JavaScript asset from 1.61 MB / 392.84 kB gzip to 1.39 MB / 367.14 kB gzip; the stable-preview profile emitted a 1.04 MB / 292.26 kB primary asset. Dedicated workspaces are emitted as separate chunks. | Pass |
| Outstanding performance boundary | The initial asset is still above the 500 kB advisory threshold because legacy Home/dashboard dependencies remain shared. Further Home decomposition is tracked; the warning is not considered resolved. | Tracked |

## 2026-08-27 — Isolated Guided Daily Plan acceptance run

A single disposable task named **“R21 QA cleanup — daily plan acceptance”** was created through the compact New flow, with a deadline and a 25-minute estimate. It was used solely to validate the daily-planning workflow, then archived. No unrelated planner record, integration, device, or reminder configuration was changed.

| Step | Observed result | Status |
|---|---|---|
| Create and plan | The named task appeared as available work, an intention was saved, and the task could be explicitly committed to the newly active plan. | Pass |
| Close-day guard | Selecting `Resolve 1 to close` with one open commitment showed the local message: “Resolve 1 remaining commitment before closing the day.” The plan did not close. | Pass |
| Deliberate outcome | Reschedule exposed a `Plan for` date seeded to the next local day. Confirming it set the commitment state to `rescheduled` and updated the task’s planning day. | Pass |
| Successful shutdown | After resolution, the reflection was saved and `Close today` showed “Closed deliberately. Reflection remains in today’s plan history.” | Pass |
| Cleanup | The test task was first moved to the archived lifecycle state. After the archive behavior was observed, the named task and test-only daily plan rows were removed in a targeted cleanup; a scoped count confirmed zero matching tasks and plans remained. | Pass |

## 2026-08-27 — Isolated Focus lifecycle acceptance run

A separate disposable task named **“R21 QA cleanup — focus acceptance”** began with a 25-minute estimate. The task-linked focus session was started, paused, resumed, explicitly finished by revising the estimate to 30 minutes, and then archived. This was a limited browser run, so the resulting evidence is recorded as measured focus time rather than inferred from the original target.

| Step | Observed result | Status |
|---|---|---|
| Task-linked start | The Focus selector chose the named task and the active session surfaced the task link, its initial 25-minute estimate, Pause, Stop, and explicit finish choices. | Pass |
| Pause and resume | The session changed to `Paused` at 00:20 with a Resume control, then safely returned to `In focus`. | Pass |
| Estimate revision | `Adjust estimate` revealed an explicit replacement field. Saving 30 minutes completed the session and returned the workspace to New session. | Pass |
| Factual evidence | The evidence panel reported recorded measured time and an estimate comparison based on the saved session, rather than crediting the 25-minute target as completed. | Pass |
| Cleanup | The named task was archived; the filtered active lanes showed zero tasks and the bounded archive showed the disposable record only. After observation, its test-only focus history and task row were removed in the targeted cleanup. | Pass |

## 2026-08-27 — Isolated Habit Discipline acceptance run

A daily disposable habit named **“R21 QA cleanup — habit acceptance”** was created in the dedicated Habit tracker. The run confirmed that the tracker is separate from task time blocks and that a factual check-in can be completed, cleared, and explicitly skipped. The test habit was then archived through the lifecycle manager, leaving active habit surfaces empty.

| Step | Observed result | Status |
|---|---|---|
| Dedicated tracker boundary | The habit creation flow and Habits workspace both stated that the rhythm lives in the Habit tracker rather than the task calendar. | Pass |
| Completion | The current-day `Complete` action updated the habit to `Completed today`, changed the day tally to 1/1, and made clear/undo controls available. | Pass |
| Correction removal | `Undo completed` removed the recorded completion and restored the available `Complete` and `Skip` choices without backfilling data. | Pass |
| Intentional skip | `Skip` produced the distinct labels `Intentionally skipped` and `0 of 1 habits complete · 1 intentionally skipped`; the tracker exposed `Clear skip`. | Pass |
| Cleanup | The lifecycle manager confirmed the named habit before archive. After confirmation, the active Habits surface showed its guided empty state rather than the test habit. The named habit and its test-only check-in were then removed in the targeted cleanup. | Pass |
