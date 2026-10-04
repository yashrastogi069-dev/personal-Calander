# Beyond-preview direction

Status: owner selected Today visual direction and Timeline concept; implementation parity still requires evidence. Date: 2026-10-03.

The owner says the approved screenshot is the minimum standard and explicitly requested further Astra advice and future concepts inspired by Sunsama, Asana and monday. One initial built-in Astra Medium consultation finished; a second owner-authorized bounded Medium consultation ran through the read-only CLI after the built-in thread limit blocked continuation. That second pass received the original concept and synthetic in-progress Today renders, not raw competitor screenshots. Prior competitor research supplied background; a new direct screenshot follow-up requires the answer to the pending approval question.

The owner subsequently approved that short follow-up and selected the new Today concept's UI/Focus/habit visuals with one fixed change: **Work remains above Habits**. They liked the Timeline concept and the Read project notes treatment. The third bounded Astra Medium pass directly compared owner-provided Sunsama day-board and Asana inspector/List/Timeline captures (03/26/35/39 in the research index) with the two selected concepts, then stopped. It made no code changes and ran no tests. No further Astra call is authorized automatically.

Direct comparison priorities: scannable start/duration/context, the same work identity across day/calendar views, retained context while editing, aligned comparison fields, and clear timeline week/month/today orientation. Quick Today/Tasks work stays distinct from the next connected Plan/Projects slice. Never equate stopping Focus with completing the task, backfill fictional habit evidence, turn portfolio projects into task IDs, or invent incoming calendars/free capacity.

## Shared direction

Choose, work, reflect: quiet white working canvas, readable navy text, blue actions, meaningful named project/status color. Improve relationships between tasks, reserved time, habits and longer-term projects. Reduce repeated metadata and competing utility panels; retain all capabilities through labelled controls rather than hiding or deleting them. Slate dark shares the same hierarchy. Existing Onest remains the implementation font; Astra's generic Inter suggestion is not an authorized font replacement.

## Concepts

- [Today: desktop and phone](../../design-system/personal-calander/concepts/2026-10-03-beyond-today-concept.png): earlier compact habit evidence, large honest Focus time, fewer repeated labels, work/day relationship.
- [Tasks and inspector](../../design-system/personal-calander/concepts/2026-10-03-beyond-tasks-concept.png): aligned columns, restrained color identity, a retained detail context, clear schedule/relationship/property sections and consistent dark appearance.
- [Projects timeline](../../design-system/personal-calander/concepts/2026-10-03-beyond-timeline-concept.png): broad freely explored canvas, pinned hierarchy/date axis, project/task layers, milestones, supported dependencies and explicit unscheduled work. This is future C4 scope, not already delivered by the current Today/Tasks checkpoint.

All three are generated with the built-in image generation tool from Astra-informed briefs, not rendered screenshots or an Astra image model. Originals remain in the generation directory and copies above are retained in the project. No real records/credentials are present. Small inaccurate illustrative details are not implementation requirements: the Today concept's ticks extend beyond its displayed date; the Tasks concept highlights Inbox while illustrating List-like rows; the Timeline shows a sample 2024 period. Actual date/state semantics, check-in history and capability mapping must win over those pixels. Do not seed these fictional records or claim depicted columns, inline subtask completion or connections already exist.

## Buildable rules and boundaries

Readable 30/36px page titles, 18/24px section titles and 15/22px work text; phone body at least 14px and touch controls at least 44px. Desktop rail approximately 208–216px, inset 28–32px, restrained 12px panel radii. Active Home watch remains large with real Pause/Resume/Stop semantics; stopping never completes a task. Known estimates and unknown capacity remain distinct. Phone overflow gives Start focus without a third action line on every row.

The current implemented checkpoint retains Work then seven-day Habits on phone and desktop. This is now owner-confirmed, superseding Astra's second-pass suggestion to put Habits first. Keep the loved trace; do not change ordering to satisfy an artificial fold target. Inspector recommendations varied from 360 to 480px: the current layout target is 480px, with readable properties more important than blindly copying a number.

Acceptance needs actual rendered comparison, responsive/keyboard/touch and contrast evidence, real font loading, preserved feature destinations, full tests/typecheck/build and honest limits. No concept supplies physical-device, provider, database, deployment or speed evidence. Main is frozen and Vercel branch auto-deployment remains disabled.

## Prompt set

Built-in `ui-mockup`, white canvas/neutral rail/navy ink/mineral blue, restrained labelled jade/coral/amber/violet; modern readable Onest-like type, 12px panels and quiet rules, synthetic-data label. No neon, gradients, decorative charts, marketing copy or invented integrations.

1. Today comparison: desktop 2:1 work/day layout plus matching phone, real elapsed-style large watch with Pause/Stop separate from task completion, factual planning strip, visible named habits and seven-day evidence, three synthetic tasks with estimates, labelled preview-plan chronology and upcoming milestone.
2. Tasks: spacious ruled working list, removable Open filter, reachable Inbox/List/Board/Saved/Archive, aligned task/project/date/estimate columns, selected task's right inspector with core properties, subtasks and advanced disclosure groups, matching slate-dark inset.
3. Projects: wide weekly timeline with pinned outline/date axis/today marker, coherent labelled project-colored spans, optional child-task layer, milestone diamonds, supported dependencies, unscheduled tray, selected-task inspector and compact phone equivalent.
