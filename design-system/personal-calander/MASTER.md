# Personal Calander Design System

> **Scope:** This is the source of truth for the core planning workspace. The interface is an operational planning studio, not an event product, a marketing page, or a generic card dashboard.

## Design Read

Reading this as: a high-frequency personal operations dashboard for one design-conscious owner, with a premium, calm, information-rich language that leans toward an instrument panel rather than a consumer to-do app.

## Direction

The product is used during focused desk time, often in the evening or early morning when a lower-luminance interface is more comfortable. The visual world is **Basalt Ledger**: deep mineral surfaces, precise warm-white type, one luminous lichen action color, reserved category colors, editorially composed data, and deliberate empty space around decisions.

| Dial | Setting | Meaning |
| --- | --- | --- |
| Design variance | 6/10 | Asymmetric data composition and strong typographic hierarchy without sacrificing operational familiarity |
| Motion intensity | 3/10 | Tactile feedback and a single contextual focus transition; no decorative motion on repeated planning actions |
| Visual density | 7/10 | Rich information arranged in plain surfaces, not nested cards |

## Token Architecture

### Primitive tokens

| Family | Values |
| --- | --- |
| Basalt | `#0D0F0E`, `#131614`, `#191D1A`, `#232824` |
| Paper | `#F5F5EF`, `#D9DCD4`, `#9AA198`, `#6F766E` |
| Lichen | `#C6F06A`, `#A9D64E`, `#1F2A18` |
| Signal | `#E5A75A`, `#DB6D62`, `#7DB8E0`, `#AD8FC4` |

### Semantic tokens

| Role | Value | Use |
| --- | --- | --- |
| Canvas | Basalt 900 | Application background |
| Surface | Basalt 800 | Sidebar, panels, popovers |
| Raised surface | Basalt 700 | Focused composer and task inspector |
| Primary text | Paper 100 | Titles and strong action labels |
| Secondary text | Paper 300 | Supporting context |
| Muted text | Paper 500 | Metadata and inactive navigation |
| Focus/action | Lichen 400 | Primary confirmations, current-time marker, selected state |
| Divider | White at 9% | Structural separators only |

### Component rules

Buttons use 10px radii, panels use 16px radii, compact controls are pill-shaped only when they represent a filter or a compact state. Default grouping relies on structured spacing and hairline dividers. A panel uses either a 1px border or a shadow, never both. All visible numerical data uses tabular figures.

## Typography

**Onest** is the interface voice: compact, contemporary, and legible at data-dense sizes. **IBM Plex Mono** is reserved for timestamps, dates, workload values, and technical metadata. Text is left aligned by default. Display headings use a maximum tracking of `-0.035em`; ordinary UI labels are not artificially letter-spaced.

## Layout Grammar

The application frame uses a vertical left rail, a compact top context strip, and an asymmetric main canvas. The first viewport establishes both planning modes at once: the prioritized focus list anchors the left side of the working canvas, while the schedule timeline anchors the right. Goal and habit signals form a lower analytical band rather than competing with the immediate plan.

On small screens, the rail becomes a compact top navigation control, the day focus remains first, the schedule follows, and visual analytics collapse into horizontally scrollable but labeled panels. No horizontal page overflow is permitted.

## Motion Grammar

Keyboard capture and quick task completion are instant. Pressable controls use a 140ms transform response and `scale(0.98)`. Occasional overlays enter with 180–220ms opacity and a `scale(0.97)` transform around their trigger origin. The only authored broader moment is a restrained focus-shift when the selected date changes: the schedule’s time marker and date label transition to preserve spatial continuity. All motion respects reduced-motion preferences.

## Non-negotiables

- Do not use romantic pink, gold, script typography, generic glassmorphism, gradient text, big-number metric heroes, or marketing testimonial patterns.
- Do not encode state only by color; icons, copy, and geometry must reinforce it.
- Do not create nested card stacks. Prefer one panel with internally divided content.
- Do not use fabricated user reviews, testimonials, or performance claims.
