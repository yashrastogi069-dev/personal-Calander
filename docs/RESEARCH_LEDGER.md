# Research Ledger: Personal Calander Product Decisions

This ledger separates external evidence from implementation decisions. It is an evolving research record, not a claim that every source is independent research; vendor guidance is treated as documented product practice and evaluated critically.

## Planning, triage, and weekly review

| Finding | Evidence | Product implication |
|---|---|---|
| A low-friction inbox should collect unplanned work before deciding when it starts. | Things distinguishes Inbox capture from a later decision about Today, Upcoming, Anytime, or Someday.[1] | Retain quick capture and make its default state an explicit inbox-like **not started, unscheduled** task. Do not force due dates at capture. |
| A daily view should represent chosen commitments, not every possible task. | Things frames Today as tasks to start before day end and keeps noncommitted work in broader horizons.[1] | Preserve Today as a decision surface with triage and capacity, rather than rendering every active record. |
| Projects should be finite; ongoing life domains need a separate grouping concept. | Things treats Projects as multi-step, finite outcomes and Areas as ongoing responsibilities.[1] | Keep projects finite. Current color categories can serve as lightweight Areas, but future domain/area semantics should not be conflated with short-lived tags. |
| Custom views are valuable once task volume grows, but their scope must be explicit and deletion must be possible. | Todoist documents filters as user-created task views based on criteria, separate from built-in views, with edit and delete workflows.[2] | Keep persisted saved views versioned, editable, and deletable. Prefer structured filters/sorts before introducing a fragile free-form query language. |
| A weekly review is most durable when it combines clearing inputs, making data current, reflecting briefly, and planning ahead; the timing should be consistent but user-defined. | Todoist describes a Get Clear / Get Current / Get Creative structure and warns that a sustainable review should be individualized.[3] Sunsama likewise recommends reflection, adjustment, and realistic forward planning rather than a punitive scorecard.[4] | The dedicated Review route should remain short and decision-oriented. Future work should add a small, optional review checklist and a user-chosen review cadence only after reminder delivery is live. |

## Provisional decisions

1. **Adopt:** Keep quick capture date-free by default and surface it during daily/weekly triage.
2. **Adopt:** Keep task calendar and habit tracker separate; calendars express temporal commitments while habit tracking expresses repeated accountability.
3. **Adopt:** Treat archival as the default removal action for history-bearing entities; retain explicit safe detachment for categories.
4. **Defer:** A free-form saved-view query language. Structured filters protect the anonymous, single-user product from opaque parsing and migration complexity.
5. **Defer:** Automatic weekly review reminders until a VAPID-backed, user-controlled delivery path is implemented and tested.

## Habit tracking and tracker safety

| Finding | Evidence | Product implication |
|---|---|---|
| Digital habit interventions commonly use self-monitoring, goal setting, and prompts/cues, but long-term maintenance is harder than short-term engagement. | A systematic review of 41 digital behavior-change studies found feedback/monitoring, associations, and goals/planning common; it also noted that most reviewed interventions were shorter than three months.[5] | Keep the tracker low-friction and reversible. Do not equate a streak with long-term habit formation or present a score as a medical outcome. |
| Habit strength varies substantially across people and behaviors; simplistic claims such as “21 days” are unsupported. | A 2024 systematic review/meta-analysis reported median estimates around 59–66 days in the studies that reported them, mean estimates of 106–154 days, and a 4–335-day range; study quality and heterogeneity limit precision.[6] | Avoid “form your habit in N days” promises. Show history and schedule adherence, while using neutral language around progress. |
| Repetition in a stable context, self-selected behavior, timing, and practical friction affect habit formation. | The meta-analysis identifies frequency, timing, behavior type, individual choice, affective judgments, regulation, and preparatory habits as determinants.[6] | Add schedule configuration only when the model and UI can make that schedule clear. A future habit detail should support a cue/anchor note rather than forcing it at creation. |
| Self-monitoring can create reflection and awareness, but can also become tedious, boring, or punitive. | A 1,768-participant study found both reflective/accountability benefits and risks of tedium, boredom, and harmful self-criticism in self-monitoring systems.[7] | Preserve **Complete**, **Skip**, and **Undo** as distinct nonjudgmental states. Avoid punitive red streak-loss treatments, shame-oriented copy, or coercive reminder cadence. |

## Additional provisional decisions

6. **Adopt:** The dedicated Habit Tracker must show actual scheduled opportunities and completion/skip counts, not a generic engagement score.
7. **Adopt:** Future reminders must be optional, user-timed, and default off; frequency selection should be explicit and its schedule visible in the tracker.
8. **Reject:** A universal “habit formed” deadline, automatic guilt-oriented streak recovery, or involuntary high-frequency nudges.

## Calendar and web-push integration boundaries

