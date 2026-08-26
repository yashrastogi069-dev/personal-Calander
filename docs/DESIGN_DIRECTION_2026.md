# Personal Calander — Operating System Redesign Direction

## Design thesis

> **A personal planning studio for deciding what deserves time, then seeing the consequence of that decision.**

Personal Calander will no longer present every capability as a similar rounded dashboard card. The visual system will make a current decision, its time cost, and its long-horizon consequence legible in seconds. This is an operating interface, not a wellness moodboard and not a generic analytics dashboard.

## Use scene and visual world

The product is used at a desk or on a phone between interruptions, when the user needs enough composure to make a good next decision without losing the urgency of the moment. The interface therefore uses a **mineral workbench** world: matte off-white paper, graphite structure, deep ink text, calibrated copper for irreversible commitments, and a cool blue-green for temporal context. The palette is high-contrast enough for daylight use, while the soft material treatment removes visual noise rather than making the product timid.

| System layer | Direction |
| --- | --- |
| **Ground** | Warm mineral white with faint blue-grey atmospheric depth; no decorative gradients used as substitute content. |
| **Structure** | Graphite hairlines, intentional open space, asymmetrical column relationships, and fewer bordered containers. |
| **Commitment** | Copper/orange only for primary creation, a selected current decision, and true recovery attention. |
| **Time** | Muted blue-green field for schedule, capacity, and temporal navigation. |
| **Direction** | Moss/evergreen signal reserved for goals, progress, and rhythmic continuity. |
| **Typography** | A characterful but operational display face for route titles, a humanist workhorse for detail, and mono only for dates, time, quantities, and system labels. |

## Information architecture and action tiers

The existing six destinations remain intact. **Today** becomes the command surface; **Tasks** becomes the inventory workbench; **Calendar** becomes the time field; **Goals** becomes the strategy map; **Habits** becomes the rhythm ledger; and **Review** becomes the closeout ritual. The current phone IA remains four direct destinations plus More for Habits and Review, preserving thumb reach and all destination coverage.

| Action tier | Role | Examples |
| --- | --- | --- |
| **Command** | The one action that changes the route’s primary state | Create a task, commit a habit check-in, begin a review. |
| **Context** | Actions tied to a visible object | Complete, reschedule, edit, add milestone, move calendar day. |
| **Utility** | Important but non-immediate systems | Categories, private iCalendar, device connection, reminder cadence, AI draft. |

## Data-driven planning artifacts

The redesign adds no fabricated statistics. Instead, it gives current data a clearer physical form: a **Focus Cue** built from today’s open task state, an **Attention Ledger** driven by planned minutes and capacity, a **Horizon Link** driven by goal/milestone evidence, a **Rhythm Ledger** driven by habit schedule/check-ins, and a **Review Pulse** driven by existing dashboard signals and completion history.

## Interaction and responsive rules

Primary touch controls must be at least 44px. Every action keeps its visible text label or accessible name. Motion communicates spatial movement or completed state only, uses transform/opacity/color/shadow under 240ms, and is reduced under `prefers-reduced-motion`. Desktop uses an intentional command-to-time ratio rather than equal columns; phone stacks the decision sequence in that order, preserving a fixed safe-area-aware navigation layer. All routes must remain usable at 320, 375, 390/414, 768, and desktop widths without horizontal page overflow.

## Implementation roadmap

The first cohesive visual batch will replace global tokens, rail/topbar/navigation grammar, route-title treatment, action hierarchy, and the Today workbench. Subsequent batches will give Tasks, Calendar, Goals, Habits, and Review their own purposeful forms inside the same system, then validate behavior and public release evidence. Device controls and scheduled reminders are utility content only; their existing state and the paused automatic-delivery boundary are immutable during this work.
