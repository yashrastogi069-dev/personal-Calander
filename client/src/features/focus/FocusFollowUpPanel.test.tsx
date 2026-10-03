import { renderToStaticMarkup } from "react-dom/server";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { FocusFollowUpPanel, focusFollowUpDraft, focusFollowUpDraftReducer, savedHabitFocusForDate } from "./FocusFollowUpPanel";

function renderPanel(isOnline: boolean, overrides: Partial<ComponentProps<typeof FocusFollowUpPanel>> = {}) {
  return renderToStaticMarkup(
    <FocusFollowUpPanel
      snapshot={{ focusSessions: [{ id: "saved-session", state: "completed", activeSeconds: 60 }] }}
      today="2026-10-03"
      activeSession={{ id: "paused-session", state: "paused" }}
      isOnline={isOnline}
      onOpenTask={vi.fn()}
      onOpenHabit={vi.fn()}
      onOpenCalendar={vi.fn()}
      onOpenPlan={vi.fn()}
      onResumeFocus={vi.fn()}
      onCheckInHabit={vi.fn()}
      onClearHabitCheckIn={vi.fn()}
      {...overrides}
    />
  );
}

describe("Focus follow-up accessible controls", () => {
  it("offers a disabled reconnect action for an offline paused session", () => {
    const markup = renderPanel(false);
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Reconnect to resume<\/button>/);
    expect(renderPanel(true)).toMatch(/<button(?![^>]*\sdisabled=)[^>]*>Resume focus<\/button>/);
  });

  it("connects the collapsed session disclosure to its existing hidden detail", () => {
    const markup = renderPanel(true);
    const controlledId = markup.match(/aria-expanded="false" aria-controls="([^"]+)"/)?.[1];
    expect(controlledId).toBeTruthy();
    expect(markup).toContain(`id="${controlledId}" class="focus-follow-up-session-detail" hidden=""`);
  });
});

const handoff = { id: "finished-session", version: 2, taskId: null, taskTitle: "this focus block", outcome: "continue", note: "Retained context", nextStepAction: null, nextStepTaskId: null };
const durableSnapshot = { focusHabitAttributionAvailable: true, tasks: [{ id: "next-task", title: "Next task", state: "todo" }] };

