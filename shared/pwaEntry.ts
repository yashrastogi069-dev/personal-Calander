export type PwaEntryIntent = {
  composeTask: boolean;
  surface: "today" | null;
  cleanedSearch: string;
};

export function pwaEntryFromSearch(search: string): PwaEntryIntent {
  const parameters = new URLSearchParams(search);
  if (parameters.get("source") !== "pwa-shortcut") {
    return { composeTask: false, surface: null, cleanedSearch: search };
  }

  const composeTask = parameters.get("compose") === "task";
  const surface = parameters.get("surface") === "today" ? "today" : null;
  parameters.delete("source");
  if (composeTask) parameters.delete("compose");
  if (surface) parameters.delete("surface");
  const cleaned = parameters.toString();
  return { composeTask, surface, cleanedSearch: cleaned ? `?${cleaned}` : "" };
}
