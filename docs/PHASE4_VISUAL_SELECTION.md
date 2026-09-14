# Phase 4 visual prototype selection

**Selection: PROVISIONAL PRODUCTION DIRECTION — OWNER MAY OVERRIDE BEFORE PUSH OR DEPLOYMENT**

This document records the reversible design decision used to continue the active Phase 4 implementation loop. It is based on the validated prototypes, competitive research, the owner's earlier preference for clarity and dark task lanes, and the owner's instruction to continue autonomously. The owner may override it before any push or deployment.

## Decision record

- Chosen variant: **A — Verdigris Workbench for the default light architecture; C — Night Instrument supplies the selectable dark theme**
- Lane treatment: **retain the exact R20 dark To do / Doing / Done gradients in both themes**
- Default density: **comfortable; compact remains a user setting**
- Motion refinements: **retain the shared short 180ms sheet transition and the tested near-immediate reduced-motion equivalent**
- Decision/date/notes: **provisional designer decision, 2026-09-14; owner may override before push or deployment**

This decision authorizes local production styling work only. It does **not** authorize schema migration, deployment, push, merge, feature removal, planner-data mutation, database reset/baseline replay, or external integrations.

## Evidence identity

- Required branch: `dev/personal-calendar-workbench`
- Original Task 4 base: `a6680372f6aea153db0561382d6b138bcacee31c`
- Validated head after the target-size correction: `07a0bc83be6b102edec4cd10f8e32d21981f6fad`
- Target: `http://127.0.0.1:14774`
- Server: harness-owned Vite transform server with file watching and HMR disabled
- Auth/data: synthetic session, user, and workspace only; no real planner request or mutation
- Fixture source: `shared/phase4Prototype.ts`
- Fixture SHA-256 used by all 18 scenarios: `02b6138f5929dd85d20dcd9e4a336f7332b0a059c42114ed94cd55058f21f412`
- Artifact directory: `C:\Users\WIN10~1\AppData\Local\Temp\personal-calendar-phase4-prototypes-fix1-clean-20260914-220312`
- Results: `phase4-prototype-results.json` — SHA-256 `0e2272214240684486ce4cfcf1f0a073daead17ecbe6c834d0786b6791f66b57`
- Artifact manifest: `artifact-checksums.json` — SHA-256 `422f1329a3bed2de840aab8c100c17657fded26489db9e961353d2fea1ec6541`
- Server log: `preview-server.log` — SHA-256 `09f6832ea1b9030ca9d3c94ede09292aac3c69c17b9460f5c3e1b3b3e6fe4fa1`

Commands:

```powershell
python -B scripts/preview-phase4-prototypes.py --self-test
python -B scripts/preview-phase4-prototypes.py --dry-run --url http://127.0.0.1:14774 --output "$env:TEMP\personal-calendar-phase4-fix1-dryrun"
python -B scripts/preview-phase4-prototypes.py --start-server --url http://127.0.0.1:14774 --output "$env:TEMP\personal-calendar-phase4-prototypes-fix1-clean-20260914-220312"
```

Self-tests passed 13/13. The redirect test proves a loopback 3xx to an external URL is not followed; request-classification tests prove expected font, analytics, and health handling is GET-only; a late-event contract proves finalization fails after a context-closing console error; and a dedicated contract proves any sub-44px target in either dimension is fatal regardless of viewport label. The dry run expanded exactly 6 core and 12 stress scenarios without opening a browser. The fresh browser matrix passed 18/18.

## Core matrix — 6/6 passed

Every core scenario opened Today, Tasks, Roadmap, and Settings; completed and reopened `read-lease`; opened/closed Capture and task detail; verified initial dialog focus, Escape closure, and focus restoration; selected Recovery Reduce, closed, resumed, and cancelled without mutation; previewed/cancelled the Roadmap move; kept the same fixture checksum and no-save notice; reached phone More and the final Settings action; and asserted zero page-level horizontal overflow. Comfortable and compact were each measured independently across all four views for targets, text, representative contrast, and overflow; density coverage is a fatal contract, not a toggle-only observation.

