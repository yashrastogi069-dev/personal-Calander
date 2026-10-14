// Fixture TaskCardModels for component tests and the premium gallery. Never imported by product code:
// the product builds models from real records with taskCardModel().
import type { TaskCardModel } from "./taskCardModel";

export function fixtureTaskCard(overrides: Partial<TaskCardModel> = {}): TaskCardModel {
  return {
    id: "task-fixture",
    version: 1,
    title: "Draft the quarterly review",
    state: "not_started",
    isComplete: false,
    tone: "work",
    categoryName: null,
    context: null,
    priority: null,
    dates: [],
    estimateMinutes: null,
    subtasks: null,
    waitingOn: 0,
    blocks: 0,
    recurring: null,
    someday: false,
    pending: false,
    conflictCount: 0,
    completionBlock: null,
    why: null,
    completedLabel: null,
    check: { checked: false, action: { kind: "complete" } },
    ...overrides,
  };
}

/** One of each row variant the List must draw (spec 6). */
export function fixtureTaskCardVariants(): Array<{ label: string; model: TaskCardModel }> {
  return [
    { label: "Plain", model: fixtureTaskCard({ id: "t-plain", title: "Book the venue walkthrough" }) },
    {
      label: "Rich",
      model: fixtureTaskCard({
        id: "t-rich",
        title: "Prepare the board update",
        categoryName: "Work",
        context: { kind: "project", title: "Q4 planning" },
        priority: "high",
        dates: [{ kind: "plan", label: "Today", tone: "accent" }, { kind: "due", label: "Due Fri 16 Oct", tone: "risk" }],
        subtasks: { done: 2, total: 5 },
        estimateMinutes: 90,
      }),
    },
    {
      label: "Overdue",
      model: fixtureTaskCard({
        id: "t-overdue",
        title: "Send the signed contract back",
        tone: "social",
        categoryName: "Admin",
        priority: "critical",
        dates: [{ kind: "overdue", label: "Overdue 2d", tone: "off", accessibleLabel: "Overdue by 2 days" }],
      }),
    },
    {
      label: "Blocked",
      model: fixtureTaskCard({
        id: "t-blocked",
        title: "Publish the release notes",
        state: "blocked",
        waitingOn: 2,
        dates: [{ kind: "due", label: "Due 20 Oct", tone: "neutral" }],
        completionBlock: { reason: "Waiting on 2 tasks to finish first.", action: "open_detail" },
      }),
    },
    {
      label: "Recurring",
      model: fixtureTaskCard({
        id: "t-recurring",
        title: "Weekly review",
        tone: "personal",
        recurring: { cadence: "Weekly" },
        dates: [{ kind: "occurrence", label: "Next Fri 16 Oct", tone: "neutral" }],
        check: { checked: false, action: { kind: "resolve_occurrence", occurrenceId: "occ-1", expectedVersion: 1 } },
      }),
    },
    { label: "Someday", model: fixtureTaskCard({ id: "t-someday", title: "Learn to sail", tone: "learning", someday: true }) },
    {
      label: "Pending and conflict",
      model: fixtureTaskCard({ id: "t-pending", title: "Renew the passport", tone: "health", pending: true, conflictCount: 1 }),
    },
    {
      label: "Done",
      model: fixtureTaskCard({
        id: "t-done",
        title: "File the expense report",
        state: "completed",
        isComplete: true,
        completedLabel: "Done today",
        check: { checked: true, action: { kind: "reopen" } },
      }),
    },
  ];
}
