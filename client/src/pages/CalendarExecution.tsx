import { Button } from "@/components/ui/button";
import { CalendarExecutionWorkspace } from "@/features/calendar/CalendarExecutionWorkspace";
import { getWorkspaceScope, localDateInTimezone, shiftLocalDate, type WorkspaceScope } from "@/lib/workspace";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function CalendarExecution() {
  const [scope] = useState<WorkspaceScope>(() => getWorkspaceScope());
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => ({ start: shiftLocalDate(today, -62), end: shiftLocalDate(today, 62) }), [today]);
  const snapshotQuery = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range }, { refetchInterval: 30_000 });
  const utils = trpc.useUtils();
  const updateTask = trpc.planner.task.update.useMutation();
  const rolloverDate = useMemo(() => shiftLocalDate(today, -1), [today]);
  const rolloverPreview = trpc.planner.task.rolloverPreview.useQuery({ ...scope, fromLocalDate: rolloverDate });
  const applyRollover = trpc.planner.task.applyRollover.useMutation();

  const completeTask = async (task: any) => {
    try {
      await updateTask.mutateAsync({ ...scope, id: task.id, expectedVersion: task.version, patch: { state: "completed" } });
      await Promise.all([utils.planner.workspace.snapshot.invalidate(), utils.planner.dashboard.invalidate()]);
      return null;
    } catch (error) {
      return error instanceof Error && error.message ? error.message : "This task could not be completed. Its calendar block remains unchanged.";
    }
  };
  const unreserveTask = async (task: any) => {
    try {
      await updateTask.mutateAsync({ ...scope, id: task.id, expectedVersion: task.version, patch: { plannedStartAt: null, plannedEndAt: null } });
      await Promise.all([utils.planner.workspace.snapshot.invalidate(), utils.planner.dashboard.invalidate()]);
      toast.success(`${task.title} returned to unreserved work. Its task, Plan for date, estimate, and links were kept.`);
      return null;
    } catch (error) {
      return error instanceof Error && error.message ? error.message : "Time could not be removed. The task was left unchanged; refresh and try again.";
    }
  };
  const applyMorningRollover = async () => {
    const candidates = rolloverPreview.data?.candidates ?? [];
    if (!candidates.length) return;
    try {
      const result = await applyRollover.mutateAsync({ ...scope, fromLocalDate: rolloverDate, tasks: candidates.map(item => ({ id: item.id, expectedVersion: item.expectedVersion })) });
      await Promise.all([utils.planner.workspace.snapshot.invalidate(), utils.planner.dashboard.invalidate(), rolloverPreview.refetch()]);
      toast.success(`${result.applied} unfinished reservation${result.applied === 1 ? "" : "s"} returned to unreserved work. Task state, Plan for date, and recurrence were kept.`);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Morning rollover could not be applied. No task was changed; refresh and try again.");
    }
  };

  if (snapshotQuery.isLoading || !snapshotQuery.data) return <main className="calendar-execution-page"><section className="calendar-execution-page-state" aria-live="polite"><Loader2 className="animate-spin" size={20} /><p>Opening your execution calendar…</p></section></main>;
  if (snapshotQuery.error) return <main className="calendar-execution-page"><section className="calendar-execution-page-state" role="alert"><h1>Calendar data could not load</h1><p>{snapshotQuery.error.message}</p><Button type="button" onClick={() => snapshotQuery.refetch()}>Try again</Button></section></main>;

  return <main className="calendar-execution-page"><header className="calendar-execution-page-top"><Link href="/?surface=today" className="calendar-execution-back"><ArrowLeft size={16} /> Daily desk</Link><div><span className="eyebrow">Calendar</span><h1>Execution calendar</h1></div><Link href="/?surface=tasks"><Button type="button" variant="outline" className="calendar-execution-open-tasks">Open Tasks</Button></Link></header><CalendarExecutionWorkspace scope={scope} snapshot={snapshotQuery.data} today={today} rolloverPreview={rolloverPreview.data} rolloverLoading={rolloverPreview.isLoading} rolloverPending={applyRollover.isPending} onApplyMorningRollover={applyMorningRollover} onOpenTasks={() => { window.location.assign("/?surface=tasks"); }} onComplete={completeTask} onUnreserve={unreserveTask} /></main>;
}
