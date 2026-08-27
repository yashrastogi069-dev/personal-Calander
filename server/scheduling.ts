import { and, eq, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { externalEvents, planningAvailabilityExceptions, scheduleProposals, tasks, workspaces } from "../drizzle/schema";
import { firstFreeSlot } from "../shared/planningAvailability";
import { proposalExplanation, schedulingEligibility } from "../shared/schedulingPolicy";
import { getDb } from "./db";
import { PlannerConflictError, type PlannerScope } from "./planning";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Planning data is temporarily unavailable.");
  return db;
}

function timeLabel(value: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(value);
}

export async function createScheduleProposal(scope: PlannerScope, input: { taskId: string; localDate: string }) {
  const db = await requireDb();
  const [task, workspace, existing, exception] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, input.taskId))).limit(1),
    db.select().from(workspaces).where(eq(workspaces.id, scope.workspaceId)).limit(1),
    db.select().from(scheduleProposals).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.taskId, input.taskId), eq(scheduleProposals.localDate, input.localDate), eq(scheduleProposals.state, "proposed"))).limit(1),
    db.select().from(planningAvailabilityExceptions).where(and(eq(planningAvailabilityExceptions.workspaceId, scope.workspaceId), eq(planningAvailabilityExceptions.localDate, input.localDate))).limit(1),
  ]);
  if (!task[0] || !workspace[0]) throw new Error("Task or planning workspace was not found.");
  if (existing[0]) return existing[0];
  const exceptionRecord = exception[0];
  const eligibility = schedulingEligibility(task[0], Boolean(exceptionRecord?.isUnavailable));
  if (eligibility) throw new Error(eligibility);
  const dayStart = new Date(`${input.localDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${input.localDate}T23:59:59.999Z`);
  const [reservedTasks, events] = await Promise.all([
    db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), gte(tasks.plannedStartAt, dayStart), lte(tasks.plannedStartAt, dayEnd))),
    db.select().from(externalEvents).where(and(eq(externalEvents.workspaceId, scope.workspaceId), eq(externalEvents.status, "active"), gte(externalEvents.startsAt, dayStart), lte(externalEvents.startsAt, dayEnd))),
  ]);
  const window = exceptionRecord?.isUnavailable ? { workdayStartsAt: "00:00", workdayEndsAt: "00:00", defaultBreakMinutes: 0 } : { workdayStartsAt: exceptionRecord?.workdayStartsAt ?? workspace[0].workdayStartsAt, workdayEndsAt: exceptionRecord?.workdayEndsAt ?? workspace[0].workdayEndsAt, defaultBreakMinutes: exceptionRecord?.breakMinutes ?? workspace[0].defaultBreakMinutes };
  const slot = firstFreeSlot({ localDate: input.localDate, timezone: scope.timezone, window, durationMinutes: task[0].estimateMinutes!, reservedBlocks: reservedTasks.filter(item => item.plannedStartAt && item.plannedEndAt).map(item => ({ startsAt: item.plannedStartAt!, endsAt: item.plannedEndAt! })), externalBusy: events.map(event => ({ startsAt: event.startsAt, endsAt: event.endsAt })) });
  if (!slot) throw new Error("No open window fits this task on that date. Choose another day, shorten the estimate, or free calendar time.");
  const id = nanoid();
  await db.insert(scheduleProposals).values({ id, workspaceId: scope.workspaceId, taskId: task[0].id, localDate: input.localDate, proposedStartAt: slot.startAt, proposedEndAt: slot.endAt, previousScheduledLocalDate: task[0].scheduledLocalDate, previousStartAt: task[0].plannedStartAt, previousEndAt: task[0].plannedEndAt, reason: proposalExplanation(task[0], input.localDate, timeLabel(slot.startAt, scope.timezone), timeLabel(slot.endAt, scope.timezone)) });
  return (await db.select().from(scheduleProposals).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.id, id))).limit(1))[0]!;
}

export async function approveScheduleProposal(scope: PlannerScope, input: { id: string; expectedVersion: number; taskExpectedVersion: number }) {
  const db = await requireDb();
  const proposal = (await db.select().from(scheduleProposals).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.id, input.id))).limit(1))[0];
  if (!proposal) throw new Error("Scheduling proposal was not found.");
  if (proposal.version !== input.expectedVersion) throw new PlannerConflictError(proposal);
  if (proposal.state !== "proposed") throw new Error("This scheduling proposal was already handled. Refresh before taking another action.");
  const task = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, proposal.taskId))).limit(1))[0];
  if (!task) throw new Error("The linked task no longer exists.");
  if (task.version !== input.taskExpectedVersion) throw new PlannerConflictError(task);
  await db.transaction(async tx => {
    await tx.update(tasks).set({ scheduledLocalDate: proposal.localDate, plannedStartAt: proposal.proposedStartAt, plannedEndAt: proposal.proposedEndAt, scheduleMode: "flexible", version: task.version + 1 }).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, task.id), eq(tasks.version, task.version)));
    await tx.update(scheduleProposals).set({ state: "approved", version: proposal.version + 1 }).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.id, proposal.id), eq(scheduleProposals.version, proposal.version)));
  });
  const updated = (await db.select().from(scheduleProposals).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.id, proposal.id))).limit(1))[0]!;
  if (updated.version === proposal.version) throw new PlannerConflictError(updated);
  return updated;
}

export async function dismissScheduleProposal(scope: PlannerScope, input: { id: string; expectedVersion: number }) {
  const db = await requireDb();
  const proposal = (await db.select().from(scheduleProposals).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.id, input.id))).limit(1))[0];
  if (!proposal) throw new Error("Scheduling proposal was not found.");
  if (proposal.version !== input.expectedVersion) throw new PlannerConflictError(proposal);
  if (proposal.state !== "proposed") throw new Error("Only an open proposal can be dismissed.");
  await db.update(scheduleProposals).set({ state: "dismissed", version: proposal.version + 1 }).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.id, proposal.id), eq(scheduleProposals.version, proposal.version)));
  return (await db.select().from(scheduleProposals).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.id, proposal.id))).limit(1))[0]!;
}

export async function undoScheduleProposal(scope: PlannerScope, input: { id: string; expectedVersion: number; taskExpectedVersion: number }) {
  const db = await requireDb();
  const proposal = (await db.select().from(scheduleProposals).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.id, input.id))).limit(1))[0];
  if (!proposal) throw new Error("Scheduling proposal was not found.");
  if (proposal.version !== input.expectedVersion) throw new PlannerConflictError(proposal);
  if (proposal.state !== "approved") throw new Error("Only an approved proposal can be undone.");
  const task = (await db.select().from(tasks).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, proposal.taskId))).limit(1))[0];
  if (!task) throw new Error("The linked task no longer exists.");
  if (task.version !== input.taskExpectedVersion) throw new PlannerConflictError(task);
  await db.transaction(async tx => {
    await tx.update(tasks).set({ scheduledLocalDate: proposal.previousScheduledLocalDate, plannedStartAt: proposal.previousStartAt, plannedEndAt: proposal.previousEndAt, version: task.version + 1 }).where(and(eq(tasks.workspaceId, scope.workspaceId), eq(tasks.id, task.id), eq(tasks.version, task.version)));
    await tx.update(scheduleProposals).set({ state: "undone", version: proposal.version + 1 }).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.id, proposal.id), eq(scheduleProposals.version, proposal.version)));
  });
  return (await db.select().from(scheduleProposals).where(and(eq(scheduleProposals.workspaceId, scope.workspaceId), eq(scheduleProposals.id, proposal.id))).limit(1))[0]!;
}
