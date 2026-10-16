// Tasks T2a: Inbox triage (owner decisions Q1/Q2, approved prototype). The Inbox holds undecided work only;
// each card offers one quick decision: Today · This week · Pick date · Project · Someday · Delete, with the
// keys T W D P S ⌫ on a focused card. A decided card collapses out (AnimatePresence height, reduced motion
// honoured by the app-level MotionConfig) and the container shows an Undo toast. Decisions and copy live in
// inboxTriageModel.ts; this file only draws them.
import type { CanonicalTask } from "@shared/canonicalTask";
import type { WhyReason } from "@shared/whyItMatters";
import type { WeekStartsOn } from "@shared/taskWeekBoard";
import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, CalendarRange, Check, Cloud, Feather, Folder, Plus, Sun, Trash2 } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { EXIT } from "@/design/motion";
import { cn } from "@/lib/utils";
import {
  inboxCapturedLabel,
  inboxDayLabel,
  inboxPickDays,
  inboxShortcut,
  inboxWeekDays,
  type InboxDecision,
  type InboxPicker,
} from "./inboxTriageModel";
import { WhyChip } from "./TaskRowPills";
import "./tasks-premium.css";

export const INBOX_TRIAGE_GUIDANCE = "Give each one a home. It leaves the Inbox as soon as it has a day, a project, or Someday.";

export type InboxTriageProps = {
  /** Undecided tasks only (shared `isInboxTask`). */
  tasks: readonly CanonicalTask[];
  today: string;
  timezone: string;
  weekStartsOn?: WeekStartsOn;
  /** Active projects for the Project picker. */
  projects: readonly { id: string; title: string; state?: string | null }[];
  pendingTaskIds?: ReadonlySet<string>;
  /** D4 `topReason(..., "inbox_triage")` for a card, or null. */
  whyFor?: (task: CanonicalTask) => WhyReason | null;
  onDecide: (task: CanonicalTask, decision: InboxDecision) => void | Promise<unknown>;
  onOpenDetail: (task: CanonicalTask, trigger: HTMLElement) => void;
  onCapture: () => void;
};

const EMPTY_SET: ReadonlySet<string> = new Set();

