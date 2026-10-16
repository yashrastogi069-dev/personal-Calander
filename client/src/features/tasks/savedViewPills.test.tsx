import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SavedViewPills } from "./SavedViewPills";
import {
  adaptSavedTaskView,
  nextSavedTaskViewOrder,
  orderSavedTaskViewPills,
  savedTaskViewConfiguration,
  savedTaskViewMoves,
} from "./taskWorkspaceModel";

const noop = () => {};
const view = (id: string, name: string, order?: number, extra: Record<string, unknown> = {}) => ({
  id, name, viewType: "tasks", isPinned: 0, configuration: { version: 2, filter: "today", ...(order === undefined ? {} : { order }), ...extra },
});

describe("saved-view pill order (jsonb configuration, no migration)", () => {
  it("sorts by the stored order, then views without one by pinned and name", () => {
    const views = [view("c", "Zeta"), view("a", "Alpha", 1), view("b", "Beta", 0), view("d", "Apple")];
    expect(orderSavedTaskViewPills(views).map(item => item.id)).toEqual(["b", "a", "d", "c"]);
    expect(nextSavedTaskViewOrder(views)).toBe(4);
  });

  it("ignores non-tasks views", () => {
    expect(orderSavedTaskViewPills([view("a", "A", 0), { ...view("g", "Goals", 0), viewType: "goals" }]).map(item => item.id)).toEqual(["a"]);
  });

  it("moving a pill rewrites only the positions that changed and keeps the rest of the configuration", () => {
    const views = [view("a", "A", 0, { query: "cv" }), view("b", "B", 1), view("c", "C", 2)];
    const moves = savedTaskViewMoves(views, "c", -1);
    expect(moves.map(move => [move.view.id, move.configuration.order])).toEqual([["c", 1], ["b", 2]]);
    expect(moves[0].configuration.filter).toBe("today");
    expect(savedTaskViewMoves(views, "a", -1)).toEqual([]);
    expect(savedTaskViewMoves(views, "c", 1)).toEqual([]);
  });

  it("gives older views an order when they are first moved", () => {
    const moves = savedTaskViewMoves([view("a", "A"), view("b", "B")], "b", -1);
    expect(moves.map(move => [move.view.id, move.configuration.order])).toEqual([["b", 0], ["a", 1]]);
  });

  it("round-trips the order through the configuration", () => {
    const config = { ...savedTaskViewConfiguration({ view: "list", lens: "week", query: " cv ", filter: "today", sort: "manual", categoryIds: [], projectIds: [], priorities: ["high"] }), order: 3 };
    const back = adaptSavedTaskView(JSON.parse(JSON.stringify(config)));
    expect(back.order).toBe(3);
    expect(back.query).toBe("cv");
    expect(back.priorities).toEqual(["high"]);
    expect(adaptSavedTaskView({ order: "3" }).order).toBeUndefined();
    expect(adaptSavedTaskView({ order: Number.NaN }).order).toBeUndefined();
  });
});

describe("SavedViewPills", () => {
  const props = { allCount: 12, activeId: null, canSave: false, onApply: noop, onCreate: noop, onRename: noop, onMove: noop, onDelete: noop };

  it("shows All and each owner view with its live count", () => {
    const html = renderToStaticMarkup(<SavedViewPills {...props} pills={[{ id: "v1", name: "Job hunt", count: 4 }]} />);
    expect(html).toContain('aria-label="Saved views"');
    expect(html).toContain("All");
    expect(html).toContain("Job hunt");
    expect(html).toContain('data-view-id="v1"');
    expect(html).toContain("tk-vpill-count");
  });

  it("offers Save view only when the filters differ from the applied view", () => {
    expect(renderToStaticMarkup(<SavedViewPills {...props} pills={[]} canSave />)).toContain("Save view");
    expect(renderToStaticMarkup(<SavedViewPills {...props} pills={[]} />)).not.toContain("Save view");
  });

  it("marks the active pill and gives it the menu", () => {
    const html = renderToStaticMarkup(<SavedViewPills {...props} activeId="v1" pills={[{ id: "v1", name: "Job hunt", count: 4 }]} />);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-haspopup="menu"[^>]*data-view-id="v1"/);
  });
});
