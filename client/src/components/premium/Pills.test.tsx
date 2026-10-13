import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CategoryChip, StatusPill, TimeChip } from "./Pills";
import { SegmentedTabs } from "./SegmentedTabs";

describe("StatusPill", () => {
  it("always shows the status word, not only colour", () => {
    expect(renderToStaticMarkup(<StatusPill status="on" />)).toContain("On track");
    expect(renderToStaticMarkup(<StatusPill status="risk" />)).toContain("At risk");
    expect(renderToStaticMarkup(<StatusPill status="off" />)).toContain("Off track");
  });
});

describe("TimeChip", () => {
  it("renders nothing without planned or actual time", () => {
    expect(renderToStaticMarkup(<TimeChip plannedMinutes={null} actualMinutes={null} />)).toBe("");
  });
  it("names the over-estimate in visible text and the accessible label", () => {
    const html = renderToStaticMarkup(<TimeChip plannedMinutes={45} actualMinutes={65} />);
    expect(html).toContain("pc-time-over-estimate");
    expect(html).toContain("20m");
    expect(html).toContain(" over");
    expect(html).toContain('aria-label="45m planned, 1h 5m actual, 20m over estimate"');
  });
});

describe("CategoryChip", () => {
  it("renders the category name with a tone class", () => {
    const html = renderToStaticMarkup(<CategoryChip category={{ id: "c1", name: "Gym", color: "#0f9d8a" }} />);
    expect(html).toContain("Gym");
    expect(html).toContain("pc-tone-health");
  });
  it("honours an explicit workspace tone and renders nothing without a category", () => {
    expect(renderToStaticMarkup(<CategoryChip category={{ id: "c1", name: "Gym" }} tone="social" />)).toContain("pc-tone-social");
    expect(renderToStaticMarkup(<CategoryChip category={null} />)).toBe("");
  });
});

describe("SegmentedTabs", () => {
  it("renders an accessible tablist with the active tab selected", () => {
    const html = renderToStaticMarkup(
      <SegmentedTabs
        label="Home view"
        value="today"
        onValueChange={() => undefined}
        items={[{ value: "dashboard", label: "Dashboard" }, { value: "today", label: "Today", badge: 2 }]}
      />
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="Home view"');
    expect(html).toMatch(/aria-selected="true"[^>]*>(?:(?!<\/button>).)*Today/);
    expect(html).toContain("pc-seg-badge");
  });
});