| Finding | Evidence | Product implication |
|---|---|---|
| iCalendar is a standard format for exchanging events, to-dos, journals, and free/busy information; it does not itself create a trustworthy two-way account integration. | RFC 5545 defines the iCalendar data format and distinguishes it from transport/interoperability protocols.[8] | Keep the existing token-protected `.ics` feed explicitly read-only. A future two-way Google/Microsoft integration needs separate OAuth, external IDs, conflict policy, and idempotent reconciliation; do not imply those capabilities today. |
| iPhone Home Screen web push requires a server, user-gesture permission/subscription, a service worker, and visible notifications. | Apple specifies iOS/iPadOS 16.4+ Home Screen web apps, immediate subscription from a user gesture, server storage of endpoint/encryption keys, a service worker, and immediate visible notification display; Safari may revoke permission for invisible pushes.[9] | Do not attempt delivery until VAPID secrets are supplied. The future enable flow must be an explicit user gesture inside the installed app and must surface a visible success/failure state. |
| A push subscription contains a secret capability endpoint and encryption material; subscriptions can expire or change. | MDN calls the endpoint a capability URL and warns about CSRF/XSRF; W3C specifies endpoint uniqueness, generated key material, expiration, and `pushsubscriptionchange` refresh behavior.[10] [11] | Store subscriptions server-side, workspace-scoped, and protected from CSRF. Implement opt-out, a change handler, endpoint deactivation on terminal failure, and never expose endpoint values in UI or logs. |
| Push is asynchronous and resource-constrained, not an appropriate substitute for an active channel or a guaranteed deadline engine. | W3C notes that push has higher latency and resource cost than direct fetch/WebSockets and may be limited in quantity/size.[11] | Begin with one manual test notification, then a low-frequency daily-plan and weekly-review schedule using an idempotent outbox. Avoid high-frequency, silent, or duplicate notifications. |
| Server responses must control recovery. | Apple documents `201` success, `410` expired token, `403` authentication error, `413` payload too large, and `429` rate limiting.[9] | Model sends as auditable attempts; mark `410` subscriptions disabled, prevent retry storms, and use concise non-sensitive payloads.

## Additional integration decisions

9. **Adopt:** The first live push milestone is subscribe → persist → user-triggered test → visible iPhone confirmation → opt-out; recurring reminders come only afterward.
10. **Adopt:** Calendar feeds remain revocable capability URLs and will not include sensitive habit telemetry.
11. **Defer:** Two-way calendar synchronization until an authenticated workspace model, provider OAuth, external event identity, and conflict resolution specification exist.

## Long-horizon goals and decision analytics

| Finding | Evidence | Product implication |
|---|---|---|
| Goal-progress monitoring has experimental evidence for improving goal attainment, but it should bridge goals into actions rather than become a passive score. | Harkin et al. synthesized 138 experiments (N=19,951) and found that monitoring interventions increased monitoring and promoted goal attainment; recorded monitoring and reported outcomes were stronger moderators.[12] | Give each monthly, quarterly, and yearly goal a visible progress measure, current pace, dated next commitment, and a review prompt. Do not present an unexplained percentage as insight. |
| Feedback is not reliably helpful when it is vague, punitive, delayed, or lacks a path to action. | Larson et al. describe actionable feedback as timely, individualized, non-punitive, and customizable; they warn that a large gap without a bridge plan can discourage action.[13] | Analytics must explain the source of a signal and expose one proportional next action, such as planning a linked task, updating a measure, or reviewing a slipping milestone. Avoid red-score dashboards and unsupported forecasts. |
| Browser push is an opt-in, server-mediated capability. Subscriptions include a private endpoint and encryption material, and service workers can receive subscription-change events. | MDN requires an active service worker and emphasizes CSRF protection plus confidentiality of capability endpoints; Apple requires a user gesture, server storage, and an immediately visible notification for Safari/iOS web push.[9] [10] | The push release must use an explicit enable button, protected server-side upsert/disable endpoints, subscription refresh, a user-triggered test send, and concise visible notification payloads. It must not silently subscribe, send, or schedule reminders. |

## Additional provisional decisions

12. **Adopt:** Model goal health as **progress**, **pace versus elapsed time**, **deadline distance**, **linked-work coverage**, and **next review/commitment**—not one opaque success score.
13. **Adopt:** Make all long-horizon signals local-date and workspace-derived, with neutral labels such as *needs a next step* or *pace is behind plan* instead of failure language.
14. **Adopt:** Start live web push with one explicit device enablement and one user-triggered test notification; defer automatic reminder schedules until the user chooses cadence and confirms the delivery semantics.

## Goal hierarchy and action translation

| Finding | Evidence | Product implication |
|---|---|---|
| Broad, long-term goals and concrete subordinate goals support different parts of sustained pursuit and are complementary rather than alternatives. | Höchli et al. argue that superordinate goals provide meaning, guidance, and importance for broad long-term challenges, while subordinate goals specify the concrete means; the review recommends combining both levels.[14] | The goal model should explicitly connect **yearly direction → quarterly outcome → monthly milestone → project/task action**. Parent relationships should create a navigable rollup, while lower-level work must retain a concrete next action. |
| Intentions alone leave a substantial action gap; implementation intentions identify the cue and response that turn a goal into action. | The NIH behavioural research reference describes implementation intentions as *if–then* plans that link a critical cue with a goal-directed response and summarizes a 94-study meta-analysis with a medium-to-large effect on attainment.[15] | A long-horizon goal that has no linked milestone or scheduled next action should be shown as **needs a next step**, with an optional cue/response plan. The system should suggest a small plan, never infer or execute one without confirmation. |

