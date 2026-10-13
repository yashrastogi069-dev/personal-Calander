import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FocusPersistentControl } from "./FocusPersistentControl";
import { FocusSessionContext, type FocusSessionValue } from "./FocusSessionContext";

vi.mock("@/lib/trpc", () => {
  const mutation = { useMutation: () => ({ isPending: false, mutate: vi.fn() }) };
  return { trpc: { useUtils: () => ({ planner: { workspace: { snapshot: { invalidate: vi.fn() } }, dashboard: { invalidate: vi.fn() } } }), planner: { focus: { start: mutation, pause: mutation, resume: mutation, finish: mutation, setFollowUp: mutation } } } };
});

function focusValue(overrides: Partial<FocusSessionValue> = {}): FocusSessionValue {
  return {
    scope: { workspaceId: "synthetic-workspace", timezone: "UTC" } as FocusSessionValue["scope"],
    today: "2026-10-13",
    snapshot: {},
    online: true,
    session: { id: "synthetic-focus", state: "active", activeSeconds: 1458, lastResumedAt: null, targetMinutes: 30, version: 3 } as FocusSessionValue["session"],
    task: null,
    title: "Read project notes",
    toneClass: "pc-tone-accent",
    nextMeeting: null,
    pending: false,
    error: null,
    clearError: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    finish: vi.fn(),
    finishing: false,
    finishError: null,
    clearFinishError: vi.fn(),
    lastSaved: null,
    handoff: null,
    recentHandoff: null,
    dismissHandoff: vi.fn(),
    sessions: [],
    durableFollowUp: false,
    saveFollowUp: vi.fn(),
    followUpPending: false,
    followUpError: null,
    clearFollowUpError: vi.fn(),
    savedFlash: false,
    celebrateId: null,
    finishSheetOpen: false,
    openFinish: vi.fn(),
    closeFinish: vi.fn(),
    onOpenFocus: vi.fn(),
    onOpenTask: vi.fn(),
    onOpenPlan: vi.fn(),
    onStartAnother: vi.fn(),
    ...overrides,
  };
}

function render(overrides: Partial<FocusSessionValue> = {}) {
  return renderToStaticMarkup(
    <FocusSessionContext.Provider value={focusValue(overrides)}>
      <FocusPersistentControl />
    </FocusSessionContext.Provider>
  );
}

describe("persistent Focus pill", () => {
  it("exposes one labelled session with elapsed minutes and the actual task", () => {
    const html = render();
    expect(html.match(/data-focus-pill=""/g)).toHaveLength(1);
    expect(html).toContain('aria-label="Current focus session"');
    expect(html).toContain('aria-label="Show focus controls, 24 minutes, Read project notes"');
    expect(html).toContain("Read project notes");
    expect(html).toContain("is-running");
    expect(html).toContain('aria-label="Pause focus"');
    // Stopping is never one tap away from the pill; Finish lives behind the controls.
    expect(html).not.toContain("Stop current Focus session");
  });

  it("keeps paused and offline states factual and controls guarded", () => {
    const paused = render({ session: { id: "synthetic-focus", state: "paused", activeSeconds: 1458, lastResumedAt: null, targetMinutes: 30, version: 3 } as FocusSessionValue["session"] });
    expect(paused).toContain('aria-label="Resume focus"');
    expect(paused).toContain("is-paused");
    const offline = render({ online: false });
    expect(offline).toContain("is-offline");
    expect(offline).toContain("≈");
    expect(offline).toMatch(/disabled="" aria-label="Offline, reconnect to control focus"/);
  });

  it("shows the overtime lap after the target", () => {
    const html = render({ session: { id: "synthetic-focus", state: "active", activeSeconds: 36 * 60, lastResumedAt: null, targetMinutes: 30, version: 3 } as FocusSessionValue["session"] });
    expect(html).toContain("+6m");
  });

  it("renders nothing without a session, and a short Saved status right after finishing", () => {
    expect(render({ session: null })).toBe("");
    const saved = render({ session: null, savedFlash: true });
    expect(saved).toContain('role="status"');
    expect(saved).toContain("Saved");
  });
});
