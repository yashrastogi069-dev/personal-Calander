# Premium redesign D0: tokens, motion and primitives

Date: 2026-10-13. Status: owner approved the v2.1 look (private canvas `92uiB3ukGHrDcPqp9Q1SUo` v4) as the D0 target. Branch `work/premium-redesign`, pushed to `dev/personal-calendar-premium-v2`.

D0 is the foundation that D1–D6 build on. It does not redesign any screen. It adds design tokens, motion rules and five primitives, and stops the legacy green palette from growing.

## Scope

In:

1. Tokens v2 for light and dark: page backdrop, lines, track, hero, night card, elevation, radius scale, category palette, status palette.
2. Motion tokens and one reduced-motion policy.
3. Primitives: `Pill`, `StatusPill`, `TimeChip` (planned/actual), `CategoryChip`, `SegmentedTabs`.
4. A category tone resolver that maps real `categories` rows onto the validated palette.
5. Legacy green quarantine: a ratchet test that fails if green literals increase.

Out (later steps): shell and nav (D1), Dashboard (D2), drag (D3), "why it matters" copy (D4), Analytics (D5), removing legacy green rules screen by screen (D1–D6).

No schema change, no live writes, no new dependency (`framer-motion` and `@radix-ui/react-tabs` are already installed).

## Tokens

