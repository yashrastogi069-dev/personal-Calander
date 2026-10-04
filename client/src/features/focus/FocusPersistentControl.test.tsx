import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FocusPersistentControl } from "./FocusPersistentControl";

vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ isPending: false, mutate: vi.fn() }) };
  return { trpc: { useUtils: () => ({ planner: { workspace: { snapshot: { invalidate: vi.fn() } }, dashboard: { invalidate: vi.fn() } } }), planner: { focus: { pause: mutation, resume: mutation, finish: mutation } } } };
});

function render(confirmedOnline = true, state: "active" | "paused" = "active") {
  return renderToStaticMarkup(<FocusPersistentControl scope={{ workspaceId: "synthetic-workspace", timezone: "UTC" }} session={{ id: "synthetic-focus", state, activeSeconds: 1458, lastResumedAt: null, targetMinutes: 30, version: 3 }} taskTitle="Read project notes" confirmedOnline={confirmedOnline} prominent onOpenFocus={vi.fn()} />);
}
describe("approved Home watch", () => {
  it("exposes one Home watch with elapsed time and the actual task", () => {
    const html = render();
    expect(html).toContain('data-home-watch="active"');
    expect(html).toContain('data-watch-layout="home"');
    expect(html).toContain('data-watch-part="elapsed"');
    expect(html).toContain("Read project notes");
    expect(html).toContain('aria-label="Pause current Focus session"');
    expect(html).toContain('aria-label="Stop current Focus session"');
    expect(html).not.toContain(">Finish<");
    expect(html).toContain('aria-label="Expand Focus companion"');
  });
  it("keeps paused and offline states factual and controls guarded", () => {
    expect(render(true, "paused")).toContain('aria-label="Resume current Focus session"');
    const html = render(false);
    expect(html).toContain("Estimated time");
    expect(html).toMatch(/disabled="" aria-label="Pause current Focus session"/);
    expect(html).toMatch(/disabled="" aria-label="Stop current Focus session"/);
  });
});
