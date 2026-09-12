import { and, eq } from "drizzle-orm";
import { calendarFeeds, tasks } from "../drizzle/schema";
import { getDb } from "./db";

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function dateValue(localDate: string) {
  return localDate.replaceAll("-", "");
}

function utcValue(value: Date) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

type CalendarFeedShape = Pick<typeof calendarFeeds.$inferSelect, "name" | "includeCompleted">;
type CalendarTaskShape = Pick<typeof tasks.$inferSelect, "id" | "title" | "priority" | "state" | "scheduledLocalDate" | "dueLocalDate" | "plannedStartAt" | "plannedEndAt" | "updatedAt" | "version">;

export function renderCalendarFeed(feed: CalendarFeedShape, rows: CalendarTaskShape[]) {
  const events = rows
    .filter(task => task.state !== "archived" && (feed.includeCompleted || task.state !== "completed") && (task.plannedStartAt || task.scheduledLocalDate || task.dueLocalDate))
    .sort((left, right) => left.id.localeCompare(right.id))
    .map(task => {
      const timing = task.plannedStartAt && task.plannedEndAt
        ? [`DTSTART:${utcValue(task.plannedStartAt)}`, `DTEND:${utcValue(task.plannedEndAt)}`]
        : (() => {
            const localDate = task.scheduledLocalDate ?? task.dueLocalDate!;
            const end = new Date(`${localDate}T12:00:00.000Z`);
            end.setUTCDate(end.getUTCDate() + 1);
            return [`DTSTART;VALUE=DATE:${dateValue(localDate)}`, `DTEND;VALUE=DATE:${dateValue(end.toISOString().slice(0, 10))}`];
          })();
      return [
        "BEGIN:VEVENT",
        `UID:${task.id}@personal-calander`,
        `DTSTAMP:${utcValue(task.updatedAt)}`,
        `LAST-MODIFIED:${utcValue(task.updatedAt)}`,
        `SEQUENCE:${Math.max(0, task.version)}`,
        ...timing,
        `SUMMARY:${escapeIcs(task.title)}`,
        `DESCRIPTION:${escapeIcs(`Personal Calendar task · ${task.priority} priority · ${task.state.replace("_", " ")}`)}`,
        "END:VEVENT",
      ].join("\r\n");
    });
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Personal Calendar//Planning Feed//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M", `X-WR-CALNAME:${escapeIcs(feed.name)}`, ...events, "END:VCALENDAR", "",
  ].join("\r\n");
}

export async function buildCalendarFeed(token: string) {
  const db = await getDb();
  if (!db) return null;
  const feed = (await db.select().from(calendarFeeds).where(and(eq(calendarFeeds.token, token), eq(calendarFeeds.isEnabled, 1))).limit(1))[0];
  if (!feed || feed.revokedAt) return null;
  const rows = await db.select().from(tasks).where(eq(tasks.workspaceId, feed.workspaceId));
  return renderCalendarFeed(feed, rows);
}
