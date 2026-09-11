# Premium iPhone planner contract

Status: active implementation on `dev/personal-calendar-workbench`.

## Product standard

The phone planner is a primary product surface, not a compressed desktop layout. It must feel calm, confident, and quick at 375px, 390px, and iPhone landscape. Every primary task has a visible tap route; gestures accelerate, never gate, work.

## Non-negotiable phone behaviors

| Area | Contract | Failure prevention |
|---|---|---|
| Bottom navigation | Fixed to the viewport bottom, clear of the home indicator, 2–4 chosen tabs plus More, with 44pt+ targets | The nav may not live in a filtered/transformed container that traps full-screen overlays. |
| More and settings | Full-viewport scrim; sheet is above the nav, scrollable, escapable by Close/scrim, and does not leave an inactive overlay behind | Automated 390px flow opens More, checks full viewport coverage, opens settings, and closes it. |
| Personalization | Pin up to four destinations, reorder every destination, choose density, and reset safely | Preferences are normalized against valid routes and are local to the workspace/browser until account-synced settings are designed. |
| Content | No horizontal overflow, readable 16px controls, adaptable gutters, no hidden actions behind fixed controls | Test portrait, landscape, large text, reduced motion, empty/loading/error, and long titles. |
| Gestures | Swipe left complete; swipe right reveals recoverable archive; long press edits | Tap controls remain visible; vertical scrolling wins; no destructive action fires on a single swipe. |

## Design system

- One visual language: warm mineral background, high-contrast ink text, verdigris primary action, muted mint surfaces, and restrained elevation.
- Task status is the intentional high-contrast exception: the three Work lanes retain the exact R20/main dark slate, teal, and forest gradients with light controls and text.
- iOS rhythm: 4/8pt spacing, 44pt controls, short transform/opacity motion only, native-safe sheet behavior.
- Information hierarchy: one clear primary action per screen; navigation and utility actions are visually subordinate.
- Accessibility: semantic labels, visible focus, color-independent states, reduced-motion support, and no user-critical hover-only behavior.

## Failure-mode review before each mobile change

1. Does the change create a containing block that changes a fixed sheet or nav's coordinate system?
2. Does it work with 1, 2, 3, or 4 pinned tabs, an empty More list, and a long localized label?
3. Does a sheet still close with its button, scrim, Escape, route change, and browser back behavior?
4. Does it remain usable offline, while loading, with an API error, and with no planner records?
5. Does the intended behavior have an accessible non-gesture alternative?
6. Is the resulting preference device-local or account-synced? Never imply cross-device sync without a persisted schema and migration.

## Acceptance evidence

The focused local Playwright flow uses intercepted synthetic data and checks 390×844 layout, More overlay viewport coverage, settings opening, settings dismissal, all three exact dark Task-lane surface tokens, horizontal overflow, and browser runtime errors. It is a UI regression guard, not proof of real OAuth or production data behavior.

## Deferred but designed-for phases

- Private file storage must add explicit upload/error/offline states and never expose private object URLs.
- Apple Calendar/reminders needs a permission state, connected/disconnected state, safe conflict language, and a visible fallback when iOS denies notification/calendar access.
- Authenticated mobile Sign out needs a bottom-safe, unobscured account surface; it must be tested with this fixed nav in place.
