import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { WhyReason } from "@shared/whyItMatters";
import { TaskRowPills } from "./TaskRowPills";

const reason: WhyReason = {
  kind: "milestone_soon", family: "goal", rank: 5, tone: "accent", icon: "Milestone", short: "Milestone in 4 days",
  long: "Moves the Launch milestone, due Mon 19 Oct.", accessible: "Moves the Launch portfolio milestone, due Monday 19 October.", ref: null, basis: { days: 4 },
};

describe("TaskRowPills", () => {
  it("draws the urgency pill in its tone with a word, never colour alone", () => {
    const html = renderToStaticMarkup(<TaskRowPills pills={[{ kind: "urgency", tone: "overdue", icon: "alarm-clock", label: "Overdue 3d" }]} />);
    expect(html).toContain("tk-pill is-off");
    expect(html).toContain("Overdue 3d");
    expect(html).toContain("lucide-alarm-clock");
  });

  it("names the project and the category for screen readers, with the category dot in its palette tone", () => {
    const project = renderToStaticMarkup(<TaskRowPills pills={[{ kind: "project", recordId: "p1", label: "Portfolio push", color: null }]} />);
    expect(project).toContain("Project Portfolio push");
    const category = renderToStaticMarkup(<TaskRowPills pills={[{ kind: "category", recordId: "c1", label: "Health", color: null }]} categoryTones={new Map([["c1", "health"]])} />);
    expect(category).toContain("pc-tone-health");
    expect(category).toContain("pc-dot");
    expect(category).toContain("Category Health");
  });

  it("draws the Waiting chip in the risk tone", () => {
    const html = renderToStaticMarkup(<TaskRowPills pills={[{ kind: "waiting", label: "Waiting · Anna", waitingOn: "Anna" }]} />);
    expect(html).toContain("tk-pill is-risk");
    expect(html).toContain("Waiting · Anna");
  });

  it("adds the repeat icon and the D4 chip last, with the full sentence as its title", () => {
    const html = renderToStaticMarkup(<TaskRowPills pills={[{ kind: "urgency", tone: "plan", icon: "calendar", label: "Plan Fri" }]} repeat="Weekly" why={reason} />);
    expect(html.indexOf("Plan Fri")).toBeLessThan(html.indexOf('data-pill="repeat"'));
    expect(html.indexOf('data-pill="repeat"')).toBeLessThan(html.indexOf('data-pill="why"'));
    expect(html).toContain("Repeats weekly");
    expect(html).toContain('title="Moves the Launch portfolio milestone, due Monday 19 October."');
    expect(html).toContain("Milestone in 4 days");
    expect(html).not.toContain("<button");
  });

  it("renders nothing when there is nothing to say", () => {
    expect(renderToStaticMarkup(<TaskRowPills pills={[]} />)).toBe("");
  });
});
