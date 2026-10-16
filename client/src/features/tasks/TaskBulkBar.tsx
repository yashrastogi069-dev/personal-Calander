// Tasks T2b-2: the floating glass bulk bar (owner decision Q10, prototype "Bulk bar"). It rises when a task is
// selected: count · Plan for… · Move to project · Priority · Archive · exit (Esc). At phone width it sits above
// the bottom nav and shows icons only (labels stay as accessible names). Every choice runs one batch with one
// Undo in the container. Delete is not offered: there is no task delete endpoint (Inbox "Delete" archives too).
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Archive, CalendarDays, CalendarX2, Flag, Folder, FolderInput, FolderX, X, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { RollingCount } from "@/components/premium/FilterChips";
import { SHEET } from "@/design/motion";
import { cn } from "@/lib/utils";
import type { BulkAction } from "./taskBulkSelection";
import { taskPriorities, type TaskPriority } from "./taskWorkspaceModel";

const PRIORITY_LABELS: Record<TaskPriority, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", none: "No priority" };

export type TaskBulkBarProps = {
  count: number;
  planChoices: ReadonlyArray<{ id: string; title: string; label: string; localDate: string }>;
  projects: ReadonlyArray<{ value: string; label: string }>;
  today: string;
  busy?: boolean;
  onAction: (action: BulkAction) => void;
  onExit: () => void;
};

function BarMenu({ icon: Icon, label, children, open, onOpenChange, disabled }: { icon: LucideIcon; label: string; children: ReactNode; open: boolean; onOpenChange: (open: boolean) => void; disabled?: boolean }) {
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" className="tk-bulk-btn pc-focusable" aria-label={label} title={label} disabled={disabled}>
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
          <span className="tk-bulk-label">{label}</span>
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="tk-menu tk-bulk-menu" side="top" align="center" sideOffset={10} collisionPadding={12}>
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

function MenuButton({ icon: Icon, children, onClick }: { icon: LucideIcon; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="tk-menu-item" onClick={onClick}>
      <Icon size={15} strokeWidth={2} aria-hidden="true" />
      <span className="tk-menu-text"><span>{children}</span></span>
    </button>
  );
}

export function TaskBulkBar({ count, planChoices, projects, today, busy = false, onAction, onExit }: TaskBulkBarProps) {
  const reduced = useReducedMotion() ?? false;
  const [menu, setMenu] = useState<"plan" | "project" | "priority" | null>(null);
  const run = (action: BulkAction) => {
    setMenu(null);
    onAction(action);
  };
  const toggle = (name: "plan" | "project" | "priority") => (open: boolean) => setMenu(open ? name : null);
  return (
    <AnimatePresence>
      {count > 0 ? (
        <motion.div
          key="bulk"
          className="tk-bulk"
          role="toolbar"
          aria-label="Bulk actions"
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 48 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 48, transition: { duration: 0.2 } }}
          transition={reduced ? { duration: 0 } : SHEET}
          aria-busy={busy || undefined}
        >
          <span className="tk-bulk-count" aria-live="polite">
            <RollingCount value={count} className="tk-bulk-n" />
            <span className="tk-bulk-label">selected</span>
            <span className="pc-sr-only">{count === 1 ? " task" : " tasks"}</span>
          </span>
          <span className="tk-bulk-vr" aria-hidden="true" />
          <BarMenu icon={CalendarDays} label="Plan for…" open={menu === "plan"} onOpenChange={toggle("plan")} disabled={busy}>
            {planChoices.map(choice => (
              <MenuButton key={choice.id} icon={CalendarDays} onClick={() => run({ kind: "plan", localDate: choice.localDate, label: choice.label })}>{choice.title}</MenuButton>
            ))}
            <label className="tk-menu-item tk-bulk-date">
              <CalendarDays size={15} strokeWidth={2} aria-hidden="true" />
              <span className="tk-menu-text"><span>Pick a date</span></span>
              <input type="date" min={today} aria-label="Plan for a date" onChange={event => { if (event.target.value) run({ kind: "plan", localDate: event.target.value, label: event.target.value }); }} />
            </label>
            <MenuButton icon={CalendarX2} onClick={() => run({ kind: "plan", localDate: null, label: "no day" })}>Unschedule</MenuButton>
          </BarMenu>
          <BarMenu icon={FolderInput} label="Move to project" open={menu === "project"} onOpenChange={toggle("project")} disabled={busy}>
            {projects.length ? projects.map(project => (
              <MenuButton key={project.value} icon={Folder} onClick={() => run({ kind: "project", projectId: project.value, label: project.label })}>{project.label}</MenuButton>
            )) : <p className="tk-bulk-none">No active projects yet.</p>}
            <MenuButton icon={FolderX} onClick={() => run({ kind: "project", projectId: null, label: "No project" })}>No project</MenuButton>
          </BarMenu>
          <BarMenu icon={Flag} label="Priority" open={menu === "priority"} onOpenChange={toggle("priority")} disabled={busy}>
            {taskPriorities.map(priority => (
              <MenuButton key={priority} icon={Flag} onClick={() => run({ kind: "priority", priority, label: PRIORITY_LABELS[priority].toLocaleLowerCase() })}>{PRIORITY_LABELS[priority]}</MenuButton>
            ))}
          </BarMenu>
          <button type="button" className={cn("tk-bulk-btn is-danger pc-focusable")} aria-label="Archive" title="Archive (restorable from Archive)" disabled={busy} onClick={() => run({ kind: "archive" })}>
            <Archive size={16} strokeWidth={2} aria-hidden="true" />
            <span className="tk-bulk-label">Archive</span>
          </button>
          <span className="tk-bulk-vr" aria-hidden="true" />
          <button type="button" className="tk-bulk-btn is-exit pc-focusable" aria-label="Exit selection" title="Exit selection (Esc)" onClick={onExit}>
            <X size={16} strokeWidth={2.25} aria-hidden="true" />
            <kbd className="tk-kbd tk-bulk-label" aria-hidden="true">Esc</kbd>
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
