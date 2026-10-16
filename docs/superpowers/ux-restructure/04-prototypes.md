# Prototypes and owner verdicts

| Page | Version | File | Link (private) | Built by | Primary check | Owner verdict |
|---|---|---|---|---|---|---|
| Tasks | v1 (2026-10-16) | `prototypes/tasks.html` (+ `tasks-notes.md`) | https://claude.ai/artifact/NXrHCqtnRYEC1cCJ1kSazR | Fable 5.1 | Screens: List, Board (Week), Inbox, Archive, phone 390. No horizontal scroll, no console errors. Shows Q1–Q11. Primary added an auto phone mode at ≤600px and moved the prototype toolbar above the bottom nav on phones. | **APPROVED 2026-10-16**; Fable's 5 open questions take their recommended answers |

## Tasks v1: notes
- Publish copy = `tasks.html` minus the doctype/html/head/body wrapper (the artifact host adds its own). To update, edit `tasks.html`, regenerate the copy, and publish to the same URL.
- Known prototype limits: header search is visual only; "Rename view" uses `prompt()`, which the artifact viewer blocks; the phone bottom nav still shows Today/Tasks/Calendar/Goals/More, not the D3.5 default Home/Today/+/Calendar/More (the build uses the D3.5 default).
- Fable's 5 open questions (recommendations in `tasks-notes.md`):
  1. Inbox "This week" → week flag, no plan day.
  2. A task ticked today dims in place until reload or midnight.
  3. No touch drag on the phone Board in v1 (⋯ menu + long-press select).
  4. The Status lens covers this week only.
  5. Board cards hide facts the column already gives.
- impeccable hook: 60 findings not yet triaged (mostly radius values not in DESIGN.md); run `/impeccable audit` before the build.
