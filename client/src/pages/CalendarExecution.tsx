import { Button } from "@/components/ui/button";
import { CalendarExecutionWorkspace } from "@/features/calendar/CalendarExecutionWorkspace";
import { getWorkspaceScope, localDateInTimezone, shiftLocalDate, type WorkspaceScope } from "@/lib/workspace";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

export default function CalendarExecution() {
  const [scope] = useState<WorkspaceScope>(() => getWorkspaceScope());
  const [today] = useState(() => localDateInTimezone(scope.timezone));
  const range = useMemo(() => ({ start: shiftLocalDate(today, -62), end: shiftLocalDate(today, 62) }), [today]);
  const snapshotQuery = trpc.planner.workspace.snapshot.useQuery({ ...scope, ...range }, { refetchInterval: 30_000 });
  const utils = trpc.useUtils();
  const updateTask = trpc.planner.task.update.useMutation();

  const completeTask = async (task: any) => {
    try {
      await updateTask.mutateAsync({ ...scope, id: task.id, expectedVersion: task.version, patch: { state: "completed" } });
      await Promise.all([utils.planner.workspace.snapshot.invalidate(), utils.planner.dashboard.invalidate()]);
      return null;
    } catch (error) {
      return error instanceof Error && error.message ? error.message : "This task could not be completed. Its calendar block remains unchanged.";
    }
  };

  if (snapshotQuery.isLoading || !snapshotQuery.data) return <main className="calendar-execution-page"><section className="calendar-execution-page-state" aria-live="polite"><Loader2 className="animate-spin" size={20} /><p>Opening your execution calendar…</p></section></main>;
  if (snapshotQuery.error) return <main className="calendar-execution-page"><section className="calendar-execution-page-state" role="alert"><h1>Calendar data could not load</h1><p>{snapshotQuery.error.message}</p><Button type="button" onClick={() => snapshotQuery.refetch()}>Try again</Button></section></main>;

  return <main className="calendar-execution-page"><header className="calendar-execution-page-top"><Link href="/?surface=today" className="calendar-execution-back"><ArrowLeft size={16} /> Daily desk</Link><div><span className="eyebrow">Calendar</span><h1>Execution calendar</h1></div><Link href="/?surface=tasks"><Button type="button" variant="outline" className="calendar-execution-open-tasks">Open Tasks</Button></Link></header><CalendarExecutionWorkspace scope={scope} snapshot={snapshotQuery.data} today={today} onOpenTasks={() => { window.location.assign("/?surface=tasks"); }} onComplete={completeTask} /></main>;
}
