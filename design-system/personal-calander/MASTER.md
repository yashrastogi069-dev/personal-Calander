# Personal Calendar Design System

## Context and goals

Reading this as a high-frequency personal planning product for people coordinating daily commitments, habits, relationships, appointments, and long-range goals. The product should feel premium and composed, while making the next useful action obvious and keeping every established capability reachable.

This is an operational planner, not a generic analytics dashboard, a calendar-only product, or a marketing site. The owner-approved Variant A palette is the production foundation. The darker Variant C prototype informs depth and night-mode richness, not a replacement palette. Keep all domain facts and existing interactions intact while consolidating duplicate ways to see or change the same record.

### Design dials

| Dial | Setting | Meaning |
| --- | ---: | --- |
| Design variance | 5/10 | Clear, stable task layouts with selective asymmetry for long-range work and review |
| Motion intensity | 3/10 | Fast tactile feedback and purposeful sheet/selection transitions; no decorative animation loops |
| Visual density | 5/10 | Useful context without stacking competing dashboards, cards, and duplicated records |

## Tokens and foundations

### Color direction

Use the owner-selected A palette by day and its accessible A-derived dark adaptation by night. Never silently switch the brand to Variant B or Variant C.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas | `#ede9df` | `#0c1317` | App background |
| Raised surface | `#fffdf8` | `#17242a` | Primary work surface, menus, sheets |
| Primary ink | `#18211f` | `#f1ebdf` | Headings and body copy |
| Muted ink | `#56625e` | `#aab5b3` | Supporting copy, never critical controls below contrast requirements |
| Border | `#cbd2cb` | `#304149` | Structural boundaries |
| Accent | `#286b5e` | `#70bab2` | Primary action, selected destination, focus identity |
| Selection | `#dbeae3` | `#183b3b` | Selected/quiet interactive surface |
| Completion | `#246650` | `#83c4a4` | Completed state with label/icon, not color alone |
| Warning | `#85501e` | `#e1ad6b` | Caution with explanatory copy |
| Destructive | `#a33f3f` | `#ee8b82` | Destructive action with explicit wording |
| Focus ring | `#1775a4` | `#8bd4df` | Keyboard focus |

In code, `--accent` is the strong brand/action color and `--selection` is the quiet interactive surface. Tailwind's generic component `accent` utility maps to `--selection`; primary buttons and selected-destination indicators may use `--accent`. Do not use a loud primary color for every hover, menu, or selected background.

Preserve the exact R20 task work-lane colors in both themes: To do `#2a405d` / `#15283f`, Doing `#155b59` / `#0b393b`, Done `#1d4b3d` / `#102f27`. State must also have text and semantic affordances.

Use CSS semantic tokens rather than new per-screen hex values. Do not use pure black/white as full-screen surfaces. Keep normal text at WCAG 2.2 AA (4.5:1), large text and meaningful component boundaries at their applicable contrast threshold. Recheck both themes after token changes.

### Type, spacing, and shape

- Keep the established Onest UI type and IBM Plex Mono for dates, times, and measured values. Do not introduce a second display family without an explicit brand decision.
- Body text is 16px on phone. Secondary functional text should remain at least 14px where practical; never make essential goal, calendar, or status meaning tiny metadata.
- Phone actions and fields target at least 44 CSS px unless a platform-specific measured exception is documented. Do not force multiple touch-sized controls inside a short time-grid block; surface selected-record actions in a separate responsive control row.
- Use the existing 4/8 rhythm: 4, 8, 12, 16, 24, 32px. Page and section hierarchy should be legible from spacing before decoration.
- Use one documented shape grammar: controls 10-12px, work surfaces 14-18px, and full pills only for compact filters/status. Avoid mixing soft cards, sharp cards, and pill controls without a semantic reason.
- Give surfaces depth with tonal layering, a visible border, and a restrained hue-tinted shadow. A panel uses a border or a shadow as its primary separator, not both heavily.

### Materiality

Use solid, token-driven surfaces for planner content. The useful lesson from glassmorphism is layered depth; reserve subtle translucency for transient overlays only, with a solid fallback and readable contrast. Do not apply glass to task lists, forms, or calendar grids. Claymorphism, neumorphism, and skeuomorphism are reference lenses only: avoid puffy controls, shadow-only state cues, and literal physical metaphors that reduce density or contrast. This is one coherent planner system, not a gallery of effects.

## Information architecture and interaction

- Maintain one canonical owner for each record/workflow. Legacy URLs remain compatible, but aliases land in the canonical Projects & Goals, Plan/Calendar, or Review/Insights view; they must not render a second competing editor/list below it.
- Separate primary destinations from child views and global commands. Do not present an alias as a peer destination when it opens a child tab of another destination.
- On Today, answer “what should I do next?” before showing capacity diagnostics, historical detail, or secondary analytics. Summaries remain reachable and never disappear.
- Keep one authoritative habit schedule/history surface. Preserve all check-in, correction, skip, consistency, and review capabilities as views/drill-ins of the same record model.
- Explain planning facts precisely: due date, planned day, reserved time, actual focus, and recurring occurrence are different facts. Apple Calendar is an outgoing read-only subscription unless a separate inbound integration is explicitly implemented.
- Any server-only action must be visibly unavailable offline before activation, with a plain reason and recovery path. Preserve cached records and queued work; do not imply deletion, sync, or provider connection that did not happen.
- Every async action has loading, success, conflict, error, and retry/escape behavior. Prefer inline feedback near the action; do not replace server errors with vague generic copy.

