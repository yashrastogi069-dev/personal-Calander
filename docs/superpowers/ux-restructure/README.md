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
5. **Competitor references:** `C:\Users\win 10\Desktop\personal-Calander\Screenshots of competition` (60 PNGs from 2026-10-03; Asana, Sunsama, monday and others; filenames are timestamps only). More references the owner pointed to (2026-10-15):
   - `C:\Users\win 10\Desktop\personal-Calander\BEST Shots` (8 images; the visual bar used for the Dashboard and Focus, e.g. the Coterie time tracker)
   - `C:\Users\win 10\Desktop\personal-Calander\design-system\personal-calander\concepts` (8 earlier concept boards from 2026-10-03/04: beyond-tasks, beyond-timeline, beyond-today, blue-workspace-preview, focus-studio, habit-rhythm, overview, week-studio)

   All three folders feed step 2.
6. **Overall goal unchanged:** complete everything up to and including D4.

## Process and status
| Step | What | Who | Status |
|---|---|---|---|
| 0 | R3 `useTaskDnd` drag logic (kept; any Board design needs it) | opus | DONE `1d6854f` (35 new tests; tasks/shared 196/196; tsc clean; not mounted yet) |
| 1 | Structure map of every page: purpose, contents, data, entry points, overlaps, dead ends, legacy leftovers, and what Inbox, Saved views and Archived do today, with screenshots of the current app | opus | DONE `ad28ca9` (40 surfaces, question bank) |
| 2 | Reference catalogue: the 60 competitor screenshots (which app, what pattern, what to steal for which page), the 8 `BEST Shots` and the 8 concept boards (which ideas map to which page) | opus | DONE `a20a1bb` (76 images catalogued, visual rules) |
| 3 | grill-me interview rounds, one page at a time (Tasks first, then Today, Calendar, Plan, Roadmap, Goals & Projects, Habits, Review/Analytics, Inbox, Settings and More). Answers go to `03-interview-log.md` and decisions to `docs/DECISIONS.md` | primary with the owner | IN PROGRESS: Tasks Q1–Q11 locked; Today Q12–Q16 locked; Q17 next (see `03-interview-log.md`) |
| 4 | Prototypes per page for owner review (published artifacts or demo screens) | Fable designs, Opus builds | Tasks prototype: first Fable run hit the rate limit (no files); v1 DONE 2026-10-16 (`prototypes/tasks.html`, published privately https://claude.ai/artifact/NXrHCqtnRYEC1cCJ1kSazR); awaiting owner verdict (see `04-prototypes.md`) |
| 5 | Build approved pages; D3b visuals, D3c, the D3.5 nav and D4 reasons land inside them | opus | after approval |

**Done in the interview gaps** (layout-independent logic, so no rework):
- R3 drag logic
- D4 reason engine (pure)
- D3.5 hooks DONE `0aef6b7`: `useSwipeRow`, `usePullToRefresh`, `useScrollShrink`, `useLongPress`, `useDaySwipe` + `swipeMath`/`gestureOwner`; phone bar default Home/Today/+/Calendar/More (14 files / 153 tests, tsc clean; NOT mounted yet; usePinchZoom, useRouteSlide, phoneNavModel not built)

**Paused:** R4 Board visuals and D3c. Do not build them from the old D3 spec; the interviews may change them.

## Files here
- `01-structure-map.md`: the Opus map of every page (step 1)
- `02-competitor-patterns.md`: the competitor catalogue (step 2)
- `03-interview-log.md`: every question, the recommendation, and the owner's answer, in order
- `04-prototypes.md`: prototype links and owner verdicts

## Agents and skills (owner assumption review, 2026-10-15)
- **Fable needs a one-line owner confirmation before every run** (owner 2026-10-16; confirmation only, not a ban).
- **Up to 2 subagents may run at once** (correction: not strictly one). Never 3 or more.
- **Routing confirmed:** Fable 5.1 plans and designs (specs, mockups, prototypes); Opus builds visuals and logic, and does mapping for now; Sonnet does low-level mechanical work only.
- **Design skills switched on for this project** in `personal-Calander/.claude/settings.local.json` (gitignored). They were installed but set `"off"` globally in `~/.claude/settings.json`. The list: gstack, design-shotgun ("shogan"), design-consultation, design-review, design-html, design-system, plan-design-review, high-end-visual-design, redesign-existing-projects, sleek-design-mobile-apps, minimalist-ui, image-to-code, design-taste-frontend, ui-ux-pro-max.
- They take effect in sessions started in `personal-Calander`. The worktree copy of the file was blocked by the safety check. In any session, agents can read `C:\Users\win 10\.claude\skills\<name>\SKILL.md` directly and follow it.
- **gstack's design binary is built** (`~/.claude/skills/gstack/design/dist/design.exe`). design-shotgun can generate variants and comparison boards; without an image API key it falls back to HTML wireframes. Do NOT add gstack's suggested CLAUDE.md block ("never use claude-in-chrome"); it conflicts with the owner's global tool routing.
- **"morfizam":** no such skill is installed. Probably a "-morphism" style skill (e.g. TypeUI glassmorphism). Waiting on the owner to confirm before installing anything.
- Already loaded skills: impeccable, emilkowal-animations, grill-me, llm-council.

## Constraints that still apply
- Real data only.
- Reduced motion is always honoured.
- Motion timing follows M1 (`f7282f0`).
- At most 2 subagents at a time (owner laptop rule, updated 2026-10-15).
- Gated: G1–G3, Vercel checks, live DB writes, migrations.
- Never push to main.
