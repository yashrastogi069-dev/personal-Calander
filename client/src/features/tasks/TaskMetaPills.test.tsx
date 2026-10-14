import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureTaskCard } from "./taskCardFixtures";
import { TaskMetaPills, taskPillSpecs } from "./TaskMetaPills";

const groups = (model: Parameters<typeof taskPillSpecs>[0]) => taskPillSpecs(model).map(spec => spec.group);

describe("taskPillSpecs", () => {
  it("shows nothing for a bare task", () => {
    expect(taskPillSpecs(fixtureTaskCard())).toEqual([]);
  });

  it("keeps one fixed order so rows scan like a table", () => {
    const model = fixtureTaskCard({
      state: "blocked",
      context: { kind: "project", title: "Q4" },
      categoryName: "Work",
      priority: "high",
      recurring: { cadence: "Weekly" },
      dates: [{ kind: "plan", label: "Today", tone: "accent" }, { kind: "due", label: "Due Fri", tone: "risk" }],
      subtasks: { done: 1, total: 3 },
      waitingOn: 1,
      blocks: 2,
      someday: true,
      estimateMinutes: 45,
      completedLabel: "Done today",
      pending: true,
      conflictCount: 2,
    });
    expect(groups(model)).toEqual([
      "state", "context", "category", "priority", "repeat", "date", "date", "subtasks", "dependency", "dependency", "someday", "estimate", "done", "pending", "conflict",
    ]);
  });

  it("shows priority only when the model says high or critical", () => {
    expect(groups(fixtureTaskCard({ priority: null }))).not.toContain("priority");
    const high = taskPillSpecs(fixtureTaskCard({ priority: "high" })).find(spec => spec.group === "priority");
    const critical = taskPillSpecs(fixtureTaskCard({ priority: "critical" })).find(spec => spec.group === "priority");
    expect(high).toMatchObject({ label: "High", tone: "risk" });
    expect(critical).toMatchObject({ label: "Critical", tone: "off" });
  });

  it("renders a Someday pill from the someday flag", () => {
    const spec = taskPillSpecs(fixtureTaskCard({ someday: true })).find(item => item.group === "someday");
    expect(spec?.label).toBe("Someday");
  });

  it("renders nothing for the D4 why slot", () => {
    expect(taskPillSpecs(fixtureTaskCard({ why: null })).some(spec => spec.key === "why")).toBe(false);
  });

  it("gives subtasks a spoken count and progress", () => {
    const spec = taskPillSpecs(fixtureTaskCard({ subtasks: { done: 2, total: 5 } })).find(item => item.group === "subtasks");
    expect(spec).toMatchObject({ label: "2/5", ariaLabel: "2 of 5 subtasks done", progress: { done: 2, total: 5 } });
    expect(taskPillSpecs(fixtureTaskCard({ subtasks: { done: 0, total: 1 } })).find(item => item.group === "subtasks")?.ariaLabel).toBe("0 of 1 subtask done");
    expect(groups(fixtureTaskCard({ subtasks: { done: 0, total: 0 } }))).not.toContain("subtasks");
  });
});

describe("TaskMetaPills markup", () => {
  it("renders nothing when there is nothing to say", () => {
    expect(renderToStaticMarkup(<TaskMetaPills model={fixtureTaskCard()} />)).toBe("");
  });

  it("hides the visible text from assistive tech when a spoken label replaces it", () => {
    const html = renderToStaticMarkup(<TaskMetaPills model={fixtureTaskCard({ dates: [{ kind: "overdue", label: "Overdue 2d", tone: "off", accessibleLabel: "Overdue by 2 days" }] })} />);
    expect(html).toContain('aria-hidden="true">Overdue 2d');
    expect(html).toContain('<span class="pc-sr-only">Overdue by 2 days</span>');
    expect(html).toContain("is-off");
  });

  it("marks the category pill with its tone and a dot", () => {
    const html = renderToStaticMarkup(<TaskMetaPills model={fixtureTaskCard({ categoryName: "Work", tone: "work" })} />);
    expect(html).toContain("is-cat");
    expect(html).toContain("pc-tone-work");
    expect(html).toContain("pc-dot");
  });

  it("can omit groups a lane already says", () => {
    const html = renderToStaticMarkup(<TaskMetaPills model={fixtureTaskCard({ state: "blocked", someday: true })} omit={["state"]} />);
    expect(html).not.toContain('data-pill="state"');
    expect(html).toContain('data-pill="someday"');
  });

  it("draws the subtask mini bar from the done ratio", () => {
    const html = renderToStaticMarkup(<TaskMetaPills model={fixtureTaskCard({ subtasks: { done: 1, total: 4 } })} />);
    expect(html).toContain("scaleX(0.25)");
  });
});
