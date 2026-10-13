// Searchable task combobox for Focus setup (replaces the native select). Desktop: popover with cmdk.
// Phone: the shared bottom sheet with the same list. Today's commitments come first; "No task" last.
import { useId, useMemo, useState } from "react";
import { ChevronDown, Search, Unlink } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet } from "@/components/premium/Sheet";
import { useIsPhone } from "@/components/premium/useMediaQuery";
import { resolveCategoryTones, toneClassName } from "@/design/categoryTone";
import { cn } from "@/lib/utils";
import { formatFocusMinutes, groupFocusTasks } from "./focusDisplay";

export const NO_TASK = "none";

type PickerTask = { id: string; title: string; estimateMinutes?: number | null; categoryId?: string | null; scheduledLocalDate?: string | null; dueLocalDate?: string | null };

function TaskRow({ task, categoryName, toneClass }: { task: PickerTask; categoryName: string | null; toneClass: string | null }) {
  return (
    <span className="pc-focus-picker-row">
      <span className="pc-focus-picker-title">{task.title}</span>
      <span className="pc-focus-picker-meta">
        {categoryName ? (
          <span className={cn("pc-pill pc-pill-tinted", toneClass)}>
            <span className="pc-dot" aria-hidden="true" />
            {categoryName}
          </span>
        ) : null}
        {task.estimateMinutes ? <span className="pc-num">{formatFocusMinutes(task.estimateMinutes)}</span> : null}
      </span>
    </span>
  );
}

export function FocusTaskPicker({
  tasks,
  categories,
  today,
  value,
  onChange,
  disabled,
  labelId,
}: {
  tasks: PickerTask[];
  categories: Array<{ id: string; name: string; color?: string | null }>;
  today: string;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** Visible label element for the combobox. */
  labelId: string;
}) {
  const phone = useIsPhone();
  const [open, setOpen] = useState(false);
  const listId = useId();
  const tones = useMemo(() => resolveCategoryTones(categories as any), [categories]);
  const categoryName = (id?: string | null) => (id ? categories.find(category => category.id === id)?.name ?? null : null);
  const toneFor = (id?: string | null) => (id && tones.get(id) ? toneClassName(tones.get(id)!) : null);
  const grouped = groupFocusTasks(tasks, today);
  const selected = tasks.find(task => task.id === value) ?? null;

  const choose = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const list = (
    <Command className="pc-focus-picker-command" loop>
      <CommandInput placeholder="Search tasks" aria-label="Search tasks" />
      <CommandList id={listId}>
        <CommandEmpty>No matching open task.</CommandEmpty>
        {grouped.today.length ? (
          <CommandGroup heading="Today's commitments">
            {grouped.today.map(task => (
              <CommandItem key={task.id} value={`${task.title} ${task.id}`} onSelect={() => choose(task.id)} data-selected-task={task.id === value ? "" : undefined}>
                <TaskRow task={task} categoryName={categoryName(task.categoryId)} toneClass={toneFor(task.categoryId)} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {grouped.other.length ? (
          <CommandGroup heading="Other open tasks">
            {grouped.other.map(task => (
              <CommandItem key={task.id} value={`${task.title} ${task.id}`} onSelect={() => choose(task.id)} data-selected-task={task.id === value ? "" : undefined}>
                <TaskRow task={task} categoryName={categoryName(task.categoryId)} toneClass={toneFor(task.categoryId)} />
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Without a task">
          <CommandItem value="No task unlinked" onSelect={() => choose(NO_TASK)}>
            <span className="pc-focus-picker-row">
              <span className="pc-focus-picker-title"><Unlink size={14} aria-hidden="true" /> No task (unlinked)</span>
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );

  const trigger = (
    <button
      type="button"
      role="combobox"
      aria-labelledby={labelId}
      aria-expanded={open}
      aria-haspopup="listbox"
      aria-controls={open ? listId : undefined}
      className="pc-focus-picker-trigger pc-focusable"
      disabled={disabled}
      onClick={phone ? () => setOpen(true) : undefined}
    >
      <Search size={16} aria-hidden="true" className="pc-focus-picker-icon" />
      {selected ? (
        <TaskRow task={selected} categoryName={categoryName(selected.categoryId)} toneClass={toneFor(selected.categoryId)} />
      ) : (
        <span className="pc-focus-picker-row"><span className="pc-focus-picker-title is-muted">No task (unlinked)</span></span>
      )}
      <ChevronDown size={16} aria-hidden="true" className="pc-focus-picker-chevron" />
    </button>
  );

  if (phone) {
    return (
      <>
        {trigger}
        <Sheet open={open} onOpenChange={setOpen} title="Choose a task" className="pc-focus-picker-sheet">
          {list}
        </Sheet>
      </>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="pc-focus-picker-pop">
        {list}
      </PopoverContent>
    </Popover>
  );
}
