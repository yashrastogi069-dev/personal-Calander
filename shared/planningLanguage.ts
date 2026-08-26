export const plannerObjectDefinitions = {
  task: {
    label: "Task",
    short: "One actionable commitment",
    description: "A single piece of work you can complete, plan, and optionally reserve time for.",
  },
  goal: {
    label: "Goal",
    short: "Measurable outcome by a period",
    description: "A measurable outcome by a date or planning period. Link projects, tasks, or habits that move it forward.",
  },
  project: {
    label: "Project",
    short: "Finite work that advances a goal",
    description: "A finite body of work that advances a goal. It is not a repeated routine or an endless list.",
  },
  habit: {
    label: "Habit",
    short: "Repeated behavior with a cadence",
    description: "A repeated behavior with a cadence and completion rule. It lives in the Habit tracker, not the task calendar.",
  },
} as const;

export const taskSchedulingLanguage = {
  deadline: {
    label: "Deadline",
    help: "The latest date this must be finished.",
  },
  planFor: {
    label: "Plan for",
    help: "The day you intend to work on it; it does not reserve time.",
  },
  focusTime: {
    label: "Focus time needed",
    help: "Used to judge whether today still fits.",
  },
  reserveTime: {
    label: "Reserve time",
    help: "Place this task on your calendar.",
  },
} as const;

export function localDateForReservation(startAt: string | null | undefined) {
  return startAt ? startAt.slice(0, 10) : null;
}

export function validateTimeReservation(startAt: string | null | undefined, endAt: string | null | undefined) {
  if (!startAt && !endAt) return null;
  if (!startAt) return "Choose when the reserved time starts.";
  if (!endAt) return "Choose when the reserved time ends.";
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "Enter a valid start and end time.";
  if (end <= start) return "Reserved time must end after it starts.";
  return null;
}
