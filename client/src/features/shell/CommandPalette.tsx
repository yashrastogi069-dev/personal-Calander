import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Moon, Plus, Search, Timer } from "lucide-react";
import type { GlobalPlannerAction, PlannerLocationTarget } from "@shared/phase4Navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { premiumNavIcons } from "./PlannerRail";
import { allPremiumNavItems } from "./premiumNavigation";

export type PaletteTask = { id: string; title: string; state: string };

/** ">" limits the palette to actions, "#" to tasks; anything else searches everything. */
export function paletteMode(query: string): { mode: "all" | "actions" | "tasks"; term: string } {
  const trimmed = query.trimStart();
  if (trimmed.startsWith(">")) return { mode: "actions", term: trimmed.slice(1).trim() };
  if (trimmed.startsWith("#")) return { mode: "tasks", term: trimmed.slice(1).trim() };
  return { mode: "all", term: trimmed.trim() };
}

export function matchPaletteTasks(tasks: readonly PaletteTask[], term: string, limit = 6): PaletteTask[] {
  const needle = term.toLowerCase();
  const open = tasks.filter(task => task.state !== "archived" && task.state !== "completed");
  if (!needle) return open.slice(0, limit);
  return open.filter(task => task.title.toLowerCase().includes(needle)).slice(0, limit);
}

/** Global ⌘K / Ctrl+K listener. Works from inputs too, like most palettes. */
export function useCommandPaletteShortcut(onOpen: () => void) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onOpen]);
}

export function CommandPalette({
  open,
  onOpenChange,
  tasks,
  onNavigate,
  onAction,
  onOpenTask,
  onSearch,
  onToggleTheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: readonly PaletteTask[];
  onNavigate: (target: PlannerLocationTarget) => void;
  onAction: (action: GlobalPlannerAction) => void;
  onOpenTask: (taskId: string) => void;
  onSearch: (query: string) => void;
  onToggleTheme?: () => void;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  const { mode, term } = paletteMode(query);
  const matchedTasks = useMemo(() => (mode === "actions" ? [] : matchPaletteTasks(tasks, term)), [mode, tasks, term]);
  const run = (callback: () => void) => {
    onOpenChange(false);
    callback();
  };
  const showPages = mode === "all";
  const showActions = mode !== "tasks";
  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search or jump"
      description="Jump to a page, run an action, or find a task. Type > for actions or # for tasks."
      className="pc-palette"
    >
      {/* cmdk filters by the visible text; prefixes are stripped so "#report" still matches "Report". */}
      <CommandInput placeholder="Search or jump…  (> actions, # tasks)" value={query} onValueChange={setQuery} />
      <CommandList>
        <CommandEmpty>Nothing matches. Press Enter on “Search everything” to search all records.</CommandEmpty>
        {showActions ? (
          <CommandGroup heading="Actions">
            <CommandItem value="> capture new task add" onSelect={() => run(() => onAction("capture"))}>
              <Plus aria-hidden="true" />
              Capture a task
            </CommandItem>
            <CommandItem value="> start focus session timer" onSelect={() => run(() => onAction("focus"))}>
              <Timer aria-hidden="true" />
              Start Focus
            </CommandItem>
            {onToggleTheme ? (
              <CommandItem value="> toggle dark light theme appearance" onSelect={() => run(onToggleTheme)}>
                <Moon aria-hidden="true" />
                Switch light or dark theme
              </CommandItem>
            ) : null}
          </CommandGroup>
        ) : null}
        {showPages ? (
          <CommandGroup heading="Go to">
            {allPremiumNavItems.map(item => {
              const Icon = premiumNavIcons[item.id] ?? Search;
              return (
                <CommandItem key={item.id} value={`${item.label} ${item.keywords ?? ""}`} onSelect={() => run(() => onNavigate(item.target))}>
                  <Icon aria-hidden="true" />
                  {item.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
        {matchedTasks.length ? (
          <CommandGroup heading="Tasks">
            {matchedTasks.map(task => (
              <CommandItem key={task.id} value={`# ${task.title} task-${task.id}`} onSelect={() => run(() => onOpenTask(task.id))}>
                <CheckSquare aria-hidden="true" />
                <span className="pc-palette-task">{task.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {term ? (
          <CommandGroup heading="Search">
            <CommandItem value={`search everything ${query}`} onSelect={() => run(() => onSearch(term))}>
              <Search aria-hidden="true" />
              Search everything for “{term}”
            </CommandItem>
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
