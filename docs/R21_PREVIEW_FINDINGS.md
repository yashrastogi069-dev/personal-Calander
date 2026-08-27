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

## 2026-08-27 — Project and dependency acceptance preflight

After cleanup, the dedicated Habits workspace again rendered its factual empty state. A new, separately named disposable Project creation run has been opened from the shared compact creator for the next acceptance sequence. The Project entry correctly identifies it as “Finite work that advances a goal,” and the resulting dialog repeats that finite-work boundary. No project, task, dependency, or external integration has been created during this preflight step. A changed accessibility reference was refreshed without mutation.

The Project form exposes a named project field, an optional deadline, and an optional “Goal this project advances” selector. Its guidance explicitly prevents fabricated links: it instructs the user to create the project first, then use `Break down` to add reviewed linked tasks.

The isolated project named **“R21 QA cleanup — project acceptance”** was then created with a September 3 deadline and no goal link. The next checks will create only separately named disposable child tasks and dependency rows, then remove every test row through the existing archive flow followed by targeted cleanup.

The dedicated Project Execution destination selected the named project, surfaced the explicit `not started` state and a factual `0 of 0` task completion count, and rendered separate Ready next, Waiting, and Completed lanes with truthful empty states. It also introduced the dependency workflow as explicit sequencing before it becomes a blocker.

The empty-project sequencing panel offers explicit Task, Depends on, and Link type selectors plus a gated `Add link` action; it correctly has no selectable task or prerequisite until project tasks exist. The dedicated execution page has no in-place `Break down` action at this stage, so the acceptance run will use the existing task creation and explicit project-link workflow instead of inventing a new path.

With the named project selected, the shared compact creator correctly opened the Task form. The next action will create a separately named task and explicitly link it to the project before a second task is created; no dependency has been added yet.

The first disposable task, **“R21 QA cleanup — prerequisite task,”** was created with a 10-minute estimate. It remains unlinked until the next explicit editor action; no project relationship or dependency was inferred automatically.

The filtered Tasks board returned exactly the named prerequisite task in the To do lane with direct Edit and Add a subtask controls. The next interaction will use Edit to set its project link deliberately.

The task editor opened from that filtered row. The next verification step will identify its existing Project selector and save only the link to the named disposable project.

The browser exposed a missing Project selector in that editor, which prevented an existing task from entering Project Execution. The repair adds the same explicit, clearable project assignment to all task editors, backed by the existing version-safe task update contract. The focused tRPC suite now includes project assignment and clearing coverage (**25 planner-router tests passed**) and TypeScript passes. A fresh browser load returned the named prerequisite task; an outdated accessibility reference was refreshed without mutation before continuing.

The named prerequisite task editor reopened successfully after the repair. The next interaction will confirm that its Project selector exposes the disposable project, then save that specific relationship.

The editor remained open after a direct guidance-text lookup did not yield a match, and a fresh accessibility snapshot confirmed the active dialog. No task relationship changed during this non-mutating browser retry.

The first post-edit browser dialog was serving a stale client artifact, so the managed preview was restarted. The restart completed with the current split-client build and the server listening on port 3000; a fresh task-board load again showed exactly the named prerequisite task. No planner data changed during preview recovery.

From the restarted preview, the named prerequisite task editor opened successfully again. The following detailed dialog inspection will establish whether the repaired project-selection field is present before selecting any record.

The restarted task editor now states that project selection is deliberate and exposes a Project combobox initialized to `No project`. The selector opened without side effects; the next action will choose only **“R21 QA cleanup — project acceptance”** from its option list.

The Project selector listed only `No project` and the named disposable project. The named project was selected; the task has not been saved yet, so the next action will confirm and persist this explicit relationship.

`Save changes` persisted the named prerequisite task’s project assignment through the repaired version-safe editor flow. The next verification will open Project Execution and confirm that the task appears in the Ready next lane.

Project Execution selected the named project and showed task completion as `0 of 1`. The named 10-minute prerequisite task appeared in the Ready next lane, confirming the repaired project relationship is persisted and used by the execution view.

The project remains selected with the prerequisite task ready. A second, separately named dependent task is now staged in the shared compact Task creator; it will be explicitly linked to the same project before any dependency is created.

The second disposable task, **“R21 QA cleanup — dependent task,”** was created with a 10-minute estimate. It is not yet assigned to a project and has no prerequisite; both relationships will be set explicitly in the next steps.

