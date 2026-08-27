export type OrderedDailyPlanItem = { id: string; position: number; state: string };

export function reorderCommittedDailyPlanItems<T extends OrderedDailyPlanItem>(items: T[], itemId: string, direction: -1 | 1) {
  const ordered = items.filter(item => item.state === "committed").slice().sort((left, right) => left.position - right.position || left.id.localeCompare(right.id));
  const currentIndex = ordered.findIndex(item => item.id === itemId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ordered.length) return null;
  const moved = [...ordered];
  const [item] = moved.splice(currentIndex, 1);
  moved.splice(nextIndex, 0, item);
  return moved.map((entry, index) => ({ id: entry.id, position: index }));
}
