import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlannerSheet } from "@/features/shell/PlannerSheet";
import { ChevronDown } from "lucide-react";
import {
  localDateForReservation,
  taskSchedulingLanguage,
  validateTimeReservation,
} from "@shared/planningLanguage";
import { taskEditorSourceKey } from "@shared/taskEditor";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { toast } from "sonner";
import "./task-detail-inspector.css";

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
  draftScopeKey?: string;
  onOpenChange: (open: boolean) => void;
  onStartFocus?: (task: any) => void;
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

export type TaskInspectorDraft = {
  sourceKey: string;
  fields: Record<string, any>;
  changed: boolean;
  subtaskTitle: string;
  dependencyTaskId: string;
  error: string | null;
  dependencyError: string | null;
  dependencyPending: string | null;
  saving: boolean;
};

export function taskInspectorDraftKey(task: { id: string; workspaceId?: string }, scope?: string) {
  return `task-inspector-draft:${encodeURIComponent(scope || task.workspaceId || "unknown-workspace")}:${encodeURIComponent(task.id)}`;
}

export function seedTaskInspectorDraft(task: any): TaskInspectorDraft {
  const rule = task.recurrenceRule as Record<string, unknown> | null;
  return {
    sourceKey: taskEditorSourceKey(task),
    fields: {
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
    },
    changed: false,
    subtaskTitle: "",
    dependencyTaskId: "none",
    error: null,
    dependencyError: null,
    dependencyPending: null,
    saving: false,
  };
}

export function resolveTaskInspectorDraft(previous: TaskInspectorDraft | null | undefined, task: any) {
  if (!previous) return seedTaskInspectorDraft(task);
  if (previous.sourceKey !== taskEditorSourceKey(task) && !previous.changed) {
    return {
      ...seedTaskInspectorDraft(task),
      subtaskTitle: previous.subtaskTitle,
      dependencyTaskId: previous.dependencyTaskId,
    };
  }
  return previous;
}

export function taskInspectorHasLocalInput(editor: TaskInspectorDraft) {
  return editor.changed || Boolean(editor.subtaskTitle.trim()) || editor.dependencyTaskId !== "none";
}

export function isTaskInspectorDraftStale(editor: TaskInspectorDraft, task: { id: string; version: number }) {
  return editor.changed && editor.sourceKey !== taskEditorSourceKey(task);
}

export function taskInspectorRecurrenceSummary(fields: Record<string, any>) {
  const frequency = fields.recurrenceFrequency;
  if (frequency === "none" || !frequency) return "No repeat";
  const interval = Math.max(1, Number(fields.recurrenceInterval) || 1);
  const unit = frequency === "daily" ? "day" : frequency === "weekly" ? "week" : "month";
  const weekdays = frequency === "weekly" && Array.isArray(fields.recurrenceWeekdays) && fields.recurrenceWeekdays.length
    ? ` on ${fields.recurrenceWeekdays.map((day: number) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).filter(Boolean).join(", ")}`
    : "";
  return `Every ${interval} ${unit}${interval === 1 ? "" : "s"}${weekdays}${fields.recurrenceUntilLocalDate ? ` until ${fields.recurrenceUntilLocalDate}` : ""}`;
}

export function readStoredTaskInspectorDraft(key: string): TaskInspectorDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.sessionStorage.getItem(key);
    if (!saved) return null;
    const value = JSON.parse(saved) as TaskInspectorDraft;
    return value && typeof value.sourceKey === "string" && value.fields && typeof value.fields === "object" && taskInspectorHasLocalInput(value)
      ? { ...value, saving: false, dependencyPending: null, error: null, dependencyError: null }
      : null;
  } catch {
    return null;
  }
}

