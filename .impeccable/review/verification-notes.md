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
