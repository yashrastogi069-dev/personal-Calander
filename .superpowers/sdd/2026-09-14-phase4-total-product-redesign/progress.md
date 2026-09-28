# SDD ledger — plan: docs/superpowers/plans/2026-09-14-phase4-total-product-redesign.md

## Preflight

- Branch verified: `dev/personal-calendar-workbench`.
- Binding spec read: `docs/superpowers/specs/2026-09-14-phase4-total-product-redesign.md`.
- Baseline: TypeScript pass; 64/64 Vitest files, 274 passed and 3 expected skips; Vite build pass; PWA release `ba8a0e16ab6ba54a` with 20 shell files.
- Existing user-owned dirty files: `.gitignore`, `scripts/preview-auth-states.py`. Never stage, rewrite, or include them.
- Intentional pre-implementation docs: `docs/AGENT_FLOW.md`, `docs/PHASE4_DESIGN_AUDIT.md`, `docs/PHASE4_CAPABILITY_LEDGER.md`, `docs/PHASE4_COMPETITIVE_RESEARCH.md`, `docs/PHASE5_ANALYTICS_BACKLOG.md`, Phase 4 spec and plan.
- The prescribed Bash `sdd-workspace` helper could not create this Windows workspace reliably even with approved WSL access; the exact plan-scoped git-ignored directory and ledger were created with `apply_patch` instead.

## Task/interface consistency scan

| Task | Produces / consumes | Self-consistency and downstream interaction |
| --- | --- | --- |
| 1 | Evidence template and capability traceability | Documentation-only baseline; consumed by every later task. Consistent. |
| 2 | Immutable prototype fixture/reducer | Synthetic IDs only; consumed by Task 3 and browser gate. Consistent. |
| 3 | Authenticated prototype route and A/B/C UI | Consumes Task 2; isolated from tRPC/offline mutations; consumed by Task 4. Consistent. |
| 4 | Browser evidence and visual decision | Consumes Task 3; blocks Task 5 styling. Required owner gate is intentional. |
| 5 | Semantic tokens, theme contract, sheet primitive | Consumes selected variant; reused by shell/tasks/recovery/settings. Consistent. |
| 6 | Navigation/location/preferences compatibility | Produces stable destination and alias contracts for Tasks 7, 11, 20, 21. Consistent. |
| 7 | Stable shell and browser harness | Consumes Tasks 5–6; leaves domain orchestration in Home; later tasks extend harness. Consistent. |
| 8 | Additive Phase 4 schema and isolated migration proof | Produces nullable/default-safe fields and new history tables; no live mutation. Consistent. |
| 9 | Guarded live migration controller | Consumes exact Task 8 SQL; stops for explicit live approval. Security gate is intentional. |
| 10 | Canonical Today/task pure projections | Consumes existing and additive snapshot facts; reused by Tasks 11–12. Consistent. |
| 11 | Tasks/Inbox/Capture/Search extraction | Consumes Tasks 5–7 and 10; retains current mutation paths and task-first offline scope. Consistent. |
| 12 | Home/Today workspace | Consumes Task 10/11 presentation and existing habit/task actions; feeds Recovery and Overview. Consistent. |
| 13 | Transactional Strict recovery service | Requires applied Task 8 schema after Task 9 approval; preserves old daily-plan states. Consistent. |
| 14 | Recovery UI and accountability preference | Consumes Task 13; reuses sheet and Today/Plan entry points. Consistent. |
| 15 | Plan/Calendar refinement | Consumes recovery and shell; preserves due/planned/reserved/focus distinctions. Consistent. |
| 16 | Outcome/Direction semantics and destination | Consumes additive goal metadata; preserves null legacy behavior and progress modes. Consistent. |
| 17 | Project detail and Roadmap | Consumes Tasks 8/16 and project dependencies; provides Overview drill-through. Consistent. |
| 18 | Habit return guidance | Consumes existing check-in/schedule truth; adds no fake backlog or history rewrite. Consistent. |
| 19 | Persistent Focus control | Consumes confirmed focus session state and shell; no time inferred from reservation. Consistent. |
| 20 | Bounded Overview | Consumes established projections from Tasks 12–19; device-local layout only. Consistent. |
| 21 | Review/Insights/Settings consolidation | Consumes shell/preferences and existing reviews/connections; adds no Phase 5 analytics. Consistent. |
| 22 | Accessibility, large-data, bundle reduction | Consumes all production UI slices; removes superseded CSS rather than piling overrides. Consistent. |
| 23 | Notification settings and Preview handoff | Consumes existing delivery contracts; last slice; stops for external push/deploy authorization. Consistent. |

