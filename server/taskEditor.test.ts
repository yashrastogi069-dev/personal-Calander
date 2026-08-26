import { describe, expect, it } from "vitest";
import { taskEditorSourceKey } from "../shared/taskEditor";

describe("taskEditorSourceKey", () => {
  it("stays stable for equivalent derived task objects and changes only for a persisted record revision", () => {
    expect(taskEditorSourceKey({ id: "task-1", version: 4 })).toBe(taskEditorSourceKey({ id: "task-1", version: 4 }));
    expect(taskEditorSourceKey({ id: "task-1", version: 4 })).not.toBe(taskEditorSourceKey({ id: "task-1", version: 5 }));
    expect(taskEditorSourceKey({ id: "task-1", version: 4 })).not.toBe(taskEditorSourceKey({ id: "task-2", version: 4 }));
  });
});
