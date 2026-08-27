export type NaturalLanguageTaskDraft = {
  title: string;
  priority: "none" | "low" | "medium" | "high" | "critical";
  dueLocalDate: string | null;
  scheduledLocalDate: string | null;
  reserveTime: string | null;
  estimateMinutes: number | null;
  recurrenceRule: { frequency: "daily" | "weekly" | "monthly"; interval?: number; weekdays?: number[] } | null;
  notes: string[];
};

const weekdays: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

function shiftLocalDate(localDate: string, days: number) {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextWeekday(reference: string, weekday: number) {
  const day = new Date(`${reference}T12:00:00.000Z`).getUTCDay();
  const offset = (weekday - day + 7) % 7 || 7;
  return shiftLocalDate(reference, offset);
}

function parseDatePhrase(text: string, reference: string) {
  const explicit = /\b(20\d{2}-\d{2}-\d{2})\b/.exec(text)?.[1];
  if (explicit) return explicit;
  if (/\btoday\b/i.test(text)) return reference;
  if (/\btomorrow\b/i.test(text)) return shiftLocalDate(reference, 1);
  const next = /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(text)?.[1]?.toLowerCase();
  if (next) return shiftLocalDate(nextWeekday(reference, weekdays[next]), 7);
  const named = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.exec(text)?.[1]?.toLowerCase();
  return named ? nextWeekday(reference, weekdays[named]) : null;
}

function parseTime(text: string) {
  const match = /\bat\s+(?:(\d{1,2}):(\d{2})|(\d{1,2}))\s*(am|pm)?\b/i.exec(text);
  if (!match) return null;
  let hour = Number(match[1] ?? match[3]);
  const minute = Number(match[2] ?? 0);
  const period = match[4]?.toLowerCase();
  if (minute > 59 || hour > 23 || hour < 0 || (period && hour > 12)) return null;
  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseDuration(text: string) {
  const match = /\b(?:for\s+)?(\d{1,3})\s*(m|min|mins|minutes|h|hr|hrs|hours)\b/i.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const minutes = unit.startsWith("h") ? value * 60 : value;
  return minutes >= 5 && minutes <= 1_440 ? minutes : null;
}

function parseRecurrence(text: string): NaturalLanguageTaskDraft["recurrenceRule"] {
  if (/\b(?:every day|daily)\b/i.test(text)) return { frequency: "daily", interval: 1 };
  if (/\b(?:every month|monthly)\b/i.test(text)) return { frequency: "monthly", interval: 1 };
  if (/\bevery weekday\b/i.test(text)) return { frequency: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] };
  const weekly = /\bevery\s+((?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s*(?:,|and)\s*(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))*)\b/i.exec(text)?.[1];
  if (!weekly) return null;
  const selected = Array.from(weekly.toLowerCase().matchAll(/sunday|monday|tuesday|wednesday|thursday|friday|saturday/g)).map(item => weekdays[item[0]]);
  return selected.length ? { frequency: "weekly", interval: 1, weekdays: Array.from(new Set(selected)).sort() } : null;
}

function priorityFor(text: string): NaturalLanguageTaskDraft["priority"] {
  if (/\b(?:critical|urgent|asap)\b/i.test(text)) return "critical";
  if (/\bhigh(?:\s+priority)?\b/i.test(text)) return "high";
  if (/\blow(?:\s+priority)?\b/i.test(text)) return "low";
  return "medium";
}

/** Parses only explicit phrases. The returned draft is always reviewable and does not write planner data. */
export function parseNaturalLanguageTask(text: string, referenceLocalDate: string): NaturalLanguageTaskDraft {
  const trimmed = text.replace(/\s+/g, " ").trim();
  const dueMatch = /\b(?:due|by)\s+([^,.;]+)/i.exec(trimmed)?.[1] ?? null;
  const date = parseDatePhrase(trimmed, referenceLocalDate);
  const dueLocalDate = dueMatch ? parseDatePhrase(dueMatch, referenceLocalDate) : null;
  const scheduledLocalDate = dueLocalDate ? null : date;
  const reserveTime = parseTime(trimmed);
  const estimateMinutes = parseDuration(trimmed);
  const recurrenceRule = parseRecurrence(trimmed);
  const priority = priorityFor(trimmed);
  const title = trimmed
    .replace(/\b(?:due|by)\s+(?:today|tomorrow|next\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|20\d{2}-\d{2}-\d{2})\b/ig, "")
    .replace(/\b(?:today|tomorrow|next\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)|20\d{2}-\d{2}-\d{2})\b/ig, "")
    .replace(/\bat\s+(?:(?:\d{1,2}:\d{2})|\d{1,2})\s*(?:am|pm)?\b/ig, "")
    .replace(/\b(?:for\s+)?\d{1,3}\s*(?:m|min|mins|minutes|h|hr|hrs|hours)\b/ig, "")
    .replace(/\b(?:critical|urgent|asap|high|low)(?:\s+priority)?\b/ig, "")
    .replace(/\b(?:every day|daily|every month|monthly|every weekday|every\s+(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday)(?:\s*(?:,|and)\s*(?:sunday|monday|tuesday|wednesday|thursday|friday|saturday))*)\b/ig, "")
    .replace(/\s{2,}/g, " ").replace(/^[,.;\s-]+|[,.;\s-]+$/g, "").trim() || trimmed;
  const notes = [
    !date && !dueLocalDate ? "No date was assumed." : null,
    reserveTime && !scheduledLocalDate ? "A time was recognized, but no Plan for date was supplied; review before reserving it." : null,
    estimateMinutes === null && /\d+\s*(?:m|min|mins|minutes|h|hr|hrs|hours)/i.test(trimmed) ? "The duration was outside the supported 5–1,440 minute range." : null,
  ].filter((value): value is string => Boolean(value));
  return { title, priority, dueLocalDate, scheduledLocalDate, reserveTime, estimateMinutes, recurrenceRule, notes };
}
