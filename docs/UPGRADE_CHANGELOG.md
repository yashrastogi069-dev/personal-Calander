# Personal Calendar Upgrade Changelog

## Verified reliability and interaction work

The habit tracker now treats a completion, an intentional skip, and an unrecorded day as distinct states. A second tap is a **true undo**: the scoped check-in row is deleted rather than silently rewritten as `skipped`. Each previous or current day in the seven-day trace can be corrected. The user may also choose **Skip today**, and both the immediate state and fresh workspace snapshot preserve that choice. Check-in writes disable competing controls while pending, show inline failure copy on error, and offer a retry that repeats the original intended action.

This workflow has browser evidence for completion, undo, skip, reload persistence, controlled transport failure, retry recovery, and state restoration. The backend has service, router, and rule tests covering the successful and invalid paths.

## Planning and analytics work

The workspace snapshot now returns dated task occurrences and persisted review sessions in the requested local-date range. The focus workflow surfaces due recurring work with explicit **Done**, **Skip**, and **Missed** outcomes. The dashboard computes decision signals only from stored planning data: schedule reliability, carryover pressure, blocked-work age, estimate coverage, and goals with visible progress. It deliberately does not claim estimate accuracy because the current model does not yet store actual time spent.

Recurring tasks can now be configured at creation and in the active task editor. The workflow supports daily, weekly, and monthly cadences, a positive interval, and an optional stop date. A persisted series uses the planned date when present and otherwise uses the due date; the same values are restored into the editor after a fresh workspace render. The public router validates version-safe recurrence updates, and the materialization rules remain bounded by the requested date range and any explicit series end.

The dedicated **Review** route now owns the weekly ritual rather than duplicating it in Today. It starts and completes persisted weekly review sessions, records the user’s reflection, displays recent completed reviews, and places recurring-work outcomes, plan health, and decision signals in the same decision context. Completion trend, category load, workload, focus completion, carryover, blocked work, goal progress, and habit streaks remain derived from persisted planner data rather than illustrative metrics.

## Calendar, installation, and notification readiness

The private iCalendar subscription remains the first iPhone Calendar connection. It is read-only, token-protected, revocable, and intentionally does not imply two-way iCloud sync. The client includes an installable web-app manifest, service worker, and adaptive app icon. A user-gesture control can request browser notification permission, but it clearly states that reminder delivery remains inactive until a VAPID key pair, server delivery service, stored subscriptions, and a user-controlled reminder schedule are configured.

The main **Calendar** is now intentionally task- and time-block-focused. Habit check-ins live in a dedicated calendar-style tracker in **Habits**, where a selected date shows only habits scheduled for that date and exposes explicit **Complete**, **Skip**, and true **Undo** actions. This keeps scheduled task work from being visually cluttered by daily habit repetition while preserving date-level habit accountability.

> **Activation boundary:** Do not claim that phone reminders or provider calendar sync are live until the user supplies credentials, grants device permission, and the server delivery or OAuth adapter workflow has been implemented and tested.

## Research-informed habit scheduling

The habit composer now asks the user to choose an explicit rhythm: **every day**, **selected weekdays**, or **every N days** with an optional local start date. The persisted schedule powers the dedicated habit calendar and the seven-day trace. An unscheduled date is visually represented as a rest day and cannot be completed or skipped, preventing the tracker from creating false accountability events outside the user’s plan.

This change follows the research ledger’s conclusions that stable context and user-selected timing matter, while tracking should reduce unnecessary friction and avoid punitive mechanics. The application therefore presents scheduled opportunities rather than a universal streak mandate, keeps **Complete**, **Skip**, and **Undo** separate, and makes no claim that a habit is automatically formed after a fixed number of days.[5] [6] [7]

## Organization and safe lifecycle work

The top-level **Categories** control now opens a complete organizing workflow rather than a prompt. Users can create a named color category, apply it from each creation flow, rename it, or remove it. Removing a category safely detaches that label from tasks, goals, projects, and habits in the same workspace; it does not delete the underlying planning history. The router covers version-safe category update and removal contracts.

