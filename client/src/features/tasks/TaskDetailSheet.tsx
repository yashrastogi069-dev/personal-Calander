import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlannerSheet } from "@/features/shell/PlannerSheet";
import {
  localDateForReservation,
  taskSchedulingLanguage,
  validateTimeReservation,
} from "@shared/planningLanguage";
import { taskEditorSourceKey } from "@shared/taskEditor";
import { useEffect, useState, type FormEvent, type RefObject } from "react";
import { toast } from "sonner";

export type TaskMutationResult = {
  record: Record<string, any>;
  queued: boolean;
};

export type TaskDetailSheetProps = {
  task: any | null;
  open: boolean;
  returnFocusRef: RefObject<HTMLElement | null>;
  projects: any[];
  goals: any[];
  categories: any[];
  tasks: any[];
  dependencies?: any[];
  conflictCount?: number;
  isOnline?: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (task: any, patch: Record<string, unknown>) => Promise<TaskMutationResult>;
  onCreateSubtask: (task: any, title: string) => Promise<TaskMutationResult>;
  onAddDependency?: (task: any, dependsOnTaskId: string) => Promise<void>;
  onRemoveDependency?: (dependency: any) => Promise<void>;
};

function dateTimeLocalValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function selectValue(value: unknown) {
  return typeof value === "string" && value ? value : "none";
}

type RecurrenceDraft = {
  recurrenceFrequency: string;
  recurrenceInterval: string;
  recurrenceWeekdays: number[];
};

export function recurrenceRuleFromDraft(
  original: Record<string, unknown> | null | undefined,
  draft: RecurrenceDraft,
) {
  if (draft.recurrenceFrequency === "none") return null;
  const { weekdays: _weekdays, ...rest } = original ?? {};
  return {
    ...rest,
    frequency: draft.recurrenceFrequency,
    interval: Math.max(1, Number(draft.recurrenceInterval) || 1),
    ...(draft.recurrenceFrequency === "weekly"
      ? { weekdays: [...draft.recurrenceWeekdays].sort((left, right) => left - right) }
      : {}),
  };
}

export async function runDependencyAction(
  action: () => Promise<void>,
  onSuccess?: () => void,
): Promise<{ ok: true; error: null } | { ok: false; error: string }> {
  try {
    await action();
    onSuccess?.();
    return { ok: true, error: null };
  } catch (caught) {
    return {
      ok: false,
      error: caught instanceof Error ? caught.message : "The dependency change could not be saved.",
    };
  }
}

