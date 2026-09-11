export type TaskBoardFilter = "all" | "today" | "deadline_risk";

export function taskBoardViewFromSearch(search: string) {
  const params = new URLSearchParams(search);
  const requestedFilter = params.get("taskFilter");
  return {
    query: params.get("taskQ") ?? "",
    filter: requestedFilter === "today" || requestedFilter === "deadline_risk" ? requestedFilter : "all" as TaskBoardFilter,
  };
}

export function searchWithTaskBoardView(search: string, view: { query: string; filter: TaskBoardFilter }) {
  const params = new URLSearchParams(search);
  const query = view.query.trim();
  if (query) params.set("taskQ", query); else params.delete("taskQ");
  if (view.filter === "all") params.delete("taskFilter"); else params.set("taskFilter", view.filter);
  return params.toString();
}
