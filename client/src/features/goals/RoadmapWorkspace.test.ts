import { describe, expect, it } from "vitest";
import { projectTaskTimeline, type TimelineTask } from "./RoadmapWorkspace";

const task = (id: string, scheduledLocalDate: string | null, dueLocalDate: string | null, overrides: Partial<TimelineTask> = {}): TimelineTask => ({
  id, workspaceId: "workspace-1", projectId: "project-1", title: id, state: "todo", scheduledLocalDate, dueLocalDate, ...overrides,
});

describe("selected-project task timeline", () => {
  it("keeps planned action days and deadlines distinct without inventing a span", () => {
    const result = projectTaskTimeline([
      task("split", "2026-10-05", "2026-11-12"),
      task("same-day", "2026-10-08", "2026-10-08", { state: "completed" }),
    ], "workspace-1", "project-1", "month");

    expect(result.periods.get("2026-10")?.points).toEqual([
      { task: expect.objectContaining({ id: "split" }), planned: "2026-10-05", deadline: null },
      { task: expect.objectContaining({ id: "same-day", state: "completed" }), planned: "2026-10-08", deadline: "2026-10-08" },
    ]);
    expect(result.periods.get("2026-11")?.points).toEqual([
      { task: expect.objectContaining({ id: "split" }), planned: null, deadline: "2026-11-12" },
    ]);
  });

  it("keeps undated linked work and excludes other workspaces or projects", () => {
    const result = projectTaskTimeline([
      task("undated", null, null),
      task("other-project", "2026-10-03", null, { projectId: "project-2" }),
      task("other-workspace", "2026-10-03", null, { workspaceId: "workspace-2" }),
    ], "workspace-1", "project-1", "quarter");

    expect(result.undated.map(item => item.id)).toEqual(["undated"]);
    expect(result.periods.size).toBe(0);
  });
});