The same organizing workflow offers an explicit archive action for active tasks, goals, projects, and habits. Archive removes an item from active planning while retaining its history, including completed work, check-ins, and reviews. Each archive and category-removal action states its consequence and requires a confirmation, avoiding ambiguous destructive deletion. All visible add controls now lead to the concrete composer or manager workflow they represent; stale non-functional command affordances were removed.

## Visual direction

The former bright mint treatment was recalibrated to **Smoked Verdigris**: a low-glare smoked-stone canvas, muted mineral surfaces, restrained verdigris for decisions, flatter elevation, and reduced background decoration. The resulting planner was inspected at 1280×720 and 375×812. The product remains intentionally light, but avoids a high-brightness white wash.

## Embedded creation-card repair

The plus-led empty states are now full-card semantic buttons. The visible plus, title, supporting copy, and trailing action label execute one creation path rather than leaving the plus itself inert. The verified mappings are **Focus → task**, **Tasks → task**, **Goal runway → goal**, **Projects → project**, **Habit rhythm → habit**, and **Habit Calendar → habit**. Calendar and Review contain no embedded empty-state plus cards. Each repaired card exposes a meaningful accessible label plus hover, focus-visible, and press feedback.

## Long-horizon planning and reminder scheduling candidate

Goals now support explicit yearly, quarterly, monthly, and parent-goal planning. The Horizon Compass derives progress from an explainable source—manual measure, child goal, milestone, or connected execution—and applies pace only where valid dates exist. Recursive rollups include a cycle guard, milestones expose dated evidence and optional user-authored if–then cues, and completed reviews supply a transparent freshness signal rather than a hidden productivity score.

The phone-reminder path now retains a single browser’s exact PushManager endpoint before allowing a manual test or opt-out action. Device enrollment and opt-out await server persistence, so a failed server call does not silently remove the local subscription. The interface separates device enrollment from automatic cadence and preserves a private, read-only Calendar subscription as the iPhone visibility fallback; it does not claim browser-level Apple Reminders synchronization.

The approved reminder rules are defined for `Pacific/Auckland`: daily planning at 11:00 and weekly review at Sunday 17:00. The initial per-rule scheduler activation did not complete from the anonymous PWA because it tried to create end-user-owned platform tasks without a user session. The replacement uses one authenticated, project-owned hourly callback with a durable task-ID registry; it evaluates enabled wall-clock rules through the IANA timezone database, reserves a unique per-rule/per-device/local-minute delivery before sending, and treats retries, duplicate attempts, no-active-device runs, pauses, and terminal subscription expiration safely. This preserves workspace isolation without asking an installed anonymous PWA to authenticate simply to enable the user-approved cadence.

The user has confirmed a visible manual push notification on the installed iPhone after VAPID configuration was corrected. The corrected global callback and schema registry now have local type, build, and **49-test** regression coverage, including session-independent rule activation, task-UID-gated global sweeping, and raw platform cron-cookie authentication. The project scheduler is registered, the public r3 Vercel artifact is verified, and the user confirmed that the iPhone control now displays **Pause reminders** after enabling the cadence. A production off-schedule callback audit authenticated successfully, inspected the two enabled rules, and returned safe zero-send no-ops. The database contains the expected enabled Auckland rules. Automatic future delivery is still not claimed before the scheduled provider call occurs at its real local time and is observed.

### Device-control visibility repair

The Phone reminders interface now separates **This device** from **Scheduled rhythm**. The device row is always visible and communicates the exact-state action—connect/reconnect, test, or disconnect—rather than relying on a conditional compact action beside the general reminder copy. This makes device opt-out explicit without altering the enabled Pacific/Auckland cadence.

The subsequent options audit further distills the interface into **This iPhone** and **Schedule**. It removes duplicated helper text and guarantees that each surface exposes only actions that can work in its current state. The active cadence and its underlying delivery behavior were not changed.

