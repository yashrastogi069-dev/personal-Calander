# C2: connected workspace checkpoint

Date: 2026-10-03. Status: locally verified and authorized for checkpoint push. Branch: `dev/personal-calendar-workbench`. Parent contract: [blue workspace reconstruction](../specs/2026-10-03-blue-workspace-reconstruction.md). The owner explicitly authorized the actual screenshot-led visual build after this checkpoint; the earlier C2 stop is superseded. Live deployment/database gates remain separate.

## Outcome

Stable, understandable navigation and one canonical task inspector, preserving all existing capabilities and record identities. The owner likes Asana's List and fluid, freely explored Timeline. Preserve that interaction direction for C4; C2 establishes context continuity, not a new Timeline engine.

## Independent ownership

- SOL integration: route helpers, Home integration, shell/rail/phone navigation and route tests.
- SOL inspector: TaskDetailSheet, dedicated inspector styles/helpers/tests.
- SOL capture: CaptureSheet, natural-language capture, scoped draft helpers/tests.
- Primary agent: reconcile interfaces, final diff/security review, integrated verification and documentation/checkpoint push.

No Astra is authorized for this checkpoint without a fresh explicit answer. No live planner write, migration, deployment or main merge is authorized. Keep source and skill instructions out of conversation updates; return concise findings and evidence.

## Acceptance checklist

- [ ] Today/Overview, daily/weekly Plan, and Review ritual/history/Insights have distinct canonical views with real existing functionality; full Overview customization remains C6.
- [ ] Legacy URLs, selected records, view context, Back/Forward/reload, customized pins and preference migration remain correct.
- [ ] Exact current page and active parent are distinct; phone More remains usable and desktop rail retains independent scroll.
- [ ] Task inspector prioritizes title/state/action, dates and links, retaining all scheduling, recurrence, dependency, progress/history controls through accessible progressive disclosure.
- [ ] Per-record drafts survive navigation/close appropriately, remain account/workspace scoped, and are not overwritten by a server refresh. Concurrent save does not close a different record or lose newer edits.
- [ ] Capture retains title-only, Today/Inbox choice, current Today/PWA defaults, editable interpretation, templates, AI proposal review, offline/idempotent retries and explicit discard/success semantics.
- [ ] Keyboard focus/close, reduced motion, small-screen/keyboard-safe actions, loading/error/offline boundaries tested.
- [ ] Focused/full tests, TypeScript, production build, responsive synthetic runtime, independent review and capability mapping recorded before completion.

## Evidence boundary

Local acceptance evidence is recorded in [the checkpoint board](../../RECONSTRUCTION_CHECKPOINTS.md): 736 tests passed / 3 skipped, TypeScript and production build passed, navigation 72/72, inspector 16/16 and capture 17/17 synthetic browser checks passed. The checklist above describes implemented capabilities, not a claim of physical-device, font-loading or whole-app visual approval. Those boundaries remain open. C2 is functional continuity; the approved screenshot composition is the next implementation, not delivered by this checkpoint.

Synthetic runtime intercepts planner/auth requests; never submit against actual planner records. Physical iPhone/PWA, real font loading, live schema/provider/notification delivery require separate direct evidence. User-requested 1M context override is a local client configuration, not verified provider capacity. Branch auto-deployment guard remains unchanged.
