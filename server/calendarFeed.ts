import { and, eq } from "drizzle-orm";
import { calendarFeeds, tasks } from "../drizzle/schema";
import { getDb } from "./db";

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function dateValue(localDate: string) {
  return localDate.replaceAll("-", "");
}

export async function buildCalendarFeed(token: string) {
  const db = await getDb();
  if (!db) return null;
  const feed = (await db.select().from(calendarFeeds).where(and(eq(calendarFeeds.token, token), eq(calendarFeeds.isEnabled, 1))).limit(1))[0];
  if (!feed || feed.revokedAt) return null;
  const rows = await db.select().from(tasks).where(eq(tasks.workspaceId, feed.workspaceId));
  const events = rows.filter(task => task.state !== "archived" && (feed.includeCompleted || task.state !== "completed") && (task.scheduledLocalDate || task.dueLocalDate)).map(task => {
    const localDate = task.scheduledLocalDate ?? task.dueLocalDate!;
    const end = new Date(`${localDate}T12:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    const endDate = end.toISOString().slice(0, 10);
    return [
      "BEGIN:VEVENT",
      `UID:${task.id}@personal-calander`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART;VALUE=DATE:${dateValue(localDate)}`,
      `DTEND;VALUE=DATE:${dateValue(endDate)}`,
      `SUMMARY:${escapeIcs(task.title)}`,
      `DESCRIPTION:${escapeIcs(`Personal Calander task · ${task.priority} priority · ${task.state.replace("_", " ")}`)}`,
      "END:VEVENT",
    ].join("\r\n");
  });
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Personal Calander//Planning Feed//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeIcs(feed.name)}`, ...events, "END:VCALENDAR", ""].join("\r\n");
}