The user confirmed the final installed-iPhone state with the connected-device actions and active schedule visible together. The optional disconnect/re-enrol proof was consciously deferred to avoid disrupting the working device; the documented recovery path remains available.

## Validation snapshot

The latest device-control visibility validation completed `pnpm check`, `pnpm test`, and `pnpm build:client` with **49 passing Vitest tests across 11 files**. The broader verification record includes recurrence routing, review-session persistence, analytics rule calculations, category update/removal, goal/project/habit archive contracts, responsive layouts, the visible creation-card inventory, local long-horizon control review, and device-push failure handling. The client bundle retains a non-fatal large-chunk warning that is tracked as a later performance task rather than being hidden as a validation success.

## Phone-first planner completion pass

The planner now adapts its navigation for an installed iPhone PWA: the desktop rail remains intact while phones receive a labeled, safe-area-aware six-destination bottom bar for Today, Tasks, Calendar, Goals, Habits, and Review. The main canvas reserves that bar’s space, and quick capture plus direct planning controls have more comfortable phone targets. Dense planning, calendar, habit, and review copy has been selectively enlarged without changing their task, goal, habit, calendar, or reminder behavior.

The Calendar keeps its seven-day task grid legible by retaining horizontal phone scrolling and adding an explicit swipe cue; Habits remains the dedicated habit-calendar surface. A route audit confirmed that all core areas expose concrete controls rather than display-only buttons. A shared mobile-navigation contract now guards the six-destination order with focused automated coverage. The release passed TypeScript, a **51-test / 12-file** Vitest suite, the production client build, desktop and iPhone-width rendering checks, and the interface detector. Reminder automation remains deliberately deferred; the existing connected-device and saved-cadence experience was not altered.

## Offline capture and focused Today rescheduling

Quick capture now works through a conservative offline-first path. After the app has been opened, its service worker retains the planner shell for an offline return; task API responses are never cached. If a quick task is captured while disconnected, the app clearly keeps it on the current device, displays that pending state in Today, and replays it only once a connection returns. Each replay carries a client capture ID backed by a database uniqueness constraint, so retries after uncertain network failures do not create duplicate tasks.

Today also gains a deliberate nearby-day planning gesture: swipe a task left or right, or use its accessible previous/next controls, to move its **planned** date by one local day. It does not alter the due date, goal, habit, calendar boundary, connected iPhone, reminder cadence, or paused automation work. The enhancement passed TypeScript, the production build, the interface detector, and a **54-test / 13-file** suite with dedicated offline-queue and router-contract coverage.

## Non-automation reliability closeout

The runtime dependency graph has been brought through a targeted production-security remediation. Compatible updates cover the networking, web framework, storage, ORM, ID, AI-markdown, and tRPC layers; the last vulnerable chart-library transitive is constrained to its patched Lodash release. The final production audit reports **no known vulnerabilities**, while TypeScript, the **54-test / 13-file** suite, fresh phone and desktop renders, and the Vercel-targeted build remain successful.

This completes the currently committed non-automation product and reliability backlog. The remaining roadmap entries—external calendar providers, account migration, shared workspaces, and similar integrations—are not unfinished defects; each requires a separate provider or product decision. Automatic reminder delivery remains explicitly paused, and the connected iPhone/device-cadence experience was not changed.

## Daily Desk phone redesign

The phone planner has been rebuilt as a touch-first **Daily Desk**. Today now begins with a confident route/date heading, a large capture deck, a full-width immediate-focus surface, and an intentionally ordered planning signal. Supporting work is no longer a long equal-weight stack: Plan tools and Connected tools are calm expandable sections that retain every existing action without competing with the next decision.

Phone navigation now uses four direct destinations—Today, Tasks, Calendar, and Goals—plus a fifth **More** sheet for Habits, Review, and category management. It is labeled, safe-area aware, and covered by a shared navigation contract test that guarantees all six planner destinations remain available. Type, controls, task rows, dialogs, calendar modes, goals, habits, review flow, charts, and empty states were redesigned for readable phone use while the desktop rail and two-column workspace remain intact. The connected-iPhone reminder controls and paused automatic-delivery boundary were deliberately preserved. The release passed TypeScript, a **55-test / 13-file** suite, production build, phone and desktop visual review, and final detector-guided cleanup.

