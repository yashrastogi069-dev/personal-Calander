import { buildCalendarFeed } from "../../server/calendarFeed";

export default async function calendarFeed(req: { query: Record<string, string | string[] | undefined> }, res: { status: (code: number) => { type: (value: string) => { send: (body: string) => void } }; setHeader: (name: string, value: string) => void }) {
  const rawToken = req.query.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const feed = token ? await buildCalendarFeed(token) : null;
  if (!feed) {
    res.status(404).type("text/plain").send("Calendar feed not found.");
    return;
  }
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Content-Disposition", "inline; filename=personal-calander.ics");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).type("text/calendar; charset=utf-8").send(feed);
}
