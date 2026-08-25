# Personal Calander Upgrade Changelog

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

## Validation snapshot

The latest device-control visibility validation completed `pnpm check`, `pnpm test`, and `pnpm build:client` with **49 passing Vitest tests across 11 files**. The broader verification record includes recurrence routing, review-session persistence, analytics rule calculations, category update/removal, goal/project/habit archive contracts, responsive layouts, the visible creation-card inventory, local long-horizon control review, and device-push failure handling. The client bundle retains a non-fatal large-chunk warning that is tracked as a later performance task rather than being hidden as a validation success.

[5]: ./RESEARCH_LEDGER.md#habit-tracking-and-tracker-safety "Habit tracking research ledger"
[6]: ./RESEARCH_LEDGER.md#habit-tracking-and-tracker-safety "Time-to-form-a-habit evidence"
[7]: ./RESEARCH_LEDGER.md#habit-tracking-and-tracker-safety "Self-monitoring safety evidence"
