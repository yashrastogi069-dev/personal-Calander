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
