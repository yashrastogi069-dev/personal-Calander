import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  displayLocalDate,
  shiftLocalDate,
  type WorkspaceScope,
} from "@/lib/workspace";
import { trpc } from "@/lib/trpc";
import { planningAvailability } from "@shared/planningAvailability";
import { projectEarlierPlanCommitments } from "@shared/todayProjection";
import { buildRecoveryEntries } from "@/features/recovery/recoveryModel";
import { RecoveryFlow } from "@/features/recovery/RecoveryFlow";
import {
  RecoveryIndicator,
  type AccountabilityLevel,
} from "@/features/recovery/RecoveryIndicator";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ListChecks,
  RotateCcw,
  Settings2,
  Target,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import "./plan-stages.css";

type PlanWorkspaceProps = {
  scope: WorkspaceScope;
  today: string;
  snapshot: any;
  dashboard: any;
  onOpenTasks: () => void;
  onOpenGoals: () => void;
  onOpenCalendar: () => void;
  focusEarlierCommitments?: boolean;
  onRecoveryIntentConsumed?: () => void;
  focusItemId?: string | null;
  isOnline?: boolean;
};

function weekStartFor(localDate: string) {
  const weekday = new Date(`${localDate}T12:00:00.000Z`).getUTCDay();
  return shiftLocalDate(localDate, weekday === 0 ? -6 : 1 - weekday);
}

function dateSummary(task: any) {
  if (task.scheduledLocalDate) return `Planned ${task.scheduledLocalDate}`;
  if (task.dueLocalDate) return `Deadline ${task.dueLocalDate}`;
  return "No date yet";
}

