# Planner Flow Audit — R18 Working Record

## Scope

This audit evaluates the requested readability, actionable-error, object-definition, habit/task separation, and scheduling-language improvements. It deliberately separates two kinds of work: safe clarification and recovery improvements that can be implemented after the audit, and any replacement of broad empty areas with guided action surfaces, which requires explicit user approval before implementation.

## Initial Live-Surface Observations

| Surface | Verified behavior | Audit finding | Severity |
|---|---|---|---|
| Today | The populated workspace exposes task triage, a task-only time canvas, goal runway, and a separate habit rhythm card. | The distinct data models exist, but the flow presents them as adjacent cards rather than a deliberate handoff: a user can still infer that habits belong in the task time canvas. | P1 |
| Goals | Goal runway is labeled “Longer horizon”; Projects is labeled “Finite bodies of work”; active goal records show pace and evidence. | The definitions are implicit rather than supplied at the moment a user creates or links work. The project empty state is useful but does not state that a project advances a specific goal. | P1 |
| Habits | The dedicated Habits route exposes a current-day rhythm card, Complete/Skip actions, seven-day trace, and a separate four-week Habit calendar. | The separation is accurately stated but primarily as descriptive copy. The creation and task-planning flows need a visible routing decision so users choose a repeated cadence rather than time-blocking a habit as a task. | P1 |
| Main Calendar | The Calendar route exposes Day/Week/Month/Quarter/Year controls and a task-only time canvas. | The task/time-block boundary is intact, but the empty canvas only says “Drag a task here.” It does not offer a non-destructive path to locate a task or explain why habits are deliberately absent. Replacing it with guided work requires approval. | Approval required |
| Create Task flow | Task creation currently offers Name, Due date, Estimate, Repeat, and Category; task editing additionally exposes Planned date. | “Due date” and “Estimate” do not explain their operational consequence, and Planned date is absent at creation. There is no local validation if Name is empty; failed composer mutations close the dialog without a local recovery state. | P1 |
| Create Habit flow | Habit creation exposes Name, Planned rhythm, cadence selection, and Category; it does not include task dates or time blocks. | The model is correctly separate, but the generic shared title and four unannotated type tabs make the distinction easy to miss. The habit branch needs explicit “cadence, completion rule, dedicated Habit calendar” language at the moment of choice. | P1 |
| Secondary labels | Existing secondary labels use a calm low-contrast hierarchy. | Small, pale descriptive text is at risk of being difficult to scan, especially on phone or under bright ambient light. This requires a token-level contrast and minimum-size audit. | P1 |
| Guided empty space | The Calendar time canvas and project area preserve intentional open space. | Before adding any guided action surface, the product needs a constrained proposal that prevents unwanted tasks, habits, or goals from being created merely to fill a surface. | Approval required |

## Evidence Captured

The populated desktop Today view renders a task-only time canvas, a separate Habit rhythm card, and a Goal runway. The populated Goals view renders a Goal runway alongside Projects and real Plan goal, Add milestone, and New project creation actions. The dedicated Habits route confirms complete/skip/undo behavior, separate trace, and separate Habit Calendar. The main Calendar shows only task/time-block modes and an empty time canvas. No record was created or altered during these observations.

The current shared creation dialog was opened without saving a record. In its Task branch, it shows only **Name**, **Due date**, **Estimate**, **Repeat**, and **Category**. In its Habit branch, it shows **Name**, **Planned rhythm**, and **Category**, with the separate cadence choices. The audit confirms real model separation, but also confirms that the user does not receive the requested operational definitions or scheduling consequences when choosing a type.

## Implementation Verification — Desktop In Progress

The rebuilt populated Today surface now renders the approved **No time reserved yet** guidance within the empty task time canvas. It explicitly states that reserved calendar time is for tasks and that habits remain in the Habit tracker. Its two controls are visible: **Choose a task to reserve time** and **Keep the day open**. The design preserves the original open canvas, does not create a record, and does not place habits in the task calendar.

The live **Choose a task to reserve time** action routed to the existing searchable Tasks workspace without creating, scheduling, or changing any task. A read-only inspection of the existing `Offline UI probe` editor confirms the live task form now exposes **Deadline**, **Plan for**, **Focus time needed**, and **Reserve time** Start/End fields with the requested consequence copy. The editor remained open and no task was saved during this verification.

An initial blank-title browser probe did not surface the expected inline recovery state: the editor closed with a success message, although the stored task title remained `Offline UI probe` and no planner data was altered. This is treated as a validation failure, not a pass. The form will be hardened with native required/invalidation handling that prevents a blank write before the inline error state is re-tested.

The rebuilt preview now includes native required/invalidation handling on the shared composer, direct Goal runway form, and task editor. The populated Tasks board was reopened after the rebuild; both baseline task titles remain intact. The corrected browser error-path check is still pending and will be recorded only after an observed result.

For the corrected check, the `Offline UI probe` editor was reopened and its title field was cleared only in the unsaved dialog. The persisted board still showed the original title beneath the dialog. No save request has been made in this retry yet.

