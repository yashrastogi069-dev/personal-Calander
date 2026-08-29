# R23 Premium Visual System

**Status:** Implemented and validated on `dev/personal-calendar-workbench` only.

## Direction

The application now uses one coherent visual language: a mineral daylight canvas, deep ink typography, verdigris actions, pale sage materials, and restrained status accents. The dedicated execution Calendar remains a purposeful timeboxing surface, but its lighter medium verdigris palette now shares the same mint/evergreen identity instead of reading like an unrelated dark product.

| Layer | Decision |
|---|---|
| Canvas | Soft mineral sage with a restrained radial verdigris light, avoiding a flat white or decorative gradient-heavy dashboard. |
| Surfaces | Quiet white and pale sage panels with fine green borders and low-opacity shadows; cards remain useful containers rather than ornamental tiles. |
| Type | Ink-green headings use stronger weight and larger mobile scale; secondary labels use readable green contrast rather than gray-on-gray. |
| Action | Verdigris primary actions, mint selected states, and outlined secondary actions preserve a clear action hierarchy. |
| Status | State remains paired with readable text or icon; destructive/error states stay warm red and read-only busy context stays blue. |
| Dark mode | A distinct dark token layer remains available through system preference/manual theme selection; the execution Calendar has its own localized surface treatment. |

## Phone acceptance

Fresh 390×844 screenshots were captured for Today, Tasks, Habits, Focus, Review, and the dedicated Calendar. The surfaces now read as one product: the same identity mark, title treatment, bottom navigation, verdigris action color, and pale material system recur across destinations. Tasks retain differentiated To do and In progress lanes, while Habits retain their separate tracker/calendar explanation. Calendar shows the same visual family with the lighter medium verdigris timeboxing surface.

The phone layout remains single-column and thumb-aware. Bottom navigation remains inside the safe-area-aware shell, primary controls are tap-accessible, and no required behavior depends on hover. The Calendar’s task actions, date rail, and Add task action remain reachable at phone width. `pnpm test` passed with **39 files and 144 tests**; `pnpm check` and `pnpm build:client` passed. The production build still reports the pre-existing Home bundle opportunity at **1,414.90 kB / 370.61 kB gzip**; lazy destinations remain split.

## Scope boundary

This refinement changes presentation tokens and shared visual selectors only. It does not change task, goal, project, habit, review, reservation, external ICS, reminder, or database semantics. No user planning data was created or modified.
