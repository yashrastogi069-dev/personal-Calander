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
import { ChipSelect, type ChipSelectOption } from "@/components/premium/ChipSelect";
import { SegmentedTabs } from "@/components/premium/SegmentedTabs";
import { Sheet } from "@/components/premium/Sheet";
import { restorePlannerSheetFocus } from "@/features/shell/PlannerSheet";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Archive,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDashed,
  Clock,
  CloudUpload,
  FileText,
  History,
  Link2,
  ListChecks,
  Lock,
  Play,
  Plus,
  Repeat,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import {
  localDateForReservation,
  taskSchedulingLanguage,
  validateTimeReservation,
} from "@shared/planningLanguage";
import { taskEditorSourceKey } from "@shared/taskEditor";
import { useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { toast } from "sonner";
import type { TaskCardModel } from "./taskCardModel";
import { TaskMetaPills } from "./TaskMetaPills";
import "./tasks-premium.css";
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
  /** Presentation model for the header pills and the Complete guard (spec 5.1). Omit to hide both. */
  cardModel?: TaskCardModel | null;
  /** Shows a Complete button; it obeys `cardModel.completionBlock` and never writes around the R1-R3 guards. */
  onComplete?: (task: any) => void;
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
  cardModel,
  onComplete,
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

  const projectChoices: ChipSelectOption[] = [
    { value: "none", label: "No project" },
    ...(draft.projectId !== "none" && !projectOptions.some(item => item.id === draft.projectId) ? [{ value: String(draft.projectId), label: "Linked project unavailable" }] : []),
    ...projectOptions.map(item => ({ value: item.id as string, label: `${item.title}${item.state === "archived" ? " (archived)" : ""}` })),
  ];
  const goalChoices: ChipSelectOption[] = [
    { value: "none", label: "No goal" },
    ...(draft.goalId !== "none" && !goalOptions.some(item => item.id === draft.goalId) ? [{ value: String(draft.goalId), label: "Linked goal unavailable" }] : []),
    ...goalOptions.map(item => ({ value: item.id as string, label: `${item.title}${item.state === "archived" ? " (archived)" : ""}` })),
  ];
  const categoryChoices: ChipSelectOption[] = [
    { value: "none", label: "No category" },
    ...(draft.categoryId !== "none" && !categories.some(item => item.id === draft.categoryId) ? [{ value: String(draft.categoryId), label: "Linked category unavailable" }] : []),
    ...categories.map(item => ({ value: item.id as string, label: item.name as string })),
  ];
  const dependencyChoices: ChipSelectOption[] = [
    { value: "none", label: "Choose a task" },
    ...dependencyCandidates.map(candidate => ({ value: candidate.id as string, label: candidate.title as string })),
  ];
  const open_ = task.state !== "completed" && task.state !== "archived" && task.outcome !== "wont_do";
  const completeBlocked = cardModel?.completionBlock?.reason ?? null;
  const completeReasonId = `task-complete-reason-${task.id}`;
  const guardDraft = (message: string) => {
    updateEditor(task, current => ({ ...current, error: message }));
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      variant="side"
      title={task.title}
      hideTitle
      description={`${String(draft.state ?? "not_started").replaceAll("_", " ")} · ${draft.scheduledLocalDate ? `Plan for ${draft.scheduledLocalDate}` : "Not planned"}${draft.dueLocalDate ? ` · Deadline ${draft.dueLocalDate}` : ""}`}
      className="tk-d-sheet"
      onOpenAutoFocus={event => {
        // Like the old sheet: land on Close, so opening a task never raises the phone keyboard.
        event.preventDefault();
        document.querySelector<HTMLElement>(".tk-d-sheet .pc-sheet-close")?.focus();
      }}
      onCloseAutoFocus={event => { restorePlannerSheetFocus(event, returnFocusRef.current); }}
    >
      <form id={`task-detail-${task.id}`} className="task-detail-form task-detail-inspector tk-d-form" onSubmit={save} noValidate>
        {String(task.id).startsWith("offline:") ? (
          <p className="task-detail-state is-pending" role="status"><CloudUpload size={15} strokeWidth={2.25} aria-hidden="true" />Saved on this device · waiting to sync</p>
        ) : null}
        {conflictCount ? (
          <p className="task-detail-state is-conflict" role="status"><AlertTriangle size={15} strokeWidth={2.25} aria-hidden="true" />{conflictCount} field conflict{conflictCount === 1 ? "" : "s"} retained for review</p>
        ) : null}
        {staleDraft ? <div className="task-detail-stale" role="alert">
          <div><strong>Task changed since this draft began.</strong><p>Your edits are kept, but saving is paused so newer record values are not overwritten.</p></div>
          <AlertDialog>
            <AlertDialogTrigger asChild><button type="button" className="tk-btn pc-focusable">Reload latest task</button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Discard this unsaved draft?</AlertDialogTitle><AlertDialogDescription>The latest saved task will replace your local edits. This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Keep draft</AlertDialogCancel><AlertDialogAction onClick={discardDraft}>Discard draft and reload</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div> : null}
        {!staleDraft && (draftChanged || pendingSecondaryInput) ? <div className="task-detail-draft-controls">
          <span>Unsaved for this task</span>
          <AlertDialog>
            <AlertDialogTrigger asChild><button type="button" className="tk-btn is-quiet pc-focusable">Discard draft</button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Discard unsaved task input?</AlertDialogTitle><AlertDialogDescription>Your task fields and any pending subtask or dependency selection will return to the latest saved record.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Keep draft</AlertDialogCancel><AlertDialogAction onClick={discardDraft}>Discard draft</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div> : null}

        <fieldset className="task-detail-editor-fields tk-d-fields" disabled={saving}>
          <header className="tk-d-head">
            <div className="tk-d-head-row">
              <ChipSelect
                label="Status"
                options={STATE_OPTIONS}
                value={String(draft.state ?? "not_started")}
                onValueChange={value => setField("state", value)}
              />
              {cardModel ? <TaskMetaPills model={cardModel} className="tk-d-pills" omit={["state", "pending", "conflict"]} /> : null}
            </div>
            <textarea
              className="tk-d-title"
              aria-label="Task title"
              rows={2}
              value={draft.title ?? ""}
              placeholder="Name this task"
              onChange={event => setField("title", event.target.value.replace(/\s*\n+\s*/g, " "))}
              onKeyDown={event => { if (event.key === "Enter") event.preventDefault(); }}
            />
          </header>

          <Section id="task-detail-core" icon={FileText} tone="pc-tone-accent" title="Details">
            <Field label="Description" htmlFor={`task-description-${task.id}`}>
              <textarea id={`task-description-${task.id}`} className="tk-d-input tk-d-textarea" value={draft.description ?? ""} onChange={event => setField("description", event.target.value)} maxLength={10000} placeholder="What does done look like?" />
            </Field>
            <div className="tk-d-grid">
              <Field label="Project" htmlFor={`task-project-${task.id}`}>
                <ChipSelect id={`task-project-${task.id}`} variant="field" label="Project" options={projectChoices} value={String(draft.projectId ?? "none")} onValueChange={value => setField("projectId", value)} />
              </Field>
              <Field label="Category" htmlFor={`task-category-${task.id}`}>
                <ChipSelect id={`task-category-${task.id}`} variant="field" label="Category" options={categoryChoices} value={String(draft.categoryId ?? "none")} onValueChange={value => setField("categoryId", value)} />
              </Field>
            </div>
          </Section>

          <Section id="task-detail-time" icon={CalendarClock} tone="pc-tone-work" title="Plan">
            <div className="tk-d-grid">
              <Field label={taskSchedulingLanguage.deadline.label} htmlFor={`task-deadline-${task.id}`}>
                <input id={`task-deadline-${task.id}`} className="tk-d-input" type="date" value={draft.dueLocalDate ?? ""} onChange={event => setField("dueLocalDate", event.target.value)} />
              </Field>
              <Field label={taskSchedulingLanguage.planFor.label} htmlFor={`task-planfor-${task.id}`}>
                <input id={`task-planfor-${task.id}`} className="tk-d-input" type="date" value={draft.scheduledLocalDate ?? ""} onChange={event => setField("scheduledLocalDate", event.target.value)} />
              </Field>
              <Field label={taskSchedulingLanguage.focusTime.label} htmlFor={`task-estimate-${task.id}`}>
                <input id={`task-estimate-${task.id}`} className="tk-d-input" type="number" inputMode="numeric" min="0" max="1440" value={draft.estimateMinutes ?? ""} onChange={event => setField("estimateMinutes", event.target.value)} />
              </Field>
            </div>
          </Section>

          <Section id="task-detail-reservation" icon={Clock} tone="pc-tone-health" title="Reserved time">
            <div className="tk-d-grid">
              <Field label="Reserved start" htmlFor={`task-reserve-start-${task.id}`}>
                <input id={`task-reserve-start-${task.id}`} className="tk-d-input" type="datetime-local" value={draft.plannedStartAt ?? ""} onChange={event => setField("plannedStartAt", event.target.value)} />
              </Field>
              <Field label="Reserved end" htmlFor={`task-reserve-end-${task.id}`}>
                <input id={`task-reserve-end-${task.id}`} className="tk-d-input" type="datetime-local" value={draft.plannedEndAt ?? ""} onChange={event => setField("plannedEndAt", event.target.value)} />
              </Field>
            </div>
          </Section>

          <Section id="task-detail-repeat" icon={Repeat} tone="pc-tone-personal" title="Recurrence">
            <SegmentedTabs
              label="Repeats"
              value={String(draft.recurrenceFrequency ?? "none")}
              onValueChange={value => setField("recurrenceFrequency", value)}
              items={[{ value: "none", label: "Never" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]}
              className="tk-d-seg"
            />
            {draft.recurrenceFrequency !== "none" ? (
              <div className="tk-d-grid">
                <Field label="Every" htmlFor={`task-interval-${task.id}`}>
                  <input id={`task-interval-${task.id}`} className="tk-d-input" type="number" inputMode="numeric" min="1" max="365" value={draft.recurrenceInterval ?? "1"} onChange={event => setField("recurrenceInterval", event.target.value)} />
                </Field>
                <Field label="Stop after" htmlFor={`task-until-${task.id}`}>
                  <input id={`task-until-${task.id}`} className="tk-d-input" type="date" value={draft.recurrenceUntilLocalDate ?? ""} onChange={event => setField("recurrenceUntilLocalDate", event.target.value)} />
                </Field>
              </div>
            ) : null}
            {draft.recurrenceFrequency === "weekly" ? (
              <fieldset className="task-recurrence-weekdays">
                <legend>Repeat on</legend>
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((label, weekday) => (
                  <label key={label}>
                    <input type="checkbox" checked={(draft.recurrenceWeekdays ?? []).includes(weekday)} onChange={event => setField("recurrenceWeekdays", event.target.checked ? [...(draft.recurrenceWeekdays ?? []), weekday] : (draft.recurrenceWeekdays ?? []).filter((value: number) => value !== weekday))} />
                    <span aria-hidden="true">{label.slice(0, 3)}</span>
                    <span className="pc-sr-only">{label}</span>
                  </label>
                ))}
              </fieldset>
            ) : null}
            <p className="tk-d-hint">{taskInspectorRecurrenceSummary(draft)}. Occurrence decisions remain in occurrence history; editing this form does not rewrite past occurrences.</p>
          </Section>

          <Section id="task-detail-subtasks" icon={ListChecks} tone="pc-tone-learning" title="Subtasks" count={childTasks.length}>
            {childTasks.length ? (
              <ul className="tk-d-list">{childTasks.map(child => <li key={child.id}><span className="tk-d-list-text">{child.title}</span><span className="tk-d-list-meta">{String(child.state).replaceAll("_", " ")}</span></li>)}</ul>
            ) : <p className="tk-d-hint">No subtasks yet.</p>}
            <label className="tk-d-label" htmlFor={`task-subtask-${task.id}`}>New subtask</label>
            <div className="tk-d-inline">
              <input id={`task-subtask-${task.id}`} className="tk-d-input" value={subtaskTitle} onChange={event => updateEditor(task, current => ({ ...current, subtaskTitle: event.target.value }))} placeholder="Add a concrete subtask" />
              <button type="button" className="tk-btn pc-focusable" onClick={() => void addSubtask()} disabled={saving || !subtaskTitle.trim()}><Plus size={16} strokeWidth={2.25} aria-hidden="true" />Add subtask</button>
            </div>
          </Section>

          <Section id="task-detail-links" icon={Link2} tone="pc-tone-social" title="Linked work">
            <Field label="Goal" htmlFor={`task-goal-${task.id}`}>
              <ChipSelect id={`task-goal-${task.id}`} variant="field" label="Goal" options={goalChoices} value={String(draft.goalId ?? "none")} onValueChange={value => setField("goalId", value)} />
            </Field>
          </Section>

          <Section id="task-detail-dependencies" icon={Lock} tone="pc-tone-neutral" title="Dependencies" count={taskDependencies.length}>
            {taskDependencies.length ? (
              <ul className="tk-d-list">{taskDependencies.map(edge => {
                const dependency = tasks.find(candidate => candidate.id === edge.dependsOnTaskId);
                return (
                  <li key={edge.id}>
                    <span className="tk-d-list-text">{dependency?.title ?? "Unavailable task"}<span className="tk-d-list-meta"> · {edge.dependencyType}</span></span>
                    {onRemoveDependency ? <button type="button" className="tk-btn is-quiet pc-focusable" disabled={!isOnline || dependencyPending !== null} onClick={() => void removeDependency(edge)}>{dependencyPending === edge.id ? "Removing…" : "Remove"}</button> : null}
                  </li>
                );
              })}</ul>
            ) : <p className="tk-d-hint">No dependencies recorded. {dependencySummary}.</p>}
            {onAddDependency ? (
              <>
                <label className="tk-d-label" htmlFor={`task-dependency-${task.id}`}>Task this work depends on</label>
                <div className="tk-d-inline">
                  <ChipSelect id={`task-dependency-${task.id}`} variant="field" label="Task this work depends on" options={dependencyChoices} value={dependencyTaskId} onValueChange={value => updateEditor(task, current => ({ ...current, dependencyTaskId: value, dependencyError: null }))} />
                  <button type="button" className="tk-btn pc-focusable" disabled={!isOnline || dependencyTaskId === "none" || dependencyPending !== null} onClick={() => void addDependency()}><Plus size={16} strokeWidth={2.25} aria-hidden="true" />{dependencyPending === "add" ? "Adding…" : "Add dependency"}</button>
                </div>
              </>
            ) : null}
            {!isOnline ? <p className="tk-d-hint">Reconnect to change dependencies. Your task draft remains here.</p> : null}
            {dependencyError ? <p className="form-error tk-d-error" role="alert">{dependencyError} Your selection is still available; review it and retry.</p> : null}
          </Section>

          <Section id="task-detail-properties" icon={SlidersHorizontal} tone="pc-tone-work" title="Planning properties">
            <div className="tk-d-grid">
              <Field label="Priority" htmlFor={`task-priority-${task.id}`}>
                <ChipSelect id={`task-priority-${task.id}`} variant="field" label="Priority" options={PRIORITY_OPTIONS} value={String(draft.priority ?? "medium")} onValueChange={value => setField("priority", value)} />
              </Field>
              <Field label="Horizon" htmlFor={`task-horizon-${task.id}`}>
                <ChipSelect id={`task-horizon-${task.id}`} variant="field" label="Horizon" options={HORIZON_OPTIONS} value={String(draft.horizon ?? "weekly")} onValueChange={value => setField("horizon", value)} />
              </Field>
              <Field label="Scheduling mode" htmlFor={`task-mode-${task.id}`}>
                <ChipSelect id={`task-mode-${task.id}`} variant="field" label="Scheduling mode" options={MODE_OPTIONS} value={String(draft.scheduleMode ?? "manual")} onValueChange={value => setField("scheduleMode", value)} />
              </Field>
              <div className="task-detail-fact"><span>Order</span><strong>{task.sortOrder ?? 0}</strong></div>
            </div>
          </Section>

          <details className="tk-d-facts">
            <summary><span className="pc-icon-tile pc-tone-neutral" aria-hidden="true"><History size={16} strokeWidth={2} /></span>Record facts<ChevronDown aria-hidden="true" size={16} className="tk-d-facts-caret" /></summary>
            <dl className="task-detail-ledger">
              <div><dt>Parent task</dt><dd>{parentTask?.title ?? "None"}</dd></div>
              <div><dt>Outcome</dt><dd>{task.outcome === "wont_do" ? "Intentional noncompletion" : "None recorded"}</dd></div>
              <div><dt>Version</dt><dd>{task.version}</dd></div>
            </dl>
          </details>
        </fieldset>
      </form>

      <div className="tk-d-footer task-detail-footer task-detail-inspector-footer">
        {error ? <p className="task-detail-footer-message is-error" role="alert">{error}</p>
          : draftChanged || pendingSecondaryInput ? <p className="task-detail-footer-message" role="status">Unsaved draft kept in this tab when you close.</p> : null}
        {onComplete && cardModel && open_ && completeBlocked ? <p className="task-detail-footer-message" id={completeReasonId}>{completeBlocked}</p> : null}
        <div className="tk-d-actions">
          <button type="button" className="tk-btn is-quiet pc-focusable" onClick={() => onOpenChange(false)} disabled={saving}>Close</button>
          {onStartFocus && open_ ? (
            <button type="button" className="tk-btn pc-focusable" disabled={saving} onClick={() => {
              if (draftChanged || pendingSecondaryInput) { guardDraft("Save or finish this task draft before opening Focus. Your input is still here."); return; }
              onOpenChange(false);
              onStartFocus(task);
            }}><Play size={15} strokeWidth={2.25} aria-hidden="true" />Focus on task</button>
          ) : null}
          {onComplete && cardModel && open_ ? (
            <button
              type="button"
              className="tk-btn pc-focusable"
              disabled={saving}
              aria-disabled={completeBlocked ? true : undefined}
              aria-describedby={completeBlocked ? completeReasonId : undefined}
              onClick={() => {
                if (completeBlocked) return;
                if (draftChanged || pendingSecondaryInput) { guardDraft("Save or finish this task draft before completing it. Your input is still here."); return; }
                onComplete(task);
              }}
            ><CheckCircle2 size={16} strokeWidth={2.25} aria-hidden="true" />Complete</button>
          ) : null}
          <button type="submit" form={`task-detail-${task.id}`} className="tk-btn is-accent pc-focusable" disabled={saving || staleDraft}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

const STATE_OPTIONS: ChipSelectOption[] = [
  { value: "not_started", label: "To do", icon: Circle },
  { value: "in_progress", label: "In progress", icon: CircleDashed },
  { value: "blocked", label: "Blocked", icon: Ban },
  { value: "completed", label: "Completed", icon: CheckCircle2 },
  { value: "archived", label: "Archived", icon: Archive },
];
const PRIORITY_OPTIONS: ChipSelectOption[] = [
  { value: "none", label: "No priority" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];
const HORIZON_OPTIONS: ChipSelectOption[] = ["daily", "weekly", "monthly", "quarterly", "yearly", "someday"].map(value => ({ value, label: value[0].toUpperCase() + value.slice(1) }));
const MODE_OPTIONS: ChipSelectOption[] = [
  { value: "manual", label: "Manual" },
  { value: "flexible", label: "Flexible" },
  { value: "pinned", label: "Pinned" },
];

function Section({ id, icon: Icon, tone, title, count, children }: { id: string; icon: LucideIcon; tone: string; title: string; count?: number; children: ReactNode }) {
  return (
    <section className="tk-d-section" aria-labelledby={id}>
      <h3 id={id} className="tk-d-h">
        <span className={cn("pc-icon-tile", tone)} aria-hidden="true"><Icon size={16} strokeWidth={2} /></span>
        {title}
        {count != null ? <span className="tk-d-count">{count}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="tk-d-field">
      <label className="tk-d-label" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