export function TaskDetailSheet({
  task,
  open,
  returnFocusRef,
  projects,
  goals,
  categories,
  tasks,
  dependencies = [],
  conflictCount = 0,
  isOnline = true,
  onOpenChange,
  onUpdate,
  onCreateSubtask,
  onAddDependency,
  onRemoveDependency,
}: TaskDetailSheetProps) {
  const [draft, setDraft] = useState<Record<string, any>>({});
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [dependencyTaskId, setDependencyTaskId] = useState("none");
  const [error, setError] = useState<string | null>(null);
  const [dependencyError, setDependencyError] = useState<string | null>(null);
  const [dependencyPending, setDependencyPending] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const sourceKey = task ? taskEditorSourceKey(task) : "none";

  useEffect(() => {
    if (!task) return;
    const rule = task.recurrenceRule as Record<string, unknown> | null;
    setDraft({
      title: task.title ?? "",
      description: task.description ?? "",
      state: task.state ?? "not_started",
      priority: task.priority ?? "medium",
      horizon: task.horizon ?? "weekly",
      categoryId: selectValue(task.categoryId),
      goalId: selectValue(task.goalId),
      projectId: selectValue(task.projectId),
      dueLocalDate: task.dueLocalDate ?? "",
      scheduledLocalDate: task.scheduledLocalDate ?? "",
      plannedStartAt: dateTimeLocalValue(task.plannedStartAt),
      plannedEndAt: dateTimeLocalValue(task.plannedEndAt),
      estimateMinutes: task.estimateMinutes?.toString() ?? "",
      scheduleMode: task.scheduleMode ?? "manual",
      recurrenceFrequency:
        rule?.frequency === "daily" || rule?.frequency === "weekly" || rule?.frequency === "monthly"
          ? rule.frequency
          : "none",
      recurrenceInterval: String(Math.max(1, Number(rule?.interval) || 1)),
      recurrenceWeekdays: Array.isArray(rule?.weekdays)
        ? rule.weekdays
            .filter(value => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 6)
            .map(Number)
        : [],
      recurrenceUntilLocalDate: task.recurrenceUntilLocalDate ?? "",
    });
    setSubtaskTitle("");
    setDependencyTaskId("none");
    setError(null);
    setDependencyError(null);
    setDependencyPending(null);
  }, [sourceKey]);

  if (!task) return null;

  const childTasks = tasks.filter(candidate => candidate.parentTaskId === task.id);
  const parentTask = tasks.find(candidate => candidate.id === task.parentTaskId);
  const taskDependencies = dependencies.filter(edge => edge.taskId === task.id);
  const dependencyIds = new Set(taskDependencies.map(edge => edge.dependsOnTaskId));
  const dependencyCandidates = tasks.filter(
    candidate =>
      candidate.id !== task.id &&
      candidate.state !== "archived" &&
      !dependencyIds.has(candidate.id),
  );
  const setField = (field: string, value: unknown) =>
    setDraft(current => ({ ...current, [field]: value }));

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const title = String(draft.title ?? "").trim();
    if (!title) {
      setError("Name this task before saving it.");
      return;
    }
    const reservationError = validateTimeReservation(
      draft.plannedStartAt || null,
      draft.plannedEndAt || null,
    );
    if (reservationError) {
      setError(reservationError);
      return;
    }
    const recurrenceRule = recurrenceRuleFromDraft(task.recurrenceRule, {
      recurrenceFrequency: draft.recurrenceFrequency,
      recurrenceInterval: draft.recurrenceInterval,
      recurrenceWeekdays: draft.recurrenceWeekdays ?? [],
    });
    setSaving(true);
    setError(null);
    try {
      const result = await onUpdate(task, {
        title,
        description: String(draft.description ?? "").trim() || null,
        state: draft.state,
        priority: draft.priority,
        horizon: draft.horizon,
        categoryId: draft.categoryId === "none" ? null : draft.categoryId,
        goalId: draft.goalId === "none" ? null : draft.goalId,
        projectId: draft.projectId === "none" ? null : draft.projectId,
        dueLocalDate: draft.dueLocalDate || null,
        scheduledLocalDate:
          localDateForReservation(draft.plannedStartAt) ??
          (draft.scheduledLocalDate || null),
        plannedStartAt: draft.plannedStartAt ? new Date(draft.plannedStartAt) : null,
        plannedEndAt: draft.plannedEndAt ? new Date(draft.plannedEndAt) : null,
        estimateMinutes: draft.estimateMinutes ? Number(draft.estimateMinutes) : null,
        scheduleMode: draft.scheduleMode,
        recurrenceRule,
        recurrenceAnchor: recurrenceRule ? "scheduled" : null,
        recurrenceUntilLocalDate: recurrenceRule
          ? draft.recurrenceUntilLocalDate || null
          : null,
      });
      toast.success(result.queued ? "Saved on this device · waiting to sync." : "Task changes saved.");
      onOpenChange(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The task could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const addSubtask = async () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    setSaving(true);
    setError(null);
    try {
      await onCreateSubtask(task, title);
      setSubtaskTitle("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The subtask could not be created.");
    } finally {
      setSaving(false);
    }
  };
  const addDependency = async () => {
    if (!onAddDependency || dependencyTaskId === "none") return;
    setDependencyPending("add");
    setDependencyError(null);
    const result = await runDependencyAction(
      () => onAddDependency(task, dependencyTaskId),
      () => setDependencyTaskId("none"),
    );
    if (!result.ok) setDependencyError(result.error);
    setDependencyPending(null);
  };
  const removeDependency = async (dependency: any) => {
    if (!onRemoveDependency) return;
    setDependencyPending(dependency.id);
    setDependencyError(null);
    const result = await runDependencyAction(() => onRemoveDependency(dependency));
    if (!result.ok) setDependencyError(result.error);
    setDependencyPending(null);
  };

  return (
    <PlannerSheet
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      title={task.title}
      description="One task record, with every planning field and action kept together."
      footer={
        <div className="task-detail-footer">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={`task-detail-${task.id}`} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form id={`task-detail-${task.id}`} className="task-detail-form" onSubmit={save} noValidate>
        {String(task.id).startsWith("offline:") ? (
          <p className="task-detail-state is-pending" role="status">Saved on this device · waiting to sync</p>
        ) : null}
        {conflictCount ? (
          <p className="task-detail-state is-conflict" role="status">{conflictCount} field conflict{conflictCount === 1 ? "" : "s"} retained for review</p>
        ) : null}

        <section className="task-detail-section" aria-labelledby="task-detail-core">
          <h3 id="task-detail-core">Commitment</h3>
          <label>Task title<Input value={draft.title ?? ""} onChange={event => setField("title", event.target.value)} /></label>
          <label>Description<textarea value={draft.description ?? ""} onChange={event => setField("description", event.target.value)} maxLength={10000} /></label>
          <div className="task-detail-grid">
            <label>Lifecycle<select value={draft.state ?? "not_started"} onChange={event => setField("state", event.target.value)}>{["not_started", "in_progress", "blocked", "completed", "archived"].map(value => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
            <label>Priority<select value={draft.priority ?? "medium"} onChange={event => setField("priority", event.target.value)}>{["none", "low", "medium", "high", "critical"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>Horizon<select value={draft.horizon ?? "weekly"} onChange={event => setField("horizon", event.target.value)}>{["daily", "weekly", "monthly", "quarterly", "yearly", "someday"].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <label>Scheduling mode<select value={draft.scheduleMode ?? "manual"} onChange={event => setField("scheduleMode", event.target.value)}><option value="manual">Manual</option><option value="flexible">Flexible</option><option value="pinned">Pinned</option></select></label>
          </div>
        </section>

        <section className="task-detail-section" aria-labelledby="task-detail-time">
          <h3 id="task-detail-time">Dates and time</h3>
          <div className="task-detail-grid">
            <label>{taskSchedulingLanguage.deadline.label}<Input type="date" value={draft.dueLocalDate ?? ""} onChange={event => setField("dueLocalDate", event.target.value)} /></label>
            <label>{taskSchedulingLanguage.planFor.label}<Input type="date" value={draft.scheduledLocalDate ?? ""} onChange={event => setField("scheduledLocalDate", event.target.value)} /></label>
            <label>Reserved start<Input type="datetime-local" value={draft.plannedStartAt ?? ""} onChange={event => setField("plannedStartAt", event.target.value)} /></label>
            <label>Reserved end<Input type="datetime-local" value={draft.plannedEndAt ?? ""} onChange={event => setField("plannedEndAt", event.target.value)} /></label>
            <label>{taskSchedulingLanguage.focusTime.label}<Input type="number" min="0" max="1440" value={draft.estimateMinutes ?? ""} onChange={event => setField("estimateMinutes", event.target.value)} /></label>
            <div className="task-detail-fact"><span>Order</span><strong>{task.sortOrder ?? 0}</strong></div>
          </div>
        </section>

        <section className="task-detail-section" aria-labelledby="task-detail-links">
          <h3 id="task-detail-links">Links</h3>
          <div className="task-detail-grid">
            <label>Project<select value={draft.projectId ?? "none"} onChange={event => setField("projectId", event.target.value)}><option value="none">No project</option>{projects.filter(item => item.state !== "archived").map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label>Goal<select value={draft.goalId ?? "none"} onChange={event => setField("goalId", event.target.value)}><option value="none">No goal</option>{goals.filter(item => item.state !== "archived").map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
            <label>Category<select value={draft.categoryId ?? "none"} onChange={event => setField("categoryId", event.target.value)}><option value="none">No category</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
          <dl className="task-detail-ledger">
            <div><dt>Parent task</dt><dd>{parentTask?.title ?? "None"}</dd></div>
            <div><dt>Outcome</dt><dd>{task.outcome === "wont_do" ? "Intentional noncompletion" : "None recorded"}</dd></div>
            <div><dt>Version</dt><dd>{task.version}</dd></div>
          </dl>
        </section>

        <section className="task-detail-section" aria-labelledby="task-detail-repeat">
          <h3 id="task-detail-repeat">Recurrence</h3>
          <div className="task-detail-grid">
            <label>Repeats<select value={draft.recurrenceFrequency ?? "none"} onChange={event => setField("recurrenceFrequency", event.target.value)}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
            {draft.recurrenceFrequency !== "none" ? <label>Every<Input type="number" min="1" max="365" value={draft.recurrenceInterval ?? "1"} onChange={event => setField("recurrenceInterval", event.target.value)} /></label> : null}
            {draft.recurrenceFrequency !== "none" ? <label>Stop after<Input type="date" value={draft.recurrenceUntilLocalDate ?? ""} onChange={event => setField("recurrenceUntilLocalDate", event.target.value)} /></label> : null}
          </div>
          {draft.recurrenceFrequency === "weekly" ? <fieldset className="task-recurrence-weekdays"><legend>Repeat on</legend>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((label, weekday) => <label key={label}><input type="checkbox" checked={(draft.recurrenceWeekdays ?? []).includes(weekday)} onChange={event => setField("recurrenceWeekdays", event.target.checked ? [...(draft.recurrenceWeekdays ?? []), weekday] : (draft.recurrenceWeekdays ?? []).filter((value: number) => value !== weekday))} /><span>{label.slice(0, 3)}</span></label>)}</fieldset> : null}
          <p>Occurrence decisions remain in occurrence history; editing this form does not rewrite past occurrences.</p>
        </section>

        <section className="task-detail-section" aria-labelledby="task-detail-subtasks">
          <h3 id="task-detail-subtasks">Subtasks</h3>
          {childTasks.length ? <ul>{childTasks.map(child => <li key={child.id}>{child.title}<span>{child.state.replaceAll("_", " ")}</span></li>)}</ul> : <p>No subtasks yet.</p>}
          <Label htmlFor={`task-subtask-${task.id}`}>New subtask</Label>
          <div className="task-detail-inline-create"><Input id={`task-subtask-${task.id}`} value={subtaskTitle} onChange={event => setSubtaskTitle(event.target.value)} placeholder="Add a concrete subtask" /><Button type="button" variant="outline" onClick={() => void addSubtask()} disabled={saving || !subtaskTitle.trim()}>Add subtask</Button></div>
        </section>

        <section className="task-detail-section" aria-labelledby="task-detail-dependencies">
          <h3 id="task-detail-dependencies">Dependencies</h3>
          {taskDependencies.length ? <ul>{taskDependencies.map(edge => { const dependency = tasks.find(candidate => candidate.id === edge.dependsOnTaskId); return <li key={edge.id}><span>{dependency?.title ?? "Unavailable task"} · {edge.dependencyType}</span>{onRemoveDependency ? <button type="button" disabled={!isOnline || dependencyPending !== null} onClick={() => void removeDependency(edge)}>{dependencyPending === edge.id ? "Removing…" : "Remove"}</button> : null}</li>; })}</ul> : <p>No dependencies recorded.</p>}
          {onAddDependency ? <><Label htmlFor={`task-dependency-${task.id}`}>Task this work depends on</Label><div className="task-detail-inline-create"><select id={`task-dependency-${task.id}`} value={dependencyTaskId} onChange={event => { setDependencyTaskId(event.target.value); setDependencyError(null); }}><option value="none">Choose a task</option>{dependencyCandidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select><Button type="button" variant="outline" disabled={!isOnline || dependencyTaskId === "none" || dependencyPending !== null} onClick={() => void addDependency()}>{dependencyPending === "add" ? "Adding…" : "Add dependency"}</Button></div></> : null}
          {!isOnline ? <p>Reconnect to change dependencies. Your task draft remains here.</p> : null}
          {dependencyError ? <p className="form-error" role="alert">{dependencyError} Your selection is still available; review it and retry.</p> : null}
        </section>

        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </form>
    </PlannerSheet>
  );
}
