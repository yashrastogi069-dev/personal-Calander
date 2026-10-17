// Today's write adapters: only existing tRPC procedures, no new endpoints. Home calls this hook once and
// passes the result to TodayWorkspace (prop wiring only), so the page itself stays renderable without a
// tRPC provider in node tests. Every success refreshes the snapshot and the dashboard.
import { trpc } from "@/lib/trpc";
import type { RecoveryDecision } from "@shared/recovery";

export type TodayWrites = {
  resolveOccurrence: (input: { id: string; expectedVersion: number; state: "completed" | "skipped" | "rescheduled"; rescheduledToLocalDate?: string | null }) => Promise<unknown>;
  resolveCommitment: (decision: RecoveryDecision) => Promise<unknown>;
  upsertPlan: (input: { localDate: string; expectedVersion?: number; state?: "draft" | "active" | "closed"; reflection?: string | null }) => Promise<{ id: string; version: number }>;
  addPlanItem: (input: { dailyPlanId: string; taskId: string }) => Promise<unknown>;
  closePlan: (input: { id: string; expectedVersion: number; reflection: string | null }) => Promise<unknown>;
  reserveTask: (input: { id: string; expectedVersion: number; localDate: string; plannedStartAt: Date; plannedEndAt: Date }) => Promise<unknown>;
  recordEnergy: (input: { localDate: string; energy: number }) => Promise<unknown>;
};

export function useTodayWrites(scope: { workspaceId: string; timezone: string }): TodayWrites {
  const utils = trpc.useUtils();
  const refresh = () => {
    void utils.planner.workspace.snapshot.invalidate();
    void utils.planner.dashboard.invalidate();
  };
  const options = { onSuccess: refresh };
  const occurrence = trpc.planner.occurrence.resolve.useMutation(options);
  const recovery = trpc.planner.recovery.resolve.useMutation(options);
  const upsert = trpc.planner.dailyPlan.upsert.useMutation(options);
  const addItem = trpc.planner.dailyPlan.addItem.useMutation(options);
  const close = trpc.planner.dailyPlan.close.useMutation(options);
  const reserve = trpc.planner.task.reserve.useMutation(options);
  const checkIn = trpc.planner.dailyCheckIn.upsert.useMutation(options);
  return {
    resolveOccurrence: input => occurrence.mutateAsync({ ...scope, ...input }),
    resolveCommitment: decision => recovery.mutateAsync({ ...scope, online: true, decision }),
    upsertPlan: async input => (await upsert.mutateAsync({ ...scope, ...input })) as { id: string; version: number },
    addPlanItem: input => addItem.mutateAsync({ ...scope, ...input }),
    closePlan: input => close.mutateAsync({ ...scope, ...input }),
    reserveTask: input => reserve.mutateAsync({ ...scope, ...input }),
    recordEnergy: input => checkIn.mutateAsync({ ...scope, ...input }),
  };
}
