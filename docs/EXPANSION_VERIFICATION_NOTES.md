# Long-Horizon Expansion Verification Notes

## Local visual check — 25 August 2026

The local planner shell rendered successfully at both **1280 × 720** and **375 × 812** without altering workspace data. The existing low-glare visual system, full-card empty-state actions, calendar boundary, capacity band, and device-reminder entry point remained visible.

The mobile composition retained a usable single-column flow: immediate focus, time canvas, goal runway, habits, capacity, and momentum appeared in a clear vertical order. The new **Plan goal** affordance is visible in the Goal runway header. The Horizon Compass deliberately remains absent until at least one real goal exists; this avoids creating sample planning data and preserves the empty state as an actionable first step.

These captures validate layout only. Real iPhone delivery remains pending an opt-in and manual user-device test; no automatic reminder cadence has been created.

## Scheduled-cadence control — local visual check

The local Today surface now renders the approved Pacific/Auckland cadence as a dedicated **Scheduled rhythm** control beneath phone reminder enrollment. Its primary action is unavailable until the exact current browser device is connected, preventing local scheduler activation from being presented as a substitute for device opt-in. A desktop inspection found the phone-reminder description collapsed into an overly narrow text column; the grid was corrected to reserve a fixed label column, a flexible explanatory column, and a content-sized action column. The follow-up 1280 × 720 capture rendered the corrected top-level layout without overflow.

The cadence is still not activated in development or production. Its scheduler tasks must be created only after the deployed callback and migration are verified.

## Interactive control audit — local isolated browser

The local browser audit confirmed that the **Goals** navigation opens the Goal runway and exposes the **Plan goal** action. Opening its dialog revealed an accessible goal field, explicit Horizon selector (defaulting to yearly), optional Parent goal selector, Start date, Due date, and a clear statement that pace requires valid dates; cancelling the dialog created no record. This verifies the real composition path for the long-horizon controls without introducing user planning data.

The Today view exposes **Phone reminders**, a device-enrollment action, and the approved **Scheduled rhythm** copy: daily planning at 11:00 plus a Sunday 17:00 weekly review in New Zealand time. The automatic-cadence action is correctly disabled until an exact current browser subscription is enrolled, and the interface explains that only active devices receive scheduled sends. The audit intentionally did not request notification permission, create a subscription, send a test, enable a cadence, or write test data. Those actions require the user’s installed iPhone PWA confirmation and are not represented as passed evidence.
