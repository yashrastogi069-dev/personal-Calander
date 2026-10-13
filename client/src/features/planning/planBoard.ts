import { localDateInTimezone, shiftLocalDate } from "@/lib/workspace";

export type PlanBoardSource = { kind: "planned_day" | "reservation" | "commitment" | "occurrence"; id: string; state?: string };
export type PlanBoardCard = { taskId: string; title: string; localDate: string; missingTask: boolean; estimateMinutes: number | null; dueLocalDate: string | null; reservation: { startsAt: Date | string; endsAt: Date | string } | null; sources: PlanBoardSource[] };
export type PlanBoardEvent = { id: string; title: string; startsAt: Date | string; endsAt: Date | string; isAllDay: boolean; source: string };
export type PlanBoardDay = { localDate: string; covered: boolean; cards: PlanBoardCard[]; events: PlanBoardEvent[] };
export type PlanBoard = { weekStart: string; complete: boolean; days: PlanBoardDay[]; unplanned: Array<{ id: string; title: string; dueLocalDate: string | null; estimateMinutes: number | null }> };

type Task = { id: string; title: string; state?: string; outcome?: string | null; scheduledLocalDate?: string | null; dueLocalDate?: string | null; plannedStartAt?: Date | string | null; plannedEndAt?: Date | string | null; estimateMinutes?: number | null };
type Plan = { id: string; localDate: string };
type Item = { id: string; dailyPlanId: string; taskId: string; state?: string };
type Occurrence = { id: string; taskId: string; localDate: string; state?: string };
type Event = { id: string; title: string; startsAt: Date | string; endsAt: Date | string; isAllDay?: number; status?: string; connectionId: string };
type Connection = { id: string; provider?: string; displayName?: string };
type Snapshot = { tasks?: Task[]; dailyPlans?: Plan[]; dailyPlanItems?: Item[]; taskOccurrences?: Occurrence[]; externalEvents?: Event[]; integrationConnections?: Connection[] };
type Range = { start: string; end: string };

export function weekStartFor(localDate: string) {
  const weekday = new Date(`${localDate}T12:00:00.000Z`).getUTCDay();
  return shiftLocalDate(localDate, weekday === 0 ? -6 : 1 - weekday);
}

export function completePlanningWeek(weekStart: string, range: Range) {
  return weekStart >= range.start && shiftLocalDate(weekStart, 6) <= range.end;
}

/** Selected Plan day is navigation only: restore it when it is a real date inside the loaded snapshot. */
export function restorePlanDate(saved: string | null | undefined, today: string, range: Range) {
  if (!saved || !/^\d{4}-\d{2}-\d{2}$/.test(saved)) return today;
  if (Number.isNaN(new Date(`${saved}T12:00:00.000Z`).getTime())) return today;
  return saved >= range.start && saved <= range.end ? saved : today;
}

export function localDateAt(value: Date | string, timezone: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return localDateInTimezone(timezone, date);
}

export function projectPlanWeek(input: { weekStart: string; timezone: string; range: Range; snapshot: Snapshot }): PlanBoard {
  const { weekStart, timezone, range, snapshot } = input;
  const days: PlanBoardDay[] = Array.from({ length: 7 }, (_, index) => {
    const localDate = shiftLocalDate(weekStart, index);
    return { localDate, covered: localDate >= range.start && localDate <= range.end, cards: [], events: [] };
  });
  const byDate = new Map(days.map(day => [day.localDate, day]));
  const tasks = new Map((snapshot.tasks ?? []).map(task => [task.id, task]));
  const cards = new Map<string, PlanBoardCard>();
  const add = (taskId: string, localDate: string, source: PlanBoardSource) => {
    const day = byDate.get(localDate);
    if (!day?.covered) return;
    const key = `${localDate}\u0000${taskId}`;
    let card = cards.get(key);
    if (!card) {
      const task = tasks.get(taskId);
      card = { taskId, title: task?.title ?? "Missing linked task", localDate, missingTask: !task, estimateMinutes: task?.estimateMinutes ?? null, dueLocalDate: task?.dueLocalDate ?? null, reservation: null, sources: [] };
      cards.set(key, card);
      day.cards.push(card);
    }
    if (!card.sources.some(existing => existing.kind === source.kind && existing.id === source.id)) card.sources.push(source);
  };
  for (const task of snapshot.tasks ?? []) {
    if (task.scheduledLocalDate) add(task.id, task.scheduledLocalDate, { kind: "planned_day", id: task.id });
    if (task.plannedStartAt && task.plannedEndAt) {
      const reservationDate = localDateAt(task.plannedStartAt, timezone);
      if (reservationDate) {
        add(task.id, reservationDate, { kind: "reservation", id: task.id });
        const card = cards.get(`${reservationDate}\u0000${task.id}`);
        if (card) card.reservation = { startsAt: task.plannedStartAt, endsAt: task.plannedEndAt };
      }
    }
  }
  const plans = new Map((snapshot.dailyPlans ?? []).map(plan => [plan.id, plan]));
  for (const item of snapshot.dailyPlanItems ?? []) {
    const date = plans.get(item.dailyPlanId)?.localDate;
    if (date) add(item.taskId, date, { kind: "commitment", id: item.id, state: item.state });
  }
  for (const occurrence of snapshot.taskOccurrences ?? []) add(occurrence.taskId, occurrence.localDate, { kind: "occurrence", id: occurrence.id, state: occurrence.state });
  const connections = new Map((snapshot.integrationConnections ?? []).map(connection => [connection.id, connection]));
  for (const event of snapshot.externalEvents ?? []) {
    if (event.status !== "active") continue;
    const startDate = localDateAt(event.startsAt, timezone);
    const endDate = localDateAt(event.endsAt, timezone);
    if (!startDate || !endDate) continue;
    const connection = connections.get(event.connectionId);
    const source = connection?.displayName || connection?.provider?.replaceAll("_", " ") || "External calendar source unavailable";
    for (const day of days) if (day.covered && day.localDate >= startDate && day.localDate <= endDate) day.events.push({ id: event.id, title: event.title, startsAt: event.startsAt, endsAt: event.endsAt, isAllDay: event.isAllDay === 1, source });
  }
  const datedTaskIds = new Set(days.flatMap(day => day.cards.map(card => card.taskId)));
  const unplanned = (snapshot.tasks ?? [])
    .filter(task => task.state !== "completed" && task.state !== "archived" && task.outcome !== "wont_do" && !datedTaskIds.has(task.id) && !task.scheduledLocalDate && !task.plannedStartAt)
    .map(task => ({ id: task.id, title: task.title, dueLocalDate: task.dueLocalDate ?? null, estimateMinutes: task.estimateMinutes ?? null }));
  return { weekStart, complete: completePlanningWeek(weekStart, range), days, unplanned };
}
