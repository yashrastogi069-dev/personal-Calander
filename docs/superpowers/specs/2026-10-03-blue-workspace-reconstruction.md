# Blue workspace reconstruction contract

Date: 2026-10-03. Status: owner-approved direction; implementation in progress. Owner: primary agent. Branch: `dev/personal-calendar-workbench`.

## Latest owner brief

The owner approved the generated desktop/phone Today concept, reopened the former A-green palette, and requested a richer, more alive interface in light and dark appearances. Reconstruct the existing app, preserving all capabilities, IDs, history and options. Connect daily work with long-term projects, habit practice, timelines and reviews. Add Apple/Google Calendar connections and notifications/reminders through supported, secure provider paths. Hosting migration and dedicated performance optimization follow later; ordinary responsiveness and working controls remain necessary now. SOL 6 Medium/High is the implementation routing; Astra needs fresh explicit permission.

## Visual direction contract

THESIS: work is visible immediately in a coherent personal workspace; repeated introductions and disconnected tool panels give way to stable contextual views.

OWN-WORLD: porcelain and cool neutral surfaces, ink text and mineral-blue actions/selection; slate-dark equivalent. Supporting violet, amber, coral and green encode named context or state rather than coloring every panel. One readable UI type family, consistent icon strokes, moderate corner radii, quiet elevation and clear separators. Exact approved R20 dark task lanes remain an intentional Board exception.

STORY: capture work, choose a realistic day, act, deliberately recover from interruptions, inspect recorded outcomes and reconnect to longer-term intentions. Switching a view never creates a new copy of a record.

FIRST VIEWPORT: compact destination/date/actions; the persistent Focus watch remains one server-backed session, with a larger full-width Home presentation. A factual capacity summary does not displace actionable work. Desktop gives execution the broad region and day context the narrower one. Phone has reachable navigation and useful work before extended explanations; sheets stay keyboard-safe.

FORM: owner-pinned blue/porcelain desktop-and-phone concept, approved in chat on 2026-10-03. It is visual evidence, not verified code or a guarantee of pixel-exact recreation. Synthetic example records and totals must not enter production state. The earlier A palette is historical rather than binding.

Reference: [approved generated preview](../../../design-system/personal-calander/concepts/2026-10-03-blue-workspace-preview.png), created with the built-in image tool and retained as development-only design evidence. It is not a shipping UI asset. Synthetic labels/totals are illustrative and must not be used as application records.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. For app code, also satisfy per-slice tests/typecheck/build/runtime evidence and the capability ledger. Live rollout has additional separate gates.

## Connected destinations

- Home: Today for execution; distinct customizable Overview for cross-horizon decisions and factual habit evidence.
- Tasks: capture Inbox, List, status Board, saved filters, contextual task details and bulk tools.
- Plan: resumable daily/weekly planning, dated planning columns with Calendar, portfolio Roadmap. Status Board and dated planning Board remain distinguishable.
- Projects & Goals: canonical selected-project Overview/List/Board/Timeline, optional dated-task layer, milestones, Outcomes and Directions. Preserve standalone and legacy relationships.
- Habits: Practice/History/Settings, due/flexible Home summary, tick trace, month calendar, corrections, archived history and strict but non-punitive return choices.
- Review: all daily-through-yearly sessions, reflection/snapshots, Insights and factual history drill-through.
- Settings: account/sign-out, appearance/density/layout, planning defaults, categories/recycle, sync/conflicts, device status and connections.

## Color and customization

App accent, project/category identity, lifecycle, priority, calendar record type and sync state have separate roles. Use labels/icons as well as color. Project/category customization may not erase required warning/error distinctions. Keep phone pins/order, desktop collapse, comfortable/compact density and light/dark/system preferences. Overview modules gain bounded reorder/hide options with a useful default, not a blank dashboard builder.

## Integration gates

Existing outgoing private ICS feed, push devices and reminder rules remain intact and truthfully labelled. New Google connection requires a reviewed OAuth flow/scopes, provider application configuration, encrypted server-held tokens, authorization, revocation and deliberate reconnection/conflict semantics. Never put client secrets/tokens in committed code or frontend storage.

Apple incoming events require confirming a supported secure authorization route; the earlier rejection of public-share links and app-specific passwords remains until the owner explicitly changes that constraint. Do not invent an Apple OAuth capability, collect an Apple password or mark outgoing ICS as incoming sync. Reusable provider-neutral connection/event UI can be implemented locally while the provider gate remains open. Physical-iPhone permission/subscription/delivery requires actual device evidence.

## Local versus live

No new push/deployment/main merge, live schema change, database reset or existing-data modification is authorized by this contract. Migration 0004-0006, strict database TLS, exact-target inventory, restore-tested backup, compatibility and exact approval packets remain binding. Local UI testing uses synthetic intercepted requests; record precisely what was measured. Broader offline writes and real-time cross-device push must not be claimed without implementation and reconnection evidence.
