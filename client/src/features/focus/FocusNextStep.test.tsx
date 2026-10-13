import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { FocusNextStep } from "./FocusNextStep";

// Coverage moved from the old Focus follow-up panel: the durable next-action editor now lives in
// Finish step 2 ("Saved. What next?").
const handoff = { id: "finished-session", version: 2, taskId: null, taskTitle: "this focus block", outcome: "continue", note: "Retained context", nextStepAction: null, nextStepTaskId: null, activeSeconds: 1500, targetMinutes: 25 };
const tasks = [{ id: "next-task", title: "Next task", state: "todo" }];

function render(overrides: Partial<ComponentProps<typeof FocusNextStep>> = {}) {
  return renderToStaticMarkup(
    <FocusNextStep
      handoff={handoff}
      tasks={tasks}
      today="2026-10-03"
      durableAvailable
      isOnline
      onSave={vi.fn()}
      onOpenTask={vi.fn()}
      onOpenPlan={vi.fn()}
      onDone={vi.fn()}
      onStartAnother={vi.fn()}
      {...overrides}
    />
  );
}

describe("Finish step 2: Saved. What next?", () => {
  it("names the step and summarises the saved time", () => {
    const markup = render();
    expect(markup).toContain("Saved. What next?");
    expect(markup).toContain("25m 0s");
    expect(markup).toContain("Retained context");
  });

  it("offers legacy navigation without offering a save when capability is absent", () => {
    const markup = render({ durableAvailable: false });
    expect(markup).toContain("Saved next actions are unavailable");
    expect(markup).toContain("Plan next step");
    expect(markup).not.toContain("Save and go");
  });

  it("distinguishes an unsaved next action from an explicitly saved none", () => {
    const unsaved = render();
    expect(unsaved).toContain("Next action not saved.");
    expect(unsaved).toMatch(/<button(?![^>]*\sdisabled=)[^>]*>Save and go<\/button>/);
    const saved = render({ handoff: { ...handoff, nextStepAction: "none" } });
    expect(saved).toContain("Saved next action: No next action.");
    // Nothing to save: the primary simply leaves.
    expect(saved).toMatch(/<button(?![^>]*\sdisabled=)[^>]*>Done<\/button>/);
    expect(saved).not.toContain("Save and go");
  });

  it("disables saving offline and pending, and keeps errors beside the retained draft", () => {
    const offline = render({ isOnline: false });
    expect(offline).toContain("Reconnect to save. Your choice stays here.");
    expect(offline).toMatch(/<button[^>]*disabled=""[^>]*>Save and go<\/button>/);
    const pending = render({ isSaving: true });
    expect(pending).toMatch(/<button[^>]*disabled=""[^>]*>Saving…<\/button>/);
    const conflict = render({ error: "Session changed elsewhere." });
    expect(conflict).toContain('role="alert"');
    expect(conflict).toContain("Session changed elsewhere.");
    expect(conflict).toContain("Your draft is retained.");
    expect(conflict).toContain("Retry save");
  });

  it("keeps an unavailable saved target visible and prevents saving or opening it", () => {
    const markup = render({ handoff: { ...handoff, nextStepAction: "task", nextStepTaskId: "missing-task" } });
    expect(markup).toContain("Saved next action: Task unavailable.");
    expect(markup).toContain("Selected task unavailable");
    expect(markup).toContain("Choose an available task before saving.");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Save and go<\/button>/);
    expect(markup).not.toContain(">Open task<");
  });

  it("opens the saved task directly when it is still available", () => {
    const markup = render({ handoff: { ...handoff, nextStepAction: "task", nextStepTaskId: "next-task" } });
    expect(markup).toContain("Saved next action: Next task.");
    expect(markup).toMatch(/<button(?![^>]*\sdisabled=)[^>]*>Open task<\/button>/);
  });
});