function DailyCommitmentRow({
  item,
  task,
  tomorrow,
  onResolve,
  onMove,
  pending,
}: {
  item: any;
  task: any;
  tomorrow: string;
  onResolve: (
    item: any,
    task: any,
    state: "done" | "rescheduled" | "deferred" | "wont_do" | "archived",
    date?: string
  ) => void;
  onMove?: (item: any, direction: -1 | 1) => void;
  pending: boolean;
}) {
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [nextDate, setNextDate] = useState(tomorrow);
  const resolved = item.state !== "committed";
  const missingTask = !task || Boolean(task.missingLinkedTask);
  const needsReconciliation =
    missingTask ||
    task?.state === "completed" ||
    task?.state === "archived" ||
    task?.outcome === "wont_do";
  const needsRecovery = Boolean(
    task?.recurrenceRule || task?.hasDatedOccurrenceHistory
  );
  const outcomeBlocked = needsReconciliation || needsRecovery;
  return (
    <article
      className={cn("plan-commitment", resolved && "is-resolved")}
      id={`daily-commitment-${item.id}`}
      tabIndex={-1}
    >
      <div className="plan-commitment-copy">
        <span className="plan-commitment-position">{item.position + 1}</span>
        <div>
          <strong>{task?.title ?? "Missing task"}</strong>
          <span>
            {resolved ? item.state.replace("_", " ") : dateSummary(task ?? {})}
            {item.note ? ` · ${item.note}` : ""}
          </span>
        </div>
      </div>
      {resolved ? (
        <span className="plan-outcome">
          {item.state === "wont_do" ? "Won’t do" : item.state}
        </span>
      ) : outcomeBlocked ? (
        <p className="plan-commitment-recovery-note" role="status">
          <strong>
            {missingTask
              ? "Missing linked task · needs reconciliation."
              : needsReconciliation
                ? "Needs reconciliation in Recovery."
                : "Needs recovery flow after migration."}
          </strong>{" "}
          {missingTask
            ? "This saved commitment remains open, but its task is unavailable. No outcome can be recorded here."
            : needsReconciliation
              ? "The linked task already has a final outcome, but this commitment is still open. No further task outcome is available here."
              : "This commitment stays open; the recurring series and dated history cannot be resolved safely here."}
        </p>
      ) : (
        <div className="plan-commitment-actions">
          {onMove ? (
            <>
              <button
                type="button"
                onClick={() => onMove(item, -1)}
                disabled={pending}
                aria-label={`Move ${task?.title ?? "commitment"} earlier`}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                onClick={() => onMove(item, 1)}
                disabled={pending}
                aria-label={`Move ${task?.title ?? "commitment"} later`}
              >
                <ArrowDown size={14} />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={() => onResolve(item, task, "done")}
            disabled={pending || !task}
          >
            <Check size={15} /> Done
          </button>
          <button
            type="button"
            onClick={() => setRescheduleOpen(open => !open)}
            disabled={pending || !task}
          >
            <RotateCcw size={14} /> Reschedule
          </button>
          <button
            type="button"
            onClick={() => onResolve(item, task, "deferred")}
            disabled={pending || !task}
          >
            Defer
          </button>
          <button
            type="button"
            onClick={() => onResolve(item, task, "wont_do")}
            disabled={pending || !task}
          >
            Won’t do
          </button>
        </div>
      )}
      {rescheduleOpen && !resolved && !outcomeBlocked ? (
        <div className="plan-reschedule-row">
          <Label htmlFor={`reschedule-${item.id}`}>Plan for</Label>
          <Input
            id={`reschedule-${item.id}`}
            type="date"
            value={nextDate}
            onChange={event => setNextDate(event.target.value)}
          />
          <Button
            type="button"
            onClick={() => onResolve(item, task, "rescheduled", nextDate)}
            disabled={pending || !nextDate}
          >
            Confirm
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function PlanningSettings({
  workspace,
  scope,
}: {
  workspace: any;
  scope: WorkspaceScope;
}) {
  const utils = trpc.useUtils();
  const [workdayStartsAt, setWorkdayStartsAt] = useState(
    workspace.workdayStartsAt
  );
  const [workdayEndsAt, setWorkdayEndsAt] = useState(workspace.workdayEndsAt);
  const [defaultBreakMinutes, setDefaultBreakMinutes] = useState(
    String(workspace.defaultBreakMinutes)
  );
  const [preferredShutdownAt, setPreferredShutdownAt] = useState(
    workspace.preferredShutdownAt
  );
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setWorkdayStartsAt(workspace.workdayStartsAt);
    setWorkdayEndsAt(workspace.workdayEndsAt);
    setDefaultBreakMinutes(String(workspace.defaultBreakMinutes));
    setPreferredShutdownAt(workspace.preferredShutdownAt);
  }, [
    workspace.id,
    workspace.version,
    workspace.workdayStartsAt,
    workspace.workdayEndsAt,
    workspace.defaultBreakMinutes,
    workspace.preferredShutdownAt,
  ]);
  const update = trpc.planner.workspace.update.useMutation({
    onSuccess: () => {
      setError(null);
      utils.planner.workspace.snapshot.invalidate();
      utils.planner.dashboard.invalidate();
      toast.success("Planning preferences saved.");
    },
    onError: mutationError =>
      setError(
        mutationError.message ||
          "Preferences could not be saved. Refresh and try again."
      ),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const breakMinutes = Number(defaultBreakMinutes);
    if (workdayEndsAt <= workdayStartsAt) {
      setError("Workday end must be after the workday start.");
      return;
    }
    if (
      !Number.isInteger(breakMinutes) ||
      breakMinutes < 0 ||
      breakMinutes > 240
    ) {
      setError("Break allowance must be a whole number from 0 to 240 minutes.");
      return;
    }
    setError(null);
    update.mutate({
      ...scope,
      expectedVersion: workspace.version,
      workdayStartsAt,
      workdayEndsAt,
      defaultBreakMinutes: breakMinutes,
      preferredShutdownAt,
    });
  };
  return (
    <details className="planning-settings">
      <summary>
        <span>
          <Settings2 size={16} /> Planning preferences
        </span>
        <small>Work hours, break allowance, shutdown</small>
        <ChevronRight size={17} />
      </summary>
      <form onSubmit={submit} className="planning-settings-form">
        <div className="field-grid">
          <div className="field">
            <Label htmlFor="plan-work-start">Workday starts</Label>
            <Input
              id="plan-work-start"
              type="time"
              value={workdayStartsAt}
              onChange={event => setWorkdayStartsAt(event.target.value)}
            />
          </div>
          <div className="field">
            <Label htmlFor="plan-work-end">Workday ends</Label>
            <Input
              id="plan-work-end"
              type="time"
              value={workdayEndsAt}
              onChange={event => setWorkdayEndsAt(event.target.value)}
            />
          </div>
        </div>
        <div className="field-grid">
          <div className="field">
            <Label htmlFor="plan-break">Break allowance</Label>
            <Input
              id="plan-break"
              type="number"
              min="0"
              max="240"
              value={defaultBreakMinutes}
              onChange={event => setDefaultBreakMinutes(event.target.value)}
            />
            <p className="field-guidance">
              Minutes kept out of available focus capacity.
            </p>
          </div>
          <div className="field">
            <Label htmlFor="plan-shutdown">Preferred shutdown</Label>
            <Input
              id="plan-shutdown"
              type="time"
              value={preferredShutdownAt}
              onChange={event => setPreferredShutdownAt(event.target.value)}
            />
            <p className="field-guidance">
              A cue for closing the day, not an automated reminder.
            </p>
          </div>
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="planning-settings-actions">
          <Button
            type="submit"
            className="primary-action"
            disabled={update.isPending}
          >
            {update.isPending ? "Saving…" : "Save preferences"}
          </Button>
        </div>
      </form>
    </details>
  );
}

function AccountabilitySettings({
  workspace,
  scope,
  isOnline,
}: {
  workspace: any;
  scope: WorkspaceScope;
  isOnline: boolean;
}) {
  const utils = trpc.useUtils();
  const level = (workspace.accountabilityLevel ??
    "structured") as AccountabilityLevel;
  const [selected, setSelected] = useState<AccountabilityLevel>(level);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setSelected(level), [level, workspace.version]);
  const update = trpc.planner.workspace.update.useMutation({
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        utils.planner.workspace.snapshot.invalidate(),
        utils.planner.dashboard.invalidate(),
      ]);
      toast.success("Recovery presentation saved.");
    },
    onError: cause =>
      setError(
        cause.message ||
          "Recovery presentation was not saved. Refresh and try again."
      ),
  });
  return (
    <details className="planning-settings">
      <summary>
        <span>
          <Settings2 size={16} /> Recovery presentation
        </span>
        <small>{level[0].toUpperCase() + level.slice(1)}</small>
        <ChevronRight size={17} />
      </summary>
      <div className="planning-settings-form">
        <p className="field-guidance">
          Choose how prominently open decisions appear. This changes
          presentation only; saved outcomes and history stay as they are.
        </p>
        <div className="recovery-level-choices">
          {(
            [
              ["gentle", "Review when ready; grouped in Plan"],
              ["structured", "Relevant attention in Today and Plan"],
              ["strict", "Persistent count until decisions are saved"],
            ] as const
          ).map(([value, description]) => (
            <label key={value}>
              <input
                type="radio"
                name="accountability-level"
                checked={selected === value}
                onChange={() => setSelected(value)}
                disabled={
                  !isOnline ||
                  !workspace.accountabilityAvailable ||
                  update.isPending
                }
              />
              <span>
                <strong>{value[0].toUpperCase() + value.slice(1)}</strong>
                <small>{description}</small>
              </span>
            </label>
          ))}
        </div>
        {!workspace.accountabilityAvailable ? (
          <p className="field-guidance" role="status">
            Available after the Phase 4 workspace migration. Structured remains
            the safe default.
          </p>
        ) : !isOnline ? (
          <p className="field-guidance" role="status">
            Reconnect to change this workspace preference.
          </p>
        ) : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button
          type="button"
          className="primary-action"
          disabled={
            !isOnline ||
            !workspace.accountabilityAvailable ||
            selected === level ||
            update.isPending
          }
          onClick={() =>
            update.mutate({
              ...scope,
              expectedVersion: workspace.version,
              accountabilityLevel: selected,
            })
          }
        >
          {update.isPending ? "Saving…" : "Save recovery presentation"}
        </Button>
      </div>
    </details>
  );
}

function DayAvailability({
  scope,
  today,
  workspace,
  exception,
}: {
  scope: WorkspaceScope;
  today: string;
  workspace: any;
  exception: any | undefined;
}) {
  const utils = trpc.useUtils();
  const [unavailable, setUnavailable] = useState(
    Boolean(exception?.isUnavailable)
  );
  const [startsAt, setStartsAt] = useState(
    exception?.workdayStartsAt ?? workspace.workdayStartsAt
  );
  const [endsAt, setEndsAt] = useState(
    exception?.workdayEndsAt ?? workspace.workdayEndsAt
  );
  const [breakMinutes, setBreakMinutes] = useState(
    String(exception?.breakMinutes ?? workspace.defaultBreakMinutes)
  );
  const [note, setNote] = useState(exception?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setUnavailable(Boolean(exception?.isUnavailable));
    setStartsAt(exception?.workdayStartsAt ?? workspace.workdayStartsAt);
    setEndsAt(exception?.workdayEndsAt ?? workspace.workdayEndsAt);
    setBreakMinutes(
      String(exception?.breakMinutes ?? workspace.defaultBreakMinutes)
    );
    setNote(exception?.note ?? "");
  }, [
    exception?.id,
    exception?.version,
    exception?.isUnavailable,
    exception?.workdayStartsAt,
    exception?.workdayEndsAt,
    exception?.breakMinutes,
    exception?.note,
    workspace.id,
    workspace.version,
  ]);
  const refresh = () => {
    utils.planner.workspace.snapshot.invalidate();
    utils.planner.dashboard.invalidate();
  };
  const upsert = trpc.planner.availability.upsert.useMutation({
    onSuccess: () => {
      setError(null);
      refresh();
      toast.success("Today’s availability saved.");
    },
    onError: mutationError =>
      setError(
        mutationError.message || "Today’s availability could not be saved."
      ),
  });
  const clear = trpc.planner.availability.clear.useMutation({
    onSuccess: () => {
      setError(null);
      refresh();
      toast.success("Regular availability restored for today.");
    },
    onError: mutationError =>
      setError(
        mutationError.message || "Regular availability could not be restored."
      ),
  });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const breakValue = Number(breakMinutes);
    if (!unavailable && endsAt <= startsAt) {
      setError("Available end must be after available start.");
      return;
    }
    if (!Number.isInteger(breakValue) || breakValue < 0 || breakValue > 240) {
      setError("Break allowance must be a whole number from 0 to 240 minutes.");
      return;
    }
    setError(null);
    upsert.mutate({
      ...scope,
      localDate: today,
      expectedVersion: exception?.version,
      isUnavailable: unavailable,
      workdayStartsAt: unavailable ? null : startsAt,
      workdayEndsAt: unavailable ? null : endsAt,
      breakMinutes: unavailable ? 0 : breakValue,
      note: note.trim() || null,
    });
  };
  return (
    <details className="day-availability">
      <summary>
        <span>
          <Clock3 size={16} /> Today’s availability
        </span>
        <small>
          {exception
            ? unavailable
              ? "Unavailable"
              : "Custom"
            : "Regular hours"}
        </small>
        <ChevronRight size={17} />
      </summary>
      <form onSubmit={submit} className="day-availability-form">
        <label className="day-unavailable-toggle">
          <input
            type="checkbox"
            checked={unavailable}
            onChange={event => setUnavailable(event.target.checked)}
          />{" "}
          <span>Unavailable all day</span>
        </label>
        {!unavailable ? (
          <div className="field-grid">
            <div className="field">
              <Label htmlFor="availability-start">Available from</Label>
              <Input
                id="availability-start"
                type="time"
                value={startsAt}
                onChange={event => setStartsAt(event.target.value)}
              />
            </div>
            <div className="field">
              <Label htmlFor="availability-end">Available until</Label>
              <Input
                id="availability-end"
                type="time"
                value={endsAt}
                onChange={event => setEndsAt(event.target.value)}
              />
            </div>
          </div>
        ) : null}
        <div className="field">
          <Label htmlFor="availability-break">Break allowance</Label>
          <Input
            id="availability-break"
            type="number"
            min="0"
            max="240"
            value={breakMinutes}
            onChange={event => setBreakMinutes(event.target.value)}
            disabled={unavailable}
          />
        </div>
        <div className="field">
          <Label htmlFor="availability-note">Reason (optional)</Label>
          <Input
            id="availability-note"
            value={note}
            onChange={event => setNote(event.target.value)}
            maxLength={500}
            placeholder="Travel, appointment, recovery…"
          />
        </div>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="day-availability-actions">
          <Button type="submit" disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Save today"}
          </Button>
          {exception ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                clear.mutate({
                  ...scope,
                  id: exception.id,
                  expectedVersion: exception.version,
                })
              }
              disabled={clear.isPending}
            >
              Use regular hours
            </Button>
          ) : null}
        </div>
      </form>
    </details>
  );
}

