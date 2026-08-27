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
