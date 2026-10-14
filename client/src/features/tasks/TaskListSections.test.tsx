import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureTaskCard } from "./taskCardFixtures";
import { sectionFacts, TaskListSections } from "./TaskListSections";
import type { TaskListSection } from "./taskWorkspaceModel";
import type { TaskCardModel } from "./taskCardModel";

const noop = () => {};

function section(id: TaskListSection<TaskCardModel>["id"], label: string, tasks: TaskCardModel[], extra: Partial<TaskListSection<TaskCardModel>> = {}): TaskListSection<TaskCardModel> {
  return { id, label, tasks, count: tasks.length, overdueCount: 0, somedayCount: 0, plannedMinutes: 0, doneTodayCount: 0, ...extra };
}

describe("sectionFacts", () => {
  const base = { overdueCount: 0, somedayCount: 0, plannedMinutes: 0, doneTodayCount: 0 };

  it("reports overdue only on Past due", () => {
    expect(sectionFacts({ id: "past_due", ...base, overdueCount: 3 })).toEqual(["3 overdue"]);
    expect(sectionFacts({ id: "today", ...base, overdueCount: 3 })).toEqual([]);
  });

  it("reports someday only on No date", () => {
    expect(sectionFacts({ id: "no_date", ...base, somedayCount: 2 })).toEqual(["2 someday"]);
    expect(sectionFacts({ id: "later", ...base, somedayCount: 2 })).toEqual([]);
  });

  it("reports planned time and done count on Today, and nothing when empty", () => {
    expect(sectionFacts({ id: "today", ...base, plannedMinutes: 150, doneTodayCount: 2 })).toEqual(["2h 30m planned", "2 done"]);
    expect(sectionFacts({ id: "today", ...base })).toEqual([]);
    expect(sectionFacts({ id: "done", ...base, doneTodayCount: 4 })).toEqual([]);
  });
});

describe("TaskListSections", () => {
  const sections = [
    section("past_due", "Past due", [fixtureTaskCard({ id: "a", title: "Late thing" })], { overdueCount: 1 }),
    section("today", "Today", [fixtureTaskCard({ id: "b", title: "Today thing" }), fixtureTaskCard({ id: "c", title: "Other thing" })]),
    section("done", "Done", [fixtureTaskCard({ id: "d", title: "Finished thing", isComplete: true, state: "completed", check: { checked: true, action: { kind: "reopen" } } })]),
  ];

  it("draws a labelled region per section with a toggle that reports expanded state", () => {
    const html = renderToStaticMarkup(<TaskListSections sections={sections} onOpen={noop} onToggle={noop} />);
    expect(html.match(/<section /g)).toHaveLength(3);
    expect(html.match(/aria-expanded=/g)).toHaveLength(3);
    expect(html).toContain("1 overdue");
    expect(html).toContain("Late thing");
  });

  it("collapses Done by default and takes its rows out of the tab order", () => {
    const html = renderToStaticMarkup(<TaskListSections sections={sections} onOpen={noop} onToggle={noop} />);
    const done = html.slice(html.lastIndexOf("<section", html.indexOf('data-section="done"')));
    expect(done).toContain("is-collapsed");
    expect(done).toContain('aria-expanded="false"');
    expect(done).toContain("Show done");
    expect(done).toMatch(/inert/);
    const today = html.slice(html.indexOf('data-section="today"'), html.indexOf('data-section="done"'));
    expect(today).toContain('aria-expanded="true"');
    expect(today).not.toContain("inert");
  });

  it("can start with nothing collapsed", () => {
    const html = renderToStaticMarkup(<TaskListSections sections={sections} defaultCollapsed={[]} onOpen={noop} onToggle={noop} />);
    expect(html).not.toContain("is-collapsed");
  });

  it("staggers entering rows only on the first mount, capped at eight", () => {
    const many = [section("today", "Today", Array.from({ length: 10 }, (_, index) => fixtureTaskCard({ id: `t${index}`, title: `Task ${index}` })))];
    const html = renderToStaticMarkup(<TaskListSections sections={many} onOpen={noop} onToggle={noop} />);
    expect(html.match(/pc-rise/g)).toHaveLength(8);
  });

  it("shows the first-run empty state with real definitions and a Capture action", () => {
    const html = renderToStaticMarkup(<TaskListSections sections={[]} onOpen={noop} onToggle={noop} empty={{ kind: "first-run", onCapture: noop }} />);
    expect(html).toContain("Capture a task");
    expect(html).toContain("tk-definitions");
  });

  it("explains a filtered-empty result and offers to clear it", () => {
    const html = renderToStaticMarkup(<TaskListSections sections={[]} onOpen={noop} onToggle={noop} empty={{ kind: "filtered", scope: "Today", query: "zzz", onClear: noop }} />);
    expect(html).toContain("No task matches");
    expect(html).toContain("Clear filters");
  });

  it("renders nothing when empty with no empty state to show", () => {
    expect(renderToStaticMarkup(<TaskListSections sections={[]} onOpen={noop} onToggle={noop} />)).toBe("");
  });
});
