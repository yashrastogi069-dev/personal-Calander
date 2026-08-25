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

## Reminder-control repair — local interaction evidence

The first reminder-control audit found a concrete failure mode: the isolated browser granted notification permission but `PushManager.getSubscription()` returned `AbortError: Error retrieving push subscription.` The previous client surfaced that raw message and left the schedule action disabled, which could reasonably look like an inert control.

The enrollment flow now displays a pending state during the permission request, reports a bounded recovery message if a browser leaves that request unresolved, treats an unreadable existing subscription as an opportunity to request a fresh subscription, and translates `AbortError` into an explicit Home Screen recovery instruction. The isolated browser repeated the abort path and displayed: **“This browser could not create a Push API subscription. On iPhone, open Personal Calander from its Home Screen icon (not a normal browser tab), then try again.”** The automatic cadence remains correctly disabled until a device is safely enrolled. This confirms clear behavior and recovery guidance, but it does not substitute for a successful installed-iPhone subscription or delivery test.

## Production reachability and scheduler correction — 25 August 2026

The public Vercel alias rendered the planner successfully after the scheduler correction was committed. The server-side correction uses a durable project-owned scheduler record rather than requesting per-user Heartbeat creation from an anonymous installed PWA. The GitHub commit was pushed successfully; an attempt to inspect Vercel’s deployment dashboard from the available browser reached Vercel’s login page, so dashboard-based commit-state confirmation remains unavailable in this session. This limitation does not affect the reachable public app or the separately published project callback, but final Vercel server-artifact verification still requires a logged-in dashboard session or a public behavior check.

An isolated browser workspace on the public alias remained empty and was therefore suitable for disposable long-horizon verification. Its rendered Goal runway exposed a live **Plan goal** control rather than a display-only affordance. The user’s personal iPhone workspace was not accessed or altered.

Opening the control presented a real dialog with a goal title, explicit **Yearly direction** horizon selector, parent-goal selector, start and due-date fields, and Create/Cancel controls. The next isolated step is to create, edit, inspect, and archive one disposable goal/milestone; no user data will be used.

The isolated dialog accepted the disposable title and a valid `2026-08-25` to `2026-12-31` date span, then submitted through its live **Create goal** control. The subsequent browser step will inspect the persisted Goal runway before adding a disposable milestone.

The persisted Goal runway card rendered the disposable yearly goal with `0%` execution/runway signals, a valid `128d left` pace display, explicit zero linked evidence, an explainable next action, and **No milestones yet**. The card exposed a live **Add milestone** action, confirming that the Horizon Compass state derives from persisted goal data rather than a display-only mock.

The real milestone dialog bound the disposable parent goal and exposed a proof title, explicit monthly/quarterly horizon selector, dated progress value/target fields, optional if–then cue and response, plus Create/Cancel actions. The isolated check will create one quarterly milestone and then edit it to demonstrate persistence.

The opened horizon selector exposed **Monthly** and **Quarterly** options, with Monthly selected by default. The verification will intentionally select Quarterly rather than relying on the default.

The isolated flow selected **Quarterly** and accepted the evidence title, due date `2026-09-30`, `25/100` measure, and explicit Friday cue/response. These values are ready for submission through the live **Create milestone** action.

The live Create mutation persisted **Quarterly evidence checkpoint**, and the Goal runway rendered it with the explicit `quarterly · 2026-09-30` metadata. The verification proceeds to edit the persisted milestone before archiving all disposable records.

The persisted milestone card is itself a real keyboard-reachable button. Activating it opened the milestone edit surface, rather than a display-only details view.

The edit dialog restored the persisted quarterly title, date, `25/100` values, and if–then evidence. The isolated test changed the progress measure to `50` and will now save, reload, confirm that value, and archive the temporary goal.

After saving and reloading the public planner, the Horizon Compass showed **50% milestones** for the disposable yearly goal and retained the quarterly evidence card. This confirms persisted create → edit → fresh snapshot behavior, including the visible analytics source. Cleanup of the disposable records remains the final browser step.

The dedicated Goals route also rendered the same persisted 50% milestone state after navigation. The goal card itself has no inline archive affordance; the verified milestone card opens edit, and archive is intentionally managed through the existing organizer/confirmation workflow rather than an ambiguous inline destructive control. The isolated records must be removed through that dedicated lifecycle surface.

The top-level organizer opened with explicit **Add category**, **Archive**, and **Close** actions. This confirms the cleanup path is available without presenting a hidden destructive action on the Horizon Compass card.

The subsequent attempt to open the archive section timed out, after which the available browser session became unavailable. The disposable goal and milestone remain in the isolated browser workspace until the browser becomes available again; this is tracked as unfinished cleanup rather than being represented as erased.

The isolated browser session later recovered. The public workspace still contained only the disposable long-horizon verification goal and its milestone, and the top-level Categories organizer control was again available for the intended archive cleanup.

The recovered organizer presented its intended explicit **Archive** management action alongside category creation and close controls. The cleanup proceeds through that archival surface rather than a hidden direct deletion.

The Archive action again timed out and the browser session became unavailable before the confirmation surface could be inspected. No destructive request was confirmed, so the isolated disposable records remain tracked for cleanup rather than being treated as archived.
