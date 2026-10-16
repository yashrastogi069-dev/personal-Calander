// Dev-only gallery section for the D3 Tasks presentation layer. Fixture data only (taskCardFixtures.ts);
// the theme switch flips html.dark so every state can be checked in light and dark.
import { useState, type ReactNode } from "react";
import { ChipMultiSelect, ChipSelect } from "@/components/premium/ChipSelect";
import { FilterChips, RemovableChip } from "@/components/premium/FilterChips";
import { CheckButton } from "@/features/tasks/CheckButton";
import { fixtureTaskCard, fixtureTaskCardVariants } from "@/features/tasks/taskCardFixtures";
import { TaskHeader } from "@/features/tasks/TaskHeader";
import { TaskListSections } from "@/features/tasks/TaskListSections";
import { TaskMetaPills } from "@/features/tasks/TaskMetaPills";
import { TaskRow } from "@/features/tasks/TaskRow";
import { TaskSkeleton } from "@/features/tasks/TaskSkeleton";
import { TaskToolbar, type TaskToolbarProps } from "@/features/tasks/TaskToolbar";
import type { TaskListSection } from "@/features/tasks/taskWorkspaceModel";
import type { TaskCardModel } from "@/features/tasks/taskCardModel";

const noop = () => {};

function Frame({ title, width, children }: { title: string; width?: number; children: ReactNode }) {
  return (
    <section style={{ padding: 20, borderRadius: "var(--pc-r-panel)", background: "var(--pc-page)", border: "1px solid var(--pc-line)", display: "grid", gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: "var(--pc-text-body)", fontWeight: 650 }}>{title}</h3>
      <div style={{ width: width ? Math.min(width, 9999) : "100%", maxWidth: "100%", display: "grid", gap: 12 }}>{children}</div>
    </section>
  );
}

function sections(): Array<TaskListSection<TaskCardModel>> {
  const variants = fixtureTaskCardVariants();
  const pick = (...labels: string[]) => variants.filter(item => labels.includes(item.label)).map(item => item.model);
  const make = (id: TaskListSection<TaskCardModel>["id"], label: string, tasks: TaskCardModel[], extra: Partial<TaskListSection<TaskCardModel>> = {}): TaskListSection<TaskCardModel> =>
    ({ id, label, tasks, count: tasks.length, overdueCount: 0, somedayCount: 0, plannedMinutes: 0, doneTodayCount: 0, ...extra });
  return [
    make("past_due", "Past due", pick("Overdue"), { overdueCount: 1 }),
    make("today", "Today", pick("Rich", "Recurring", "Blocked"), { plannedMinutes: 135, doneTodayCount: 1 }),
    make("later", "Later", pick("Plain")),
    make("no_date", "No date", pick("Someday", "Pending and conflict"), { somedayCount: 1 }),
    make("done", "Done", pick("Done")),
  ];
}

