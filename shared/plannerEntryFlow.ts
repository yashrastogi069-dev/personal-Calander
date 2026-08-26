export type TodayEntryStage = "capture" | "plan";

export function todayEntryStage(openTaskCount: number): TodayEntryStage {
  return openTaskCount > 0 ? "plan" : "capture";
}

export const plannerEntrySteps = [
  {
    id: "task",
    title: "Capture one task",
    detail: "Tasks can be planned or reserved on the main Calendar.",
  },
  {
    id: "project",
    title: "Give work a project when it grows",
    detail: "Projects group finite work and can be broken into reviewed linked tasks.",
  },
  {
    id: "habit",
    title: "Track repeated behavior separately",
    detail: "Habits live in their own tracker and never take time-block slots.",
  },
] as const;
