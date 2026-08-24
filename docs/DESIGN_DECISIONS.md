# Design Decisions

## Experience direction

The workspace uses the **Basalt Ledger** planning-studio direction rather than a generic card grid. The person uses this board during focused desk time, so a deep mineral canvas, quiet warm-white type, and one carefully constrained lichen action color provide lower-luminance comfort without looking muted. High-information typography, ordinary surfaces, and structured timeline bands allow dense planning information to remain legible. Data visualizations are analytical rather than decorative and always provide labels, tooltips, and non-color cues.

The first viewport demonstrates the equal-balance model. Today’s prioritized work and calendar time planning appear in one continuous working canvas, with goals and habit signals providing visible context without taking over the decision surface. This composition deliberately rejects a metric-first dashboard and nested collections of generic cards.

## Interaction principles

Capture must be available in a single, predictable gesture. Planning actions preserve context: editing is inline when lightweight and moves to a focused detail surface when it changes scheduling, recurrence, or dependencies. Keyboard shortcuts accelerate frequent actions but never hide essential controls. Destructive actions require clear reversal or confirmation. High-frequency keyboard and completion actions are instantaneous; only occasional overlays and date-context shifts animate, with a maximum 220ms duration and reduced-motion fallback.

## Accessibility baseline

The implementation targets visible keyboard focus, semantic form labels, accessible names for icon controls, minimum touch targets, clear status text beyond color, responsive single-column fallbacks, and reduced motion preferences. Progress charts have text summaries for people who do not perceive their color encoding.
