import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FilterChips, RemovableChip, RollingCount } from "./FilterChips";

const items = [
  { value: "all", label: "All", count: 36 },
  { value: "today", label: "Today", count: 13 },
  { value: "work", label: "Work", tone: "work" as const },
];

describe("FilterChips", () => {
  it("is a labelled group of toggle buttons with aria-pressed", () => {
    const html = renderToStaticMarkup(<FilterChips label="Quick filter" items={items} selected="today" onToggle={() => {}} />);
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Quick filter"');
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html.match(/type="button"/g)).toHaveLength(3);
  });

  it("names each chip with its count so the number is never colour- or position-only", () => {
    const html = renderToStaticMarkup(<FilterChips label="Quick filter" items={items} selected={[]} onToggle={() => {}} />);
    expect(html).toContain('aria-label="All, 36"');
    expect(html).toContain('aria-label="Today, 13"');
  });

  it("adds a check mark to a pressed chip so state is not colour alone", () => {
    const pressed = renderToStaticMarkup(<FilterChips label="f" items={items} selected={["all"]} onToggle={() => {}} />);
    const none = renderToStaticMarkup(<FilterChips label="f" items={items} selected={[]} onToggle={() => {}} />);
    expect(pressed).toContain("pc-chip-check");
    expect(none).not.toContain("pc-chip-check");
  });

  it("puts a tone dot on tonal chips", () => {
    const html = renderToStaticMarkup(<FilterChips label="f" items={items} selected={[]} onToggle={() => {}} />);
    expect(html).toContain("pc-tone-work");
    expect(html).toContain("pc-dot");
  });
});

describe("RollingCount", () => {
  it("reads as plain text and does not tick on first paint", () => {
    const html = renderToStaticMarkup(<RollingCount value={7} />);
    expect(html).toContain('<span class="pc-sr-only">7</span>');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("pc-count-roll");
  });

  it("clamps bad numbers to a non-negative integer", () => {
    expect(renderToStaticMarkup(<RollingCount value={-3} />)).toContain(">0<");
    expect(renderToStaticMarkup(<RollingCount value={Number.NaN} />)).toContain(">0<");
    expect(renderToStaticMarkup(<RollingCount value={4.9} />)).toContain(">4<");
  });
});

describe("RemovableChip", () => {
  it("names what its remove button removes", () => {
    const html = renderToStaticMarkup(<RemovableChip label="Work" onRemove={() => {}} />);
    expect(html).toContain('aria-label="Remove Work filter"');
    expect(renderToStaticMarkup(<RemovableChip label="Work" removeLabel="Clear category" onRemove={() => {}} />)).toContain('aria-label="Clear category"');
  });
});