export function persistTaskInspectorDraft(key: string, editor: TaskInspectorDraft) {
  if (typeof window === "undefined") return false;
  try {
    if (taskInspectorHasLocalInput(editor)) window.sessionStorage.setItem(key, JSON.stringify(editor));
    else window.sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function shouldCloseTaskInspectorAfterSave(savedKey: string | null, activeKey: string | null) {
  return Boolean(savedKey && savedKey === activeKey);
}

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
  draftScopeKey,
  onOpenChange,
  onStartFocus,
  onUpdate,
  onCreateSubtask,
  onAddDependency,
  onRemoveDependency,
}: TaskDetailSheetProps) {
  const [editors, setEditors] = useState<Record<string, TaskInspectorDraft>>({});
  const activeKeyRef = useRef<string | null>(null);
  const editorKey = task ? taskInspectorDraftKey(task, draftScopeKey) : null;
  activeKeyRef.current = editorKey;
  const editor = task && editorKey
    ? resolveTaskInspectorDraft(editors[editorKey] ?? readStoredTaskInspectorDraft(editorKey), task)
    : null;
  const staleDraft = Boolean(task && editor && isTaskInspectorDraftStale(editor, task));

  useEffect(() => {
    activeKeyRef.current = editorKey;
    return () => {
      if (activeKeyRef.current === editorKey) activeKeyRef.current = null;
    };
  }, [editorKey]);

  useEffect(() => {
    if (editorKey && editor) persistTaskInspectorDraft(editorKey, editor);
  }, [editorKey, editor]);

  const updateEditor = (record: any, update: (current: TaskInspectorDraft) => TaskInspectorDraft) => {
    const key = taskInspectorDraftKey(record, draftScopeKey);
    setEditors(current => ({
      ...current,
      [key]: update(resolveTaskInspectorDraft(current[key] ?? readStoredTaskInspectorDraft(key), record)),
    }));
  };

  if (!task) return null;

  const currentEditor = editor ?? seedTaskInspectorDraft(task);
  const draft = currentEditor.fields;
  const subtaskTitle = currentEditor.subtaskTitle;
  const dependencyTaskId = currentEditor.dependencyTaskId;
  const error = currentEditor.error;
  const dependencyError = currentEditor.dependencyError;
  const dependencyPending = currentEditor.dependencyPending;
  const saving = currentEditor.saving;
  const draftChanged = currentEditor.changed;
  const pendingSecondaryInput = Boolean(subtaskTitle.trim() || dependencyTaskId !== "none");

  const childTasks = tasks.filter(candidate => candidate.parentTaskId === task.id);
  const parentTask = tasks.find(candidate => candidate.id === task.parentTaskId);
  const taskDependencies = dependencies.filter(edge => edge.taskId === task.id);
  const dependencyIds = new Set(taskDependencies.map(edge => edge.dependsOnTaskId));
  const firstDependency = taskDependencies.length
    ? tasks.find(candidate => candidate.id === taskDependencies[0].dependsOnTaskId)?.title ?? "Unavailable task"
    : null;
  const dependencySummary = firstDependency
    ? `Depends on ${firstDependency}${taskDependencies.length > 1 ? ` +${taskDependencies.length - 1}` : ""}`
    : "No dependencies";
  const dependencyCandidates = tasks.filter(
    candidate =>
      candidate.id !== task.id &&
      candidate.state !== "archived" &&
      !dependencyIds.has(candidate.id),
  );
  const projectOptions = projects.filter(item => item.state !== "archived" || item.id === draft.projectId);
  const goalOptions = goals.filter(item => item.state !== "archived" || item.id === draft.goalId);
  const setField = (field: string, value: unknown) => {
    updateEditor(task, current => ({ ...current, fields: { ...current.fields, [field]: value }, changed: true, error: null }));
  };
  const discardDraft = () => {
    updateEditor(task, () => seedTaskInspectorDraft(task));
    if (editorKey && typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(editorKey); } catch { /* storage unavailable */ }
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (pendingSecondaryInput) {
      updateEditor(task, current => ({ ...current, error: "Add or clear the pending subtask or dependency before saving. That input is still kept." }));
      return;
    }
    if (staleDraft) {
      updateEditor(task, current => ({ ...current, error: "This task changed while you were editing. Review the latest record before saving; your draft is still kept." }));
      return;
    }
    const title = String(draft.title ?? "").trim();
    if (!title) {
      updateEditor(task, current => ({ ...current, error: "Name this task before saving it." }));
      return;
    }
    const reservationError = validateTimeReservation(
      draft.plannedStartAt || null,
      draft.plannedEndAt || null,
    );
    if (reservationError) {
      updateEditor(task, current => ({ ...current, error: reservationError }));
      return;
    }
    const recurrenceRule = recurrenceRuleFromDraft(task.recurrenceRule, {
      recurrenceFrequency: draft.recurrenceFrequency,
      recurrenceInterval: draft.recurrenceInterval,
      recurrenceWeekdays: draft.recurrenceWeekdays ?? [],
    });
    const savingKey = editorKey;
    updateEditor(task, current => ({ ...current, saving: true, error: null }));
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
      if (savingKey) {
        setEditors(current => {
          const next = { ...current };
          delete next[savingKey];
          return next;
        });
        try { window.sessionStorage.removeItem(savingKey); } catch { /* storage unavailable */ }
      }
      if (shouldCloseTaskInspectorAfterSave(savingKey, activeKeyRef.current)) onOpenChange(false);
    } catch (caught) {
      updateEditor(task, current => ({ ...current, error: caught instanceof Error ? caught.message : "The task could not be saved." }));
    } finally {
      updateEditor(task, current => ({ ...current, saving: false }));
    }
  };

  const addSubtask = async () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    updateEditor(task, current => ({ ...current, saving: true, error: null }));
    try {
      await onCreateSubtask(task, title);
      updateEditor(task, current => ({ ...current, subtaskTitle: "" }));
    } catch (caught) {
      updateEditor(task, current => ({ ...current, error: caught instanceof Error ? caught.message : "The subtask could not be created." }));
    } finally {
      updateEditor(task, current => ({ ...current, saving: false }));
    }
  };
  const addDependency = async () => {
    if (!onAddDependency || dependencyTaskId === "none") return;
    updateEditor(task, current => ({ ...current, dependencyPending: "add", dependencyError: null }));
    const result = await runDependencyAction(
      () => onAddDependency(task, dependencyTaskId),
      () => updateEditor(task, current => ({ ...current, dependencyTaskId: "none" })),
    );
    if (!result.ok) updateEditor(task, current => ({ ...current, dependencyError: result.error }));
    updateEditor(task, current => ({ ...current, dependencyPending: null }));
  };
  const removeDependency = async (dependency: any) => {
    if (!onRemoveDependency) return;
    updateEditor(task, current => ({ ...current, dependencyPending: dependency.id, dependencyError: null }));
    const result = await runDependencyAction(() => onRemoveDependency(dependency));
    if (!result.ok) updateEditor(task, current => ({ ...current, dependencyError: result.error }));
    updateEditor(task, current => ({ ...current, dependencyPending: null }));
  };

  return (
    <PlannerSheet
      open={open}
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      title={task.title}
      description={`${String(draft.state ?? "not_started").replaceAll("_", " ")} · ${draft.scheduledLocalDate ? `Plan for ${draft.scheduledLocalDate}` : "Not planned"}${draft.dueLocalDate ? ` · Deadline ${draft.dueLocalDate}` : ""}`}
      footer={
        <div className="task-detail-footer task-detail-inspector-footer">
          {error ? <p className="task-detail-footer-message is-error" role="alert">{error}</p>
            : draftChanged || pendingSecondaryInput ? <p className="task-detail-footer-message" role="status">Unsaved draft kept in this tab when you close.</p> : null}
          {onStartFocus && task.state !== "completed" && task.state !== "archived" && task.outcome !== "wont_do" ? (
            <Button type="button" variant="outline" onClick={() => {
              if (draftChanged || pendingSecondaryInput) { updateEditor(task, current => ({ ...current, error: "Save or finish this task draft before opening Focus. Your input is still here." })); return; }
              onOpenChange(false);
              onStartFocus(task);
            }} disabled={saving}>Focus on task</Button>
          ) : null}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Close
          </Button>
          <Button type="submit" form={`task-detail-${task.id}`} disabled={saving || staleDraft}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      }
    >
      <form id={`task-detail-${task.id}`} className="task-detail-form task-detail-inspector" onSubmit={save} noValidate>
        {String(task.id).startsWith("offline:") ? (
          <p className="task-detail-state is-pending" role="status">Saved on this device · waiting to sync</p>
        ) : null}
        {conflictCount ? (
          <p className="task-detail-state is-conflict" role="status">{conflictCount} field conflict{conflictCount === 1 ? "" : "s"} retained for review</p>
        ) : null}
        {staleDraft ? <div className="task-detail-stale" role="alert">
          <div><strong>Task changed since this draft began.</strong><p>Your edits are kept, but saving is paused so newer record values are not overwritten.</p></div>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button type="button" variant="outline">Reload latest task</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Discard this unsaved draft?</AlertDialogTitle><AlertDialogDescription>The latest saved task will replace your local edits. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Keep draft</AlertDialogCancel><AlertDialogAction onClick={discardDraft}>Discard draft and reload</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div> : null}
        {!staleDraft && (draftChanged || pendingSecondaryInput) ? <div className="task-detail-draft-controls">
          <span>Unsaved for this task</span>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button type="button" variant="ghost">Discard draft</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Discard unsaved task input?</AlertDialogTitle><AlertDialogDescription>Your task fields and any pending subtask or dependency selection will return to the latest saved record.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Keep draft</AlertDialogCancel><AlertDialogAction onClick={discardDraft}>Discard draft</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div> : null}

        <fieldset className="task-detail-editor-fields" disabled={saving}>

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
          <h3 id="task-detail-links">Connected work</h3>
          <div className="task-detail-grid">
            <label>Project<select value={draft.projectId ?? "none"} onChange={event => setField("projectId", event.target.value)}><option value="none">No project</option>{draft.projectId !== "none" && !projectOptions.some(item => item.id === draft.projectId) ? <option value={draft.projectId}>Linked project unavailable</option> : null}{projectOptions.map(item => <option key={item.id} value={item.id}>{item.title}{item.state === "archived" ? " (archived)" : ""}</option>)}</select></label>
            <label>Goal<select value={draft.goalId ?? "none"} onChange={event => setField("goalId", event.target.value)}><option value="none">No goal</option>{draft.goalId !== "none" && !goalOptions.some(item => item.id === draft.goalId) ? <option value={draft.goalId}>Linked goal unavailable</option> : null}{goalOptions.map(item => <option key={item.id} value={item.id}>{item.title}{item.state === "archived" ? " (archived)" : ""}</option>)}</select></label>
            <label>Category<select value={draft.categoryId ?? "none"} onChange={event => setField("categoryId", event.target.value)}><option value="none">No category</option>{draft.categoryId !== "none" && !categories.some(item => item.id === draft.categoryId) ? <option value={draft.categoryId}>Linked category unavailable</option> : null}{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
        </section>

        <details className="task-detail-more">
          <summary><span>More task options <ChevronDown aria-hidden="true" size={18} /></span><small>{taskInspectorRecurrenceSummary(draft)} · {childTasks.length} subtask{childTasks.length === 1 ? "" : "s"} · {dependencySummary}</small></summary>
          <div className="task-detail-more-content">
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
          <div className="task-detail-inline-create"><Input id={`task-subtask-${task.id}`} value={subtaskTitle} onChange={event => updateEditor(task, current => ({ ...current, subtaskTitle: event.target.value }))} placeholder="Add a concrete subtask" /><Button type="button" variant="outline" onClick={() => void addSubtask()} disabled={saving || !subtaskTitle.trim()}>Add subtask</Button></div>
        </section>

        <section className="task-detail-section" aria-labelledby="task-detail-dependencies">
          <h3 id="task-detail-dependencies">Dependencies</h3>
          {taskDependencies.length ? <ul>{taskDependencies.map(edge => { const dependency = tasks.find(candidate => candidate.id === edge.dependsOnTaskId); return <li key={edge.id}><span>{dependency?.title ?? "Unavailable task"} · {edge.dependencyType}</span>{onRemoveDependency ? <button type="button" disabled={!isOnline || dependencyPending !== null} onClick={() => void removeDependency(edge)}>{dependencyPending === edge.id ? "Removing…" : "Remove"}</button> : null}</li>; })}</ul> : <p>No dependencies recorded.</p>}
          {onAddDependency ? <><Label htmlFor={`task-dependency-${task.id}`}>Task this work depends on</Label><div className="task-detail-inline-create"><select id={`task-dependency-${task.id}`} value={dependencyTaskId} onChange={event => updateEditor(task, current => ({ ...current, dependencyTaskId: event.target.value, dependencyError: null }))}><option value="none">Choose a task</option>{dependencyCandidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.title}</option>)}</select><Button type="button" variant="outline" disabled={!isOnline || dependencyTaskId === "none" || dependencyPending !== null} onClick={() => void addDependency()}>{dependencyPending === "add" ? "Adding…" : "Add dependency"}</Button></div></> : null}
          {!isOnline ? <p>Reconnect to change dependencies. Your task draft remains here.</p> : null}
          {dependencyError ? <p className="form-error" role="alert">{dependencyError} Your selection is still available; review it and retry.</p> : null}
        </section>
        <section className="task-detail-section" aria-labelledby="task-detail-record">
          <h3 id="task-detail-record">Record facts</h3>
          <dl className="task-detail-ledger">
            <div><dt>Parent task</dt><dd>{parentTask?.title ?? "None"}</dd></div>
            <div><dt>Outcome</dt><dd>{task.outcome === "wont_do" ? "Intentional noncompletion" : "None recorded"}</dd></div>
            <div><dt>Version</dt><dd>{task.version}</dd></div>
          </dl>
        </section>
          </div>
        </details>
        </fieldset>
      </form>
    </PlannerSheet>
  );
}
