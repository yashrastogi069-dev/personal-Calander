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
import { Sheet, type SheetMorphOrigin } from "@/components/premium/Sheet";
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
  Loader2,
  Lock,
  Play,
  Plus,
  Repeat,
  SlidersHorizontal,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { WhyDetailSection } from "@shared/whyItMatters";
import { formatMinutes } from "@/design/timeFormat";
import { CheckButton } from "./CheckButton";
import { WHY_ICONS } from "./TaskRowPills";
import {
  localDateForReservation,
  taskSchedulingLanguage,
  validateTimeReservation,
} from "@shared/planningLanguage";
import { taskEditorSourceKey } from "@shared/taskEditor";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode, type RefObject } from "react";
import { toast } from "sonner";
import type { TaskCardModel } from "./taskCardModel";
import { TaskMetaPills } from "./TaskMetaPills";
import "./tasks-premium.css";
import "./tasks-t2b2.css";
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
  /** The row the pane grows from (T2b-2 detail morph). Null opens with the plain slide. */
  morphFrom?: SheetMorphOrigin | null;
  /** D4 "Why it matters" for the `task_detail` surface (whyDetailSection); the block shows up to 2 lines. */
  why?: WhyDetailSection | null;
};

/** The autosave state shown at the top of the pane (prototype: "Saving" then "Saved"). */
export type TaskDetailSaveState = "idle" | "pending" | "saving" | "saved" | "queued" | "error";

export function taskDetailSaveLabel(state: TaskDetailSaveState): string | null {
  if (state === "pending" || state === "saving") return "Saving";
  if (state === "saved") return "Saved";
  if (state === "queued") return "Saved on this device";
  if (state === "error") return "Not saved";
  return null;
}

/** Autosave waits this long after the last edit, so typing a title is one write, not one per key. */
export const TASK_DETAIL_AUTOSAVE_MS = 700;

/** The Why block: up to 2 reason lines (prototype), or the Q43 empty line with "Link to a goal". */
export function taskDetailWhyLines(section: WhyDetailSection | null | undefined) {
  if (!section || section.kind === "hidden") return null;
  if (section.kind === "empty") return { kind: "empty" as const, message: section.message };
  return { kind: "reasons" as const, reasons: section.reasons.slice(0, 2) };
}

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

/** The `planner.task.update` patch for a draft (every editable field), as the old Save button sent it. */
export function taskPatchFromDraft(draft: Record<string, any>, task: { recurrenceRule?: unknown }) {
  const recurrenceRule = recurrenceRuleFromDraft(task.recurrenceRule as Record<string, unknown> | null, {
    recurrenceFrequency: draft.recurrenceFrequency,
    recurrenceInterval: draft.recurrenceInterval,
    recurrenceWeekdays: draft.recurrenceWeekdays ?? [],
  });
  return {
    title: String(draft.title ?? "").trim(),
    description: String(draft.description ?? "").trim() || null,
    state: draft.state,
    priority: draft.priority,
    horizon: draft.horizon,
    categoryId: draft.categoryId === "none" ? null : draft.categoryId,
    goalId: draft.goalId === "none" ? null : draft.goalId,
    projectId: draft.projectId === "none" ? null : draft.projectId,
    dueLocalDate: draft.dueLocalDate || null,
    scheduledLocalDate: localDateForReservation(draft.plannedStartAt) ?? (draft.scheduledLocalDate || null),
    plannedStartAt: draft.plannedStartAt ? new Date(draft.plannedStartAt) : null,
    plannedEndAt: draft.plannedEndAt ? new Date(draft.plannedEndAt) : null,
    estimateMinutes: draft.estimateMinutes ? Number(draft.estimateMinutes) : null,
    scheduleMode: draft.scheduleMode,
    recurrenceRule,
    recurrenceAnchor: recurrenceRule ? "scheduled" : null,
    recurrenceUntilLocalDate: recurrenceRule ? draft.recurrenceUntilLocalDate || null : null,
  } as Record<string, unknown>;
}

function comparable(value: unknown) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (value === undefined) return null;
  return JSON.stringify(value);
}

/**
 * Autosave sends only the fields this draft changed against the saved record (the record re-seeded through
 * the same draft maths), so an edit never rewrites a field it did not touch.
 */