function TriageCard({
  task,
  today,
  timezone,
  weekStartsOn,
  projects,
  pending,
  why,
  picker,
  onPicker,
  onDecide,
  onOpenDetail,
}: {
  task: CanonicalTask;
  today: string;
  timezone: string;
  weekStartsOn?: WeekStartsOn;
  projects: InboxTriageProps["projects"];
  pending: boolean;
  why: WhyReason | null;
  picker: InboxPicker | null;
  onPicker: (picker: InboxPicker | null) => void;
  onDecide: (decision: InboxDecision) => void;
  onOpenDetail: InboxTriageProps["onOpenDetail"];
}) {
  const captured = inboxCapturedLabel(task.createdAt, today, timezone);
  const toggle = (next: InboxPicker) => onPicker(picker === next ? null : next);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape" && picker) {
      event.preventDefault();
      onPicker(null);
      return;
    }
    const shortcut = inboxShortcut(event.key);
    if (!shortcut) return;
    event.preventDefault();
    if ("picker" in shortcut) toggle(shortcut.picker);
    else onDecide({ kind: shortcut.decision });
  };
  const days = picker === "week" ? inboxWeekDays(today, weekStartsOn) : picker === "date" ? inboxPickDays(today) : [];
  const pickerId = `tk-tri-more-${task.id}`;
  return (
    <motion.article
      className={cn("tk-tri", pending && "is-pending")}
      tabIndex={0}
      aria-label={`${task.title}. Choose Today, This week, Pick date, Project, Someday or Delete.`}
      data-task-record-id={task.id}
      onKeyDown={onKeyDown}
      exit={{ opacity: 0, height: 0, marginBottom: 0, transition: EXIT }}
    >
      <div className="tk-tri-top">
        <button type="button" className="tk-tri-title pc-focusable" onClick={event => onOpenDetail(task, event.currentTarget)}>{task.title}</button>
        <div className="tk-tri-meta">
          {captured ? <span className="tk-tri-cap"><Feather size={13} strokeWidth={2} aria-hidden="true" />{captured}</span> : null}
          {why ? <ul className="tk-pills" aria-label="Why it matters"><WhyChip reason={why} /></ul> : null}
        </div>
      </div>
      <div className="tk-tri-acts" role="group" aria-label={`Decide where ${task.title} goes`}>
        <button type="button" className="tk-tri-act is-primary pc-focusable" onClick={() => onDecide({ kind: "today" })}><Sun size={15} strokeWidth={2} aria-hidden="true" />Today<kbd className="tk-kbd" aria-hidden="true">T</kbd></button>
        <button type="button" className={cn("tk-tri-act pc-focusable", picker === "week" && "is-on")} aria-expanded={picker === "week"} aria-controls={pickerId} onClick={() => toggle("week")}><CalendarRange size={15} strokeWidth={2} aria-hidden="true" />This week<kbd className="tk-kbd" aria-hidden="true">W</kbd></button>
        <button type="button" className={cn("tk-tri-act pc-focusable", picker === "date" && "is-on")} aria-expanded={picker === "date"} aria-controls={pickerId} onClick={() => toggle("date")}><CalendarDays size={15} strokeWidth={2} aria-hidden="true" />Pick date<kbd className="tk-kbd" aria-hidden="true">D</kbd></button>
        <button type="button" className={cn("tk-tri-act pc-focusable", picker === "project" && "is-on")} aria-expanded={picker === "project"} aria-controls={pickerId} onClick={() => toggle("project")}><Folder size={15} strokeWidth={2} aria-hidden="true" />Project<kbd className="tk-kbd" aria-hidden="true">P</kbd></button>
        <button type="button" className="tk-tri-act pc-focusable" onClick={() => onDecide({ kind: "someday" })}><Cloud size={15} strokeWidth={2} aria-hidden="true" />Someday<kbd className="tk-kbd" aria-hidden="true">S</kbd></button>
        <button type="button" className="tk-tri-act is-danger pc-focusable" aria-label={`Delete ${task.title}`} title="Delete (restorable from Archive)" onClick={() => onDecide({ kind: "delete" })}><Trash2 size={15} strokeWidth={2} aria-hidden="true" /></button>
      </div>
      {picker ? (
        <div className="tk-tri-more" id={pickerId} role="group" aria-label={picker === "week" ? "Plan for a day this week" : picker === "date" ? "Plan for a date" : "Move to a project"}>
          {picker === "project" ? (
            projects.length ? projects.map(project => (
              <button key={project.id} type="button" className="tk-tri-chip pc-focusable" onClick={() => onDecide({ kind: "project", projectId: project.id, label: project.title })}>
                <Folder size={13} strokeWidth={2} aria-hidden="true" />{project.title}
              </button>
            )) : <p className="tk-tri-none">No projects yet. Create one in Goals &amp; Projects.</p>
          ) : (
            <>
              {days.map(day => (
                <button key={day} type="button" className="tk-tri-chip pc-focusable" onClick={() => onDecide({ kind: "date", localDate: day })}>
                  {inboxDayLabel(day, today)}
                </button>
              ))}
              {picker === "date" ? (
                <label className="tk-tri-chip is-input">
                  <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />
                  <span className="pc-sr-only">Other date</span>
                  <input type="date" min={today} onChange={event => { if (event.target.value) onDecide({ kind: "date", localDate: event.target.value }); }} />
                </label>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </motion.article>
  );
}

export function InboxTriage({ tasks, today, timezone, weekStartsOn, projects, pendingTaskIds = EMPTY_SET, whyFor, onDecide, onOpenDetail, onCapture }: InboxTriageProps) {
  const [picker, setPicker] = useState<{ id: string; kind: InboxPicker } | null>(null);
  const activeProjects = projects.filter(project => project.state !== "archived");
  const decide = (task: CanonicalTask, decision: InboxDecision) => {
    setPicker(null);
    void onDecide(task, decision);
  };

  if (!tasks.length) {
    return (
      <section className="tk-inbox is-clear" aria-labelledby="tk-inbox-heading">
        <div className="tk-inbox-clear">
          <span className="tk-inbox-orb" aria-hidden="true"><Check size={22} strokeWidth={2.5} /></span>
          <h3 id="tk-inbox-heading">Inbox clear</h3>
          <p>Every thought has a home. New captures land here until you give them a day, a project, or Someday.</p>
          <button type="button" className="tk-btn is-ghost pc-focusable" onClick={onCapture}><Plus size={16} strokeWidth={2.5} aria-hidden="true" />Capture something</button>
        </div>
      </section>
    );
  }

  return (
    <section className="tk-inbox" aria-labelledby="tk-inbox-heading">
      <header className="tk-inbox-intro">
        <h3 id="tk-inbox-heading"><span className="tk-inbox-count">{tasks.length}</span> to sort</h3>
        <p>{INBOX_TRIAGE_GUIDANCE}</p>
      </header>
      <div className="tk-tri-list">
        <AnimatePresence initial={false}>
          {tasks.map(task => (
            <TriageCard
              key={task.id}
              task={task}
              today={today}
              timezone={timezone}
              weekStartsOn={weekStartsOn}
              projects={activeProjects}
              pending={pendingTaskIds.has(task.id) || String(task.id).startsWith("offline:")}
              why={whyFor?.(task) ?? null}
              picker={picker?.id === task.id ? picker.kind : null}
              onPicker={kind => setPicker(kind ? { id: task.id, kind } : null)}
              onDecide={decision => decide(task, decision)}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </AnimatePresence>
      </div>
      <p className="tk-inbox-keys" aria-hidden="true">
        <span><kbd className="tk-kbd">T</kbd> Today</span>
        <span><kbd className="tk-kbd">W</kbd> This week</span>
        <span><kbd className="tk-kbd">D</kbd> Pick date</span>
        <span><kbd className="tk-kbd">P</kbd> Project</span>
        <span><kbd className="tk-kbd">S</kbd> Someday</span>
        <span><kbd className="tk-kbd">⌫</kbd> Delete</span>
      </p>
    </section>
  );
}
