# R22 Phone-First Hardening

**Status:** In implementation and validation on `dev/personal-calendar-workbench` only.

## Product decision

The application is used primarily on a phone, so phone behavior is the primary acceptance surface. Desktop remains supported, but it no longer dictates interaction density. The phone contract is a single-column, thumb-aware planning flow with tap-complete alternatives for every gesture, no required hover state, safe-area padding, stable 16px form controls, clear offline status, and short reduced-motion-safe transitions.

## Audit findings

The app already had local quick-capture storage, a replay-on-online queue, a service worker shell, lazy-loaded destinations, and a bottom phone navigation. The audit found three meaningful gaps. The offline queue was not accompanied by a persistent offline explanation when empty; destination loading used a moving bar instead of a structural skeleton; and task rows had nearby-day swipe behavior but no phone-native completion/archive gesture or long-press secondary action. The existing Vercel build and service-worker registration are retained.

The 390×844 visual check showed the Today surface is now a clear thumb-first stack: the New action sits in the header, capture is a full-width control, task guidance is readable, and bottom navigation respects the home-indicator area. Calendar remains deliberately darker and task-only, with its Add task action and date rail reachable without mixing Habit tracker records into time blocks.

## Interaction contract

| Gesture or state | Behavior | Safety fallback |
|---|---|---|
| Tap check control | Completes or reopens a task | Always visible; does not depend on swipe. |
| Swipe left on an open task | Completes the task | Requires touch input and a 72px horizontal threshold; vertical scrolling wins. |
| Swipe right on a task | Reveals a reversible **Archive** action | Never archives immediately; the person must tap Archive or Cancel. Archive preserves history and is recoverable. |
| Long-press a task for 520ms | Opens the existing task editor | The existing More/Edit action remains available; movement or release cancels the timer. |
| Offline | Quick capture is stored locally and replayed when online | A visible status explains local persistence and queued sync count. Server-backed edits remain explicit rather than falsely claiming sync. |
| Loading a lazy destination | Shows structural skeleton cards | Screen readers receive an `aria-busy` region and hidden destination label. |

The swipe decision is extracted into `shared/mobileTaskGesture.ts` and covered by five focused tests. Mouse and pen input do not activate phone gestures. Completed tasks cannot be completed again by swipe. Archive is used as the safe product equivalent of delete because this planner already provides restore/history semantics.

## Visual and platform treatment

The mobile layer adds safe-area inset padding on the top, sides, and bottom navigation; 44px minimum touch targets on navigation and task actions; a 16px input baseline to prevent iOS auto-zoom; readable task metadata; a compact skeleton grid; and an offline status surface. System preference now resolves the existing light/dark token layers through the ThemeProvider. The calendar’s purpose-specific dark surface remains localized and is not converted into a habits calendar.

## Current validation

The focused gesture/offline suite passes with **9 tests**. The complete suite passes with **38 files and 140 tests**. TypeScript passes. The production client build passes with the initial client asset at **1,414.90 kB / 370.61 kB gzip** and the calendar route remaining lazy-loaded. A fresh 390×844 screenshot shows the Today and Calendar surfaces without horizontal overflow; the bottom nav and calendar Add task/date rail remain visible and reachable. Final browser console and touch-flow checks remain required before checkpoint.

## References

[1]: https://developer.mozilla.org/en-US/docs/Web/CSS/env "MDN — env() CSS function and safe-area insets"
[2]: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation "MDN — Offline and background operation"
[3]: https://web.dev/learn/pwa/caching "web.dev — Caching"
[4]: https://web.dev/learn/accessibility/design "web.dev — Design for accessibility"

## Final Calendar palette and swipe validation

The dedicated execution Calendar now uses a lighter medium verdigris surface instead of the previous near-black green: medium evergreen panels, mint action controls, stronger pale text, clearer hour lines, and a distinct soft-blue read-only busy overlay. The localized timeboxing surface remains visually separate from the lighter Today shell while sharing the same verdigris identity.

At 390×844, the Calendar screenshot showed the compact identity, full-width Add task action, touch-sized day controls, readable seven-day rail, and the medium palette without collapsing the task/inbox structure. A controlled touch-pointer acceptance moved the selected rail day from **Sat 29 Today** to **Sun 30 Selected** on a decisive left swipe. Short and vertical gestures are rejected by the pure contract, while tap buttons remain available. The offline Today check rendered `Offline mode. New quick captures stay on this device.` and input inspection reported 16px form text. Browser console inspection after a fresh preview restart reported zero errors and zero warnings.

The final automated suite passed with **39 files and 144 tests**, followed by `pnpm check` and `pnpm build:client`. The build continues to warn about the existing Home bundle size (**1,414.90 kB / 370.60 kB gzip**); the Calendar route remains independently lazy-loaded. This pass did not add a database table, external calendar write, OAuth, reminder schedule, or automatic rollover.

## Current remaining work

The core phone UI and task-calendar interactions are now in strong shape. The remaining meaningful product work is not cosmetic: a true offline mutation queue for edits beyond quick capture, background-sync conflict resolution, richer week/month touch navigation, and further Home bundle extraction. These should be separate milestones with their own data-integrity tests rather than hidden behind a visual claim of offline completeness.