describe("Durable Focus presentation", () => {
  it("offers legacy navigation without offering a save when capability is absent", () => {
    const markup = renderPanel(true, { handoff, onSaveFollowUp: vi.fn() });
    expect(markup).toContain("Saved next actions are unavailable");
    expect(markup).toContain("Plan next step");
    expect(markup).toContain("time is not attributed to habits yet");
    expect(markup).not.toContain("Save next action");
  });

  it("distinguishes an unsaved next action from an explicitly saved none", () => {
    const unsaved = renderPanel(true, { snapshot: durableSnapshot, handoff, onSaveFollowUp: vi.fn() });
    expect(unsaved).toContain("Next action not saved.");
    expect(unsaved).toMatch(/<button(?![^>]*\sdisabled=)[^>]*>Save next action<\/button>/);
    const saved = renderPanel(true, { snapshot: durableSnapshot, handoff: { ...handoff, nextStepAction: "none" }, onSaveFollowUp: vi.fn() });
    expect(saved).toContain("Saved next action: No next action.");
    expect(saved).toMatch(/<button[^>]*disabled=""[^>]*>Save next action<\/button>/);
  });

  it("disables saving offline and pending, and keeps errors beside the retained draft", () => {
    const offline = renderPanel(false, { snapshot: durableSnapshot, handoff, onSaveFollowUp: vi.fn() });
    expect(offline).toContain("Reconnect to save the next action. Your draft stays here.");
    expect(offline).toMatch(/<button[^>]*disabled=""[^>]*>Save next action<\/button>/);
    const pending = renderPanel(true, { snapshot: durableSnapshot, handoff, onSaveFollowUp: vi.fn(), isSavingFollowUp: true });
    expect(pending).toMatch(/<button[^>]*disabled=""[^>]*>Saving next action…<\/button>/);
    const conflict = renderPanel(true, { snapshot: durableSnapshot, handoff, onSaveFollowUp: vi.fn(), followUpError: "Session changed elsewhere." });
    expect(conflict).toContain('role="alert"');
    expect(conflict).toContain("Session changed elsewhere.");
    expect(conflict).toContain("Your draft is retained.");
    expect(conflict).toContain("Retry save");
  });

  it("keeps an unavailable saved target visible and prevents saving it", () => {
    const markup = renderPanel(true, { snapshot: durableSnapshot, handoff: { ...handoff, nextStepAction: "task", nextStepTaskId: "missing-task" }, onSaveFollowUp: vi.fn() });
    expect(markup).toContain("Saved next action: Task unavailable.");
    expect(markup).toContain("Selected task unavailable");
    expect(markup).toContain("Choose an available task before saving.");
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>Save next action<\/button>/);
    expect(markup).not.toContain("Open saved task");
  });

  it("preserves edited drafts through a same-session version refresh and resets on another session", () => {
    let draft = focusFollowUpDraft(handoff);
    draft = focusFollowUpDraftReducer(draft, { type: "action", action: "task" });
    draft = focusFollowUpDraftReducer(draft, { type: "task", taskId: "next-task" });
    expect(focusFollowUpDraftReducer(draft, { type: "session", handoff: { ...handoff, version: 3, nextStepAction: "plan" } })).toEqual(draft);
    expect(focusFollowUpDraftReducer(draft, { type: "session", handoff: { ...handoff, id: "other-session", nextStepAction: "plan" } })).toEqual({ sessionId: "other-session", baseVersion: 2, action: "plan", taskId: "", edited: false });
  });

  it("retains an edited draft against a remote change until the user explicitly adopts it", () => {
    const initial = focusFollowUpDraft({ ...handoff, nextStepAction: "none" });
    const edited = focusFollowUpDraftReducer(initial, { type: "action", action: "task" });
    const refreshed = { ...handoff, version: 3, nextStepAction: "plan" as const };
    expect(focusFollowUpDraftReducer(edited, { type: "session", handoff: refreshed })).toEqual(edited);
    expect(focusFollowUpDraftReducer(edited, { type: "adopt", handoff: refreshed })).toEqual(focusFollowUpDraft(refreshed));
  });

  it("adopts remote changes when untouched and clears the edit marker after the matching save", () => {
    const initial = focusFollowUpDraft({ ...handoff, nextStepAction: "none" });
    const refreshed = { ...handoff, version: 3, nextStepAction: "plan" as const };
    expect(focusFollowUpDraftReducer(initial, { type: "session", handoff: refreshed })).toEqual(focusFollowUpDraft(refreshed));
    const edited = focusFollowUpDraftReducer(initial, { type: "action", action: "plan" });
    expect(focusFollowUpDraftReducer(edited, { type: "session", handoff: refreshed })).toEqual(focusFollowUpDraft(refreshed));
  });

  it("groups only finite positive saved seconds on the requested workspace-local date", () => {
    expect(savedHabitFocusForDate([
      { habitId: "habit", localDate: "2026-10-03", timezone: "Asia/Calcutta", activeSeconds: 61 },
      { habitId: "habit", localDate: "2026-10-03", timezone: "Asia/Calcutta", activeSeconds: 30 },
      { habitId: "habit", localDate: "2026-10-02", timezone: "Asia/Calcutta", activeSeconds: 600 },
      { habitId: "legacy", localDate: "2026-10-03", timezone: "Asia/Calcutta", activeSeconds: 0 },
      { habitId: "invalid", localDate: "2026-10-03", timezone: "Asia/Calcutta", activeSeconds: NaN },
    ], "2026-10-03")).toEqual([{ habitId: "habit", activeSeconds: 91, timezones: ["Asia/Calcutta"] }]);
  });

  it("presents saved seconds separately from check-ins and keeps session provenance", () => {
    const markup = renderPanel(true, { snapshot: {
      ...durableSnapshot,
      habits: [{ id: "habit", name: "Read", frequency: "daily", schedule: {} }],
      habitCheckIns: [],
      focusHabitAttribution: [{ habitId: "habit", localDate: "2026-10-03", timezone: "Asia/Calcutta", activeSeconds: 91 }],
      focusSessions: [{ id: "saved-session", state: "completed", activeSeconds: 100, habitId: "habit", nextStepAction: "plan" }],
    } });
    expect(markup).toContain("Not checked in");
    expect(markup).toContain("1m 31s");
    expect(markup).toContain("2026-10-03 · Asia/Calcutta");
    expect(markup).toContain("Running seconds are excluded");
    expect(markup).toContain("Focus time does not complete a habit check-in");
    expect(markup).toContain("Saved next action: Daily plan.");
    expect(markup).toContain("Habit attribution: Read.");
  });
});
