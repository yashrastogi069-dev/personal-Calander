import { Archive } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { fixtureTaskCard } from "./taskCardFixtures";
import { TaskRow } from "./TaskRow";

const noop = () => {};

describe("TaskRow", () => {
  it("carries the record identity and version for the page to find", () => {
    const html = renderToStaticMarkup(<TaskRow model={fixtureTaskCard({ id: "abc", version: 7 })} onOpen={noop} onToggle={noop} />);
    expect(html).toContain('data-task-record-id="abc"');
    expect(html).toContain('data-task-version="7"');
    expect(html).toContain("tk-row");
  });

  it("opens through one real button holding the title", () => {
    const html = renderToStaticMarkup(<TaskRow model={fixtureTaskCard({ title: "Book flights" })} onOpen={noop} onToggle={noop} />);
    expect(html).toMatch(/<button[^>]*class="tk-row-title[^"]*"[^>]*>Book flights<\/button>/);
  });

  it("reserves the swipe underlay with both hooks for D3.5", () => {
    const html = renderToStaticMarkup(<TaskRow model={fixtureTaskCard()} onOpen={noop} onToggle={noop} />);
    expect(html).toContain("task-row-swipe");
    expect(html).toContain('data-swipe="complete"');
    expect(html).toContain('data-swipe="reschedule"');
  });

  it("offers Focus only on open work and only when a handler is given", () => {
    const open = renderToStaticMarkup(<TaskRow model={fixtureTaskCard({ title: "Write" })} onOpen={noop} onToggle={noop} onStartFocus={noop} />);
    const none = renderToStaticMarkup(<TaskRow model={fixtureTaskCard({ title: "Write" })} onOpen={noop} onToggle={noop} />);
    const done = renderToStaticMarkup(<TaskRow model={fixtureTaskCard({ title: "Write", isComplete: true, state: "completed" })} onOpen={noop} onToggle={noop} onStartFocus={noop} />);
    expect(open).toContain('aria-label="Start focus on Write"');
    expect(none).not.toContain("Start focus on");
    expect(done).not.toContain("Start focus on");
  });

  it("hides the More menu when there are no actions and names it when there are", () => {
    const empty = renderToStaticMarkup(<TaskRow model={fixtureTaskCard({ title: "Write" })} onOpen={noop} onToggle={noop} />);
    const some = renderToStaticMarkup(<TaskRow model={fixtureTaskCard({ title: "Write" })} onOpen={noop} onToggle={noop} actions={[{ id: "archive", label: "Archive", icon: Archive, onSelect: noop }]} />);
    expect(empty).not.toContain("More actions for");
    expect(some).toContain('aria-label="More actions for Write"');
  });

  it("marks completed, pending and entering rows", () => {
    const done = renderToStaticMarkup(<TaskRow model={fixtureTaskCard({ isComplete: true, state: "completed", check: { checked: true, action: { kind: "reopen" } } })} onOpen={noop} onToggle={noop} />);
    expect(done).toContain("is-complete");
    const pending = renderToStaticMarkup(<TaskRow model={fixtureTaskCard({ pending: true })} onOpen={noop} onToggle={noop} />);
    expect(pending).toContain("is-pending");
    expect(pending).toContain('aria-busy="true"');
    const entering = renderToStaticMarkup(<TaskRow model={fixtureTaskCard()} index={3} enter onOpen={noop} onToggle={noop} />);
    expect(entering).toContain("pc-rise");
    expect(entering).toContain("--pc-i:3");
    expect(renderToStaticMarkup(<TaskRow model={fixtureTaskCard()} onOpen={noop} onToggle={noop} />)).not.toContain("pc-rise");
  });

  it("keeps a guarded check focusable and names the reason", () => {
    const html = renderToStaticMarkup(<TaskRow model={fixtureTaskCard({ title: "Ship", completionBlock: { reason: "Waiting on 2 tasks." } })} onOpen={noop} onToggle={noop} />);
    expect(html).toContain("Complete Ship. Waiting on 2 tasks.");
    expect(html).toContain('aria-disabled="true"');
  });

  it("renders the drag handle slot for Manual sort", () => {
    const html = renderToStaticMarkup(<TaskRow model={fixtureTaskCard()} onOpen={noop} onToggle={noop} dragHandle={<button type="button" aria-label="Reorder">::</button>} />);
    expect(html).toContain('aria-label="Reorder"');
  });
});
