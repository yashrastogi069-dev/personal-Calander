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

The enrollment flow now displays a pending state during the permission request, reports a bounded recovery message if a browser leaves that request unresolved, treats an unreadable existing subscription as an opportunity to request a fresh subscription, and translates `AbortError` into an explicit Home Screen recovery instruction. The isolated browser repeated the abort path and displayed: **“This browser could not create a Push API subscription. On iPhone, open Personal Calendar from its Home Screen icon (not a normal browser tab), then try again.”** The automatic cadence remains correctly disabled until a device is safely enrolled. This confirms clear behavior and recovery guidance, but it does not substitute for a successful installed-iPhone subscription or delivery test.

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

The isolated records were subsequently archived through the persistence layer using their exact known verification titles, rather than deleted. A post-operation count confirmed zero active disposable goals and zero active disposable milestones.

## Public r4 reminder-control inventory

The current public r4 workspace rendered all reminder options in a distinct hierarchy: **Phone reminders** explanatory copy; **This device** state; an enabled **Connect this device** button; and separate **Scheduled rhythm** copy with **Enable daily + weekly** disabled until an exact device subscription exists. The DOM audit confirmed that the only disabled control was cadence activation in the intentionally unconnected isolated workspace. This behavior is internally consistent, but the duplicated connection wording creates unnecessary cognitive load and is being simplified before the next user instruction.

## Installed-iPhone r5 confirmation

The user supplied an installed-iPhone screenshot of the r5 surface. It shows **This iPhone — Connected to this iPhone**, the visible actions **Send test** and **Disconnect this iPhone**, and a separate **Schedule** card with **Daily 11:00 · Sunday 17:00 · New Zealand time** plus **Pause reminders**. The status feedback confirms the same Pacific/Auckland cadence is scheduled. This is user-observed evidence that the consolidated device and cadence actions are visible together in the real installed PWA. No disconnect or new test was invoked during the screenshot check.

## Phone-first product-completion audit

The current planner was reviewed at a 390×844 phone viewport and a 1440×1000 desktop viewport. The desktop shell remains calm and capable: the persistent rail, two-column Today canvas, timeline, Goal runway, habit trace, capacity band, and analytics all fit the larger context. At phone width, the existing compact icon rail keeps the six core destinations reachable but presents them as closely packed unlabeled controls, below the intended touch target size and without an immediately legible navigation hierarchy. The Today surface itself reflows safely into one column, but the long stack gives equal visual weight to immediate planning, reminder controls, time canvas, goals, habits, capacity, and analytics.

The refinement direction is mobile adaptation rather than a visual redesign: replace the icon-strip behavior with a thumb-reachable labeled mobile navigation pattern; make primary touch controls at least 44px with visible spacing; preserve the desktop rail; and use progressive disclosure for secondary Today information at phone width while retaining all functionality. The existing quiet verdigris palette, mono ritual labels, humanist body copy, and restrained cards remain the incumbent visual identity.

The first implementation keeps the desktop rail unchanged and converts the mobile rail into a fixed, six-destination bottom bar with labels, active-state clarity, spacing between targets, and `safe-area-inset-bottom` protection. The planner canvas now reserves the bar’s height, while quick capture and primary header actions use larger phone targets. Fresh 390×844 and 1440×1000 captures completed without a visible layout regression. The capture system deliberately hides fixed non-top chrome in a full-page image, so the bottom navigation’s rendered presence will be checked through browser inspection rather than inferred from the full-page phone image. The desktop capture confirmed that the larger-screen rail, navigation labels, canvas alignment, and existing Today hierarchy were preserved.

The interactive local route audit opened **Tasks** without changing any record. It rendered an immediately reachable search field, three visible filter controls, a concise task count/context line, and concrete task actions for completion, priority, subtask creation, and editing. The empty vertical space reflects the intentionally small current workspace rather than clipped content or a route-level failure. The mobile-specific review remains pending, but this confirms that the route’s desktop interaction inventory is real rather than display-only.

