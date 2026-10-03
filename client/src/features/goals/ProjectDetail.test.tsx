import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArchivedProjectReturn, ProjectDetail } from "./ProjectDetail";

const commonProps = {
  projectId: "project-1",
  scope: { workspaceId: "workspace-1" } as any,
  todayLocalDate: "2026-10-03",
  isOnline: true,
  onBack: vi.fn(),
  onOpenTasks: vi.fn(),
  onBreakDown: vi.fn(),
};

describe("selected project return navigation", () => {
  it("shows an All projects control for an archived project reached through a deep link", () => {
    const markup = renderToStaticMarkup(<ProjectDetail {...commonProps} snapshot={{ projects: [{ id: "project-1", title: "Past project", state: "archived" }], tasks: [], goals: [] }} />);
    expect(markup).toContain("Past project");
    expect(markup).toContain('class="project-detail-back"');
    expect(markup).toContain("All projects");
    expect(markup).toContain("State: archived");
  });

  it("wires the archived return control to the existing back action", () => {
    const onBack = vi.fn();
    const control = ArchivedProjectReturn({ onBack });
    expect(control.props.onClick).toBe(onBack);
    control.props.onClick();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("keeps the active project heading free of a duplicate return control", () => {
    const markup = renderToStaticMarkup(<ProjectDetail {...commonProps} snapshot={{ projects: [{ id: "project-1", title: "Current project", state: "active" }], tasks: [], goals: [] }} />);
    expect(markup).not.toContain('class="project-detail-back"');
  });
});
