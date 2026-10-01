import { describe, expect, it } from "vitest";
import { previewRoadmapMove, roadmapProjection, validateProjectDependency, type RoadmapProject, type RoadmapMilestone, type RoadmapTask, type RoadmapProjectDependency } from "@shared/roadmap";

const projects: RoadmapProject[] = [
  { id: "p1", workspaceId: "w1", goalId: "g1", title: "First", state: "in_progress", version: 3, startLocalDate: "2026-09-15", dueLocalDate: "2026-11-15", riskLevel: "watch", riskNote: "Vendor delay", nextReviewLocalDate: "2026-10-01" },
  { id: "p2", workspaceId: "w1", goalId: "g1", title: "Second", state: "blocked", version: 1, startLocalDate: "2026-10-01", dueLocalDate: "2026-12-01" },
  { id: "p3", workspaceId: "w1", title: "Unscheduled", state: "not_started", version: 1, startLocalDate: null, dueLocalDate: null },
  { id: "p4", workspaceId: "w1", title: "Deadline only", state: "not_started", version: 1, startLocalDate: null, dueLocalDate: "2027-02-01" },
];
const milestones: RoadmapMilestone[] = [
  { id: "m1", workspaceId: "w1", goalId: "g1", title: "Checkpoint", state: "not_started", startLocalDate: null, dueLocalDate: "2026-10-15" },
  { id: "m2", workspaceId: "w1", goalId: "g2", title: "Undated checkpoint", state: "not_started", startLocalDate: null, dueLocalDate: null },
];
const tasks: RoadmapTask[] = [
  { id: "t1", workspaceId: "w1", projectId: "p1", state: "not_started", scheduledLocalDate: "2026-10-04" },
  { id: "t2", workspaceId: "w1", projectId: "p2", state: "not_started", scheduledLocalDate: null },
];
const dependencies: RoadmapProjectDependency[] = [{ id: "d1", workspaceId: "w1", projectId: "p2", dependsOnProjectId: "p1", dependencyType: "hard" }];