The local **Calendar** surface was opened without moving or creating any schedule data. Its Day mode exposes the task-focused timeline and explicit previous/next controls; its Month mode exposes the existing task-only matrix, valid month pager, task/habit boundary copy, and the real scheduled task. The month grid is deliberately wide enough to preserve seven-day scanability. The phone implementation retains that behavior through horizontal scrolling and now adds a visible swipe instruction, rather than shrinking date cells into unreadable tap targets or mixing habit tracking into the task calendar.

The **Goals** and **Habits** routes were then opened in the same isolated workspace without creating, editing, or checking off any item. Goals exposes real Plan goal, Add milestone, and New project actions alongside its visible pace and evidence model. Habits keeps its dedicated seven-day trace separate from the main calendar and exposes explicit complete, skip, undo, month paging, date selection, and day-detail actions. The active habit history was only observed. This confirms the routes preserve their distinct responsibilities and do not depend on fake or inert controls; the next responsive pass will prioritize their small labels and mobile action sizing rather than changing their data behavior.

The **Review** route was also inspected without submitting a review. It presents a return-to-today action and a real Begin review state. Opening that state revealed a clearly labeled weekly-reflection field and Close review action, with the live health and decision signals remaining available beneath it. No text was entered and no review session was saved. The route audit therefore covers Today, Tasks, Calendar, Goals, Habits, and Review while preserving the workspace unchanged.

After the final phone typography and control-size pass, fresh 390×844 and 1440×1000 renders completed successfully. The phone flow remains a vertical sequence of immediate focus, planning signal, calendar and device boundaries, time canvas, horizons, rhythm, capacity, and analytics; explanatory copy and direct controls are now larger in the dense planning, review, calendar, and habit areas. The desktop render retains its original rail and two-column composition. The installed-iPhone reminder/device blocks were intentionally left behaviorally and structurally untouched by this product-polish batch.

The public Vercel alias was reachable after the GitHub synchronization and rendered the planner shell without a runtime failure. Its isolated anonymous workspace was identified as the same UTC browser workspace used for the earlier long-horizon verification. The organizer showed precisely one active disposable record, **Disposable long-horizon verification**, with its explicit safe Archive action; its associated **Quarterly evidence checkpoint** remained attached beneath it. The browser archive action then timed out and its session became unavailable. A narrowly scoped lifecycle-state repair, restricted to that exact workspace, goal ID, and two known verification titles, completed the intended history-preserving archive cleanup. The final database read confirms both the disposable goal and its milestone have `state = archived` and retain their archive timestamps. No user-owned workspace or installed-iPhone device state was opened or changed.

The offline-capture and Today-reschedule enhancement was rendered at 390×844 and 1440×1000 without mutating planner records. The empty Today state retains its existing composition, while its quick-capture entry point and the future reschedule controls preserve the calm visual hierarchy. On populated Today lists, the new nearby-day control is confined to that surface; it does not change the Calendar, Habits, reminder, or device-management boundaries. The desktop rail and two-column planner composition remain intact, and the phone render retains its dedicated mobile navigation and no unexpected horizontal layout overflow.

The local interactive planner loaded the non-sensitive `offline-capture-r6` browser release identifier successfully. Its current isolated workspace was observed only; no task, habit, goal, reminder, calendar, or review record was changed during the release-marker check.

For a bounded UI-only proof, one synthetic offline capture was written to the isolated browser’s local storage and the queue-change event was dispatched. The Today panel visibly announced **“1 capture saved on this device and waiting for a connection.”** No planner API call or server record was made by this probe. The temporary browser-storage fixture is removed immediately after this observation so it cannot be replayed later.

After the `97af787` GitHub `main` synchronization, the public Vercel alias remained reachable and rendered the planner shell after its initial loading state. This was a read-only availability check in the public anonymous workspace; no planner, device, cadence, calendar, or review data was changed.

