# Visual Verification Notes

## First two viewport inspections

The desktop workspace renders the intended asymmetric operating layout: a compact rail, a high-priority focus canvas, a timeline canvas, then supporting goal, habit, capacity, and analytics surfaces. The dark mineral palette, lichen action color, subtle blue time canvas, and data-oriented typography remain legible and consistent.

The 390px mobile layout preserves the quick-capture action and visible primary navigation without horizontal page overflow. It correctly collapses the rail into compact icon navigation, stacks the focus and time canvas in an intelligible order, and retains clear empty states. The next verification cycle should use populated real records to validate the density of rows, charts, calendar matrices, and mutation feedback.

## Connected workflow checks

The anonymous workspace successfully persisted a quick-captured task through the browser. It appeared in the focus list and calendar timeline, and completion correctly changed the task state, reduced the open count, removed the active time canvas block, and updated the completion trend. A goal created through the structured dialog closed the dialog and appeared in the goal runway with an explainable zero-percent task-backed progress value. These checks confirm that dashboard views refresh from persisted mutations rather than relying on static example content.

## Habit and streak check

A real habit named **Evening reflection** was created through the composer. Its seven-day trace rendered a visible `0d` streak before completion. Marking the current local-day check-in completed persisted the history and updated the visible streak to `1d` immediately, while also updating the accessible control label. This verifies the dashboard’s habit rhythm and streak display against persisted data.

## Final interaction checks

The compact optional AI companion is present within the focus surface and explicitly states that it creates only a draft requiring confirmation. A real persisted task opened into the task inspector with editable title, lifecycle state, due date, planned date, and minute estimate controls. This confirms that the main planner exposes an intentional detail surface for higher-impact edits rather than relying on a static task list.

## Calendar-horizon check

The calendar’s Day, Week, Month, Quarter, and Year controls were exercised against persisted planning data. The task appeared on its planned local date across the weekly, monthly, quarterly, and yearly matrices, with each horizon retaining its distinct planning prompt. The day timeline remains the high-resolution scheduling surface; matrix cells are also configured as drag targets for date rescheduling.

The same persisted workspace was switched to **Asia/Kolkata** and retained the selected local-date planning context. A real task was dispatched from Monday, August 24 to the Week matrix cell for Tuesday, August 25. The backend mutation completed, the refreshed calendar removed the task from Monday, and it appeared on Tuesday. This verifies multi-view persistence and the workspace-timezone display contract without relying on static mock data.

The same task was then dispatched into the Day timeline for Monday, August 24. After reopening the deliberately completed task so active-calendar items are visible, the refreshed Day surface displayed it in the 09:00 time canvas on Monday. This confirms the Day drop path persisted the same local-date scheduling field as the matrix drop path.

## Verdigris Daylight redesign

Desktop and mobile inspection confirmed the lighter mineral canvas, evergreen action color, focus-first hierarchy, and line-based time motif. At mobile width, the compact navigation retains visible touch targets, the quick capture stays directly under the page title, the focus panel remains visually dominant, and all lower planning surfaces stack without horizontal page overflow. The review verified visible focus states, contrast-bearing controls, and reduced-motion-compatible CSS remain in place.

## Smoked Verdigris refinement

One bounded desktop pass at 1280×720 and one compact mobile pass at 375×812 were completed after recalibrating the former bright mint treatment. The interface now uses muted smoked-stone surfaces, restrained verdigris actions, flatter borders, and reduced decorative background treatment. The desktop hierarchy remains clear across the rail, focus lane, timeline, habits, capacity, and analytics. The mobile layout preserves the navigation rail, capture control, focus surface, calendar, and habit guidance without horizontal overflow.

## Action queue verification

The daily action queue was exercised against the real **Prepare weekly planning review** task. Selecting it revealed the bulk lifecycle controls. Bulk completion persisted the task’s completed state, removed it from the open action queue and time canvas, updated the focus count, and refreshed the reliability and focus signals. The task was then reopened through the existing task control, restoring its original open state and returning it to the queue. This verifies that selection and bulk completion are wired to persisted workspace mutations rather than display-only controls.

The action queue’s **Today** filter was applied against the same scheduled task and preserved the expected row. A saved view named **Today focus verification** was then created through the real create mutation and appeared as a persisted recall chip with pin and delete controls.

The temporary saved view was pinned through its version-safe update flow, visibly changing from an empty to filled star. It was then deleted through the workspace-scoped delete flow, leaving no test-only saved view behind. The browser prompt used solely for this validation was restored.

For explicit update coverage, a view named **Recall update verification** was created with the Today/Priority configuration. The live controls were changed to All active history/Newest, then **Save view** was invoked with the same name. The existing named view remained one chip, confirming the create-or-overwrite branch rather than duplicate creation. The next check will apply this stored configuration after deliberately changing the controls away from it.

