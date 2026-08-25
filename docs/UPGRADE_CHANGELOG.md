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

## Validation snapshot

The latest local validation completed `pnpm check`, `pnpm test`, and `pnpm build:client` with **26 passing Vitest tests**. The recurrence update router contract, weekly-series persistence through the actual composer and task editor, review-session start/completion/history, analytics rule calculations, category update/removal, goal/project/habit archive contracts, desktop/mobile layouts, review surface, and every embedded creation-card mapping were checked in the local planner. An independent browser created and archived both a weekday-scheduled and an anchored three-day interval habit, confirmed that only scheduled dates expose check-in actions, and confirmed that the dedicated tracker—not the task calendar—owns the habit workflow. The task-focused Calendar Week view was verified to exclude habit rows. The interface detector reported no findings.

[5]: ./RESEARCH_LEDGER.md#habit-tracking-and-tracker-safety "Habit tracking research ledger"
[6]: ./RESEARCH_LEDGER.md#habit-tracking-and-tracker-safety "Time-to-form-a-habit evidence"
[7]: ./RESEARCH_LEDGER.md#habit-tracking-and-tracker-safety "Self-monitoring safety evidence"
