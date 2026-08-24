export type WorkspaceScope = {
  workspaceId: string;
  timezone: string;
};

const STORAGE_KEY = "personal-calander:workspace:v1";

function newWorkspaceId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `workspace_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export function getWorkspaceScope(): WorkspaceScope {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as WorkspaceScope;
      if (parsed.workspaceId) return { workspaceId: parsed.workspaceId, timezone };
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  const scope = { workspaceId: newWorkspaceId(), timezone };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(scope));
  return scope;
}

export function localDateInTimezone(timezone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftLocalDate(localDate: string, amount: number) {
  const date = new Date(`${localDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function displayLocalDate(localDate: string, timezone: string, options: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: timezone }).format(new Date(`${localDate}T12:00:00.000Z`));
}