After correcting local title extraction and rebuilding again, the populated Today and Tasks surfaces render normally. The `Offline UI probe` and `Prepare weekly planning review` records remain in To do with their original planned dates. The final blank-title probe is now being run against this clean baseline.

The final probe opened the same unchanged editor and cleared only the displayed title value. The underlying board remained visible with its original record. The next interaction is the deliberate blank submit; no persistence request has been made at this point.

The final blank submit remained in the editor, displayed the inline **“Name this task before saving it.”** message, and did not issue a persistence update. Closing the dialog returned the board to its baseline with both original task titles and planned dates intact. This closes the previously failed local error-path finding for task editing.

## Next Audit Steps

The remaining implementation work is approval-gated only for empty-surface changes. The audit of the dedicated Habits and Calendar surfaces, create/edit terminology, local error locations, secondary-label CSS, service contracts, and existing test coverage is complete.

## Audit Health Snapshot

| Dimension | Score | Evidence-based finding |
|---|---:|---|
| Accessibility and readability | 2/4 | Keyboard focus, real labels, and semantic controls exist, but many secondary labels use 8–10px type and low-emphasis muted colors, particularly metadata, calendar cells, and support text. |
| Local recovery | 2/4 | Loading failure, habit actions, Companion, quick capture, optimistic lane movement, and archive/restore have recovery paths. Composer create/update and timeline scheduling still lack local failure feedback and preserve no retry context. |
| Workflow clarity | 2/4 | Goals, Projects, Tasks, and Habits have distinct persisted models and routes, but the shared composer does not define each object at selection time or route the user according to intent. |
| Responsive operation | 3/4 | Real 390px layouts, touch actions, stacked lanes, and Habit controls exist. Small secondary text remains the principal mobile readability risk. |
| Implementation integrity | 3/4 | The lifecycle, archive, optimistic task movement, habit check-ins, and task/time-block data model are real and test-covered. Scheduling concepts are present in storage but incompletely expressed in the UI. |
| **Total** | **12/20** | **Acceptable foundation with important clarity and recovery improvements required.** |

## Prioritized Findings

| Priority | Finding | Impact | Planned corrective action |
|---|---|---|
| P1 | Secondary labels often use 8–10px type and muted colors. | Important dates, metadata, repetition rules, archive context, and empty-state explanations are hard to scan, especially on a phone. | Establish a shared secondary-text floor, lift contrast, and preserve hierarchy through weight and spacing rather than faintness. |
| P1 | Composer submits close immediately and task creation/update errors lack a local message or retry. | A failed create, goal/project/habit write, task edit, or calendar schedule can look like lost work. | Keep the relevant dialog open on failure, show an inline `role="alert"` beside the action, retain entered values, and offer an explicit retry. |
| P1 | The composer’s type tabs do not define user intent. | A user can create a repeating task for a routine, or a Habit when a finite task is appropriate. | Add short, operational descriptions and intent-specific fields: Goal = measurable outcome by period; Project = finite body of work that advances a goal; Habit = repeated behavior with cadence and completion rule; Task = one actionable commitment. |
| P1 | Scheduling labels do not state their operational consequence. | “Due date” and “Estimate” are open to interpretation; planned date is hidden at creation; a time block exists in the data model but has no explicit reserve-time interaction. | Rename to Deadline, Plan for, Focus time needed, and Reserve time; add connected help text and validation based on the existing scheduling fields. |
| P1 | Habit separation exists in views but not in the decision flow. | The main Calendar remains technically clean, but the user must infer why a Habit belongs elsewhere. | Show an explicit route choice at creation and when entering the empty task calendar; preserve the dedicated Habit rhythm/calendar as the only place for habit completion. |
| Approval required | Empty task time canvases are visually broad and provide only a drag instruction. | Replacing them changes the visual pacing and how users begin planning. | Use the approval-gated proposal below; no empty canvas will be replaced without consent. |

## Verified Positive Controls to Preserve

The planner already has a task-only Calendar, a separate Habit rhythm and calendar with complete/skip/undo rules, actual Goal and Project persistence, archive recovery, offline capture recovery, optimistic task-lane rollback, and real inline habit/Companion recovery. The improvement work must preserve each of these boundaries rather than consolidating them into one generic planner flow.

## Approval-Gated Guided Action Surface Proposal

The only proposed empty-canvas replacement is the empty **task time canvas** used on Today and the Calendar’s Day view. It would retain open white space and never create data automatically. Instead of a centered “Drag a task here” sentence, it would show one compact decision surface:

> **No time reserved yet**  
> Reserve time only for a task that benefits from a calendar commitment. Habits stay in the Habit tracker.  
> **Choose a task to reserve time** → opens the existing searchable Tasks workspace; **Keep the day open** → dismisses the helper for the current view.

The surface would be shown only when that day has no scheduled task, would not alter any task or habit until the user chooses an existing task, and would preserve the existing drag-and-drop path. The empty Projects area would retain its current explicit creation state rather than being changed in this pass.