export function changedTaskPatch(draft: Record<string, any>, task: any) {
  const next = taskPatchFromDraft(draft, task);
  const saved = taskPatchFromDraft(seedTaskInspectorDraft(task).fields, task);
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(next)) {
    if (comparable(next[key]) !== comparable(saved[key])) patch[key] = next[key];
  }
  return patch;
}

export type TaskAutosaveDecision =
  | { kind: "none" }
  | { kind: "stale" }
  | { kind: "invalid"; message: string }
  | { kind: "save"; patch: Record<string, unknown> };

/** What an autosave tick does with the current draft. A stale or invalid draft never writes. */
export function taskAutosaveDecision(editor: TaskInspectorDraft, task: any): TaskAutosaveDecision {
  if (!editor.changed) return { kind: "none" };
  if (isTaskInspectorDraftStale(editor, task)) return { kind: "stale" };
  const draft = editor.fields;
  if (!String(draft.title ?? "").trim()) return { kind: "invalid", message: "Name this task to save it. Your other edits are kept." };
  const reservationError = validateTimeReservation(draft.plannedStartAt || null, draft.plannedEndAt || null);
  if (reservationError) return { kind: "invalid", message: reservationError };
  const patch = changedTaskPatch(draft, task);
  if (!Object.keys(patch).length) return { kind: "none" };
  return { kind: "save", patch };
}

