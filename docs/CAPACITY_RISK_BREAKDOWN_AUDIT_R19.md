# Capacity, Deadline Risk, and Project Breakdown Audit — R19

## Current State

The planner already computes a live workload ratio from persisted task estimates and workspace daily capacity. Its existing summary treats tasks planned for today and tasks due today as one workload set, but it does not distinguish reserved work from deadline pressure, surface missing estimates, or expose the supporting tasks. The Tasks board currently calls the overdue filter **At risk**, but it only returns already-overdue work. Projects are persisted and linkable during task creation, yet their listing has no operational path for turning a finite project into reviewed linked tasks.

## Chosen Contracts

| Capability | Operational rule | Guardrail |
|---|---|---|
| Daily capacity forecast | Count each unfinished task scheduled for today or due today once; show known minutes against daily capacity, remaining minutes, reserved-work minutes, deadline-only minutes, and unestimated count. | Never invent an estimate. Unknown effort is stated as a count rather than converted to a guessed duration. |
| Deadline-risk filter | Return only unfinished tasks with an explainable reason: overdue, due today, or a deadline within two days that has no plan for work. | This is a transparent urgency signal, not a completion prediction or performance score. |
| Project breakdown | Open a reviewed dialog from a concrete project. The user explicitly adds/removes task rows, titles, estimates, and optional Plan for dates before selecting **Create linked tasks**. | No task is generated on open. Each row uses a stable client request ID, so retrying after a partial network failure cannot create duplicates. |

## Interaction and Scale Decisions

The compact forecast appears in Today and uses the live dashboard query’s 30-second refresh plus the existing immediate invalidation after planner mutations. It stays concise at high volume by exposing only summary totals and a focused Tasks handoff. The deadline-risk filter is a board-level filter, so search works within the selected risk set and the existing lane preview/expansion safeguards continue to apply.

The breakdown flow is intentionally deterministic. It does not infer a project plan from a title, call a model, or fabricate steps. It supports a bounded maximum of five reviewed task rows in one creation pass, preserves the selected project relationship, and leaves the project itself unchanged if creation fails. A partial attempt preserves the dialog and names how many linked tasks were created; retry reuses per-row request IDs.

## Verification Evidence

Local browser validation confirmed the no-write opening path, blank-row recovery, optional estimate and Plan for fields, explicit two-row linked creation, and archive cleanup of the isolated verification project/tasks. The deadline-risk control reached a safe empty result in the current workspace without a mutation. The compact forecast accurately rendered zero known load against the 360-minute workspace capacity after cleanup. A final editor-state safeguard reseeds local form state only when a task’s persisted id/version changes, preventing equivalent derived objects from overwriting a selected lifecycle state before save. TypeScript, the final **77-test / 20-file** suite, Vercel-targeted production build, and detector completed successfully before publication.

The published client was then verified read-only at the public Vercel alias after GitHub `main` reached `895c1dd35e9d299da3c4faea91a4eed6c1e2fd8a`. A cache-busted production read exposed **Deadline risk**, the Daily capacity summary, and public marker **`capacity-risk-r19`**.
