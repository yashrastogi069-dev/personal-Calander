import { zonedDateTimeToUtc } from "./planningAvailability";

const MAX_ICS_BYTES = 1_500_000;
const MAX_ICS_EVENTS = 500;
const googleIcsHosts = new Set(["calendar.google.com"]);

export type IcsOverlayReadiness = {
  status: "unconfigured" | "ready" | "invalid";
  label: string;
  message: string;
};

export type ReadOnlyIcsBusyEvent = {
  externalId: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
};

export function secureIcsOverlayReadiness(environment: Record<string, string | undefined>): IcsOverlayReadiness {
  const configuredUrl = environment.PERSONAL_CALENDAR_ICS_OVERLAY_URL?.trim();
  if (!configuredUrl) return { status: "unconfigured", label: "Secure ICS overlay not configured", message: "No external calendar data is being read. Add an approved Google Calendar secret ICS URL only through server-side configuration when you are ready." };
  try {
    const url = new URL(configuredUrl);
    const allowed = url.protocol === "https:" && !url.username && !url.password && !url.port && googleIcsHosts.has(url.hostname.toLowerCase()) && url.pathname.toLowerCase().endsWith(".ics");
    if (!allowed) throw new Error("unsupported source");
    return { status: "ready", label: "Secure Google ICS source configured", message: "A server-only Google Calendar ICS source is configured. It remains read-only; event refresh must be explicitly enabled in a later step." };
  } catch {
    return { status: "invalid", label: "Secure ICS configuration needs attention", message: "The configured source is not an approved Google Calendar HTTPS ICS feed. No external calendar data is being read." };
  }
}

function unfoldIcsLines(value: string) {
  return value.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
}

function localDateAfter(localDate: string) {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

function validTimezone(timezone: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); return true; } catch { return false; }
}

function parseIcsInstant(value: string, timezone: string) {
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly) {
    const localDate = `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
    return { instant: zonedDateTimeToUtc(localDate, 0, timezone), localDate, isAllDay: true };
  }
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(value);
  if (!dateTime) return null;
  const localDate = `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}`;
  const minuteOfDay = Number(dateTime[4]) * 60 + Number(dateTime[5]);
  const seconds = Number(dateTime[6] ?? "0");
  const instant = dateTime[7]
    ? new Date(`${localDate}T${dateTime[4]}:${dateTime[5]}:${dateTime[6] ?? "00"}.000Z`)
    : new Date(zonedDateTimeToUtc(localDate, minuteOfDay, timezone).getTime() + seconds * 1_000);
  return Number.isFinite(instant.getTime()) ? { instant, localDate, isAllDay: false } : null;
}

/** Parses a bounded subset of RFC 5545 as busy context only. It never fetches, logs, returns, or stores a feed URL or raw VEVENT payload. */
export function parseReadOnlyIcsBusyEvents(icsText: string, fallbackTimezone: string, maxEvents = MAX_ICS_EVENTS): ReadOnlyIcsBusyEvent[] {
  if (new TextEncoder().encode(icsText).byteLength > MAX_ICS_BYTES) throw new Error("The calendar file is larger than the safe import limit.");
  if (!validTimezone(fallbackTimezone)) throw new Error("The planner timezone is not valid for external calendar import.");
  const records: Array<Record<string, { value: string; params: Record<string, string> }>> = [];
  let current: Record<string, { value: string; params: Record<string, string> }> | null = null;
  for (const rawLine of unfoldIcsLines(icsText)) {
    if (rawLine === "BEGIN:VEVENT") { current = {}; continue; }
    if (rawLine === "END:VEVENT") { if (current) records.push(current); current = null; continue; }
    if (!current) continue;
    const separator = rawLine.indexOf(":");
    if (separator <= 0) continue;
    const [name, ...parameterParts] = rawLine.slice(0, separator).split(";");
    const params = Object.fromEntries(parameterParts.map(part => { const equals = part.indexOf("="); return equals > 0 ? [part.slice(0, equals).toUpperCase(), part.slice(equals + 1).replace(/^"|"$/g, "")] : [part.toUpperCase(), ""]; }));
    current[name.toUpperCase()] = { value: rawLine.slice(separator + 1).trim(), params };
  }
  return records.flatMap(record => {
    if (record.STATUS?.value.toUpperCase() === "CANCELLED" || record.RRULE || !record.UID || !record.DTSTART) return [];
    const timezone = record.DTSTART.params.TZID && validTimezone(record.DTSTART.params.TZID) ? record.DTSTART.params.TZID : fallbackTimezone;
    const start = parseIcsInstant(record.DTSTART.value, timezone);
    const end = record.DTEND ? parseIcsInstant(record.DTEND.value, timezone) : start?.isAllDay ? parseIcsInstant(localDateAfter(start.localDate), timezone) : null;
    if (!start || !end || end.instant <= start.instant) return [];
    return [{ externalId: record.UID.value.slice(0, 255), title: (record.SUMMARY?.value ?? "Busy").replace(/\\[nN]/g, " ").replace(/[\u0000-\u001F]/g, " ").trim().slice(0, 280) || "Busy", startsAt: start.instant, endsAt: end.instant, isAllDay: start.isAllDay }];
  }).slice(0, Math.max(1, Math.min(MAX_ICS_EVENTS, maxEvents)));
}
