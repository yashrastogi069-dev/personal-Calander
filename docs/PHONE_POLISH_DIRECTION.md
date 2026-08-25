# Daily Desk premium polish direction

## Intent

The first Daily Desk pass solved phone legibility, reachability, and hierarchy. This second pass gives the system a more ownable premium character without adding decorative noise or changing any planner behavior. The design is **calm editorial productivity**: decisive at the moment of action, quieter when reflecting, and never metric-first.

## Card roles

The phone canvas does not use one repeated card recipe. Each surface earns a visual role.

| Role | Surface | Treatment | Purpose |
| --- | --- | --- | --- |
| Commitment | Today focus and capture | Soft verdigris wash, highest contrast action, slightly deeper elevation. | Make the next action unmistakable. |
| Canvas | Timeline and Calendar | Open paper-like field, stronger internal time/grid rhythm, minimal elevation. | Keep time planning calm and scannable. |
| Direction | Goal runway and capacity | Cooler lichen/stone tint, compact progress language, restrained emphasis. | Make the long view supportive rather than competitive. |
| Rhythm | Habits | Warmer mineral green with touch-forward check-in states. | Give recurring practice a distinct but gentle presence. |
| Reflection | Analytics and Review | Flatter, low-contrast sections with editorial spacing. | Let evidence recede until it is needed. |
| Utility | Plan tools, Connected tools, More sheet | Clear divider-led rows, intent-specific color accents, concise summaries. | Keep deeper capability discoverable without turning Today into a settings page. |

## Color system

The working palette remains low-glare. Deep verdigris is reserved for primary actions, selected navigation, completion confirmation, and one key decision at a time. Lichen is used only for gentle progress and positive planning cues. Mineral blue-grey belongs to time surfaces; moss belongs to habits; stone is the default supporting ground. Warning and destructive colors retain their existing semantic meaning and never become decorative accents.

## Motion contract

Motion must explain state or acknowledge touch. It never delays capture, typing, keyboard navigation, or repeated task completion.

| Interaction | Motion | Duration | Reduced-motion behavior |
| --- | --- | --- | --- |
| Navigation selection | Color and 1–2px visual depth shift. | 140ms | Color changes only. |
| More sheet | Opacity, 10px upward movement, 2px blur at entry. | 180ms | Opacity only. |
| Capture / task action | Press scale to 0.97; success uses existing toast rather than a second animation. | 120–150ms | No transform. |
| Completion | Check control scale and color transition only. | 140ms | Color transition only. |
| Nearby-day reschedule | Button press only; status text supplies the meaning. | 140ms | No transform. |
| Disclosure | Chevron rotates; content appears immediately to preserve high-frequency use. | 150ms | Instant. |

## Guardrails

No gradients on text, decorative glass, generic widget shadows, or repeated bouncy animation will be introduced. Touch controls retain 44px minimum targets. The public phone/reminder behavior and all existing data contracts remain untouched. Desktop keeps its established operational composition; phone is the only expressive canvas.
