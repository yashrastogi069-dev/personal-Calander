You are building a LIGHT prototype of the Today + Focus pages for the personal-Calander app. It is for the owner's understanding before the real build, not a full app. Work only in the worktree `C:\Users\win 10\Desktop\personal-Calander\.claude\worktrees\premium-redesign`. Use absolute paths.

## Output
- `docs/superpowers/ux-restructure/prototypes/today-focus.html`: ONE self-contained HTML file (inline CSS/JS, no external scripts; Google Fonts allowed). Target about 30–45 KB. Plus `today-focus-notes.md` (≤60 lines: what each screen shows, which decision it covers, open questions with a recommended answer each).
- Do NOT commit. Do not touch app source code.

## Read first
- Light-prototype standard: `docs/superpowers/ux-restructure/04-prototypes.md`.
- The approved Tasks prototype `prototypes/tasks.html`, for visual language only: reuse its look, tokens, type, white/blue identity, and phone frame/auto phone mode at ≤600px. Read it selectively, it is large.
- Locked decisions in `docs/superpowers/ux-restructure/03-interview-log.md`: Q12–Q17 (Today), Q41b (Focus), Q42–Q49 (D4 reason lines), Q50–Q51 (Google meetings: show on the timeline and the Next-up hero with "Join", count in capacity, never in Tasks).
- `docs/superpowers/ux-restructure/05-product-direction.md` §3 (the daily loop) and §8 P3 (nudges: morning "plan your day", evening shutdown, meeting in N min with Join).
- Design tokens: grep `tokens-v2.css`. Use M1 motion timings; honour prefers-reduced-motion.

## Screens (a small switcher bar at the top; each also works at a phone width of 390px)
1. **Today (desktop + phone):** the Next-up hero ("Standup in 12 min · Join" variant and a "Next task → Start focus" variant, with a "because…" D4 line); a compact timeline with 2 Google meetings (an external style, a Meet chip) and planned blocks; the tickable task list (one check each, an Undo toast on tick, rows dim in place); a habits-due chip row (tap fills the ring, a done chip fades).
2. **Plan my day overlay (3 moves):** leftovers keep/move/let go → a pick tray (Overdue / Due soon / This week) with a live capacity bar ("planned 4h10 of 6h free", meetings counted) → optional drag onto the timeline (a simple click-to-place is fine). Also an optional 5-level energy row. Show how it opens from the morning nudge (a mock push banner "Good morning: 3 tasks, 2 meetings. Plan in 2 min").
3. **Shut down overlay (calm but strict):** Wins (count-up) → Open items with Tomorrow / Pick day / Let go; "Close day" stays disabled until each has a decision; an item carried 3+ times cannot use "Move all" → a one-line reflection → Close day.
4. **Focus:** the normal view with presets (25/5, 50/10, custom) and an intention line; **Immersive** full-screen state (calm ambient motion, static under reduced motion); an ambient sound toggle (brown noise synthesised with Web Audio, starting only on tap; rain optional); the after-session note and a tiny stats strip.

## Rules
- Realistic sample data for one owner's day (job-hunt and study flavour is fine). No lorem ipsum.
- Main interactions only; everything else can be static. No prompt()/alert()/confirm().
- No horizontal scroll at 390px. No console errors.
- Keep it light: if you are past ~45 KB, cut decoration, not screens.

## Verify and report
Screenshot with playwright (python, already installed; the helper is `C:\Users\win 10\.claude\jobs\9a89bdcc\tmp\proto\shot.py`, adapt a copy) at 1280×800 and 390×844 for each screen. Save to `C:\Users\win 10\.claude\jobs\9a89bdcc\tmp\shots\today\`, NOT the repo. Look at them yourself and fix what's off. Close any browser. Report: the file sizes, the screenshot paths, a coverage list per decision, and open questions.
