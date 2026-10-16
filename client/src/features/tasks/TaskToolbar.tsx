// D3 TaskToolbar: search (`/` focuses, Escape clears then blurs), quick filter chips with live counts, the
// Filter popover (category, project, priority), applied filters as removable chips, the Sort menu, the Board
// lens toggle, the List Group by switch (Q7, Tasks T2a) and Save view. All state lives in the caller (URL and saved views); this only draws and reports.
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ArrowUpDown, BookmarkPlus, Flag, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, type KeyboardEvent, type RefObject } from "react";
import { ChipSelect } from "@/components/premium/ChipSelect";
import { FilterChips, RemovableChip, RollingCount, type FilterChipItem } from "@/components/premium/FilterChips";
import { SegmentedTabs } from "@/components/premium/SegmentedTabs";
import type { ToneOrNeutral } from "@/design/categoryTone";
import { cn } from "@/lib/utils";
import type { TaskBoardFilter } from "@shared/taskBoardUrl";
import {
  taskPriorities,
  taskQuickFilters,
  taskSortOptions,
  type TaskBoardLens,
  type TaskFacetFilters,
  type TaskListGroupBy,
  type TaskPriority,
  type TaskWorkspaceSort,
} from "./taskWorkspaceModel";
import "./tasks-premium.css";

export type TaskFacetOption = { value: string; label: string; tone?: ToneOrNeutral };

export type TaskToolbarProps = {
  /** The lens toggle shows on the Board only. */
  view: "list" | "board";
  query: string;
  onQueryChange: (query: string) => void;
  /** Ref to the search input, so the page can focus it from a shortcut. */
  searchRef?: RefObject<HTMLInputElement | null>;
  filter: TaskBoardFilter;
  counts: Record<TaskBoardFilter, number>;
  onFilterChange: (filter: TaskBoardFilter) => void;
  facets: TaskFacetFilters;
  onFacetsChange: (facets: TaskFacetFilters) => void;
  categoryOptions: ReadonlyArray<TaskFacetOption>;
  projectOptions: ReadonlyArray<TaskFacetOption>;
  sort: TaskWorkspaceSort;
  onSortChange: (sort: TaskWorkspaceSort) => void;
  lens?: TaskBoardLens;
  onLensChange?: (lens: TaskBoardLens) => void;
  /** List Group by (When / Project / Category). Shows on the List only. */
  group?: TaskListGroupBy;
  onGroupChange?: (group: TaskListGroupBy) => void;
  /** Show Save view: the current state differs from the applied saved view. */
  canSaveView?: boolean;
  onSaveView?: () => void;
  className?: string;
};

const PRIORITY_LABELS: Record<TaskPriority, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", none: "No priority" };

export function activeFacetCount(facets: TaskFacetFilters) {
  return facets.categoryIds.length + facets.projectIds.length + facets.priorities.length;
}

function toggled<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

/** True when a key press should focus search: "/" outside any text field. */
export function isSearchShortcut(event: Pick<KeyboardEvent | globalThis.KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">, target: EventTarget | null) {
  if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return false;
  const element = target as HTMLElement | null;
  if (!element) return true;
  const tag = element.tagName;
  return !(tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || element.isContentEditable);
}