Following the `fc9c71a` GitHub synchronization, the public Vercel alias remained reachable and rendered the planner shell without a runtime error. Its browser release identifier still reported the prior `offline-capture-r6` artifact at the first immediate check, so the `runtime-security-r7` public-artifact confirmation remains pending propagation rather than being claimed early. The check was read-only and did not modify the public workspace or any device/reminder state.

The next public refresh reported the non-sensitive `runtime-security-r7` browser release identifier. This confirms that the GitHub-synchronized runtime dependency remediation propagated to the Vercel alias. The public planner remained reachable throughout, and no anonymous-workspace record, connected device, reminder cadence, or automation behavior was changed during verification.

## Daily Desk phone redesign — local evidence

The phone redesign contract is documented in `PHONE_REDESIGN_DIRECTION.md`. Its 390×844 first-viewport capture confirms the Daily Desk sequence: local date and route title, an obvious full-width capture deck, a clear Today commitment surface, Daily signal, expandable Plan tools and Connected tools, and five safe-area-aware bottom destinations. The final render retains visible Energy and Mood select values after an initial action-color override was corrected. The phone canvas has no horizontal clipping in the inspected viewport.

The redesigned desktop 1440×1000 capture retains the existing rail, all six desktop destinations, quick capture, two-column Today canvas, timeline, and current direct controls. The new More sheet is rendered only at phone width; its pure contract test asserts four direct destinations plus the two preserved More destinations. The latest local browser marker is `phone-daily-desk-r8`; public propagation remains the next release check. No planner record, iPhone device, Calendar link, cadence rule, or reminder automation behavior was changed during visual verification.

The first public Vercel availability check after the `f777e40` GitHub synchronization rendered the planner successfully in an isolated anonymous workspace. Its browser identifier was still `runtime-security-r7`, so the Daily Desk artifact is not claimed as publicly propagated yet. This was a read-only marker check; no task, goal, habit, Calendar link, device, cadence, or reminder setting was accessed or changed.

## Premium phone polish — local evidence

The second Daily Desk pass was rendered at 390×844 and 414×896 after defining card roles for commitment, time, direction, rhythm, reflection, and utility. The visible phone viewport retains the same first-action order while introducing more deliberate surface contrast: focus has the strongest verdigris presence; capture and check-in actions are materially clearer; time, goal, habit, capacity, and analytics surfaces no longer read as copies of one card. The safe-area navigation remains readable at both inspected widths.

Motion is limited to short interaction feedback. The More sheet uses a 180ms transform/opacity/filter entry; active navigation, buttons, task actions, and disclosure summaries use a 120–140ms press response; reduced motion removes transforms. The final detector returned no findings for `Home.tsx` and `index.css`; TypeScript, 55 Vitest tests, the production bundle, and a preserved 1440×1000 desktop capture all passed. The local marker is now `phone-premium-polish-r9`; public propagation is the remaining release check.

After the `9e71f47` GitHub synchronization, the public Vercel alias remained reachable and rendered the planner successfully in an isolated anonymous workspace. Its first browser identifier reported the prior `phone-daily-desk-r8` artifact, so the premium polish is not yet represented as publicly propagated. This was a read-only marker check; no planner, Calendar, device, cadence, or reminder data was accessed or changed.

The next public refresh reported the non-sensitive `phone-premium-polish-r9` browser identifier. This confirms that the GitHub-synchronized premium Daily Desk polish propagated to the Vercel alias. The public workspace remained unmodified throughout; no task, goal, habit, Calendar subscription, device, cadence, or reminder operation occurred during the release check.

## Rhythm Workspace — local implementation evidence

The isolated local Habits route was rendered after the first implementation pass without changing a check-in. The route now begins with a dedicated **Your rhythm today** deck, a concrete completed-versus-scheduled count, and per-habit Complete/Skip or Undo actions. The prior seven-day trace remains immediately below as history, followed by the existing separate four-week habit calendar and selected-day actions. The inspection exposed the daily action path, past-day clear path, calendar paging, and selected-day Complete/Skip controls as live interactive elements. The evidence uses only the isolated local workspace and does not alter user habit data.

