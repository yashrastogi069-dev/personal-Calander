# Personal Calander Upgrade Changelog

## Verified reliability and interaction work

The habit tracker now treats a completion, an intentional skip, and an unrecorded day as distinct states. A second tap is a **true undo**: the scoped check-in row is deleted rather than silently rewritten as `skipped`. Each previous or current day in the seven-day trace can be corrected. The user may also choose **Skip today**, and both the immediate state and fresh workspace snapshot preserve that choice. Check-in writes disable competing controls while pending, show inline failure copy on error, and offer a retry that repeats the original intended action.

This workflow has browser evidence for completion, undo, skip, reload persistence, controlled transport failure, retry recovery, and state restoration. The backend has service, router, and rule tests covering the successful and invalid paths.

## Planning and analytics work

The workspace snapshot now returns dated task occurrences and persisted review sessions in the requested local-date range. The focus workflow surfaces due recurring work with explicit **Done**, **Skip**, and **Missed** outcomes. The dashboard computes decision signals only from stored planning data: schedule reliability, carryover pressure, blocked-work age, estimate coverage, and goals with visible progress. It deliberately does not claim estimate accuracy because the current model does not yet store actual time spent.

## Calendar, installation, and notification readiness

The private iCalendar subscription remains the first iPhone Calendar connection. It is read-only, token-protected, revocable, and intentionally does not imply two-way iCloud sync. The client includes an installable web-app manifest, service worker, and adaptive app icon. A user-gesture control can request browser notification permission, but it clearly states that reminder delivery remains inactive until a VAPID key pair, server delivery service, stored subscriptions, and a user-controlled reminder schedule are configured.

> **Activation boundary:** Do not claim that phone reminders or provider calendar sync are live until the user supplies credentials, grants device permission, and the server delivery or OAuth adapter workflow has been implemented and tested.

## Visual direction

The former bright mint treatment was recalibrated to **Smoked Verdigris**: a low-glare smoked-stone canvas, muted mineral surfaces, restrained verdigris for decisions, flatter elevation, and reduced background decoration. The resulting planner was inspected at 1280×720 and 375×812. The product remains intentionally light, but avoids a high-brightness white wash.

## Validation snapshot

The latest validated local run completed `pnpm check` and `pnpm test` with **18 passing Vitest tests**. The public repository is synchronized at commit `0c53712`.