| Scenario | Result | Minimum target | Minimum text | Sampled contrast | Page overflow | Screenshots |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| A · 1440×1000 | PASS | 44×44px | 14px | 5.034:1–16.187:1 | 0px | `phase4-a-desktop-today.png`, `phase4-a-desktop-tasks.png`, `phase4-a-desktop-roadmap.png`, `phase4-a-desktop-settings-final.png` |
| A · 390×844 | PASS | 44×44px | 14px | 5.034:1–16.187:1 | 0px | `phase4-a-phone-today.png`, `phase4-a-phone-tasks.png`, `phase4-a-phone-roadmap.png`, `phase4-a-phone-settings-final.png` |
| B · 1440×1000 | PASS | 44×44px | 14px | 5.156:1–13.835:1 | 0px | `phase4-b-desktop-today.png`, `phase4-b-desktop-tasks.png`, `phase4-b-desktop-roadmap.png`, `phase4-b-desktop-settings-final.png` |
| B · 390×844 | PASS | 44×44px | 14px | 5.156:1–13.835:1 | 0px | `phase4-b-phone-today.png`, `phase4-b-phone-tasks.png`, `phase4-b-phone-roadmap.png`, `phase4-b-phone-settings-final.png` |
| C · 1440×1000 | PASS | 44×44px | 14px | 7.147:1–13.378:1 | 0px | `phase4-c-desktop-today.png`, `phase4-c-desktop-tasks.png`, `phase4-c-desktop-roadmap.png`, `phase4-c-desktop-settings-final.png` |
| C · 390×844 | PASS | 44×44px | 14px | 7.147:1–13.378:1 | 0px | `phase4-c-phone-today.png`, `phase4-c-phone-tasks.png`, `phase4-c-phone-roadmap.png`, `phase4-c-phone-settings-final.png` |

### Density evidence

The following minima come from separate comfortable and compact measurements of Today, Tasks, Roadmap, and Settings in each core scenario. Every density/view pair was present; any missing pair or failing measurement would fail the scenario.

| Core scenario | Comfortable target / text / contrast | Compact target / text / contrast | Comfortable / compact overflow |
| --- | --- | --- | --- |
| A · desktop | 44×44px / 14px / 5.034:1 | 44×44px / 14px / 5.034:1 | 0px / 0px |
| A · phone | 44×44px / 14px / 5.034:1 | 44×44px / 14px / 5.034:1 | 0px / 0px |
| B · desktop | 44×44px / 14px / 5.156:1 | 44×44px / 14px / 5.156:1 | 0px / 0px |
| B · phone | 44×44px / 14px / 5.156:1 | 44×44px / 14px / 5.156:1 | 0px / 0px |
| C · desktop | 44×44px / 14px / 7.147:1 | 44×44px / 14px / 7.147:1 | 0px / 0px |
| C · phone | 44×44px / 14px / 7.147:1 | 44×44px / 14px / 7.147:1 | 0px / 0px |

## Stress matrix — 12/12 passed

Each stress case traversed all four views, kept the no-save notice, reached the final Settings action, and repeated overflow, text, target, contrast, request, console, and runtime checks. A and B were confirmed as representative light treatments; C was confirmed as the representative dark treatment.

| Scenario | Result | Minimum target | Minimum text | Sampled contrast | Overflow | Reduced-motion animation | Screenshot |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| A · 320×844 portrait | PASS | 44×44px | 14px | 5.034:1–16.187:1 | 0px | — | `phase4-a-320-portrait-stress-settings.png` |
| A · 844×390 landscape | PASS | 44×44px | 14px | 5.034:1–16.187:1 | 0px | — | `phase4-a-phone-landscape-stress-settings.png` |
| A · 768×1024 tablet | PASS | 44×44px | 14px | 5.034:1–16.187:1 | 0px | — | `phase4-a-tablet-768-stress-settings.png` |
| A · reduced motion | PASS | 44×44px | 14px | 5.034:1–16.187:1 | 0px | 0.00001s | `phase4-a-reduced-motion-stress-settings.png` |
| B · 320×844 portrait | PASS | 44×44px | 14px | 5.156:1–13.835:1 | 0px | — | `phase4-b-320-portrait-stress-settings.png` |
| B · 844×390 landscape | PASS | 44×44px | 14px | 5.156:1–13.835:1 | 0px | — | `phase4-b-phone-landscape-stress-settings.png` |
| B · 768×1024 tablet | PASS | 44×44px | 14px | 5.156:1–13.835:1 | 0px | — | `phase4-b-tablet-768-stress-settings.png` |
| B · reduced motion | PASS | 44×44px | 14px | 5.156:1–13.835:1 | 0px | 0.00001s | `phase4-b-reduced-motion-stress-settings.png` |
| C · 320×844 portrait | PASS | 44×44px | 14px | 7.147:1–13.378:1 | 0px | — | `phase4-c-320-portrait-stress-settings.png` |
| C · 844×390 landscape | PASS | 44×44px | 14px | 7.147:1–13.378:1 | 0px | — | `phase4-c-phone-landscape-stress-settings.png` |
| C · 768×1024 tablet | PASS | 44×44px | 14px | 7.147:1–13.378:1 | 0px | — | `phase4-c-tablet-768-stress-settings.png` |
| C · reduced motion | PASS | 44×44px | 14px | 7.147:1–13.378:1 | 0px | 0.00001s | `phase4-c-reduced-motion-stress-settings.png` |