The filter and sort controls were deliberately changed back to Today/Priority, then the named saved-view chip was applied. The live controls returned to **All active history** and **Newest**, proving persisted configuration recall. The temporary view will now be deleted and the browser prompt restored.

The temporary view was deleted successfully, and the browser prompt was restored. The live saved-view path now has evidence for creation, overwrite/update, recall, pinning, and deletion without retaining test-only workspace data.

For a final persistence check, a new temporary view named **Fresh snapshot verification** was created with **All active history** and **Newest** selected. The planner will now reload so the saved configuration is read from a fresh workspace snapshot before recall.

After the full reload, the action queue began at `open,priority`. Applying **Fresh snapshot verification** changed the actual select values to `all,created`, as read from the controls directly. This proves that the saved filter and sort configuration was read from a fresh persisted workspace snapshot and applied, rather than retained only in client state.

The temporary fresh-snapshot view was deleted successfully and the browser prompt was restored. The saved-view workspace remains clear of verification-only records.

## Public Vercel production recovery

The public alias at `https://personal-calander.vercel.app/` was reloaded after the production serverless API and database configuration were repaired. It rendered the complete usable Today workspace rather than the previous loading skeleton: the navigation rail, quick capture, daily signal, action queue, calendar time canvas, goal runway, habit rhythm, planning-health signals, private iPhone-calendar link control, and browser-notification permission control were all visible. Direct public API checks also returned `200` for the health function, typed tRPC health procedure, and the database-backed workspace snapshot. This confirms the browser state is backed by the public Function and persisted planner workspace rather than static HTML.

## Public persistence verification fallback

The My Browser extension timed out while a fresh public saved-view click-through check was in progress, so no further browser mutations were performed. An isolated public tRPC contract test was used instead: it created a temporary task saved view, updated its configuration with version checking, loaded a fresh workspace snapshot that contained the overwritten value, and deleted the temporary record. A separate isolated public workspace created a daily habit, persisted a completed local-date check-in, retrieved it from a fresh snapshot, and cleared it again. The existing visual implementation plus these deployed persistence checks provide evidence for the calendar-habit complete/undo pathway without modifying the user’s real planner data.

## Strict overwritten-view reload check

An independent browser session subsequently completed the stricter user-facing saved-view sequence on the public Vercel alias. It first saved **Overwrite reload proof** with **Today / Priority**, then changed the controls to **All active history / Newest** and saved under the same name. After a full page reload, the persisted saved-view chip was present and active when recalled. Directly reading the rendered selects recorded `all` / `created`, visibly labelled **All active history** and **Newest**. The temporary view was then deleted. This proves the actual overwrite → fresh reload → user-facing recall path, not merely API-level persistence.

## Local recurrence and Review-route verification

An independent local browser created a disposable task through the real composer with **Weekly** recurrence, an interval of `2`, and a stop date of `2026-10-31`. The created task appeared in Today; reopening the active task-row editor restored **Weekly**, `2`, and the same stop date. The task was archived after verification and no longer appeared in active planning. The dedicated Review route then opened a weekly review, accepted a reflection, completed it, and displayed the completed reflection in **Recent completed reviews** alongside plan-health and decision-signal context. Desktop and 375px mobile checks remained structurally stable, and the interface-quality detector returned no findings.

## Research-informed habit schedule verification

The composer now shows an explicit **Planned rhythm** selector only for habits, with **Every day**, **Selected weekdays**, and **Every N days** options. The selected-weekday control uses compact pressed-state day chips with clear focus treatment. A disposable Monday–Friday habit persisted into the dedicated tracker; Saturday and Sunday rendered as low-emphasis, non-actionable rest days rather than misleading check-in buttons.

An anchored interval habit with an every-three-days rhythm appeared on August 18, 21, and 24, with August 19, 20, 22, and 23 explicitly marked unscheduled. It was therefore impossible to create an accidental complete/skip record on an intervening day. Both temporary habits were archived through the visible organizer confirmation path, and fresh accessibility searches confirmed that neither remained active. The task-focused main Calendar was not changed by this workflow.

## Keyboard and integration-boundary verification

The task composer’s recurrence selector took keyboard focus, opened with `Enter`, and closed with `Escape`. The **Begin review** action likewise took direct keyboard focus. A disposable daily habit verified the selected-date Habit Calendar’s primary **Complete** action and true undo by keyboard alone; it was then archived. The iPhone Calendar control generated a private read-only subscription link in an isolated workspace and visibly exposed copy, open, and revoke affordances. Notification permission was checked only in an isolated browser context: the UI correctly distinguishes permission readiness from message delivery and still states that VAPID-backed delivery is not active.
