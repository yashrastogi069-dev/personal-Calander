# UX restructure (2026-10-15 onward)

This folder holds everything about the app-wide UX restructure. Read this file first; it is enough to resume.

## Why
Owner, 2026-10-15: "the DASHBOARD looks great but not other pages. Now we have to make this a very premium app: very modern, classy, aesthetic, with motion, great icons and animations." The owner wants a **total UX rethink**, not a reskin: what each page is for, and how pages fit together. For Tasks, that means:
- the Board and moving tasks around it
- the List
- the Inbox: what is it for?
- Saved views and Archived

Most other pages follow. Dashboard and the Focus/timer redesign (D2, D2.5) are the quality bar and stay as they are.

## Owner decisions (2026-10-15)
1. **Timing: now.** The restructure runs before the D3b Board visuals, D3c, the D3.5 build and D4. The owner agreed.
2. **Mapping: Opus, for every page** ("use opus for the mapping, for now"). Fable is not used for the map.
3. **Interviews: ALL pages, not only Tasks.** Method: the `grill-me` skill. One question at a time, each with a recommended answer. Resolve whatever the codebase can answer before asking. Go depth-first, one page or branch at a time.
4. **Prototypes before building.** The owner reviews prototypes and approves them before any page UI is built.
5. **Competitor references:** `C:\Users\win 10\Desktop\personal-Calander\Screenshots of competition` (60 PNGs from 2026-10-03; Asana, Sunsama, monday and others; filenames are timestamps only). `BEST Shots/` holds the 8 visual references used for the Dashboard.
6. **Overall goal unchanged:** complete everything up to and including D4.

## Process and status
| Step | What | Who | Status |
|---|---|---|---|
| 0 | R3 `useTaskDnd` drag logic (kept; any Board design needs it) | opus | running |
| 1 | Structure map of every page: purpose, contents, data, entry points, overlaps, dead ends, legacy leftovers, and what Inbox, Saved views and Archived do today, with screenshots of the current app | opus | next |
| 2 | Competitor pattern catalogue from the 60 screenshots: which app, what pattern, what to steal for which page | opus | after 1 |
| 3 | grill-me interview rounds, one page at a time (Tasks first, then Today, Calendar, Plan, Roadmap, Goals & Projects, Habits, Review/Analytics, Inbox, Settings and More). Answers go to `03-interview-log.md` and decisions to `docs/DECISIONS.md` | primary with the owner | after 1–2 |
| 4 | Prototypes per page for owner review (published artifacts or demo screens) | Fable designs, Opus builds | after each page's interview |
| 5 | Build approved pages; D3b visuals, D3c, the D3.5 nav and D4 reasons land inside them | opus | after approval |

**Done in the interview gaps** (layout-independent logic, so no rework):
- R3 drag logic
- D4 reason engine (pure)
- D3.5 hooks: `useSwipeRow`, `usePullToRefresh`, `useScrollShrink`

**Paused:** R4 Board visuals and D3c. Do not build them from the old D3 spec; the interviews may change them.

## Files here
- `01-structure-map.md`: the Opus map of every page (step 1)
- `02-competitor-patterns.md`: the competitor catalogue (step 2)
- `03-interview-log.md`: every question, the recommendation, and the owner's answer, in order
- `04-prototypes.md`: prototype links and owner verdicts

## Constraints that still apply
- Real data only.
- Reduced motion is always honoured.
- Motion timing follows M1 (`f7282f0`).
- One subagent at a time (owner laptop rule).
- Gated: G1–G3, Vercel checks, live DB writes, migrations.
- Never push to main.
