import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type { WorkspaceScope } from "@/lib/workspace";
import { FileText, Flag, Goal, Search, TimerReset } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";

type SearchEntity = "task" | "goal" | "project" | "habit" | "review";
type WorkspaceSearchWorkspaceProps = { scope: WorkspaceScope; initialQuery: string; onQueryChange: (query: string) => void; onOpenEntity: (entity: SearchEntity) => void };

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
  const search = trpc.planner.search.workspace.useQuery({ ...scope, query: deferredQuery, limit: 30 }, { enabled, retry: false });
  useEffect(() => { const timeout = window.setTimeout(() => onQueryChange(query.trim()), 180); return () => window.clearTimeout(timeout); }, [onQueryChange, query]);
  return <section className="workspace-search" aria-labelledby="workspace-search-heading"><header><div><h2 id="workspace-search-heading">Find your work and evidence.</h2><p>Searches task, goal, project, habit, and saved review text in this workspace. Search terms stay in the link; filters are never silently reset.</p></div><Search size={28} aria-hidden="true" /></header><label htmlFor="workspace-search-query">Search this workspace</label><div className="workspace-search-input"><Search size={18} aria-hidden="true" /><Input id="workspace-search-query" value={query} onChange={event => setQuery(event.target.value)} autoFocus maxLength={160} placeholder="Try a task, project, habit, or review phrase" /><span>{query.trim().length}/160</span></div>{!enabled ? <div className="workspace-search-empty"><Search size={19} /><p>Enter at least two characters to search your planning records.</p></div> : search.isLoading ? <div className="workspace-search-empty" aria-live="polite"><Search size={19} /><p>Searching this workspace…</p></div> : search.error ? <div className="workspace-search-error" role="alert">Search could not complete: {search.error.message}. Check the term and try again.</div> : search.data?.length ? <div className="workspace-search-results" aria-live="polite">{search.data.map(result => { const meta = entityMeta[result.entity]; const Icon = meta.icon; return <button type="button" key={`${result.entity}-${result.id}`} className={cn("workspace-search-result", `is-${result.entity}`)} onClick={() => onOpenEntity(result.entity)}><span className="workspace-search-icon"><Icon size={16} /></span><span><small>{meta.label} · {result.state.replaceAll("_", " ")}</small><strong>{result.title}</strong>{result.summary ? <p>{result.summary}</p> : <p>No additional text recorded.</p>}</span><span className="workspace-search-open">Open</span></button>; })}</div> : <div className="workspace-search-empty"><Search size={19} /><p>No task, goal, project, habit, or review matched “{deferredQuery}”. Try a shorter or more specific phrase.</p></div>}</section>;
}