All tokens live in `client/src/design/tokens-v2.css`, imported after `blue-theme.css`. They use new names so they cannot collide with the legacy shadcn/green variables. Existing semantic tokens (`--surface`, `--ink`, `--accent`, `--border`, `--selection`) stay the source of truth for the base colours; v2 adds what the v2.1 boards need.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--pc-page` | #f3f6fb | #0d1522 | Grey backdrop, Dashboard only |
| `--pc-card` | #ffffff | #19273a | Cards (dark = existing elevated surface) |
| `--pc-card-2` | #f5f7fb | #203149 | Inset, chips, segmented track |
| `--pc-line` | #e6ecf4 | #22344b | Hairlines inside cards |
| `--pc-faint` | #7d8ca3 | #8194ad | Icons and non-text marks only (3.4:1 on white) |
| `--pc-accent-strong` | #0f47b4 | #6b9cf6 | Hero gradient end, pressed accent |
| `--pc-track` | #e9eef5 | #243852 | Empty bar and ring tracks |
| `--pc-planned` | #7d8ca3 | #7a8ca6 | Planned/hatched marks |
| `--pc-busy` | #eef2f8 | #1b2b40 | External "busy" event fill |
| `--pc-weekend` | #f7f9fc | #132033 | Calendar weekend columns |
| `--pc-night` | #14233c | #0a111c | Dark accent card |
| `--pc-hero-1/2` | #1f63ea / #0f47b4 | #2557c4 / #1a3f97 | Hero card gradient |

Elevation `--pc-e1..e3`: soft ink-tinted shadows in light; hairline ring plus deep shadow in dark (values from the v2.1 generator).

Radius: `--pc-r-chip` 8px, `--pc-r-control` 12px, `--pc-r-panel` 16px, `--pc-r-feature` 24px, `--pc-r-pill` 999px.

### Category palette

Validated with dataviz `validate_palette.js` (CVD-safe in light and dark, tritan separation low). A colour is never used alone: every use carries a label or a dot plus text.

| Slot | Light | Light soft / ink | Dark | Dark soft / ink |
|---|---|---|---|---|
| work | #2f6fe4 | #eaf1ff / #1747a6 | #5b8ef0 | #1d3354 / #b3cdff |
| health | #0f9d8a | #e2f5f1 / #0b6457 | #26a089 | #133a36 / #86e3cf |
| learning | #c27612 | #fff2dc / #8a520b | #c4852f | #3b2f1f / #f2c477 |
| personal | #7a5af0 | #f1ecff / #5136b8 | #9479ee | #2c2850 / #cdbcff |
| social | #e0567a | #ffebf0 / #a3304f | #dc5f80 | #43283a / #ffb0c4 |

Tokens: `--pc-cat-<slot>`, `--pc-cat-<slot>-soft`, `--pc-cat-<slot>-ink`. A `.pc-tone-<slot>` class sets `--pc-k`, `--pc-k-soft`, `--pc-k-ink`, so primitives read one set of variables.

**Mapping real categories.** Categories are user-defined rows (`categories.name`, `categories.color`, `sortOrder`). `resolveCategoryTone(category)`:

1. Matches the name to a slot by keyword (work/job/career → work; health/fitness/gym/run → health; learn/study/course/school → learning; personal/home/life/admin → personal; social/friends/family → social).
2. Otherwise assigns a slot from a stable hash of the category id, so a category keeps its colour across sessions and devices.
3. A missing category gets the neutral tone (no colour, no chip).

The stored `categories.color` is not used for chips in D0, because arbitrary colours can't be held to the validated contrast. It stays in the database untouched. Revisit only if the owner asks.

### Status palette

| Status | Light fg / bg | Dark fg / bg |
|---|---|---|
| On track | #167258 / #e3f4ec | #7bd4ac / #163a2e |
| At risk | #8a560b / #fff3dc | #f2c477 / #3d3222 |
| Off track | #a3353a / #ffecec | #ffaaa8 / #432b30 |

Status pills always show the word as well as the colour.

## Motion

| Token | Value | Use |
|---|---|---|
| `--pc-ease` | cubic-bezier(.23,1,.32,1) | UI enter, hover, press |
| `--pc-ease-data` | cubic-bezier(.16,1,.3,1) | Bars, rings, count-ups |
| `--pc-dur-press` | 80ms | Button press scale (.97) |
| `--pc-dur-fast` | 140ms | Hover, colour |
| `--pc-dur-base` | 240ms | Card rise, tab indicator |
| `--pc-dur-data` | 600ms | Bar/ring fill (data only, may exceed the 300ms UI cap) |
| `--pc-stagger` | 40ms | Per-item delay, capped at 8 items |

Utility classes: `.pc-rise` (8px rise + fade), `.pc-pop` (scale .96 → 1), `.pc-grow-x`, `.pc-grow-y`, `.pc-pulse` (the now-line and overdue dot). The stagger index comes from `style="--pc-i: n"`.

Reduced motion (one rule, in tokens-v2.css): under `prefers-reduced-motion: reduce`, every `.pc-*` animation is turned off and transitions are limited to colour/opacity. Data shows its final value straight away. `SegmentedTabs` uses `useReducedMotion()` from framer-motion and skips the sliding indicator.

## Primitives

All live in `client/src/components/premium/` with CSS in `client/src/design/primitives.css`. Class prefix `pc-`.

- **Pill** `<Pill tone?>` — inline label, radius pill, 12px/650, min height 22px.
- **StatusPill** `<StatusPill status="on|risk|off" />` — dot plus the word ("On track", "At risk", "Off track"). Optional `label` override; the colour never stands alone.
- **TimeChip** `<TimeChip plannedMinutes actualMinutes? />` — "45m planned"; with actual: "45m / 1h 5m", and an over-estimate flag in the at-risk colour when actual is more than 120% of planned. Missing planned and actual renders nothing. `formatMinutes` is shared and unit-tested.
- **CategoryChip** `<CategoryChip category />` — tinted chip with a dot and the category name. Returns null without a category.
- **SegmentedTabs** `<SegmentedTabs items value onValueChange label />` — Radix Tabs list (roving focus, arrow keys, `aria-selected`) styled as the v2.1 pill segment, with a framer-motion `layoutId` indicator. Works as a navigation segment via `asLinks` later in D1. 36px controls inside a 44px-tall track so touch targets hold. At ≤400px the items shrink evenly and truncate. This fixes the v2.1 390px overflow.

## Legacy green quarantine

There are 1,439 green-hued hex literals in client CSS, 1,110 of them in `index.css`. The blue theme overrides them by specificity. Deleting them without a screen-by-screen visual check would risk regressions, so D0:

1. Adds `client/src/design/legacyGreen.test.ts`. It counts green-hued literals per file and fails if any file goes above its recorded baseline. New code can't add green, and the count can only go down.
2. Marks `index.css` as legacy with a header comment pointing to this spec.
3. Removes green per screen as D1–D6 rebuild each one, lowering the baselines as it goes.

## Verification

- `npm run check`, `npm test` (≥754 passing, plus new primitive and tone tests), `npm run build`.
- Plan harness `scripts/preview-premium-plan.py` still 36/36.
- A local primitives gallery screenshot (light/dark, 1440/390, reduced motion) via a dev-only route, compared against the v2.1 chips and tabs. The gallery route is dev-only and not linked from the app.
- Contrast: chip ink on chip soft ≥4.5:1 for every slot in both themes (checked in a unit test with a WCAG contrast function).

## Fable review (2026-10-13) and what changed

Fable reviewed this spec, as pre-approved by the owner for D0. Adopted in D0:

- **Category colour.** The stored `categories.color` is now used. It is snapped to the nearest slot by hue, and keywords and the hash apply only to grey or missing colours. `resolveCategoryTones()` gives colliding categories the next free slot by `sortOrder`, and slots repeat only after all five are used. This supersedes "the stored colour is not used" above.
- **Green ratchet.** Allowlists the token files and the gallery, and counts Tailwind `green-/emerald-/lime-` classes in TSX as well as hex values.
- **Surfaces.** `--pc-card` and `--pc-card-2` alias `--surface-elevated` and `--surface-subtle`, so they can't drift. Dark cards stay `#19273a`, because the palette was validated on it. `--border` stays the control border and `--pc-line` is the hairline, so the v2.1 `#2b3d57` is not adopted.
- **New tokens.** Typography scale (`--pc-text-*`, weights, tracking) with a 12px text floor, so status and time chips moved from 11px to 12px. Also a 4px spacing scale, z-index layers, focus ring width/offset, `--pc-dur-exit` 160ms, and `--pc-done`, `--pc-overdue`, `--pc-night-accent`, `--pc-side`.
- **Contrast tests.** These now cover the category base against card and card-2 (≥3:1), status text on soft (≥4.5:1), and faint on card (≥3:1), in both themes.
- **Over-estimate.** The flag shows visible text ("+20m over") as well as colour.
- **Touch.** Tabs are 44px tall under `pointer: coarse`.
- **Reduced motion.** Applied app-wide through `<MotionConfig reducedMotion="user">`, plus the CSS rule.
- **Tailwind.** Theme exposes `bg-pc-*`, `rounded-pc-*` and `shadow-pc-*`.

Deferred, with owners:

- D2: play entrance animation only on first mount per route per session, never on refetch or tab return. Fold ring and count-up into 600ms. Gate hover lift behind `@media (hover: hover)`. Use the pulse on the now-line only.
- D1: decide the backdrop per layout (grey Dashboard vs white elsewhere) and record it.
- D6 (needs a palette re-validation run): extra slots (slate, olive, cyan) for workspaces with more than five categories, and a swatch-only category editor.
