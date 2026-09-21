import { Input } from "@/components/ui/input";
import { PlannerSheet } from "@/features/shell/PlannerSheet";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { WorkspaceScope } from "@/lib/workspace";
import { FileText, Flag, Goal, Search, TimerReset } from "lucide-react";
import { useDeferredValue, useEffect, useState, type RefObject } from "react";

type SearchEntity = "task" | "goal" | "project" | "habit" | "review";
export type SearchOpenEntity = { entity: SearchEntity; id: string };
type RetainedSearchState = { query: string; taskQuery: string; taskFilter: string };
type WorkspaceSearchWorkspaceProps = {
  scope: WorkspaceScope;
  initialQuery: string;
  onQueryChange: (query: string) => void;
  onOpenEntity: (target: SearchOpenEntity, trigger: HTMLButtonElement) => void;
};

export function searchOpenLocation(target: SearchOpenEntity, retained: RetainedSearchState) {
  const destination = target.entity === "task"
    ? "tasks"
    : target.entity === "goal" || target.entity === "project"
      ? "intentions"
      : target.entity === "habit"
        ? "habits"
        : "review";
  const view = target.entity === "task"
    ? "list"
    : target.entity === "goal"
      ? "outcomes"
      : target.entity === "project"
        ? "projects"
        : target.entity === "habit"
          ? "due"
          : "rituals";
  return { destination, view, selectedRecord: target.id, ...retained };
}

export function searchEntityForLocation(location: { destination: string; view: string }): SearchEntity | null {
  if (location.destination === "tasks") return "task";
  if (location.destination === "intentions") return location.view === "projects" ? "project" : "goal";
  if (location.destination === "habits") return "habit";
  if (location.destination === "review") return "review";
  return null;
}

export function searchRecordFromSnapshot(snapshot: any, target: SearchOpenEntity) {
  if (target.entity === "task") return snapshot.tasks?.find((record: any) => record.id === target.id) ?? null;
  if (target.entity === "goal") return snapshot.goals?.find((record: any) => record.id === target.id) ?? null;
  if (target.entity === "project") return snapshot.projects?.find((record: any) => record.id === target.id) ?? null;
  if (target.entity === "habit") {
    const record = snapshot.habits?.find((candidate: any) => candidate.id === target.id);
    return record ? { ...record, title: record.name, state: record.archivedAt ? "archived" : "active" } : null;
  }
  const record = snapshot.reviewSessions?.find((candidate: any) => candidate.id === target.id);
  if (!record) return null;
  const kind = String(record.kind ?? "review");
  return {
    ...record,
    title: `${kind.charAt(0).toUpperCase()}${kind.slice(1)} review · ${record.periodStartLocalDate} to ${record.periodEndLocalDate}`,
  };
}

export function SearchRecordSheet({
  target,
  snapshot,
  returnFocusRef,
  onOpenChange,
}: {
  target: SearchOpenEntity | null;
  snapshot: any;
  returnFocusRef: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
}) {
  const record = target ? searchRecordFromSnapshot(snapshot, target) : null;
  if (!target || !record) return null;
  const summary = record.description ?? record.reflection ?? "No additional text recorded.";
  const state = record.state ?? (record.archivedAt ? "archived" : "active");
  return (
    <PlannerSheet
      open
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      title={record.title}
      description={`Exact ${target.entity} record from Search. Closing returns to the same result and query.`}
    >
      <section className="search-record-detail" aria-label={`${record.title} record details`}>
        <dl>
          <div><dt>Type</dt><dd>{target.entity}</dd></div>
          <div><dt>State</dt><dd>{String(state).replaceAll("_", " ")}</dd></div>
          <div><dt>Record ID</dt><dd>{record.id}</dd></div>
          {record.version ? <div><dt>Version</dt><dd>{record.version}</dd></div> : null}
        </dl>
        <p>{summary}</p>
      </section>
    </PlannerSheet>
  );
}
const entityMeta: Record<SearchEntity, { label: string; icon: typeof Search }> = {
  task: { label: "Task", icon: Search },
  goal: { label: "Goal", icon: Goal },
  project: { label: "Project", icon: Flag },
  habit: { label: "Habit", icon: TimerReset },
  review: { label: "Review", icon: FileText },
};

export function WorkspaceSearchWorkspace({ scope, initialQuery, onQueryChange, onOpenEntity }: WorkspaceSearchWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query.trim());
  const enabled = deferredQuery.length >= 2;
  const search = trpc.planner.search.workspace.useQuery(
    { ...scope, query: deferredQuery, limit: 30 },
    { enabled, retry: false },
  );
  useEffect(() => setQuery(initialQuery), [initialQuery]);
  useEffect(() => {
    const timeout = window.setTimeout(() => onQueryChange(query.trim()), 180);
    return () => window.clearTimeout(timeout);
  }, [onQueryChange, query]);

  return (
    <section className="workspace-search" aria-labelledby="workspace-search-heading">
      <header><div><h2 id="workspace-search-heading">Find your work and evidence.</h2><p>Searches task, goal, project, habit, and saved review text in this workspace. Search terms stay in the link; filters are never silently reset.</p></div><Search size={28} aria-hidden="true" /></header>
      <label htmlFor="workspace-search-query">Search this workspace</label>
      <div className="workspace-search-input"><Search size={18} aria-hidden="true" /><Input id="workspace-search-query" value={query} onChange={event => setQuery(event.target.value)} autoFocus maxLength={160} placeholder="Try a task, project, habit, or review phrase" /><span>{query.trim().length}/160</span></div>
      {!enabled ? (
        <div className="workspace-search-empty"><Search size={19} /><p>Enter at least two characters to search your planning records.</p></div>
      ) : search.isLoading ? (
        <div className="workspace-search-empty" aria-live="polite"><Search size={19} /><p>Searching this workspace…</p></div>
      ) : search.error ? (
        <div className="workspace-search-error" role="alert">Search could not complete: {search.error.message}. Check the term and try again.</div>
      ) : search.data?.length ? (
        <div className="workspace-search-results" aria-live="polite">
          {search.data.map(result => {
            const meta = entityMeta[result.entity];
            const Icon = meta.icon;
            return <button type="button" key={`${result.entity}-${result.id}`} data-search-result-id={`${result.entity}:${result.id}`} className={cn("workspace-search-result", `is-${result.entity}`)} onClick={event => onOpenEntity({ entity: result.entity, id: result.id }, event.currentTarget)}><span className="workspace-search-icon"><Icon size={16} /></span><span><small>{meta.label} · {result.state.replaceAll("_", " ")}</small><strong>{result.title}</strong>{result.summary ? <p>{result.summary}</p> : <p>No additional text recorded.</p>}</span><span className="workspace-search-open">Open record</span></button>;
          })}
        </div>
      ) : (
        <div className="workspace-search-empty"><Search size={19} /><p>No task, goal, project, habit, or review matched “{deferredQuery}”.</p><button type="button" onClick={() => { setQuery(""); onQueryChange(""); }}>Reset query</button></div>
      )}
    </section>
  );
}
