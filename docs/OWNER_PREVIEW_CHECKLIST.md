# Owner preview and animation checklist (D2, 2026-10-13)

The owner runs these checks; agents do not run Vercel checks (gated). Report back with: what snapped instead of animating, anything that felt slow or janky, anything clipped, and any wrong numbers.

## Today layout pass (pushed `f17f473`, 2026-10-17)
Where: the private gallery https://claude.ai/artifact/C8SxpNFfdPt1jp6SHqQv9A (screens), or the local demo / auto Vercel Preview for `dev/personal-calendar-premium-v2`.
- Page order: hero + Today's list first; habits due and the timeline beside them (desktop) or below (phone).
- Every row has one circle; a tick dims the row in place and shows Undo for 5 s.
- Habits due = chips only (the heatmap lives in Habits). Tap fills the ring.
- Plan my day: leftovers + energy, then the pick tray with the capacity bar, then an optional time slot.
- Shut down: Close day stays locked until every item has a choice; an item pushed back 3+ times can't go to Tomorrow.
- Motion, drag onto the timeline and swipe-to-tick are NOT in this pass (the interaction pass is next).

## Tasks T2a + T2b-1 (pushed `23f891a`, 2026-10-17)
Where: the local demo window at http://127.0.0.1:3200/ (synthetic data) or the auto Vercel Preview for `dev/personal-calendar-premium-v2`.
- Tasks has ONE header with one Capture button (press C).
- Tabs Inbox (count) · List · Board · Archive. List groups Overdue · Today · This week · Later · Someday, each collapsible; the Group switch offers When / Project / Category and is remembered.
- Rows: at most 2 smart pills plus the "why it matters" chip (e.g. "Milestone in 9 days", "On today's plan"); titles line up.
- Inbox: only undecided tasks; triage to a day, project or Someday removes the card.
- Board opens on the Week view: Unscheduled + Mon–Sun, ← → paging, Today chip. Drag a card to a day → "Planned for … · Undo". A drop after the deadline → inline "Plan anyway / Move deadline / Cancel". ⋯ on a card = Plan today/tomorrow/weekday.
- Status switch: To do · Doing · Done (this week only).
- Phone 390: nothing scrolls sideways; the toolbar fits.
- Coming in T2b-2: bulk bar, saved-view pills, detail opening animation, swipe rows.

## Why it looked old or empty (owner report, 2026-10-13)

- `https://personal-calander.vercel.app` and the installed home-screen app are **production**, built from `main`, so they still run the old code. The redesign is only on the branch Preview below; its bundle was confirmed to contain the D2 Dashboard code.
- The dev database behind the Preview is empty (one user, zero tasks), so the Dashboard had nothing to count or animate.
- Inner surfaces (Focus, Tasks, Habits, Plan inner panels, Review, Settings) still have the old look because D3 onwards hasn't been built. A redesign map is being drafted (Fable, 2026-10-13).
- Fix: use the rich demo preview. It is ready, verified 2026-10-13 with no errors and no unexpected calls.
  1. In the worktree, run `npx vite --port 3100 --strictPort --host 127.0.0.1` (skip this if it's already running).
  2. Run `python scripts/open-demo-preview.py`. For the phone look in dark mode, add `--theme dark --width 390 --height 844`.
  - **What's in it:** 53 tasks (one running right now), 6 habits with 30 days of history, about 24 focus sessions, calendar events, goals, projects and reviews. It uses the real clock in Auckland time.
  - **Clicks:** they work (tick habits, start/pause/finish focus, complete tasks). Data resets each launch. AI drafting is off in the demo.
  - **Safety:** every request is answered inside the browser, so nothing reaches a live database.
- Also fixed: headers showed tomorrow's date in NZ (`b580222`).

## Where to look

1. **Vercel Preview (real sign-in, dev data).** Commit `1acc7ec` (includes D2 `d3b25da`), deployment status: success.
   - URL: https://personal-calander-6wkxtwevp-yashnew869-2746s-projects.vercel.app
   - Open it on the iPhone in Safari and on the laptop. If Vercel asks you to log in, that is deployment protection; use your Vercel account.
   - It reads and writes the dev Supabase project, not production.
2. **Local, synthetic data (no live reads or writes).** In the worktree:
   - `npx vite --port 3100 --strictPort --host 127.0.0.1`
   - then `python scripts/open-local-preview.py`, add `--theme dark` for dark mode, or `--width 390 --height 844` for phone size.

## What to check

| # | Where | Do this | Expect |
|---|---|---|---|
| 1 | Dashboard (first screen after sign-in) | Load the page | Cards rise in a short stagger; numbers roll up; progress ring fills; card headers have tinted icon tiles |
| 2 | Dashboard hero | Watch for ~10s | Slow, subtle colour drift (ambient only) |
| 3 | Dashboard, all of today's items done | Finish the last item | Ring glows and a check draws in |
| 4 | Dashboard habits card | Tap a habit check-in | Spring tick, small burst, streak flame. On phone, check whether the burst is clipped inside the habit scroller |
| 5 | Schedule card and Up next card | Look during the day, ideally while an item is in progress | Schedule: a pulsing dot on the "now" line. Up next: a live dot only when the item is happening now |
| 6 | Laptop sidebar | Click Dashboard → Today → Tasks → Calendar | Highlight **glides** between items and the active icon pops. Tell me if it **snaps** instead (known unverified risk) |
| 7 | Phone bottom bar | Tap each shortcut | Highlight glides, active icon pops |
| 8 | Phone bottom bar "+" | Press and hold, then tap | "+" turns into "×"; capture opens |
| 9 | Command palette | Ctrl+K (laptop) | Opens with a background blur |
| 10 | Dark mode | Switch theme | Same motion, readable contrast, category colours still labelled |
| 11 | iPhone Reduce Motion | Settings → Accessibility → Motion → Reduce Motion on, reload | Everything appears instantly, no drift, pulse or burst |
| 12 | Phone "Home" | Tap Home on the phone | Known: it still opens Today, not the Dashboard (waiting on the shortcut decision) |

## Decided since

Phone bottom bar moves to Home / Today / + / Calendar / More in slice D3.5 (see DECISIONS.md, 2026-10-13). Until then the bar shown in the Preview is the old one.

## D2.5 Focus (pushed `fc87b33`; check after D3.5 with the demo preview)

- **Dashboard focus card:** dark while a session is live, white when idle.
- **Focus screen:** after you finish a session it opens on "What next?" for 10 minutes. "Start another focus" goes back to setup.
- **Review fixes (pushed):** the "Now" card shows "Open focus" when a session is already running. "Done" is greyed out with a reason when the task can't be completed from Focus.
- **Now-line:** the hour label next to the red time pill hides while they would overlap. Check that no label is ever covered.