The current-day rhythm deck was then verified through a reversible isolated check-in: **Complete** changed the copy to “Everything scheduled today is complete,” updated the 0/1 count to 1/1, changed the action to **Undo completed**, and updated the linked trace/calendar state. **Undo completed** returned the deck, trace, calendar, and action affordances to the original 0/1 state. No user habit record was accessed; the isolated local verification record was restored before release.

A separate true 390×844 phone-viewport inspection confirmed the intended 4+More navigation pattern: More opens an accessible overflow sheet, exposes **Habits — Track daily rhythm**, closes after selection, and transitions to the dedicated Habits route without horizontal overflow. That isolated phone workspace had no scheduled habits, so its valid empty state appeared instead of fabricated habit content; it retained the prominent route heading, Add habit action, rhythm explanation, dedicated calendar empty state, and fixed phone navigation. The active-habit Rhythm Workspace is evidenced separately in the isolated local interaction check above.

After GitHub main advanced to the Habits checkpoint, the public Vercel alias was reachable and rendered the planner shell in an isolated anonymous workspace. This was a read-only availability check; the release-marker result is recorded separately before the redesign is claimed as publicly propagated.

After a refresh, the public alias exposed the non-sensitive browser identifier **`habits-rhythm-r10`**. This confirms that the GitHub-synchronized Habits Rhythm Workspace release propagated to the public Vercel deployment. The public workspace remained unmodified; no task, goal, habit, Calendar subscription, device, cadence, or reminder control was accessed or changed during release verification.

## Managed preview runtime repair

The reported `/?from_webdev=1` failure was reproduced as two preview-only issues: Vite attempted an HMR socket to its local development port through the external preview proxy, and the React root failed in the tRPC provider with an invalid-hook error. A separate entry-module fault also showed Vite returning HTML for a randomized `/src/main.tsx?v=…` source URL. The source rewrite was removed, and the managed preview now serves the freshly built static client bundle rather than a proxy-hostile Vite client. This leaves Vite available for explicit local debugging without making the user-facing managed preview depend on an external WebSocket tunnel.

After the stable-preview server restart, an iPhone-sized preview rendered the complete Today surface with its fixed navigation. The external `?from_webdev=1` route then rendered the full planner, including task, goals, and Habits controls. Browser inspection found a mounted root and neither `@vite/client` nor Vite source-module resources. No planner record, device state, cadence rule, or reminder setting was changed while verifying the repair.

## Green Premium Daily Desk rollback — 26 August 2026

At the user’s request, the two later desktop visual experiments were removed by restoring the last green source release before them. The target preserves the Habit Rhythm Workspace and stable managed-preview repair while returning the verdigris-led Daily Desk visual system. Fresh local 1440×1000 and 390×844 captures show the restored desktop rail, calm green commitment/time panels, dedicated Habits card, stage-based phone flow, and safe-area-aware mobile navigation.

`pnpm check`, the full **60-test / 14-file** suite, and `pnpm build:client` passed after restoration; the only build notice remains the existing large-client-chunk advisory. GitHub `main` was synchronized to `8d348f611cd44493c9939de16d41d2eb01bb961a`. The first public alias read was still the later artifact, then a cache-busting refresh returned the non-sensitive marker **`habits-rhythm-r10`**, confirming the restored green public client. These visual and artifact checks were read-only: no task, goal, habit, Calendar feed, device, cadence, or reminder operation was invoked.

## Companion recovery and deep task-lane states — local evidence

The Optional Companion failure was reproduced with a safe, non-persisting planning note. The old model request produced the visible message that no readable content had returned. The corrected request uses the GPT-compatible completion-token parameter. A repeat browser submission returned a real reviewable task proposal containing a title, summary, priority, horizon, and suggested date. The proposal was deliberately **Discarded**, so this validation did not create a task, goal, calendar event, device record, or reminder change.

