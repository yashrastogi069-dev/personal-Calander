import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CanonicalTask } from "@shared/canonicalTask";
import { TodayFlexibleWork } from "./TodayFlexibleWork";
import { TodayTimeline } from "./TodayTimeline";

// D3 §7: every surface that renders a task's key time shows a recurring series' occurrence, never
// "Plan for <anchor>". 2026-10-14 is a Wednesday; 2026-10-13T20:00Z is 09:00 on 14 Oct in Auckland.
const today = "2026-10-14";
const timezone = "Pacific/Auckland";
const noop = () => undefined;

function series(overrides: Partial<CanonicalTask> = {}): CanonicalTask {
  return {
    id: "r1",
    workspaceId: "w1",
    title: "Weekly review",
    state: "not_started",
    version: 1,
    recurrenceRule: { frequency: "daily" },
    scheduledLocalDate: "2026-09-24",
    ...overrides,
  };
}

const shared = {
  timezone,
  projectTitles: new Map<string, string>(),
  goalTitles: new Map<string, string>(),
  categoryNames: new Map<string, string>(),
  pendingTaskIds: new Set<string>(),
  linkedResolutionByTaskId: new Map(),
  linkedPlanContextByTaskId: new Map(),
  onOpenLinkedResolution: noop,
  onToggleTask: noop,
  onStartFocus: noop,
  onOpenTask: noop,
};

function flexible(task: CanonicalTask, occurrences?: { id: string; taskId: string; localDate: string; state: string }[]) {
  return renderToStaticMarkup(
    <TodayFlexibleWork
      {...shared}
      rows={[{ kind: "task", recordId: task.id, title: task.title, source: "occurrence", readOnly: false, startsAt: null, endsAt: null } as never]}
      tasks={[task]}
      localDate={today}
      occurrences={occurrences}
    />,
  );
}

describe("recurring occurrence labels outside the Tasks page", () => {
  it("Today's flexible list reads today's occurrence state from snapshot occurrences", () => {
    const html = flexible(series(), [{ id: "o1", taskId: "r1", localDate: today, state: "completed" }]);
    expect(html).toContain("Done today");
    expect(html).not.toContain("Plan for");
  });

  it("Today's timeline uses the workspace today and occurrences, not the anchor", () => {
    const task = series({ plannedStartAt: "2026-10-13T20:00:00.000Z", plannedEndAt: "2026-10-13T21:00:00.000Z" });
    const html = renderToStaticMarkup(
      <TodayTimeline
        {...shared}
        rows={[{ kind: "task", recordId: task.id, title: task.title, startsAt: task.plannedStartAt, endsAt: task.plannedEndAt } as never]}
        tasks={[task]}
        localDate={today}
        occurrences={[{ id: "o1", taskId: "r1", localDate: today, state: "skipped" }]}
      />,
    );
    expect(html).toContain("Skipped today");
    expect(html).not.toContain("Plan for");
  });
  // The Inbox case moved: a dated series is never undecided (Q1/Q2), and triage cards show no date at all
  // (InboxTriage.test.tsx).
});
