import { Input } from "@/components/ui/input";
import { PlannerSheet } from "@/features/shell/PlannerSheet";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { WorkspaceScope } from "@/lib/workspace";
import { FileText, Flag, Goal, Search, TimerReset } from "lucide-react";
import { useDeferredValue, useEffect, useState, type RefObject } from "react";

export type SearchEntity = "task" | "goal" | "project" | "habit" | "review";
export type SearchOpenEntity = { entity: SearchEntity; id: string; intentionKind?: "outcome" | "direction" | null };
type RetainedSearchState = { query: string; taskQuery: string; taskFilter: string; taskSort: string };
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
      ? target.intentionKind === "direction" ? "directions" : "outcomes"
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

function presentSearchRecord(target: SearchOpenEntity, record: any) {
  if (target.entity === "habit") return { ...record, title: record.name, state: record.archivedAt ? "archived" : "active" };
  if (target.entity !== "review") return record;
  const kind = String(record.kind ?? "review");
  return { ...record, title: `${kind.charAt(0).toUpperCase()}${kind.slice(1)} review · ${record.periodStartLocalDate} to ${record.periodEndLocalDate}` };
}

export function searchRecordDetailState(
  target: SearchOpenEntity,
  query: { data: any; isLoading: boolean; error: { message: string } | null },
):
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "error"; message: string }
  | { status: "ready"; record: any } {
  if (query.isLoading) return { status: "loading" };
  if (query.error) return { status: "error", message: query.error.message || "The record could not be read." };
  if (!query.data) return { status: "unavailable" };
  return { status: "ready", record: presentSearchRecord(target, query.data) };
}

export function SearchRecordSheet({
  target,
  scope,
  returnFocusRef,
  onOpenChange,
}: {
  target: SearchOpenEntity | null;
  scope: WorkspaceScope;
  returnFocusRef: RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
}) {
  const recordQuery = trpc.planner.search.record.useQuery(
    { ...scope, entity: target?.entity ?? "goal", id: target?.id ?? "search-record-disabled" },
    { enabled: Boolean(target), retry: false },
  );
  if (!target) return null;
  const detail = searchRecordDetailState(target, {
    data: recordQuery.data,
    isLoading: recordQuery.isLoading,
    error: recordQuery.error,
  });
  const record = detail.status === "ready" ? detail.record : null;
  const summary = record?.description ?? record?.reflection ?? "No additional text recorded.";
  const state = record?.state ?? (record?.archivedAt ? "archived" : "active");
  return (
    <PlannerSheet
      open
      onOpenChange={onOpenChange}
      returnFocusRef={returnFocusRef}
      title={record?.title ?? (detail.status === "loading" ? "Opening record…" : detail.status === "error" ? "Record could not open" : "Record unavailable")}
      description={`Exact ${target.entity} record from Search. Closing returns to the same result and query.`}
    >
      {detail.status === "loading" ? <div className="search-record-state" role="status">Loading the exact record…</div> : null}
      {detail.status === "unavailable" ? <div className="search-record-state" role="status">This {target.entity} is no longer available in this workspace. Record ID: {target.id}</div> : null}
      {detail.status === "error" ? <div className="search-record-state is-error" role="alert"><p>The record could not be loaded: {detail.message}</p><button type="button" onClick={() => void recordQuery.refetch()}>Try again</button></div> : null}
      {record ? <section className="search-record-detail" aria-label={`${record.title} record details`}>
        <dl>
          <div><dt>Type</dt><dd>{target.entity}</dd></div>
          <div><dt>State</dt><dd>{String(state).replaceAll("_", " ")}</dd></div>
          <div><dt>Record ID</dt><dd>{record.id}</dd></div>
          {record.version ? <div><dt>Version</dt><dd>{record.version}</dd></div> : null}
        </dl>
        <p>{summary}</p>
      </section> : null}
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
            const typeLabel = result.entity === "goal" && result.intentionKind === "direction" ? "Direction" : result.entity === "goal" && result.intentionKind === "outcome" ? "Outcome" : meta.label;
            return <button type="button" key={`${result.entity}-${result.id}`} data-search-result-id={`${result.entity}:${result.id}`} className={cn("workspace-search-result", `is-${result.entity}`)} onClick={event => onOpenEntity({ entity: result.entity, id: result.id, intentionKind: result.intentionKind }, event.currentTarget)}><span className="workspace-search-icon"><Icon size={16} aria-hidden="true" /></span><span><small>{typeLabel} · {result.state.replaceAll("_", " ")}</small><strong>{result.title}</strong>{result.summary ? <p>{result.summary}</p> : <p>No additional text recorded.</p>}</span><span className="workspace-search-open">Open record</span></button>;
          })}
        </div>
      ) : (
        <div className="workspace-search-empty"><Search size={19} /><p>No task, goal, project, habit, or review matched “{deferredQuery}”.</p><button type="button" onClick={() => { setQuery(""); onQueryChange(""); }}>Reset query</button></div>
      )}
    </section>
  );
}
