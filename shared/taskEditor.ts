export type TaskEditorSource = {
  id: string;
  version: number;
};

/**
 * A task editor should reseed its local draft only when the persisted record
 * actually changes. Derived task objects may receive new references during a
 * parent render, so object identity is deliberately not part of this key.
 */
export function taskEditorSourceKey(task: TaskEditorSource) {
  return `${task.id}:${task.version}`;
}
