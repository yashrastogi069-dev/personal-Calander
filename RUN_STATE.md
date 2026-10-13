# Run state: premium BEST Shots redesign

Owner goal (2026-10-13): finish Plan Studio, then redesign Dashboard and every screen to match and exceed `BEST Shots/` with rich-but-calm motion, keeping the white/blue identity and real data only. Work continuously: after every checkpoint, write HANDOFF.md + this file, commit, push to `dev/personal-calendar-premium-v2`, then continue to the next step (owner 2026-10-13). Ask before a new dependency, a gate, or Fable outside pre-approved moments; always tell the owner when Fable runs.

Branch: `work/premium-redesign` (worktree `.claude/worktrees/premium-redesign`), pushed to `dev/personal-calendar-premium-v2` after verification. Never main. No Vercel checks, live writes or migrations.

Model routing (owner update 2026-10-13, see CLAUDE.md):
- haiku: mechanical edits and greps
- sonnet: read-only exploration and routine screenshot checks
- opus: all logic, architecture, tooling and independent review
- fable (Fable 5.1): ALL UI/UX design and the visual UI build (load `impeccable:impeccable`, `design-taste-frontend` and `emilkowal-animations` first). Always tell the owner. Owner, 2026-10-13: "use FABLE 5.1 not opus for designs".

Design direction (owner standing rule, 2026-10-13): icons, animations and motion must be cool and futuristic, and the UI modern, on every screen. Motion is state-driven, stays under ~300ms, reuses `motion.ts` and the tokens, and honours reduced motion. Real data only. The full rule is in CLAUDE.md under "Design direction"; the D2 delight pass is the bar.

## Steps

| # | Step | Status |
|---|---|---|
| C3 | Plan Studio weekly board + date continuity | Done locally, `8a242e6`; build + 754 tests + harness 36/36 |
| A | Owner approval of redesign sequence (D0-D6, G1-G3) | Approved 2026-10-13 (also @dnd-kit, pill radius, Fable for D0 spec) |
| D0 | Tokens v2, motion, primitives, legacy-green ratchet | Done 2026-10-13: 800 tests, build, Plan harness 36/36, gallery harness 8/8; pushed |
| D1 | Routed shell, grouped sidebar with badges, view tabs, command palette prefixes, phone pill nav | Done 2026-10-13: 808 tests, build; shell 16/16, plan 36/36, gallery 8/8, phase4 nav 2/2 |
| D2 | Dashboard home + one-click Today switch, Schedule card lens | Built locally 2026-10-13, plus the opus delight pass (icons and motion). Typecheck and build pass. Final: full suite 859 passed / 3 skipped (122 files); shell 20/20, plan 36/36, gallery 8/8, phase4 2/2, C2 222/224 (2 timeouts; their re-run 56/56); pushed `d3b25da` |
| D2.5 | Focus redesign: FocusDial, dark live Dashboard card, Focus screen, mini capsule, Finish panel, shared premium pieces (Fable spec + build) | In progress 2026-10-13 |
| D3 | Tasks board drag (needs @dnd-kit approval) | Not started |
| D3.5 | iPhone nav & gestures: glass bar Home/Today/+/Calendar/More, context "+", swipe/long-press/pinch (@use-gesture/react approved), directional slide, launcher More, pull to refresh. Fable designs first | Not started (owner 2026-10-13) |
| D3.5.2 | Browser verification slice (owner 2026-10-13), after D3.5 and its MD updates. Test the work with Playwright (+ CDP for animation timings, perf traces, CPU throttling), playwright-cli and agent-browser/agent-reach, on the demo preview at 1440/390, light/dark, with reduced motion. The owner helps verify animations. Installed: playwright-python 1.60, playwright-cli, agent-browser, agent-reach, Chrome. Missing: browser-use (pip + LLM key), Chrome DevTools MCP (not configured), Claude in Chrome (not connected). Ask the owner for links/approval before installing | Not started |
| D4 | "Why it matters" reasons from existing facts | Not started |
| D5 | Light Analytics | Not started |
| D6 | Polish, empty/first-run states | Not started |
| D7 | Glance & reminders: Calendar feed alerts/categories, app icon badge, lock-screen push (unlocks G2) | Not started (owner 2026-10-13) |
| G1-G3 | Stakes fields, hard reminders, two-way Google sync | Gated (G2 planned inside D7) |

