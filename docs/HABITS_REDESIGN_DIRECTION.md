# Habits redesign direction: Rhythm Workspace

## The visibility problem

The existing dedicated Habits route is functionally complete, but its most important daily state is visually buried inside a seven-day trace and a separate calendar. On a phone, a person should not need to decode compact squares before knowing which habits matter now or what action is available.

## New phone hierarchy

The route becomes a **Rhythm Workspace** with three intentional layers. The first layer is a current-day rhythm deck: it states the date, today’s completed versus scheduled count, and exposes each currently scheduled habit with a large, state-specific action. The second is the seven-day trace, retained as history and continuity rather than the primary decision. The third is the existing four-week habit calendar, retained as the planning and correction surface. Analytics remains available below these actions without competing with them.

| Layer | User question | Visible design response | Preserved behavior |
| --- | --- | --- | --- |
| Rhythm now | “What should I do today?” | High-contrast completion count and individual 48px-plus action rows. | Complete, skip, undo, scheduled-day logic, pending/error handling. |
| Seven-day trace | “How has this rhythm been going?” | A quieter history strip with calendar squares and streak context. | Existing traces, rest days, and date-specific undo. |
| Habit calendar | “What happened or is planned on another day?” | A distinct calendar surface with selected-day actions. | Existing four-week view, pager, future-date protection, Complete/Skip/Undo. |

## Visual and motion rules

Habits use the warm mineral-green member of the Daily Desk palette, distinct from the cooler time canvas and lichen goal surfaces. Completion is the only strong green state; skipped is neutral and explicit; undo is a quiet reversible action. Each check-in card gives immediate press feedback and reports state in text as well as color. No false streak celebration, fabricated progress, or automatic check-in is introduced.
