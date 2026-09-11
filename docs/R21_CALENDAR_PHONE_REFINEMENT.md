# R21 Phone Calendar Refinement

**Status:** Implemented and under final validation on `dev/personal-calendar-workbench` only.

## Design Read

> Reading this as a phone-first personal focus desk: calm evergreen planning outside the time grid, deeper evergreen execution inside it, with the calendar’s date rail and time rhythm acting as the signature rather than decorative dashboard chrome.

The 390×844 audit showed that the existing product was usable but still read as a compressed desktop in its identity and touch hierarchy. Today already had a clear vertical planning flow, while Calendar had the stronger focused surface. The refinement keeps both modes but gives the dedicated Calendar route a compact mobile brand lockup, larger interaction targets, clearer type steps, and a more deliberate relationship between the date rail, Add task action, inbox, and grid.

| Mobile problem observed | Applied decision |
|---|---|
| The dedicated Calendar header had no product identity when the desktop rail was absent. | Added a compact Personal / Calendar lockup with a reusable rotated focus mark, shown on the phone route without adding another navigation layer. |
| Calendar title, action, date navigation, and supporting copy were too close in visual weight. | Established explicit phone type steps: brand micro-label, 25px route title, 21px workspace title, 12px supporting copy, 10–12px data labels. |
| Desktop-sized controls were technically reachable but not comfortably touch-oriented. | Increased route actions to 40px, day controls to 36px inner targets / 44px control height, Add task to 46px, date choices to 58px, and grid block actions to 25px minimum heights. |
| The date rail was functional but visually quiet. | Made the seven-day rail a stronger calendar signature with deeper evergreen background, larger date numerals, mint current-day text, and a restrained selected-day surface. |
| Inbox and grid could feel like one dense dark block on a phone. | Increased panel breathing room and readable task metadata while preserving the explicit order: inbox first, task grid second, habits never inserted into task time blocks. |

## Implemented Scope

The dedicated Calendar route now owns the phone-specific refinements in its route stylesheet. The changes use the existing Lucide icon family and existing focus mark construction; no dependency or new SVG family was introduced. Reduced motion removes the mark rotation. The visual system remains one palette: ink evergreen foundations, verdigris/mint primary action and selection, pale mint text, and blue-only read-only external busy context.

The existing semantics remain unchanged. Add task opens the real task composer. Date navigation changes only the selected local calendar day. Inbox selection, drag/drop, move, resize, completion, Remove time, keyboard shortcuts, ICS readiness, and manual rollover retain their existing contracts. No habit check-in becomes a task time block, and no external calendar write or automated action was added.

## Acceptance Evidence

At the refreshed 390×844 browser viewport, the Personal / Calendar lockup and route title render as a two-step mobile header; Open Tasks remains a reachable 40px control. The workspace title and supporting copy render at the enlarged phone scale. The date controls occupy a full-width 44px row, Add task is full-width at 46px, and all seven date choices render as 48px-wide, 58px-tall touch targets. The selected date retains a textual Today label and visible selected surface. The inbox, keyboard guidance, rollover, and grid continue vertically without horizontal collision.

A refreshed 500px browser inspection also confirmed the layout scales up without breaking the brand lockup or date rail. The existing calendar route remains a separate lazy destination, and the initial Home bundle was not enlarged by adding a new route or library.

## Validation Plan

Final validation passed: `pnpm check`, the complete **37-file / 135-test** Vitest suite, and `pnpm build:client`. The production build emits the calendar destination at **44.00 kB / 7.65 kB gzip** and leaves the existing Home bundle at **1,410.69 kB / 369.81 kB gzip**. Fresh 390×844 and 1280×720 screenshots show the phone identity lockup, larger touch targets, readable date rail, stronger grid hierarchy, and preserved desktop composition. The refreshed browser session reported **0 console messages, 0 errors, and 0 warnings**. Existing calendar interaction acceptance remains valid: Add task opens the real composer; nearby-day selection is non-mutating; task blocks support move/resize/completion/Remove time; and habits remain separate. The tracker can now be completed and the development branch checkpointed and remotely verified.