## Additional provisional decisions

15. **Adopt:** Treat yearly goals as directional outcomes, quarterly goals as outcome checkpoints, and monthly goals as measurable milestones; use projects and tasks as the execution layer.
16. **Adopt:** Compute a rollup only through explicit parent-goal, project-goal, goal-task, and goal-habit links. Never invent contribution weights from category or title similarity.
17. **Adopt:** Expose a voluntary *next action / cue plan* prompt when a long-horizon goal lacks execution coverage; do not create automatic tasks or reminders.

## iPhone Calendar, Reminders, and web-push boundaries

| Finding | Evidence | Product implication |
|---|---|---|
| iCloud Calendar supports a subscription URL that a person can add on iPhone and see across their Apple devices. | Apple Support documents adding a subscription calendar by entering its web address and choosing iCloud; subscriptions can later be removed.[16] | Retain and improve the existing revocable private `.ics` feed as the no-install Calendar integration. It is a read-only planning display, not a two-way sync or reminder writer. |
| Creating or modifying Apple Reminders is documented through EventKit after permission to the person’s local Calendar/Reminder database. | Apple’s EventKit documentation describes native event/reminder access, including explicit confirmation before modifying Calendar database data.[17] | A website/PWA cannot truthfully claim direct Apple Reminders synchronization. A future companion **native iOS app** could use EventKit after explicit device permission; the current web app will use Web Push and Calendar subscription instead. |
| An installed iPhone Home Screen web app can receive cross-browser standards-based web push on iOS 16.4+, but subscription must be initiated from a user gesture, stored server-side, and each received push must display visibly. | Apple requires the permission-and-subscribe step from a gesture, server registration of endpoint/encryption keys, a service worker, and immediate visible notifications; invisible pushes can lead Safari to revoke permission.[9] | Make the PWA the reminder channel: a clear device opt-in, visible test push, active opt-out, then user-chosen daily-plan/weekly-review cadence. Do not rely on Apple Reminders or silently send a background wake-up. |

## Additional integration decisions

18. **Adopt:** Offer two complementary iPhone experiences: a read-only private Calendar subscription for time-block visibility and an opt-in Home Screen PWA notification channel for reminders.
19. **Reject for the web app:** Direct create/update/sync of Apple Reminders. It requires native EventKit access and explicit device authorization, not a browser-only capability.
20. **Defer:** A native iOS companion with EventKit. It is a separate product surface that requires Apple-native packaging, permission UX, and a conflict specification.

## Sources

[1]: https://culturedcode.com/things/guide/ "Things: Getting Productive with Things"
[2]: https://www.todoist.com/help/articles/introduction-to-filters-V98wIH "Todoist: Introduction to filters"
[3]: https://www.todoist.com/productivity-methods/weekly-review "Todoist: The Weekly Review"
[4]: https://www.sunsama.com/blog/how-to-do-weekly-review "Sunsama: How to Conduct a Weekly Review"
[5]: https://pmc.ncbi.nlm.nih.gov/articles/PMC11161714/ "Zhu et al., Digital Behavior Change Intervention Designs for Habit Formation: Systematic Review"
[6]: https://pmc.ncbi.nlm.nih.gov/articles/PMC11641623/ "Singh et al., Time to Form a Habit: Systematic Review and Meta-Analysis"
[7]: https://pmc.ncbi.nlm.nih.gov/articles/PMC6122239/ "Orji et al., Tracking feels oppressive and ‘punishy’"
[8]: https://datatracker.ietf.org/doc/html/rfc5545 "RFC 5545: Internet Calendaring and Scheduling Core Object Specification"
[9]: https://developer.apple.com/documentation/usernotifications/sending-web-push-notifications-in-web-apps-and-browsers "Apple: Sending web push notifications in web apps and browsers"
[10]: https://developer.mozilla.org/en-US/docs/Web/API/Push_API "MDN: Push API"
[11]: https://www.w3.org/TR/push-api/ "W3C: Push API"
[12]: https://pubmed.ncbi.nlm.nih.gov/26479070/ "Harkin et al., Does Monitoring Goal Progress Promote Goal Attainment?"
[13]: https://pmc.ncbi.nlm.nih.gov/articles/PMC3303967/ "Larson et al., Feedback as a Strategy to Change Behavior"
[14]: https://pmc.ncbi.nlm.nih.gov/articles/PMC6176065/ "Höchli et al., Superordinate Goals and Long-Term Goal Pursuit"
[15]: https://cancercontrol.cancer.gov/brp/research/constructs/implementation-intentions "NIH: Implementation Intentions"
[16]: https://support.apple.com/en-us/102301 "Apple Support: Add calendar subscriptions in iCloud"
[17]: https://developer.apple.com/documentation/eventkit/creating-events-and-reminders "Apple EventKit: Creating events and reminders"
