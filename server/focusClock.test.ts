import { describe, expect, it } from "vitest";
import { confirmedActiveSeconds } from "../shared/focusClock";

describe("confirmed focus clock", () => {
  const resumedAt = new Date("2026-10-02T09:00:00.000Z");

  it("advances an active session from its confirmed resume time and accumulated seconds", () => {
    const session = { activeSeconds: 120, state: "active", lastResumedAt: resumedAt };
    expect(confirmedActiveSeconds(session, new Date("2026-10-02T09:00:30.900Z"))).toBe(150);
    expect(session.activeSeconds).toBe(120);
  });

  it("freezes paused and completed sessions even when time advances", () => {
    for (const state of ["paused", "completed", "abandoned"]) {
      expect(confirmedActiveSeconds({ activeSeconds: 120, state, lastResumedAt: resumedAt }, new Date("2026-10-03T09:00:00.000Z"))).toBe(120);
    }
  });

  it("clamps backward clock jumps and invalid values without altering confirmed time", () => {
    expect(confirmedActiveSeconds({ activeSeconds: 120.9, state: "active", lastResumedAt: resumedAt }, new Date("2026-10-02T08:00:00.000Z"))).toBe(120);
    expect(confirmedActiveSeconds({ activeSeconds: -10, state: "active", lastResumedAt: "invalid" }, Date.now())).toBe(0);
    expect(confirmedActiveSeconds({ activeSeconds: 90, state: "active", lastResumedAt: resumedAt }, Number.NaN)).toBe(90);
  });

  it("recomputes after refresh without adding the same active interval twice", () => {
    const now = new Date("2026-10-02T09:01:00.000Z");
    const initial = { activeSeconds: 120, state: "active", lastResumedAt: resumedAt };
    expect(confirmedActiveSeconds(initial, now)).toBe(180);
    expect(confirmedActiveSeconds(initial, now)).toBe(180);
    const refreshed = { activeSeconds: 180, state: "paused", lastResumedAt: resumedAt };
    expect(confirmedActiveSeconds(refreshed, now)).toBe(180);
  });
});
