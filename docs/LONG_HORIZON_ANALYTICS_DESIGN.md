# Long-Horizon Planning and Decision Analytics Design

## Purpose

This design expands Personal Calendar from a collection of dated records into a personal planning system that connects **yearly direction**, **quarterly outcomes**, **monthly milestones**, and **weekly/daily execution**. It intentionally avoids an opaque productivity score. Every signal must be derived from persisted workspace data, explain its source, and offer a proportional next action.

> **Product boundary:** A signal is a decision aid, not a prediction, diagnosis, or judgement of the user. The application must never infer commitment, fabricate progress, or create work/reminders without confirmation.

## Research-informed principles

| Principle | Design consequence |
|---|---|
| Broad, superordinate goals and concrete subordinate goals are complementary in long-term pursuit. [1] | Maintain an explicit hierarchy rather than forcing a yearly goal to behave like a task. |
| Progress monitoring supports attainment when it is recorded and translated into action. [2] | Pair progress and pace with linked-work coverage, a next action, and review context. |
| Actionable feedback is timely, individual, non-punitive, and customizable. [3] | Use neutral labels, disclose calculation inputs, and never present a deficit without a safe next action. |
| If–then plans help bridge the gap between an intention and action. [4] | Let users add an optional cue plus response plan to a goal or milestone; keep it optional and user-authored. |

## Planning hierarchy

| Layer | Primary role | Required relationship | Example |
|---|---|---|---|
| Yearly goal | Directional outcome and why | May own quarterly goals or projects | “Build financial resilience” |
| Quarterly goal | Outcome checkpoint | Has a yearly parent or stands independently | “Build a three-month cash buffer” |
| Monthly milestone | Measurable progress checkpoint | Belongs to a quarterly or yearly goal | “Save the first month of expenses” |
| Project | Finite body of work | Optionally belongs to a goal | “Automate monthly savings transfer” |
| Task / habit | Execution and repeated practice | Explicitly linked to a goal or project when relevant | “Review spending every Friday” |

Existing `parentGoalId`, `project.goalId`, `task.goalId`, `task.projectId`, and `habit.goalId` remain the only rollup edges. The release will add explicit milestone records rather than guessing that unrelated tasks contribute from their names, colors, or categories.

## Derived goal health model

The dashboard will derive the following values on each snapshot refresh. It will not persist a second, mutable copy of these calculations.

| Signal | Calculation | Display rule | Next action |
|---|---|---|---|
| Progress | Existing manual/measure/task progress, extended with completed milestone contribution where an explicit target exists | Show a percentage only when a valid progress mode and target exist | Update measure, complete linked work, or review milestone |
| Pace | `actual progress − expected progress`, where expected progress is the elapsed share between an explicit start and due date | Show **On pace**, **Behind pace**, or **Ahead of pace** only when both dates span at least one day | Plan a linked task or revise the user-owned date/target |
| Deadline distance | Calendar days until a future due date, or days overdue after it passes | Show as context, never as a red-only alarm | Review scope or set the next milestone |
| Execution coverage | Count of active linked projects/tasks/habits plus scheduled linked work in the next 14 days | Show **Needs a next step** when a non-completed goal has no active execution link | Create or link a project, task, habit, or milestone |
| Milestone coverage | Count of open future milestones within the goal hierarchy | Show **No upcoming milestone** only for dated goals with no future milestone | Add a monthly or quarterly milestone |
| Review freshness | Most recent completed review matching the goal horizon or a lower supporting horizon | Use “Review due” only as a neutral prompt | Start a monthly, quarterly, or yearly review |

### Pace safeguards

Pace is unavailable when a goal has no start date, no due date, an invalid date interval, or no explicit measurable/task basis. A past-due goal is not automatically marked failed. Changes to scope, dates, targets, and progress remain user-controlled and version-safe.

## Analytics additions

The expanded analytics surface will prioritize four answers that a person can act on now:

1. **What is moving?** A goal/milestone progress rollup and a completion trend based on actual persisted completions.
2. **What is drifting?** Pace delta, dated work that is overdue, blocked linked work, and goals without execution coverage.
3. **What deserves the next planning decision?** The highest-priority long-horizon goal needing a milestone, next action, or review.
4. **How is the plan balanced?** Workload and category distribution, contextualized by the currently active goal horizons rather than a generic productivity score.

The interface will use concise trend or status visuals with text labels, accessible legends, and an explanatory detail. Empty workspaces will show setup guidance rather than fabricated analytics.

## Web Push delivery boundary

The user has VAPID values, but delivery will remain disabled until explicit approval is recorded. The first release is deliberately narrow:

1. A user activates a device by clicking an explicit **Enable reminders on this device** control.
2. In the same gesture, the app requests browser permission and subscribes with the VAPID public key.
3. The server stores the workspace-scoped endpoint and encryption keys without rendering them back to the client.
4. The user triggers one visible test notification; the server records the outcome and disables invalid subscriptions on terminal failure.
5. The user can disable the device locally and server-side. The service worker refreshes a changed subscription when possible.

No recurring notifications, silent messages, background timers, reminder schedule, or externally visible delivery will be enabled in this release without a second explicit user decision. This preserves the user’s control and lets real iPhone/browser delivery be verified before automation is introduced.

## Implementation sequencing

1. Add milestone persistence, goal update contracts, and pure horizon-health rules with deterministic tests.
2. Add derived dashboard fields and an accessible long-horizon planning surface.
3. Validate hierarchy, pace, risk, coverage, review freshness, and empty states in the browser.
4. After explicit approval, configure VAPID secrets securely and implement subscription, opt-out, refresh, and manual test-send paths.
5. Only after device delivery is demonstrably successful, present options for daily-plan or weekly-review reminder cadence.

## References

[1] Höchli, B., Brügger, A., & Messner, C. (2018). *How Focusing on Superordinate Goals Motivates Broad, Long-Term Goal Pursuit.* [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6176065/)

[2] Harkin, B. et al. (2016). *Does monitoring goal progress promote goal attainment?* [PubMed](https://pubmed.ncbi.nlm.nih.gov/26479070/)

[3] Larson, E. et al. (2011). *Feedback as a Strategy to Change Behavior: The Devil Is in the Details.* [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC3303967/)

[4] Gollwitzer, P., & Sheeran, P. *Implementation Intentions.* [NIH Behavioral Research Program](https://cancercontrol.cancer.gov/brp/research/constructs/implementation-intentions)
