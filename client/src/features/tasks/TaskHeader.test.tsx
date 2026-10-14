import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskHeader, taskSummaryParts } from "./TaskHeader";

const noop = () => {};
const summary = { open: 36, overdue: 3, forToday: 13, inbox: 4 };
const base = { summary, view: "list" as const, onViewChange: noop, selectMode: false, onSelectModeChange: noop, onCapture: noop, onOpenArchive: noop, onCloseArchive: noop };

describe("taskSummaryParts", () => {
  it("lists open, overdue and today from real counts", () => {
    expect(taskSummaryParts(summary)).toEqual([
      { key: "open", count: 36, label: "open" },
      { key: "overdue", count: 3, label: "overdue" },
      { key: "today", count: 13, label: "for today" },
    ]);
  });

  it("drops zero parts but always keeps open", () => {
    expect(taskSummaryParts({ open: 0, overdue: 0, forToday: 0, inbox: 0 })).toEqual([{ key: "open", count: 0, label: "open" }]);
    expect(taskSummaryParts({ open: 5, overdue: 0, forToday: 2, inbox: 0 }).map(part => part.key)).toEqual(["open", "today"]);
  });
});

describe("TaskHeader", () => {
  it("shows the title, summary, Select, Capture and the four view tabs", () => {
    const html = renderToStaticMarkup(<TaskHeader {...base} />);
    expect(html).toContain("Tasks");
    expect(html).toContain("36");
    expect(html).toContain("for today");
    expect(html).toContain("Select");
    expect(html).toContain("Capture");
    for (const tab of ["Inbox", "List", "Board", "Views"]) expect(html).toContain(tab);
    expect(html).toContain('role="tablist"');
  });

  it("reports Select as a pressed toggle", () => {
    expect(renderToStaticMarkup(<TaskHeader {...base} selectMode />)).toContain('aria-pressed="true"');
    expect(renderToStaticMarkup(<TaskHeader {...base} />)).toContain('aria-pressed="false"');
  });

  it("badges the Inbox tab with the real inbox count", () => {
    expect(renderToStaticMarkup(<TaskHeader {...base} />)).toContain("pc-seg-badge");
    expect(renderToStaticMarkup(<TaskHeader {...base} summary={{ ...summary, inbox: 0 }} />)).not.toContain("pc-seg-badge");
  });

  it("swaps to the archive view with a way back and no tabs", () => {
    const html = renderToStaticMarkup(<TaskHeader {...base} view="archive" />);
    expect(html).toContain("Archived tasks");
    expect(html).toContain("Back to tasks");
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain("Capture");
  });

  it("says so when offline or showing a saved copy, and hides review at zero", () => {
    const html = renderToStaticMarkup(<TaskHeader {...base} offline savedCopyLabel="Showing saved copy from 10:42" reviewCount={0} />);
    expect(html).toContain("Offline");
    expect(html).toContain("Showing saved copy from 10:42");
    expect(html).not.toContain("to review");
    expect(renderToStaticMarkup(<TaskHeader {...base} reviewCount={2} onReview={noop} />)).toContain("to review");
  });
});
