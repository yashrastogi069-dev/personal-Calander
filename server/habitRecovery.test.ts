import { describe, expect, it } from "vitest";
import { habitReturnDecision, type RecoveryCheckIn, type RecoveryHabit } from "../shared/habitRecovery";

const daily: RecoveryHabit = { id: "reading", frequency: "daily", schedule: { startLocalDate: "2026-09-01" } };
const entry = (localDate: string, state: RecoveryCheckIn["state"], habitId = daily.id): RecoveryCheckIn => ({ habitId, localDate, state });

describe("habit return decision", () => {
  it("distinguishes today's recorded states, due opportunity, and a future weekday", () => {
    expect(habitReturnDecision(daily, [entry("2026-10-01", "completed")], "2026-10-01")).toMatchObject({ todayState: "completed", nextOpportunityLocalDate: "2026-10-02" });
    expect(habitReturnDecision(daily, [entry("2026-10-01", "skipped")], "2026-10-01")).toMatchObject({ todayState: "skipped", nextOpportunityLocalDate: "2026-10-02" });
    expect(habitReturnDecision(daily, [entry("2026-10-01", "missed")], "2026-10-01")).toMatchObject({ todayState: "missed", nextOpportunityLocalDate: "2026-10-02" });
    expect(habitReturnDecision(daily, [], "2026-10-01")).toMatchObject({ todayState: "due", nextOpportunityLocalDate: "2026-10-01" });
    const mondayOnly: RecoveryHabit = { id: "swim", frequency: "days_of_week", schedule: { weekdays: [1], startLocalDate: "2026-09-01" } };
    expect(habitReturnDecision(mondayOnly, [], "2026-10-01")).toMatchObject({ todayState: "not_yet_due", nextOpportunityLocalDate: "2026-10-05" });
  });

  it("uses local dates for selected weekdays and interval anchors across UTC offset and DST boundaries", () => {
    const weekday: RecoveryHabit = { id: "walk", frequency: "days_of_week", schedule: { weekdays: [0], startLocalDate: "2026-03-01" } };
    expect(habitReturnDecision(weekday, [], "2026-03-07").nextOpportunityLocalDate).toBe("2026-03-08");
    const interval: RecoveryHabit = { id: "exercise", frequency: "interval", schedule: { startLocalDate: "2026-03-07", intervalDays: 3 } };
    expect(habitReturnDecision(interval, [], "2026-03-08")).toMatchObject({ todayState: "not_yet_due", nextOpportunityLocalDate: "2026-03-10" });
    expect(habitReturnDecision(interval, [], "2026-03-10")).toMatchObject({ todayState: "due", nextOpportunityLocalDate: "2026-03-10" });
  });

  it("keeps explicit missed records separate from unrecorded elapsed opportunities and respects corrections", () => {
    const checkIns = [entry("2026-09-29", "missed"), entry("2026-09-30", "skipped"), entry("2026-09-28", "completed"), entry("2026-09-27", "completed", "someone-else")];
    const before = habitReturnDecision(daily, checkIns, "2026-10-01");
    expect(before.recentConsistency).toMatchObject({ scheduled: 14, completed: 1, skipped: 1, missed: 1, unrecorded: 11, consistencyPercent: 7 });
    const corrected = habitReturnDecision(daily, [...checkIns, entry("2026-09-29", "completed")], "2026-10-01");
    expect(corrected.recentConsistency).toMatchObject({ completed: 2, missed: 0, unrecorded: 11, consistencyPercent: 14 });
    expect(checkIns[0].state).toBe("missed");
  });

  it("offers one return decision after ten missed days without creating a resolution row for each", () => {
    const recentCompletion = entry("2026-09-20", "completed");
    const decision = habitReturnDecision(daily, [recentCompletion], "2026-10-01");
    expect(decision.interrupted).toBe(true);
    expect(decision.returnChoices).toEqual(["resume", "revise", "pause"]);
    expect(decision.nextOpportunityLocalDate).toBe("2026-10-01");
    expect(decision.recentConsistency.unrecorded).toBe(13);
    expect(Object.keys(decision)).not.toContain("backlog");
    expect(habitReturnDecision(daily, [recentCompletion, entry("2026-10-01", "completed")], "2026-10-01").interrupted).toBe(false);
  });

  it("respects a return acknowledgment and a future pause review point without changing historical evidence", () => {
    const acknowledged: RecoveryHabit = { ...daily, schedule: { startLocalDate: "2026-09-01", returnAcknowledgedAtLocalDate: "2026-09-30" } };
    expect(habitReturnDecision(acknowledged, [], "2026-10-01").interrupted).toBe(false);
    expect(habitReturnDecision(acknowledged, [], "2026-10-04").interrupted).toBe(true);
    const paused: RecoveryHabit = { ...daily, schedule: { startLocalDate: "2026-09-01", pauseStartedLocalDate: "2026-10-01", pauseUntilLocalDate: "2026-10-05" } };
    const decision = habitReturnDecision(paused, [entry("2026-09-29", "completed")], "2026-10-01");
    expect(decision).toMatchObject({ todayState: "not_yet_due", nextOpportunityLocalDate: "2026-10-05" });
    expect(decision.recentConsistency.completed).toBe(1);
    expect(habitReturnDecision(paused, [], "2026-10-05").todayState).toBe("due");
  });

  it("treats times per week as a weekly quota with no invented daily missed occurrence", () => {
    const weekly: RecoveryHabit = { id: "practice", frequency: "times_per_week", schedule: { timesPerWeek: 2, startLocalDate: "2026-09-01" } };
    const decision = habitReturnDecision(weekly, [entry("2026-09-23", "completed", weekly.id), entry("2026-09-24", "completed", weekly.id)], "2026-10-01");
    expect(decision.todayState).toBe("not_yet_due");
    expect(decision.nextOpportunityLocalDate).toBe("2026-10-01");
    expect(decision.nextOpportunityKind).toBe("flexible_week");
    expect(decision.recentConsistency).toMatchObject({ scheduled: 4, completed: 2, missed: 0, unrecorded: 2, consistencyPercent: 50 });
    const quotaMet = habitReturnDecision(weekly, [entry("2026-09-28", "completed", weekly.id), entry("2026-09-29", "completed", weekly.id)], "2026-10-01");
    expect(quotaMet.todayState).toBe("not_yet_due");
    expect(quotaMet.nextOpportunityLocalDate).toBe("2026-10-05");
    expect(habitReturnDecision(weekly, [], "2026-10-01").interrupted).toBe(true);
  });

  it("counts six available dates when only Sunday is paused", () => {
    const weekly: RecoveryHabit = {
      id: "practice",
      frequency: "times_per_week",
      schedule: { timesPerWeek: 7, startLocalDate: "2026-09-01", pauseStartedLocalDate: "2026-09-27", pauseUntilLocalDate: "2026-09-28" },
    };
    const checkIns = ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"]
      .map(date => entry(date, "completed", weekly.id));
    const decision = habitReturnDecision(weekly, checkIns, "2026-10-01");
    expect(decision.recentConsistency).toMatchObject({ scheduled: 13, completed: 6, missed: 0, unrecorded: 7, consistencyPercent: 46 });
    expect(decision.interrupted).toBe(false);
    expect(decision.nextOpportunityLocalDate).toBe("2026-10-01");
    expect(checkIns).toHaveLength(6);
  });

  it("counts dates after a midweek pause ends before Sunday", () => {
    const weekly: RecoveryHabit = {
      id: "practice",
      frequency: "times_per_week",
      schedule: { timesPerWeek: 5, startLocalDate: "2026-09-01", pauseStartedLocalDate: "2026-09-21", pauseUntilLocalDate: "2026-09-24" },
    };
    const checkIns = ["2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]
      .map(date => entry(date, "completed", weekly.id));
    const decision = habitReturnDecision(weekly, checkIns, "2026-10-01");
    expect(decision.recentConsistency).toMatchObject({ scheduled: 9, completed: 4, missed: 0, unrecorded: 5, consistencyPercent: 44 });
    expect(decision.interrupted).toBe(false);
    expect(decision.nextOpportunityLocalDate).toBe("2026-10-01");
    expect(checkIns.every(checkIn => checkIn.state === "completed")).toBe(true);
  });

  it("does not fabricate a weekly target for unconfigured legacy quota records", () => {
    const weekly: RecoveryHabit = { id: "legacy", frequency: "times_per_week", schedule: {} };
    expect(habitReturnDecision(weekly, [], "2026-10-01")).toMatchObject({
      todayState: "not_yet_due", nextOpportunityLocalDate: null, nextOpportunityKind: null,
      recentConsistency: { scheduled: 0, consistencyPercent: null }, interrupted: false,
    });
  });
});
