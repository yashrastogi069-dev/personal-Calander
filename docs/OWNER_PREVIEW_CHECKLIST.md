# Owner preview and animation checklist (D2, 2026-10-13)

The owner runs these checks; agents do not run Vercel checks (gated). Report back with: what snapped instead of animating, anything that felt slow or janky, anything clipped, and any wrong numbers.

## Why it looked old or empty (owner report, 2026-10-13)

- `https://personal-calander.vercel.app` and the installed home-screen app are **production**, built from `main`, so they still run the old code. The redesign is only on the branch Preview below; its bundle was confirmed to contain the D2 Dashboard code.
- The dev database behind the Preview is empty (one user, zero tasks), so the Dashboard had nothing to count or animate.
- Inner surfaces (Focus, Tasks, Habits, Plan inner panels, Review, Settings) still have the old look because D3 onwards hasn't been built. A redesign map is being drafted (Fable, 2026-10-13).
- Fix: use the rich demo preview (`python scripts/open-demo-preview.py`, being built 2026-10-13). It has lots of fake data on the real clock and never touches live data.

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
