export type WorkspaceScope = {
  workspaceId: string;
  timezone: string;
};

export function safeTimeZone(candidate?: string | null) {
  if (!candidate) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return "UTC";
  }
}

export function localDateInTimezone(timezone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: safeTimeZone(timezone), year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftLocalDate(localDate: string, amount: number) {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function displayLocalDate(localDate: string, timezone: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: safeTimeZone(timezone) }).format(new Date(`${localDate}T12:00:00.000Z`));
}
