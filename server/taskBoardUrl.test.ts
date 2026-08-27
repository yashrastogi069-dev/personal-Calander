import { describe, expect, it } from "vitest";
import { searchWithTaskBoardView, taskBoardViewFromSearch } from "../shared/taskBoardUrl";

describe("task board URL state", () => {
  it("reads only supported task filters and retains the task-specific query", () => {
    expect(taskBoardViewFromSearch("?surface=tasks&taskQ=release&taskFilter=deadline_risk")).toEqual({ query: "release", filter: "deadline_risk" });
    expect(taskBoardViewFromSearch("?taskFilter=unknown")).toEqual({ query: "", filter: "all" });
  });

  it("preserves unrelated destination state while adding and clearing task-board controls", () => {
    expect(searchWithTaskBoardView("surface=tasks&q=plan", { query: "release", filter: "today" })).toBe("surface=tasks&q=plan&taskQ=release&taskFilter=today");
    expect(searchWithTaskBoardView("surface=tasks&taskQ=release&taskFilter=today", { query: "", filter: "all" })).toBe("surface=tasks");
  });
});