## Shared-file and interface pairs

| Tasks | Shared surface | Finding / ruling |
| --- | --- | --- |
| 3 → 5 | `App.tsx`, theme/CSS | Prototype selectors stay isolated; Task 5 must not restyle them. |
| 5 → 7/11/14/21 | tokens and `PlannerSheet` | One semantic source; no new competing root token block. |
| 6 → 7/11/20/21 | location and preferences | Legacy IDs stay accepted aliases; original preference JSON backed up. |
| 7 → 11/12/14/16/20/21/22 | `Home.tsx`, shell, harness | Incremental extraction only; stable auth/workspace/sync boundary remains mounted. |
| 8 → 9/13/16/17 | schema and migration | Authoring is separate from live apply; new code selecting fields cannot deploy before verified migration. |
| 10 → 11/12/20 | task/Today projections | One record ID across every view; no copied task state. |
| 11 → 12/15/16/17 | canonical task detail/actions | Secondary fields remain reachable; destination changes cannot remove mutations. |
| 12 → 14/20 | Today and recovery/Overview | Recovery count may summarize but must not duplicate actionable task rows. |
| 13 → 14 | Strict domain action and UI | Reduce/Pause require additive evidence; compound writes stay online-only. |
| 15 → 17 | Plan Calendar and Roadmap | Day scheduling and long-horizon timeline share dates but not mutation semantics. |
| 16 → 17/20/21 | intention semantics | Direction hides artificial percentage but preserves stored progress configuration/details. |
| 17 → 20 | Roadmap and Overview | Overview points to canonical project/milestone records; no duplicate progress. |
| 18 → 20/21 | habit recovery and Overview/Review | Missed facts remain history; no unlimited mandatory backlog. |
| 19 → 7/12/21 | Focus and shell/Today/Review | Persistent control is a view of confirmed session state only. |
| 20 → 21/22 | Overview preferences and Settings/performance | Bounded module config stays device-local and lazy; no enterprise widget builder. |
| 21 → 23 | Settings and notifications | Notification row is reserved until last slice; no premature delivery claim. |

## Rulings

- Ruling: use Today as the default Home view and keep Overview one tap away — matches approved architecture and prevents an analytics-style landing page from displacing action — cost if wrong: later change to remembered-last-view behavior.
- Ruling: visual selection occurs after functional prototype evidence, before production styling — preserves the user's requested visual review while allowing uninterrupted research and prototype work — cost if wrong: one prototype iteration.
- Ruling: Phase 5 analytics stays deferred; Phase 4 preserves provenance/history only — prevents scope dilution — cost if wrong: later analytics may require an additive event ledger.
- Ruling: do not apply schema migration, push the branch, deploy Preview, merge `main`, or activate external delivery without the explicit gate named in the plan — protects live data and shared systems — cost if wrong: execution pauses at those gates.

## Task progress