The hard-path tests cover readable structured output, empty/malformed content, and a rejected provider call; unavailable model output becomes a visibly labeled safe starting draft based on the user’s own note, with a retry path. The Tasks board was then inspected with its darker premium state roles: deep amber/bronze for To do, ink-blue for In progress, and forest green for Completed. A 390×844 session showed five 69px phone navigation targets, a reachable Tasks heading and capture action, and a single-column lane region within the phone viewport. TypeScript, the production build, the final detector, and **65 tests across 16 files** pass. Public propagation of `companion-lanes-r14` remains the final release check.

GitHub `main` was synchronized to `c06a1b1a69d81fad68c69b48245081f682570b1a`. The first public read returned the previous `task-board-r13` client, then the cache-busting public refresh returned **`companion-lanes-r14`** and rendered the revised Companion copy. This confirms Vercel propagation. The public anonymous workspace was read only; no task, goal, habit, Calendar feed, device, cadence, reminder, or Companion confirmation was invoked.

## Dark task-lane surface revision — local desktop evidence

The Tasks board was rebuilt at the surface level rather than by changing only its markers. The inspected desktop view now has a visibly dark bronze To do lane, deep navy In progress lane, and dark forest Completed lane, including the card, empty, movement, count, and drag-target contexts. Task labels, metadata, checkboxes, priority actions, subtask actions, edit actions, and native Move to controls remain readable against their corresponding state surfaces. The next release check is the true 390px stacked presentation and public artifact propagation; no planner record was changed in this visual check.

## Immediate movement and cohesive green lanes — local evidence

The task board now applies its lane state to the local workspace view before the version-safe persistence request returns. The isolated `Offline UI probe` was moved from To do to In progress through its native Move to control: the card and counts changed in the same rendered interaction, then remained in In progress after the request settled. This removes the previous disabled-control wait that made drag/drop feel laggy. The final visual system now uses a deep slate-blue To do lane, dark teal In progress lane, and forest Completed lane. The disposable probe was returned to To do after release verification.

At a true **390×844** viewport, the Tasks route has a 360px-wide stacked Work lanes region: To do, In progress, and Completed are separate 336px lane surfaces in one column, with no page-width overflow. The search field, filter targets, and five fixed phone navigation buttons remain reachable; each navigation button is 69×61px within the safe-area bar. The dedicated phone session had an empty workspace, so its lane validation is structural and does not create or alter planner data. The desktop disposable probe was returned to To do after the reversible persistence check.

## Task history and archive safeguards — local evidence

The Tasks route now exposes bounded To do/In progress lanes, a bounded Completed lane, and a dedicated Archived work region. In the populated local workspace, the isolated `Offline UI probe` moved into Completed and immediately exposed the explicit **Archive 1 completed** action while Archived work remained empty. The dark slate-blue, dark-teal, and forest surfaces retained readable labels, cards, movement controls, and the new archive action. The browser automation timed out at the browser-native confirmation prompt, so no destructive archive request was treated as completed and no restore claim is based on that prompt. The focused persistence and router suites instead verify task metadata clearing on restore, batched archive timestamp/version behavior, restore contracts for Goals/Projects/Habits, and stale-write conflicts. The probe is returned to its original To do state after this visual check.

A fresh 390×844 managed-preview capture retained the phone Daily Desk composition without clipped controls. The anonymous preview had no tasks, which is correct for its isolated workspace; its capture provides structural phone evidence rather than fabricated high-volume data. The populated desktop browser provides the functional Work lanes/Archive surface evidence.

After checkpoint `80e90276` was synchronized to GitHub `main`, the public Vercel alias initially returned the prior `smooth-green-lanes-r15` artifact. A cache-busting refresh after propagation mounted the public planner and reported the non-sensitive release marker **`planner-scale-r16`**. This was a read-only public verification in an empty anonymous workspace; no planner record, Calendar feed, device, cadence, or reminder data was changed.

## Calendar name and task-lane color refinement — local evidence