describe("roadmap projection", () => {
  it("uses a bounded contiguous viewport at every resolution, including empty periods", () => {
    const expected = {
      month: { count: 12, first: "2026-05", last: "2027-04", start: "2026-05-01", end: "2027-04-30" },
      quarter: { count: 12, first: "2025-Q3", last: "2028-Q2", start: "2025-07-01", end: "2028-06-30" },
      year: { count: 8, first: "2023", last: "2030", start: "2023-01-01", end: "2030-12-31" },
    } as const;
    for (const resolution of ["month", "quarter", "year"] as const) {
      const result = roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", resolution, projects: [], milestones: [] });
      const window = expected[resolution];
      expect(result.periods).toHaveLength(window.count);
      expect(result.periods[0].key).toBe(window.first);
      expect(result.periods.at(-1)?.key).toBe(window.last);
      expect(result.windowStartLocalDate).toBe(window.start);
      expect(result.windowEndLocalDate).toBe(window.end);
      expect(result.periods.every(period => period.items.length === 0)).toBe(true);
      for (let index = 1; index < result.periods.length; index++) {
        const previousEnd = new Date(`${result.periods[index - 1].endLocalDate}T00:00:00.000Z`);
        previousEnd.setUTCDate(previousEnd.getUTCDate() + 1);
        expect(result.periods[index].startLocalDate).toBe(previousEnd.toISOString().slice(0, 10));
      }
    }
  });

  it("places only actual overlaps in the viewport while preserving far-away and archived identities", () => {
    const wide: RoadmapProject = { ...projects[0], id: "wide", startLocalDate: "0001-01-01", dueLocalDate: "9999-12-31" };
    const past: RoadmapProject = { ...projects[0], id: "past", startLocalDate: "1800-01-01", dueLocalDate: "1801-01-01" };
    const future: RoadmapProject = { ...projects[0], id: "future", startLocalDate: "9999-12-31", dueLocalDate: "9999-12-31" };
    const undated: RoadmapProject = { ...projects[0], id: "undated", startLocalDate: null, dueLocalDate: null };
    const archived: RoadmapProject = { ...projects[0], id: "archived", state: "archived", startLocalDate: "2026-10-01", dueLocalDate: "2026-10-01" };
    const checkpoint: RoadmapMilestone = { ...milestones[0], id: "checkpoint", startLocalDate: null, dueLocalDate: "2026-10-15" };
    for (const resolution of ["month", "quarter", "year"] as const) {
      const result = roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", resolution, projects: [wide, past, future, undated, archived], milestones: [checkpoint] });
      expect(result.periods.length).toBeLessThanOrEqual(12);
      expect(result.items.map(item => item.id)).toEqual(["wide", "past", "future", "undated", "checkpoint"]);
      expect(result.undated.map(item => item.id)).toEqual(["undated"]);
      expect(result.archived.map(item => item.id)).toEqual(["archived"]);
      expect(result.periods.every(period => period.items.some(item => item.id === "wide"))).toBe(true);
      expect(result.periods.flatMap(period => period.items).some(item => ["past", "future", "undated", "archived"].includes(item.id))).toBe(false);
      expect(result.periods.filter(period => period.items.some(item => item.id === "checkpoint"))).toHaveLength(1);
      expect(result.items.find(item => item.id === "past")?.bar).toEqual({ startLocalDate: "1800-01-01", endLocalDate: "1801-01-01" });
    }
  });

  it("uses an optional anchor and clamps each fixed viewport within valid edge years", () => {
    for (const resolution of ["month", "quarter", "year"] as const) {
      const earliest = roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", anchorLocalDate: "0001-01-01", resolution, projects: [], milestones: [] });
      const latest = roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", anchorLocalDate: "9999-12-31", resolution, projects: [], milestones: [] });
      expect(earliest.periods[0].startLocalDate).toBe("0001-01-01");
      expect(latest.periods.at(-1)?.endLocalDate).toBe("9999-12-31");
      expect(earliest.periods).toHaveLength(resolution === "year" ? 8 : 12);
      expect(latest.periods).toHaveLength(resolution === "year" ? 8 : 12);
      expect(earliest.periods.every(period => period.startLocalDate >= "0001-01-01" && period.endLocalDate <= "9999-12-31")).toBe(true);
      expect(latest.periods.every(period => period.startLocalDate >= "0001-01-01" && period.endLocalDate <= "9999-12-31")).toBe(true);
    }
    const shifted = roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", anchorLocalDate: "2032-03-15", resolution: "month", projects, milestones });
    expect(shifted.windowStartLocalDate).toBe("2031-10-01");
    expect(shifted.items.map(item => item.id)).toEqual([...projects, ...milestones].map(item => item.id));
    expect(shifted.periods.every(period => period.items.length === 0)).toBe(true);
  });

  it("keeps the same project and milestone identities at month, quarter, and year resolutions", () => {
    const ids = [...projects, ...milestones].map(item => item.id);
    for (const resolution of ["month", "quarter", "year"] as const) {
      const result = roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", resolution, projects, milestones, tasks, projectDependencies: dependencies, capabilities: { projectRisk: true, projectDependencies: true } });
      expect(result.items.map(item => item.id)).toEqual(ids);
      expect(result.items.every(item => item.kind !== ("task" as string))).toBe(true);
      expect(result.periods.flatMap(period => period.items).some(item => item.id === "t1")).toBe(false);
      expect(result.undated.map(item => item.id)).toEqual(["p3", "m2"]);
      expect(result.items.find(item => item.id === "p4")?.bar).toBeNull();
      expect(result.items.find(item => item.id === "m1")?.bar).toBeNull();
      expect(result.items.find(item => item.id === "p1")?.projectIds).toEqual(["p1"]);
      expect(result.items.find(item => item.id === "m1")?.projectIds).toEqual(["p1", "p2"]);
    }
  });

  it("shows only factual overlap, risk, blocked, review, and execution gaps", () => {
    const result = roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", resolution: "quarter", projects, milestones, tasks, projectDependencies: dependencies, capabilities: { projectRisk: true, projectDependencies: true } });
    const first = result.items.find(item => item.id === "p1")!;
    const second = result.items.find(item => item.id === "p2")!;
    expect(first.overlapProjectIds).toEqual(["p2"]);
    expect(first.explicitRisk).toEqual({ level: "watch", note: "Vendor delay" });
    expect(first.attention).toContain("review_due");
    expect(first.attention).not.toContain("execution_gap");
    expect(second.blockedByProjectIds).toEqual(["p1"]);
    expect(second.attention).toContain("execution_gap");
    expect(second.attention).toContain("blocked");
    const withoutOptional = roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", resolution: "year", projects, milestones });
    expect(withoutOptional.items.find(item => item.id === "p1")?.explicitRisk).toBeNull();
    expect(withoutOptional.items.find(item => item.id === "p1")?.attention).not.toContain("execution_gap");
    expect(withoutOptional.items.find(item => item.id === "p2")?.dependencyIds).toEqual([]);
  });

  it("rejects invalid dates and cross-workspace records", () => {
    expect(() => roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-02-30", resolution: "month", projects, milestones })).toThrow("Invalid roadmap date");
    expect(() => roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", anchorLocalDate: "10000-01-01", resolution: "month", projects, milestones })).toThrow("Invalid roadmap date");
    expect(() => roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", resolution: "month", projects: [{ ...projects[0], workspaceId: "w2" }], milestones })).toThrow("one workspace");
  });

  it("keeps archived records visible outside the active timeline", () => {
    const result = roadmapProjection({ workspaceId: "w1", todayLocalDate: "2026-10-01", resolution: "month", projects: [...projects, { ...projects[0], id: "archived-project", state: "archived" }], milestones: [...milestones, { ...milestones[0], id: "archived-milestone", state: "archived" }] });
    expect(result.archived.map(item => item.id)).toEqual(["archived-project", "archived-milestone"]);
    expect(result.items.map(item => item.id)).not.toContain("archived-project");
    expect(result.periods.flatMap(period => period.items).map(item => item.id)).not.toContain("archived-milestone");
  });
});

describe("roadmap move preview", () => {
  const base = { workspaceId: "w1", project: projects[0], projects, milestones, tasks, projectDependencies: dependencies, expectedVersion: 3, startLocalDate: "2026-11-01", dueLocalDate: "2026-12-15" };

  it("returns only exact project date mutations and identifies unchanged linked records", () => {
    const original = structuredClone({ projects, milestones, tasks });
    const preview = previewRoadmapMove(base);
    expect(preview.changes).toEqual([
      { field: "startLocalDate", before: "2026-09-15", after: "2026-11-01" },
      { field: "dueLocalDate", before: "2026-11-15", after: "2026-12-15" },
    ]);
    expect(preview.apply).toEqual({ id: "p1", expectedVersion: 3, patch: { startLocalDate: "2026-11-01", dueLocalDate: "2026-12-15" } });
    expect(preview.unchanged.goal).toEqual({ id: "g1", fields: ["startLocalDate", "dueLocalDate"] });
    expect(preview.unchanged.linkedTaskIds).toEqual(["t1"]);
    expect(preview.unchanged.milestoneIds).toEqual(["m1"]);
    expect(preview.milestoneEffects).toEqual([{ milestoneId: "m1", reason: "outside_proposed_project_dates" }]);
    expect(preview.dependencyConflicts).toEqual([]);
    expect(preview.existingDependencyConflicts).toEqual([{ projectId: "p2", dependsOnProjectId: "p1", reason: "prerequisite_finishes_after_start" }]);
    expect({ projects, milestones, tasks }).toEqual(original);
  });

  it("blocks only newly introduced hard timing conflicts and allows corrective edits", () => {
    const previouslyAligned = projects.map(project => project.id === "p2" ? { ...project, startLocalDate: "2026-12-01" } : project);
    const introduced = previewRoadmapMove({ ...base, projects: previouslyAligned });
    expect(introduced.dependencyConflicts).toEqual([{ projectId: "p2", dependsOnProjectId: "p1", reason: "prerequisite_finishes_after_start" }]);
    expect(introduced.existingDependencyConflicts).toEqual([]);

    const partialCorrection = previewRoadmapMove({ ...base, startLocalDate: projects[0].startLocalDate, dueLocalDate: "2026-11-01" });
    expect(partialCorrection.dependencyConflicts).toEqual([]);
    expect(partialCorrection.existingDependencyConflicts).toHaveLength(1);
    expect(partialCorrection.apply?.patch).toEqual({ dueLocalDate: "2026-11-01" });

    const resolved = previewRoadmapMove({ ...base, startLocalDate: projects[0].startLocalDate, dueLocalDate: "2026-09-30" });
    expect(resolved.dependencyConflicts).toEqual([]);
    expect(resolved.existingDependencyConflicts).toEqual([]);
  });

  it("rejects bad dates and stale versions without an apply action", () => {
    expect(previewRoadmapMove({ ...base, startLocalDate: "2026-02-30" }).apply).toBeNull();
    expect(previewRoadmapMove({ ...base, startLocalDate: "2027-01-01", dueLocalDate: "2026-12-01" }).apply).toBeNull();
    expect(previewRoadmapMove({ ...base, expectedVersion: 2 }).errors).toContain("The project changed since this preview. Review it again.");
    expect(previewRoadmapMove({ ...base, startLocalDate: projects[0].startLocalDate!, dueLocalDate: projects[0].dueLocalDate! }).apply).toBeNull();
  });

  it("rejects self, cross-workspace, and cyclic dependency proposals", () => {
    expect(validateProjectDependency({ workspaceId: "w1", projectId: "p2", dependsOnProjectId: "p1", projects, dependencies })).toContain("Project dependency already exists.");
    expect(validateProjectDependency({ workspaceId: "w1", projectId: "p1", dependsOnProjectId: "p1", projects, dependencies })).toContain("A project cannot depend on itself.");
    expect(validateProjectDependency({ workspaceId: "w1", projectId: "p1", dependsOnProjectId: "p2", projects, dependencies })).toContain("Project dependencies cannot form a cycle.");
    expect(validateProjectDependency({ workspaceId: "w1", projectId: "p1", dependsOnProjectId: "foreign", projects: [...projects, { ...projects[1], id: "foreign", workspaceId: "w2" }], dependencies })).toContain("Projects must belong to the same workspace.");
    expect(previewRoadmapMove({ ...base, projectDependencies: [...dependencies, { workspaceId: "w1", projectId: "p1", dependsOnProjectId: "p2", dependencyType: "hard" }] }).apply).toBeNull();
  });
});
