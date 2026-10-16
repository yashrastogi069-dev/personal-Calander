import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CanonicalTask } from "@shared/canonicalTask";
import type { WhyReason } from "@shared/whyItMatters";
import { InboxTriage, type InboxTriageProps } from "./InboxTriage";

const today = "2026-10-14";
const noop = () => undefined;

function task(overrides: Partial<CanonicalTask> = {}): CanonicalTask {
  return { id: "t1", workspaceId: "w1", title: "Call the bank about the card", state: "not_started", version: 1, createdAt: "2026-10-13T22:00:00.000Z", ...overrides };
}

function render(overrides: Partial<InboxTriageProps> = {}) {
  return renderToStaticMarkup(
    <InboxTriage tasks={[task()]} today={today} timezone="Pacific/Auckland" projects={[{ id: "p1", title: "Portfolio push" }]} onDecide={noop} onOpenDetail={noop} onCapture={noop} {...overrides} />,
  );
}

describe("InboxTriage", () => {
  it("draws one focusable triage card per undecided task with the count to sort", () => {
    const html = render({ tasks: [task(), task({ id: "t2", title: "Book a dentist" })] });
    expect(html.match(/<article/g)).toHaveLength(2);
    expect(html).toContain('tabindex="0"');
    expect(html).toContain("2</span> to sort");
    expect(html).toContain("Captured today");
  });

  it("offers Today, This week, Pick date, Project, Someday and Delete with their keys", () => {
    const html = render();
    for (const label of ["Today", "This week", "Pick date", "Project", "Someday"]) expect(html).toContain(label);
    for (const key of ["T", "W", "D", "P", "S"]) expect(html).toContain(`<kbd class="tk-kbd" aria-hidden="true">${key}</kbd>`);
    expect(html).toContain('aria-label="Delete Call the bank about the card"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("never shows a date on a card: undecided work has none", () => {
    const html = render();
    expect(html).not.toMatch(/Plan for|Due |Overdue/);
  });

  it("shows the D4 reason chip when the engine gives one", () => {
    const reason: WhyReason = { kind: "unblocks", family: "blocking", rank: 3, tone: "accent", icon: "LockOpen", short: "Unblocks 2 tasks", long: "Two tasks wait on this.", accessible: "Two tasks are waiting on this.", ref: null, basis: { count: 2 } };
    const html = render({ whyFor: () => reason });
    expect(html).toContain('data-why="unblocks"');
    expect(html).toContain("Unblocks 2 tasks");
    expect(html).toContain('title="Two tasks are waiting on this."');
  });

  it("shows the calm Inbox clear state with Capture when nothing is left to sort", () => {
    const html = render({ tasks: [] });
    expect(html).toContain("Inbox clear");
    expect(html).toContain("Capture something");
    expect(html).not.toContain("<article");
  });
});
