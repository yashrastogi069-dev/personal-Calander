import { describe, expect, it } from "vitest";
import { parseReadOnlyIcsBusyEvents, secureIcsOverlayReadiness } from "../shared/icsOverlay";

describe("secure read-only ICS overlay contracts", () => {
  it("reports only secret-safe configuration readiness and accepts the supported Google HTTPS ICS shape", () => {
    expect(secureIcsOverlayReadiness({}).status).toBe("unconfigured");
    expect(secureIcsOverlayReadiness({ PERSONAL_CALENDAR_ICS_OVERLAY_URL: "https://calendar.google.com/calendar/ical/example/private-basic.ics" })).toEqual(expect.objectContaining({ status: "ready", label: "Secure Google ICS source configured" }));
    expect(secureIcsOverlayReadiness({ PERSONAL_CALENDAR_ICS_OVERLAY_URL: "http://calendar.google.com/calendar/ical/example/basic.ics" }).status).toBe("invalid");
    expect(secureIcsOverlayReadiness({ PERSONAL_CALENDAR_ICS_OVERLAY_URL: "https://user:secret@calendar.google.com/calendar/basic.ics" }).status).toBe("invalid");
    expect(secureIcsOverlayReadiness({ PERSONAL_CALENDAR_ICS_OVERLAY_URL: "https://example.com/calendar.ics" }).status).toBe("invalid");
  });

  it("parses bounded non-recurring VEVENT busy intervals without retaining raw calendar payload", () => {
    const events = parseReadOnlyIcsBusyEvents("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:busy-1\r\nSUMMARY:Private\\nmeeting\r\nDTSTART:20260827T090000Z\r\nDTEND:20260827T093000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:all-day-1\r\nDTSTART;VALUE=DATE:20260828\r\nDTEND;VALUE=DATE:20260829\r\nEND:VEVENT\r\nEND:VCALENDAR", "UTC");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ externalId: "busy-1", title: "Private meeting", isAllDay: false });
    expect(events[1]).toMatchObject({ externalId: "all-day-1", title: "Busy", isAllDay: true });
    expect(events[0].startsAt.toISOString()).toBe("2026-08-27T09:00:00.000Z");
  });

  it("ignores cancelled, recurring, malformed, and over-limit event records", () => {
    const ics = "BEGIN:VEVENT\nUID:ok\nDTSTART:20260827T090000Z\nDTEND:20260827T093000Z\nEND:VEVENT\nBEGIN:VEVENT\nUID:cancelled\nSTATUS:CANCELLED\nDTSTART:20260827T100000Z\nDTEND:20260827T103000Z\nEND:VEVENT\nBEGIN:VEVENT\nUID:repeat\nRRULE:FREQ=DAILY\nDTSTART:20260827T110000Z\nDTEND:20260827T113000Z\nEND:VEVENT";
    expect(parseReadOnlyIcsBusyEvents(ics, "UTC", 1).map(event => event.externalId)).toEqual(["ok"]);
  });
});