- Task 1: complete (commits `ad092cb..4c29cac`, review clean).
- Task 1 review confirmations: the controller created and read the pre-task capability ledger, so its statements are known preserved; controller-observed baseline commands passed before dispatch; tool/action history confirms no external mutation occurred during this documentation-only task.
- Task 2: fix round 1/5 (1 addressed, 0 open; commits `650164f..246bd71`).
- Task 2: complete (commits `4c29cac..246bd71`, review clean).
- Task 3: implementation commit `fb433a7`; focused tests 16/16, TypeScript, Vite build, six responsive prototype scenarios, and 320px stress reported green.
- Task 3 review: FAIL with 0 Critical, 5 Important, 2 Minor. Fix round 1/5 is active for phone Capture reachability, correct selected-task details, reversible viewport controls, A/B contrast, behavioral/isolation coverage, and lane/text semantics.
- Task 3 fix round 1/5: implementation commit `005d233`; implementer reports all 5 Important and 2 Minor addressed with 22/22 focused tests, TypeScript, Vite build, and 320/390px browser smoke green. Fresh re-review active.
- Task 3 re-review: FAIL with 0 Critical, 3 Important, 2 Minor still open. Fix round 2/5 is active for truthful selected-task details, actual click-driven behavioral coverage, impossible ghost task-sheet states, remaining functional font sizes, and a valid typed ownership fixture.
- Task 3 fix round 2/5: implementation commit `8fd940f`; implementer reports 26/26 focused tests including committed local browser interactions, TypeScript, Vite build, and 320/390px smoke green. Second fresh re-review active.
- Task 3 second re-review: FAIL with 0 Critical, 3 Important. Fix round 3/5 is active to replace unmanaged Python/Playwright standard-suite coverage with repository-managed exact-handler contracts, enforce all functional text at 14px or larger, and restore the Roadmap action to a 44px target.
- Task 3 fix round 3/5: implementation commit `872ed90`; portable focused tests 27/27, TypeScript, and Vite build green. Unmanaged browser harness removed; fresh re-review active. External browser validation remains explicitly unclaimed until Task 4.
- Task 3 third re-review: FAIL with 0 Critical, 2 Important. Fix round 4/5 is active for UA-downsized Roadmap labels/scanner coverage and a 36px board completion hit-region override.
- Task 3 fix round 4/5: implementation commit `a668037`; 30/30 focused tests, TypeScript, and Vite build green. Final fresh re-review active.
- Task 3 final review: PASS with no Critical/Important findings, then Task 4 runtime measurement found one additional 40.45×44px Roadmap Year target at phone widths.
- Task 4 diagnostic run: harness self-tests 6/6 and dry-run green; 9 PASS / 9 FAIL across 18 scenarios, all failures caused by the same sub-44px Roadmap Year target. Artifacts: `%TEMP%\personal-calendar-phase4-prototypes-final-20260914-212402`; checksum `02b6138f5929dd85d20dcd9e4a336f7332b0a059c42114ed94cd55058f21f412`. Port/browser cleanup confirmed. Task 4 paused for Task 3 fix round 5/5.
- Task 3 fix round 5/5: commit `07a0bc8`; explicit 44px segmented-control minimum, 31/31 focused tests, TypeScript, and Vite build green. Narrow fresh re-review active before Task 4 rerun.
- Task 3 runtime-fix re-review: PASS with no Critical/Important findings; one Minor source-test future-proofing note accepted because Task 4 measures the rendered target and current cascade is verified safe.
- Task 4: resumed from `07a0bc8` for a fresh 18-scenario evidence matrix and pending-owner selection record.
- Task 4 clean matrix reported 18/18 PASS, but independent review FAIL found four Important harness-proof gaps (redirect escape, method-strict request handling, late-event PASS window, compact density not measured) and two Minor evidence/capture gaps. Fix round 1/5 is active; the owner selection gate remains closed.
- Task 4 fix round 1/5: authoritative artifacts `%TEMP%\personal-calendar-phase4-prototypes-fix1-clean-20260914-220312`; 13/13 self-tests, core 6/6, stress 12/12, manifest 38/38, both densities/four views measured, zero errors/overflow/unexpected requests; fresh re-review PASS with 0 Critical/Important/Minor.
- Task 4: implementation/evidence complete; `Selection: PENDING OWNER DECISION`. No Task 4 commit until the owner chooses A/B/C, lane treatment, default density, and motion refinement. Selection authorizes production styling only.
- Task 4: provisional reversible direction recorded under the owner's autonomous `/goal`: A light architecture, C dark theme, exact R20 lanes, comfortable default/compact optional, 180ms motion with reduced-motion fallback. Evidence/harness/decision committed as `22d1d98`; owner may override before push/deploy.
- Task 5: implementation commit `19d6382`; 30/30 focused/prototype/auth tests, TypeScript, Vite build, and diff check reported green. Independent review active.
- Task 5 review: FAIL with 0 Critical, 4 Important, 2 Minor. Fix round 1/5 is active for Tailwind individual-translate reset, dark alias cascade, unified Toaster theme source, behavioral/cascade test strength, valid focus fallback, and denied-storage resilience.
- Task 5 fix round 1/5: commit `69a078c`; Terra High fallback used after Sol quota exhaustion. Implementer reports 36 focused tests, TypeScript, Vite build, and diff check green. Independent fix review active before checkpoint push.
- Task 5 fix review: DONE_WITH_CONCERNS with 0 Critical, 1 Important (computed `visibility:hidden` return-focus target can suppress Radix fallback). Fix round 2/5 active; checkpoint push remains gated.
- Task 3: complete (commits `246bd71..a668037`, final fresh review PASS with no Critical/Important findings; four evidence-driven fix rounds used).
- Task 3 browser note: the optional post-fix smoke could not cross synthetic auth within 20 seconds; no result was claimed. Task 4 owns production-like browser validation and must solve or document the harness path before the visual gate.
- Task 5: complete after fix rounds; final selected semantic-token/sheet work is present in the branch.
- Task 6: complete (`3803812`); canonical routes and device-preference compatibility reviewed and pushed.
- Task 7: complete (`ce9749b..954d2ab`); stable mounted shell and canonical Calendar review PASS. One non-blocking eager Calendar import note remains for Task 22 bundle work.
- Task 8: complete (`d504e65`); additive Phase 4 schema authored and isolated migration preservation tests passed. Live apply remains separately gated.
- Task 9: complete (`1a5f11a`); guarded controller review PASS, default read-only, and `--apply` was not run.
- Task 10: complete (`351ddc5`, `f737d04`); canonical task/Today selectors and deterministic permutation/recovery regressions passed. The pre-migration Preview compatibility repair is `cee7ec7`.
- Ruling: owner selected Variant A colours as the binding production direction on 2026-09-21. Any dark setting is an accessible A-derived adaptation, not Variant C. Futuristic character comes from hierarchy, depth, motion, and interaction clarity. Cost if wrong: token-level visual revision without record or schema change.
- Ruling: keep automated engineering evidence and physical-iPhone evidence separate. Synthetic success is never labelled real-device success.
- Task 11: complete (`48a6f49`, `2d66fba`, `942fbe0`); Sol High implementation plus two repair rounds, final Astra High re-review PASS with zero Critical/Important/actionable Minor findings. Final verification: 96/96 tests, TypeScript, combined diff checks, and synthetic Chromium at 390/1440. Physical iPhone/Safari, VoiceOver, pointer drag, dark theme, reduced motion, live DB persistence, and production authorization execution remain explicitly unclaimed.
- Task 12: canonical Today implementation complete on the workbench branch. Focused Vitest 72/72, TypeScript, Vite/PWA/server production build, and synthetic Today Chromium 4/4 at 320/390/768/1440 passed; final visual artifacts are `%TEMP%\personal-calendar-phase4-product-20260928T010954Z`. Task/Capture/Search and shell navigation regressions passed 2/2 each. Full Vitest passed 425 with 3 skips except one unrelated pre-existing legacy-provider scan false positive on a `forged` test variable. No live migration, database change, push, deploy, or merge occurred. Task 13/14 recovery schema and Task 20 bounded Overview customization remain later gates.
