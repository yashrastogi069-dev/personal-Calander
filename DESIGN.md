---
name: Personal Calendar
description: Implemented white working canvas, blue actions, and slate dark foundation.
colors:
  primary: "#1459de"
  primary-dark: "#8ab5ff"
  selection: "#e4efff"
  selection-dark: "#243e61"
  completion: "#167258"
  completion-dark: "#7bd4ac"
  completion-soft: "#e2f3eb"
  completion-soft-dark: "#1c3a34"
  warning: "#915a0c"
  warning-dark: "#f2c477"
  warning-soft: "#fff2d6"
  warning-soft-dark: "#443726"
  destructive: "#b13c38"
  destructive-dark: "#ffa095"
  context-violet: "#6b4bab"
  context-violet-dark: "#c4acff"
  context-violet-soft: "#f0ebfa"
  context-violet-soft-dark: "#342e4d"
  context-coral: "#b44533"
  context-coral-dark: "#ffab97"
  context-coral-soft: "#fff0e9"
  context-coral-soft-dark: "#44302f"
  canvas: "#ffffff"
  card: "#ffffff"
  subtle: "#f5f7fb"
  ink: "#14233c"
  muted-ink: "#53657f"
  subtle-ink: "#586b85"
  border: "#d5dfec"
  canvas-dark: "#111b29"
  card-dark: "#19273a"
  subtle-dark: "#203149"
  ink-dark: "#edf3fc"
  muted-ink-dark: "#afbed2"
  subtle-ink-dark: "#9caec7"
  border-dark: "#3d506b"
  focus-dark: "#9bc3ff"
  task-todo-dark: "#2a405d"
  task-progress-dark: "#155b59"
  task-completed-dark: "#1d4b3d"
typography:
  headline:
    fontFamily: "Onest, sans-serif"
    fontSize: "clamp(26px, 2.5vw, 34px)"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-0.04em"
  body:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
  label:
    fontFamily: "Onest, sans-serif"
    fontSize: "14px"
  mono:
    fontFamily: "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace"
rounded:
  control: "12px"
  panel: "16px"
spacing:
  small: "8px"
  medium: "16px"
  large: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    height: "44px"
  button-secondary:
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.control}"
    height: "44px"
  input-quick-entry:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    height: "48px"
  navigation-active:
    backgroundColor: "{colors.selection}"
    textColor: "{colors.primary}"
    height: "44px"
  capacity-disclosure:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    height: "48px"
---

# Design System: Personal Calendar

## Overview

**Creative North Star: "White planning studio"**

This document captures the implemented local foundation as of 2026-10-03. The owner approved a premium white working background with blue actions, meaningful secondary color, and a separate slate dark theme. The generated desktop/phone preview establishes that direction; it is not evidence that every pictured component is implemented.

The checkpoint covers the shared shell/theme, the simplified Today presentation, and Projects/Goals presentation. It is a partial reconstruction, not whole-product visual acceptance. Current status and live gates remain in [the handoff](docs/INDEPENDENT_STACK_HANDOFF.md).

**Key Characteristics:**

- White work surfaces and restrained neutral framing.
- Blue action and selection cues; named states retain their own colors.
- Readable task context, preserved canonical records, and native disclosure behavior.

## Colors

The frontmatter records exact implemented values. Runtime authority remains [semantic tokens](client/src/features/shell/phase4-tokens.css), [shared overrides](client/src/features/shell/blue-theme.css), and the compatibility cascade in [index.css](client/src/index.css).

### Primary

Blue identifies primary actions, active navigation, and focus. Selection is a quiet tint rather than a blue working canvas. The root focus color equals primary in light mode; dark uses its separate focus token.

### Secondary

Green means completion; amber means warning/recovery; destructive coral means error. Violet and contextual coral are available for labeled context and relationships. Their presence in the token set does not establish a universal project/category assignment; existing record colors remain user data.

### Neutral

