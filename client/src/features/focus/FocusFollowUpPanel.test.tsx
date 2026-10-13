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
    expect(markup).toMatch(new RegExp(`id="${controlledId}" class="focus-follow-up-session-detail[^"]*" hidden=""`));
  });
});

const handoff = { id: "finished-session", version: 2, taskId: null, taskTitle: "this focus block", outcome: "continue", note: "Retained context", nextStepAction: null, nextStepTaskId: null };
const durableSnapshot = { focusHabitAttributionAvailable: true, tasks: [{ id: "next-task", title: "Next task", state: "todo" }] };

describe("Durable Focus presentation", () => {
  it("keeps the legacy habit footnote when attribution is unavailable", () => {
    const markup = renderPanel(true);
    expect(markup).toContain("time is not attributed to habits yet");
    // The next-step editor moved to Finish step 2 (FocusNextStep); the rail never offers a save.
    expect(markup).not.toContain("Save and go");
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
