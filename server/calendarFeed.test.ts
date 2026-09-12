import { describe, expect, it } from "vitest";
import { renderCalendarFeed } from "./calendarFeed";

const base = { priority: "medium", state: "not_started", dueLocalDate: null, scheduledLocalDate: null, plannedStartAt: null, plannedEndAt: null, updatedAt: new Date("2026-09-12T10:15:30.000Z"), version: 3 } as const;

describe("Apple-compatible private calendar feed", () => {
  it("publishes stable versioned timed and all-day events with refresh guidance", () => {
    const value = renderCalendarFeed({ name: "My, Plan", includeCompleted: 0 }, [
      { ...base, id: "timed", title: "Focus; block", plannedStartAt: new Date("2026-09-12T11:00:00.000Z"), plannedEndAt: new Date("2026-09-12T11:30:00.000Z") },
      { ...base, id: "dated", title: "Due task", scheduledLocalDate: "2026-09-13" },
    ] as any);
    expect(value).toContain("METHOD:PUBLISH\r\nREFRESH-INTERVAL;VALUE=DURATION:PT15M");
    expect(value).toContain("X-WR-CALNAME:My\\, Plan");
    expect(value).toContain("DTSTAMP:20260912T101530Z\r\nLAST-MODIFIED:20260912T101530Z\r\nSEQUENCE:3");
    expect(value).toContain("DTSTART:20260912T110000Z\r\nDTEND:20260912T113000Z");
    expect(value).toContain("DTSTART;VALUE=DATE:20260913\r\nDTEND;VALUE=DATE:20260914");
    expect(value).toContain("SUMMARY:Focus\\; block");
  });

  it("excludes archived and completed tasks unless the feed opts into completion", () => {
    const rows = [
      { ...base, id: "open", title: "Open", scheduledLocalDate: "2026-09-13" },
      { ...base, id: "done", title: "Done", state: "completed", scheduledLocalDate: "2026-09-13" },
      { ...base, id: "archived", title: "Archived", state: "archived", scheduledLocalDate: "2026-09-13" },
    ] as any;
    expect(renderCalendarFeed({ name: "Plan", includeCompleted: 0 }, rows)).not.toContain("UID:done@");
    const includingCompleted = renderCalendarFeed({ name: "Plan", includeCompleted: 1 }, rows);
    expect(includingCompleted).toContain("UID:done@");
    expect(includingCompleted).not.toContain("UID:archived@");
  });
});
