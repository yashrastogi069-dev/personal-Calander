import { describe, expect, it } from "vitest";
import { mergePlannerLocation, parsePlannerLocation, writePlannerLocation } from "./plannerLocation";
import { legacyPlannerAliases, plannerViewLabel } from "@shared/phase4Navigation";
import { migratePhase4Preferences } from "@shared/phase4Preferences";

describe("connected navigation contract", () => {
  const url = new URL("http://localhost/?destination=tasks&view=list&taskQ=room&taskFilter=today&taskSort=due&q=desk&record=task-1&external=kept#context");
  it("keeps all stateful lens fields and selected record during a view switch and reload", () => {
    const next = mergePlannerLocation(parsePlannerLocation(url), { destination: "tasks", view: "board" });
    expect(parsePlannerLocation(writePlannerLocation(url, next))).toEqual(next);
    expect(next).toMatchObject({ taskQuery: "room", taskFilter: "today", taskSort: "due", query: "desk", selectedRecord: "task-1" });
  });
  it("clears record context across groups without erasing the task/search lens or previous Back entry", () => {
    const current = parsePlannerLocation(url);
    const next = mergePlannerLocation(current, { destination: "plan", view: "weekly" });
    const written = writePlannerLocation(url, next);
    expect(parsePlannerLocation(written).selectedRecord).toBeNull();
    expect(parsePlannerLocation(url)).toEqual(current);
    expect(written.searchParams.get("external")).toBe("kept");
    expect(written.hash).toBe("#context");
    expect(next.taskQuery).toBe("room");
  });
  it("does not leak Focus action into a project drillthrough", () => {
    const focus = parsePlannerLocation(new URL("http://localhost/?destination=home&view=focus"));
    const next = mergePlannerLocation(focus, { destination: "intentions", view: "projects", selectedRecord: "project-1" });
    expect(next.action).toBeUndefined();
    expect(parsePlannerLocation(writePlannerLocation(url, { ...next, action: "focus" }))).toMatchObject({ destination: "intentions", view: "projects", selectedRecord: "project-1" });
    expect(parsePlannerLocation(new URL("http://localhost/?destination=intentions&view=projects&action=focus&record=project-1"))).toMatchObject({ destination: "intentions", view: "projects", selectedRecord: "project-1" });
  });
  it("honors explicit null clearing without swallowing the intent", () => {
    expect(mergePlannerLocation(parsePlannerLocation(url), { destination: "tasks", view: "list", query: null, taskQuery: null, taskFilter: null, taskSort: null, selectedRecord: null })).toMatchObject({ query: "", taskQuery: "", taskFilter: "all", taskSort: "manual", selectedRecord: null });
  });
  it.each([
    ["projects", "outcomes"], ["outcomes", "projects"], ["directions", "projects"],
  ] as const)("clears incompatible %s → %s record identity even when IDs collide", (from, to) => {
    const previous = new URL(`http://localhost/?destination=intentions&view=${from}&record=colliding-id`);
    const next = mergePlannerLocation(parsePlannerLocation(previous), { destination: "intentions", view: to });
    expect(next.selectedRecord).toBeNull();
    expect(parsePlannerLocation(writePlannerLocation(previous, next)).selectedRecord).toBeNull();
    expect(parsePlannerLocation(previous).selectedRecord).toBe("colliding-id");
  });
  it("preserves canonical goal identity between goal lenses", () => {
    const current = parsePlannerLocation(new URL("http://localhost/?destination=intentions&view=outcomes&record=goal-1"));
    expect(mergePlannerLocation(current, { destination: "intentions", view: "directions" }).selectedRecord).toBe("goal-1");
  });
  it.each(legacyPlannerAliases)("preserves legacy $id URLs", alias => {
    expect(parsePlannerLocation(new URL(`http://localhost/?surface=${alias.id}`))).toMatchObject({ destination: alias.destination, view: alias.view });
  });
  it("appends new pin choices without replacing customized pins or order", () => {
    const old = { version: 1, primary: [{ destination: "home", view: "focus", action: "focus" }], order: [{ destination: "home", view: "focus", action: "focus" }], density: "compact", railCollapsed: true, overview: { order: [], hidden: [] } };
    const { preferences } = migratePhase4Preferences(JSON.stringify(old));
    expect(preferences.primary).toEqual(old.primary);
    expect(preferences.order[0]).toEqual(old.order[0]);
    expect(preferences.order).toContainEqual({ destination: "plan", view: "weekly" });
    expect(preferences.order).toContainEqual({ destination: "home", view: "overview" });
  });
  it("labels exact child pins", () => {
    expect(plannerViewLabel({ destination: "home", view: "overview" })).toBe("Overview");
    expect(plannerViewLabel({ destination: "plan", view: "weekly" })).toBe("Weekly plan");
    expect(plannerViewLabel({ destination: "settings", view: "sync" })).toBe("Data & sync");
  });
});