The filtered Tasks board returned exactly the named dependent task in the To do lane. Its editor will next assign the same disposable project through the repaired Project selector, after which the Project Execution dependency controls can be used.

The dependent task editor opened successfully and is ready for the same deliberate, clearable Project assignment. No dependency has been created yet.

The dependent task editor displays the repaired Project selector and the same assignment guidance. The selector opened without mutation; the next action will select the uniquely named disposable project and save this deliberate relationship.

The selector offered only `No project` and the shared disposable project; the shared project was selected for the dependent task. It has not been saved yet, and no prerequisite link exists until the editor save and subsequent Project Execution action.

The dependent task’s selected project assignment was saved, and Project Execution was reopened to configure sequencing. Both disposable tasks are now deliberately linked to the same named project; no dependency has been added yet.

Project Execution now shows `0 of 2` tasks and both named tasks in Ready next. Its explicit sequencing control presents Task, Depends on, and Link type selectors plus an `Add link` action, with `Hard prerequisite` selected by default. The next steps will set the dependent task to depend on the prerequisite task and confirm the enforcement path.

The sequencing panel explicitly selected **dependent task** as Task, **prerequisite task** as Depends on, and `Hard prerequisite` as Link type. `Add link` was invoked. The next verification will confirm the dependent task moves to Waiting and cannot be completed until its prerequisite is resolved.

The new hard link moved the dependent task from Ready next to the Project Execution **Waiting** lane and displayed `Waiting for R21 QA cleanup — prerequisite task`. The filtered Tasks board still exposes its completion control, which will now be used to verify the server-side prerequisite guard and recovery message.

The visible completion control for the dependent task was invoked while its prerequisite remained unfinished. The task stayed in the To do lane and the browser registered the expected failed mutation path; the next inspection will capture its actionable local error text before resolving and removing the isolated test data.

The repeated completion attempt continued to leave the dependent task unresolved, confirming server enforcement. The exact server message is `Complete every hard prerequisite before finishing this task.` However, the ephemeral notification was not discoverable through the controlled accessibility query while the failed mutation was recorded by the browser console. This is tracked as a local-recovery visibility hardening item before this acceptance run can be considered fully complete.

The board-recovery hardening was implemented with a persistent `role="alert"` surface and a tested message normalizer. After a clean preview restart, the named dependent task remained in the To do lane with its completion control available. The next immediate completion attempt will confirm the recovery message is now accessible and persists locally.

The repaired flow was verified end to end: attempting to complete the dependent task produced the accessible alert **“Complete every hard prerequisite before finishing this task. The task remains unchanged.”** The dependent task stayed in To do, so the visible error names both the blocked condition and the recovery. The remaining dependency acceptance steps will resolve the prerequisite, confirm the dependent task can then be completed, remove the link, and clean up the disposable records.

The named prerequisite task was then completed through the visible Tasks-board control. The next step will verify that the dependent task is now unblocked, complete it, remove its dependency link, and clean all disposable project records.

After the prerequisite was completed, the dependent task remained available in its filtered To do result and its visible completion control was invoked successfully. This verifies that the hard link blocks only while the prerequisite is unfinished. The final project-acceptance steps will remove the explicit link and clean all three named disposable records.

Project Execution then reported `2 of 2` completed tasks. The dependent task’s visible `Hard: R21 QA cleanup — prerequisite task` link control, which contains the removal action, was invoked successfully. The final cleanup will remove only the two named tasks, the named project, and any remaining test-only dependency data.

After the link removal was invoked, a targeted cleanup removed the two named task rows, the named Project Execution record, and any test-only occurrences, daily-plan items, focus sessions, schedule proposals, weekly objectives, and dependencies attached to those exact task or project IDs. The scoped verification returned `remaining_tasks: 0`, `remaining_projects: 0`, and `remaining_dependencies: 0`. The isolated project/dependency acceptance data is fully cleaned up.

After a browser reload, Project Execution returned to its factual empty state: `Create a project to group a finite body of work, then link its tasks here.` The named disposable project and its tasks are no longer visible in active project work.

The repaired Tasks and Project Execution surfaces were also captured after cleanup at both 1280×720 desktop and 390×844 phone widths. The desktop board retains its three distinct task lanes and the Project Execution empty state retains its direct `Open task workbench` action. On phone, the task filters, lane controls, and archive recovery state stack without clipping; Project Execution’s explanation and action remain readable and comfortably tappable. No test record was recreated for this visual-only verification.