function ScheduleAssistance({
  scope,
  today,
  tasks,
  proposals,
}: {
  scope: WorkspaceScope;
  today: string;
  tasks: any[];
  proposals: any[];
}) {
  const utils = trpc.useUtils();
  const eligible = tasks.filter(
    task =>
      task.state !== "completed" &&
      task.state !== "archived" &&
      task.scheduleMode !== "pinned" &&
      task.estimateMinutes &&
      task.estimateMinutes >= 5
  );
  const [taskId, setTaskId] = useState(eligible[0]?.id ?? "none");
  const [localDate, setLocalDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!eligible.some(task => task.id === taskId))
      setTaskId(eligible[0]?.id ?? "none");
  }, [eligible, taskId]);
  const refresh = () => {
    utils.planner.workspace.snapshot.invalidate();
    utils.planner.dashboard.invalidate();
  };
  const create = trpc.planner.scheduleProposal.create.useMutation({
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError: mutationError =>
      setError(mutationError.message || "No proposal could be prepared."),
  });
  const approve = trpc.planner.scheduleProposal.approve.useMutation({
    onSuccess: () => {
      setError(null);
      refresh();
      toast.success("Time reservation approved.");
    },
    onError: mutationError =>
      setError(
        mutationError.message ||
          "The proposed reservation could not be approved."
      ),
  });
  const dismiss = trpc.planner.scheduleProposal.dismiss.useMutation({
    onSuccess: refresh,
    onError: mutationError =>
      setError(mutationError.message || "The proposal could not be dismissed."),
  });
  const undo = trpc.planner.scheduleProposal.undo.useMutation({
    onSuccess: () => {
      refresh();
      toast.success(
        "The approved reservation was restored to its prior state."
      );
    },
    onError: mutationError =>
      setError(mutationError.message || "The reservation could not be undone."),
  });
  const actionable = proposals
    .filter(
      proposal => proposal.state === "proposed" || proposal.state === "approved"
    )
    .slice(0, 6);
  const taskFor = (proposal: any) =>
    tasks.find(task => task.id === proposal.taskId);
  return (
    <section
      className="schedule-assistance-panel"
      aria-labelledby="schedule-assistance-heading"
    >
      <div className="plan-section-heading">
        <div>
          <span>Scheduling assistance</span>
          <h3 id="schedule-assistance-heading">Review an open slot</h3>
        </div>
        <em>Approval required</em>
      </div>
      <p>
        It finds the first open window inside your saved work hours, avoiding
        reserved task time and imported busy events. It never changes your
        calendar on its own.
      </p>
      {eligible.length ? (
        <form
          onSubmit={event => {
            event.preventDefault();
            if (taskId === "none") {
              setError("Choose a task with a focus-time estimate first.");
              return;
            }
            setError(null);
            create.mutate({ ...scope, taskId, localDate });
          }}
          className="schedule-proposal-form"
        >
          <div className="field">
            <Label htmlFor="proposal-task">Task</Label>
            <select
              id="proposal-task"
              value={taskId}
              onChange={event => setTaskId(event.target.value)}
            >
              {eligible.map(task => (
                <option value={task.id} key={task.id}>
                  {task.title} · {task.estimateMinutes} min
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <Label htmlFor="proposal-date">Propose for</Label>
            <Input
              id="proposal-date"
              type="date"
              value={localDate}
              onChange={event => setLocalDate(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Finding…" : "Find an open slot"}
          </Button>
        </form>
      ) : (
        <p className="schedule-empty-note">
          Add Focus time needed to an unfinished non-pinned task before
          requesting a time proposal.
        </p>
      )}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {actionable.length ? (
        <div className="schedule-proposal-list">
          {actionable.map(proposal => {
            const task = taskFor(proposal);
            return (
              <article key={proposal.id}>
                <div>
                  <strong>{task?.title ?? "Missing task"}</strong>
                  <p>{proposal.reason}</p>
                </div>
                {proposal.state === "proposed" ? (
                  <div>
                    <Button
                      type="button"
                      onClick={() =>
                        task &&
                        approve.mutate({
                          ...scope,
                          id: proposal.id,
                          expectedVersion: proposal.version,
                          taskExpectedVersion: task.version,
                        })
                      }
                      disabled={!task || approve.isPending}
                    >
                      Approve time
                    </Button>
                    <button
                      type="button"
                      onClick={() =>
                        dismiss.mutate({
                          ...scope,
                          id: proposal.id,
                          expectedVersion: proposal.version,
                        })
                      }
                      disabled={dismiss.isPending}
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <div>
                    <span className="schedule-approved">Approved</span>
                    <button
                      type="button"
                      onClick={() =>
                        task &&
                        undo.mutate({
                          ...scope,
                          id: proposal.id,
                          expectedVersion: proposal.version,
                          taskExpectedVersion: task.version,
                        })
                      }
                      disabled={!task || undo.isPending}
                    >
                      Undo reservation
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

export function PlanWorkspace({
  scope,
  today,
  snapshot,
  dashboard,
  onOpenTasks,
  onOpenGoals,
  onOpenCalendar,
  focusEarlierCommitments = false,
  onRecoveryIntentConsumed,
  focusItemId = null,
  isOnline = true,
}: PlanWorkspaceProps) {
  const utils = trpc.useUtils();
  const [intentionDraft, setIntentionDraft] = useState<{ planId: string | null; value: string } | null>(null);
  const [taskSearch, setTaskSearch] = useState("");
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [objectiveGoalId, setObjectiveGoalId] = useState("none");
  const [objectiveProjectId, setObjectiveProjectId] = useState("none");
  const [objectiveEvidenceDrafts, setObjectiveEvidenceDrafts] = useState<Record<string, string>>({});
  const [reflectionDraft, setReflectionDraft] = useState<{ planId: string; value: string } | null>(null);
  const [activeStage, setActiveStage] = useState<"recover" | "capacity" | "commit" | "reserve" | "review">("commit");
  const planStageOrder = ["recover", "capacity", "commit", "reserve", "review"] as const;
  const planStageLabels = { recover: "Resolve", capacity: "Capacity", commit: "Commit", reserve: "Reserve", review: "Review" } as const;
  const activeStageIndex = planStageOrder.indexOf(activeStage);
  const [localError, setLocalError] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const recoveryTriggerRef = useRef<HTMLButtonElement>(null);
  const refresh = () => {
    utils.planner.workspace.snapshot.invalidate();
    utils.planner.dashboard.invalidate();
  };
  const upsertPlan = trpc.planner.dailyPlan.upsert.useMutation({
    onSuccess: refresh,
    onError: error =>
      setLocalError(error.message || "Your daily plan could not be saved."),
  });
  const addItem = trpc.planner.dailyPlan.addItem.useMutation({
    onSuccess: refresh,
    onError: error =>
      setLocalError(
        error.message || "That task could not be added to today’s plan."
      ),
  });
  const moveItem = trpc.planner.dailyPlan.moveItem.useMutation({
    onSuccess: refresh,
    onError: error =>
      setLocalError(
        error.message ||
          "That commitment could not be reordered. Refresh and try again."
      ),
  });
  const resolveItem = trpc.planner.dailyPlan.resolveItem.useMutation({
    onSuccess: refresh,
    onError: error =>
      setLocalError(
        error.message ||
          "That daily outcome could not be saved. Refresh and try again."
      ),
  });
  const closePlan = trpc.planner.dailyPlan.close.useMutation({
    onSuccess: () => {
      refresh();
      toast.success("Daily plan closed with deliberate outcomes.");
    },
    onError: error =>
      setLocalError(error.message || "The day could not be closed yet."),
  });
  const createObjective = trpc.planner.weeklyObjective.create.useMutation({
    onSuccess: () => {
      setObjectiveTitle("");
      setObjectiveGoalId("none");
      setObjectiveProjectId("none");
      refresh();
    },
    onError: error =>
      setLocalError(error.message || "Weekly objective could not be created."),
  });
  const updateObjective = trpc.planner.weeklyObjective.update.useMutation({
    onSuccess: refresh,
    onError: error =>
      setLocalError(error.message || "Weekly objective could not be updated."),
  });
  const carryObjective = trpc.planner.weeklyObjective.carryForward.useMutation({
    onSuccess: refresh,
    onError: error =>
      setLocalError(
        error.message || "Weekly objective could not be carried forward."
      ),
  });
  const currentPlan = (snapshot.dailyPlans ?? []).find(
    (plan: any) => plan.localDate === today && plan.state !== "archived"
  );
  const intention = intentionDraft && intentionDraft.planId === (currentPlan?.id ?? null)
    ? intentionDraft.value
    : (currentPlan?.intention ?? "");
  const reflection = reflectionDraft && reflectionDraft.planId === currentPlan?.id
    ? reflectionDraft.value
    : (currentPlan?.reflection ?? "");
  useEffect(() => {
    const saved = window.sessionStorage.getItem(`plan-stage:${scope.workspaceId}`);
    if (saved === "recover" || saved === "capacity" || saved === "commit" || saved === "reserve" || saved === "review") setActiveStage(saved);
  }, [scope.workspaceId]);
  useEffect(() => {
    window.sessionStorage.setItem(`plan-stage:${scope.workspaceId}`, activeStage);
  }, [scope.workspaceId, activeStage]);
  const currentPlanItems = (snapshot.dailyPlanItems ?? [])
    .filter((item: any) => item.dailyPlanId === currentPlan?.id)
    .sort((left: any, right: any) => left.position - right.position);
  const earlierCommitments = projectEarlierPlanCommitments({
    localDate: today,
    tasks: snapshot.tasks ?? [],
    dailyPlans: snapshot.dailyPlans ?? [],
    dailyPlanItems: snapshot.dailyPlanItems ?? [],
  });
  const recoveryEntries = useMemo(
    () =>
      buildRecoveryEntries({
        todayLocalDate: today,
        plans: snapshot.dailyPlans ?? [],
        items: snapshot.dailyPlanItems ?? [],
        tasks: snapshot.tasks ?? [],
        occurrences: snapshot.taskOccurrences ?? [],
        carries: snapshot.carriedCommitments ?? [],
        resolutions: snapshot.commitmentResolutions ?? [],
      }),
    [
      today,
      snapshot.dailyPlans,
      snapshot.dailyPlanItems,
      snapshot.tasks,
      snapshot.taskOccurrences,
      snapshot.carriedCommitments,
      snapshot.commitmentResolutions,
    ]
  );
  const hasFocusedItem = Boolean(
    focusItemId &&
      (currentPlanItems.some((item: any) => item.id === focusItemId) ||
        earlierCommitments.some(row => row.dailyPlanItemId === focusItemId))
  );
  useEffect(() => {
    if (!hasFocusedItem) return;
    setActiveStage("commit");
    const frame = window.requestAnimationFrame(() => {
      const row = document.getElementById(`daily-commitment-${focusItemId}`);
      row?.scrollIntoView({ block: "center" });
      row?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusItemId, hasFocusedItem]);
  useEffect(() => {
    if (!focusEarlierCommitments) return;
    setActiveStage("recover");
    if (recoveryEntries.length) {
      document.getElementById("earlier-commitments")?.focus();
      setRecoveryOpen(true);
    }
    onRecoveryIntentConsumed?.();
  }, [focusEarlierCommitments, recoveryEntries.length, onRecoveryIntentConsumed]);
  const tasksById = useMemo(() => {
    const historyTaskIds = new Set(
      (snapshot.taskOccurrences ?? []).map(
        (occurrence: any) => occurrence.taskId
      )
    );
    const tasks = new Map<string, any>(
      (snapshot.tasks ?? []).map((task: any) => [
        task.id,
        { ...task, hasDatedOccurrenceHistory: historyTaskIds.has(task.id) },
      ])
    );
    for (const item of snapshot.dailyPlanItems ?? []) {
      if (!tasks.has(item.taskId))
        tasks.set(item.taskId, {
          id: item.taskId,
          title: "Missing linked task",
          state: "archived",
          missingLinkedTask: true,
        });
    }
    return tasks;
  }, [snapshot.tasks, snapshot.taskOccurrences, snapshot.dailyPlanItems]);
  const unfinishedTasks = (snapshot.tasks ?? []).filter(
    (task: any) =>
      task.state !== "completed" &&
      task.state !== "archived" &&
      task.outcome !== "wont_do"
  );
  const committedIds = new Set(
    currentPlanItems.map((item: any) => item.taskId)
  );
  const candidates = unfinishedTasks
    .filter(
      (task: any) =>
        !committedIds.has(task.id) &&
        task.title.toLowerCase().includes(taskSearch.toLowerCase())
    )
    .slice(0, 12);
  const weekStart = weekStartFor(today);
  const currentObjectives = (snapshot.weeklyObjectives ?? []).filter(
    (objective: any) =>
      objective.weekStartLocalDate === weekStart &&
      objective.state !== "archived"
  );
  const recentPlans = (snapshot.dailyPlans ?? [])
    .filter((plan: any) => plan.localDate < today && plan.state !== "archived")
    .sort((left: any, right: any) => right.localDate.localeCompare(left.localDate))
    .slice(0, 7);
  const earlierObjectives = (snapshot.weeklyObjectives ?? [])
    .filter((objective: any) => objective.weekStartLocalDate < weekStart)
    .sort((left: any, right: any) => right.weekStartLocalDate.localeCompare(left.weekStartLocalDate))
    .slice(0, 8);
  const availabilityException = (
    snapshot.planningAvailabilityExceptions ?? []
  ).find((exception: any) => exception.localDate === today);
  const availabilityWindow = availabilityException?.isUnavailable
    ? {
        workdayStartsAt: "00:00",
        workdayEndsAt: "00:00",
        defaultBreakMinutes: 0,
      }
    : {
        workdayStartsAt:
          availabilityException?.workdayStartsAt ??
          snapshot.workspace.workdayStartsAt,
        workdayEndsAt:
          availabilityException?.workdayEndsAt ??
          snapshot.workspace.workdayEndsAt,
        defaultBreakMinutes:
          availabilityException?.breakMinutes ??
          snapshot.workspace.defaultBreakMinutes,
      };
  const reservedBlocks = unfinishedTasks
    .filter((task: any) => task.plannedStartAt && task.plannedEndAt)
    .map((task: any) => ({
      startsAt: task.plannedStartAt,
      endsAt: task.plannedEndAt,
    }));
  const externalBusy = (snapshot.externalEvents ?? [])
    .filter((event: any) => event.status === "active")
    .map((event: any) => ({ startsAt: event.startsAt, endsAt: event.endsAt }));
  const availability = planningAvailability({
    localDate: today,
    timezone: scope.timezone,
    window: availabilityWindow,
    reservedBlocks,
    externalBusy,
  });
  const unresolved = currentPlanItems.filter(
    (item: any) => item.state === "committed"
  );
  const startPlan = () => {
    setLocalError(null);
    upsertPlan.mutate({
      ...scope,
      localDate: today,
      state: "active",
      intention: intention.trim() || null,
    });
  };
  const saveIntention = () => {
    if (!currentPlan) return startPlan();
    setLocalError(null);
    upsertPlan.mutate({
      ...scope,
      localDate: today,
      expectedVersion: currentPlan.version,
      intention: intention.trim() || null,
      state: currentPlan.state,
    });
  };
  const reopenPlan = () => {
    if (!currentPlan || currentPlan.state !== "closed") return;
    setLocalError(null);
    upsertPlan.mutate({ ...scope, localDate: today, expectedVersion: currentPlan.version, state: "active" });
  };
  const resolve = (
    item: any,
    task: any,
    state: "done" | "rescheduled" | "deferred" | "wont_do" | "archived",
    resolvedToLocalDate?: string
  ) => {
    if (!task) return;
    if (
      task.state === "completed" ||
      task.state === "archived" ||
      task.outcome === "wont_do"
    ) {
      setLocalError(
        "Needs reconciliation in Recovery. The linked task already has a final outcome; nothing was changed."
      );
      return;
    }
    if (task.recurrenceRule || task.hasDatedOccurrenceHistory) {
      setLocalError(
        "Recurring commitments need the recovery flow after migration. Nothing was changed."
      );
      return;
    }
    setLocalError(null);
    resolveItem.mutate({
      ...scope,
      id: item.id,
      expectedVersion: item.version,
      taskExpectedVersion: task.version,
      state,
      resolvedToLocalDate: resolvedToLocalDate ?? null,
    });
  };
  const move = (item: any, direction: -1 | 1) => {
    setLocalError(null);
    moveItem.mutate({
      ...scope,
      id: item.id,
      expectedVersion: item.version,
      direction,
    });
  };
  const close = () => {
    if (!currentPlan) return;
    if (unresolved.length) {
      setLocalError(
        `Resolve ${unresolved.length} remaining commitment${unresolved.length === 1 ? "" : "s"} before closing the day.`
      );
      return;
    }
    setLocalError(null);
    closePlan.mutate({
      ...scope,
      id: currentPlan.id,
      expectedVersion: currentPlan.version,
      reflection: reflection.trim() || null,
    });
  };
  const submitObjective = (event: FormEvent) => {
    event.preventDefault();
    const title = objectiveTitle.trim();
    if (!title) {
      setLocalError("Name the weekly outcome before saving it.");
      return;
    }
    setLocalError(null);
    createObjective.mutate({
      ...scope,
      weekStartLocalDate: weekStart,
      title,
      goalId: objectiveGoalId === "none" ? null : objectiveGoalId,
      projectId: objectiveProjectId === "none" ? null : objectiveProjectId,
    });
  };
  return (
    <section
      className="plan-workspace"
      data-plan-stage={activeStage}
      aria-labelledby="plan-workspace-heading"
    >
      <RecoveryFlow
        key={scope.workspaceId}
        open={recoveryOpen}
        onOpenChange={setRecoveryOpen}
        entries={recoveryEntries}
        scope={scope}
        online={isOnline}
        onReviewTask={onOpenTasks}
        returnFocusRef={recoveryTriggerRef}
      />
      <header className="plan-workspace-header">
        <div>
          <h2 id="plan-workspace-heading">Make today believable.</h2>
          <p>
            Choose a few commitments, check the real room in your day, and close
            each one deliberately.
          </p>
        </div>
        <span>
          {displayLocalDate(today, scope.timezone, {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
        </span>
      </header>
      <nav className="plan-stage-nav" aria-label="Planning stages">
        {([
          ["recover", "01", "Resolve", recoveryEntries.length ? `${recoveryEntries.length} open` : "Clear"],
          ["capacity", "02", "Capacity", `${availability.freeMinutes}m free`],
          ["commit", "03", "Commit", `${currentPlanItems.length} chosen`],
          ["reserve", "04", "Reserve", "Calendar"],
          ["review", "05", "Review", currentPlan ? `${currentPlanItems.length} saved` : "No plan"],
        ] as const).map(([stage, number, label, detail]) => (
          <button key={stage} type="button" aria-current={activeStage === stage ? "step" : undefined} className={cn("plan-stage-button", activeStage === stage && "is-active")} onClick={() => setActiveStage(stage)}>
            <span>{number}</span><strong>{label}</strong><small>{detail}</small>
          </button>
        ))}
      </nav>
      <nav className="plan-mobile-stepper" aria-label="Planning stage navigation">
        <button type="button" aria-label="Previous planning stage" disabled={activeStageIndex === 0} onClick={() => setActiveStage(planStageOrder[activeStageIndex - 1])}><ChevronLeft size={18} /></button>
        <div aria-live="polite"><span>Step {activeStageIndex + 1} of {planStageOrder.length}</span><strong>{planStageLabels[activeStage]}</strong></div>
        <button type="button" aria-label="Next planning stage" disabled={activeStageIndex === planStageOrder.length - 1} onClick={() => setActiveStage(planStageOrder[activeStageIndex + 1])}>Next <ChevronRight size={16} /></button>
        <select aria-label="Jump to planning stage" value={activeStage} onChange={event => setActiveStage(event.target.value as (typeof planStageOrder)[number])}>
          {planStageOrder.map(stage => <option key={stage} value={stage}>{planStageLabels[stage]}</option>)}
        </select>
      </nav>
      {localError ? (
        <div className="plan-inline-error" role="alert">
          <CircleAlert size={17} />
          <span>{localError}</span>
          <button
            type="button"
            onClick={() => setLocalError(null)}
            aria-label="Dismiss planning message"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}
      {activeStage === "recover" ? (
        <section
          id="earlier-commitments"
          className="plan-candidate-panel"
          tabIndex={-1}
          aria-labelledby="earlier-commitments-heading"
        >
          <div className="plan-section-heading">
            <div>
              <span>Earlier plans</span>
              <h3 id="earlier-commitments-heading">Resolve remaining work</h3>
            </div>
            <em>{recoveryEntries.length} unresolved</em>
          </div>
          <p>
            These promises stay attached to their original day until you choose
            an outcome.
          </p>
          {recoveryEntries.length ? <RecoveryIndicator
            count={recoveryEntries.length}
            level={(snapshot.workspace.accountabilityLevel ?? "structured") as AccountabilityLevel}
            onOpen={() => setRecoveryOpen(true)}
            buttonRef={recoveryTriggerRef}
          /> : <p className="plan-stage-empty">No earlier commitments need resolution. Your history remains intact.</p>}
        </section>
      ) : null}
      <div className="plan-workspace-grid">
        <section
          className="daily-plan-panel"
          hidden={activeStage !== "commit"}
          aria-labelledby="daily-plan-heading"
        >
          <div className="plan-section-heading">
            <div>
              <span>Daily plan</span>
              <h3 id="daily-plan-heading">
                {currentPlan?.state === "closed"
                  ? "Day closed"
                  : "Your commitments"}
              </h3>
            </div>
            {currentPlan ? <em>{currentPlanItems.length} chosen</em> : null}
          </div>
          {!currentPlan ? (
            <div className="plan-start">
              <p>
                Start with an intention, then choose only the work you can stand
                behind.
              </p>
              <Label htmlFor="daily-intention">Today’s intention</Label>
              <Input
                id="daily-intention"
                value={intention}
                onChange={event => setIntentionDraft({ planId: null, value: event.target.value })}
                maxLength={3000}
                placeholder="What would make today feel well spent?"
              />
              <Button
                type="button"
                className="primary-action"
                onClick={startPlan}
                disabled={upsertPlan.isPending}
              >
                {upsertPlan.isPending ? "Starting…" : "Start today’s plan"}
              </Button>
            </div>
          ) : (
            <>
              <div className="plan-intention">
                <Label htmlFor="daily-intention">Today’s intention</Label>
                <Input
                  id="daily-intention"
                  value={intention}
                  onChange={event => setIntentionDraft({ planId: currentPlan.id, value: event.target.value })}
                  maxLength={3000}
                  placeholder="Name the direction for today"
                  disabled={currentPlan.state === "closed"}
                />
                <button
                  type="button"
                  onClick={saveIntention}
                  disabled={upsertPlan.isPending || currentPlan.state === "closed" || intention.trim() === (currentPlan.intention ?? "")}
                >
                  Save intention
                </button>
              </div>
              <div className="plan-commitment-list">
                {currentPlanItems.length ? (
                  currentPlanItems.map((item: any) => (
                    <DailyCommitmentRow
                      key={item.id}
                      item={item}
                      task={tasksById.get(item.taskId)}
                      tomorrow={shiftLocalDate(today, 1)}
                      onResolve={resolve}
                      onMove={move}
                      pending={resolveItem.isPending || moveItem.isPending}
                    />
                  ))
                ) : (
                  <p className="plan-empty-copy">
                    No commitments yet. Add only work you intend to finish or
                    deliberately resolve.
                  </p>
                )}
              </div>
              {currentPlan.state !== "closed" ? (
                <div className="plan-shutdown">
                  <div>
                    <Clock3 size={17} />
                    <span>
                      <b>Daily shutdown</b>
                      <small>
                        Resolve each commitment before closing. Nothing carries
                        over silently.
                      </small>
                    </span>
                  </div>
                  <Label htmlFor="daily-reflection">Reflection</Label>
                  <Input
                    id="daily-reflection"
                    value={reflection}
                    onChange={event => setReflectionDraft({ planId: currentPlan.id, value: event.target.value })}
                    maxLength={5000}
                    placeholder="What should tomorrow inherit from today?"
                  />
                  <Button
                    type="button"
                    onClick={close}
                    disabled={closePlan.isPending}
                  >
                    {closePlan.isPending
                      ? "Closing…"
                      : unresolved.length
                        ? `Resolve ${unresolved.length} to close`
                        : "Close today"}
                  </Button>
                </div>
              ) : (
                <div className="plan-closed-note">
                  <p><Check size={16} /> Closed deliberately. Reflection remains in today’s plan history.</p>
                  <button type="button" onClick={reopenPlan} disabled={upsertPlan.isPending}>Reopen this day</button>
                </div>
              )}
            </>
          )}
        </section>
        <aside className="plan-context-panel" hidden={activeStage !== "capacity"}>
          <div className="plan-section-heading">
            <div>
              <span>Real capacity</span>
              <h3>Room in the day</h3>
            </div>
            <em>{availability.freeMinutes}m free</em>
          </div>
          <div className="plan-capacity-grid">
            <div>
              <span>Work window</span>
              <strong>{availability.workdayMinutes}m</strong>
            </div>
            <div>
              <span>Calendar busy</span>
              <strong>{availability.externalBusyMinutes}m</strong>
            </div>
            <div>
              <span>Reserved work</span>
              <strong>{availability.scheduledMinutes}m</strong>
            </div>
            <div>
              <span>Break allowance</span>
              <strong>{availability.breakMinutes}m</strong>
            </div>
          </div>
          <p>
            {availabilityException?.isUnavailable
              ? "You marked today unavailable. No new focus slot will be proposed."
              : availability.isOvercommitted
                ? "Reserved work exceeds the available window after external time and breaks. Repair the plan before adding more."
                : `${availability.freeMinutes} minutes remain after reserved work, external busy events, and your break allowance.`}
          </p>
          <button type="button" className="plan-link" onClick={onOpenTasks}>
            Review task load <ChevronRight size={16} />
          </button>
          <DayAvailability
            scope={scope}
            today={today}
            workspace={snapshot.workspace}
            exception={availabilityException}
          />
          <PlanningSettings workspace={snapshot.workspace} scope={scope} />
          <AccountabilitySettings workspace={snapshot.workspace} scope={scope} isOnline={isOnline} />
        </aside>
      </div>
      {activeStage === "commit" && currentPlan?.state !== "closed" ? (
        <section
          className="plan-candidate-panel"
          aria-labelledby="commitment-candidates-heading"
        >
          <div className="plan-section-heading">
            <div>
              <span>Choose deliberately</span>
              <h3 id="commitment-candidates-heading">Available work</h3>
            </div>
            <button type="button" className="plan-link" onClick={onOpenTasks}>
              Open task board <ChevronRight size={16} />
            </button>
          </div>
          {!currentPlan ? (
            <p className="plan-stage-empty" id="plan-start-before-commit">
              Start today’s plan above before adding a commitment.
            </p>
          ) : null}
          <Input
            value={taskSearch}
            onChange={event => setTaskSearch(event.target.value)}
            placeholder="Filter unfinished tasks"
            aria-label="Filter unfinished tasks for today’s plan"
          />
          {candidates.length ? (
            <div className="plan-candidate-list">
              {candidates.map((task: any) => (
                <article key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>
                      {dateSummary(task)}
                      {task.estimateMinutes
                        ? ` · ${task.estimateMinutes} min`
                        : " · effort unknown"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      if (currentPlan)
                        addItem.mutate({
                          ...scope,
                          dailyPlanId: currentPlan.id,
                          taskId: task.id,
                        });
                    }}
                    disabled={!currentPlan || addItem.isPending}
                    aria-describedby={!currentPlan ? "plan-start-before-commit" : undefined}
                  >
                    Commit
                  </Button>
                </article>
              ))}
            </div>
          ) : (
            <p className="plan-empty-copy">
              No remaining unfinished tasks match this view. Capture work or
              review Tasks.
            </p>
          )}
        </section>
      ) : null}
      {activeStage === "reserve" ? <section className="plan-calendar-stage" aria-labelledby="plan-calendar-stage-heading"><div><span>Reserve real time</span><h3 id="plan-calendar-stage-heading">Turn commitments into a believable calendar</h3><p>Review availability and place focus blocks in Calendar. A reservation changes planned time, not the task deadline or your daily commitment.</p></div><Button type="button" onClick={onOpenCalendar}>Open Calendar <ChevronRight size={16} /></Button></section> : null}
      {activeStage === "reserve" ? <ScheduleAssistance
        scope={scope}
        today={today}
        tasks={unfinishedTasks}
        proposals={snapshot.scheduleProposals ?? []}
      /> : null}
      {activeStage === "review" ? (
        <section className="plan-review-panel" aria-labelledby="plan-review-heading">
          <div className="plan-section-heading">
            <div>
              <span>Today’s saved plan</span>
              <h3 id="plan-review-heading">Review your commitments</h3>
            </div>
            {currentPlan ? <em>{currentPlan.state === "closed" ? "Closed" : `${unresolved.length} open`}</em> : null}
          </div>
          {currentPlan ? (
            <>
              <p className="plan-review-intention"><strong>Intention</strong>{currentPlan.intention || "No intention saved"}</p>
              {currentPlanItems.length ? (
                <ol className="plan-review-list">
                  {currentPlanItems.map((item: any) => (
                    <li key={item.id}>
                      <strong>{tasksById.get(item.taskId)?.title ?? "Missing linked task"}</strong>
                      <span>{item.state === "wont_do" ? "Won’t do" : item.state.replace("_", " ")}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="plan-stage-empty">No commitments saved for today yet.</p>}
              {currentPlan.reflection ? <p className="plan-review-reflection"><strong>Saved reflection</strong>{currentPlan.reflection}</p> : null}
              <div className="plan-review-next">
                <p>{currentPlan.state === "closed" ? "This day is closed. Reopen it in Commit if you need to make a change." : "Resolve or change commitments, then close the day in Commit."}</p>
                <Button type="button" variant="outline" onClick={() => setActiveStage("commit")}>{currentPlan.state === "closed" ? "View closed plan" : "Manage today’s plan"} <ChevronRight size={16} /></Button>
              </div>
            </>
          ) : (
            <div className="plan-review-next">
              <p>There is no saved plan for today. Start one in Commit to review your commitments here.</p>
              <Button type="button" variant="outline" onClick={() => setActiveStage("commit")}>Start today’s plan <ChevronRight size={16} /></Button>
            </div>
          )}
        </section>
      ) : null}
      <section
        className="weekly-objectives-panel"
        hidden={activeStage !== "review"}
        aria-labelledby="weekly-objectives-heading"
      >
        <details className="plan-weekly-tools">
          <summary><span id="weekly-objectives-heading">Weekly objectives</span><small>{currentObjectives.length} this week · Add or record evidence</small></summary>
          <div className="plan-weekly-content">
            <p>Weekly outcomes have their own evidence and timing. They do not close today’s plan.</p>
            <button type="button" className="plan-link" onClick={onOpenGoals}>
              Open goals <ChevronRight size={16} />
            </button>
        <form className="weekly-objective-form" onSubmit={submitObjective}>
          <div className="field">
            <Label htmlFor="weekly-objective-title">Weekly outcome</Label>
            <Input
              id="weekly-objective-title"
              value={objectiveTitle}
              onChange={event => setObjectiveTitle(event.target.value)}
              placeholder="What matters by the end of this week?"
              maxLength={280}
            />
          </div>
          <div className="field-grid">
            <div className="field">
              <Label htmlFor="weekly-objective-goal">Goal link</Label>
              <select
                id="weekly-objective-goal"
                value={objectiveGoalId}
                onChange={event => setObjectiveGoalId(event.target.value)}
              >
                <option value="none">No goal link</option>
                {(snapshot.goals ?? [])
                  .filter((goal: any) => goal.state !== "archived")
                  .map((goal: any) => (
                    <option value={goal.id} key={goal.id}>
                      {goal.title}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <Label htmlFor="weekly-objective-project">Project link</Label>
              <select
                id="weekly-objective-project"
                value={objectiveProjectId}
                onChange={event => setObjectiveProjectId(event.target.value)}
              >
                <option value="none">No project link</option>
                {(snapshot.projects ?? [])
                  .filter((project: any) => project.state !== "archived")
                  .map((project: any) => (
                    <option value={project.id} key={project.id}>
                      {project.title}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <Button
            type="submit"
            className="primary-action"
            disabled={createObjective.isPending}
          >
            {createObjective.isPending ? "Saving…" : "Add weekly objective"}
          </Button>
        </form>
        {currentObjectives.length ? (
          <div className="weekly-objective-list">
            {currentObjectives.map((objective: any) => (
              <article key={objective.id}>
                <div>
                  <Target size={17} />
                  <span>
                    <strong>{objective.title}</strong>
                    <small>
                      {objective.state}
                      {objective.evidence
                        ? ` · ${objective.evidence}`
                        : " · evidence not recorded"}
                    </small>
                  </span>
                </div>
                <div className="weekly-evidence-edit">
                  <Label htmlFor={`weekly-evidence-${objective.id}`}>Evidence of progress</Label>
                  <Input id={`weekly-evidence-${objective.id}`} value={objectiveEvidenceDrafts[objective.id] ?? objective.evidence ?? ""} onChange={event => setObjectiveEvidenceDrafts(current => ({ ...current, [objective.id]: event.target.value }))} maxLength={5000} placeholder="What actually happened?" />
                  <button type="button" onClick={() => updateObjective.mutate({ ...scope, id: objective.id, expectedVersion: objective.version, patch: { evidence: (objectiveEvidenceDrafts[objective.id] ?? "").trim() } })} disabled={updateObjective.isPending || objectiveEvidenceDrafts[objective.id] === undefined || !objectiveEvidenceDrafts[objective.id].trim() || objectiveEvidenceDrafts[objective.id].trim() === (objective.evidence ?? "")}>Save evidence</button>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() =>
                      updateObjective.mutate({
                        ...scope,
                        id: objective.id,
                        expectedVersion: objective.version,
                        patch: {
                          state: "completed",
                          evidence: (objectiveEvidenceDrafts[objective.id] ?? objective.evidence ?? "").trim(),
                        },
                      })
                    }
                    disabled={
                      updateObjective.isPending ||
                      !(objectiveEvidenceDrafts[objective.id] ?? objective.evidence ?? "").trim() ||
                      objective.state === "completed"
                    }
                  >
                    Complete
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      carryObjective.mutate({
                        ...scope,
                        id: objective.id,
                        expectedVersion: objective.version,
                        nextWeekStartLocalDate: shiftLocalDate(weekStart, 7),
                      })
                    }
                    disabled={
                      carryObjective.isPending ||
                      objective.state === "completed"
                    }
                  >
                    Carry forward
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="plan-empty-copy">
            No weekly outcome selected yet. Add one that deserves evidence, not
            a list of errands.
          </p>
        )}
          </div>
        </details>
      </section>
      {activeStage === "review" ? <section className="plan-history-panel" aria-labelledby="plan-history-heading">
        <div className="plan-section-heading"><div><span>Continuity</span><h3 id="plan-history-heading">Recent planning history</h3></div></div>
        <p>Past days and weekly outcomes remain visible. Reopening today keeps its existing commitments and reflection.</p>
        {recentPlans.length ? <div className="plan-history-list">{recentPlans.map((plan: any) => <article key={plan.id}><strong>{plan.localDate}</strong><span>{plan.state}</span><p>{plan.intention || "No intention recorded"}</p>{plan.reflection ? <small>Reflection: {plan.reflection}</small> : null}</article>)}</div> : <p>No earlier daily plans are in this snapshot.</p>}
        {earlierObjectives.length ? <div className="plan-history-list">{earlierObjectives.map((objective: any) => <article key={objective.id}><strong>{objective.title}</strong><span>{objective.weekStartLocalDate} · {objective.state}</span>{objective.carriedForwardFromId ? <small>Continued from an earlier objective</small> : null}{objective.evidence ? <p>Evidence: {objective.evidence}</p> : null}</article>)}</div> : null}
      </section> : null}
    </section>
  );
}