Across the complete matrix, there were no sub-44px actionable targets, no sub-14px measured functional text, no sampled contrast below 4.5:1, no page overflow, and no runtime errors, console errors, unexpected requests, or planner requests. Every Settings traversal explicitly asserted rendered samples for loading, error, conflict, disabled, saved-locally, and unsupported-offline states. Every scenario saw only locally fulfilled synthetic GET `auth.me`, `auth.workspace`, and health calls. The harness separately recorded 36 expected blocked resource attempts: one GET Google font stylesheet and one GET Vercel debug analytics script per scenario, both fulfilled locally without external network access; any other method is classified as unexpected and fails.

## Visual comparison

| Criterion | A — Verdigris Workbench | B — Quiet Agenda | C — Night Instrument |
| --- | --- | --- | --- |
| Clarity | Strongest immediate structure and task-state scanning; panels and verdigris accents make hierarchy explicit. | Calm reading rhythm and clear typographic hierarchy; lighter boundaries require slightly more attentive lane scanning. | Strong night-time legibility and the highest sampled minimum contrast; dense dark fields remain distinct. |
| Premium feel | Familiar, polished workbench; conservative and continuous with the current identity. | Most editorial and spacious; warm paper, restrained rules, and italic display treatment feel intentionally quiet. | Most instrument-like and distinctive; warm ink plus restrained cyan/verdigris avoids glow-heavy “tech” styling. |
| Density | Comfortable feels structured; compact can reduce spacing without changing targets. | Visually airiest despite identical content; compact is likely the best way to test whether calm becomes too sparse. | Feels densest because dark surfaces visually consolidate regions; comfortable spacing prevents the shell feeling compressed. |
| Lane treatment | Exact R20 To do/Doing/Done dark gradients provide the fastest state differentiation. | Thin state-colored rules and paper lanes reduce large color fields; weakest of the three for at-a-glance lane separation. | Dark blue/teal/green lane family preserves state distinction while remaining coherent with the shell. |
| Phone navigation | Shared five-action navigation is clear and reachable; light verdigris selection is easy to locate. | Shared behavior; warm selected state feels understated and calm. | Shared behavior; cyan selection has the strongest night visibility. |
| Motion | Shared 180ms sheet continuity; immediate 0.00001s reduced-motion equivalent passed. | Same behavior; restrained visual system makes motion least conspicuous. | Same behavior; contrast makes entering surfaces most noticeable without glow. |

## Selection prompts

1. Choose **A** for maximum continuity and the strongest lane scanning, **B** for a quieter editorial planner, or **C** for a coherent night-first instrument.
2. Choose lane treatment independently. Variant B approval does not implicitly replace the requested R20 palette; record that choice explicitly.
3. Choose comfortable or compact as the production default. Both retained the 44px interaction floor in this prototype matrix.
4. Record any motion refinement while preserving the tested reduced-motion equivalent.

## Limitations

- Evidence is Chromium-based synthetic browser validation, not physical-iPhone verification.
- To guarantee zero external requests, the Google Fonts stylesheet was locally stubbed. Screenshots therefore use available browser fallback fonts and do not prove final Onest/IBM Plex Mono rendering.
- Phone Today, Tasks, and Roadmap captures explicitly reset the main scroll container to the top before capture; representative A Today, B Tasks, and C Roadmap phone images were visually checked for visible heading hierarchy. Settings screenshots intentionally show the final-action scroll position.
- Prototype actions are deliberately non-persistent. This validates interaction, state presentation, focus, layout, and isolation—not real save, sync, account, notification, service-worker, or external-integration behavior.
- Computed contrast samples cover representative functional text/control combinations, not an exhaustive pixel audit or 200% zoom/physical-device assessment.