## Component rules

### Navigation

- Desktop: fixed, collapsible primary rail; current destination is clear; child views appear inside their canonical destination.
- Phone: reachable bottom navigation for the user's chosen primary destinations; More contains clearly grouped secondary views/utilities. Reordering and pinning are discoverable and persistent.
- Preserve URL/deep-link state and browser Back/Forward. Route changes move focus to the destination heading and preserve meaningful local query/scroll state when returning.
- Keep global Capture, Search, and Focus as actions, not false peer sections. No horizontal overflow at 320px; controls do not collide with safe areas or each other.

### Work surfaces, lists, and cards

- Use cards only where elevation conveys ownership or a distinct interaction. Otherwise use clear section spacing and restrained dividers.
- Do not show duplicate summaries, editors, calendars, progress models, or action buttons for the same underlying records on one destination.
- Prefer one primary action per section. Secondary actions remain visible but visually subordinate; destructive actions stay spatially separate.
- Long lists are grouped/filterable and remain complete. Never silently truncate a user's work; provide deliberate paging or a disclosed “show more” affordance.
- Empty states say what is absent and offer the next relevant action. Loading states reserve layout. Error states name the failed operation and offer retry or safe fallback.

### Forms, details, and sheets

- Every field has a persistent visible label. Helpers explain consequential choices; validation errors appear beside the field and are announced accessibly.
- Save/convert previews describe what changes and what is preserved. A cancel path returns focus to the trigger. No destructive or cross-record action occurs from opening a preview.
- Details show the next useful action, record relationships, and clear provenance. Do not imply a recommendation or computed health signal is a persisted fact.
- Keep drawers/sheets interruptible and keyboard/touch dismissible; never trap critical content behind nested scroll containers.

## Accessibility and responsive acceptance criteria

- Every interactive target is at least 44x44 CSS px for phone layouts; maintain at least 8px spacing between adjacent targets where possible.
- Full keyboard operation, visible focus, meaningful accessible names, correct selected/expanded/disabled semantics, and focus restoration are required.
- Respect reduced motion. Motion communicates feedback or state transition, uses transform/opacity rather than layout animation, and remains under 300ms for routine interactions.
- Support 200% text zoom without hiding actions or forcing page-level horizontal scrolling.
- Validate 320px, 390px, phone landscape, 768px, and 1440px in both light and dark themes. Include comfortable/compact density, safe areas, keyboard presence, long labels, empty/loading/error/offline/conflict states, and large datasets.
- Browser tests must verify behavior and console/runtime state. Do not claim physical-iPhone, VoiceOver, live Supabase, or Vercel behavior from synthetic local runs.

## Content and tone

Use direct, specific language. Say “Share planner with Apple Calendar (read-only)” rather than “Connect calendar” for the outbound ICS feed. Say “Notifications on this device” for browser push. State clearly what is cached, pending, blocked offline, or unavailable until a migration/provider exists.

Avoid vague productivity slogans, invented analytics, implied AI certainty, and decorative metadata. Labels should answer where the user is, what the action does, whether it is safe, and what happens next.

## Anti-patterns and migration notes

- No multiple incompatible morphism styles on the same product surface.
- No tiny functional labels, muted-on-muted text, raw one-off colors, color-only state, decorative glow, or giant metric hero that pushes actual work below the fold.
- No duplicate Projects/Goals or Habit interfaces. Consolidate around one canonical record surface while keeping legacy routes as adapters and preserving every capability.
- No false calendar/reminder synchronization claims, and no Focus action that invites a server write while offline.
- No broad data/schema change bundled with a visual slice. Preserve IDs, versions, links, timestamps, user history, offline queue, and all existing feature controls.
- When migrating a legacy view, first map each capability and mutation to its canonical replacement. Remove the duplicate presentation only after parity tests prove its capabilities remain reachable.

## QA checklist

- [ ] Owner-approved A palette and exact dark task-lane colors remain intact.
- [ ] Each record type has one canonical editor/history; aliases route to it without duplicate panels.
- [ ] The primary next action is visible early on phone and desktop.
- [ ] All existing capabilities remain reachable after consolidation.
- [ ] Offline-only/server-only boundaries are explained before action; no unsupported write is offered.
- [ ] Calendar language distinguishes outbound read-only subscription from inbound sync.
- [ ] Contrast, keyboard focus, semantics, touch size, reduced motion, and 200% zoom pass.
- [ ] 320/390/landscape/768/1440, both themes, both densities, and error/empty/conflict cases pass.
- [ ] Full tests, typecheck, production build, and authenticated browser verification are recorded before declaring a slice complete.
- [ ] No screenshots, live DB writes, migration applies, deployments, or main-branch changes occur without their separate authorization.