## Handoff (2026-10-13, context checkpoint; owner asked to stop at ~25% context)

- v2.1 preview published as version 4 of the same private canvas https://claude.ai/artifact/92uiB3ukGHrDcPqp9Q1SUo. It has 13 boards: Dashboard / Today / Calendar week / Calendar month, each in light and dark, plus phone Dashboard / Today / Calendar (light and dark).
- PNGs are in `v2-preview/v2.1/` (untracked, do not commit).
- Generator: `tmp/v2gen/gen.py <canvas root> <standalone dir>` writes `tmp/dash-canvas/project/*.dc.html` plus `canvas.json`. Then `tmp/v2gen/shoot.py <standalone dir> <png dir>` renders the PNGs. `tmp/` is gitignored.
- Republish with `root: "tmp/dash-canvas"`, `file_path` set to the absolute path of `canvas.json`, and `files` mapping each `project/X.dc.html` to itself.
- v2.1 adds:
  - A header tablist: Dashboard | Today | Calendar.
  - Validated category palette (Work #2f6fe4, Health #0f9d8a, Learning #c27612, Personal #7a5af0, Social #e0567a; dark #5b8ef0 / #26a089 / #c4852f / #9479ee / #dc5f80), always shown with labels.
  - Status pills (On track / At risk / Off track), planned/actual chips, a stacked focus bar by category, Google busy blocks with hatching, and a pulsing now-line.
  - Today: task list with a timeline and an after-shutdown zone.
  - Calendar week: rail with mini month, unscheduled Overdue / Due today / Due this week, and calendar toggles; all-day multi-day bars.
  - Calendar month: spanning bars.
  - Phone Calendar: week strip with coloured dots. Phone bottom nav now Home / Today / + / Calendar / More.
- Next steps:
  1. Get owner feedback on v2.1.
  2. Optionally run a Fable critique (ask first).
  3. On approval, write the D0 spec `docs/superpowers/specs/2026-10-13-premium-redesign-d0-design.md`, record the decisions in DECISIONS.md, then implement D0.
- Known minor issues:
  - The phone segmented tabs slightly overflow at 390px.
  - The dashboard Up-next card has an empty middle.
  - The Week rhythm card has spare height.
- Not pushed: `4804e95` and this checkpoint commit.
- **2026-10-13 owner APPROVED v2.1 and the plan.** This supersedes the "waiting on D0 approval" note below. Owner direction: keep adding features and make the app progressively more modern and futuristic, with more animation and motion. Reduced motion must still be honoured.
- **Next session starts D0:**
  - Write `docs/superpowers/specs/2026-10-13-premium-redesign-d0-design.md` from the v2.1 boards. Fable is pre-approved for the D0 spec; still tell the owner when it is used.
  - Record the decisions in DECISIONS.md.
  - Implement tokens v2 (palette, radius, elevation, motion) in the app.

## Open owner questions

- 2026-10-13: Fable D0 spec drafted. Visual preview (sample data) published as private Design canvas https://claude.ai/artifact/92uiB3ukGHrDcPqp9Q1SUo (v3) with PNGs in `v2-preview/` (untracked, not committed). Waiting on owner approval of D0 look before writing the spec doc and implementing.
- Owner decisions to record in DECISIONS.md with D0: Roadmap in Plan + Goals & Projects + compact Home strip; Today drops weekly overview and links to the week; Insights becomes Analytics under Reflect; grey backdrop on Dashboard only.

## Checkpoint log

- 2026-10-13 (after the usage-limit reset):
  - The owner said: keep working in a loop until D3.5 is done, and they'll check after D3.5.
  - **D2.5:** Fable's interrupted build was WIP-committed as `91bb8d2` (local). Typecheck fails because two focus tests still use the old props. The Fable build agent was resumed to finish: the Finish flow, the Dashboard dark card, the 4 Dashboard fixes, tests and verification.
  - **D3:** a second Fable agent is writing `docs/superpowers/specs/2026-10-13-premium-redesign-d3-tasks.md`. Install `@dnd-kit` only after D2.5 verification, to avoid lockfile churn mid-build.
  - **Unpushed:** `33d96df`, `b580222`, `773ee0f`, `91bb8d2`. Push after D2.5 passes the full suite.
  - **Model ID:** the usage-limit error for the Fable build agent named `claude-opus-5-5`. Both agents were asked to report their model ID.

- 2026-10-13, D2.5 Focus in progress:
  - Fable spec done, and the owner chose all four recommended answers (DECISIONS.md).
  - Stopped sessions now count (`33d96df`, local; push after D2.5 verification).
  - The habit local start date fix was pushed (`b440ddf`, full suite 860/3 skipped).
  - **Fable 5.1 is building the D2.5 UI.** Files: focus/, DashboardView, components/premium, tokens, Home focus wiring.
  - **Opus is still building the demo preview** in scripts/.
  - Next:
    1. Verify Fable's claims.
    2. Opus logic review.
    3. Full suite + build + harnesses.
    4. Commit, push, give the owner the demo command.
    5. Then D3.

- 2026-10-13 owner report: "things are not wired, still old code, no real data, Focus clock looks BAD; redesign inner surfaces like the Coterie Time tracker (`BEST Shots/WhatsApp Image 2026-10-12 at 4.37.07 PM (6).jpeg`)".
  - Diagnosis: the Preview has D2. The owner saw production and/or empty dev data. Inner surfaces are still old by plan.
  - Running:
    - Fable (owner-approved) is writing `docs/superpowers/specs/2026-10-13-premium-redesign-focus-and-inner-surfaces.md`.
    - Opus is building `scripts/demo-fixtures.py` + `scripts/open-demo-preview.py` (rich fake data, real clock, mutations echo).
  - Next: verify both, show the owner the demo, interview on the redesign map, then re-plan D3+.

- 2026-10-13 after D2 push:
  - The owner will check the Vercel Preview and the animations themselves. The URL and the 12-step list are in `docs/OWNER_PREVIEW_CHECKLIST.md`.
  - Interview round on phone navigation is open: Home/Today/Calendar shortcuts, iPhone gestures and motion, bottom bar vs left panel. See HANDOFF "Open owner questions".
  - D3 starts after the answers, or in parallel if the answers don't affect the Tasks board.

- 2026-10-13 D2 built locally:
  - **Dashboard:** the default landing, built by opus with the design skills loaded.
  - **Logic:** opus independent review; 7 medium findings fixed.
  - **Delight pass:** icons and motion, after the owner asked for "cool icons, animations, motions".
  - **Docs:** spec `docs/superpowers/specs/2026-10-13-premium-redesign-d2-dashboard.md`, decisions in DECISIONS.md, evidence in PHASE4_SLICE_EVIDENCE.md.
  - **Next:** final verification, then commit and push, then D3.
- 2026-10-13 D0 done. Spec `docs/superpowers/specs/2026-10-13-premium-redesign-d0-design.md` (Fable-reviewed, owner told). Code in `client/src/design/` and `client/src/components/premium/`. Evidence in `docs/PHASE4_SLICE_EVIDENCE.md`. Next: D1.

## 2026-10-13 checkpoint — D1 WIP (usage limit)
- D1 shell code committed as WIP. Shell tests 24/24, shell harness 16/16. Full suite 806 pass / 2 fail (server/phase4Shell.test.ts, expected label updates).
- Sonnet visual review done (findings in HANDOFF.md). The opus code review is done (10 findings in HANDOFF.md step 3, including an `npm run check` TS2802 failure).
- Next: follow HANDOFF.md "D1: remaining to-do" steps 1–6, then D2.

## 2026-10-13 checkpoint — D1 done locally
- All 10 opus findings fixed (aria-controls noted) plus the sonnet CSS fixes. 808 tests pass, check and build pass.
- Pending: re-run `preview-premium-shell.py`, `preview-premium-plan.py`, `preview-premium-gallery.py` and `preview-phase4-product.py` once Vite is back (`npx vite --port 3100 --strictPort --host 127.0.0.1`).
- Next: D2 Dashboard.
