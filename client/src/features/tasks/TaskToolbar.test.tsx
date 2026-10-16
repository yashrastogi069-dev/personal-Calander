import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { activeFacetCount, isSearchShortcut, TaskToolbar, type TaskToolbarProps } from "./TaskToolbar";

const noop = () => {};
const props: TaskToolbarProps = {
  view: "list",
  query: "",
  onQueryChange: noop,
  filter: "all",
  counts: { all: 36, open: 33, today: 13, deadline_risk: 3 },
  onFilterChange: noop,
  facets: { categoryIds: [], projectIds: [], priorities: [] },
  onFacetsChange: noop,
  categoryOptions: [{ value: "c1", label: "Work", tone: "work" }],
  projectOptions: [{ value: "p1", label: "Q4 planning" }],
  sort: "manual",
  onSortChange: noop,
};

describe("isSearchShortcut", () => {
  const key = (value: string, extra: Record<string, boolean> = {}) => ({ key: value, ctrlKey: false, metaKey: false, altKey: false, ...extra });

  it("fires on a bare slash outside text fields", () => {
    expect(isSearchShortcut(key("/"), { tagName: "BODY", isContentEditable: false } as unknown as EventTarget)).toBe(true);
    expect(isSearchShortcut(key("/"), null)).toBe(true);
  });

  it("ignores slash while typing and other keys or chords", () => {
    for (const tag of ["INPUT", "TEXTAREA", "SELECT"]) expect(isSearchShortcut(key("/"), { tagName: tag } as unknown as EventTarget)).toBe(false);
    expect(isSearchShortcut(key("/"), { tagName: "DIV", isContentEditable: true } as unknown as EventTarget)).toBe(false);
    expect(isSearchShortcut(key("a"), null)).toBe(false);
    expect(isSearchShortcut(key("/", { ctrlKey: true }), null)).toBe(false);
    expect(isSearchShortcut(key("/", { metaKey: true }), null)).toBe(false);
  });
});

describe("activeFacetCount", () => {
  it("adds the three facet lists", () => {
    expect(activeFacetCount({ categoryIds: ["a"], projectIds: ["b", "c"], priorities: ["high"] })).toBe(4);
    expect(activeFacetCount({ categoryIds: [], projectIds: [], priorities: [] })).toBe(0);
  });
});

describe("TaskToolbar markup", () => {
  it("is a labelled search landmark with a search field, quick filters with counts, Filter and Sort", () => {
    const html = renderToStaticMarkup(<TaskToolbar {...props} />);
    expect(html).toContain('role="search"');
    expect(html).toContain('type="search"');
    expect(html).toContain("Search tasks");
    expect(html).toContain('aria-label="Quick filter"');
    expect(html).toContain("Filter");
    expect(html).toContain('aria-label="Sort: Manual"');
    expect(html).toContain("36");
  });

  it("shows the slash hint when empty and a clear button once there is a query", () => {
    expect(renderToStaticMarkup(<TaskToolbar {...props} />)).toContain("tk-kbd");
    const typed = renderToStaticMarkup(<TaskToolbar {...props} query="rent" />);
    expect(typed).toContain('aria-label="Clear search"');
    expect(typed).not.toContain("tk-kbd");
  });

  it("badges the Filter button and lists applied facets as removable chips", () => {
    const html = renderToStaticMarkup(<TaskToolbar {...props} facets={{ categoryIds: ["c1"], projectIds: ["p1"], priorities: ["high"] }} />);
    expect(html).toContain("has-active");
    expect(html).toContain('aria-label="Remove Work filter"');
    expect(html).toContain('aria-label="Remove Q4 planning filter"');
    expect(html).toContain('aria-label="Remove High filter"');
    expect(html).toContain('aria-label="Applied filters"');
  });

  it("shows the lens only on the Board", () => {
    const board = renderToStaticMarkup(<TaskToolbar {...props} view="board" lens="status" onLensChange={noop} />);
    expect(board).toContain("Board lens");
    expect(renderToStaticMarkup(<TaskToolbar {...props} view="list" lens="status" onLensChange={noop} />)).not.toContain("Board lens");
  });

  it("no longer draws the legacy Save view button (saved views are pills under the tabs, T2b-2)", () => {
    expect(renderToStaticMarkup(<TaskToolbar {...props} view="list" />)).not.toContain("Save view");
    expect(renderToStaticMarkup(<TaskToolbar {...props} view="board" />)).not.toContain("Save view");
  });
});