Canvas and cards remain white in light mode. The rail and subtle framing use the neutral subtle token. Dark mode uses slate canvas/card/subtle layers, light ink, and brighter state colors.

**The White Canvas Rule.** Keep light working backgrounds white; reserve blue tint for selection and bounded action context.

**The Labeled State Rule.** Color accompanies text, icons, or status semantics; it never replaces them.

Exact R20 dark Task lanes remain the three `task-*-dark` values above. They are scoped Board identities, not replacements for global surface tokens.

The app starts with System preference unless a valid stored theme overrides it. Light/Dark/System are supported; System responds to operating-system changes. [ThemeContext](client/src/contexts/ThemeContext.tsx) applies the root dark class and native color scheme and persists the choice locally. Legacy dark foreground aliases in index.css remain part of the effective cascade.

## Typography

Onest supplies the working interface; IBM Plex Mono supplies selected timing/technical labels. Essential body and secondary text use the documented body/label sizes. The shared destination title uses the headline role; Today section headings remain smaller (20px desktop, 19px phone). Larger existing project and Focus typography is contextual, not a second global display scale.

**The Readable Density Rule.** Compact layout preferences must preserve essential text and 44px action targets.

## Layout

The implementation uses recurring small/medium/large spacing with local adjustments, not a universal enforced spacing scale. Today uses 16px desktop gaps and 12px phone gaps. Panel padding commonly spans 16–24px.

Desktop rail and destination canvas have independent scroll ownership. At 680px and below, the rail yields to fixed phone navigation with safe-area padding and a More sheet; saved pins/order and comfortable/compact preferences remain supported. Today stacks work and timeline content below 820px. Its desktop content is bounded to 1260px.

The shared header contains one destination title/date, global Capture/Search/Focus actions, expandable Quick entry, and a separate status region. Quick entry retains its existing form and capture intent. Parent destination highlighting is distinct from exact-location `aria-current`.

## Elevation & Depth

The refreshed shell and Today work surfaces primarily use tonal framing and thin borders. The shared primary action has no resting shadow. Older workspaces and fixed phone overlays still carry existing shadows; this checkpoint does not establish a whole-app shadow convergence.

## Shapes

Controls and panels use modest rounded corners. The documented control/panel values are recurring values, not a mandate that every existing component has identical corners; observed Today containers vary from 11px controls to 17px execution framing.

## Components

- Global actions preserve Capture, Search, and Focus. The native Quick entry disclosure preserves the existing form.
- Today uses one contextual next-step action, canonical flexible/task rows, fixed-time chronology, expandable capacity facts, habits, suggestions, and completed evidence. All five capacity facts remain available; unknown estimates are explicit.
- Projects/Goals retain their existing entities/actions while the selected project owns its work canvas. Remaining roadmap/detail parity follows the reconstruction plan rather than this visual document.
- The existing full Home Focus option and compact companion remain one backend session. The larger watch, pause/resume/finish outcomes, notes, and capability-gated saved follow-up are retained.
- Keyboard focus uses the semantic focus ring. Shared disclosures remain native; sheets use their existing focus/scroll handling. Sheet motion is 180ms, with a near-instant reduced-motion value. Other existing controls retain their scoped reduced-motion rules.

## Do's and Don'ts

- Do preserve the white canvas and exact scoped R20 dark lanes.
- Do use existing semantic aliases instead of adding private light-only palettes.
- Do preserve record/workspace IDs, history, capture intent, pins, density, and meaningful date distinctions when changing presentation.
- Don't treat available accent tokens as completed color assignment across every surface.
- Don't claim Overview customization, full inspector reconstruction, whole-app accessibility, physical iPhone checks, provider integrations, or live deployment from this partial checkpoint.

Foundation evidence: shell/theme tests previously passed (28 tests); the white-canvas follow-up passed 21 focused theme/foundation tests, including essential text contrast and exact lane checks. These results are not universal contrast, font-loading, device, or deployment signoff. The parent owns final integrated tests/build/runtime evidence.