## Premium card, color, and motion polish

The Daily Desk now distinguishes commitment, time, direction, rhythm, reflection, and utility surfaces through material tint, border emphasis, elevation, and density rather than a single repeated card style. Primary actions retain deep verdigris authority; the time canvas, goal runway, habit rhythm, capacity reading, and analytics have their own quieter material roles. The result remains calm but makes the hierarchy more immediately legible.

Motion is now intentionally limited to feedback and spatial context. Phone navigation, capture, completion, nearby-day controls, expandable tool rows, and the More sheet acknowledge touch with short custom-eased transitions; frequent planning content does not wait through decorative animation. Reduced-motion users receive instant structural changes with essential opacity and color feedback only. All data behavior, desktop layout, connected iPhone controls, and the paused reminder-delivery boundary remain unchanged.

## Habits Rhythm Workspace

Habits now has a visibly distinct phone-first operating surface. At the top of the dedicated route, **Your rhythm today** shows the actual completed-versus-scheduled count and one large state-aware row for each scheduled habit. Complete, Skip, and Undo are direct actions, with explicit state copy; a true rest day is stated rather than treated as a failure. The existing seven-day trace has been retained as a quieter continuity view, and the four-week habit calendar remains the dedicated history, planning, and correction surface.

This redesign changes presentation only. Habit schedules, intentional skips, streak rules, check-in persistence, calendar-day actions, error recovery, the main task calendar boundary, desktop behavior, iPhone controls, and paused reminder automation remain unchanged. An isolated complete/undo verification confirms the new current-day deck stays synchronized with the trace and calendar.

## Managed preview stability repair

The managed Preview now serves a freshly built static planner bundle instead of relying on a Vite HMR client through the external preview proxy. This removes the preview-only WebSocket failure and React/tRPC invalid-hook failure that could leave `?from_webdev=1` blank. The full planner now mounts normally in the managed preview; Vite remains available only for explicit local debugging. No end-user planning, habits, iPhone, cadence, or reminder behavior changed.

## Functional Tasks board and control audit

Tasks now offers a real three-lane workflow: **To do**, **In progress**, and **Completed**. Each task keeps its state in the existing version-safe planner contract, so movement remains synchronized with Today, Calendar, goal progress, and analytics. On desktop, a task card can be moved into another lane through native drag-and-drop. Every card also contains a native **Move to** control, making the same transition usable from a keyboard or touch device. Empty lanes clearly state their state instead of hiding the workflow.

The Task surface was reviewed for decorative controls. The priority flag now cycles and saves the next priority, then confirms the result; it is no longer passive. Completion, edit, subtask, search, filtering, task creation, and lane movement are all connected to real operations and return explicit success or recovery feedback. Existing controls outside Tasks retain their verified persistence contracts, and prerequisite-bound actions remain visibly disabled with clear guidance instead of appearing active without an outcome. The release passes TypeScript, the production build, the interface detector, and **63 tests across 15 files**.

## Companion reliability and deeper task states

The Optional Companion now uses the GPT-compatible completion-token request parameter, which resolves the earlier unreadable-response failure. A submitted note produces a reviewable draft; it never writes to the plan until **Confirm draft** is selected. Empty notes are explained rather than silently ignored, pending requests are explicit, and a provider failure or malformed response produces a clearly labeled Safe starting draft from the user’s own note. The user can discard it or retry the model, preserving an honest boundary between deterministic recovery and model output.

The task lanes now carry deeper state roles without using brown surfaces: **deep slate-blue** for To do, **dark teal** for In progress, and **forest green** for Completed. These colors are applied to lane-level state, counts, drop targets, and mobile outlines while task content remains calm and readable. At phone width, the lanes stack into distinct, touch-safe work zones without removing the native **Move to** control. The full validation suite now passes with **65 tests across 16 files**.