export function TaskToolbar({
  view,
  query,
  onQueryChange,
  searchRef,
  filter,
  counts,
  onFilterChange,
  facets,
  onFacetsChange,
  categoryOptions,
  projectOptions,
  sort,
  onSortChange,
  lens,
  onLensChange,
  group,
  onGroupChange,
  canSaveView = false,
  onSaveView,
  className,
}: TaskToolbarProps) {
  const ownRef = useRef<HTMLInputElement | null>(null);
  const inputRef = searchRef ?? ownRef;
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!isSearchShortcut(event, event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inputRef]);

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return;
    if (query) {
      onQueryChange("");
      event.stopPropagation();
    } else {
      event.currentTarget.blur();
    }
  };

  const chips: FilterChipItem[] = taskQuickFilters.map(item => ({ value: item.id, label: item.label, count: counts[item.id] }));
  const activeFacets = activeFacetCount(facets);
  const applied = [
    ...facets.categoryIds.map(id => ({ key: `c-${id}`, label: categoryOptions.find(option => option.value === id)?.label ?? "Category", tone: categoryOptions.find(option => option.value === id)?.tone, remove: () => onFacetsChange({ ...facets, categoryIds: facets.categoryIds.filter(item => item !== id) }) })),
    ...facets.projectIds.map(id => ({ key: `p-${id}`, label: projectOptions.find(option => option.value === id)?.label ?? "Project", tone: undefined, remove: () => onFacetsChange({ ...facets, projectIds: facets.projectIds.filter(item => item !== id) }) })),
    ...facets.priorities.map(priority => ({ key: `r-${priority}`, label: PRIORITY_LABELS[priority], tone: undefined, remove: () => onFacetsChange({ ...facets, priorities: facets.priorities.filter(item => item !== priority) }) })),
  ];

  return (
    <div className={cn("tk-toolbar", className)} role="search" aria-label="Filter tasks">
      <div className="tk-toolbar-row">
        <label className="tk-search">
          <Search size={16} strokeWidth={2} aria-hidden="true" />
          <span className="pc-sr-only">Search tasks</span>
          <input
            ref={inputRef}
            data-task-search
            type="search"
            value={query}
            placeholder="Search tasks"
            autoComplete="off"
            enterKeyHint="search"
            onChange={event => onQueryChange(event.target.value)}
            onKeyDown={onSearchKey}
          />
          {query ? (
            <button type="button" className="tk-search-clear pc-focusable" aria-label="Clear search" onClick={() => { onQueryChange(""); inputRef.current?.focus(); }}>
              <X size={14} strokeWidth={2.5} aria-hidden="true" />
            </button>
          ) : <kbd className="tk-kbd" aria-hidden="true">/</kbd>}
        </label>
        <FilterChips
          className="is-scroll tk-quick"
          label="Quick filter"
          items={chips}
          selected={filter}
          onToggle={value => onFilterChange(value as TaskBoardFilter)}
        />
        <div className="tk-toolbar-tools">
          <PopoverPrimitive.Root>
            <PopoverPrimitive.Trigger asChild>
              <button type="button" className={cn("pc-cselect pc-focusable tk-filter-btn", activeFacets > 0 && "has-active")} aria-haspopup="dialog">
                <SlidersHorizontal size={15} strokeWidth={2} aria-hidden="true" className="pc-cselect-icon" />
                <span>Filter</span>
                {activeFacets > 0 ? <RollingCount value={activeFacets} className="tk-filter-badge" /> : null}
              </button>
            </PopoverPrimitive.Trigger>
            <PopoverPrimitive.Portal>
              <PopoverPrimitive.Content className="pc-cselect-panel tk-filter-panel" align="end" sideOffset={6} collisionPadding={12} aria-label="Filter tasks by category, project and priority">
                <div className="tk-filter-groups">
                  <section aria-labelledby="tk-filter-cat">
                    <h3 id="tk-filter-cat" className="tk-filter-title">Category</h3>
                    {categoryOptions.length ? (
                      <FilterChips
                        label="Category"
                        selected={facets.categoryIds}
                        items={categoryOptions.map(option => ({ value: option.value, label: option.label, tone: option.tone ?? "neutral" }))}
                        onToggle={value => onFacetsChange({ ...facets, categoryIds: toggled(facets.categoryIds, value) })}
                      />
                    ) : <p className="tk-filter-none">No categories yet.</p>}
                  </section>
                  <section aria-labelledby="tk-filter-proj">
                    <h3 id="tk-filter-proj" className="tk-filter-title">Project</h3>
                    {projectOptions.length ? (
                      <FilterChips
                        className="is-scroll-y"
                        label="Project"
                        selected={facets.projectIds}
                        items={projectOptions.map(option => ({ value: option.value, label: option.label }))}
                        onToggle={value => onFacetsChange({ ...facets, projectIds: toggled(facets.projectIds, value) })}
                      />
                    ) : <p className="tk-filter-none">No projects yet.</p>}
                  </section>
                  <section aria-labelledby="tk-filter-pri">
                    <h3 id="tk-filter-pri" className="tk-filter-title">Priority</h3>
                    <FilterChips
                      label="Priority"
                      selected={facets.priorities}
                      items={taskPriorities.map(priority => ({ value: priority, label: PRIORITY_LABELS[priority], icon: Flag }))}
                      onToggle={value => onFacetsChange({ ...facets, priorities: toggled(facets.priorities, value as TaskPriority) })}
                    />
                  </section>
                </div>
                {activeFacets > 0 ? (
                  <button type="button" className="tk-btn is-ghost pc-focusable tk-filter-reset" onClick={() => onFacetsChange({ categoryIds: [], projectIds: [], priorities: [] })}>Clear filters</button>
                ) : null}
              </PopoverPrimitive.Content>
            </PopoverPrimitive.Portal>
          </PopoverPrimitive.Root>
          <ChipSelect<TaskWorkspaceSort>
            label="Sort"
            showLabel
            icon={ArrowUpDown}
            align="end"
            value={sort}
            onValueChange={onSortChange}
            options={taskSortOptions.map(option => ({ value: option.id, label: option.label }))}
          />
          {canSaveView && onSaveView ? (
            <button type="button" className="tk-btn is-ghost pc-focusable" onClick={onSaveView}><BookmarkPlus size={16} strokeWidth={2} aria-hidden="true" />Save view</button>
          ) : null}
        </div>
      </div>
      {view === "list" && group && onGroupChange ? (
        <div className="tk-lens">
          <span className="tk-lens-label">Group</span>
          <SegmentedTabs<TaskListGroupBy>
            label="Group by"
            value={group}
            onValueChange={onGroupChange}
            items={[{ value: "when", label: "When" }, { value: "project", label: "Project" }, { value: "category", label: "Category" }]}
          />
        </div>
      ) : null}
      {view === "board" && lens && onLensChange ? (
        <div className="tk-lens">
          <span className="tk-lens-label">Lens</span>
          <SegmentedTabs<TaskBoardLens>
            label="Board lens"
            value={lens}
            onValueChange={onLensChange}
            items={[{ value: "status", label: "Status" }, { value: "when", label: "When" }]}
          />
        </div>
      ) : null}
      {applied.length ? (
        <div className="tk-applied" role="group" aria-label="Applied filters">
          {applied.map(item => <RemovableChip key={item.key} label={item.label} tone={item.tone} onRemove={item.remove} />)}
        </div>
      ) : null}
    </div>
  );
}