export default function PremiumGalleryTasks() {
  const [dark, setDark] = useState(() => (typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : false));
  const [checks, setChecks] = useState({ a: false, b: true });
  const [filter, setFilter] = useState("today");
  const [sort, setSort] = useState("manual");
  const [cats, setCats] = useState<string[]>(["work"]);
  const [view, setView] = useState<"inbox" | "list" | "board" | "archive">("list");
  const [toolbar, setToolbar] = useState<Pick<TaskToolbarProps, "query" | "facets" | "filter" | "sort">>({
    query: "",
    facets: { categoryIds: ["work"], projectIds: [], priorities: ["high"] },
    filter: "all",
    sort: "manual",
  });
  const toggleTheme = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
  };
  const variants = fixtureTaskCardVariants();
  return (
    <div className="pc-gallery-tasks" style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: "var(--pc-text-h1)", lineHeight: "var(--pc-lh-h1)", fontWeight: 750, letterSpacing: "-.03em" }}>Tasks (D3)</h2>
        <button type="button" className="tk-btn pc-focusable" aria-pressed={dark} onClick={toggleTheme}>{dark ? "Dark theme" : "Light theme"}</button>
      </div>

      <Frame title="Header">
        <TaskHeader summary={{ open: 36, overdue: 3, forToday: 13, inbox: 4 }} view={view} onViewChange={setView} reviewCount={2} onReview={noop} />
      </Frame>
      <Frame title="Header, offline with saved copy">
        <TaskHeader summary={{ open: 36, overdue: 0, forToday: 0, inbox: 0 }} view="list" onViewChange={noop} offline savedCopyLabel="Showing saved copy from 10:42" />
      </Frame>

      <Frame title="Toolbar (List)">
        <TaskToolbar
          view="list"
          query={toolbar.query}
          onQueryChange={query => setToolbar(current => ({ ...current, query }))}
          filter={toolbar.filter}
          counts={{ all: 36, open: 33, today: 13, deadline_risk: 3 }}
          onFilterChange={next => setToolbar(current => ({ ...current, filter: next }))}
          facets={toolbar.facets}
          onFacetsChange={facets => setToolbar(current => ({ ...current, facets }))}
          categoryOptions={[{ value: "work", label: "Work", tone: "work" }, { value: "health", label: "Health", tone: "health" }, { value: "personal", label: "Personal", tone: "personal" }]}
          projectOptions={[{ value: "q4", label: "Q4 planning" }, { value: "move", label: "Moving house" }]}
          sort={toolbar.sort}
          onSortChange={next => setToolbar(current => ({ ...current, sort: next }))}
        />
      </Frame>
      <Frame title="Toolbar (Board, 390px)" width={390}>
        <TaskToolbar view="board" lens="status" onLensChange={noop} query="" onQueryChange={noop} filter="today" counts={{ all: 36, open: 33, today: 13, deadline_risk: 3 }} onFilterChange={noop} facets={{ categoryIds: [], projectIds: [], priorities: [] }} onFacetsChange={noop} categoryOptions={[]} projectOptions={[]} sort="manual" onSortChange={noop} />
      </Frame>

      <Frame title="Check button states (click the first two)">
        <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
          <CheckButton title="Unchecked" checked={checks.a} tone="work" onToggle={() => setChecks(current => ({ ...current, a: !current.a }))} />
          <CheckButton title="Checked" checked={checks.b} tone="health" onToggle={() => setChecks(current => ({ ...current, b: !current.b }))} />
          <CheckButton title="Guarded" checked={false} tone="personal" blockedReason="Waiting on 2 tasks." onToggle={noop} />
          <CheckButton title="Archived" checked={false} tone="neutral" inert onToggle={noop} />
          <CheckButton title="Saving" checked={false} tone="social" pending onToggle={noop} />
        </div>
      </Frame>

      <Frame title="Pills, every kind">
        <div style={{ display: "grid", gap: 10 }}>
          {variants.map(item => <TaskMetaPills key={item.label} model={item.model} />)}
          <TaskMetaPills model={fixtureTaskCard({ state: "in_progress", categoryName: "Health", tone: "health", priority: "critical", estimateMinutes: 25, blocks: 3 })} />
        </div>
      </Frame>

      <Frame title="Rows at 1440 (wide list)">
        <ul className="tk-rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {variants.map((item, index) => (
            <TaskRow key={item.label} model={item.model} index={index} enter onOpen={noop} onToggle={noop} onStartFocus={noop} actions={[{ id: "open", label: "Open details", onSelect: noop }, { id: "archive", label: "Archive", onSelect: noop, danger: true }]} />
          ))}
        </ul>
      </Frame>
      <Frame title="Rows at 390 (phone list)" width={390}>
        <ul className="tk-rows" style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {variants.map((item, index) => <TaskRow key={item.label} model={item.model} index={index} enter onOpen={noop} onToggle={noop} actions={[{ id: "open", label: "Open details", onSelect: noop }]} />)}
        </ul>
      </Frame>

      <Frame title="Sections (Done collapsed by default)">
        <TaskListSections sections={sections()} onOpen={noop} onToggle={noop} onStartFocus={noop} />
      </Frame>
      <Frame title="Empty: first run">
        <TaskListSections sections={[]} onOpen={noop} onToggle={noop} empty={{ kind: "first-run", onCapture: noop }} />
      </Frame>
      <Frame title="Empty: filtered">
        <TaskListSections sections={[]} onOpen={noop} onToggle={noop} empty={{ kind: "filtered", scope: "Today", query: "invoice", onClear: noop }} />
      </Frame>

      <Frame title="Chips and selects">
        <FilterChips label="Quick filter" selected={filter} onToggle={setFilter} items={[{ value: "all", label: "All", count: 36 }, { value: "today", label: "Today", count: 13 }, { value: "overdue", label: "Overdue", count: 3 }, { value: "done", label: "Done", count: 5 }]} />
        <FilterChips label="Category" selected={cats} onToggle={value => setCats(current => (current.includes(value) ? current.filter(item => item !== value) : [...current, value]))} items={[{ value: "work", label: "Work", tone: "work" }, { value: "health", label: "Health", tone: "health" }, { value: "personal", label: "Personal", tone: "personal" }]} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <RemovableChip label="Work" tone="work" onRemove={noop} />
          <RemovableChip label="High" onRemove={noop} />
          <ChipSelect label="Sort" showLabel value={sort} onValueChange={setSort} options={[{ value: "manual", label: "Manual" }, { value: "deadline", label: "Deadline" }, { value: "priority", label: "Priority", description: "Critical first" }, { value: "created", label: "Created", disabled: true }]} />
          <ChipMultiSelect label="Categories" values={cats} onValuesChange={setCats} options={[{ value: "work", label: "Work", tone: "work" }, { value: "health", label: "Health", tone: "health" }]} />
        </div>
        <div style={{ maxWidth: 320 }}>
          <ChipSelect label="Project" variant="field" value="none" onValueChange={noop} options={[{ value: "none", label: "No project" }, { value: "q4", label: "Q4 planning" }]} />
        </div>
      </Frame>

      <Frame title="Skeletons">
        <TaskSkeleton variant="list" rows={4} />
        <TaskSkeleton variant="board" lanes={3} cardsPerLane={2} />
      </Frame>
    </div>
  );
}