function sameFields(left: Record<string, any>, right: Record<string, any>) {
  return JSON.stringify(left) === JSON.stringify(right);
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
  morphFrom = null,
  why = null,
}: TaskDetailSheetProps) {
  const [editors, setEditors] = useState<Record<string, TaskInspectorDraft>>({});
  const [saveStates, setSaveStates] = useState<Record<string, TaskDetailSaveState>>({});
  const editorsRef = useRef(editors);
  editorsRef.current = editors;
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const autosaveTimer = useRef<{ key: string; task: any; timer: ReturnType<typeof setTimeout> } | null>(null);
  const inFlight = useRef<Set<string>>(new Set());
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

  const setSaveState = useCallback((key: string, state: TaskDetailSaveState) => {
    setSaveStates(current => (current[key] === state ? current : { ...current, [key]: state }));
  }, []);

  /** One autosave tick for a task: reads the newest draft and record, writes the changed fields once. */
  const runAutosave = useCallback(async (key: string, fallbackTask: any): Promise<void> => {
    if (inFlight.current.has(key)) {
      // A write for this task is still out; try again once it settles so the draft never races itself.
      autosaveTimer.current = { key, task: fallbackTask, timer: setTimeout(() => { autosaveTimer.current = null; void runAutosave(key, fallbackTask); }, TASK_DETAIL_AUTOSAVE_MS) };
      return;
    }
    const record = tasksRef.current.find(candidate => candidate.id === fallbackTask.id) ?? fallbackTask;
    const current = resolveTaskInspectorDraft(editorsRef.current[key] ?? readStoredTaskInspectorDraft(key), record);
    const decision = taskAutosaveDecision(current, record);
    if (decision.kind === "none") {
      setSaveState(key, "idle");
      return;
    }
    if (decision.kind === "stale") {
      setSaveState(key, "error");
      return;
    }
    if (decision.kind === "invalid") {
      setEditors(all => ({ ...all, [key]: { ...current, error: decision.message } }));
      setSaveState(key, "error");
      return;
    }
    const sent = current.fields;
    inFlight.current.add(key);
    setSaveState(key, "saving");
    try {
      const result = await onUpdateRef.current(record, decision.patch);
      inFlight.current.delete(key);
      const fresh = { ...record, ...(result?.record ?? {}) };
      setEditors(all => {
        const latest = all[key] ?? current;
        if (sameFields(latest.fields, sent)) {
          const next = { ...all };
          delete next[key];
          try { window.sessionStorage.removeItem(key); } catch { /* storage unavailable */ }
          return next;
        }
        // Edited again while saving: keep the newer draft against the fresh record version.
        return { ...all, [key]: { ...latest, sourceKey: taskEditorSourceKey(fresh as any), error: null } };
      });
      setSaveState(key, result?.queued ? "queued" : "saved");
    } catch (caught) {
      inFlight.current.delete(key);
      setEditors(all => ({ ...all, [key]: { ...(all[key] ?? current), error: caught instanceof Error ? caught.message : "The task could not be saved. Your edits are kept." } }));
      setSaveState(key, "error");
    }
  }, [setSaveState]);

  const flushAutosave = useCallback(async () => {
    const pending = autosaveTimer.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    autosaveTimer.current = null;
    await runAutosave(pending.key, pending.task);
  }, [runAutosave]);

  function scheduleAutosave(record: any) {
    const key = taskInspectorDraftKey(record, draftScopeKey);
    const pending = autosaveTimer.current;
    if (pending) {
      clearTimeout(pending.timer);
      // Switching tasks mid-edit saves the previous task first.
      if (pending.key !== key) void runAutosave(pending.key, pending.task);
    }
    setSaveState(key, "pending");
    autosaveTimer.current = {
      key,
      task: record,
      timer: setTimeout(() => { autosaveTimer.current = null; void runAutosave(key, record); }, TASK_DETAIL_AUTOSAVE_MS),
    };
  }

  // Closing the pane (or unmounting) saves what is waiting instead of dropping it.
  useEffect(() => {
    if (!open) void flushAutosave();
  }, [open, flushAutosave]);
  useEffect(() => () => {
    const pending = autosaveTimer.current;
    if (pending) {
      clearTimeout(pending.timer);
      autosaveTimer.current = null;
      void runAutosave(pending.key, pending.task);
    }
  }, [runAutosave]);

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
    scheduleAutosave(task);
  };
  const discardDraft = () => {
    updateEditor(task, () => seedTaskInspectorDraft(task));
    if (editorKey && typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(editorKey); } catch { /* storage unavailable */ }
    }
  };

  /** Enter in a field (form submit) saves now instead of waiting for the autosave tick. */
  const save = (event: FormEvent) => {
    event.preventDefault();
    if (staleDraft) {
      updateEditor(task, current => ({ ...current, error: "This task changed while you were editing. Review the latest record; your draft is still kept." }));
      return;
    }
    void flushAutosave();
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
  const savedState: TaskDetailSaveState = (editorKey ? saveStates[editorKey] : undefined) ?? (draftChanged ? "pending" : "idle");
  const shownState = staleDraft ? "paused" : error && savedState !== "saving" ? "error" : savedState;
  const saveLabel = shownState === "paused" ? "Paused" : taskDetailSaveLabel(shownState);
  const whyLines = taskDetailWhyLines(why);
  const estimateMinutes = Number(draft.estimateMinutes) > 0 ? Number(draft.estimateMinutes) : null;
  const canCheck = Boolean(onComplete && cardModel && task.state !== "archived");

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      variant="side"
      title={task.title}
      hideTitle
      description={cardModel
        // The state pill and date pills replace the visible line (D3 §4.7); screen readers still get it, with the
        // recurring fix (§7) applied, so a series never reads as "Plan for {anchor}".
        ? <span className="pc-sr-only">{[String(draft.state ?? "not_started").replaceAll("_", " "), ...(cardModel.dates.length ? cardModel.dates.map(pill => pill.accessibleLabel ?? pill.label) : ["Not planned"])].join(" · ")}</span>
        : `${String(draft.state ?? "not_started").replaceAll("_", " ")} · ${draft.scheduledLocalDate ? `Plan for ${draft.scheduledLocalDate}` : "Not planned"}${draft.dueLocalDate ? ` · Deadline ${draft.dueLocalDate}` : ""}`}
      className="tk-d-sheet"
      morphFrom={morphFrom}
      onOpenAutoFocus={event => {
        // Like the old sheet: land on Close, so opening a task never raises the phone keyboard.
        event.preventDefault();
        document.querySelector<HTMLElement>(".tk-d-sheet .pc-sheet-close")?.focus();
      }}
      onCloseAutoFocus={event => { restorePlannerSheetFocus(event, returnFocusRef.current); }}
    >
      <p className={cn("tk-d-saved", `is-${shownState}`)} aria-live="polite" data-save-state={shownState}>
        {saveLabel ? (
          <>
            {shownState === "saving" || shownState === "pending" ? <Loader2 size={14} strokeWidth={2.25} aria-hidden="true" className="tk-d-spin" />
              : shownState === "saved" || shownState === "queued" ? <CheckCircle2 size={14} strokeWidth={2.25} aria-hidden="true" />
                : <AlertTriangle size={14} strokeWidth={2.25} aria-hidden="true" />}
            <span>{saveLabel}{shownState === "saved" ? " \u2713" : ""}</span>
          </>
        ) : <span className="tk-d-saved-idle">Changes save as you go</span>}
      </p>
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
        {!staleDraft && ((draftChanged && error) || pendingSecondaryInput) ? <div className="task-detail-draft-controls">
          <span>{draftChanged && error ? "Edits kept on this device until they save" : "Pending input for this task"}</span>
          <AlertDialog>
            <AlertDialogTrigger asChild><button type="button" className="tk-btn is-quiet pc-focusable">Discard draft</button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Discard unsaved task input?</AlertDialogTitle><AlertDialogDescription>Your task fields and any pending subtask or dependency selection will return to the latest saved record.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Keep draft</AlertDialogCancel><AlertDialogAction onClick={discardDraft}>Discard draft</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div> : null}

        <fieldset className="task-detail-editor-fields tk-d-fields">
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
            <div className="tk-d-title-row">
            {canCheck && cardModel ? (
              <CheckButton
                title={task.title}
                checked={cardModel.check.checked}
                tone={cardModel.tone}
                blockedReason={completeBlocked}
                inert={cardModel.check.action.kind === "none" && !completeBlocked}
                className="tk-d-check"
                onToggle={() => {
                  if (staleDraft) { guardDraft("Review the newer record before completing this task. Your input is still here."); return; }
                  void flushAutosave().then(() => onComplete?.(task));
                }}
                onBlockedPress={() => guardDraft(completeBlocked ?? "This task can't be completed here.")}
              />
            ) : null}
            <textarea
              className="tk-d-title"
              aria-label="Task title"
              rows={2}
              value={draft.title ?? ""}
              placeholder="Name this task"
              onChange={event => setField("title", event.target.value.replace(/\s*\n+\s*/g, " "))}
              onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void flushAutosave(); } }}
            />
            </div>
          </header>

          {whyLines ? (
            <section className="tk-d-why" aria-labelledby={`task-why-${task.id}`}>
              <h3 id={`task-why-${task.id}`} className="tk-d-why-h">Why it matters</h3>
              {whyLines.kind === "reasons" ? (
                <ul className="tk-d-why-list">
                  {whyLines.reasons.map(reason => {
                    const Icon = WHY_ICONS[reason.icon] ?? Target;
                    return (
                      <li key={reason.kind} className={cn("tk-d-why-line", `is-${reason.tone}`)} title={reason.accessible}>
                        <Icon size={15} strokeWidth={2} aria-hidden="true" />
                        <span>{reason.long}</span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="tk-d-why-line is-empty">
                  <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
                  <span>{whyLines.message}</span>
                  <button type="button" className="tk-link-btn pc-focusable" onClick={() => document.getElementById(`task-goal-${task.id}`)?.focus()}>Link to a goal</button>
                </p>
              )}
            </section>
          ) : null}

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
        {error ? <p className="task-detail-footer-message is-error" role="alert">{error}</p> : null}
        {canCheck && open_ && completeBlocked ? <p className="task-detail-footer-message" id={completeReasonId}>{completeBlocked}</p> : null}
        <div className="tk-d-actions">
          {estimateMinutes ? <span className="tk-d-est">{formatMinutes(estimateMinutes)} planned</span> : null}
          {onStartFocus && open_ ? (
            <button type="button" className="tk-btn is-accent tk-d-focus pc-focusable" onClick={() => {
              if (staleDraft || pendingSecondaryInput) { guardDraft("Finish or clear this task's pending input before opening Focus. Your input is still here."); return; }
              void flushAutosave().then(() => {
                onOpenChange(false);
                onStartFocus(task);
              });
            }}><Play size={15} strokeWidth={2.25} aria-hidden="true" />Start focus</button>
          ) : null}
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