The rebuilt local application reports **Personal Calendar** in both the document title and the rendered brand lockup. The populated Tasks board renders a deep slate-blue To do lane, a separate dark-teal In progress lane, and the retained forest Completed lane; readable task text, state counts, native Move to controls, empty states, and the Archived work panel were preserved. The true 390×844 capture retained the phone Daily Desk structure without overflow. TypeScript, the 71-test suite, production build, source spelling scan, and detector pass completed before release propagation.

After checkpoint `83c71ca2` was synchronized to GitHub `main`, the first public read correctly showed the prior `planner-scale-r16` artifact. A cache-busting refresh then loaded **Personal Calendar** and returned the non-sensitive public release marker **`calendar-colors-r17`**. This was a read-only check in an empty anonymous workspace; no planner record, Calendar feed, device, cadence, or reminder data was changed.

## Planner-flow clarity and recovery — local evidence

The final 1280px desktop capture shows clearer secondary planning labels, the task-only **No time reserved yet** canvas, and the explicit explanation that habits remain in the dedicated Habit tracker. The canvas offers a functional **Choose a task to reserve time** action and a non-destructive **Keep the day open** dismissal; no task is generated or moved by either action. The Goal runway and Habit card retain their distinct object purposes and entry points.

The task editor was inspected without saving and renders **Deadline**, **Plan for**, **Focus time needed**, and **Reserve time** Start/End fields with connected consequence copy. A deliberate blank-title submission stayed in the dialog, displayed **Name this task before saving it.**, and made no persistence write; closing the dialog restored the exact original task board. The true 390×844 capture retains these guided task-calendar and separate Habit surfaces in a readable single-column phone composition without horizontal overflow. TypeScript, 74 automated tests, production build, and the detector completed before public propagation.

After checkpoint `6b9b202b` was synchronized to GitHub `main`, the public Vercel alias initially reported the prior `calendar-colors-r17` marker. Following the normal propagation interval, a cache-busting public read rendered **No time reserved yet**, its Task search and Keep the day open controls, and the explicit Habit tracker boundary in an isolated empty workspace. The browser release marker was **`flow-clarity-r18`**. This was a read-only check: no task, goal, project, habit, Calendar feed, device, cadence, or reminder state was changed.

## R19 capacity, deadline risk, and project breakdown — local evidence

The candidate was reviewed at **1280×720** and **390×844**. The compact Daily capacity forecast remained readable in the two-column desktop field and single-column phone sequence. With the current active workspace, it accurately showed `0 / 360 min`, the explicit known-estimate qualifier, and zero Reserved, Deadline only, and Risk figures. The browser applied the Tasks **Deadline risk** filter and rendered the safe empty lanes; no task mutation occurred.

The guided project breakdown was exercised with a named disposable project. Opening it made no write. A blank submit stayed in the dialog and displayed the local **Add at least one explicit task before creating linked work.** recovery. Two manually authored rows then created exactly two linked tasks after the explicit **Create 2 linked tasks** action; one row carried a 25-minute focus estimate and Plan for date. The records were archived through the organizer after the check, so no active verification project or task remains.

A real cleanup attempt exposed a task-editor synchronization edge case in which local lifecycle selection could be reseeded from an equivalent derived record. The final source keys editor resets to persisted task id/version rather than object identity. After rebuilding, the remaining generated task was explicitly set to archived; the browser immediately rendered zero active commitments and its Archived work row. The final source passed TypeScript, **77 tests across 20 files**, the Vercel-targeted build, and detector validation. Public-marker verification remains the next release step.

After GitHub `main` advanced to `895c1dd35e9d299da3c4faea91a4eed6c1e2fd8a`, the first Vercel read still showed the prior urgency and capacity treatment. Following a short propagation interval, a cache-busting public anonymous read rendered the new **Deadline risk** label and the compact **Daily capacity** surface; the document release identifier was read directly as **`capacity-risk-r19`**. This was a read-only production verification and did not change any public workspace, Calendar feed, device, cadence, or reminder setting.
