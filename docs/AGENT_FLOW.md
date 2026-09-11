# Agent flow and active handoff

Last updated: 2026-09-11

## Working branch and safety

- Branch: `dev/personal-calendar-workbench`; never merge into `main` without explicit user instruction.
- Planner data is real. Never reset the database, replay baseline migrations on populated tables, or replace IDs/workspace history.
- Current source of truth for deployment/migration status: `INDEPENDENT_STACK_HANDOFF.md`.

## Completed in the current independent stack

1. Supabase ownership migration was applied under guarded empty-table conditions.
2. Auth user ↔ application user ↔ one default owner-linked workspace is established.
3. Vercel dev-branch preview is ready and its health endpoint passed.
4. iPhone-first UI pass added safe-area navigation, 44pt controls, existing task gesture support, and device-local phone layout settings.

## Active implementation record

- `client/src/pages/Home.tsx`: phone layout preferences, tab pinning/reordering and density controls.
- `client/src/index.css`: safe-area sheet, adaptive tab bar, compact density, touch targets.
- `docs/PHONE_PREMIUM_REDESIGN_CONTRACT.md`: mobile product contract, edge-case review, and acceptance criteria.
- Preference scope: browser `localStorage`, keyed by workspace ID. It is explicitly not cross-device sync.
- Verification: `tsc --noEmit` and `vite build` passed after the UI update. The Vite large-client-chunk warning is pre-existing/non-blocking.

## Next authorized phases (in user-stated order)

1. Apply private file storage migration after reviewing existing Storage policies/bucket state.
2. Design and connect Apple Calendar/reminders and notifications; validate on a real iPhone.
3. Fix the authenticated mobile Sign out obstruction.

## Latest corrective checkpoint

The initial More sheet was structurally invalid because it lived inside a filtered sticky rail. The fixed overlay could therefore use the rail as its coordinate system. The rail is now viewport-fixed at the phone bottom without that containing effect, while More/settings overlays occupy the viewport above it. The local 390×844 Playwright flow verifies More → Customize & settings → Done and full overlay coverage. Keep this test whenever changing phone navigation, safe-area CSS, sheets, or account actions.

Before each external/data-changing phase: refresh the relevant live audit, preserve records, make only scoped changes, and add the exact verification result to `INDEPENDENT_STACK_HANDOFF.md` and this file.
