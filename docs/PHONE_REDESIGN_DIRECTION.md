# Phone redesign direction: Daily Desk

## Scope and boundary

This redesign applies to screens **680px wide and below**. It preserves every existing task, goal, project, calendar, habit, review, category, offline-capture, AI-draft, iPhone-calendar, and phone-reminder capability. It changes presentation, navigation, touch ergonomics, hierarchy, and disclosure only. Automatic reminder delivery remains deferred, and the installed iPhone device/cadence controls retain their current behavior.

## Design read

The mobile product is a high-frequency personal operating surface used between meetings, during transitions, and at the start or end of the day. It should feel like a compact **Daily Desk**, not a scaled-down desktop dashboard: the next decision is immediately legible, actions are comfortable to tap, and supporting signals remain reachable without competing with the plan.

| Layer | Direction | Reason |
| --- | --- | --- |
| Visual world | Preserve Smoked Verdigris materials, Onest interface type, IBM Plex Mono dates/data, and the single deep-verdigis action color. | The product remains recognizable and low-glare rather than becoming a generic consumer app. |
| Mobile hierarchy | A large route heading and date sit above a dedicated capture deck; the primary planning panel is visually first; supporting planning bands become clearly separated rows or disclosures. | The current equal-weight compact cards make the next action hard to identify. |
| Navigation | Four immediate destinations—Today, Tasks, Calendar, Goals—use a thumb-safe bottom bar. A fifth **More** control opens a labeled sheet for Habits and Review. | Six tiny destinations are unreadable at phone widths; every destination remains one direct action away. |
| Controls | Direct actions are at least 44px in their touch dimension. Visible labels use a minimum 14px interface size; explanatory text uses 14–16px with a relaxed line height. | Phone reading and touch precision are functional requirements, not decoration. |
| Structure | A route is composed as a small number of strong surfaces with internal divider rhythm. Supporting details use expandable bands, horizontal carousel rails only where the content is genuinely scanable, and full-width focused panels for forms. | This reduces nested-card noise without removing data or actions. |
| Motion | Presses respond within 140ms. The More sheet and route changes use a restrained opacity/transform transition; reduced-motion users see the final state immediately. | Motion communicates a changed context without slowing recurrent planning actions. |

## First-view contract

On Today, the first phone viewport must show, in order: the local date and route title, an obvious task capture control, the immediate-focus panel, and the start of the time canvas. The top-level action must remain reachable without scrolling, and the bottom navigation must never cover an active input, action, toast, or calendar control.

## Route transformations

| Route | Phone-first transformation | Retained behavior |
| --- | --- | --- |
| Today | Daily Desk header; large capture deck; focus panel first; time canvas follows; horizon, habits, capacity, and analytics become clearly separated supporting sections. | Completion, nearby-day rescheduling, offline capture, scheduling, goal/habit actions, analytics, Calendar link, and Phone reminders. |
| Tasks | Search becomes a full-width tool; filters become a scrollable labeled control row; task rows gain larger scanable actions. | Search, filters, saved views, bulk actions, task edits, scheduling, and lifecycle behavior. |
| Calendar | A compact date/mode control strip precedes the primary view; matrix scrolling has a visible cue and preserves day/task context. | Day/week/month/quarter/year planning and drag/drop. |
| Goals | Goal runway cards become single-column decision sheets with paced progress and a visible next action. | Goal, project, milestone, archive, and horizon-compass behavior. |
| Habits | The habit tracker becomes a dedicated full-width rhythm surface; direct complete/skip/undo stays high contrast and thumb-reachable. | Scheduled check-ins, history, streaks, calendar, skip/undo, and retries. |
| Review | The review prompt, current signals, and start action become an ordered phone flow rather than a compressed two-column layout. | Review creation, history, analytics, and editing behavior. |

## Verification criteria

The redesign is complete only when all six routes render without page-level horizontal overflow at 320px, 375px, 414px, and 768px; primary text and actions remain readable at normal iPhone zoom; every route is reachable from the five-slot mobile navigation pattern; keyboard focus remains visible; reduced motion is respected; and desktop behavior remains visually and functionally intact.
