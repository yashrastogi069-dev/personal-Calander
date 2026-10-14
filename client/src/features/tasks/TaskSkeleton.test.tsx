import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TaskSkeleton } from "./TaskSkeleton";

describe("TaskSkeleton", () => {
  it("announces loading once, as a polite status", () => {
    const html = renderToStaticMarkup(<TaskSkeleton />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-label="Loading tasks"');
  });

  it("draws the requested number of list rows, hidden from assistive tech", () => {
    const html = renderToStaticMarkup(<TaskSkeleton variant="list" rows={4} />);
    expect(html.match(/class="tk-skel-row"/g)).toHaveLength(4);
    expect(html.match(/<li [^>]*aria-hidden="true"/g)).toHaveLength(4);
  });

  it("draws board lanes with cards", () => {
    const html = renderToStaticMarkup(<TaskSkeleton variant="board" lanes={3} cardsPerLane={2} />);
    expect(html.match(/tk-skel-lane-head/g)).toHaveLength(3);
    expect(html.match(/tk-skel-card"/g)).toHaveLength(6);
    expect(html).toContain("is-board");
  });

  it("staggers each shape with a custom property instead of inline timings", () => {
    const html = renderToStaticMarkup(<TaskSkeleton rows={3} />);
    expect(html).toContain("--tk-i:2");
    expect(html).not.toContain("animation");
  });
});