## Immediate task movement

Moving a task now updates the visible lane and count **immediately**, before the version-safe persistence request returns. The server result is then merged into the workspace cache. If that request fails, the temporary move is removed, the task returns to its prior lane, and the interface names the recovery. This removes the prior disabled waiting period that made drag-and-drop feel delayed while keeping the server as the source of truth.

## Planner-scale history and recovery

Tasks now remain manageable at high volume without silently discarding evidence. To do and In progress preview 24 items; Completed previews 12; each lane has an explicit expansion action, while a task search reveals every match. Completed work can be archived in bounded batches and appears in a dedicated Archived work panel with explicit Restore actions. Task restoration returns work to To do and clears its completed/archive timestamps. The organizer also now restores archived Goals, Projects, and Habits with workspace-scoped version checks; linked planning history and habit check-ins are preserved.

Calendar day cells continue to show at most three tasks, but no longer hide additional work without an exit: a compact **View N more in Tasks** action routes to the searchable Tasks workspace. The release adds high-volume, batch-boundary, restore-metadata, and stale-write contract coverage. It passes TypeScript, the production build, and **71 tests across 17 files**; the retained large-client-chunk warning is unchanged and non-fatal.

## Calendar naming and task-lane refinement

The product’s visible name is now consistently **Personal Calendar**, including the page title, application shell, PWA manifest, install surfaces, copy, and generated calendar-facing labels. Existing planner routes, private calendar feeds, data records, and GitHub repository identifiers remain unchanged. The Tasks board retains its approved dark treatment, but To do is now deep slate-blue and In progress dark teal; Completed remains forest green. No brown surface is used. TypeScript, all 71 tests, the production build, a source spelling scan, desktop populated-board inspection, and a 390×844 phone capture pass.

## Clear planning choices and recoverable scheduling

The planner now explains the difference between a **Goal** (a measurable outcome), **Project** (finite work advancing a goal), and **Habit** (repeated behavior with a cadence and completion rule) at the moment users choose what to create. Task scheduling now uses plain operational terms: **Deadline**, **Plan for**, **Focus time needed**, and **Reserve time**. A planned date does not reserve calendar time; only a task reservation does. The main Calendar remains task/time-block focused, while Habits continues to own repeated-behavior tracking and its separate calendar.

Empty task calendars now offer a contained decision surface rather than a bare blank space: choose an existing task to reserve time or keep the day open. It creates nothing automatically and does not place habits on the task calendar. Secondary labels have higher contrast and a more readable size. Core creation and editing forms now retain local, actionable errors; a blank task title remains in the editor with a recovery message, while an invalid reservation explains that its end must follow its start. The release passes TypeScript, a **74-test / 18-file** suite, production build, desktop/390px review, and the final interface detector.

## Daily capacity, deadline risk, and reviewed project breakdown

Today now includes a compact real-time **Daily capacity** forecast derived only from unfinished work that is planned for today or due today. It reports known planned minutes against the workspace capacity, remaining or over-capacity minutes, Reserved time, Deadline-only work, and an explicit unestimated-task count instead of guessing duration. Deadline risk is an explainable filter—not a predictive score—and includes only overdue work, work due today, or work due within two days without a plan on or before its deadline.

Projects now offer **Break down**, a confirmation-first dialog for manually reviewed linked tasks. Opening it creates nothing. The user can add up to five titled rows, choose optional Focus time and Plan for values, then explicitly create the shown count of linked tasks. Each row has a stable request ID so retrying an in-dialog partial failure is duplicate-safe. A late verification safeguard also prevents the task editor from resetting a just-selected lifecycle state when equivalent derived task objects rerender.

[5]: ./RESEARCH_LEDGER.md#habit-tracking-and-tracker-safety "Habit tracking research ledger"
[6]: ./RESEARCH_LEDGER.md#habit-tracking-and-tracker-safety "Time-to-form-a-habit evidence"
[7]: ./RESEARCH_LEDGER.md#habit-tracking-and-tracker-safety "Self-monitoring safety evidence"
